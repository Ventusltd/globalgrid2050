import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import requests

FOLDER = Path(__file__).parent.parent / 'uk_energy_tracking_v6'
OUT = FOLDER / 'live_grid_energy.json'
REPORT_DIR = Path(__file__).parent.parent / 'gridbot_reports'
REPORT = REPORT_DIR / 'v6_live_feed_guardrail_report.md'
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
MIN_NON_SOLAR_GW = 5.0
MIN_TOTAL_GW = 15.0


def ago(minutes):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).strftime('%Y-%m-%dT%H:%MZ')


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def get_json(url):
    last = None
    for _ in range(2):
        try:
            r = requests.get(url, timeout=TIMEOUT, headers={'Accept':'application/json','User-Agent':'GlobalGrid2050 V6'})
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            last = exc
    raise last


def fetch_mix():
    url = f'{ELEXON}/datasets/FUELINST?publishDateTimeFrom={ago(90)}&publishDateTimeTo={ago(0)}&format=json'
    rows = get_json(url).get('data', [])
    if not rows:
        raise RuntimeError('Elexon FUELINST returned no rows')
    latest = max(r['startTime'] for r in rows if r.get('startTime'))
    snap = [r for r in rows if r.get('startTime') == latest]
    if len(snap) < 3:
        raise RuntimeError(f'Elexon FUELINST thin snapshot: {len(snap)} rows')
    return {r['fuelType']: float(r.get('generation') or 0) for r in snap if r.get('fuelType')}


def fetch_solar():
    rows = get_json(f'{PVLIVE}/gsp/0').get('data', [])
    if not rows:
        raise RuntimeError('PVLive returned no rows')
    return float(rows[0][2] or 0) / 1000.0


def previous_payload():
    if not OUT.exists():
        return None
    try:
        return json.loads(OUT.read_text(encoding='utf-8'))
    except Exception:
        return None


def write_report(status, detail, payload=None):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        '# V6 Live Feed Guardrail Report',
        '',
        f'Updated UTC: {now_iso()}',
        f'Status: {status}',
        f'Detail: {detail}',
    ]
    if payload:
        lines += [
            '',
            f"Demand GW: {payload.get('demandGW')}",
            f"Solar GW: {payload.get('solarGW')}",
            f"Health: {json.dumps(payload.get('health', {}), ensure_ascii=False)}",
        ]
    REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def valid_energy_payload(out):
    mix = out.get('mix') or []
    non_solar = sum(float(r.get('gw') or 0) for r in mix if r.get('label') != 'Solar')
    total = float(out.get('demandGW') or 0)
    solar = float(out.get('solarGW') or 0)
    if total < MIN_TOTAL_GW:
        return False, f'total demand too low for GB live mix: {total} GW'
    if non_solar < MIN_NON_SOLAR_GW:
        return False, f'non solar generation too low: {non_solar} GW, solar {solar} GW'
    if solar > 0 and total <= solar * 1.15:
        return False, f'solar-only collapse risk: demand {total} GW, solar {solar} GW'
    return True, 'ok'


def main():
    health = {}
    try:
        raw = fetch_mix(); health['generation'] = 'ok'
    except Exception as exc:
        raw = None; health['generation'] = f'error: {exc}'
    try:
        solar = fetch_solar(); health['solar'] = 'ok'
    except Exception as exc:
        solar = 0.0; health['solar'] = f'error: {exc}'

    if raw is None:
        old = previous_payload()
        write_report('blocked', 'Elexon generation failed, previous V6 energy file preserved', old)
        print(f"::warning::V6 energy guardrail blocked overwrite: {health}")
        return

    grouped = {}
    for label, codes in GROUPS.items():
        grouped[label] = sum(mw for code, mw in raw.items() if any(code.startswith(prefix) for prefix in codes)) / 1000.0
    grouped['Solar'] = solar
    demand = sum(grouped.values())
    mix = [{'label': label, 'gw': round(grouped.get(label,0),2), 'pct': round((grouped.get(label,0)/demand*100),2) if demand else 0, 'color': COLORS[label]} for label in ORDER]
    out = {'updated': now_iso(), 'demandGW': round(demand,2), 'solarGW': round(solar,2), 'mix': mix, 'health': health}

    valid, reason = valid_energy_payload(out)
    if not valid:
        old = previous_payload()
        write_report('blocked', reason + '; previous V6 energy file preserved', old)
        print(f'::warning::V6 energy guardrail blocked overwrite: {reason}')
        return

    FOLDER.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2), encoding='utf-8')
    write_report('ok', 'V6 energy feed passed guardrails', out)
    print(json.dumps({'v6_energy_updated': out['updated'], 'demandGW': out['demandGW'], 'health': health}, indent=2))

if __name__ == '__main__':
    main()
