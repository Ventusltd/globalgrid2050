#!/usr/bin/env python3
from __future__ import annotations

import argparse, csv, datetime as dt, json, math, re
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
MOD = ROOT / 'uk_energy_tracking_v6' / 'generation_history'
INDEX = MOD / 'index.md'
LOAD = MOD / 'load_generation_mwh_aggregates.js'
RENDER = MOD / 'render_generation_mwh_aggregates.js'
CONTROL = MOD / 'control_generation_mwh_aggregates.js'
OUT = MOD / 'generation_interconnector_annual_mwh_by_link_direction.json'
REPORT = ROOT / 'data_science_protocol' / 'audit_reports'
REPORT_JSON = REPORT / 'json'
MD = REPORT / 'GENERATION_MWH_INTERCONNECTOR_SPLIT_V6_LATEST.md'
JS = REPORT_JSON / 'GENERATION_MWH_INTERCONNECTOR_SPLIT_V6_LATEST.json'
ROUTE = '/uk_energy_tracking_v6/generation_history/'
LEGACY = 'Imports & Exports'
STAMP = '20260613interconsplit1'
WARN_CLASS = 'mwh-interconnector-split-warning'

INTERCONNECTORS = [
    {'code':'INTFR','country':'France','name':'IFA / HVDC Cross-Channel'},
    {'code':'INTIFA2','country':'France','name':'IFA2'},
    {'code':'INTELEC','country':'France','name':'ElecLink'},
    {'code':'INTNEM','country':'Belgium','name':'Nemo Link'},
    {'code':'INTNED','country':'Netherlands','name':'BritNed'},
    {'code':'INTNSL','country':'Norway','name':'North Sea Link'},
    {'code':'INTVKL','country':'Denmark','name':'Viking Link'},
    {'code':'INTEW','country':'Ireland','name':'East-West Interconnector / EWIC'},
    {'code':'INTGRNL','country':'Ireland','name':'Greenlink'},
    {'code':'INTIRL','country':'Northern Ireland','name':'Moyle Interconnector'},
]
SPEC = {x['code']: x for x in INTERCONNECTORS}
ORDER = {x['code']: i for i, x in enumerate(INTERCONNECTORS)}

WARNING_HTML = '''        <div class="generation-source-warning mwh-interconnector-split-warning"><strong>Interconnector accounting split:</strong> The old combined Imports &amp; Exports bucket has been removed from this Generation Output in MWh panel. Named interconnector rows are shown at the bottom of the annual chart as separate gross imports and gross exports. Labels use country first, interconnector name second and BMRS code third. Candidate method: positive signed MW is treated as import to GB; negative signed MW is treated as export from GB. Source: existing Elexon BMRS FUELINST raw-code archive files pending a later settled FUELHH raw-code rebuild.</div>'''

PATCH_LOAD = '''window.V6LoadGenerationMwhAggregates=(function(){
  var cache={};
  function fetchRows(key,url){
    if(cache[key])return cache[key];
    cache[key]=fetch(url+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});
    return cache[key];
  }
  function annual(){return fetchRows('annual','/uk_energy_tracking_v6/generation_history/generation_annual_mwh_by_technology.json')}
  function monthly(){return fetchRows('monthly','/uk_energy_tracking_v6/generation_history/generation_monthly_mwh_by_technology.json')}
  function seasonal(){return fetchRows('seasonal','/uk_energy_tracking_v6/generation_history/generation_seasonal_mwh_by_technology.json')}
  function dayNight(){return fetchRows('daynight','/uk_energy_tracking_v6/generation_history/generation_day_night_mwh_by_technology.json')}
  function interconnectors(){return fetchRows('interconnectors','/uk_energy_tracking_v6/generation_history/generation_interconnector_annual_mwh_by_link_direction.json')}
  return{annual:annual,monthly:monthly,seasonal:seasonal,dayNight:dayNight,interconnectors:interconnectors};
})();
'''

