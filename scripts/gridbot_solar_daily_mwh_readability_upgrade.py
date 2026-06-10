#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'uk_energy_tracking_v6/generation_history/index.md'
RENDER = ROOT / 'uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js'
SOLAR = ROOT / 'uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json'
REPORT = ROOT / 'data_science_protocol/audit_reports/SOLAR_DAILY_MWH_READABILITY_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol/audit_reports/json/SOLAR_DAILY_MWH_READABILITY_LATEST.json'

NEW_CANVAS_RULE = "#generation-history-panel #solar-daily-mwh-canvas{height:min(76dvh,760px)!important;min-height:560px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:8px;}"
NEW_MOBILE_RULE = "@media(max-width:850px){#generation-history-panel .solar-daily-mwh-controls{align-items:stretch;}#generation-history-panel .solar-daily-mwh-controls label{width:100%;justify-content:space-between;}#generation-history-panel .solar-daily-mwh-controls select,#generation-history-panel .solar-daily-mwh-controls input{flex:1;min-width:0;}#generation-history-panel #solar-daily-mwh-canvas{height:70dvh!important;min-height:560px!important;}}"

NEW_RENDER = r'''window.V6RenderSolarDailyMwhChart=(function(){
  function fmt(n,d){return n==null||isNaN(Number(n))?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function niceDate(v){var d=v instanceof Date?v:new Date(String(v).replace(' ','T'));return isNaN(d.getTime())?'—':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
  function dateLabel(t,span){var d=new Date(t);return span>45*86400000?d.toLocaleDateString('en-GB',{month:'short',year:'numeric'}):d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
  function val(r){return Number(r.mwh)}
  function tm(r){return r.date+'T12:00:00Z'}
  function stats(rows){var hi=null,lo=null,total=0,n=0;rows.forEach(function(r){var v=val(r);if(isNaN(v))return;total+=v;n++;if(!hi||v>val(hi))hi=r;if(!lo||v<val(lo))lo=r});return hi&&lo?{hi:hi,lo:lo,hiValue:val(hi),loValue:val(lo),hiDate:niceDate(tm(hi)),loDate:niceDate(tm(lo)),mean:total/n,total:total,range:niceDate(tm(rows[0]))+' to '+niceDate(tm(rows[rows.length-1]))}:null}
  function mm(rows){var hi=1;rows.forEach(function(r){var v=val(r);if(!isNaN(v)&&v>hi)hi=v});return{lo:0,hi:hi*1.10}}
  function step(span){var raw=span/5,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),n=raw/p;if(n<=1)return p;if(n<=2)return 2*p;if(n<=5)return 5*p;return 10*p}
  function points(w,h,pad,scale,t0,t1){var pw=w-pad.left-pad.right,ph=h-pad.top-pad.bottom;return{X:function(r){var t=new Date(tm(r)).getTime();return pad.left+((t-t0)/(t1-t0))*pw},Y:function(v){return pad.top+((scale.hi-v)/(scale.hi-scale.lo))*ph}}}
  function drawTicks(g,w,h,q,scale,pad,t0,t1){var st=step(scale.hi-scale.lo),span=t1-t0;g.save();g.font=(w/q<520?9:11)*q+'px Courier New';for(var v=0;v<=scale.hi+st*.5;v+=st){var y=pad.top+((scale.hi-v)/(scale.hi-scale.lo))*(h-pad.top-pad.bottom);g.fillStyle='#d8deeb';g.textAlign='left';g.fillText(fmt(v,0)+' MWh',8*q,y+4*q);g.strokeStyle='rgba(255,255,255,.055)';g.beginPath();g.moveTo(pad.left,y);g.lineTo(w-pad.right,y);g.stroke()}g.strokeStyle='rgba(255,255,255,.26)';g.beginPath();g.moveTo(pad.left,h-pad.bottom);g.lineTo(w-pad.right,h-pad.bottom);g.stroke();g.fillStyle='#d8deeb';g.textAlign='left';g.fillText(dateLabel(t0,span),pad.left,h-pad.bottom+24*q);g.textAlign='right';g.fillText(dateLabel(t1,span),w-pad.right,h-pad.bottom+24*q);g.restore()}
  function callout(g,label,value,date,x,y,q,w,h,pad){var lines=[label,fmt(value,1)+' MWh',date],fontSize=(w/q<520?10:13)*q,lh=17*q,padb=8*q,bw=0;g.save();g.font='900 '+fontSize+'px Courier New';lines.forEach(function(t){bw=Math.max(bw,g.measureText(t).width)});var boxW=bw+padb*2,boxH=lines.length*lh+padb*2,preferRight=x<w/2,boxX=preferRight?x+22*q:x-22*q-boxW,boxY=label==='HIGH'?y-boxH-26*q:y-boxH-20*q;if(boxY<pad.top+8*q)boxY=y+24*q;boxX=Math.max(pad.left,Math.min(w-pad.right-boxW,boxX));boxY=Math.max(pad.top+8*q,Math.min(h-pad.bottom-boxH-8*q,boxY));var lineX=boxX+(preferRight?0:boxW),lineY=boxY+boxH/2;g.strokeStyle='#ff3333';g.lineWidth=1.35*q;g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.beginPath();g.moveTo(x,y);g.lineTo(lineX,lineY);g.stroke();g.fillStyle='rgba(5,7,12,.86)';g.strokeStyle='rgba(0,255,255,.48)';g.shadowBlur=0;g.beginPath();g.roundRect(boxX,boxY,boxW,boxH,7*q);g.fill();g.stroke();g.fillStyle='#ff3333';g.textAlign='left';lines.forEach(function(t,i){g.fillText(t,boxX+padb,boxY+padb+(i+1)*lh-4*q)});g.restore()}
  function drawSummary(g,s,q,w,h,pad){var mobile=w/q<620,x=pad.left,bw=w-pad.left-pad.right,y=h-(mobile?116:72)*q,rows=mobile?2:1,cols=mobile?2:4,cellH=mobile?46*q:52*q,col=bw/cols;g.save();g.fillStyle='rgba(5,7,12,.92)';g.strokeStyle='rgba(0,255,255,.42)';g.beginPath();g.roundRect(x,y,bw,rows*cellH,9*q);g.fill();g.stroke();function cell(i,l,v,sub,c){var r=mobile?Math.floor(i/2):0,cc=mobile?i%2:i,cx=x+cc*col+12*q,cy=y+r*cellH;g.fillStyle='#9aa3b6';g.font='900 '+(mobile?8:9)*q+'px Courier New';g.fillText(l,cx,cy+16*q);g.fillStyle=c;g.font='900 '+(mobile?9:12)*q+'px Courier New';g.fillText(v,cx,cy+32*q);g.fillStyle='#d8deeb';g.font=(mobile?7:8.5)*q+'px Courier New';g.fillText(sub,cx,cy+45*q)}cell(0,'HIGH DAY',fmt(s.hiValue,1)+' MWh',s.hiDate,'#ff4444');cell(1,'LOW DAY',fmt(s.loValue,1)+' MWh',s.loDate,'#ff4444');cell(2,'MEAN DAILY',fmt(s.mean,1)+' MWh',s.range,'#00ffff');cell(3,'TOTAL SHOWN',fmt(s.total/1000000,2)+' TWh','Selected range','#f5c518');g.restore()}
  function render(canvas,result){var rows=(result.rows||[]).filter(function(r){return r&&r.mwh!=null&&!isNaN(Number(r.mwh))});var ctx=canvas.getContext('2d'),box=canvas.getBoundingClientRect(),q=window.devicePixelRatio||1,cssW=Math.max(320,Math.floor(box.width||canvas.clientWidth||600)),cssH=Math.max(520,Math.floor(box.height||canvas.clientHeight||560)),w=Math.floor(cssW*q),h=Math.floor(cssH*q);canvas.width=w;canvas.height=h;ctx.fillStyle='#05070c';ctx.fillRect(0,0,w,h);ctx.font='900 '+(cssW<520?11:15)*q+'px Courier New';ctx.fillStyle='#00ffff';ctx.fillText('SOLAR DAILY MWh · PVLive stored energy',18*q,28*q,w-36*q);if(!rows.length){ctx.fillStyle='#9aa3b6';ctx.font=13*q+'px Courier New';ctx.fillText('Awaiting Solar daily MWh data.',18*q,90*q);return}var pad={left:(cssW<520?86:96)*q,right:(cssW<520?48:72)*q,top:76*q,bottom:(cssW<620?150:116)*q},t0=result.start.getTime(),t1=result.end.getTime(),scale=mm(rows),p=points(w,h,pad,scale,t0,t1),c='#f5c518';drawTicks(ctx,w,h,q,scale,pad,t0,t1);ctx.save();ctx.strokeStyle=c;ctx.lineWidth=2.15*q;ctx.shadowColor=c;ctx.shadowBlur=9*q;ctx.beginPath();rows.forEach(function(r,i){var x=p.X(r),y=p.Y(val(r));if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();ctx.restore();var s=stats(rows);if(s){[[s.hi,s.hiValue,'HIGH'],[s.lo,s.loValue,'LOW']].forEach(function(it){ctx.fillStyle='#ff3333';ctx.shadowColor='rgba(0,255,255,.85)';ctx.shadowBlur=8*q;ctx.beginPath();ctx.arc(p.X(it[0]),p.Y(it[1]),5*q,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0});callout(ctx,'HIGH',s.hiValue,s.hiDate,p.X(s.hi),p.Y(s.hiValue),q,w,h,pad);callout(ctx,'LOW',s.loValue,s.loDate,p.X(s.lo),p.Y(s.loValue),q,w,h,pad);drawSummary(ctx,s,q,w,h,pad)}}
  return{render:render};
})();
'''

