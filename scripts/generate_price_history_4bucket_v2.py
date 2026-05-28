import csv
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "uk_energy_tracking_v5"
OUT_FILE = OUT_DIR / "electricity_price_history_4bucket_decade.json"
DATA_DIR = ROOT / "data" / "electricity"
CAPTURED_CSV = OUT_DIR / "electricity_price_history.csv"

MIN_OBSERVATIONS_PER_DAY = 24
RETENTION_DAYS = 3653


def parse_dt(value):
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def read_csv_rows(path):
    if not path.exists():
        return []
    rows = []
    with path.open("r", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            price_time = r.get("periodStartUTC") or r.get("priceTimeUTC") or r.get("startTime") or ""
            price_text = r.get("systemBuyPriceGBPperMWh") or r.get("systemSellPriceGBPperMWh") or r.get("priceGBPperMWh") or r.get("price") or ""
            dt = parse_dt(price_time)
            if not dt or price_text == "":
                continue
            try:
                price = float(price_text)
            except ValueError:
                continue
            rows.append((dt, price))
    return rows


def source_rows():
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    all_rows = []
    current_year = datetime.now(timezone.utc).year
    for year in range(cutoff.year, current_year + 1):
        all_rows.extend(read_csv_rows(DATA_DIR / f"elexon_system_prices_{year}.csv"))
    all_rows.extend(read_csv_rows(CAPTURED_CSV))
    deduped = {}
    for dt, price in all_rows:
        if dt >= cutoff:
            deduped[dt.isoformat()] = (dt, price)
    return [deduped[k] for k in sorted(deduped)]


def bucket_name(hour):
    if hour < 6:
        return "night"
    if hour < 12:
        return "morning"
    if hour < 18:
        return "midday"
    return "evening"


def mean(values):
    return round(sum(values) / len(values), 2) if values else None


def main():
    started = datetime.now(timezone.utc)
    rows = source_rows()
    by_day = {}
    for dt, price in rows:
        by_day.setdefault(dt.date().isoformat(), []).append((dt, price))

    output_rows = []
    skipped = []
    for date in sorted(by_day):
        points = sorted(by_day[date], key=lambda x: x[0])
        if len(points) < MIN_OBSERVATIONS_PER_DAY:
            skipped.append({"date": date, "observations": len(points)})
            continue
        buckets = {"night": [], "morning": [], "midday": [], "evening": []}
        peak_dt, peak_price = max(points, key=lambda x: x[1])
        for dt, price in points:
            buckets[bucket_name(dt.hour)].append(price)
        output_rows.append({
            "date": date,
            "night": mean(buckets["night"]),
            "morning": mean(buckets["morning"]),
            "midday": mean(buckets["midday"]),
            "evening": mean(buckets["evening"]),
            "peakAt": peak_dt.strftime("%H:%M"),
            "peakPrice": round(peak_price, 2),
            "observations": len(points),
        })

    payload = {
        "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "Derived from Elexon System Price half hourly history and V5 captured price history",
        "schema": "date|night|morning|midday|evening|peakAt|peakPrice|observations",
        "bucket_definitions_utc": {
            "night": "00:00 to 06:00 mean",
            "morning": "06:00 to 12:00 mean",
            "midday": "12:00 to 18:00 mean",
            "evening": "18:00 to 00:00 mean",
        },
        "retention_days": RETENTION_DAYS,
        "minimum_observations_per_day": MIN_OBSERVATIONS_PER_DAY,
        "skipped_incomplete_days": skipped[-50:],
        "rows": output_rows,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = OUT_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp.replace(OUT_FILE)
    size = OUT_FILE.stat().st_size
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    print(json.dumps({
        "source_rows": len(rows),
        "output_days": len(output_rows),
        "skipped_days": len(skipped),
        "file": str(OUT_FILE),
        "size_bytes": size,
        "elapsed_seconds": round(elapsed, 2),
        "first_date": output_rows[0]["date"] if output_rows else None,
        "last_date": output_rows[-1]["date"] if output_rows else None,
    }, indent=2))


if __name__ == "__main__":
    main()
