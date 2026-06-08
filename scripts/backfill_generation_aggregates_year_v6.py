import json
import os
import sys
import datetime as dt
from collections import defaultdict
from pathlib import Path

from backfill_generation_sources_year_v6 import fetch_elexon_day, fetch_pvlive_day, utc_now

OUT_DIR = Path('uk_energy_tracking_v6/generation_history')
REPORT_DIR = OUT_DIR / 'backfill_reports'
MONTHLY_JSON = OUT_DIR / 'generation_monthly_mwh_by_technology.json'
ANNUAL_JSON = OUT_DIR / 'generation_annual_mwh_by_technology.json'
SEASONAL_JSON = OUT_DIR / 'generation_seasonal_mwh_by_technology.json'
DAY_NIGHT_JSON = OUT_DIR / 'generation_day_night_mwh_by_technology.json'

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
ORDER = ['Solar', 'Wind', 'Hydro', 'Gas', 'Coal', 'Biomass', 'Nuclear', 'Pumped Storage', 'Imports & Exports', 'Other']


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


def season_for_month(month):
    if month in (12, 1, 2):
        return 'Winter'
    if month in (3, 4, 5):
        return 'Spring'
    if month in (6, 7, 8):
        return 'Summer'
    return 'Autumn'


def day_night_bucket(t):
    return 'day' if 6 <= t.hour < 18 else 'night'


def load_json_rows(path):
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding='utf-8'))
        rows = payload.get('rows', []) if isinstance(payload, dict) else []
        return rows if isinstance(rows, list) else []
    except Exception:
        return []


def write_json(path, rows, description):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        'generatedUTC': utc_now(),
        'source': 'Elexon BMRS FUELINST and Sheffield Solar PVLive where available',
        'description': description,
        'unit': 'MWh',
        'rows': rows,
    }, indent=2), encoding='utf-8')


def safe_float(value):
    try:
        if value in (None, '', 'NaN'):
            return None
        return float(value)
    except Exception:
        return None


def value_score(row):
    fields = ['totalMWh', 'dayMWh', 'nightMWh', 'averageMW', 'highMW', 'lowMW']
    score = 0.0
    for field in fields:
        value = safe_float(row.get(field))
        if value is not None:
            score += abs(value)
    return score


def record_count(row):
    value = safe_float(row.get('records', row.get('periodCount', 0)))
    return int(value) if value is not None and value > 0 else 0


def completeness(row):
    value = safe_float(row.get('completeness'))
    if value is not None:
        return value
    # Existing v6 rows do not yet carry completeness. Until schema v2 lands,
    # records are the best available quality proxy.
    return float(record_count(row))


def weak_row(row):
    if not isinstance(row, dict):
        return True
    return record_count(row) <= 0 and value_score(row) <= 0


def should_replace_existing(existing, incoming):
    if existing is None:
        return not weak_row(incoming)
    if weak_row(incoming) and not weak_row(existing):
        return False
    existing_quality = completeness(existing)
    incoming_quality = completeness(incoming)
    if existing_quality > 0 and incoming_quality < existing_quality:
        return False
    return True


def merge_rows(path, new_rows, key_fields, description):
    existing = load_json_rows(path)
    merged = {}
    preserved = 0
    blocked = []

    for row in existing:
        key = tuple(row.get(field) for field in key_fields)
        merged[key] = row

    for row in new_rows:
        key = tuple(row.get(field) for field in key_fields)
        old = merged.get(key)
        if should_replace_existing(old, row):
            merged[key] = row
        else:
            preserved += 1
            blocked.append(key)

    if blocked:
        print(f'Preserved {preserved} existing rows in {path}; incoming rows were weaker or incomplete.')
        for key in blocked[:20]:
            print(f'Preserved existing row for key: {key}')
        if os.getenv('FAIL_ON_WEAK_OVERWRITE', 'false').lower() in ('1', 'true', 'yes'):
            raise ValueError(f'Blocked weak overwrite for {preserved} rows in {path}')

    rows = [merged[key] for key in sorted(merged)]
    write_json(path, rows, description)
    return len(rows)


def add_stats(bucket, mw, mwh):
    bucket['totalMWh'] += mwh
    bucket['mwSum'] += mw
    bucket['records'] += 1
    bucket['highMW'] = mw if bucket['highMW'] is None else max(bucket['highMW'], mw)
    bucket['lowMW'] = mw if bucket['lowMW'] is None else min(bucket['lowMW'], mw)


