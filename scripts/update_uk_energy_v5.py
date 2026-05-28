import requests
import os
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Runs every 5 minutes. Fetches demand + generation mix (Elexon FUELINST)
# and national solar (Sheffield Solar). Writes ONLY the V5 energy slice so a
# failure here never touches the half hourly price slice.

FOLDER = Path(__file__).parent.parent / "uk_energy_tracking_v5"
JSON_FILE = FOLDER / "live_grid_energy.json"
MD_FILE = FOLDER / "index.md"

ELEXON = "https://data.elexon.co.uk/bmrs/api/v1"
PVLIVE = "https://api.solar.sheffield.ac.uk/pvlive/api/v4"
TIMEOUT = 12

FUEL_GROUPS = {
    "Wind": ["WIND"], "Hydro": ["NPSHYD"], "Gas": ["CCGT", "OCGT"],
    "Coal": ["COAL"], "Biomass": ["BIOMASS"], "Nuclear": ["NUCLEAR"],
    "Pumped Storage": ["PS"], "Imports & Exports": ["INT"],
}
ROW_ORDER = ["Solar", "Wind", "Hydro", "Gas", "Coal",
             "Biomass", "Nuclear", "Pumped Storage", "Imports & Exports"]
ROW_COLORS = {
    "Solar": "#f5c518", "Wind": "#00d0ff", "Hydro": "#0090c0",
    "Gas": "#c0399a", "Coal": "#888888", "Biomass": "#f59e2b",
    "Nuclear": "#5cb85c", "Pumped Storage": "#9b59b6", "Imports & Exports": "#e8615a",
}


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


def fetch_generation_mix():
    url = (f"{ELEXON}/datasets/FUELINST?publishDateTimeFrom={_iso_minutes_ago(30)}"
           f"&publishDateTimeTo={_iso_minutes_ago(0)}&format=json")
    data = _get_json(url).get("data", [])
    if not data:
        return {}
    latest = max(row["startTime"] for row in data)
    snap = [r for r in data if r["startTime"] == latest]
    return {r["fuelType"]: float(r.get("generation") or 0) for r in snap}


def fetch_solar_gw():
    rows = _get_json(f"{PVLIVE}/gsp/0").get("data", [])
    if not rows:
        return 0.0
    mw = rows[0][2]
    return (float(mw) / 1000.0) if mw is not None else 0.0


def main():
    health = {}
    try:
        raw_mw = fetch_generation_mix(); health["generation"] = "ok"
    except Exception as e:  # noqa: BLE001
        raw_mw = {}; health["generation"] = f"error: {e}"
    try:
        solar_gw = fetch_solar_gw(); health["solar"] = "ok"
    except Exception as e:  # noqa: BLE001
        solar_gw = 0.0; health["solar"] = f"error: {e}"

    groups = {}
    for label, codes in FUEL_GROUPS.items():
        groups[label] = sum(mw for c, mw in raw_mw.items()
                            if any(c.startswith(p) for p in codes)) / 1000.0
    groups["Solar"] = solar_gw
    demand = sum(groups.values())

    mix = [{
        "label": l, "gw": round(groups.get(l, 0.0), 2),
        "pct": round((groups.get(l, 0.0) / demand * 100), 2) if demand else 0,
        "color": ROW_COLORS[l],
    } for l in ROW_ORDER]

    out = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "demandGW": round(demand, 2),
        "solarGW": round(solar_gw, 2),
        "mix": mix,
        "health": health,
    }
    FOLDER.mkdir(parents=True, exist_ok=True)
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    if any(v != "ok" for v in health.values()):
        print(f"::warning::Energy source issue: {health}")
    print(f"Energy slice V5 | demand {out['demandGW']} GW | solar {out['solarGW']} GW | {health}")


if __name__ == "__main__":
    main()
