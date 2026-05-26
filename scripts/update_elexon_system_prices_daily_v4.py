import csv
import datetime as dt
import json
import os
import sys
import urllib.request
from pathlib import Path

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices"
OUT_DIR = Path("data/electricity")
MASTER_FILE = OUT_DIR / "elexon_system_prices_half_hourly.csv"
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
    with urllib.request.urlopen(req, timeout=45) as response:
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


def load_csv(path):
    if not path.exists():
        return {}
    rows = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (row.get("settlementDate", ""), row.get("settlementPeriod", ""))
            if key[0] and key[1]:
                rows[key] = {field: row.get(field, "") for field in FIELDS}
    return rows


def sort_key(key):
    try:
        period = int(key[1])
    except Exception:
        period = 999
    return key[0], period


def write_csv(path, rows_by_key):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for key in sorted(rows_by_key, key=sort_key):
            writer.writerow(rows_by_key[key])
    print(f"Wrote {len(rows_by_key)} rows to {path}")


def year_file(year):
    return OUT_DIR / f"elexon_system_prices_{year}.csv"


def main():
    today = dt.date.today()
    lookback_days = int(os.getenv("ELEXON_DAILY_LOOKBACK_DAYS", "3"))
    end_day = today - dt.timedelta(days=1)
    start_day = end_day - dt.timedelta(days=max(lookback_days - 1, 0))

    master = load_csv(MASTER_FILE)
    annual_cache = {}
    total_fetched = 0
    day = start_day
    while day <= end_day:
        try:
            rows = fetch_date(day)
            print(f"Fetched {len(rows)} Elexon System Price rows for {day}")
            if len(rows) not in (46, 48, 50):
                print(f"Warning: expected around 48 rows for {day}, received {len(rows)}")
            year = str(day.year)
            annual_path = year_file(year)
            if year not in annual_cache:
                annual_cache[year] = load_csv(annual_path)
            for row in rows:
                key = (row["settlementDate"], row["settlementPeriod"])
                master[key] = row
                annual_cache[year][key] = row
            total_fetched += len(rows)
        except Exception as exc:
            print(f"Warning: failed to fetch {day}: {exc}")
        day += dt.timedelta(days=1)

    if total_fetched == 0:
        sys.exit("No Elexon rows fetched")

    write_csv(MASTER_FILE, master)
    for year, rows in sorted(annual_cache.items()):
        write_csv(year_file(year), rows)


if __name__ == "__main__":
    main()
