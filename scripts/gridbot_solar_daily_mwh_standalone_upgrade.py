#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'uk_energy_tracking_v6/generation_history/index.md'
CONTROL = ROOT / 'uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js'
RENDER = ROOT / 'uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js'
SOLAR = ROOT / 'uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json'
REPORT = ROOT / 'data_science_protocol/audit_reports/SOLAR_DAILY_MWH_STANDALONE_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol/audit_reports/json/SOLAR_DAILY_MWH_STANDALONE_LATEST.json'

OLD_STYLE = """  #generation-history-panel .solar-daily-mwh-panel{margin:18px 0 0;padding:14px;border:1px solid rgba(0,255,255,.30);border-radius:10px;background:rgba(0,255,255,.035);}\n  #generation-history-panel #solar-daily-mwh-canvas{height:min(58dvh,540px)!important;min-height:360px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:6px;}\n"""

NEW_STYLE = """  #generation-history-panel .solar-daily-mwh-panel{margin:18px 0 20px;padding:16px;border:1px solid rgba(0,255,255,.34);border-radius:12px;background:rgba(0,255,255,.04);}\n  #generation-history-panel .solar-daily-mwh-panel.standalone{box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 0 22px rgba(0,255,255,.05);}\n  #generation-history-panel .solar-daily-mwh-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0 12px;color:#9aa3b6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;}\n  #generation-history-panel .solar-daily-mwh-controls strong{color:#00ffff;letter-spacing:.12em;}\n  #generation-history-panel .solar-daily-mwh-controls label{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}\n  #generation-history-panel .solar-daily-mwh-controls select,#generation-history-panel .solar-daily-mwh-controls input{min-height:38px;background:#05070c;color:#00ffff;border:1px solid #252b36;border-radius:6px;padding:6px;max-width:100%;}\n  #generation-history-panel #solar-daily-mwh-canvas{height:min(82dvh,760px)!important;min-height:640px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:8px;}\n  @media(max-width:850px){#generation-history-panel .solar-daily-mwh-controls{align-items:stretch;}#generation-history-panel .solar-daily-mwh-controls label{width:100%;justify-content:space-between;}#generation-history-panel .solar-daily-mwh-controls select,#generation-history-panel .solar-daily-mwh-controls input{flex:1;min-width:0;}#generation-history-panel #solar-daily-mwh-canvas{height:76dvh!important;min-height:620px!important;}}\n"""

OLD_PANEL = """\n        <div class=\"solar-daily-mwh-panel\" id=\"solar-daily-mwh-panel\">\n          <div class=\"generation-study-summary\"><strong>Solar daily energy output</strong> This chart uses Sheffield Solar PVLive daily MWh to show the total Solar energy generated across each full day. The highest full day currently recorded in this dataset is 30 Apr 2026.</div>\n          <div id=\"solar-daily-mwh-status\" class=\"price-history-range-status\">Solar daily MWh chart awaiting Solar selection.</div>\n          <canvas id=\"solar-daily-mwh-canvas\" width=\"900\" height=\"520\"></canvas>\n        </div>\n"""

NEW_PANEL = """\n      <div class=\"solar-daily-mwh-panel standalone\" id=\"solar-daily-mwh-panel\">\n        <div class=\"generation-study-summary\"><strong>Solar daily energy output</strong> Standalone daily energy chart using stored Sheffield Solar PVLive MWh. This shows energy generated across each full day, not peak MW. Other technologies will be added only after their daily MWh data is separately fetched or audited.</div>\n        <div class=\"solar-daily-mwh-controls\">\n          <strong>Daily MWh chart</strong>\n          <label>Technology <select id=\"solar-daily-mwh-technology\"><option value=\"Solar\" selected>Solar</option></select></label>\n          <label>Year <select id=\"solar-daily-mwh-year\"></select></label>\n          <label>Start <input type=\"date\" id=\"solar-daily-mwh-start\"></label>\n          <label>Period <select id=\"solar-daily-mwh-period\"><option value=\"30d\">1 month</option><option value=\"3m\">3 months</option><option value=\"6m\">6 months</option><option value=\"12m\" selected>12 months</option><option value=\"5y\">5 years</option><option value=\"10y\">10 years</option><option value=\"all\">Full PVLive file</option></select></label>\n        </div>\n        <div id=\"solar-daily-mwh-status\" class=\"price-history-range-status\">Solar daily MWh chart awaiting PVLive data.</div>\n        <canvas id=\"solar-daily-mwh-canvas\" width=\"1200\" height=\"760\"></canvas>\n      </div>\n"""

