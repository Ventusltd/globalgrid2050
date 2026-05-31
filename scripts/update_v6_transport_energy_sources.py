import csv
import json
import re
from datetime import datetime, timezone, timedelta
from io import StringIO
from pathlib import Path
from urllib.parse import urljoin

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "uk_energy_tracking_v6"

OIL_LIVE_FILE = OUT_DIR / "live_oil_prices.json"
OIL_HISTORY_FILE = OUT_DIR / "oil_price_history.geojson"
FUEL_FILE = OUT_DIR / "live_uk_fuel_prices.json"
EV_FILE = OUT_DIR / "ev_charging_prices.json"
REPORT_FILE = OUT_DIR / "V6_TRANSPORT_ENERGY_SOURCES_REPORT.md"

DESNZ_FUEL_PAGE = "https://www.gov.uk/government/statistics/weekly-road-fuel-prices"
HISTORY_YEARS = 25
HISTORY_MAX_AGE_HOURS = 24
HEADERS = {"User-Agent": "GlobalGrid2050/1.0"}


def now_utc():
    return datetime.now(timezone.utc).isoformat()


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
    session.headers.update(HEADERS)
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


SESSION = build_session()


def fetch_text(url, timeout=30):
    r = SESSION.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text


def yahoo_price(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    r = SESSION.get(url, timeout=20)
    r.raise_for_status()
    return float(r.json()["chart"]["result"][0]["meta"]["regularMarketPrice"])


def fred_csv(series):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
    rows = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_YEARS * 366)
    for row in csv.DictReader(StringIO(fetch_text(url, timeout=60))):
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


