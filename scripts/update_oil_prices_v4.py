import csv
import json
import os
from datetime import datetime, timezone, timedelta
from io import StringIO
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

OUT_DIR = Path(__file__).parent.parent / "uk_energy_tracking_v4"
LIVE_FILE = OUT_DIR / "live_oil_prices.json"
HISTORY_FILE = OUT_DIR / "oil_price_history.geojson"
HEADERS = {"User-Agent": "Mozilla/5.0"}
LIVE_TIMEOUT = 15
HISTORY_TIMEOUT = 60
HISTORY_MAX_AGE_HOURS = 24
HISTORY_YEARS = 25


def build_session():
    retry_strategy = Retry(
        total=3,
        connect=3,
        read=3,
        status=3,
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
    r = SESSION.get(url, timeout=LIVE_TIMEOUT)
    r.raise_for_status()
    return float(r.json()["chart"]["result"][0]["meta"]["regularMarketPrice"])


def yahoo_history(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={HISTORY_YEARS}y&interval=1d"
    r = SESSION.get(url, timeout=HISTORY_TIMEOUT)
    r.raise_for_status()
    result = r.json()["chart"]["result"][0]
    timestamps = result.get("timestamp") or []
    closes = (((result.get("indicators") or {}).get("quote") or [{}])[0].get("close") or [])
    rows = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_YEARS * 366)
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        dt = datetime.fromtimestamp(ts, timezone.utc)
        if dt < cutoff:
            continue
        rows.append((dt.strftime("%Y-%m-%d"), float(close)))
    if not rows:
        raise RuntimeError(f"Yahoo returned no usable history rows for {ticker}")
    return rows


def fred_csv(series):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
    r = SESSION.get(url, timeout=HISTORY_TIMEOUT)
    r.raise_for_status()
    rows = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_YEARS * 366)
    for row in csv.DictReader(StringIO(r.text)):
        date = row.get("observation_date")
        value = row.get(series)
        if not date or not value or value == ".":
            continue
        try:
            dt = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if dt >= cutoff:
                rows.append((date, float(value)))
        except ValueError:
            continue
    if not rows:
        raise RuntimeError(f"FRED returned no usable rows for {series}")
    return rows


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


def history_is_recent(existing):
    if not existing:
        return False
    updated = existing.get("metadata", {}).get("updated")
    if not updated:
        return False
    try:
        dt = datetime.fromisoformat(str(updated).replace("Z", "+00:00"))
        return datetime.now(timezone.utc) - dt < timedelta(hours=HISTORY_MAX_AGE_HOURS)
    except Exception:
        return False


def add_rows(merged, rows, field):
    for date, value in rows:
        merged.setdefault(date, {})[field] = value


def oil_history_geojson():
    existing = load_existing_history()
    force_history = os.getenv("FORCE_OIL_HISTORY", "0") == "1"
    if existing and history_is_recent(existing) and not force_history:
        existing.setdefault("metadata", {})["lastSkippedHistoryUpdate"] = now_utc()
        existing["metadata"]["skipReason"] = "Existing oil history is less than 24 hours old. Live oil update completed without re-downloading full history."
        return existing, False

    health = []
    merged = {}

    for series, field, label in [
        ("DCOILBRENTEU", "brentUSDperBarrel", "FRED Brent Europe daily spot price"),
        ("DCOILWTICO", "wtiUSDperBarrel", "FRED WTI Cushing daily spot price"),
    ]:
        try:
            rows = fred_csv(series)
            add_rows(merged, rows, field)
            health.append({"ok": True, "source": label, "rows": len(rows)})
        except Exception as exc:
            msg = f"Failed to fetch {label}: {exc}"
            print(f"::warning::{msg}")
            health.append({"ok": False, "source": label, "error": msg})

    if not merged:
        for ticker, field, label in [
            ("BZ=F", "brentUSDperBarrel", "Yahoo Brent futures history"),
            ("CL=F", "wtiUSDperBarrel", "Yahoo WTI futures history"),
        ]:
            try:
                rows = yahoo_history(ticker)
                add_rows(merged, rows, field)
                health.append({"ok": True, "source": label, "rows": len(rows), "fallback": True})
            except Exception as exc:
                msg = f"Failed to fetch {label}: {exc}"
                print(f"::warning::{msg}")
                health.append({"ok": False, "source": label, "error": msg, "fallback": True})

    features = []
    for date in sorted(merged):
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "properties": {"date": date, **merged[date]}
        })

    if not features:
        if existing:
            existing.setdefault("metadata", {})["lastAttemptedUpdate"] = now_utc()
            existing["metadata"]["latestAttemptHealth"] = health
            existing["metadata"]["note"] = existing["metadata"].get("note", "") + " Existing non empty history preserved after latest failed fetch attempt."
            return existing, False
        print("::warning::Oil history unavailable and no existing history file found. Writing live prices only.")
        return {
            "type": "FeatureCollection",
            "metadata": {
                "updated": now_utc(),
                "unit": "USD per barrel",
                "period": f"Last {HISTORY_YEARS} years",
                "note": "Oil history unavailable during this run. Live oil prices were still updated.",
                "sources": health,
            },
            "features": [],
        }, False

    return {
        "type": "FeatureCollection",
        "metadata": {
            "updated": now_utc(),
            "unit": "USD per barrel",
            "period": f"Last {HISTORY_YEARS} years",
            "note": "Placeholder Point geometry. This is a portable time series for charting, not a spatial dataset. FRED is preferred. Yahoo history is used as fallback when FRED is unavailable.",
            "sources": health,
        },
        "features": features,
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
            msg = f"Failed to fetch Yahoo price {ticker}: {exc}"
            print(f"::warning::{msg}")
            health[ticker] = {"ok": False, "error": msg}

    live["health"] = health
    LIVE_FILE.write_text(json.dumps(live, indent=2), encoding="utf-8")

    history, fetched_fresh_history = oil_history_geojson()
    HISTORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")

    print(json.dumps({
        "live": live,
        "history_features": len(history.get("features", [])),
        "fresh_history_written": fetched_fresh_history,
        "history": history.get("metadata", {}),
    }, indent=2))


if __name__ == "__main__":
    main()