NEW_CONTROL = """window.V6ControlSolarDailyMwhChart=(function(){\n  var cache=null;\n  function cfg(){return window.V6GenerationHistoryConfig||{}}\n  function get(id){return document.getElementById(id)}\n  function loadSolarDaily(){if(cache)return cache;var url=cfg().solarDaily||'/uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json';cache=fetch(url+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});return cache}\n  function periodDays(p){return{'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[p]||366}\n  function niceDate(v){var d=v instanceof Date?v:new Date(String(v));return isNaN(d.getTime())?'—':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}\n  function years(rows){var out={};rows.forEach(function(r){if(r&&r.date)out[String(r.date).slice(0,4)]=true});return Object.keys(out).sort()}\n  function setDefaultControls(rows){var yEl=get('solar-daily-mwh-year'),sEl=get('solar-daily-mwh-start');if(!yEl||!sEl||yEl.dataset.ready==='1')return;var ys=years(rows);yEl.innerHTML='';ys.forEach(function(y){var o=document.createElement('option');o.value=y;o.textContent=y;yEl.appendChild(o)});var latest=ys[ys.length-1]||String(new Date().getUTCFullYear());yEl.value=latest;sEl.value=latest+'-01-01';yEl.dataset.ready='1'}\n  function selectedWindow(rows){var yEl=get('solar-daily-mwh-year'),sEl=get('solar-daily-mwh-start'),pEl=get('solar-daily-mwh-period');setDefaultControls(rows);var period=pEl?pEl.value:'12m';var startText=sEl&&sEl.value?sEl.value:((yEl&&yEl.value?yEl.value:String(new Date().getUTCFullYear()))+'-01-01');var start=new Date(startText+'T00:00:00Z');var end;if(period==='all'){var valid=rows.filter(function(r){return r&&r.date});start=new Date((valid[0]?valid[0].date:startText)+'T00:00:00Z');end=new Date((valid[valid.length-1]?valid[valid.length-1].date:startText)+'T23:59:59Z')}else{end=new Date(start.getTime()+periodDays(period)*86400000-1000)}return{start:start,end:end,period:period}}\n  function update(){var panel=get('solar-daily-mwh-panel'),canvas=get('solar-daily-mwh-canvas'),status=get('solar-daily-mwh-status'),techEl=get('solar-daily-mwh-technology');if(!panel||!canvas||!status||!window.V6RenderSolarDailyMwhChart)return;var tech=techEl?techEl.value:'Solar';panel.style.display='block';if(tech!=='Solar'){status.textContent='Only Solar is enabled until other daily MWh data is audited.';return}loadSolarDaily().then(function(all){setDefaultControls(all);var meta=selectedWindow(all);var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end&&r.mwh!=null&&!isNaN(Number(r.mwh))});status.textContent='SOLAR DAILY MWH · '+rows.length+' RECORDS · '+niceDate(meta.start)+' TO '+niceDate(meta.end)+' · SHEFFIELD SOLAR PVLIVE STORED MWH';window.V6RenderSolarDailyMwhChart.render(canvas,{rows:rows,start:meta.start,end:meta.end,period:meta.period})})}\n  function boot(){loadSolarDaily().then(function(rows){setDefaultControls(rows);update()});['solar-daily-mwh-technology','solar-daily-mwh-year','solar-daily-mwh-start','solar-daily-mwh-period'].forEach(function(id){var el=get(id);if(el)el.addEventListener('change',function(){if(id==='solar-daily-mwh-year'){var s=get('solar-daily-mwh-start');if(s&&el.value)s.value=el.value+'-01-01'}setTimeout(update,60)})});window.addEventListener('resize',function(){setTimeout(update,80)});setTimeout(update,300);setTimeout(update,1200)}\n  return{boot:boot,update:update};\n})();\ndocument.addEventListener('DOMContentLoaded',function(){if(window.V6ControlSolarDailyMwhChart)window.V6ControlSolarDailyMwhChart.boot()});\n"""


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def git_head() -> str:
    try:
        return subprocess.run(['git','rev-parse','--short','HEAD'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip()
    except Exception:
        return ''


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='replace') if path.exists() else ''


def solar_audit() -> dict[str, Any]:
    data = json.loads(SOLAR.read_text(encoding='utf-8')) if SOLAR.exists() else {'rows': []}
    rows = data.get('rows', []) if isinstance(data, dict) else []
    best = None
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
    return {'path': SOLAR.relative_to(ROOT).as_posix(), 'exists': SOLAR.exists(), 'rowCount': len(rows), 'mwhRowsAvailable': mwh_rows, 'mwhRowsMissingOrInvalid': missing, 'peakDailyMwh': best}


def patch_index(text: str) -> str:
    out = text
    if OLD_PANEL in out:
        out = out.replace(OLD_PANEL, '\n')
    if OLD_STYLE in out:
        out = out.replace(OLD_STYLE, NEW_STYLE)
    elif '.solar-daily-mwh-controls' not in out:
        out = out.replace('</style>', NEW_STYLE + '</style>')
    if 'class="solar-daily-mwh-panel standalone"' not in out:
        marker = '      <details class="price-history-discovery" open>'
        out = out.replace(marker, NEW_PANEL + '\n' + marker)
    return out


def patch_renderer(text: str) -> str:
    out = text
    out = out.replace('SOLAR DAILY ENERGY OUTPUT · Sheffield Solar PVLive MWh', 'SOLAR DAILY MWH · PVLive stored energy')
    out = out.replace('HIGHEST DAILY SOLAR ENERGY', 'HIGHEST DAILY MWH')
    out = out.replace("fmt(s.total/1000000,2)+' TWh'", "fmt(s.total/1000000,2)+' TWh'")
    return out


def positions(text: str) -> dict[str, int]:
    return {
        'mwhPanel': text.find('<div class="mwh-panel">'),
        'standalonePanel': text.find('class="solar-daily-mwh-panel standalone"'),
        'mwDetails': text.find('<details class="price-history-discovery" open>'),
        'mwCanvas': text.find('id="generation-history-canvas"'),
        'sourceWarning': text.find('class="generation-source-warning"'),
        'nestedOldPanel': text.find('<div class="solar-daily-mwh-panel" id="solar-daily-mwh-panel">'),
    }


def raw_temp_audit() -> dict[str, Any]:
    patterns = ['data/raw/', 'data/transient/', '/tmp/', 'raw_api', 'raw_elexon', 'fuelinst_raw', 'fuelhh_raw', 'backfill_tmp', 'archive_full', 'master_halfhourly']
    hits = []
    for path in ROOT.rglob('*'):
        if not path.is_file() or '.git' in path.parts:
            continue
        rel = path.relative_to(ROOT).as_posix().lower()
        if any(p in rel for p in patterns):
            hits.append(rel)
    return {'patterns': patterns, 'hits': hits[:50], 'hitCount': len(hits)}


def render_report(payload: dict[str, Any]) -> str:
    header = [
        'Title: Solar Daily MWh Standalone Chart Upgrade',
        f"Generated UTC: {payload['generatedUTC']}",
        'Repository: Ventusltd/globalgrid2050',
        'Branch: main',
        f"Git head before: {payload['gitHeadBefore']}",
        f"Git head after: {payload['gitHeadAfter']}",
        'Workflow: GridBot Solar Daily MWh Standalone Upgrade',
        'Script: scripts/gridbot_solar_daily_mwh_standalone_upgrade.py',
        'Upgrade type: UI source routing and standalone chart layout',
        f"Executive summary: {payload['executiveSummary']}",
        f"Human review status: {payload['humanReviewStatus']}",
        f"Next action: {payload['nextAction']}",
        '',
        '# Solar Daily MWh Standalone Chart Upgrade',
        '',
        '```json',
        json.dumps(payload, indent=2),
        '```',
        ''
    ]
    return '\n'.join(header)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    old_index = read(INDEX)
    old_control = read(CONTROL)
    old_render = read(RENDER)
    new_index = patch_index(old_index)
    new_control = NEW_CONTROL
    new_render = patch_renderer(old_render)
    solar = solar_audit()
    pos = positions(new_index)
    control_text = new_control
    render_text = new_render

    checks = {
        'index_exists': INDEX.exists(),
        'controller_exists': CONTROL.exists(),
        'renderer_exists': RENDER.exists(),
        'solar_data_exists': solar['exists'],
        'solar_data_has_stored_mwh': solar['mwhRowsAvailable'] > 0,
        'solar_peak_mwh_found': solar['peakDailyMwh'] is not None,
        'standalone_panel_present_after_patch': pos['standalonePanel'] >= 0,
        'standalone_panel_before_mw_details': 0 <= pos['standalonePanel'] < pos['mwDetails'],
        'old_nested_panel_removed': pos['nestedOldPanel'] < 0,
        'mw_chart_canvas_preserved': 'generation-history-canvas' in new_index,
        'aggregate_mwh_panel_preserved': 'generation-mwh-annual' in new_index and 'generation-mwh-monthly' in new_index and 'generation-mwh-daynight' in new_index,
        'source_warning_preserved': 'generation-source-warning' in new_index,
        'independent_control_ids_present': all(x in new_index for x in ['solar-daily-mwh-technology','solar-daily-mwh-year','solar-daily-mwh-start','solar-daily-mwh-period']),
        'controller_uses_independent_controls': all(x in control_text for x in ['solar-daily-mwh-technology','solar-daily-mwh-year','solar-daily-mwh-start','solar-daily-mwh-period']),
        'controller_not_bound_to_mw_controls': not any(x in control_text for x in ['generation-history-technology','generation-history-start','generation-history-period','generation-history-year']),
        'no_elexon_derived_mwh_logic': not any(x in control_text + render_text for x in ['loadFuelhhDaily','FUELHH','sampleCount * 0.5','averageMW*sampleCount','averageMW * sampleCount']),
        'mobile_canvas_height_increased': 'min-height:620px' in new_index and 'min(82dvh,760px)' in new_index,
        'script_refs_preserved': 'render_solar_daily_mwh_chart.js' in new_index and 'control_solar_daily_mwh_chart.js' in new_index,
    }
    passed = all(checks.values())

    if args.apply and passed:
        INDEX.write_text(new_index, encoding='utf-8')
        CONTROL.write_text(new_control, encoding='utf-8')
        RENDER.write_text(new_render, encoding='utf-8')

    payload = {
        'reportTitle': 'Solar Daily MWh Standalone Chart Upgrade',
        'schemaVersion': '1.0.0',
        'generatedUTC': utc_now(),
        'repository': 'Ventusltd/globalgrid2050',
        'branch': 'main',
        'gitHeadBefore': git_head(),
        'gitHeadAfter': git_head(),
        'workflowName': 'GridBot Solar Daily MWh Standalone Upgrade',
        'scriptName': 'scripts/gridbot_solar_daily_mwh_standalone_upgrade.py',
        'upgradeType': 'UI source routing and standalone chart layout',
        'mode': 'apply' if args.apply else 'audit',
        'sourceApis': ['Sheffield Solar PVLive stored browser file only'],
        'sourceWindows': ['2016-01 to latest stored PVLive row'],
        'inputFiles': [str(INDEX.relative_to(ROOT)), str(CONTROL.relative_to(ROOT)), str(RENDER.relative_to(ROOT)), str(SOLAR.relative_to(ROOT))],
        'outputFiles': [str(INDEX.relative_to(ROOT)), str(CONTROL.relative_to(ROOT)), str(RENDER.relative_to(ROOT)), str(REPORT.relative_to(ROOT)), str(REPORT_JSON.relative_to(ROOT))],
        'changedFiles': [p for p, old, new in [('uk_energy_tracking_v6/generation_history/index.md', old_index, new_index), ('uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js', old_control, new_control), ('uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js', old_render, new_render)] if old != new],
        'addedFiles': [],
        'deletedFiles': [],
        'solarAudit': solar,
        'layoutPositionsAfterPatch': pos,
        'checks': checks,
        'rawTemporaryFilesFound': raw_temp_audit(),
        'browserRoutingAffected': True,
        'rollbackMethod': 'Revert the apply commit or rerun the previous Solar daily MWh chart upgrade commit d4b5242 if a rollback is required.',
        'executiveSummary': 'Moves the proven Solar daily MWh chart into a standalone module with independent Solar-only controls, larger mobile canvas and no Elexon derived MWh logic.',
        'humanReviewStatus': 'audit required before apply' if not args.apply else 'apply completed, verify live page after Jekyll deploy',
        'nextAction': 'Run apply only if all checks are true.' if not args.apply else 'Verify live page, then later create separate MWh proof audits for non Solar technologies.',
        'applied': bool(args.apply and passed),
        'pass': passed,
    }

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_report(payload), encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 0 if passed else 1

if __name__ == '__main__':
    raise SystemExit(main())
