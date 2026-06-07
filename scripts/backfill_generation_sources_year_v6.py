import csv
import datetime as dt
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ELEXON_FUELINST = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST"
PVLIVE_GSP0 = "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0"
OUT_DIR = Path("data/generation")
REPORT_DIR = Path("uk_energy_tracking_v6/generation_history/backfill_reports")
FIELDS = ["source", "periodStartUTC", "fuelType", "generationMW", "publishTimeUTC", "fetchedAtUTC"]


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def iso_z(value):
    if not value:
        return ""
    text = str(value).replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return str(value)


def pick(row, names):
    folded = {str(k).lower(): v for k, v in row.items()}
    for name in names:
        value = folded.get(name.lower())
        if value not in (None, ""):
            return value
    return ""


def num(value):
    if value in (None, ""):
        return None
    try:
        return f"{float(value):.3f}"
    except Exception:
        return None


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def elexon_url(start_dt, end_dt):
    query = urllib.parse.urlencode({
        "publishDateTimeFrom": start_dt.strftime("%Y-%m-%dT%H:%MZ"),
        "publishDateTimeTo": end_dt.strftime("%Y-%m-%dT%H:%MZ"),
        "format": "json",
    })
    return f"{ELEXON_FUELINST}?{query}"


def fetch_elexon_day(day):
    start_dt = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
    end_dt = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
    payload = http_json(elexon_url(start_dt, end_dt))
    fetched = utc_now()
    output = []
    for row in extract_rows(payload):
        if not isinstance(row, dict):
            continue
        fuel = pick(row, ["fuelType", "fuelTypeName", "fuel", "psrType"])
        generation = pick(row, ["generation", "generationMW", "currentUsage", "quantity"])
        period_start = pick(row, ["startTime", "publishDateTime", "periodStartUTC", "settlementDate"])
        publish_time = pick(row, ["publishDateTime", "publishTime", "createdTime"])
        generation_mw = num(generation)
        if not fuel or generation_mw is None or not period_start:
            continue
        output.append({
            "source": "Elexon BMRS FUELINST",
            "periodStartUTC": iso_z(period_start),
            "fuelType": str(fuel).strip().upper(),
            "generationMW": generation_mw,
            "publishTimeUTC": iso_z(publish_time),
            "fetchedAtUTC": fetched,
        })
    return output


def pvlive_candidate_urls(start_dt, end_dt):
    start_iso = start_dt.isoformat().replace("+00:00", "Z")
    end_iso = end_dt.isoformat().replace("+00:00", "Z")
    start_plain = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_plain = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    start_date = start_dt.date().isoformat()
    end_date = end_dt.date().isoformat()
    candidates = [
        {"start": start_iso, "end": end_iso},
        {"start": start_plain, "end": end_plain},
        {"from": start_iso, "to": end_iso},
        {"datetime_from": start_iso, "datetime_to": end_iso},
        {"start_date": start_date, "end_date": end_date},
    ]
    return [PVLIVE_GSP0 + "?" + urllib.parse.urlencode(params) for params in candidates]


def parse_pvlive_row(row, fetched):
    if isinstance(row, list):
        if len(row) < 3:
            return None
        timestamp = row[1]
        generation = row[2]
    elif isinstance(row, dict):
        timestamp = row.get("datetime_gmt") or row.get("datetime") or row.get("time") or row.get("timestamp") or row.get("periodStartUTC")
        generation = row.get("generation_mw") or row.get("generationMW") or row.get("generation") or row.get("power")
    else:
        return None
    generation_mw = num(generation)
    period_start = iso_z(timestamp)
    if not period_start or generation_mw is None:
        return None
    return {
        "source": "Sheffield Solar PVLive",
        "periodStartUTC": period_start,
        "fuelType": "SOLAR",
        "generationMW": generation_mw,
        "publishTimeUTC": "",
        "fetchedAtUTC": fetched,
    }


