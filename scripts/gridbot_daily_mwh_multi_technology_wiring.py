#!/usr/bin/env python3
from __future__ import annotations
import argparse, datetime as dt, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
IDX=ROOT/'uk_energy_tracking_v6'/'generation_history'/'index.md'
CTL=ROOT/'uk_energy_tracking_v6'/'generation_history'/'control_solar_daily_mwh_chart.js'
RND=ROOT/'uk_energy_tracking_v6'/'generation_history'/'render_solar_daily_mwh_chart.js'
SOL=ROOT/'uk_energy_tracking_v6'/'generation_history'/'pvlive_solar_daily_browser.json'
FUEL=ROOT/'uk_energy_tracking_v6'/'generation_history'/'generation_daily_mwh_by_technology_fuelhh_2016_2026.json'
RD=ROOT/'data_science_protocol'/'audit_reports'; RJD=RD/'json'; STEM='DAILY_MWH_MULTI_TECH_WIRING'
NEW_HEAD="""window.V6ControlSolarDailyMwhChart=(function(){
  var cache={};
  function cfg(){return window.V6GenerationHistoryConfig||{}}
  function get(id){return document.getElementById(id)}
  function load(key,url){if(cache[key])return cache[key];cache[key]=fetch(url+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});return cache[key]}
  function loadSolarDaily(){return load('solar',(cfg().solarDaily||'/uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json'))}
  function loadFuelDaily(){return load('fuel','/uk_energy_tracking_v6/generation_history/generation_daily_mwh_by_technology_fuelhh_2016_2026.json')}
  function periodDays(p){return{'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[p]||366}
  function niceDate(v){var d=v instanceof Date?v:new Date(String(v));return isNaN(d.getTime())?'—':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
  function years(rows){var out={};rows.forEach(function(r){if(r&&r.date)out[String(r.date).slice(0,4)]=true});return Object.keys(out).sort()}
  function srcLabel(t){return t==='Solar'?'PVLive stored energy':'Elexon FUELHH derived energy'}
  function srcStatus(t){return t==='Solar'?'SHEFFIELD SOLAR PVLIVE STORED MWH':'ELEXON FUELHH DERIVED DAILY MWH'}
  function techOptions(fuelRows){var el=get('solar-daily-mwh-technology');if(!el||el.dataset.multiReady==='1')return;var seen={Solar:true};fuelRows.forEach(function(r){if(r&&r.technology)seen[String(r.technology)]=true});var pref=['Solar','Wind','Gas','Nuclear','Coal','Hydro','Imports & Exports','Biomass','Storage','Pumped Storage','Other'];var vals=[];pref.forEach(function(t){if(seen[t])vals.push(t)});Object.keys(seen).sort().forEach(function(t){if(vals.indexOf(t)<0)vals.push(t)});el.innerHTML='';vals.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;el.appendChild(o)});el.value='Solar';el.dataset.multiReady='1'}
  function rowsFor(t,solar,fuel){var rows=t==='Solar'?solar:fuel.filter(function(r){return r&&String(r.technology)===t});return rows.filter(function(r){return r&&r.mwh!=null&&!isNaN(Number(r.mwh))}).map(function(r){var x=Object.assign({},r);x.technology=t;x.sourceLabel=srcLabel(t);return x})}
  function setYears(rows,t){var y=get('solar-daily-mwh-year'),s=get('solar-daily-mwh-start');if(!y||!s)return;var key=t+'-'+rows.length;if(y.dataset.readyKey===key)return;var old=y.value,ys=years(rows);y.innerHTML='';ys.forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;y.appendChild(o)});y.value=ys.indexOf(old)>=0?old:(ys[ys.length-1]||String(new Date().getUTCFullYear()));s.value=y.value+'-01-01';y.dataset.readyKey=key}
  function selectedWindow(rows,t){var y=get('solar-daily-mwh-year'),s=get('solar-daily-mwh-start'),p=get('solar-daily-mwh-period');setYears(rows,t);var period=p?p.value:'12m',st=s&&s.value?s.value:((y&&y.value?y.value:String(new Date().getUTCFullYear()))+'-01-01'),start=new Date(st+'T00:00:00Z'),end;if(period==='all'){var v=rows.filter(function(r){return r&&r.date});start=new Date((v[0]?v[0].date:st)+'T00:00:00Z');end=new Date((v[v.length-1]?v[v.length-1].date:st)+'T23:59:59Z')}else end=new Date(start.getTime()+periodDays(period)*86400000-1000);return{start:start,end:end,period:period}}
  function update(){var panel=get('solar-daily-mwh-panel'),canvas=get('solar-daily-mwh-canvas'),status=get('solar-daily-mwh-status'),techEl=get('solar-daily-mwh-technology');if(!panel||!canvas||!status||!window.V6RenderSolarDailyMwhChart)return;panel.style.display='block';Promise.all([loadSolarDaily(),loadFuelDaily()]).then(function(d){var solar=d[0]||[],fuel=d[1]||[];techOptions(fuel);var t=techEl?techEl.value:'Solar',all=rowsFor(t,solar,fuel);setYears(all,t);var m=selectedWindow(all,t),rows=all.filter(function(r){var x=new Date(r.date+'T12:00:00Z');return x>=m.start&&x<=m.end});status.textContent=t.toUpperCase()+' DAILY MWH · '+rows.length+' RECORDS · '+niceDate(m.start)+' TO '+niceDate(m.end)+' · '+srcStatus(t);window.V6RenderSolarDailyMwhChart.render(canvas,{rows:rows,start:m.start,end:m.end,period:m.period,technology:t,sourceLabel:srcLabel(t)})})}
  function boot(){Promise.all([loadSolarDaily(),loadFuelDaily()]).then(function(d){techOptions(d[1]||[]);update()});['solar-daily-mwh-technology','solar-daily-mwh-year','solar-daily-mwh-start','solar-daily-mwh-period'].forEach(function(id){var el=get(id);if(el)el.addEventListener('change',function(){if(id==='solar-daily-mwh-year'){var s=get('solar-daily-mwh-start');if(s&&el.value)s.value=el.value+'-01-01'}setTimeout(update,60)})});window.addEventListener('resize',function(){setTimeout(update,80)});setTimeout(update,300);setTimeout(update,1200)}
  return{boot:boot,update:update};
})();
document.addEventListener('DOMContentLoaded',function(){if(window.V6ControlSolarDailyMwhChart)window.V6ControlSolarDailyMwhChart.boot()});"""
def now(): return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')
def stamp(): return dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
def rel(p): return p.relative_to(ROOT).as_posix()
def patch_control(t):
    marker='\n\n// Solar daily MWh fullscreen and period interaction bridge'
    if marker not in t: return t,['control bridge marker']
    return NEW_HEAD+marker+t.split(marker,1)[1],[]
