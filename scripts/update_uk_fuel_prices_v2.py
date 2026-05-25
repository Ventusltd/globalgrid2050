import csv
import json
import re
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from urllib.parse import urljoin

import requests

OUT_DIR = Path(__file__).parent.parent / "uk_energy_tracking_v2"
LIVE_FILE = OUT_DIR / "live_uk_fuel_prices.json"
GOV_PAGE = "https://www.gov.uk/government/statistics/weekly-road-fuel-prices"
TIMEOUT = 20
HEADERS = {"User-Agent": "GlobalGrid2050/1.0"}


def now_utc():
    return datetime.now(timezone.utc).isoformat()


def fetch_text(url):
    r = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
    r.raise_for_status()
    return r.text


def find_latest_csv_url():
    html = fetch_text(GOV_PAGE)
    matches = re.findall(r'href="([^"]*weekly_road_fuel_prices_[0-9]{6}\.csv)"', html, flags=re.I)
    current = [m for m in matches if "2003_to_2017" not in m.lower()]
    if not current:
        raise RuntimeError("Could not find current DESNZ weekly road fuel prices CSV link on GOV.UK page")
    return urljoin(GOV_PAGE, current[0])


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
        raise RuntimeError("DESNZ CSV parsed but no usable fuel price rows were found")
    return parsed


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    health = {"source": "DESNZ weekly road fuel prices", "page": GOV_PAGE}
    try:
        csv_url = find_latest_csv_url()
        rows = parse_desnz_csv(fetch_text(csv_url))
        latest = rows[-1]
        health.update({"ok": True, "csv": csv_url, "rows": len(rows)})
        out = {
            "updated": now_utc(),
            "source": "Department for Energy Security and Net Zero weekly road fuel prices",
            "sourcePage": GOV_PAGE,
            "sourceCsv": csv_url,
            "unit": "pence per litre",
            "latest": latest,
            "history": rows,
            "health": health,
        }
    except Exception as exc:
        health.update({"ok": False, "error": str(exc)})
        existing = None
        if LIVE_FILE.exists():
            try:
                existing = json.loads(LIVE_FILE.read_text(encoding="utf-8"))
            except Exception:
                existing = None
        if existing and existing.get("history"):
            existing["lastAttemptedUpdate"] = now_utc()
            existing["health"] = health
            out = existing
        else:
            out = {
                "updated": now_utc(),
                "source": "Department for Energy Security and Net Zero weekly road fuel prices",
                "sourcePage": GOV_PAGE,
                "unit": "pence per litre",
                "latest": {"week": None, "petrolPencePerLitre": None, "dieselPencePerLitre": None},
                "history": [],
                "health": health,
            }

    LIVE_FILE.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps({"latest": out.get("latest"), "health": out.get("health")}, indent=2))


if __name__ == "__main__":
    main()
