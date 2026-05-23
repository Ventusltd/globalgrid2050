import requests
import os
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Runs every 30 minutes. Fetches GB market price (Elexon MID) and carbon
# intensity (National Grid). These sources only update half-hourly, so a
# 5-minute cadence would just re-fetch identical data. Writes ONLY the
# price slice; independent of the 5-minute energy slice.

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
            r = requests.get(url, timeout=TIMEOUT,
                             headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def fetch_market_price():
    url = (f"{ELEXON}/datasets/MID/stream?publishDateTimeFrom={_iso_minutes_ago(120)}"
           f"&publishDateTimeTo={_iso_minutes_ago(0)}")
    data = _get_json(url)
    rows = data if isinstance(data, list) else data.get("data", [])
    priced = [r for r in rows if r.get("price") is not None]
    if not priced:
        return None, None
    priced.sort(key=lambda r: str(r.get("startTime", "")), reverse=True)
    return float(priced[0]["price"]), priced[0].get("startTime")


def fetch_carbon():
    d = _get_json(f"{CARBON}/intensity").get("data", [])
    if not d:
        return None, None, None
    i = d[0]["intensity"]
    return i.get("actual"), i.get("forecast"), i.get("index")


def main():
    health = {}
    try:
        price, price_time = fetch_market_price(); health["price"] = "ok"
    except Exception as e:  # noqa: BLE001
        price, price_time = None, None; health["price"] = f"error: {e}"
    try:
        c_act, c_fc, c_idx = fetch_carbon(); health["carbon"] = "ok"
    except Exception as e:  # noqa: BLE001
        c_act = c_fc = c_idx = None; health["carbon"] = f"error: {e}"

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
    print(f"✅ Price slice | price {out['priceGBPperMWh']} GBP/MWh | carbon {out['carbonGperKWh']} g/kWh | {health}")


if __name__ == "__main__":
    main()