def yahoo_history(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range={HISTORY_YEARS}y&interval=1d"
    r = SESSION.get(url, timeout=60)
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
        if dt >= cutoff:
            rows.append((dt.strftime("%Y-%m-%d"), float(close)))
    if not rows:
        raise RuntimeError(f"Yahoo returned no usable rows for {ticker}")
    return rows


def load_existing_json(path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_oil():
    live = {"updated": now_utc(), "brentUSDperBarrel": None, "wtiUSDperBarrel": None, "health": {}}
    for ticker, key in [("BZ=F", "brentUSDperBarrel"), ("CL=F", "wtiUSDperBarrel")]:
        try:
            live[key] = yahoo_price(ticker)
            live["health"][ticker] = {"ok": True, "source": "Yahoo Finance chart API"}
        except Exception as exc:
            live["health"][ticker] = {"ok": False, "error": str(exc)}
    OIL_LIVE_FILE.write_text(json.dumps(live, indent=2), encoding="utf-8")

    existing = load_existing_json(OIL_HISTORY_FILE)
    if existing and existing.get("features"):
        updated = existing.get("metadata", {}).get("updated")
        try:
            dt = datetime.fromisoformat(str(updated).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - dt < timedelta(hours=HISTORY_MAX_AGE_HOURS):
                existing.setdefault("metadata", {})["lastSkippedHistoryUpdate"] = now_utc()
                OIL_HISTORY_FILE.write_text(json.dumps(existing, indent=2), encoding="utf-8")
                return {"live": live, "history_features": len(existing.get("features", [])), "fresh_history": False}
        except Exception:
            pass

    merged = {}
    health = []
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

    if not merged:
        for ticker, field, label in [
            ("BZ=F", "brentUSDperBarrel", "Yahoo Brent futures history"),
            ("CL=F", "wtiUSDperBarrel", "Yahoo WTI futures history"),
        ]:
            try:
                rows = yahoo_history(ticker)
                for date, value in rows:
                    merged.setdefault(date, {})[field] = value
                health.append({"ok": True, "source": label, "rows": len(rows), "fallback": True})
            except Exception as exc:
                health.append({"ok": False, "source": label, "error": str(exc), "fallback": True})

    features = [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}, "properties": {"date": date, **merged[date]}}
        for date in sorted(merged)
    ]
    history = {
        "type": "FeatureCollection",
        "metadata": {
            "updated": now_utc(),
            "unit": "USD per barrel",
            "period": f"Last {HISTORY_YEARS} years",
            "note": "Placeholder Point geometry. This is a portable time series for charting, not a spatial dataset. FRED is preferred. Yahoo history is fallback.",
            "sources": health,
        },
        "features": features,
    }
    OIL_HISTORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")
    return {"live": live, "history_features": len(features), "fresh_history": True, "health": health}


def normalise(text):
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


def parse_number(value):
    if value is None:
        return None
    text = str(value).replace(",", "").strip()
    if not text or text in {".", "-"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def find_latest_desnz_csv_url():
    html = fetch_text(DESNZ_FUEL_PAGE, timeout=30)
    matches = re.findall(r'href="([^"]*weekly_road_fuel_prices_[0-9]{6}\.csv)"', html, flags=re.I)
    current = [m for m in matches if "2003_to_2017" not in m.lower()]
    if not current:
        raise RuntimeError("Could not find current DESNZ weekly road fuel CSV link")
    return urljoin(DESNZ_FUEL_PAGE, current[0])


def parse_desnz_csv(csv_text):
    rows = list(csv.reader(StringIO(csv_text)))
    header_i = None
    for i, row in enumerate(rows[:20]):
        joined = " ".join(row).lower()
        if ("ulsp" in joined or "unleaded" in joined) and ("ulsd" in joined or "diesel" in joined):
            header_i = i
            break
    if header_i is None:
        raise RuntimeError("Could not identify DESNZ CSV header row")
    headers = rows[header_i]
    normalised = [normalise(h) for h in headers]

    def find_col(candidates):
        for needle in candidates:
            for idx, name in enumerate(normalised):
                if needle in name:
                    return idx
        return None

    date_col = find_col(["date", "weekcommencing", "week"])
    petrol_col = find_col(["ulsp", "unleaded", "petrol"])
    diesel_col = find_col(["ulsd", "diesel"])
    if petrol_col is None or diesel_col is None:
        raise RuntimeError(f"Could not identify petrol or diesel columns. Headers: {headers}")

    parsed = []
    for row in rows[header_i + 1:]:
        if len(row) <= max(petrol_col, diesel_col, date_col or 0):
            continue
        petrol = parse_number(row[petrol_col])
        diesel = parse_number(row[diesel_col])
        if petrol is None and diesel is None:
            continue
        parsed.append({
            "week": row[date_col].strip() if date_col is not None else None,
            "petrolPencePerLitre": petrol,
            "dieselPencePerLitre": diesel,
        })
    if not parsed:
        raise RuntimeError("DESNZ CSV parsed but no usable rows were found")
    return parsed


def write_fuel():
    health = {"source": "DESNZ weekly road fuel prices", "page": DESNZ_FUEL_PAGE}
    try:
        csv_url = find_latest_desnz_csv_url()
        rows = parse_desnz_csv(fetch_text(csv_url, timeout=30))
        latest = rows[-1]
        out = {
            "updated": now_utc(),
            "source": "Department for Energy Security and Net Zero weekly road fuel prices",
            "sourcePage": DESNZ_FUEL_PAGE,
            "sourceCsv": csv_url,
            "unit": "pence per litre",
            "latest": latest,
            "history": rows,
            "health": {**health, "ok": True, "csv": csv_url, "rows": len(rows)},
        }
    except Exception as exc:
        existing = load_existing_json(FUEL_FILE)
        if existing and existing.get("history"):
            existing["lastAttemptedUpdate"] = now_utc()
            existing["health"] = {**health, "ok": False, "error": str(exc)}
            out = existing
        else:
            out = {
                "updated": now_utc(),
                "source": "Department for Energy Security and Net Zero weekly road fuel prices",
                "sourcePage": DESNZ_FUEL_PAGE,
                "unit": "pence per litre",
                "latest": {"week": None, "petrolPencePerLitre": None, "dieselPencePerLitre": None},
                "history": [],
                "health": {**health, "ok": False, "error": str(exc)},
            }
    FUEL_FILE.write_text(json.dumps(out, indent=2), encoding="utf-8")
    return {"latest": out.get("latest"), "health": out.get("health")}


def write_ev_reference():
    # Public EV tariffs vary by site, time, membership and vehicle. This file is a transparent reference table,
    # not an automated quote engine. Values are updated only when reviewed.
    out = {
        "updated": now_utc(),
        "unit": "pence per kilowatt hour",
        "sourcePolicy": "Curated public reference values. Public EV charging varies by operator, location, time, app, membership and vehicle.",
        "sources": [
            {"publisher": "The Sunday Times", "note": "Reported UK public charging benchmark: Gridserve 79p/kWh; InstaVolt 85p/kWh, 54p/kWh off peak; Tesla 24p to 47p/kWh for Tesla owners and 32p to 63p/kWh for non Tesla EVs, article citing Zapmap survey context."},
            {"publisher": "Operator websites", "note": "Operator links retained for manual verification before commercial use."},
        ],
        "operators": [
            {
                "operator": "Gridserve",
                "rapidPencePerKWh": 79,
                "ultraRapidPencePerKWh": 79,
                "sourceUrl": "https://www.gridserve.com/electric-highway/",
                "lastChecked": "2026-05-31",
                "status": "public benchmark, site tariffs may vary",
            },
            {
                "operator": "InstaVolt",
                "rapidPencePerKWh": 85,
                "ultraRapidPencePerKWh": 85,
                "offPeakPencePerKWh": 54,
                "sourceUrl": "https://instavolt.co.uk/",
                "lastChecked": "2026-05-31",
                "status": "public benchmark, off peak tariff separately stated",
            },
            {
                "operator": "Tesla Supercharger",
                "rapidPencePerKWh": 36,
                "ultraRapidPencePerKWh": 48,
                "ownerRangePencePerKWh": [24, 47],
                "nonTeslaRangePencePerKWh": [32, 63],
                "sourceUrl": "https://www.tesla.com/en_gb/supercharger",
                "lastChecked": "2026-05-31",
                "status": "midpoint display from reported range; live site pricing varies",
            },
        ],
    }
    EV_FILE.write_text(json.dumps(out, indent=2), encoding="utf-8")
    return {"operators": len(out["operators"]), "updated": out["updated"]}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    oil = write_oil()
    fuel = write_fuel()
    ev = write_ev_reference()
    report = {
        "updated": now_utc(),
        "oil": oil,
        "fuel": fuel,
        "ev": ev,
    }
    REPORT_FILE.write_text(
        "# V6 Transport Energy Sources Report\n\n"
        f"Updated UTC: `{report['updated']}`\n\n"
        "## Outputs\n\n"
        "1. `uk_energy_tracking_v6/live_oil_prices.json`\n"
        "2. `uk_energy_tracking_v6/oil_price_history.geojson`\n"
        "3. `uk_energy_tracking_v6/live_uk_fuel_prices.json`\n"
        "4. `uk_energy_tracking_v6/ev_charging_prices.json`\n\n"
        "## Notes\n\n"
        "Oil live prices use Yahoo Finance chart API. Oil history prefers FRED Brent and WTI daily spot price series, with Yahoo futures history as fallback.\n\n"
        "Road fuel uses DESNZ weekly road fuel prices from GOV.UK.\n\n"
        "EV charging values are curated public reference values and must not be treated as live tariff quotes.\n\n"
        "```json\n" + json.dumps(report, indent=2) + "\n```\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
