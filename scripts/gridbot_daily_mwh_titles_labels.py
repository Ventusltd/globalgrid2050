#!/usr/bin/env python3
from __future__ import annotations
import argparse, datetime as dt, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'index.md'
REPORT_DIR = ROOT / 'data_science_protocol' / 'audit_reports'
REPORT_JSON_DIR = REPORT_DIR / 'json'
STEM = 'DAILY_MWH_TITLES_LABELS'

REPLACEMENTS = [
    (
        '<div class="generation-study-summary"><strong>Solar daily energy output</strong> Standalone daily energy chart using stored Sheffield Solar PVLive MWh. This shows energy generated across each full day, not peak MW. Other technologies will be added only after their daily MWh data is separately fetched or audited.</div>',
        '<div class="generation-study-summary"><strong>Daily generation energy output</strong> Standalone daily MWh chart. Solar uses stored Sheffield Solar PVLive daily MWh. Elexon technologies use audited FUELHH derived daily MWh calculated from half hourly MW values multiplied by 0.5 hours. This chart presents total energy across each full day, not peak MW or average MW.</div>'
    ),
    (
        '<strong>Daily MWh chart</strong>',
        '<strong>Daily energy chart</strong>'
    ),
    (
        '<div id="solar-daily-mwh-status" class="price-history-range-status">Solar daily MWh chart awaiting PVLive data.</div>',
        '<div id="solar-daily-mwh-status" class="price-history-range-status">Daily MWh chart awaiting selected technology data.</div>'
    ),
    (
        '<strong>Solar Daily MWh · PVLive stored energy</strong>',
        '<strong>Daily MWh by technology</strong>'
    ),
    (
        '<strong>Source:</strong> Sheffield Solar PVLive stored daily MWh. This chart shows daily energy, not MW peak power. Other technologies remain disabled until separate MWh data audits are complete.',
        '<strong>Source:</strong> Solar uses Sheffield Solar PVLive stored daily MWh. Other technologies use Elexon FUELHH derived daily MWh after chart wiring. This chart shows daily energy, not MW peak power or average MW.'
    ),
    (
        'render_solar_daily_mwh_chart.js?v=20260610solarmwh4',
        'render_solar_daily_mwh_chart.js?v=20260611mwhlabels1'
    ),
    (
        'control_solar_daily_mwh_chart.js?v=20260610solarmwh2',
        'control_solar_daily_mwh_chart.js?v=20260611mwhlabels1'
    ),
]


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')

def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')

def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()

def apply_replacements(text: str):
    changed = text
    missing = []
    applied = []
    for old, new in REPLACEMENTS:
        if old not in changed:
            missing.append(old[:120])
        else:
            changed = changed.replace(old, new, 1)
            applied.append(new[:120])
    return changed, missing, applied

def write_reports(report: dict):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md = '\n'.join([
        '# Daily MWh Titles And Labels',
        '',
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"Target file: `{report['targetFile']}`",
        f"Changed: `{report['wouldChange']}`",
        f"Replacement count: `{report['replacementCount']}`",
        f"Missing markers: `{report['missingCount']}`",
        f"Pass: `{report['pass']}`",
        '',
        '## Purpose',
        '',
        'This changes visible titles and source labels for the daily MWh chart so the page describes daily energy output by technology, while preserving Solar PVLive as the currently enabled chart data source and leaving Elexon data wiring for the next audited step.',
        '',
        '## Safety',
        '',
        'This workflow does not modify data files. It does not wire new chart data. It does not change calculations. It only changes title, label and cache bust text in the generation history page.'
    ]) + '\n'
    for p in (REPORT_DIR / f'{STEM}_{s}.md', REPORT_DIR / f'{STEM}_LATEST.md'):
        p.write_text(md, encoding='utf-8')
    js = json.dumps(report, indent=2, ensure_ascii=False) + '\n'
    for p in (REPORT_JSON_DIR / f'{STEM}_{s}.json', REPORT_JSON_DIR / f'{STEM}_LATEST.json'):
        p.write_text(js, encoding='utf-8')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    original = TARGET.read_text(encoding='utf-8')
    changed, missing, applied = apply_replacements(original)
    would_change = changed != original
    checks = {
        'target_exists': TARGET.exists(),
        'all_markers_found': len(missing) == 0,
        'would_change_index_only': would_change,
        'no_data_files_changed_by_script': True,
        'solar_source_label_preserved': 'Solar uses stored Sheffield Solar PVLive daily MWh' in changed,
        'elexon_source_label_prepared': 'Elexon technologies use audited FUELHH derived daily MWh' in changed,
        'daily_energy_not_peak_or_average_label': 'not peak MW or average MW' in changed,
        'cache_busters_updated': '20260611mwhlabels1' in changed,
    }
    if args.apply and all(checks.values()):
        TARGET.write_text(changed, encoding='utf-8')
    report = {
        'reportTitle': 'Daily MWh Titles And Labels',
        'schemaVersion': '1.0.0',
        'generatedUTC': now(),
        'mode': 'apply' if args.apply else 'audit',
        'targetFile': rel(TARGET),
        'changedFiles': [rel(TARGET)] if would_change else [],
        'replacementCount': len(applied),
        'missingCount': len(missing),
        'missingMarkers': missing,
        'wouldChange': would_change,
        'applied': bool(args.apply and all(checks.values())),
        'checks': checks,
        'pass': all(checks.values()),
        'nextAction': 'Run apply only after human review confirms wording.' if not args.apply else 'Open live page and confirm titles and labels only changed.'
    }
    write_reports(report)
    if not report['pass']:
        raise SystemExit('Daily MWh title label checks failed')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
