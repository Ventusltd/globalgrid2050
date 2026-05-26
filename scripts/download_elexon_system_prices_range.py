import csv
import datetime as dt
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices"
OUT_DIR = Path("data/electricity")
OUT_FILE = OUT_DIR / "elexon_system_prices_half_hourly.csv"
FIELDS = [
    "source",
    "settlementDate",
    "settlementPeriod",
    "periodStartUTC",
    "systemBuyPriceGBPperMWh",
    "systemSellPriceGBPperMWh",
    "netImbalanceVolumeMWh",
    "fetchedAtUTC",
]


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
        return f"{float(value):.2f}"
    except Exception:
        return str(value)


def period_start(date_text, period):
    try:
        p = int(period)
        start = dt.datetime.fromisoformat(date_text).replace(tzinfo=dt.timezone.utc)
        start = start + dt.timedelta(minutes=(p - 1) * 30)
        return start.isoformat().replace("+00:00", "Z")
    except Exception:
        return ""


def fetch_date(day, retries=3):
    date_text = day.isoformat()
    url = f"{BASE_URL}/{date_text}?format=json"
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
            rows = data if isinstance(data, list) else data.get("data", [])
            fetched = dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")
            output = []
            for row in rows:
                if not isinstance(row, dict):
                    continue
                sp = pick(row, ["settlementPeriod", "period"])
                if sp == "":
                    continue
                output.append({
                    "source": "Elexon BMRS System Prices",
                    "settlementDate": date_text,
                    "settlementPeriod": str(sp),
                    "periodStartUTC": period_start(date_text, sp),
                    "systemBuyPriceGBPperMWh": num(pick(row, ["systemBuyPrice", "sbp"])),
                    "systemSellPriceGBPperMWh": num(pick(row, ["systemSellPrice", "ssp"])),
                    "netImbalanceVolumeMWh": num(pick(row, ["netImbalanceVolume", "niv"])),
                    "fetchedAtUTC": fetched,
                })
            return output
        except Exception as exc:
            last_error = exc
            time.sleep(min(10, attempt * 2))
    raise last_error


def load_existing():
    if not OUT_FILE.exists():
        return {}
    existing = {}
    with OUT_FILE.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row.get("settlementDate", ""), row.get("settlementPeriod", ""))
            if key[0] and key[1]:
                existing[key] = {field: row.get(field, "") for field in FIELDS}
    return existing


def write_csv(rows_by_key):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    def sort_key(key):
        return (key[0], int(key[1]) if str(key[1]).isdigit() else 999)
    rows = [rows_by_key[key] for key in sorted(rows_by_key, key=sort_key)]
    with OUT_FILE.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} rows to {OUT_FILE}")


def parse_date(name):
    value = os.getenv(name, "").strip()
    if not value:
        return None
    return dt.date.fromisoformat(value)


def main():
    start = parse_date("START_DATE")
    end = parse_date("END_DATE")
    if start is None or end is None:
        sys.exit("START_DATE and END_DATE are required in YYYY-MM-DD format")
    yesterday = dt.date.today() - dt.timedelta(days=1)
    if end > yesterday:
        end = yesterday
    if start > end:
        sys.exit(f"Empty date range after clamping: {start} to {end}")

    existing = load_existing()
    day = start
    fetched_days = 0
    fetched_rows = 0
    failed_days = []
    while day <= end:
        try:
            rows = fetch_date(day)
            print(f"Fetched {len(rows)} rows for {day}")
            fetched_days += 1
            fetched_rows += len(rows)
            for row in rows:
                key = (row["settlementDate"], row["settlementPeriod"])
                existing[key] = row
        except Exception as exc:
            print(f"Warning: failed {day}: {exc}")
            failed_days.append(day.isoformat())
        day += dt.timedelta(days=1)

    if not existing:
        sys.exit("No rows available after range fetch")
    write_csv(existing)
    print(f"Range complete | start={start} | end={end} | fetched_days={fetched_days} | fetched_rows={fetched_rows} | failed_days={len(failed_days)}")
    if failed_days:
        print("Failed day list:")
        for item in failed_days:
            print(item)


if __name__ == "__main__":
    main()