def finalise_stat_row(base, bucket):
    records = bucket['records'] or 0
    return {
        **base,
        'totalMWh': round(bucket['totalMWh'], 3),
        'averageMW': round(bucket['mwSum'] / records, 3) if records else 0,
        'highMW': round(bucket['highMW'], 3) if bucket['highMW'] is not None else 0,
        'lowMW': round(bucket['lowMW'], 3) if bucket['lowMW'] is not None else 0,
        'records': records,
    }


def estimate_interval_hours(items, index):
    t = items[index][0]
    if index + 1 < len(items):
        nxt = items[index + 1][0]
        delta = (nxt - t).total_seconds() / 3600
        if 0 < delta <= 1:
            return delta
    if index > 0:
        prv = items[index - 1][0]
        delta = (t - prv).total_seconds() / 3600
        if 0 < delta <= 1:
            return delta
    return 0.5


def aggregate_day(rows):
    deduped = {}
    for row in rows:
        t = parse_time(row.get('periodStartUTC'))
        mw = parse_mw(row.get('generationMW'))
        fuel = row.get('fuelType', '')
        if not t or mw is None or not fuel:
            continue
        key = (t.isoformat(), fuel)
        deduped[key] = {'time': t, 'fuelType': fuel, 'technology': group_for(fuel), 'mw': mw}

    by_technology = defaultdict(list)
    for item in deduped.values():
        by_technology[item['technology']].append((item['time'], item['mw'], item['fuelType']))

    output = []
    for technology, items in by_technology.items():
        items.sort(key=lambda x: (x[0], x[2]))
        for i, (t, mw, fuel) in enumerate(items):
            hours = estimate_interval_hours(items, i)
            output.append({'time': t, 'technology': technology, 'fuelType': fuel, 'mw': mw, 'mwh': mw * hours, 'bucket': day_night_bucket(t)})
    return output, len(deduped)


