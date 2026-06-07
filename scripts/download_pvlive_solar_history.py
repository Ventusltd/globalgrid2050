import csv
import datetime as dt
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

PVLIVE_URL = "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0"
OUT_DIR = Path("data/generation")
OUT_FILE = OUT_DIR / "elexon_generation_sources_half_hourly.csv"
REPORT_DIR = Path("uk_energy_tracking_v6/generation_history")
REPORT = REPORT_DIR / "PVLIVE_SOLAR_HISTORY_REPORT.md"
FIELDS = [
    "source",
    "periodStartUTC",
    "fuelType",
    "generationMW",
    "publishTimeUTC",
    "fetchedAtUTC",
]


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


def normalise_mw(value):
    if value in (None, ""):
        return None
    try:
        return f"{float(value):.3f}"
    except Exception:
        return None


def load_existing():
    if not OUT_FILE.exists():
        return {}
    rows = {}
    with OUT_FILE.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row.get("periodStartUTC", ""), row.get("fuelType", ""))
            if key[0] and key[1]:
                rows[key] = {field: row.get(field, "") for field in FIELDS}
    return rows


def write_csv(rows_by_key):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = [rows_by_key[key] for key in sorted(rows_by_key, key=lambda x: (x[0], x[1]))]
    with OUT_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def http_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def parse_row(row, fetched_at):
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
    period_start = iso_z(timestamp)
    generation_mw = normalise_mw(generation)
    if not period_start or generation_mw is None:
        return None
    return {
        "source": "Sheffield Solar PVLive",
        "periodStartUTC": period_start,
        "fuelType": "SOLAR",
        "generationMW": generation_mw,
        "publishTimeUTC": "",
        "fetchedAtUTC": fetched_at,
    }


def candidate_urls(start_dt, end_dt):
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
    return [PVLIVE_URL + "?" + urllib.parse.urlencode(params) for params in candidates]


def fetch_window(start_dt, end_dt):
    errors = []
    for url in candidate_urls(start_dt, end_dt):
        try:
            payload = http_json(url)
            parsed = []
            fetched_at = utc_now()
            for row in extract_rows(payload):
                item = parse_row(row, fetched_at)
                if item:
                    parsed.append(item)
            if parsed:
                return parsed, url, None
        except Exception as exc:
            errors.append(f"{url} :: {exc}")
    return [], "", "; ".join(errors[-3:])


def write_report(status, days, fetched_rows, total_rows, working_url, detail):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# PVLive Solar History Report",
        "",
        f"Updated UTC: {utc_now()}",
        f"Status: {status}",
        f"Backfill days requested: {days}",
        f"Fetched solar rows this run: {fetched_rows}",
        f"Total master rows after solar merge: {total_rows}",
        f"Working URL pattern: {working_url or 'not confirmed'}",
        f"Detail: {detail}",
        "Source: Sheffield Solar PVLive",
        "Output fuelType: SOLAR",
        "Module: uk_energy_tracking_v6/generation_history",
    ]) + "\n", encoding="utf-8")


def main():
    days = int(os.getenv("BACKFILL_DAYS", "14"))
    today = dt.datetime.now(dt.timezone.utc).date()
    start_day = today - dt.timedelta(days=max(days, 1))
    end_day = today - dt.timedelta(days=1)
    existing = load_existing()
    fetched_count = 0
    working_url = ""
    last_error = ""
    day = start_day
    while day <= end_day:
        start_dt = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
        end_dt = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
        rows, url, err = fetch_window(start_dt, end_dt)
        if url and not working_url:
            working_url = url.split("?")[0] + "?" + urllib.parse.urlencode({k: v for k, v in urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query)})
        if err:
            last_error = err
            print(f"Warning: PVLive failed {day}: {err}")
        print(f"Fetched {len(rows)} PVLive solar rows for {day}")
        fetched_count += len(rows)
        for row in rows:
            key = (row["periodStartUTC"], row["fuelType"])
            existing[key] = row
        day += dt.timedelta(days=1)
    total = write_csv(existing) if existing else 0
    status = "ok" if fetched_count > 0 else "no solar rows fetched"
    detail = "PVLive solar rows merged into generation master CSV" if fetched_count > 0 else last_error or "PVLive returned no parseable solar rows"
    write_report(status, days, fetched_count, total, working_url, detail)
    if fetched_count == 0:
        print("::warning::No PVLive solar rows fetched; report written and workflow continues")


if __name__ == "__main__":
    main()