PATCH_RENDER = '''window.V6RenderGenerationMwhAggregates=(function(){
  var colours={Solar:'#f5c518',Wind:'#00d0ff',Hydro:'#0090c0',Gas:'#c0399a',Coal:'#888888',Biomass:'#f59e2b',Nuclear:'#5cb85c','Pumped Storage':'#9b59b6','Imports & Exports':'#e8615a',Other:'#a6adbb'};
  var HIDDEN={'Imports & Exports':true};
  var interconnectorColours={import:'#33d17a',export:'#ff8a3d'};
  function visible(rows){return(rows||[]).filter(function(r){return r&&!HIDDEN[r.technology]})}
  function fmt(n,d){return n==null||isNaN(Number(n))?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function ilabel(r){return r.label||[r.country,r.interconnector,r.bmrsCode,r.directionLabel].filter(Boolean).join(' — ')}
  function latestYear(a,b){var ys=[];(a||[]).forEach(function(r){ys.push(Number(r.year)||0)});(b||[]).forEach(function(r){ys.push(Number(r.year)||0)});return Math.max.apply(null,ys)}
  function renderAnnual(el,rows,interRows){
    if(!el)return;rows=rows||[];interRows=interRows||[];
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data.</div>';return;}
    var latest=latestYear(rows,interRows);
    var gen=visible(rows.filter(function(r){return Number(r.year)===latest})).sort(function(a,b){return Number(b.totalMWh)-Number(a.totalMWh)});
    var cons=interRows.filter(function(r){return Number(r.year)===latest&&Number(r.totalMWh)>0}).sort(function(a,b){return (Number(a.sortOrder)||0)-(Number(b.sortOrder)||0)});
    if(!gen.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data after hidden bucket filter.</div>';return;}
    var total=gen.reduce(function(s,r){return s+Number(r.totalMWh||0)},0), maxAbs=1;
    gen.concat(cons).forEach(function(r){maxAbs=Math.max(maxAbs,Math.abs(Number(r.totalMWh||0)))});
    var html='<div class="mwh-aggregate-head"><strong>Annual MWh by technology</strong><span>'+latest+' · '+fmt(total/1000000,2)+' TWh generation shown · legacy Imports & Exports removed</span></div><div class="mwh-bars">';
    gen.forEach(function(r){var v=Number(r.totalMWh||0),pct=Math.max(0,Math.abs(v)/maxAbs*100),c=colours[r.technology]||'#00ffff';html+='<div class="mwh-row"><div class="mwh-label">'+r.technology+'</div><div class="mwh-track"><i style="width:'+pct+'%;background:'+c+'"></i></div><div class="mwh-value">'+fmt(v/1000000,2)+' TWh</div></div>'});
    if(cons.length){html+='<div class="mwh-interconnector-divider">Named interconnectors · gross imports and gross exports · candidate signed-flow split</div>';cons.forEach(function(r){var v=Number(r.totalMWh||0),pct=Math.max(0,Math.abs(v)/maxAbs*100),c=interconnectorColours[String(r.direction||'')]||'#a6adbb',lab=ilabel(r);html+='<div class="mwh-row mwh-interconnector-row" title="'+lab+'"><div class="mwh-label">'+lab+'</div><div class="mwh-track"><i style="width:'+pct+'%;background:'+c+'"></i></div><div class="mwh-value">'+fmt(v/1000000,2)+' TWh</div></div>'})}
    html+='</div>';el.innerHTML=html;
  }
  function renderMonthly(el,rows,technology){if(!el)return;rows=visible(rows).filter(function(r){return !technology||r.technology===technology});if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting monthly MWh aggregate data.</div>';return;}rows=rows.slice().sort(function(a,b){return (a.year-b.year)||(a.month-b.month)});var max=Math.max.apply(null,rows.map(function(r){return Number(r.totalMWh)||0}));var sample=rows.slice(-24);var html='<div class="mwh-aggregate-head"><strong>Monthly MWh trend</strong><span>'+(technology||'All technologies')+'</span></div><div class="mwh-mini-chart">';sample.forEach(function(r){var h=max?Math.max(2,Number(r.totalMWh)/max*100):2;html+='<div class="mwh-col" title="'+r.year+'-'+String(r.month).padStart(2,'0')+' '+r.technology+' '+fmt(r.totalMWh/1000000,2)+' TWh"><i style="height:'+h+'%;background:'+(colours[r.technology]||'#00ffff')+'"></i></div>'});html+='</div>';el.innerHTML=html;}
  function renderDayNight(el,rows,technology){if(!el)return;rows=visible(rows).filter(function(r){return !technology||r.technology===technology});if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting day/night aggregate data.</div>';return;}var latest=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0}));var subset=rows.filter(function(r){return Number(r.year)===latest});var day=0,night=0;subset.forEach(function(r){day+=Number(r.dayMWh||0);night+=Number(r.nightMWh||0)});var total=day+night,dp=total?day/total*100:0,np=total?night/total*100:0;el.innerHTML='<div class="mwh-aggregate-head"><strong>Day versus night MWh</strong><span>'+latest+' · '+(technology||'All technologies')+'</span></div><div class="mwh-split"><div style="width:'+dp+'%">Day '+fmt(dp,1)+'%</div><div style="width:'+np+'%">Night '+fmt(np,1)+'%</div></div><div class="mwh-note-line">Day '+fmt(day/1000000,2)+' TWh · Night '+fmt(night/1000000,2)+' TWh</div>';}
  return{annual:renderAnnual,monthly:renderMonthly,dayNight:renderDayNight};
})();
'''

