#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DAILY_BROWSER = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'pvlive_solar_daily_browser.json'
DAILY_CANDIDATE = ROOT / 'data' / 'confirmed' / 'pvlive_solar_daily_candidate.json'
RECENT_BROWSER = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'pvlive_solar_recent_30d_30min_browser.json'
PROGRESS = ROOT / 'data' / 'confirmed' / 'pvlive_solar_daily_BACKFILL_PROGRESS.json'
REPORT = ROOT / 'data_science_protocol' / 'audit_reports' / 'SOLAR_PEAK_INTEGRITY_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol' / 'audit_reports' / 'json' / 'SOLAR_PEAK_INTEGRITY_LATEST.json'
API = 'https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0'
SOURCE = 'Sheffield Solar PVLive'


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        return {'_error': str(exc)}


def sha256_file(path: Path) -> str:
    if not path.exists():
        return ''
    return hashlib.sha256(path.read_bytes()).hexdigest()


def payload_rows(payload: dict) -> list:
    rows = payload.get('rows')
    return rows if isinstance(rows, list) else []


def as_float(value):
    try:
        return float(value)
    except Exception:
        return None


def month_start(value: str) -> dt.date:
    y, m = value.split('-')[:2]
    return dt.date(int(y), int(m), 1)


def next_month(value: dt.date) -> dt.date:
    return dt.date(value.year + 1, 1, 1) if value.month == 12 else dt.date(value.year, value.month + 1, 1)


def month_key(value: dt.date) -> str:
    return f'{value.year:04d}-{value.month:02d}'


def expected_months(start_month: str, end_month: str) -> list[str]:
    start = month_start(start_month)
    end = month_start(end_month)
    out = []
    d = start
    while d <= end:
        out.append(month_key(d))
        d = next_month(d)
    return out


def month_expected_days(month: str) -> int:
    start = month_start(month)
    end = next_month(start)
    return (end - start).days


def parse_time(value) -> str:
    try:
        d = dt.datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc).isoformat().replace('+00:00', 'Z')
    except Exception:
        return ''


def row_time(row):
    if isinstance(row, list) and len(row) >= 2:
        return row[1]
    if isinstance(row, dict):
        return row.get('datetime_gmt') or row.get('datetime') or row.get('time') or row.get('timestamp') or row.get('periodStartUTC')
    return ''


def row_mw(row):
    if isinstance(row, list) and len(row) >= 3:
        return as_float(row[2])
    if isinstance(row, dict):
        return as_float(row.get('generation_mw') or row.get('generationMW') or row.get('generation') or row.get('power'))
    return None


def api_fetch_day(day: str) -> dict:
    d = dt.date.fromisoformat(day)
    start = dt.datetime.combine(d, dt.time(0, 0), tzinfo=dt.timezone.utc)
    end = dt.datetime.combine(d, dt.time(23, 59), tzinfo=dt.timezone.utc)
    url = API + '?' + urllib.parse.urlencode({'start': start.isoformat().replace('+00:00', 'Z'), 'end': end.isoformat().replace('+00:00', 'Z')})
    req = urllib.request.Request(url, headers={'User-Agent': 'GlobalGrid2050 GridBot Solar Peak Integrity Audit'})
    with urllib.request.urlopen(req, timeout=90) as response:
        payload = json.loads(response.read().decode('utf-8'))
    if isinstance(payload, dict):
        raw_rows = payload.get('data') or payload.get('results') or payload.get('items') or []
    elif isinstance(payload, list):
        raw_rows = payload
    else:
        raw_rows = []
    samples = []
    for raw in raw_rows:
        ts = parse_time(row_time(raw))
        mw = row_mw(raw)
        if ts and mw is not None:
            samples.append({'time': ts, 'mw': mw})
    if not samples:
        return {'date': day, 'url': url, 'sampleCount': 0, 'error': 'no valid samples'}
    high = max(samples, key=lambda x: x['mw'])
    low = min(samples, key=lambda x: x['mw'])
    total = sum(x['mw'] for x in samples)
    return {
        'date': day,
        'url': url,
        'sampleCount': len(samples),
        'averageMW': round(total / len(samples), 3),
        'highMW': round(high['mw'], 3),
        'highTimeUTC': high['time'],
        'lowMW': round(low['mw'], 3),
        'lowTimeUTC': low['time'],
        'mwh': round(total * 0.5, 3),
        'completeness': round(len(samples) / 48, 3)
    }


def daily_index(daily_rows: list) -> dict:
    return {r.get('date'): r for r in daily_rows if isinstance(r, dict) and r.get('date')}


