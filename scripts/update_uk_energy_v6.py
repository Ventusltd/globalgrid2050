import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import requests

FOLDER = Path(__file__).parent.parent / 'uk_energy_tracking_v6'
OUT = FOLDER / 'live_grid_energy.json'
ELEXON = 'https://data.elexon.co.uk/bmrs/api/v1'
PVLIVE = 'https://api.solar.sheffield.ac.uk/pvlive/api/v4'
TIMEOUT = 12

GROUPS = {
    'Wind': ['WIND'], 'Hydro': ['NPSHYD'], 'Gas': ['CCGT', 'OCGT'],
    'Coal': ['COAL'], 'Biomass': ['BIOMASS'], 'Nuclear': ['NUCLEAR'],
    'Pumped Storage': ['PS'], 'Imports & Exports': ['INT'],
}
ORDER = ['Solar','Wind','Hydro','Gas','Coal','Biomass','Nuclear','Pumped Storage','Imports & Exports']
COLORS = {'Solar':'#f5c518','Wind':'#00d0ff','Hydro':'#0090c0','Gas':'#c0399a','Coal':'#888888','Biomass':'#f59e2b','Nuclear':'#5cb85c','Pumped Storage':'#9b59b6','Imports & Exports':'#e8615a'}

def ago(minutes):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).strftime('%Y-%m-%dT%H:%MZ')

def get_json(url):
    r = requests.get(url, timeout=TIMEOUT, headers={'Accept':'application/json','User-Agent':'GlobalGrid2050 V6'})
    r.raise_for_status()
    return r.json()

def fetch_mix():
    url = f'{ELEXON}/datasets/FUELINST?publishDateTimeFrom={ago(30)}&publishDateTimeTo={ago(0)}&format=json'
    rows = get_json(url).get('data', [])
    if not rows:
        return {}
    latest = max(r['startTime'] for r in rows)
    snap = [r for r in rows if r['startTime'] == latest]
    return {r['fuelType']: float(r.get('generation') or 0) for r in snap}

def fetch_solar():
    rows = get_json(f'{PVLIVE}/gsp/0').get('data', [])
    if not rows:
        return 0.0
    return float(rows[0][2] or 0) / 1000.0

def main():
    health = {}
    try:
        raw = fetch_mix(); health['generation'] = 'ok'
    except Exception as exc:
        raw = {}; health['generation'] = f'error: {exc}'
    try:
        solar = fetch_solar(); health['solar'] = 'ok'
    except Exception as exc:
        solar = 0.0; health['solar'] = f'error: {exc}'
    grouped = {}
    for label, codes in GROUPS.items():
        grouped[label] = sum(mw for code, mw in raw.items() if any(code.startswith(prefix) for prefix in codes)) / 1000.0
    grouped['Solar'] = solar
    demand = sum(grouped.values())
    mix = [{'label': label, 'gw': round(grouped.get(label,0),2), 'pct': round((grouped.get(label,0)/demand*100),2) if demand else 0, 'color': COLORS[label]} for label in ORDER]
    out = {'updated': datetime.now(timezone.utc).isoformat(), 'demandGW': round(demand,2), 'solarGW': round(solar,2), 'mix': mix, 'health': health}
    FOLDER.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2), encoding='utf-8')
    print(json.dumps({'v6_energy_updated': out['updated'], 'demandGW': out['demandGW'], 'health': health}, indent=2))

if __name__ == '__main__':
    main()
