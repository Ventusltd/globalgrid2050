import json
import os
import sys
import datetime as dt
from collections import defaultdict
from pathlib import Path

from backfill_generation_sources_year_v6 import fetch_elexon_day, fetch_pvlive_day, utc_now

OUT = Path('uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json')
REPORT = Path('uk_energy_tracking_v6/generation_history/backfill_reports/GENERATION_RECENT_MW_SLICE.md')

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
        return dt.datetime.fromisoformat(str(value).replace('Z', '+00:00')).astimezone(dt.timezone.utc)
    except Exception:
        return None


def parse_mw(value):
    try:
        return float(value)
    except Exception:
        return None


def main():
    days = int(os.getenv('DAYS') or (sys.argv[1] if len(sys.argv) > 1 else 30))
    include_solar = os.getenv('INCLUDE_SOLAR', 'true').lower() not in ('0', 'false', 'no')
    today = dt.datetime.now(dt.timezone.utc).date()
    end_day = today - dt.timedelta(days=1)
    start_day = end_day - dt.timedelta(days=days - 1)
    deduped = {}
    raw_elexon = 0
    raw_solar = 0
    failed = []
    solar_status = 'not requested'
    solar_url = ''
    day = start_day
    while day <= end_day:
        try:
            rows = fetch_elexon_day(day)
            raw_elexon += len(rows)
            for row in rows:
                t = parse_time(row.get('periodStartUTC'))
                mw = parse_mw(row.get('generationMW'))
                fuel = row.get('fuelType', '')
                if not t or mw is None or not fuel:
                    continue
                tech = group_for(fuel)
                key = (t.isoformat().replace('+00:00', 'Z'), tech, fuel)
                deduped[key] = {'time': key[0], 'technology': tech, 'fuelType': fuel, 'generationMW': mw, 'source': row.get('source', 'Elexon BMRS FUELINST')}
            print(f'{day}: Elexon {len(rows)} rows')
        except Exception as exc:
            failed.append(f'{day} Elexon {exc}')
        if include_solar:
            try:
                rows, status, url = fetch_pvlive_day(day)
                raw_solar += len(rows)
                if url and not solar_url:
                    solar_url = url
                if rows:
                    solar_status = 'ok'
                elif solar_status != 'ok':
                    solar_status = status
                for row in rows:
                    t = parse_time(row.get('periodStartUTC'))
                    mw = parse_mw(row.get('generationMW'))
                    if not t or mw is None:
                        continue
                    key = (t.isoformat().replace('+00:00', 'Z'), 'Solar', 'SOLAR')
                    deduped[key] = {'time': key[0], 'technology': 'Solar', 'fuelType': 'SOLAR', 'generationMW': mw, 'source': 'Sheffield Solar PVLive'}
                print(f'{day}: PVLive solar {len(rows)} rows')
            except Exception as exc:
                failed.append(f'{day} PVLive {exc}')
                if solar_status != 'ok':
                    solar_status = str(exc)
        day += dt.timedelta(days=1)
    by_time_tech = defaultdict(float)
    source_by_time_tech = {}
    for row in deduped.values():
        key = (row['time'], row['technology'])
        by_time_tech[key] += row['generationMW']
        source_by_time_tech[key] = row['source']
    rows = []
    for (time, tech), mw in sorted(by_time_tech.items(), key=lambda item: (item[0][0], item[0][1])):
        rows.append({'time': time, 'technology': tech, 'generationMW': round(mw, 3), 'source': source_by_time_tech.get((time, tech), 'Aggregated generation MW')})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({'generatedUTC': utc_now(), 'source': 'Elexon BMRS FUELINST and Sheffield Solar PVLive where available', 'description': 'Recent MW generation slice for engineering fluctuation chart', 'windowStart': start_day.isoformat(), 'windowEnd': end_day.isoformat(), 'unit': 'MW', 'rows': rows}, indent=2), encoding='utf-8')
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('\n'.join(['# Recent MW Generation Slice', '', f'Updated UTC: {utc_now()}', f'Window: {start_day} to {end_day}', f'Days: {days}', f'Elexon raw rows fetched: {raw_elexon}', f'PVLive raw solar rows fetched: {raw_solar}', f'Deduped raw rows: {len(deduped)}', f'Output rows: {len(rows)}', f'PVLive status: {solar_status}', f'PVLive working URL sample: {solar_url or "not confirmed"}', f'Failed days: {len(failed)}', 'Output: generation_recent_halfhourly_30d.json', 'Purpose: keep MW fluctuation chart alive without committing raw historical CSV.', '', '## Failed day details', *failed[:200]]) + '\n', encoding='utf-8')
    print(f'Wrote {len(rows)} rows to {OUT}')
    print(f'Wrote report {REPORT}')


if __name__ == '__main__':
    main()
