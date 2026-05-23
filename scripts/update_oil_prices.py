import csv
import json
import re
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

OUT_DIR = Path(__file__).parent.parent / "uk_energy_tracking"
LIVE_FILE = OUT_DIR / "live_oil_prices.json"
HISTORY_FILE = OUT_DIR / "oil_price_history.geojson"
HEADERS = {"User-Agent": "Mozilla/5.0"}


def build_session():
    retry_strategy = Retry(
        total=4,
        connect=4,
        read=4,
        status=4,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    session = requests.Session()
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(HEADERS)
    return session


SESSION = build_session()


def now_utc():
    return datetime.now(timezone.utc).isoformat()


def yahoo_price(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    r = SESSION.get(url, timeout=60)
    r.raise_for_status()
    return float(r.json()["chart"]["result"][0]["meta"]["regularMarketPrice"])


def fred_csv(series):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
    r = SESSION.get(url, timeout=60)
    r.raise_for_status()
    rows = []
    for row in csv.DictReader(StringIO(r.text)):
        date = row.get("observation_date")
        value = row.get(series)
        if not date or not value or value == ".":
            continue
        try:
            rows.append((date, float(value)))
        except ValueError:
            continue
    if not rows:
        raise RuntimeError(f"FRED returned no usable rows for {series}")
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
        r = SESSION.get(url, timeout=60)
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


def load_existing_history():
    if not HISTORY_FILE.exists():
        return None
    try:
        existing = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        if isinstance(existing.get("features"), list) and len(existing["features"]) > 0:
            return existing
    except Exception:
        return None
    return None


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
            msg = f"Failed to fetch {label} after retries: {exc}"
            print(f"::warning::{msg}")
            health.append({"ok": False, "source": label, "error": msg})

    features = []
    for date in sorted(merged):
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "properties": {"date": date, **merged[date]}
        })

    if not features:
        existing = load_existing_history()
        if existing:
            existing.setdefault("metadata", {})["lastAttemptedUpdate"] = now_utc()
            existing["metadata"]["latestAttemptHealth"] = health
            existing["metadata"]["note"] = existing["metadata"].get("note", "") + " Existing non empty history preserved after latest failed fetch attempt."
            return existing, False
        raise RuntimeError(f"Oil history fetch produced zero features and no existing history file is available. Health: {health}")

    return {
        "type": "FeatureCollection",
        "metadata": {
            "updated": now_utc(),
            "unit": "USD per barrel",
            "note": "Placeholder Point geometry. This is a portable time series for charting, not a spatial dataset.",
            "sources": health
        },
        "features": features
    }, True


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    health = {}
    live = {"updated": now_utc(), "brentUSDperBarrel": None, "wtiUSDperBarrel": None}

    for ticker, key in [("BZ=F", "brentUSDperBarrel"), ("CL=F", "wtiUSDperBarrel")]:
        try:
            live[key] = yahoo_price(ticker)
            health[ticker] = {"ok": True}
        except Exception as exc:
            msg = f"Failed to fetch Yahoo price {ticker} after retries: {exc}"
            print(f"::warning::{msg}")
            health[ticker] = {"ok": False, "error": msg}

    pump = uk_pump_prices_best_effort()
    live["ukPumpPrices"] = {
        "petrolPencePerLitre": pump["petrolPencePerLitre"],
        "dieselPencePerLitre": pump["dieselPencePerLitre"],
        "source": pump["source"]
    }
    health["ukPumpPrices"] = pump["health"]
    live["health"] = health

    LIVE_FILE.write_text(json.dumps(live, indent=2), encoding="utf-8")

    try:
        history, fetched_fresh_history = oil_history_geojson()
        HISTORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")
        history_features = len(history.get("features", []))
        history_metadata = history.get("metadata", {})
    except Exception as exc:
        print(f"::error::Oil history update failed: {exc}")
        history_features = 0
        history_metadata = {"error": str(exc)}
        fetched_fresh_history = False

    print(json.dumps({
        "live": live,
        "history_features": history_features,
        "fresh_history_written": fetched_fresh_history,
        "history": history_metadata
    }, indent=2))


if __name__ == "__main__":
    main()