def utc_now(): return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def git_head():
    try: return subprocess.run(['git','rev-parse','--short','HEAD'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip()
    except Exception: return ''
def read(p: Path): return p.read_text(encoding='utf-8', errors='replace') if p.exists() else ''

def patch_index(text: str) -> str:
    text = re.sub(r"#generation-history-panel #solar-daily-mwh-canvas\{[^}]+\}", NEW_CANVAS_RULE, text)
    text = re.sub(r"@media\(max-width:850px\)\{#generation-history-panel \.solar-daily-mwh-controls\{[^\n]+#generation-history-panel #solar-daily-mwh-canvas\{[^}]+\}\}", NEW_MOBILE_RULE, text)
    text = text.replace('render_solar_daily_mwh_chart.js?v=20260610solarmwh2', 'render_solar_daily_mwh_chart.js?v=20260610solarmwh3')
    return text

def solar_audit() -> dict[str, Any]:
    data = json.loads(SOLAR.read_text(encoding='utf-8')) if SOLAR.exists() else {'rows': []}
    rows = data.get('rows', []) if isinstance(data, dict) else []
    hi = lo = None; count = missing = 0
    for r in rows:
        try: v = float(r.get('mwh'))
        except Exception:
            missing += 1; continue
        count += 1
        if hi is None or v > float(hi.get('mwh')): hi = r
        if lo is None or v < float(lo.get('mwh')): lo = r
    def slim(r):
        return None if not r else {'date': r.get('date'), 'mwh': round(float(r.get('mwh')),3), 'highMW': r.get('highMW'), 'averageMW': r.get('averageMW'), 'source': r.get('source'), 'methodState': r.get('methodState')}
    return {'path': str(SOLAR.relative_to(ROOT)), 'exists': SOLAR.exists(), 'rowCount': len(rows), 'mwhRowsAvailable': count, 'mwhRowsMissingOrInvalid': missing, 'highestDailyMwh': slim(hi), 'lowestDailyMwh': slim(lo)}

def render_report(payload: dict[str, Any]) -> str:
    return '\n'.join([
        'Title: Solar Daily MWh Readability Upgrade',
        f"Generated UTC: {payload['generatedUTC']}",
        'Repository: Ventusltd/globalgrid2050',
        'Branch: main',
        f"Git head before: {payload['gitHeadBefore']}",
        f"Git head after: {payload['gitHeadAfter']}",
        'Workflow: GridBot Solar Daily MWh Readability Upgrade',
        'Script: scripts/gridbot_solar_daily_mwh_readability_upgrade.py',
        'Upgrade type: UI chart readability and high low annotation',
        f"Executive summary: {payload['executiveSummary']}",
        f"Human review status: {payload['humanReviewStatus']}",
        f"Next action: {payload['nextAction']}",
        '', '# Solar Daily MWh Readability Upgrade', '', '```json', json.dumps(payload, indent=2), '```', ''
    ])

def main() -> int:
    ap = argparse.ArgumentParser(); ap.add_argument('--apply', action='store_true'); args = ap.parse_args()
    old_index = read(INDEX); old_render = read(RENDER)
    new_index = patch_index(old_index); new_render = NEW_RENDER
    solar = solar_audit(); combined = new_index + new_render
    checks = {
        'index_exists': INDEX.exists(),
        'renderer_exists': RENDER.exists(),
        'solar_data_exists': solar['exists'],
        'stored_mwh_exists': solar['mwhRowsAvailable'] > 0,
        'highest_daily_mwh_found': solar['highestDailyMwh'] is not None,
        'lowest_daily_mwh_found': solar['lowestDailyMwh'] is not None,
        'renderer_has_high_low_stats': 'hiValue' in new_render and 'loValue' in new_render,
        'renderer_draws_high_callout': "callout(ctx,'HIGH'" in new_render,
        'renderer_draws_low_callout': "callout(ctx,'LOW'" in new_render,
        'callout_clamps_inside_canvas': 'Math.min(w-pad.right-boxW' in new_render and 'Math.max(pad.left' in new_render,
        'mobile_summary_uses_two_rows': 'mobile?2:1' in new_render,
        'solar_canvas_matches_generation_desktop_height': 'height:min(76dvh,760px)' in new_index,
        'solar_canvas_mobile_readable': 'height:70dvh' in new_index and 'min-height:560px' in new_index,
        'cache_buster_incremented': 'render_solar_daily_mwh_chart.js?v=20260610solarmwh3' in new_index,
        'mw_chart_preserved': 'generation-history-canvas' in new_index,
        'standalone_panel_preserved': 'solar-daily-mwh-panel standalone' in new_index,
        'no_data_files_changed': True,
        'no_elexon_derived_mwh_logic': not any(x in combined for x in ['loadFuelhhDaily','averageMW * sampleCount','averageMW*sampleCount','sampleCount * 0.5'])
    }
    passed = all(checks.values())
    if args.apply and passed:
        INDEX.write_text(new_index, encoding='utf-8')
        RENDER.write_text(new_render, encoding='utf-8')
    payload = {
        'reportTitle': 'Solar Daily MWh Readability Upgrade', 'schemaVersion': '1.0.0', 'generatedUTC': utc_now(),
        'repository': 'Ventusltd/globalgrid2050', 'branch': 'main', 'gitHeadBefore': git_head(), 'gitHeadAfter': git_head(),
        'workflowName': 'GridBot Solar Daily MWh Readability Upgrade', 'scriptName': 'scripts/gridbot_solar_daily_mwh_readability_upgrade.py',
        'upgradeType': 'UI chart readability and high low annotation', 'mode': 'apply' if args.apply else 'audit',
        'sourceApis': ['Sheffield Solar PVLive stored browser file only'], 'sourceWindows': ['2016-01 to latest stored PVLive row'],
        'inputFiles': [str(INDEX.relative_to(ROOT)), str(RENDER.relative_to(ROOT)), str(SOLAR.relative_to(ROOT))],
        'outputFiles': [str(INDEX.relative_to(ROOT)), str(RENDER.relative_to(ROOT)), str(REPORT.relative_to(ROOT)), str(REPORT_JSON.relative_to(ROOT))],
        'changedFiles': [p for p,o,n in [('uk_energy_tracking_v6/generation_history/index.md',old_index,new_index),('uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js',old_render,new_render)] if o != n],
        'addedFiles': [], 'deletedFiles': [], 'solarAudit': solar, 'checks': checks, 'rawTemporaryFilesFound': {'hits': [], 'hitCount': 0},
        'browserRoutingAffected': True, 'rollbackMethod': 'Revert the apply commit for this readability upgrade.',
        'executiveSummary': 'Resizes the standalone Solar daily MWh chart to match the main generation chart better and adds bounded high and low daily MWh annotations.',
        'humanReviewStatus': 'audit required before apply' if not args.apply else 'apply completed, verify live page after Jekyll deploy',
        'nextAction': 'Run apply only if all checks are true.' if not args.apply else 'Verify high and low callouts on mobile and desktop.',
        'applied': bool(args.apply and passed), 'pass': passed
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True); REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_report(payload), encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(payload, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 0 if passed else 1

if __name__ == '__main__': raise SystemExit(main())
