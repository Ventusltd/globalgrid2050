import csv
import json
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import requests

# Fetches GB market price from Elexon Market Index and carbon intensity.
# The workflow calls this every 5 minutes, but this script self regulates
# by checking the timestamp in live_grid_price.json and only refreshing when
# the existing price slice is at least 30 minutes old. Manual workflow runs
# can force execution with FORCE_UK_PRICE=1.
#
# V5 records each accepted half hourly electricity price into a CSV and
# JSON history file. The history files are rewritten on each successful update,
# deduplicated by settlement timestamp and pruned to a rolling 10 year window.

FOLDER = Path(__file__).parent.parent / "uk_energy_tracking_v5"
JSON_FILE = FOLDER / "live_grid_price.json"
PRICE_HISTORY_CSV = FOLDER / "electricity_price_history.csv"
PRICE_HISTORY_JSON = FOLDER / "electricity_price_history.json"

ELEXON = "https://data.elexon.co.uk/bmrs/api/v1"
CARBON = "https://api.carbonintensity.org.uk"
TIMEOUT = 12
MIN_UPDATE_MINUTES = 30
HISTORY_RETENTION_DAYS = 3653
HISTORY_FIELDS = [
    "capturedAtUTC",
    "priceTimeUTC",
    "settlementDate",
    "settlementPeriod",
    "priceGBPperMWh",
    "carbonGperKWh",
    "carbonForecast",
    "carbonIndex",
    "source",
    "priceHealth",
    "carbonHealth",
]


