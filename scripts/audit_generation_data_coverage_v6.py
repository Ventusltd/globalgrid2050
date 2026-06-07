import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path('data/generation')
OUT_DIR = Path('uk_energy_tracking_v6/generation_history')
REPORT_MD = OUT_DIR / 'GENERATION_DATA_COVERAGE_AUDIT.md'
REPORT_JSON = OUT_DIR / 'generation_data_coverage_audit.json'
DAILY_JSON = OUT_DIR / 'generation_history_daily_decade.json'
RECENT_JSON = OUT_DIR / 'generation_recent_halfhourly_30d.json'


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def file_info(path):
    return {
        'path': str(path),
        'exists': path.exists(),
        'sizeBytes': path.stat().st_size if path.exists() else 0,
    }


def csv_summary(path):
    info = file_info(path)
    info.update({
        'rows': 0,
        'minPeriodStartUTC': None,
        'maxPeriodStartUTC': None,
        'technologies': {},
        'sampleFirstDataRow': None,
    })
    if not path.exists() or path.stat().st_size == 0:
        return info
    try:
        with path.open('r', encoding='utf-8', newline='') as handle:
            reader = csv.DictReader(handle)
            counts = Counter()
            for row in reader:
                t = row.get('periodStartUTC') or row.get('priceTimeUTC') or ''
                fuel = row.get('fuelType') or row.get('technology') or 'UNKNOWN'
                if info['sampleFirstDataRow'] is None:
                    info['sampleFirstDataRow'] = {k: row.get(k, '') for k in list(row.keys())[:8]}
                if t:
                    if info['minPeriodStartUTC'] is None or t < info['minPeriodStartUTC']:
                        info['minPeriodStartUTC'] = t
                    if info['maxPeriodStartUTC'] is None or t > info['maxPeriodStartUTC']:
                        info['maxPeriodStartUTC'] = t
                counts[fuel] += 1
                info['rows'] += 1
            info['technologies'] = dict(sorted(counts.items()))
    except Exception as exc:
        info['error'] = str(exc)
    return info


def json_rows_summary(path, date_key):
    info = file_info(path)
    info.update({
        'rows': 0,
        'minDate': None,
        'maxDate': None,
        'technologies': {},
        'status': None,
    })
    if not path.exists() or path.stat().st_size == 0:
        return info
    try:
        payload = json.loads(path.read_text(encoding='utf-8'))
        rows = payload.get('rows', []) if isinstance(payload, dict) else []
        info['status'] = payload.get('status') if isinstance(payload, dict) else None
        counts = Counter()
        for row in rows:
            d = row.get(date_key) or row.get('date') or row.get('time') or ''
            tech = row.get('technology') or row.get('fuelType') or 'UNKNOWN'
            if d:
                if info['minDate'] is None or d < info['minDate']:
                    info['minDate'] = d
                if info['maxDate'] is None or d > info['maxDate']:
                    info['maxDate'] = d
            counts[tech] += 1
        info['rows'] = len(rows)
        info['technologies'] = dict(sorted(counts.items()))
    except Exception as exc:
        info['error'] = str(exc)
    return info


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    years = list(range(2016, 2027))
    annual = {str(year): csv_summary(DATA_DIR / f'elexon_generation_sources_{year}.csv') for year in years}
    master = csv_summary(DATA_DIR / 'elexon_generation_sources_half_hourly.csv')
    daily = json_rows_summary(DAILY_JSON, 'date')
    recent = json_rows_summary(RECENT_JSON, 'time')

    audit = {
        'generatedUTC': utc_now(),
        'annualFiles': annual,
        'masterHalfHourly': master,
        'dailyDecadeJson': daily,
        'recentHalfHourlyJson': recent,
    }
    REPORT_JSON.write_text(json.dumps(audit, indent=2), encoding='utf-8')

    lines = []
    lines.append('# Generation Data Coverage Audit V6')
    lines.append('')
    lines.append(f'Generated UTC: {audit["generatedUTC"]}')
    lines.append('')
    lines.append('## Annual CSV files')
    lines.append('')
    lines.append('| Year | Exists | Size MB | Rows | Min UTC | Max UTC | Technology count |')
    lines.append('| --- | --- | ---: | ---: | --- | --- | ---: |')
    for year in years:
        item = annual[str(year)]
        lines.append('| {year} | {exists} | {size:.2f} | {rows} | {mn} | {mx} | {tc} |'.format(
            year=year,
            exists='yes' if item['exists'] else 'no',
            size=item['sizeBytes'] / 1024 / 1024,
            rows=item['rows'],
            mn=item['minPeriodStartUTC'] or '',
            mx=item['maxPeriodStartUTC'] or '',
            tc=len(item['technologies']),
        ))
    lines.append('')
    lines.append('## Master and browser files')
    lines.append('')
    lines.append('| File | Size MB | Rows | Min | Max | Status |')
    lines.append('| --- | ---: | ---: | --- | --- | --- |')
    lines.append('| master half hourly csv | {:.2f} | {} | {} | {} | {} |'.format(master['sizeBytes']/1024/1024, master['rows'], master['minPeriodStartUTC'] or '', master['maxPeriodStartUTC'] or '', master.get('error','')))
    lines.append('| daily decade json | {:.2f} | {} | {} | {} | {} |'.format(daily['sizeBytes']/1024/1024, daily['rows'], daily['minDate'] or '', daily['maxDate'] or '', daily.get('status') or daily.get('error','')))
    lines.append('| recent half hourly json | {:.2f} | {} | {} | {} | {} |'.format(recent['sizeBytes']/1024/1024, recent['rows'], recent['minDate'] or '', recent['maxDate'] or '', recent.get('status') or recent.get('error','')))
    lines.append('')
    lines.append('## Interpretation')
    lines.append('')
    missing = [str(y) for y in years if not annual[str(y)]['exists'] or annual[str(y)]['rows'] == 0]
    if missing:
        lines.append('Missing or empty annual years: ' + ', '.join(missing))
    else:
        lines.append('All annual files from 2016 to 2026 contain rows.')
    if recent['rows'] == 0:
        lines.append('Recent half hourly slice is empty. Short windows will show no data until this file is populated.')
    if daily['rows'] == 0:
        lines.append('Daily aggregate is empty. Long windows will show no data.')
    lines.append('')
    REPORT_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Wrote {REPORT_MD}')
    print(f'Wrote {REPORT_JSON}')


if __name__ == '__main__':
    main()