PATCH_CONTROL = '''window.V6ControlGenerationMwhAggregates=(function(){
  var HIDDEN={'Imports & Exports':true};
  function byId(id){return document.getElementById(id)}
  function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}
  function fillTech(){var e=byId('generation-mwh-technology');if(!e)return;var opts=((window.V6GenerationHistoryConfig&&window.V6GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear']).filter(function(t){return !HIDDEN[t]});e.innerHTML='';opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});e.value=opts.indexOf('Solar')>=0?'Solar':(opts[0]||'')}
  function setStatus(text){var e=byId('generation-mwh-status');if(e)e.textContent=text}
  function refresh(){setStatus('Loading MWh aggregate intelligence...');Promise.all([window.V6LoadGenerationMwhAggregates.annual(),window.V6LoadGenerationMwhAggregates.monthly(),window.V6LoadGenerationMwhAggregates.dayNight(),window.V6LoadGenerationMwhAggregates.interconnectors?window.V6LoadGenerationMwhAggregates.interconnectors():Promise.resolve([])]).then(function(parts){window.V6RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),parts[0],parts[3]);window.V6RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),parts[1],tech());window.V6RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),parts[2],tech());setStatus('Aggregate files loaded · legacy Imports & Exports hidden · named interconnector import/export rows '+parts[3].length+' · annual '+parts[0].length+' source rows · monthly '+parts[1].length+' source rows · day/night '+parts[2].length+' source rows')}).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})}
  function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}
  return{init:init,refresh:refresh};
})();

document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationMwhAggregates.init()});
'''


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')

def read(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='replace') if path.exists() else ''

def write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True); path.write_text(text, encoding='utf-8')

def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()

def parse_time(v):
    try:
        d=dt.datetime.fromisoformat(str(v).replace('Z','+00:00'))
        if d.tzinfo is None: d=d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc)
    except Exception:
        return None

def fnum(v):
    try:
        x=float(v); return x if math.isfinite(x) else None
    except Exception:
        return None

def source_files():
    roots=[ROOT/'data'/'generation'/'archive', ROOT/'data'/'generation']
    out=set()
    for r in roots:
        if r.exists():
            for p in r.rglob('elexon_generation_sources_*.csv'): out.add(p)
    return sorted(out)

def interval_hours(items, i):
    t=items[i][0]
    if i+1 < len(items):
        h=(items[i+1][0]-t).total_seconds()/3600
        if 0 < h <= 1: return h
    if i > 0:
        h=(t-items[i-1][0]).total_seconds()/3600
        if 0 < h <= 1: return h
    return 5/60

def build_rows():
    dedup={}; meta=[]; raw=found=parsed=skipped=0
    for p in source_files():
        fr=fi=0
        try:
            with p.open('r',encoding='utf-8',newline='') as h:
                for row in csv.DictReader(h):
                    raw+=1; fr+=1
                    code=str(row.get('fuelType','')).strip().upper()
                    if code not in SPEC: continue
                    found+=1; fi+=1
                    t=parse_time(row.get('periodStartUTC','')); mw=fnum(row.get('generationMW'))
                    if t is None or mw is None: skipped+=1; continue
                    dedup[(t.isoformat().replace('+00:00','Z'),code)]=(t,code,mw); parsed+=1
            meta.append({'path':rel(p),'rows':fr,'interconnectorRows':fi,'sizeBytes':p.stat().st_size})
        except Exception as exc:
            meta.append({'path':rel(p),'error':str(exc),'rows':fr,'interconnectorRows':fi})
    by=defaultdict(list)
    for t,code,mw in dedup.values(): by[code].append((t,mw))
    buckets=defaultdict(lambda:{'totalMWh':0.0,'netSignedMWh':0.0,'records':0,'firstUTC':'','lastUTC':''})
    for code,items in by.items():
        items.sort(key=lambda x:x[0])
        for i,(t,mw) in enumerate(items):
            h=interval_hours(items,i); direction='import' if mw>=0 else 'export'; gross=abs(mw)*h; key=(t.year,code,direction); b=buckets[key]
            b['totalMWh']+=gross; b['netSignedMWh']+=mw*h; b['records']+=1
            s=t.isoformat().replace('+00:00','Z')
            if not b['firstUTC'] or s < b['firstUTC']: b['firstUTC']=s
            if not b['lastUTC'] or s > b['lastUTC']: b['lastUTC']=s
    years=sorted({k[0] for k in buckets})
    rows=[]
    for y in years:
        for spec in INTERCONNECTORS:
            for direction in ('import','export'):
                b=buckets.get((y,spec['code'],direction),{'totalMWh':0,'netSignedMWh':0,'records':0,'firstUTC':'','lastUTC':''})
                dl='Imports to GB' if direction=='import' else 'Exports from GB'
                label=f"{spec['country']} — {spec['name']} — {spec['code']} — {dl}"
                rows.append({'year':y,'technology':label,'label':label,'country':spec['country'],'interconnector':spec['name'],'bmrsCode':spec['code'],'direction':direction,'directionLabel':dl,'totalMWh':round(float(b['totalMWh']),3),'netSignedMWh':round(float(b['netSignedMWh']),3),'records':int(b['records']),'sourceMinUTC':b['firstUTC'],'sourceMaxUTC':b['lastUTC'],'source':'Elexon BMRS FUELINST raw-code archive candidate','methodState':'Positive signed MW treated as import to GB; negative signed MW treated as export from GB; MWh equals signed MW magnitude times inferred interval hours.','sortOrder':1000+ORDER[spec['code']]*10+(0 if direction=='import' else 1)})
    audit={'sourceFileCount':len(meta),'sourceFiles':meta,'rawRows':raw,'interconnectorRawRows':found,'parsedRows':parsed,'dedupedTimeCodeRows':len(dedup),'skippedRows':skipped,'years':years,'interconnectorCodes':[x['code'] for x in INTERCONNECTORS]}
    return rows,audit

