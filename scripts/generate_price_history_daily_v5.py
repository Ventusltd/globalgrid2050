import csv
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "uk_energy_tracking_v5"
OUT_FILE = OUT_DIR / "electricity_price_history_daily_decade.json"
DATA_DIR = ROOT / "data" / "electricity"
CAPTURED_CSV = OUT_DIR / "electricity_price_history.csv"
RETENTION_DAYS = 3653
MIN_OBSERVATIONS_PER_DAY = 24


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


def read_csv(path):
    if not path.exists():
        return []
    rows = []
    with path.open("r", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            t = r.get("periodStartUTC") or r.get("priceTimeUTC") or r.get("startTime") or ""
            p = r.get("systemBuyPriceGBPperMWh") or r.get("systemSellPriceGBPperMWh") or r.get("priceGBPperMWh") or r.get("price") or ""
            dt = parse_dt(t)
            if not dt or p == "":
                continue
            try:
                price = float(p)
            except ValueError:
                continue
            rows.append((dt, price))
    return rows


def source_rows():
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    current_year = datetime.now(timezone.utc).year
    rows = []
    for year in range(cutoff.year, current_year + 1):
        rows.extend(read_csv(DATA_DIR / f"elexon_system_prices_{year}.csv"))
    rows.extend(read_csv(CAPTURED_CSV))
    deduped = {}
    for dt, price in rows:
        if dt >= cutoff:
            deduped[dt.isoformat()] = (dt, price)
    return [deduped[k] for k in sorted(deduped)]


def mean(values):
    return round(sum(values) / len(values), 2) if values else None


def main():
    started = datetime.now(timezone.utc)
    rows = source_rows()
    by_day = {}
    for dt, price in rows:
        by_day.setdefault(dt.date().isoformat(), []).append((dt, price))

    out_rows = []
    skipped = []
    for date in sorted(by_day):
        points = sorted(by_day[date], key=lambda x: x[0])
        if len(points) < MIN_OBSERVATIONS_PER_DAY:
            skipped.append({"date": date, "observations": len(points)})
            continue
        low_dt, low_price = min(points, key=lambda x: x[1])
        high_dt, high_price = max(points, key=lambda x: x[1])
        vals = [p for _, p in points]
        out_rows.append({
            "date": date,
            "average": mean(vals),
            "high": round(high_price, 2),
            "highAt": high_dt.strftime("%H:%M"),
            "low": round(low_price, 2),
            "lowAt": low_dt.strftime("%H:%M"),
            "observations": len(points),
        })

    payload = {
        "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "Derived from Elexon System Price half hourly history and V5 captured price history",
        "schema": "date|average|high|highAt|low|lowAt|observations",
        "retention_days": RETENTION_DAYS,
        "minimum_observations_per_day": MIN_OBSERVATIONS_PER_DAY,
        "skipped_incomplete_days": skipped[-50:],
        "rows": out_rows,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = OUT_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp.replace(OUT_FILE)
    print(json.dumps({
        "source_rows": len(rows),
        "output_days": len(out_rows),
        "skipped_days": len(skipped),
        "file": str(OUT_FILE),
        "size_bytes": OUT_FILE.stat().st_size,
        "elapsed_seconds": round((datetime.now(timezone.utc) - started).total_seconds(), 2),
        "first_date": out_rows[0]["date"] if out_rows else None,
        "last_date": out_rows[-1]["date"] if out_rows else None,
    }, indent=2))


if __name__ == "__main__":
    main()
