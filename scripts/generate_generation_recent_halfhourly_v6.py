import csv
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

SOURCE = Path('data/generation/elexon_generation_sources_half_hourly.csv')
OUT = Path('uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json')
DAYS = 30
GROUPS = {
    'Solar': ['SOLAR', 'PV'],
    'Wind': ['WIND'],
    'Hydro': ['NPSHYD', 'HYDRO'],
    'Gas': ['CCGT', 'OCGT'],
    'Coal': ['COAL'],
    'Biomass': ['BIOMASS'],
    'Nuclear': ['NUCLEAR'],
    'Pumped Storage': ['PS'],
    'Imports & Exports': ['INT'],
}


def group_for(fuel):
    f = str(fuel or '').upper()
    for label, prefixes in GROUPS.items():
        if any(f.startswith(prefix) for prefix in prefixes):
            return label
    return 'Other'


def parse_time(value):
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).astimezone(timezone.utc)
    except Exception:
        return None


def parse_mw(value):
    try:
        return float(value)
    except Exception:
        return None


def write_empty(reason):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'generatedUTC': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'source': 'Generation recent half hourly slice',
        'windowDays': DAYS,
        'status': reason,
        'rows': [],
    }, indent=2), encoding='utf-8')
    print(f'Wrote empty recent half hourly slice: {reason}')


def main():
    if not SOURCE.exists() or SOURCE.stat().st_size == 0:
        write_empty('missing or empty master half hourly CSV')
        return

    raw = []
    latest = None
    with SOURCE.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            t = parse_time(row.get('periodStartUTC'))
            mw = parse_mw(row.get('generationMW'))
            if not t or mw is None:
                continue
            tech = group_for(row.get('fuelType', ''))
            item = {
                'time': t.isoformat().replace('+00:00', 'Z'),
                'technology': tech,
                'generationMW': round(mw, 3),
                'fuelType': row.get('fuelType', ''),
                'source': row.get('source', 'Generation half hourly source'),
            }
            raw.append((t, item))
            if latest is None or t > latest:
                latest = t

    if not raw or latest is None:
        write_empty('no parseable half hourly generation rows')
        return

    cutoff = latest - timedelta(days=DAYS)
    rows_by_key = {}
    for t, item in raw:
        if t < cutoff:
            continue
        key = (item['time'], item['technology'])
        rows_by_key[key] = item

    rows = [rows_by_key[key] for key in sorted(rows_by_key, key=lambda x: (x[0], x[1]))]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'generatedUTC': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'source': 'Recent generation half hourly slice from repository master CSV',
        'windowDays': DAYS,
        'latestUTC': latest.isoformat().replace('+00:00', 'Z'),
        'rows': rows,
    }, indent=2), encoding='utf-8')
    print(f'Wrote {len(rows)} rows to {OUT}')


if __name__ == '__main__':
    main()