def coverage(daily_rows: list, start_month: str, end_month: str) -> dict:
    by_year = {}
    by_month = {}
    bad_rows = 0
    for row in daily_rows:
        if not isinstance(row, dict):
            bad_rows += 1
            continue
        date = str(row.get('date', ''))
        if len(date) >= 7:
            by_year[date[:4]] = by_year.get(date[:4], 0) + 1
            by_month[date[:7]] = by_month.get(date[:7], 0) + 1
    expected = expected_months(start_month, end_month)
    month_table = []
    missing = []
    partial = []
    complete = []
    for month in expected:
        stored_days = by_month.get(month, 0)
        expected_days = month_expected_days(month)
        row = {'month': month, 'storedDays': stored_days, 'expectedDays': expected_days, 'state': 'complete' if stored_days >= expected_days else 'missing' if stored_days == 0 else 'partial'}
        month_table.append(row)
        if row['state'] == 'complete':
            complete.append(month)
        elif row['state'] == 'partial':
            partial.append(row)
        else:
            missing.append(month)
    return {
        'byYear': dict(sorted(by_year.items())),
        'monthTable': month_table,
        'completeMonths': complete,
        'partialMonths': partial,
        'missingMonths': missing,
        'badRows': bad_rows
    }


def top_daily_highs(daily_rows: list, limit: int):
    out = []
    for row in daily_rows:
        if not isinstance(row, dict):
            continue
        high = as_float(row.get('highMW'))
        if high is not None:
            out.append({
                'date': row.get('date'),
                'highMW': high,
                'averageMW': as_float(row.get('averageMW')),
                'lowMW': as_float(row.get('lowMW')),
                'mwh': as_float(row.get('mwh')),
                'sampleCount': row.get('sampleCount'),
                'completeness': row.get('completeness'),
                'source': row.get('source'),
                'methodState': row.get('methodState'),
                'status': row.get('status')
            })
    return sorted(out, key=lambda x: x['highMW'], reverse=True)[:limit]


def recent_peak(recent_rows: list):
    best = None
    for row in recent_rows:
        if not isinstance(row, dict):
            continue
        mw = as_float(row.get('generationMW') or row.get('mw') or row.get('value'))
        if mw is None:
            continue
        if best is None or mw > best['generationMW']:
            best = {'time': row.get('time'), 'generationMW': mw, 'technology': row.get('technology'), 'source': row.get('source')}
    return best


def field_integrity(daily_rows: list):
    required = ['date', 'technology', 'averageMW', 'highMW', 'lowMW', 'mwh', 'sampleCount', 'completeness', 'source', 'sourceAttribution', 'methodState', 'status']
    counts = {k: 0 for k in required}
    bad_numeric = []
    for row in daily_rows:
        if not isinstance(row, dict):
            continue
        for key in required:
            if row.get(key) not in (None, ''):
                counts[key] += 1
        for key in ['averageMW', 'highMW', 'lowMW', 'mwh', 'sampleCount', 'completeness']:
            if row.get(key) not in (None, '') and as_float(row.get(key)) is None:
                bad_numeric.append({'date': row.get('date'), 'field': key, 'value': row.get(key)})
    return {'requiredFieldCounts': counts, 'badNumericSamples': bad_numeric[:50]}


