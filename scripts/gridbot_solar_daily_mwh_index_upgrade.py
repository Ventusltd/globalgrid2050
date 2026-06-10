#!/usr/bin/env python3
from __future__ import annotations

import argparse, hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'uk_energy_tracking_v6/generation_history/index.md'
RENDER = ROOT / 'uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js'
CONTROL = ROOT / 'uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js'
SOLAR = ROOT / 'uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json'
FUELHH_DAILY = ROOT / 'data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json'
REPORT = ROOT / 'data_science_protocol/audit_reports/SOLAR_DAILY_MWH_CHART_UPGRADE_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol/audit_reports/json/SOLAR_DAILY_MWH_CHART_UPGRADE_LATEST.json'

STYLE = '''\n  #generation-history-panel .solar-daily-mwh-panel{margin:18px 0 0;padding:14px;border:1px solid rgba(0,255,255,.30);border-radius:10px;background:rgba(0,255,255,.035);}\n  #generation-history-panel #solar-daily-mwh-canvas{height:min(58dvh,540px)!important;min-height:360px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:6px;}\n'''
PANEL = '''\n        <div class="solar-daily-mwh-panel" id="solar-daily-mwh-panel">\n          <div class="generation-study-summary"><strong>Daily energy output</strong> This chart shows daily MWh by selected technology. Solar uses stored Sheffield Solar PVLive daily MWh. Non Solar technologies use derived daily MWh from Elexon FUELHH daily average MW and half hourly sample count.</div>\n          <div id="solar-daily-mwh-status" class="price-history-range-status">Daily MWh chart awaiting technology selection.</div>\n          <canvas id="solar-daily-mwh-canvas" width="900" height="520"></canvas>\n        </div>\n'''
SCRIPTS = '''\n<script src="/uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js?v=20260610allmwh1"></script>\n<script src="/uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js?v=20260610allmwh1"></script>\n'''

def sha(text): return hashlib.sha256(text.encode()).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def row_mwh(row, tech):
    if tech == 'Solar':
        try: return float(row.get('mwh'))
        except Exception: return None
    try:
        return float(row.get('averageMW')) * float(row.get('sampleCount')) * 0.5
    except Exception:
        return None

def annual_or_all_peak(rows, tech):
    best = None
    for row in rows:
        if row.get('technology') != tech: continue
        v = row_mwh(row, tech)
        if v is None: continue
        if best is None or v > best['mwh']:
            best = {'date': row.get('date'), 'technology': tech, 'mwh': round(v, 3), 'averageMW': row.get('averageMW'), 'sampleCount': row.get('sampleCount'), 'method': 'stored PVLive mwh' if tech == 'Solar' else 'averageMW x sampleCount x 0.5'}
    return best

def technology_audit():
    out = {}
    solar_rows = load(SOLAR).get('rows', []) if SOLAR.exists() else []
    fuel_rows = load(FUELHH_DAILY).get('rows', []) if FUELHH_DAILY.exists() else []
    techs = sorted({r.get('technology') for r in fuel_rows if isinstance(r, dict) and r.get('technology')})
    if solar_rows: techs = ['Solar'] + [t for t in techs if t != 'Solar']
    for tech in techs:
        rows = solar_rows if tech == 'Solar' else fuel_rows
        count = 0
        missing = 0
        for r in rows:
            if tech != 'Solar' and r.get('technology') != tech: continue
            if row_mwh(r, tech) is None: missing += 1
            else: count += 1
        out[tech] = {'dailyMwhRowsAvailable': count, 'dailyMwhRowsMissingOrInvalid': missing, 'peakDailyMwh': annual_or_all_peak(rows, tech)}
    return out

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
    tech_audit = technology_audit()
    checks = {
        'index_exists': INDEX.exists(),
        'renderer_exists': RENDER.exists(),
        'controller_exists': CONTROL.exists(),
        'solar_data_exists': SOLAR.exists(),
        'fuelhh_daily_spine_exists': FUELHH_DAILY.exists(),
        'technologies_with_daily_mwh_available': len([k for k,v in tech_audit.items() if v['dailyMwhRowsAvailable'] > 0]),
        'panel_present_after_patch': 'solar-daily-mwh-canvas' in new,
        'script_refs_present_after_patch': 'render_solar_daily_mwh_chart.js' in new and 'control_solar_daily_mwh_chart.js' in new,
        'mw_chart_canvas_preserved': 'generation-history-canvas' in new,
        'controller_derives_non_solar_mwh': 'averageMW' in CONTROL.read_text(encoding='utf-8') and 'sampleCount' in CONTROL.read_text(encoding='utf-8')
    }
    passed = all(v if isinstance(v, bool) else v > 0 for v in checks.values())
    if args.apply and passed:
        INDEX.write_text(new, encoding='utf-8')
    report = {
        'mode': 'apply' if args.apply else 'audit',
        'purpose': 'Add third daily MWh chart for all generation sources available in the repo. Solar uses stored PVLive mwh. Non Solar technologies use derived MWh from Elexon FUELHH daily average MW and half hourly sample count.',
        'technologyAudit': tech_audit,
        'checks': checks,
        'wouldUpdate': 'uk_energy_tracking_v6/generation_history/index.md',
        'indexOldSha256': sha(old),
        'indexNewSha256': sha(new),
        'applied': bool(args.apply and passed),
        'pass': passed
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True); REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Daily MWh Chart Upgrade For All Technologies\n\n```json\n' + json.dumps(report, indent=2) + '\n```\n', encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if passed else 1

if __name__ == '__main__': raise SystemExit(main())