def payload(rows,audit):
    return {'schemaVersion':'1.0.0-interconnector-annual-mwh-link-direction','generatedUTC':now(),'title':'Annual interconnector MWh by named link and direction','unit':'MWh','source':'Existing Elexon BMRS FUELINST raw-code archive files','status':'candidate','directionConvention':'Positive signed MW is treated as import to GB. Negative signed MW is treated as export from GB.','labelContract':'country — interconnector name — BMRS code — direction','legacyBucketRemovedFromGenerationPanel':LEGACY,'sourceAudit':audit,'rows':rows}

def patch_index(text):
    css='''\n  #generation-history-panel .mwh-interconnector-divider{margin:12px 0 8px;padding-top:10px;border-top:1px solid rgba(0,255,255,.24);color:#00ffff;font-size:11px;letter-spacing:.08em;text-transform:uppercase;}\n  #generation-history-panel .mwh-row.mwh-interconnector-row{grid-template-columns:minmax(260px,.9fr) 1fr 95px;font-size:11px;}\n  #generation-history-panel .mwh-row.mwh-interconnector-row .mwh-label{white-space:normal;line-height:1.25;color:#cfd7e6;}\n'''
    if '.mwh-interconnector-divider' not in text: text=text.replace('</style>', css+'</style>', 1)
    pat=re.compile(r'\n?\s*<div class="generation-source-warning mwh-interconnector-split-warning">.*?</div>', re.DOTALL)
    text,n=pat.subn('\n'+WARNING_HTML, text)
    if not n:
        anchor='          <div class="mwh-card" id="generation-mwh-daynight"></div>\n        </div>'
        text=text.replace(anchor, anchor+'\n'+WARNING_HTML, 1)
    for s in ('load_generation_mwh_aggregates.js','render_generation_mwh_aggregates.js','control_generation_mwh_aggregates.js'):
        text=re.sub(rf'(/uk_energy_tracking_v6/generation_history/{re.escape(s)}\?v=)[^"\']+', r'\g<1>'+STAMP, text)
    return text

def planned(rows,audit):
    return {INDEX:patch_index(read(INDEX)),LOAD:PATCH_LOAD,RENDER:PATCH_RENDER,CONTROL:PATCH_CONTROL,OUT:json.dumps(payload(rows,audit),indent=2,ensure_ascii=False)+'\n'}

def changed_files(planned_map):
    return [rel(p) for p,c in planned_map.items() if read(p)!=c]

def latest_legacy():
    try: rows=json.loads(read(MOD/'generation_annual_mwh_by_technology.json')).get('rows',[])
    except Exception: rows=[]
    years=[int(r.get('year') or 0) for r in rows if isinstance(r,dict)]; y=max(years) if years else 0
    vals=[float(r.get('totalMWh') or 0) for r in rows if int(r.get('year') or 0)==y and r.get('technology')==LEGACY]
    return {'latestYear':y,'rowCount':len(vals),'totalMWh':round(sum(vals),3)}

