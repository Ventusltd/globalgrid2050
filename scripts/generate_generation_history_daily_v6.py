import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SOURCE = Path('data/generation/elexon_generation_sources_half_hourly.csv')
OUT = Path('uk_energy_tracking_v6/generation_history/generation_history_daily_decade.json')

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
ORDER = ['Solar', 'Wind', 'Hydro', 'Gas', 'Coal', 'Biomass', 'Nuclear', 'Pumped Storage', 'Imports & Exports']


def group_for(fuel):
    f = str(fuel or '').upper()
    for label, prefixes in GROUPS.items():
        if any(f.startswith(prefix) for prefix in prefixes):
            return label
    return 'Other'


def parse_mw(value):
    try:
        return float(value)
    except Exception:
        return None


def main():
    if not SOURCE.exists():
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps({'rows': [], 'generatedUTC': datetime.now(timezone.utc).isoformat()}, indent=2), encoding='utf-8')
        print(f'Missing source, wrote empty aggregate: {OUT}')
        return

    buckets = defaultdict(list)
    with SOURCE.open('r', encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            t = row.get('periodStartUTC', '')
            if len(t) < 10:
                continue
            date = t[:10]
            label = group_for(row.get('fuelType', ''))
            mw = parse_mw(row.get('generationMW'))
            if mw is None:
                continue
            buckets[(date, label)].append(mw)

    rows = []
    for (date, label), values in sorted(buckets.items()):
        if not values:
            continue
        rows.append({
            'date': date,
            'technology': label,
            'averageMW': round(sum(values) / len(values), 3),
            'highMW': round(max(values), 3),
            'lowMW': round(min(values), 3),
            'records': len(values),
            'source': 'Elexon BMRS FUELINST and Sheffield Solar PVLive daily aggregate',
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'generatedUTC': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'source': 'Elexon BMRS FUELINST and Sheffield Solar PVLive where available',
        'rows': rows,
    }, indent=2), encoding='utf-8')
    print(f'Wrote {len(rows)} daily generation rows to {OUT}')


if __name__ == '__main__':
    main()
