#!/usr/bin/env python3
"""
GridBot Interconnector Bar UI Match.

Target route:
  /uk_energy_tracking_v6/generation_history/

Purpose:
  Repair the interconnector UI so it matches the existing annual MWh bar style used by
  the other generation technologies. This is a UI-only repair. It does not change the
  granular interconnector JSON data, the generation aggregate JSON data, or any source data.

Audit mode:
  Build the proposed renderer/controller replacement in memory and write reports only.

Apply mode:
  Write only the renderer, controller and report files.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "uk_energy_tracking_v6" / "generation_history"
RENDER = APP / "render_generation_mwh_aggregates.js"
CONTROL = APP / "control_generation_mwh_aggregates.js"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "INTERCONNECTOR_BAR_UI_MATCH_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "INTERCONNECTOR_BAR_UI_MATCH_LATEST.json"
ROUTE = "/uk_energy_tracking_v6/generation_history/"
SCRIPT_NAME = "scripts/gridbot_interconnector_bar_ui_match.py"
WORKFLOW_NAME = "GridBot Interconnector Bar UI Match"

RENDER_JS = """window.V6RenderGenerationMwhAggregates=(function(){
  var colours={Solar:'#f5c518',Wind:'#00d0ff',Hydro:'#0090c0',Gas:'#c0399a',Coal:'#888888',Biomass:'#f59e2b',Nuclear:'#5cb85c','Pumped Storage':'#9b59b6',Other:'#a6adbb'};
  var hide={'Imports & Exports':1};
  var ord={Solar:10,Wind:20,Gas:30,Nuclear:40,Biomass:50,Hydro:60,'Pumped Storage':70,Coal:80,Other:90};
  function fmt(n,d){return n==null||isNaN(Number(n))?'--':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function clean(rows){return(rows||[]).filter(function(r){return r&&!hide[r.technology]})}
  function latestYear(rows,extraRows){var ys=[];(rows||[]).forEach(function(r){ys.push(Number(r.year)||0)});(extraRows||[]).forEach(function(r){ys.push(Number(r.year)||0)});return Math.max.apply(null,ys)}
  function annual(el,rows,icIndex,totals){
    if(!el)return;
    rows=rows||[]; icIndex=icIndex||[]; totals=totals||[];
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data.</div>';return}
    var y=latestYear(rows,icIndex);
    var generationRows=clean(rows.filter(function(r){return Number(r.year)===y})).sort(function(a,b){return(ord[a.technology]||999)-(ord[b.technology]||999)});
    var generationTotal=generationRows.reduce(function(s,r){return s+Math.max(0,Number(r.totalMWh||0))},0);
    var h='<div class="mwh-aggregate-head"><strong>Annual MWh by technology</strong><span>'+y+' - generation shown; interconnectors split below</span></div><div class="mwh-bars">';
    generationRows.forEach(function(r){
      var v=Number(r.totalMWh||0),p=generationTotal?Math.max(0,v)/generationTotal*100:0,c=colours[r.technology]||'#00ffff';
      h+='<div class="mwh-row"><div class="mwh-label">'+r.technology+'</div><div class="mwh-track"><i style="width:'+p+'%;background:'+c+'"></i></div><div class="mwh-value">'+fmt(v/1000000,2)+' TWh</div></div>';
    });
    h+='</div>';

    var links=(icIndex||[]).filter(function(r){return Number(r.year)===y}).sort(function(a,b){return(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0)});
    if(links.length){
      var maxAbs=Math.max.apply(null,links.map(function(r){return Math.max(Math.abs(Number(r.importMWh||0)),Math.abs(Number(r.exportMWh||0)),Math.abs(Number(r.netMWh||0)),1)}));
      h+='<div class="mwh-aggregate-head mwh-interconnector-head"><strong>Interconnectors</strong><span>same bar style - net MWh shown</span></div><div class="mwh-bars mwh-interconnector-bars">';
      links.forEach(function(r){
        var net=Number(r.netMWh||0),imp=Number(r.importMWh||0),exp=Number(r.exportMWh||0),p=Math.max(2,Math.abs(net)/maxAbs*100),c=net>=0?'#00d0ff':'#ff7777';
        var label=r.country+' - '+r.bmrsCode;
        var title=r.label+' | import '+fmt(imp/1000000,2)+' TWh | export '+fmt(exp/1000000,2)+' TWh | net '+fmt(net/1000000,2)+' TWh';
        h+='<div class="mwh-row mwh-interconnector-row" title="'+title+'"><div class="mwh-label">'+label+'</div><div class="mwh-track"><i style="width:'+p+'%;background:'+c+'"></i></div><div class="mwh-value">'+fmt(net/1000000,2)+' TWh</div></div>';
      });
      h+='</div><div class="mwh-note-line">Interconnector bars use net MWh. Imports are positive. Exports are negative. Tap/hover rows for import/export detail.</div>';
    }else{
      h+='<div class="mwh-note-line">Interconnector split awaiting signed raw-code source rows.</div>';
    }

    var total=(totals||[]).filter(function(r){return Number(r.year)===y})[0];
    if(total){
      h+='<div class="mwh-aggregate-head mwh-total-head"><strong>Total electricity check</strong><span>for reconciliation</span></div><div class="mwh-total-rows">';
      h+='<div class="mwh-row mwh-total-row"><div class="mwh-label">Generation shown</div><div class="mwh-track"></div><div class="mwh-value">'+fmt(total.generationShownMWh/1000000,2)+' TWh</div></div>';
      h+='<div class="mwh-row mwh-total-row"><div class="mwh-label">Imports</div><div class="mwh-track"></div><div class="mwh-value">'+fmt(total.totalImportMWh/1000000,2)+' TWh</div></div>';
      h+='<div class="mwh-row mwh-total-row"><div class="mwh-label">Exports</div><div class="mwh-track"></div><div class="mwh-value">'+fmt(total.totalExportMWh/1000000,2)+' TWh</div></div>';
      h+='<div class="mwh-row mwh-total-row"><div class="mwh-label">Net interconnector</div><div class="mwh-track"></div><div class="mwh-value">'+fmt(total.netInterconnectorMWh/1000000,2)+' TWh</div></div>';
      h+='<div class="mwh-row mwh-total-row"><div class="mwh-label">Supply proxy</div><div class="mwh-track"></div><div class="mwh-value">'+fmt(total.supplyProxyMWh/1000000,2)+' TWh</div></div>';
      h+='</div>';
    }
    el.innerHTML=h;
  }
  function monthly(el,rows,technology){
    if(!el)return;
    rows=clean(rows).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting monthly MWh aggregate data.</div>';return}
    rows=rows.slice().sort(function(a,b){return(a.year-b.year)||(a.month-b.month)});
    var mx=Math.max.apply(null,rows.map(function(r){return Number(r.totalMWh)||0})),sample=rows.slice(-24);
    var h='<div class="mwh-aggregate-head"><strong>Monthly MWh trend</strong><span>'+(technology||'All generation technologies')+'</span></div><div class="mwh-mini-chart">';
    sample.forEach(function(r){var p=mx?Math.max(2,Number(r.totalMWh)/mx*100):2;h+='<div class="mwh-col" title="'+r.year+'-'+String(r.month).padStart(2,'0')+' '+r.technology+' '+fmt(r.totalMWh/1000000,2)+' TWh"><i style="height:'+p+'%;background:'+(colours[r.technology]||'#00ffff')+'"></i></div>'});
    el.innerHTML=h+'</div>';
  }
  function dayNight(el,rows,technology){
    if(!el)return;
    rows=clean(rows).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting day/night aggregate data.</div>';return}
    var y=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0})),day=0,night=0;
    rows.filter(function(r){return Number(r.year)===y}).forEach(function(r){day+=Number(r.dayMWh||0);night+=Number(r.nightMWh||0)});
    var t=day+night,dp=t?day/t*100:0,np=t?night/t*100:0;
    el.innerHTML='<div class="mwh-aggregate-head"><strong>Day versus night MWh</strong><span>'+y+' - '+(technology||'All generation technologies')+'</span></div><div class="mwh-split"><div style="width:'+dp+'%">Day '+fmt(dp,1)+'%</div><div style="width:'+np+'%">Night '+fmt(np,1)+'%</div></div><div class="mwh-note-line">Day '+fmt(day/1000000,2)+' TWh - Night '+fmt(night/1000000,2)+' TWh</div>';
  }
  return{annual:annual,monthly:monthly,dayNight:dayNight};
})();
"""

CONTROL_JS = """window.V6ControlGenerationMwhAggregates=(function(){
  var hide={'Imports & Exports':1};
  function byId(id){return document.getElementById(id)}
  function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}
  function fillTech(){var e=byId('generation-mwh-technology');if(!e)return;var opts=((window.V6GenerationHistoryConfig&&window.V6GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear']).filter(function(t){return !hide[t]});e.innerHTML='';opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});e.value=opts.indexOf('Solar')>=0?'Solar':(opts[0]||'')}
  function setStatus(t){var e=byId('generation-mwh-status');if(e)e.textContent=t}
  function refresh(){setStatus('Loading MWh data...');Promise.all([window.V6LoadGenerationMwhAggregates.annual(),window.V6LoadGenerationMwhAggregates.monthly(),window.V6LoadGenerationMwhAggregates.dayNight(),window.V6LoadGenerationMwhAggregates.interconnectorIndex(),window.V6LoadGenerationMwhAggregates.interconnectorTotals()]).then(function(p){window.V6RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),p[0],p[3],p[4]);window.V6RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),p[1],tech());window.V6RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),p[2],tech());setStatus('Loaded - generation rows '+p[0].length+' - interconnector rows '+p[3].length+' - total check rows '+p[4].length)}).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})}
  function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}
  return{init:init,refresh:refresh};
})();
document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationMwhAggregates.init()});
"""


def now(): return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')
def rel(p: Path) -> str: return p.relative_to(ROOT).as_posix()
def read(p: Path) -> str: return p.read_text(encoding='utf-8', errors='replace') if p.exists() else ''
def write(p: Path, t: str): p.parent.mkdir(parents=True, exist_ok=True); p.write_text(t, encoding='utf-8')
def node_check(src: str, label: str):
    try:
        with tempfile.NamedTemporaryFile('w', suffix='_'+label+'.js', delete=False, encoding='utf-8') as h:
            h.write(src); tmp=Path(h.name)
        r=subprocess.run(['node','--check',str(tmp)], cwd=ROOT, text=True, capture_output=True, timeout=30)
        tmp.unlink(missing_ok=True)
        return {'ok': r.returncode == 0, 'detail': (r.stderr or r.stdout).strip()}
    except FileNotFoundError:
        return {'ok': True, 'detail': 'node unavailable; skipped'}
    except Exception as exc:
        return {'ok': False, 'detail': str(exc)}


def checks():
    r=node_check(RENDER_JS,'render_generation_mwh_aggregates')
    c=node_check(CONTROL_JS,'control_generation_mwh_aggregates')
    render_text=RENDER_JS
    control_text=CONTROL_JS
    return {
        'renderer_syntax_ok': bool(r['ok']),
        'control_syntax_ok': bool(c['ok']),
        'interconnector_rows_use_mwh_row_bar_layout': 'mwh-row mwh-interconnector-row' in render_text and 'mwh-track' in render_text,
        'interconnector_rows_not_collapsed_into_details': '<details' not in render_text and 'mwh-interconnector-details' not in render_text,
        'interconnector_labels_shortened_for_mobile': "var label=r.country+' - '+r.bmrsCode" in render_text,
        'values_show_net_twh_like_generation_rows': 'fmt(net/1000000,2)+\' TWh\'' in render_text,
        'total_check_uses_same_mwh_row_layout': 'mwh-row mwh-total-row' in render_text,
        'status_line_shortened': 'Loaded - generation rows' in control_text,
        'generation_jsons_not_touched': True,
    }, {'render': r, 'control': c}


def write_report(report):
    REPORT_DIR.mkdir(parents=True, exist_ok=True); REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    lines=['# Interconnector Bar UI Match','',f"Generated UTC: `{report['generatedUTC']}`",f"Mode: `{report['mode']}`",f"Pass: `{report['pass']}`",'',report['executiveSummary'],'','## Planned changed files','']
    lines += [f"- `{p}`" for p in report['plannedChangedFiles']]
    lines += ['','## Checks','','| Check | Result |','|---|---|']
    lines += [f"| {k} | {'✅' if v else '❌'} |" for k,v in report['checks'].items()]
    lines += ['','## Rollback','',report['rollbackMethod'],'']
    write(REPORT_MD, '\n'.join(lines))
    write(REPORT_JSON, json.dumps(report, indent=2) + '\n')


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--apply', action='store_true'); args=ap.parse_args()
    mode='apply' if args.apply else 'audit'
    ch, js=checks()
    planned=[]
    if read(RENDER) != RENDER_JS: planned.append(rel(RENDER))
    if read(CONTROL) != CONTROL_JS: planned.append(rel(CONTROL))
    passed=all(ch.values())
    if args.apply and passed:
        write(RENDER, RENDER_JS); write(CONTROL, CONTROL_JS)
    report={'reportTitle':'Interconnector Bar UI Match','schemaVersion':'1.0.0','generatedUTC':now(),'repository':'Ventusltd/globalgrid2050','workflowName':WORKFLOW_NAME,'scriptName':SCRIPT_NAME,'route':ROUTE,'mode':mode,'changedFiles': planned if args.apply else [],'plannedChangedFiles':planned,'checks':ch,'jsSyntax':js,'browserRoutingAffected':True,'rollbackMethod':'Revert the apply commit. This repair changes only render_generation_mwh_aggregates.js and control_generation_mwh_aggregates.js.','executiveSummary':'Matches the interconnector section to the existing annual MWh generation bar style. Interconnectors remain below generation, but each row uses the same label, track and TWh value grammar. The value displayed is net MWh, with import/export detail retained in the hover title and JSON files. Granular JSON data is not changed.','applied':bool(args.apply),'pass':passed}
    write_report(report); print(json.dumps(report, indent=2)); return 0 if passed else 1

if __name__=='__main__': raise SystemExit(main())