def compare_day(stored, fetched):
    if not stored:
        return {'presentInStored': False, 'fetched': fetched}
    comparison = {}
    for key in ['averageMW', 'highMW', 'lowMW', 'mwh', 'sampleCount', 'completeness']:
        sv = as_float(stored.get(key))
        fv = as_float(fetched.get(key))
        comparison[key] = {'stored': sv, 'fetched': fv, 'delta': None if sv is None or fv is None else round(sv - fv, 3)}
    return {'presentInStored': True, 'stored': stored, 'fetched': fetched, 'comparison': comparison}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--start-month', default='2016-01')
    parser.add_argument('--end-month', default='')
    parser.add_argument('--dates', default='2026-04-23,2026-05-24')
    parser.add_argument('--top-n', type=int, default=20)
    parser.add_argument('--fetch-live', action='store_true')
    args = parser.parse_args()
    if args.end_month:
        end_month = args.end_month
    else:
        today = dt.datetime.now(dt.timezone.utc).date()
        end_month = f'{today.year:04d}-{today.month:02d}'

    daily_browser = load_json(DAILY_BROWSER)
    daily_candidate = load_json(DAILY_CANDIDATE)
    recent_browser = load_json(RECENT_BROWSER)
    progress = load_json(PROGRESS)
    browser_rows = payload_rows(daily_browser)
    candidate_rows = payload_rows(daily_candidate)
    recent_rows = payload_rows(recent_browser)
    idx = daily_index(browser_rows)
    requested_dates = [x.strip() for x in args.dates.split(',') if x.strip()]
    date_checks = {}
    for day in requested_dates:
        if args.fetch_live:
            try:
                date_checks[day] = compare_day(idx.get(day), api_fetch_day(day))
            except Exception as exc:
                date_checks[day] = {'error': str(exc)[:300], 'presentInStored': day in idx}
        else:
            date_checks[day] = {'presentInStored': day in idx, 'stored': idx.get(day), 'liveFetchSkipped': True}

    top_highs = top_daily_highs(browser_rows, args.top_n)
    max_high = top_highs[0] if top_highs else None
    cov = coverage(browser_rows, args.start_month, end_month)
    integrity = field_integrity(browser_rows)
    complete_months_in_progress = progress.get('completeMonths') if isinstance(progress.get('completeMonths'), list) else []
    report = {
        'generatedUTC': utc_now(),
        'purpose': 'Read only integrity audit of stored Sheffield Solar PVLive daily and recent Solar output numbers from 2016 to present.',
        'sourceExpected': SOURCE,
        'targetCoverage': {'startMonth': args.start_month, 'endMonth': end_month, 'targetFields': ['highMW', 'averageMW', 'lowMW', 'mwh', 'sampleCount', 'completeness']},
        'files': {
            'dailyBrowser': {'path': str(DAILY_BROWSER.relative_to(ROOT)), 'exists': DAILY_BROWSER.exists(), 'sha256': sha256_file(DAILY_BROWSER), 'rows': len(browser_rows), 'schemaVersion': daily_browser.get('schemaVersion'), 'generatedUTC': daily_browser.get('generatedUTC')},
            'dailyCandidate': {'path': str(DAILY_CANDIDATE.relative_to(ROOT)), 'exists': DAILY_CANDIDATE.exists(), 'sha256': sha256_file(DAILY_CANDIDATE), 'rows': len(candidate_rows), 'schemaVersion': daily_candidate.get('schemaVersion'), 'generatedUTC': daily_candidate.get('generatedUTC')},
            'recentBrowser': {'path': str(RECENT_BROWSER.relative_to(ROOT)), 'exists': RECENT_BROWSER.exists(), 'sha256': sha256_file(RECENT_BROWSER), 'rows': len(recent_rows), 'schemaVersion': recent_browser.get('schemaVersion'), 'generatedUTC': recent_browser.get('generatedUTC')},
            'progress': {'path': str(PROGRESS.relative_to(ROOT)), 'exists': PROGRESS.exists(), 'sha256': sha256_file(PROGRESS), 'completeMonths': complete_months_in_progress, 'failedMonths': progress.get('failedMonths')}
        },
        'coverage': cov,
        'fieldIntegrity': integrity,
        'progressVsStored': {
            'completeMonthsInProgress': complete_months_in_progress,
            'completeMonthsInStoredRows': cov['completeMonths'],
            'progressMonthsMissingFromStoredRows': [m for m in complete_months_in_progress if m not in cov['completeMonths']],
            'storedMonthsMissingFromProgress': [m for m in cov['completeMonths'] if m not in complete_months_in_progress]
        },
        'maxStoredDailyHighMW': max_high,
        'topStoredDailyHighs': top_highs,
        'recentHalfHourlyPeak': recent_peak(recent_rows),
        'dateChecks': date_checks,
        'integrityFlags': {
            'has20260423': '2026-04-23' in idx,
            'has20260524': '2026-05-24' in idx,
            'hasHighMW': integrity['requiredFieldCounts'].get('highMW', 0) == len(browser_rows) if browser_rows else False,
            'hasAverageMW': integrity['requiredFieldCounts'].get('averageMW', 0) == len(browser_rows) if browser_rows else False,
            'hasLowMW': integrity['requiredFieldCounts'].get('lowMW', 0) == len(browser_rows) if browser_rows else False,
            'hasMwh': integrity['requiredFieldCounts'].get('mwh', 0) == len(browser_rows) if browser_rows else False,
            'missingMonthCount': len(cov['missingMonths']),
            'partialMonthCount': len(cov['partialMonths'])
        },
        'decisionRule': 'Fill missing months before using Solar peak UI as authoritative. Do not claim a 2016 to present Solar series unless coverage shows complete or justified partial months.',
        'pass': bool(browser_rows and top_highs)
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Solar Peak Integrity Audit\n\n```json\n' + json.dumps(report, indent=2) + '\n```\n', encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if report['pass'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