def patch_render(t):
    miss=[]
    a="ctx.fillText('SOLAR DAILY MWh · PVLive stored energy',18*q,28*q,w-36*q);"
    b="var chartTitle=(result.technology||'Solar').toUpperCase()+' DAILY MWh · '+(result.sourceLabel||'PVLive stored energy');ctx.fillText(chartTitle,18*q,28*q,w-36*q);"
    if a in t: t=t.replace(a,b,1)
    else: miss.append('render title marker')
    a="ctx.fillText('Awaiting Solar daily MWh data.',18*q,90*q);return}"
    b="ctx.fillText('Awaiting selected daily MWh data.',18*q,90*q);return}"
    if a in t: t=t.replace(a,b,1)
    else: miss.append('render empty marker')
    return t,miss
def patch_index(t):
    miss=[]
    render_done=False; control_done=False
    for a in ['20260611mwhlabels1','20260610solarmwh4']:
        old='render_solar_daily_mwh_chart.js?v='+a
        if old in t: t=t.replace(old,'render_solar_daily_mwh_chart.js?v=20260611mwhmulti1',1); render_done=True
    for a in ['20260611mwhlabels1','20260610solarmwh2']:
        old='control_solar_daily_mwh_chart.js?v='+a
        if old in t: t=t.replace(old,'control_solar_daily_mwh_chart.js?v=20260611mwhmulti1',1); control_done=True
    if not render_done: miss.append('index render cache marker')
    if not control_done: miss.append('index control cache marker')
    return t,miss
def report_write(r):
    RD.mkdir(parents=True,exist_ok=True); RJD.mkdir(parents=True,exist_ok=True); s=stamp()
    md='\n'.join(['# Daily MWh Multi Technology Wiring','',f"Generated UTC: `{r['generatedUTC']}`",f"Mode: `{r['mode']}`",f"Changed files: `{', '.join(r['changedFiles'])}`",f"Pass: `{r['pass']}`",'','Wires Solar to PVLive and Elexon technologies to the audited daily MWh file. No data files are modified.'])+'\n'
    for p in (RD/f'{STEM}_{s}.md',RD/f'{STEM}_LATEST.md'): p.write_text(md,encoding='utf-8')
    js=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    for p in (RJD/f'{STEM}_{s}.json',RJD/f'{STEM}_LATEST.json'): p.write_text(js,encoding='utf-8')
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--apply',action='store_true'); args=ap.parse_args()
    ci,ri,ii=CTL.read_text(encoding='utf-8'),RND.read_text(encoding='utf-8'),IDX.read_text(encoding='utf-8')
    co,m1=patch_control(ci); ro,m2=patch_render(ri); io,m3=patch_index(ii); missing=m1+m2+m3
    checks={'solar_file_exists':SOL.exists(),'elexon_daily_mwh_file_exists':FUEL.exists(),'control_wires_solar_pvlive':'pvlive_solar_daily_browser.json' in co,'control_wires_elexon_daily_mwh':'generation_daily_mwh_by_technology_fuelhh_2016_2026.json' in co,'chart_uses_mwh':'r.mwh!=null' in co,'dropdown_populates_elexon_tech':'techOptions' in co and 'fuelRows.forEach' in co,'source_labels_distinguish_methods':'PVLive stored energy' in co and 'Elexon FUELHH derived energy' in co,'render_title_dynamic':'chartTitle' in ro,'index_cache_busters_updated':'20260611mwhmulti1' in io,'all_markers_found':len(missing)==0,'no_data_files_changed_by_script':True}
    changed=[]
    if co!=ci: changed.append(rel(CTL))
    if ro!=ri: changed.append(rel(RND))
    if io!=ii: changed.append(rel(IDX))
    passed=all(checks.values()) and len(changed)==3
    if args.apply and passed:
        CTL.write_text(co,encoding='utf-8'); RND.write_text(ro,encoding='utf-8'); IDX.write_text(io,encoding='utf-8')
    r={'reportTitle':'Daily MWh Multi Technology Wiring','schemaVersion':'1.0.0','generatedUTC':now(),'mode':'apply' if args.apply else 'audit','changedFiles':changed,'missingMarkers':missing,'checks':checks,'pass':passed,'applied':bool(args.apply and passed),'nextAction':'Run apply only after audit and human review.' if not args.apply else 'Open Solar, Wind, Gas and Nuclear chart selections.'}
    report_write(r)
    if not passed: raise SystemExit('daily MWh multi technology wiring checks failed')
    return 0
if __name__=='__main__': raise SystemExit(main())
