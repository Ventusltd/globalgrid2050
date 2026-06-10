#!/usr/bin/env python3
from __future__ import annotations

import argparse, hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'uk_energy_tracking_v6/generation_history/index.md'
RENDER = ROOT / 'uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js'
CONTROL = ROOT / 'uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js'
SOLAR = ROOT / 'uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json'
REPORT = ROOT / 'data_science_protocol/audit_reports/SOLAR_DAILY_MWH_CHART_UPGRADE_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol/audit_reports/json/SOLAR_DAILY_MWH_CHART_UPGRADE_LATEST.json'

STYLE = '''\n  #generation-history-panel .solar-daily-mwh-panel{margin:18px 0 0;padding:14px;border:1px solid rgba(0,255,255,.30);border-radius:10px;background:rgba(0,255,255,.035);}\n  #generation-history-panel #solar-daily-mwh-canvas{height:min(58dvh,540px)!important;min-height:360px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:6px;}\n'''
PANEL = '''\n        <div class="solar-daily-mwh-panel" id="solar-daily-mwh-panel">\n          <div class="generation-study-summary"><strong>Solar daily energy output</strong> This chart uses Sheffield Solar PVLive daily MWh to show the total Solar energy generated across each full day. The highest full day currently recorded in this dataset is 30 Apr 2026.</div>\n          <div id="solar-daily-mwh-status" class="price-history-range-status">Solar daily MWh chart awaiting Solar selection.</div>\n          <canvas id="solar-daily-mwh-canvas" width="900" height="520"></canvas>\n        </div>\n'''
SCRIPTS = '''\n<script src="/uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js?v=20260610solarmwh2"></script>\n<script src="/uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js?v=20260610solarmwh2"></script>\n'''

def sha(text): return hashlib.sha256(text.encode()).hexdigest()

def solar_peak_mwh():
    data = json.loads(SOLAR.read_text(encoding='utf-8'))
    best = None
    rows = data.get('rows', [])
    mwh_rows = 0
    missing = 0
    for row in rows:
        try:
            v = float(row.get('mwh'))
            mwh_rows += 1
        except Exception:
            missing += 1
            continue
        if best is None or v > best['mwh']:
            best = {'date': row.get('date'), 'mwh': round(v, 3), 'highMW': row.get('highMW'), 'averageMW': row.get('averageMW'), 'source': row.get('source'), 'sourceAttribution': row.get('sourceAttribution'), 'methodState': row.get('methodState')}
    return {'rowCount': len(rows), 'mwhRowsAvailable': mwh_rows, 'mwhRowsMissingOrInvalid': missing, 'peakDailyMwh': best}

def patch(text):
    out = text
    if '.solar-daily-mwh-panel' not in out:
        out = out.replace('</style>', STYLE + '</style>')
    if 'id="solar-daily-mwh-panel"' not in out:
        out = out.replace('        <div class="generation-source-warning"', PANEL + '\n        <div class="generation-source-warning"')
    if 'render_solar_daily_mwh_chart.js' not in out:
        out = out + SCRIPTS
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--apply', action='store_true'); args = ap.parse_args()
    old = INDEX.read_text(encoding='utf-8'); new = patch(old)
    solar_audit = solar_peak_mwh()
    control_text = CONTROL.read_text(encoding='utf-8') if CONTROL.exists() else ''
    checks = {
        'index_exists': INDEX.exists(),
        'renderer_exists': RENDER.exists(),
        'controller_exists': CONTROL.exists(),
        'solar_data_exists': SOLAR.exists(),
        'solar_data_has_stored_mwh': solar_audit['mwhRowsAvailable'] > 0,
        'solar_peak_mwh_found': solar_audit['peakDailyMwh'] is not None,
        'panel_present_after_patch': 'solar-daily-mwh-canvas' in new,
        'script_refs_present_after_patch': 'render_solar_daily_mwh_chart.js' in new and 'control_solar_daily_mwh_chart.js' in new,
        'mw_chart_canvas_preserved': 'generation-history-canvas' in new,
        'controller_is_solar_only': 'loadFuelhhDaily' not in control_text and 'sampleCount' not in control_text and "tech!=='Solar'" in control_text
    }
    passed = all(checks.values())
    if args.apply and passed:
        INDEX.write_text(new, encoding='utf-8')
    report = {
        'mode': 'apply' if args.apply else 'audit',
        'purpose': 'Add third Solar daily MWh chart below the existing MW chart using stored Sheffield Solar PVLive daily mwh data only.',
        'solarAudit': solar_audit,
        'checks': checks,
        'wouldUpdate': 'uk_energy_tracking_v6/generation_history/index.md',
        'indexOldSha256': sha(old),
        'indexNewSha256': sha(new),
        'applied': bool(args.apply and passed),
        'pass': passed
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True); REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Solar Daily MWh Chart Upgrade\n\n```json\n' + json.dumps(report, indent=2) + '\n```\n', encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if passed else 1

if __name__ == '__main__': raise SystemExit(main())