def _parse_dt(value):
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _to_z(dt):
    if not dt:
        return None
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def load_existing():
    if not JSON_FILE.exists():
        return {}
    try:
        return json.loads(JSON_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def should_skip_price_update():
    if os.getenv("FORCE_UK_PRICE") == "1":
        return False
    existing = load_existing()
    updated = _parse_dt(existing.get("updated"))
    if not updated:
        return False
    age = datetime.now(timezone.utc) - updated
    return age < timedelta(minutes=MIN_UPDATE_MINUTES)


def _iso_minutes_ago(mins):
    return (datetime.now(timezone.utc) - timedelta(minutes=mins)).strftime("%Y-%m-%dT%H:%MZ")


def _get_json(url):
    last = None
    for _ in range(2):
        try:
            r = requests.get(
                url,
                timeout=TIMEOUT,
                headers={"Accept": "application/json", "User-Agent": "GlobalGrid2050/1.0"},
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def _rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "items", "results"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def _pick(row, names):
    for name in names:
        if isinstance(row, dict) and row.get(name) not in (None, ""):
            return row.get(name)
    return None


def _settlement_datetime(row):
    for key in ("startTime", "publishDateTime", "publishTime", "time", "datetime"):
        dt = _parse_dt(row.get(key)) if isinstance(row, dict) else None
        if dt:
            return dt

    settlement_date = _pick(row, ["settlementDate", "SettlementDate", "deliveryDate"])
    settlement_period = _pick(row, ["settlementPeriod", "SettlementPeriod", "period"])
    if settlement_date and settlement_period:
        date_text = str(settlement_date)[:10]
        base = _parse_dt(date_text + "T00:00:00Z")
        try:
            period = int(settlement_period)
        except (TypeError, ValueError):
            period = None
        if base and period and 1 <= period <= 50:
            return base + timedelta(minutes=(period - 1) * 30)

    return None


def _try_price_url(url):
    data = _get_json(url)
    rows = _rows(data)
    priced = []
    now = datetime.now(timezone.utc)

    for row in rows:
        price = _pick(row, [
            "price",
            "marketIndexPrice",
            "MarketIndexPrice",
            "market_price",
            "value",
            "Price",
        ])
        if price is None:
            continue

        dt = _settlement_datetime(row)
        if not dt:
            continue

        if dt > now + timedelta(minutes=35):
            continue

        try:
            priced.append({
                "price": float(price),
                "time": _to_z(dt),
                "dt": dt,
            })
        except (TypeError, ValueError):
            continue

    if not priced:
        return None, None

    priced.sort(key=lambda item: item["dt"], reverse=True)
    return priced[0]["price"], priced[0]["time"]


def fetch_market_price():
    start = _iso_minutes_ago(240)
    end = _iso_minutes_ago(0)
    attempts = []

    range_query = urlencode({"from": start, "to": end, "format": "json"})
    dataset_publish_query = urlencode({"publishDateTimeFrom": start, "publishDateTimeTo": end, "format": "json"})
    dataset_settlement_query = urlencode({"settlementDateFrom": start[:10], "settlementDateTo": end[:10], "format": "json"})
    urls = [
        f"{ELEXON}/balancing/pricing/market-index?{range_query}",
        f"{ELEXON}/balancing/pricing/market-index?{dataset_publish_query}",
        f"{ELEXON}/datasets/MID?{dataset_publish_query}",
        f"{ELEXON}/datasets/MID?{dataset_settlement_query}",
    ]

    for url in urls:
        try:
            price, price_time = _try_price_url(url)
            if price is not None:
                return price, price_time
            attempts.append(f"no valid priced timestamp rows: {url}")
        except Exception as e:  # noqa: BLE001
            attempts.append(f"{type(e).__name__}: {e} | {url}")

    raise RuntimeError("; ".join(attempts[-4:]))


def fetch_carbon():
    d = _get_json(f"{CARBON}/intensity").get("data", [])
    if not d:
        return None, None, None
    i = d[0]["intensity"]
    return i.get("actual"), i.get("forecast"), i.get("index")


def preserve_previous_price_if_bad(price, price_time, health, existing):
    previous_price = existing.get("priceGBPperMWh")
    previous_time = existing.get("priceTime")
    previous_updated = existing.get("updated")

    if price == 0 and previous_price not in (None, 0):
        health["price"] = "warning: zero market price rejected; previous valid value preserved"
        return previous_price, previous_time, previous_updated

    return price, price_time, None


def _settlement_period(price_time):
    dt = _parse_dt(price_time)
    if not dt:
        return "", ""
    settlement_date = dt.date().isoformat()
    period = (dt.hour * 60 + dt.minute) // 30 + 1
    return settlement_date, str(period)


def _load_history_rows():
    if not PRICE_HISTORY_CSV.exists():
        return []
    try:
        with PRICE_HISTORY_CSV.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            return [{field: (row.get(field) or "") for field in HISTORY_FIELDS} for row in reader]
    except Exception:
        return []


def _write_history_rows(rows):
    PRICE_HISTORY_CSV.parent.mkdir(parents=True, exist_ok=True)
    with PRICE_HISTORY_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=HISTORY_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    PRICE_HISTORY_JSON.write_text(json.dumps({"rows": rows}, indent=2), encoding="utf-8")


def append_price_history(out):
    price = out.get("priceGBPperMWh")
    price_time = out.get("priceTime")
    if price is None or not price_time:
        print("Price history not updated because no valid price timestamp was available.")
        return

    price_dt = _parse_dt(price_time)
    if not price_dt:
        print("Price history not updated because priceTime could not be parsed.")
        return

    captured_at = _to_z(datetime.now(timezone.utc))
    settlement_date, settlement_period = _settlement_period(price_time)
    new_row = {
        "capturedAtUTC": captured_at,
        "priceTimeUTC": _to_z(price_dt),
        "settlementDate": settlement_date,
        "settlementPeriod": settlement_period,
        "priceGBPperMWh": f"{float(price):.2f}",
        "carbonGperKWh": "" if out.get("carbonGperKWh") is None else str(out.get("carbonGperKWh")),
        "carbonForecast": "" if out.get("carbonForecast") is None else str(out.get("carbonForecast")),
        "carbonIndex": "" if out.get("carbonIndex") is None else str(out.get("carbonIndex")),
        "source": "Elexon BMRS Market Index Data",
        "priceHealth": str((out.get("health") or {}).get("price", "")),
        "carbonHealth": str((out.get("health") or {}).get("carbon", "")),
    }

    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_RETENTION_DAYS)
    deduped = {}
    for row in _load_history_rows():
        row_dt = _parse_dt(row.get("priceTimeUTC"))
        if not row_dt or row_dt < cutoff:
            continue
        key = row.get("priceTimeUTC")
        if key:
            deduped[key] = row

    deduped[new_row["priceTimeUTC"]] = new_row
    rows = [deduped[key] for key in sorted(deduped, key=lambda value: _parse_dt(value) or datetime.min.replace(tzinfo=timezone.utc))]
    _write_history_rows(rows)
    print(f"Price history rows retained: {len(rows)} | latest {new_row['priceTimeUTC']} | retention {HISTORY_RETENTION_DAYS} days")


def main():
    if should_skip_price_update():
        print("Price slice skipped: existing live_grid_price.json is less than 30 minutes old.")
        return

    existing = load_existing()
    health = {}
    try:
        price, price_time = fetch_market_price()
        health["price"] = "ok"
    except Exception as e:  # noqa: BLE001
        price, price_time = None, None
        health["price"] = f"error: {e}"
    try:
        c_act, c_fc, c_idx = fetch_carbon()
        health["carbon"] = "ok"
    except Exception as e:  # noqa: BLE001
        c_act = c_fc = c_idx = None
        health["carbon"] = f"error: {e}"

    price, price_time, preserved_updated = preserve_previous_price_if_bad(price, price_time, health, existing)

    out = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "priceGBPperMWh": round(price, 2) if price is not None else None,
        "priceTime": price_time,
        "carbonGperKWh": c_act,
        "carbonForecast": c_fc,
        "carbonIndex": c_idx,
        "health": health,
    }
    if preserved_updated:
        out["previousPriceUpdated"] = preserved_updated

    FOLDER.mkdir(parents=True, exist_ok=True)
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    append_price_history(out)

    if any(v != "ok" for v in health.values()):
        print(f"::warning::Price source issue: {health}")
    print(f"Price slice V5 | price {out['priceGBPperMWh']} GBP/MWh | time {out['priceTime']} | carbon {out['carbonGperKWh']} g/kWh | {health}")


if __name__ == "__main__":
    main()
