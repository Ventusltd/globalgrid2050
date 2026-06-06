import csv
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELINST"
OUT_DIR = Path("data/generation")
OUT_FILE = OUT_DIR / "elexon_generation_sources_half_hourly.csv"
REPORT_DIR = Path("uk_energy_tracking_v6/generation_history")
REPORT = REPORT_DIR / "GENERATION_HISTORY_DATA_REPORT.md"
FIELDS = [
    "source",
    "periodStartUTC",
    "fuelType",
    "generationMW",
    "publishTimeUTC",
    "fetchedAtUTC",
]


def iso_z(value):
    if not value:
        return ""
    text = str(value).replace("Z", "+00:00")
    try:
        d = dt.datetime.fromisoformat(text)
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
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
        return ""
    try:
        return f"{float(value):.3f}"
    except Exception:
        return str(value)


def fetch_window(start_dt, end_dt):
    query = urllib.parse.urlencode({
        "publishDateTimeFrom": start_dt.strftime("%Y-%m-%dT%H:%MZ"),
        "publishDateTimeTo": end_dt.strftime("%Y-%m-%dT%H:%MZ"),
        "format": "json",
    })
    url = f"{BASE_URL}?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
    with urllib.request.urlopen(req, timeout=45) as response:
        data = json.loads(response.read().decode("utf-8"))
    rows = data if isinstance(data, list) else data.get("data", [])
    fetched = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    output = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        fuel = pick(row, ["fuelType", "fuelTypeName", "fuel", "psrType"])
        generation = pick(row, ["generation", "generationMW", "currentUsage", "quantity"])
        period_start = pick(row, ["startTime", "publishDateTime", "periodStartUTC", "settlementDate"])
        publish_time = pick(row, ["publishDateTime", "publishTime", "createdTime"])
        if not fuel or generation == "" or not period_start:
            continue
        output.append({
            "source": "Elexon BMRS FUELINST",
            "periodStartUTC": iso_z(period_start),
            "fuelType": str(fuel).strip().upper(),
            "generationMW": num(generation),
            "publishTimeUTC": iso_z(publish_time),
            "fetchedAtUTC": fetched,
        })
    return output


def load_existing():
    if not OUT_FILE.exists():
        return {}
    existing = {}
    with OUT_FILE.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row.get("periodStartUTC", ""), row.get("fuelType", ""))
            if key[0] and key[1]:
                existing[key] = {field: row.get(field, "") for field in FIELDS}
    return existing


def write_csv(rows_by_key):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    def sort_key(key):
        return (key[0], key[1])
    rows = [rows_by_key[key] for key in sorted(rows_by_key, key=sort_key)]
    with OUT_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {OUT_FILE}")
    return len(rows)


def write_report(status, days, fetched_rows, total_rows):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Generation History Data Report",
        "",
        f"Updated UTC: {dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')}",
        f"Status: {status}",
        f"Backfill days requested: {days}",
        f"Fetched rows this run: {fetched_rows}",
        f"Total master rows after merge: {total_rows}",
        "Source: Elexon BMRS FUELINST",
        "Module: uk_energy_tracking_v6/generation_history",
        "Note: This module is not wired into the main V6 page yet.",
    ]) + "\n", encoding="utf-8")


def main():
    days = int(os.getenv("BACKFILL_DAYS", "14"))
    today = dt.datetime.now(dt.timezone.utc).date()
    start_day = today - dt.timedelta(days=max(days, 1))
    end_day = today - dt.timedelta(days=1)
    existing = load_existing()
    fetched_count = 0
    day = start_day
    while day <= end_day:
        start_dt = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
        end_dt = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
        try:
            rows = fetch_window(start_dt, end_dt)
            print(f"Fetched {len(rows)} generation rows for {day}")
            fetched_count += len(rows)
            for row in rows:
                key = (row["periodStartUTC"], row["fuelType"])
                existing[key] = row
        except Exception as exc:
            print(f"Warning: failed {day}: {exc}")
        day += dt.timedelta(days=1)
    if not existing:
        write_report("failed", days, fetched_count, 0)
        sys.exit("No generation rows available")
    total = write_csv(existing)
    write_report("ok", days, fetched_count, total)


if __name__ == "__main__":
    main()
