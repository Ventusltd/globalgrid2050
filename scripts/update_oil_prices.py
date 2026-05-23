import csv
import json
import re
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

import requests

OUT_DIR = Path(__file__).parent.parent / "uk_energy_tracking"
LIVE_FILE = OUT_DIR / "live_oil_prices.json"
HISTORY_FILE = OUT_DIR / "oil_price_history.geojson"
HEADERS = {"User-Agent": "Mozilla/5.0"}


def now_utc():
    return datetime.now(timezone.utc).isoformat()


def yahoo_price(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return float(r.json()["chart"]["result"][0]["meta"]["regularMarketPrice"])


def fred_csv(series):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    rows = []
    for row in csv.DictReader(StringIO(r.text)):
        date = row.get("observation_date")
        value = row.get(series)
        if not date or not value or value == ".":
            continue
        rows.append((date, float(value)))
    return rows


def uk_pump_prices_best_effort():
    url = "https://www.rac.co.uk/drive/advice/fuel-watch/"
    result = {
        "petrolPencePerLitre": None,
        "dieselPencePerLitre": None,
        "source": "RAC Fuel Watch public page",
        "health": {"ok": False, "url": url, "note": "Best effort public page read. Non critical."}
    }
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        text = " ".join(r.text.replace("\n", " ").split())
        lower = text.lower()

        def near(label):
            i = lower.find(label)
            if i < 0:
                return None
            chunk = text[max(0, i - 450): i + 800]
            for raw in re.findall(r"(\d{2,3}\.\d{1,2})\s*p?", chunk):
                value = float(raw)
                if 80 <= value <= 250:
                    return value
            return None

        result["petrolPencePerLitre"] = near("unleaded") or near("petrol")
        result["dieselPencePerLitre"] = near("diesel")
        result["health"]["ok"] = result["petrolPencePerLitre"] is not None or result["dieselPencePerLitre"] is not None
    except Exception as exc:
        result["health"]["error"] = str(exc)
    return result


def oil_history_geojson():
    health = []
    merged = {}
    for series, field, label in [
        ("DCOILBRENTEU", "brentUSDperBarrel", "FRED Brent Europe daily spot price"),
        ("DCOILWTICO", "wtiUSDperBarrel", "FRED WTI Cushing daily spot price"),
    ]:
        try:
            rows = fred_csv(series)
            for date, value in rows:
                merged.setdefault(date, {})[field] = value
            health.append({"ok": True, "source": label, "rows": len(rows)})
        except Exception as exc:
            health.append({"ok": False, "source": label, "error": str(exc)})

    features = []
    for date in sorted(merged):
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "properties": {"date": date, **merged[date]}
        })
    return {
        "type": "FeatureCollection",
        "metadata": {
            "updated": now_utc(),
            "unit": "USD per barrel",
            "note": "Placeholder Point geometry. This is a portable time series for charting, not a spatial dataset.",
            "sources": health
        },
        "features": features
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    health = {}
    live = {"updated": now_utc(), "brentUSDperBarrel": None, "wtiUSDperBarrel": None}

    for ticker, key in [("BZ=F", "brentUSDperBarrel"), ("CL=F", "wtiUSDperBarrel")]:
        try:
            live[key] = yahoo_price(ticker)
            health[ticker] = {"ok": True}
        except Exception as exc:
            health[ticker] = {"ok": False, "error": str(exc)}

    pump = uk_pump_prices_best_effort()
    live["ukPumpPrices"] = {
        "petrolPencePerLitre": pump["petrolPencePerLitre"],
        "dieselPencePerLitre": pump["dieselPencePerLitre"],
        "source": pump["source"]
    }
    health["ukPumpPrices"] = pump["health"]
    live["health"] = health

    LIVE_FILE.write_text(json.dumps(live, indent=2), encoding="utf-8")
    history = oil_history_geojson()
    HISTORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")
    print(json.dumps({"live": live, "history_features": len(history["features"]), "history": history["metadata"]}, indent=2))


if __name__ == "__main__":
    main()
