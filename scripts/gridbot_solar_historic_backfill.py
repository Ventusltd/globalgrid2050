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
CANDIDATE = ROOT / 'data' / 'confirmed' / 'pvlive_solar_daily_candidate.json'
BROWSER = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'pvlive_solar_daily_browser.json'
REPORT = ROOT / 'data_science_protocol' / 'audit_reports' / 'SOLAR_HISTORIC_BACKFILL_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol' / 'audit_reports' / 'json' / 'SOLAR_HISTORIC_BACKFILL_LATEST.json'
API = 'https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0'
SOURCE = 'Sheffield Solar PVLive'
ATTRIBUTION = 'Sheffield Solar PVLive, solar.sheffield.ac.uk'


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={'User-Agent': 'GlobalGrid2050 GridBot'})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode('utf-8'))


def rows_from(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ('data', 'results', 'items'):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def parse_float(value):
    try:
        return float(value)
    except Exception:
        return None


def parse_mw(row):
    if isinstance(row, list) and len(row) >= 3:
        return parse_float(row[2])
    if isinstance(row, dict):
        return parse_float(row.get('generation_mw') or row.get('generationMW') or row.get('generation') or row.get('power'))
    return None


def fetch_day(day: dt.date):
    start = dt.datetime.combine(day, dt.time(0, 0), tzinfo=dt.timezone.utc)
    end = dt.datetime.combine(day, dt.time(23, 59), tzinfo=dt.timezone.utc)
    url = API + '?' + urllib.parse.urlencode({'start': start.isoformat().replace('+00:00', 'Z'), 'end': end.isoformat().replace('+00:00', 'Z')})
    values = []
    for raw in rows_from(fetch_json(url)):
        mw = parse_mw(raw)
        if mw is not None:
            values.append(mw)
    return values, url


def load_existing(path: Path):
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding='utf-8'))
        return {row['date']: row for row in payload.get('rows', []) if isinstance(row, dict) and row.get('date')}
    except Exception:
        return {}


def write_report(payload):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Solar Historic Backfill Report\n\n```json\n' + json.dumps(payload, indent=2) + '\n```\n', encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--start-date', default='2016-01-01')
    parser.add_argument('--end-date', default='')
    parser.add_argument('--max-days', type=int, default=31)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    start = dt.date.fromisoformat(args.start_date)
    end = dt.date.fromisoformat(args.end_date) if args.end_date else dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)
    if end < start:
        end = start
    days = []
    d = start
    while d <= end and len(days) < args.max_days:
        days.append(d)
        d += dt.timedelta(days=1)
    existing = load_existing(CANDIDATE)
    fetched = 0
    failures = []
    last_url = ''
    for day in days:
        try:
            values, url = fetch_day(day)
            last_url = url
            if values:
                fetched += 1
                existing[day.isoformat()] = {
                    'date': day.isoformat(),
                    'technology': 'Solar',
                    'averageMW': round(sum(values) / len(values), 3),
                    'highMW': round(max(values), 3),
                    'lowMW': round(min(values), 3),
                    'sampleCount': len(values),
                    'source': SOURCE,
                    'sourceAttribution': ATTRIBUTION,
                    'methodState': 'PVLIVE EMBEDDED ESTIMATE',
                    'status': 'candidate'
                }
            else:
                failures.append({'date': day.isoformat(), 'error': 'no values'})
        except Exception as exc:
            failures.append({'date': day.isoformat(), 'error': str(exc)[:200]})
    rows = [existing[k] for k in sorted(existing)]
    candidate_payload = {
        'schemaVersion': '0.2.0-pvlive-solar-daily-candidate',
        'generatedUTC': utc_now(),
        'title': 'PVLive solar daily MW candidate',
        'timezone': 'UTC',
        'source': SOURCE,
        'sourceAttribution': ATTRIBUTION,
        'sourceNote': 'Solar generation is estimated from Sheffield Solar PVLive. It is not Elexon FUELHH transmission metered solar.',
        'methodState': 'PVLIVE EMBEDDED ESTIMATE',
        'rows': rows
    }
    browser_rows = [{k: row[k] for k in ('date', 'technology', 'averageMW', 'highMW', 'lowMW', 'sampleCount', 'source', 'sourceAttribution', 'methodState', 'status') if k in row} for row in rows]
    browser_payload = {
        'schemaVersion': '0.2.0-pvlive-solar-daily-browser',
        'generatedUTC': utc_now(),
        'title': 'PVLive solar daily browser file',
        'timezone': 'UTC',
        'source': SOURCE,
        'sourceAttribution': ATTRIBUTION,
        'sourceNote': 'Solar generation is estimated from Sheffield Solar PVLive. It is not Elexon FUELHH transmission metered solar.',
        'methodState': 'PVLIVE EMBEDDED ESTIMATE',
        'rows': browser_rows
    }
    ctext = json.dumps(candidate_payload, separators=(',', ':'), ensure_ascii=False)
    btext = json.dumps(browser_payload, separators=(',', ':'), ensure_ascii=False)
    passed = fetched > 0 and len(failures) == 0 and len(btext.encode('utf-8')) < 3000000
    if args.apply and passed:
        CANDIDATE.write_text(ctext, encoding='utf-8')
        BROWSER.write_text(btext, encoding='utf-8')
    report = {
        'mode': 'apply' if args.apply else 'audit',
        'startDate': start.isoformat(),
        'requestedEndDate': end.isoformat(),
        'daysAttempted': len(days),
        'daysFetched': fetched,
        'candidateRowsAfterMerge': len(rows),
        'browserRowsAfterMerge': len(browser_rows),
        'candidateBytes': len(ctext.encode('utf-8')),
        'browserBytes': len(btext.encode('utf-8')),
        'candidateSha256': hashlib.sha256(ctext.encode('utf-8')).hexdigest(),
        'browserSha256': hashlib.sha256(btext.encode('utf-8')).hexdigest(),
        'lastUrl': last_url,
        'failures': failures[:20],
        'applied': bool(args.apply and passed),
        'pass': passed
    }
    write_report(report)
    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