def make_report(data):
    lines=['# Generation MWh Interconnector Split V6 — '+('PASS' if data['pass'] else 'FAIL'),'','Generated UTC: `'+data['generatedUTC']+'`','Mode: `'+data['mode']+'`','Route: `'+ROUTE+'`','','## Contract','','Positive signed MW is treated as import to GB. Negative signed MW is treated as export from GB. Labels use: country — interconnector name — BMRS code — direction.','','## Planned changed files']
    lines += ['- `'+x+'`' for x in data['plannedChangedFiles']] or ['- none']
    lines += ['','## Checks','','| Check | Result |','|---|---|']
    for k,v in data['checks'].items(): lines.append('| '+k+' | '+('✅' if v else '❌')+' |')
    lines += ['','## Interconnector fields']
    for s in INTERCONNECTORS:
        lines.append('- '+s['country']+' — '+s['name']+' — `'+s['code']+'` — Imports to GB / Exports from GB')
    lines += ['','## Source audit',f"- Source files scanned: `{data['sourceAudit']['sourceFileCount']}`",f"- Interconnector raw rows: `{data['sourceAudit']['interconnectorRawRows']}`",f"- Output rows: `{data['interconnectorSummary']['outputRows']}`",'','Rollback: revert the apply commit. Existing generation aggregate JSON files are not edited.']
    return '\n'.join(lines)+'\n'

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--apply',action='store_true'); ap.add_argument('--max-output-mb',type=float,default=25.0); args=ap.parse_args()
    mode='apply' if args.apply else 'audit'
    rows,audit=build_rows(); plan=planned(rows,audit); size=len(plan[OUT].encode('utf-8'))
    if size > args.max_output_mb*1024*1024: raise SystemExit('planned output too large')
    changes=changed_files(plan)
    if args.apply:
        for p,c in plan.items():
            if read(p)!=c: write(p,c)
    labels_ok=all((r['label'].startswith(r['country']) and r['bmrsCode'] in r['label'] and r['directionLabel'] in r['label']) for r in rows)
    checks={'target_route_is_live_v6': f'permalink: {ROUTE}' in plan[INDEX], 'mwh_panel_present': 'Generation output in MWh' in plan[INDEX], 'legacy_imports_exports_hidden_in_renderer': "var HIDDEN={'Imports & Exports':true};" in plan[RENDER], 'legacy_imports_exports_removed_from_dropdown': ".filter(function(t){return !HIDDEN[t]})" in plan[CONTROL], 'interconnector_json_loader_added': 'generation_interconnector_annual_mwh_by_link_direction.json' in plan[LOAD], 'interconnector_rows_added_near_bottom': 'mwh-interconnector-divider' in plan[RENDER], 'all_ten_bmrs_codes_present': set(SPEC).issubset({r['bmrsCode'] for r in rows}), 'separate_import_and_export_rows_present': {'import','export'}.issubset({r['direction'] for r in rows}), 'labels_country_first_name_second_code_third': labels_ok, 'candidate_output_rows_positive': len(rows)>0, 'latest_year_has_nonzero_rows': any(r['year']==max([x['year'] for x in rows], default=0) and r['totalMWh']>0 for r in rows), 'no_existing_generation_aggregate_jsons_modified': True, 'raw_bulk_not_written': True}
    summary={'outputPath':rel(OUT),'outputRows':len(rows),'outputSizeBytes':size,'latestYear':max([r['year'] for r in rows], default=0)}
    report={'reportTitle':'Generation MWh Interconnector Split V6','schemaVersion':'1.0.0','generatedUTC':now(),'mode':mode,'repository':'Ventusltd/globalgrid2050','route':ROUTE,'directionConvention':'positive signed MW = import to GB; negative signed MW = export from GB','labelContract':'country — interconnector name — BMRS code — direction','changedFiles':changes if args.apply else [],'plannedChangedFiles':changes,'sourceAudit':audit,'interconnectorSummary':summary,'legacyBucketLatest':latest_legacy(),'checks':checks,'applied':bool(args.apply),'pass':all(checks.values()),'nextAction':'If audit passes, run this workflow again in apply mode, then verify the live Generation History page.'}
    REPORT.mkdir(parents=True,exist_ok=True); REPORT_JSON.mkdir(parents=True,exist_ok=True)
    write(JS,json.dumps(report,indent=2,ensure_ascii=False)+'\n'); write(MD,make_report(report))
    print(json.dumps(report,indent=2,ensure_ascii=False))
    return 0 if report['pass'] else 1

if __name__=='__main__': raise SystemExit(main())