def fetch_pvlive_day(day):
    start_dt = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
    end_dt = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
    errors = []
    for url in pvlive_candidate_urls(start_dt, end_dt):
        try:
            payload = http_json(url)
            fetched = utc_now()
            rows = []
            for row in extract_rows(payload):
                parsed = parse_pvlive_row(row, fetched)
                if parsed:
                    rows.append(parsed)
            if rows:
                return rows, "ok", url
        except Exception as exc:
            errors.append(str(exc))
    return [], "; ".join(errors[-2:]) or "no parseable PVLive rows", ""


def load_existing_year(year):
    path = OUT_DIR / f"elexon_generation_sources_{year}.csv"
    if not path.exists():
        return {}
    rows = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row.get("periodStartUTC", ""), row.get("fuelType", ""))
            if key[0] and key[1]:
                rows[key] = {field: row.get(field, "") for field in FIELDS}
    return rows


def write_year(year, rows_by_key):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"elexon_generation_sources_{year}.csv"
    rows = [rows_by_key[key] for key in sorted(rows_by_key, key=lambda x: (x[0], x[1]))]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return path, len(rows)


def write_report(year, start_day, end_day, elexon_rows, solar_rows, total_rows, solar_status, solar_url):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report = REPORT_DIR / f"GENERATION_HISTORY_BACKFILL_{year}.md"
    report.write_text("\n".join([
        f"# Generation History Backfill {year}",
        "",
        f"Updated UTC: {utc_now()}",
        f"Year: {year}",
        f"Window: {start_day} to {end_day}",
        f"Elexon rows fetched this run: {elexon_rows}",
        f"PVLive solar rows fetched this run: {solar_rows}",
        f"Annual rows after merge: {total_rows}",
        f"PVLive status: {solar_status}",
        f"PVLive working URL sample: {solar_url or 'not confirmed'}",
        "Sources: Elexon BMRS FUELINST and Sheffield Solar PVLive where available",
        "Output: data/generation/elexon_generation_sources_YEAR.csv",
    ]) + "\n", encoding="utf-8")
    return report


def main():
    year = int(os.getenv("YEAR") or (sys.argv[1] if len(sys.argv) > 1 else dt.datetime.now(dt.timezone.utc).year))
    include_solar = os.getenv("INCLUDE_SOLAR", "true").lower() not in ("0", "false", "no")
    current_year = dt.datetime.now(dt.timezone.utc).year
    current_date = dt.datetime.now(dt.timezone.utc).date()
    start_day = dt.date(year, 1, 1)
    end_day = dt.date(year, 12, 31)
    if year == current_year:
        end_day = min(end_day, current_date - dt.timedelta(days=1))
    if end_day < start_day:
        print(f"No complete days available for {year}")
        return
    rows_by_key = load_existing_year(year)
    elexon_count = 0
    solar_count = 0
    solar_status = "not requested"
    solar_url = ""
    day = start_day
    while day <= end_day:
        try:
            rows = fetch_elexon_day(day)
            elexon_count += len(rows)
            for row in rows:
                rows_by_key[(row["periodStartUTC"], row["fuelType"])] = row
            print(f"{year} {day}: Elexon {len(rows)} rows")
        except Exception as exc:
            print(f"Warning {year} {day}: Elexon failed: {exc}")
        if include_solar:
            rows, status, url = fetch_pvlive_day(day)
            if url and not solar_url:
                solar_url = url
            if rows:
                solar_status = "ok"
            elif solar_status != "ok":
                solar_status = status
            solar_count += len(rows)
            for row in rows:
                rows_by_key[(row["periodStartUTC"], row["fuelType"])] = row
            print(f"{year} {day}: PVLive solar {len(rows)} rows")
        day += dt.timedelta(days=1)
        time.sleep(0.05)
    path, total = write_year(year, rows_by_key)
    report = write_report(year, start_day, end_day, elexon_count, solar_count, total, solar_status, solar_url)
    print(f"Wrote {total} rows to {path}")
    print(f"Wrote report {report}")


if __name__ == "__main__":
    main()
