import csv
import json
import os
import sys
import datetime as dt
from collections import defaultdict
from pathlib import Path

from backfill_generation_sources_year_v6 import fetch_elexon_day, fetch_pvlive_day, utc_now

OUT_ROOT = Path('data/generation/halfhourly_clean')
REPORT_DIR = Path('uk_energy_tracking_v6/generation_history/backfill_reports')
FIELDS = ['time', 'technology', 'generationMW', 'source']

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


def month_window(year, month):
    start = dt.date(year, month, 1)
    if month == 12:
        end = dt.date(year, 12, 31)
    else:
        end = dt.date(year, month + 1, 1) - dt.timedelta(days=1)
    current_date = dt.datetime.now(dt.timezone.utc).date()
    if year == current_date.year and month == current_date.month:
        end = min(end, current_date - dt.timedelta(days=1))
    return start, end


def compact_time(t):
    return t.isoformat().replace('+00:00', 'Z')


def main():
    year = int(os.getenv('YEAR') or (sys.argv[1] if len(sys.argv) > 1 else dt.datetime.now(dt.timezone.utc).year))
    month = int(os.getenv('MONTH') or (sys.argv[2] if len(sys.argv) > 2 else dt.datetime.now(dt.timezone.utc).month))
    include_solar = os.getenv('INCLUDE_SOLAR', 'true').lower() not in ('0', 'false', 'no')
    if month < 1 or month > 12:
        raise SystemExit('MONTH must be 1 to 12')

    start_day, end_day = month_window(year, month)
    if end_day < start_day:
        raise SystemExit(f'No complete days available for {year}-{month:02d}')

    raw_elexon = 0
    raw_solar = 0
    raw_deduped = {}
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
                key = (compact_time(t), str(fuel).upper())
                raw_deduped[key] = {'time': key[0], 'fuelType': key[1], 'technology': group_for(fuel), 'generationMW': mw, 'source': 'Elexon BMRS FUELINST'}
            print(f'{day}: Elexon raw rows {len(rows)}')
        except Exception as exc:
            failed.append(f'{day} Elexon {exc}')
            print(f'Warning {day}: Elexon failed: {exc}')

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
                    key = (compact_time(t), 'SOLAR')
                    raw_deduped[key] = {'time': key[0], 'fuelType': 'SOLAR', 'technology': 'Solar', 'generationMW': mw, 'source': 'Sheffield Solar PVLive'}
                print(f'{day}: PVLive solar raw rows {len(rows)}')
            except Exception as exc:
                failed.append(f'{day} PVLive {exc}')
                if solar_status != 'ok':
                    solar_status = str(exc)
                print(f'Warning {day}: PVLive failed: {exc}')
        day += dt.timedelta(days=1)

    by_time_technology = defaultdict(float)
    sources = defaultdict(set)
    for row in raw_deduped.values():
        key = (row['time'], row['technology'])
        by_time_technology[key] += row['generationMW']
        sources[key].add(row['source'])

    out_rows = []
    for key in sorted(by_time_technology, key=lambda item: (item[0], item[1])):
        out_rows.append({
            'time': key[0],
            'technology': key[1],
            'generationMW': f'{by_time_technology[key]:.3f}',
            'source': '+'.join(sorted(sources[key])),
        })

    out_dir = OUT_ROOT / str(year)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_csv = out_dir / f'generation_mw_{year}_{month:02d}.csv'
    with out_csv.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(out_rows)

    report = REPORT_DIR / f'GENERATION_CLEAN_HALFHOUR_MONTH_{year}_{month:02d}.md'
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    size_mb = out_csv.stat().st_size / 1024 / 1024
    report.write_text('\n'.join([
        f'# Clean Half Hourly Generation MW {year}-{month:02d}',
        '',
        f'Updated UTC: {utc_now()}',
        f'Window: {start_day} to {end_day}',
        f'Elexon raw rows fetched: {raw_elexon}',
        f'PVLive raw solar rows fetched: {raw_solar}',
        f'Deduped raw timestamp plus fuel rows: {len(raw_deduped)}',
        f'Clean timestamp plus technology rows: {len(out_rows)}',
        f'Output CSV: {out_csv}',
        f'Output size MB: {size_mb:.2f}',
        f'PVLive status: {solar_status}',
        f'PVLive working URL sample: {solar_url or "not confirmed"}',
        f'Failed days: {len(failed)}',
        'Cleaning rule: dedupe by time plus raw fuel, then group raw fuels into technology and sum MW by time plus technology.',
        'Stored fields: time, technology, generationMW, source.',
        'Raw API rows are not committed.',
        '',
        '## Failed day details',
        *failed[:200],
    ]) + '\n', encoding='utf-8')

    if size_mb > 25:
        raise SystemExit(f'Clean monthly file is {size_mb:.2f} MB, above 25 MB target. Split this month weekly before committing.')

    print(f'Wrote {len(out_rows)} clean rows to {out_csv}')
    print(f'Wrote report {report}')


if __name__ == '__main__':
    main()