def main():
    year = int(os.getenv('YEAR') or (sys.argv[1] if len(sys.argv) > 1 else dt.datetime.now(dt.timezone.utc).year))
    include_solar = os.getenv('INCLUDE_SOLAR', 'true').lower() not in ('0', 'false', 'no')
    current_year = dt.datetime.now(dt.timezone.utc).year
    current_date = dt.datetime.now(dt.timezone.utc).date()
    start_day = dt.date(year, 1, 1)
    end_day = dt.date(year, 12, 31)
    if year == current_year:
        end_day = min(end_day, current_date - dt.timedelta(days=1))
    if end_day < start_day:
        print(f'No complete days available for {year}')
        return

    monthly = defaultdict(lambda: {'totalMWh': 0.0, 'mwSum': 0.0, 'records': 0, 'highMW': None, 'lowMW': None})
    annual = defaultdict(lambda: {'totalMWh': 0.0, 'mwSum': 0.0, 'records': 0, 'highMW': None, 'lowMW': None})
    seasonal = defaultdict(lambda: {'totalMWh': 0.0, 'mwSum': 0.0, 'records': 0, 'highMW': None, 'lowMW': None})
    daynight = defaultdict(lambda: {'dayMWh': 0.0, 'nightMWh': 0.0, 'records': 0})

    raw_elexon = 0
    raw_solar = 0
    deduped_rows = 0
    failed_days = []
    solar_status = 'not requested'
    solar_url = ''

    day = start_day
    while day <= end_day:
        rows = []
        try:
            elexon = fetch_elexon_day(day)
            raw_elexon += len(elexon)
            rows.extend(elexon)
            print(f'{year} {day}: Elexon {len(elexon)} rows')
        except Exception as exc:
            failed_days.append(f'{day} Elexon {exc}')
            print(f'Warning {year} {day}: Elexon failed: {exc}')
        if include_solar:
            try:
                solar, status, url = fetch_pvlive_day(day)
                raw_solar += len(solar)
                rows.extend(solar)
                if url and not solar_url:
                    solar_url = url
                if solar:
                    solar_status = 'ok'
                elif solar_status != 'ok':
                    solar_status = status
                print(f'{year} {day}: PVLive solar {len(solar)} rows')
            except Exception as exc:
                failed_days.append(f'{day} PVLive {exc}')
                if solar_status != 'ok':
                    solar_status = str(exc)
        items, deduped = aggregate_day(rows)
        deduped_rows += deduped
        for item in items:
            t = item['time']
            tech = item['technology']
            month = t.month
            season = season_for_month(month)
            add_stats(monthly[(year, month, tech)], item['mw'], item['mwh'])
            add_stats(annual[(year, tech)], item['mw'], item['mwh'])
            add_stats(seasonal[(year, season, tech)], item['mw'], item['mwh'])
            dn = daynight[(year, month, season, tech)]
            if item['bucket'] == 'day':
                dn['dayMWh'] += item['mwh']
            else:
                dn['nightMWh'] += item['mwh']
            dn['records'] += 1
        day += dt.timedelta(days=1)

    monthly_rows = [finalise_stat_row({'year': y, 'month': m, 'season': season_for_month(m), 'technology': tech}, bucket) for (y, m, tech), bucket in monthly.items()]
    annual_rows = [finalise_stat_row({'year': y, 'technology': tech}, bucket) for (y, tech), bucket in annual.items()]
    seasonal_rows = [finalise_stat_row({'year': y, 'season': season, 'technology': tech}, bucket) for (y, season, tech), bucket in seasonal.items()]
    daynight_rows = []
    for (y, m, season, tech), bucket in daynight.items():
        total = bucket['dayMWh'] + bucket['nightMWh']
        daynight_rows.append({
            'year': y,
            'month': m,
            'season': season,
            'technology': tech,
            'dayMWh': round(bucket['dayMWh'], 3),
            'nightMWh': round(bucket['nightMWh'], 3),
            'totalMWh': round(total, 3),
            'daySharePercent': round((bucket['dayMWh'] / total) * 100, 3) if total else 0,
            'nightSharePercent': round((bucket['nightMWh'] / total) * 100, 3) if total else 0,
            'records': bucket['records'],
        })

    total_monthly = merge_rows(MONTHLY_JSON, monthly_rows, ['year', 'month', 'technology'], 'Monthly MWh by generation technology, with MW statistics')
    total_annual = merge_rows(ANNUAL_JSON, annual_rows, ['year', 'technology'], 'Annual MWh by generation technology')
    total_seasonal = merge_rows(SEASONAL_JSON, seasonal_rows, ['year', 'season', 'technology'], 'Seasonal MWh by generation technology')
    total_daynight = merge_rows(DAY_NIGHT_JSON, daynight_rows, ['year', 'month', 'technology'], 'Monthly day versus night MWh by generation technology')

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report = REPORT_DIR / f'GENERATION_AGGREGATE_BACKFILL_{year}.md'
    report.write_text('\n'.join([
        f'# Generation Aggregate Backfill {year}',
        '',
        f'Updated UTC: {utc_now()}',
        f'Year: {year}',
        f'Window: {start_day} to {end_day}',
        f'Elexon raw rows fetched: {raw_elexon}',
        f'PVLive raw solar rows fetched: {raw_solar}',
        f'Deduped timestamp plus fuel rows processed: {deduped_rows}',
        f'Monthly aggregate rows for this year: {len(monthly_rows)}',
        f'Annual aggregate rows for this year: {len(annual_rows)}',
        f'Seasonal aggregate rows for this year: {len(seasonal_rows)}',
        f'Day night aggregate rows for this year: {len(daynight_rows)}',
        f'Total monthly output rows after merge: {total_monthly}',
        f'Total annual output rows after merge: {total_annual}',
        f'Total seasonal output rows after merge: {total_seasonal}',
        f'Total day night output rows after merge: {total_daynight}',
        f'PVLive status: {solar_status}',
        f'PVLive working URL sample: {solar_url or "not confirmed"}',
        f'Failed days: {len(failed_days)}',
        'Day definition: 06:00 to 18:00 UTC. Night definition: 18:00 to 06:00 UTC.',
        'MWh method: MW multiplied by observed interval hours, inferred from adjacent timestamps and capped at 1 hour.',
        'Raw API rows are not committed by this aggregate workflow.',
        '',
        '## Failed day details',
        *failed_days[:200],
    ]) + '\n', encoding='utf-8')
    print(f'Wrote aggregate report {report}')


if __name__ == '__main__':
    main()
