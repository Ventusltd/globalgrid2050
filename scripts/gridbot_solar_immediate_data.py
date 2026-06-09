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
OUT = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'pvlive_solar_recent_30d_30min_browser.json'
REPORT = ROOT / 'data_science_protocol' / 'audit_reports' / 'SOLAR_IMMEDIATE_DATA_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol' / 'audit_reports' / 'json' / 'SOLAR_IMMEDIATE_DATA_LATEST.json'
API = 'https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0'
SOURCE = 'Sheffield Solar PVLive'
ATTRIBUTION = 'Sheffield Solar PVLive, solar.sheffield.ac.uk'


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


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


def iso_z(value) -> str:
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc).isoformat().replace('+00:00', 'Z')
    except Exception:
        return ''


def parse_row(row):
    if isinstance(row, list) and len(row) >= 3:
        timestamp = row[1]
        generation = row[2]
    elif isinstance(row, dict):
        timestamp = row.get('datetime_gmt') or row.get('datetime') or row.get('time') or row.get('timestamp') or row.get('periodStartUTC')
        generation = row.get('generation_mw') or row.get('generationMW') or row.get('generation') or row.get('power')
    else:
        return None
    try:
        mw = round(float(generation), 3)
    except Exception:
        return None
    timestamp_utc = iso_z(timestamp)
    if not timestamp_utc:
        return None
    return {
        'time': timestamp_utc,
        'technology': 'Solar',
        'generationMW': mw,
        'source': SOURCE,
        'sourceAttribution': ATTRIBUTION,
        'methodState': 'PVLIVE EMBEDDED ESTIMATE',
        'status': 'candidate'
    }


def build(days: int):
    end = now_utc()
    start = dt.datetime.combine(end.date() - dt.timedelta(days=days - 1), dt.time(0, 0), tzinfo=dt.timezone.utc)
    url = API + '?' + urllib.parse.urlencode({'start': start.isoformat().replace('+00:00', 'Z'), 'end': end.isoformat().replace('+00:00', 'Z')})
    parsed = [row for row in (parse_row(raw) for raw in rows_from(fetch_json(url))) if row]
    by_key = {(row['time'], row['technology']): row for row in parsed}
    rows = [by_key[key] for key in sorted(by_key)]
    return rows, url, start, end


def write_report(payload):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Solar Immediate Data Report\n\n```json\n' + json.dumps(payload, indent=2) + '\n```\n', encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--days', type=int, default=30)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    rows, url, start, end = build(args.days)
    today = end.date().isoformat()
    today_rows = [row for row in rows if row['time'].startswith(today)]
    payload = {
        'schemaVersion': '0.3.0-pvlive-solar-recent-30min-browser',
        'title': 'PVLive solar recent 30 minute browser file',
        'generatedUTC': now_utc().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'timezone': 'UTC',
        'source': SOURCE,
        'sourceAttribution': ATTRIBUTION,
        'sourceNote': 'Solar generation is estimated from Sheffield Solar PVLive. It is not Elexon FUELHH transmission metered solar.',
        'methodState': 'PVLIVE EMBEDDED ESTIMATE',
        'rows': rows
    }
    text = json.dumps(payload, separators=(',', ':'), ensure_ascii=False)
    byte_count = len(text.encode('utf-8'))
    passed = len(rows) > 0 and len(today_rows) > 0 and byte_count < 900000
    if args.apply and passed:
        OUT.write_text(text, encoding='utf-8')
    report = {
        'mode': 'apply' if args.apply else 'audit',
        'outputPath': str(OUT.relative_to(ROOT)),
        'source': SOURCE,
        'sourceAttribution': ATTRIBUTION,
        'rangeStart': start.isoformat().replace('+00:00', 'Z'),
        'rangeEnd': end.isoformat().replace('+00:00', 'Z'),
        'rows': len(rows),
        'todayRows': len(today_rows),
        'firstTime': rows[0]['time'] if rows else None,
        'lastTime': rows[-1]['time'] if rows else None,
        'estimatedBytes': byte_count,
        'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest(),
        'workingUrl': url,
        'applied': bool(args.apply and passed),
        'pass': passed
    }
    write_report(report)
    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
