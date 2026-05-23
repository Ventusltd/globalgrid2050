import requests
import os
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

# Runs every 30 minutes. Fetches GB market price from Elexon MID and carbon
# intensity from the Carbon Intensity API. Writes ONLY the price slice;
# independent of the 5-minute energy slice.

FOLDER = Path(__file__).parent.parent / "uk_energy_tracking"
JSON_FILE = FOLDER / "live_grid_price.json"

ELEXON = "https://data.elexon.co.uk/bmrs/api/v1"
CARBON = "https://api.carbonintensity.org.uk"
TIMEOUT = 12


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


def _try_mid_url(url):
    data = _get_json(url)
    rows = _rows(data)
    priced = []
    for row in rows:
        price = _pick(row, ["price", "MarketIndexPrice", "marketIndexPrice", "value", "Price"])
        if price is None:
            continue
        ts = _pick(row, ["startTime", "settlementDate", "publishTime", "publishDateTime", "time", "datetime"])
        try:
            priced.append({"price": float(price), "time": ts or ""})
        except (TypeError, ValueError):
            continue
    if not priced:
        return None, None
    priced.sort(key=lambda item: str(item.get("time", "")), reverse=True)
    return priced[0]["price"], priced[0].get("time")


def fetch_market_price():
    start = _iso_minutes_ago(180)
    end = _iso_minutes_ago(0)
    attempts = []

    # Elexon dataset endpoints do not require an API key. The MID endpoint has
    # changed shape before, so try the canonical dataset URL first and retain
    # older variants as fallbacks.
    query_a = urlencode({"publishDateTimeFrom": start, "publishDateTimeTo": end, "format": "json"})
    query_b = urlencode({"from": start, "to": end, "format": "json"})
    query_c = urlencode({"settlementDateFrom": start[:10], "settlementDateTo": end[:10], "format": "json"})
    urls = [
        f"{ELEXON}/datasets/MID?{query_a}",
        f"{ELEXON}/datasets/MID?{query_b}",
        f"{ELEXON}/datasets/MID?{query_c}",
    ]

    for url in urls:
        try:
            price, price_time = _try_mid_url(url)
            if price is not None:
                return price, price_time
            attempts.append(f"no priced rows: {url}")
        except Exception as e:  # noqa: BLE001
            attempts.append(f"{type(e).__name__}: {e} | {url}")

    raise RuntimeError("; ".join(attempts[-3:]))


def fetch_carbon():
    d = _get_json(f"{CARBON}/intensity").get("data", [])
    if not d:
        return None, None, None
    i = d[0]["intensity"]
    return i.get("actual"), i.get("forecast"), i.get("index")


def main():
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

    out = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "priceGBPperMWh": round(price, 2) if price is not None else None,
        "priceTime": price_time,
        "carbonGperKWh": c_act,
        "carbonForecast": c_fc,
        "carbonIndex": c_idx,
        "health": health,
    }
    FOLDER.mkdir(parents=True, exist_ok=True)
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    if any(v != "ok" for v in health.values()):
        print(f"::warning::Price source issue: {health}")
    print(f"Price slice | price {out['priceGBPperMWh']} GBP/MWh | carbon {out['carbonGperKWh']} g/kWh | {health}")


if __name__ == "__main__":
    main()
