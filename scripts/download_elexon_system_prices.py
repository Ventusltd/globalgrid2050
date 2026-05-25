import csv
import datetime as dt
import json
import os
import sys
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


def fetch_date(day):
    date_text = day.isoformat()
    url = f"{BASE_URL}/{date_text}?format=json"
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


def main():
    days = int(os.getenv("BACKFILL_DAYS", "30"))
    yesterday = dt.date.today() - dt.timedelta(days=1)
    start = yesterday - dt.timedelta(days=max(days - 1, 0))
    existing = load_existing()
    day = start
    while day <= yesterday:
        try:
            rows = fetch_date(day)
            print(f"Fetched {len(rows)} rows for {day}")
            for row in rows:
                key = (row["settlementDate"], row["settlementPeriod"])
                existing[key] = row
        except Exception as exc:
            print(f"Warning: failed {day}: {exc}")
        day += dt.timedelta(days=1)
    if not existing:
        sys.exit("No rows fetched")
    write_csv(existing)


if __name__ == "__main__":
    main()
