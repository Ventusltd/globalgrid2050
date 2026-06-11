#!/usr/bin/env python3
from __future__ import annotations
import argparse, datetime as dt, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
R=ROOT/'uk_energy_tracking_v6'/'generation_history'/'render_solar_daily_mwh_chart.js'
I=ROOT/'uk_energy_tracking_v6'/'generation_history'/'index.md'
RD=ROOT/'data_science_protocol'/'audit_reports'; RJD=RD/'json'; STEM='DAILY_MWH_SEASONAL_COLOURING'
ADD="""function seasonName(t){var m=new Date(t).getUTCMonth()+1;if(m===12||m<=2)return'Winter';if(m>=3&&m<=5)return'Spring';if(m>=6&&m<=8)return'Summer';return'Autumn'}
  function seasonColor(t){var s=seasonName(t);if(s==='Winter')return'#00ffff';if(s==='Spring')return'#00ff88';if(s==='Summer')return'#ffcc00';return'#c79245'}
  function drawSeasonKey(g,q,pad){var items=[['Winter','#00ffff'],['Spring','#00ff88'],['Summer','#ffcc00'],['Autumn','#c79245']],x=pad.left,y=pad.top-28*q;g.save();g.font=9*q+'px Courier New';items.forEach(function(it){g.fillStyle=it[1];g.shadowColor=it[1];g.shadowBlur=4*q;g.fillRect(x,y-7*q,8*q,8*q);g.shadowBlur=0;g.fillStyle='#9aa3b6';g.fillText(it[0],x+12*q,y);x+=58*q});g.restore()}
  function drawSeasonLine(g,rows,p,q){g.save();g.lineWidth=2.15*q;g.lineCap='round';g.lineJoin='round';for(var i=1;i<rows.length;i++){var a=rows[i-1],b=rows[i],col=seasonColor(tm(b));g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=8*q;g.beginPath();g.moveTo(p.X(a),p.Y(val(a)));g.lineTo(p.X(b),p.Y(val(b)));g.stroke()}g.restore()}"""
def now(): return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')
def stamp(): return dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
def rel(p): return p.relative_to(ROOT).as_posix()
def patch_render(t):
    miss=[]
    if 'function seasonName(' not in t:
        marker="function drawTicks(g,w,h,q,scale,pad,t0,t1){"
        if marker in t: t=t.replace(marker,ADD+'\n  '+marker,1)
        else: miss.append('drawTicks marker')
    old="var pad=isFull?(cssW>cssH?{left:72*q,right:44*q,top:72*q,bottom:58*q}:{left:78*q,right:38*q,top:96*q,bottom:170*q}):{left:(cssW<520?86:96)*q,right:(cssW<520?48:72)*q,top:76*q,bottom:(cssW<620?150:116)*q},t0=result.start.getTime(),t1=result.end.getTime(),scale=mm(rows),p=points(w,h,pad,scale,t0,t1),c='#f5c518';drawTicks(ctx,w,h,q,scale,pad,t0,t1);ctx.save();ctx.strokeStyle=c;ctx.lineWidth=2.15*q;ctx.shadowColor=c;ctx.shadowBlur=9*q;ctx.beginPath();rows.forEach(function(r,i){var x=p.X(r),y=p.Y(val(r));if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();ctx.restore();var s=stats(rows);"
    new="var pad=isFull?(cssW>cssH?{left:72*q,right:44*q,top:72*q,bottom:58*q}:{left:78*q,right:38*q,top:96*q,bottom:170*q}):{left:(cssW<520?86:96)*q,right:(cssW<520?48:72)*q,top:76*q,bottom:(cssW<620?150:116)*q},t0=result.start.getTime(),t1=result.end.getTime(),scale=mm(rows),p=points(w,h,pad,scale,t0,t1);drawTicks(ctx,w,h,q,scale,pad,t0,t1);drawSeasonKey(ctx,q,pad);drawSeasonLine(ctx,rows,p,q);var s=stats(rows);"
    if old in t: t=t.replace(old,new,1)
    elif 'drawSeasonLine(ctx,rows,p,q)' in t: pass
    else: miss.append('fixed yellow line marker')
    return t,miss
def patch_index(t):
    done=False
    for v in ['20260611mwhmulti1','20260611mwhlabels1','20260610solarmwh4']:
        old='render_solar_daily_mwh_chart.js?v='+v
        if old in t:
            t=t.replace(old,'render_solar_daily_mwh_chart.js?v=20260611mwhseason1',1); done=True
    return t,([] if done or '20260611mwhseason1' in t else ['index render cache marker'])
def write_report(r):
    RD.mkdir(parents=True,exist_ok=True); RJD.mkdir(parents=True,exist_ok=True); s=stamp()
    md='\n'.join(['# Daily MWh Seasonal Colouring','',f"Generated UTC: `{r['generatedUTC']}`",f"Mode: `{r['mode']}`",f"Changed files: `{', '.join(r['changedFiles'])}`",f"Pass: `{r['pass']}`",'','Adds V5 style season colours to the V6 daily generation energy chart. No data files are changed.'])+'\n'
    for p in (RD/f'{STEM}_{s}.md',RD/f'{STEM}_LATEST.md'): p.write_text(md,encoding='utf-8')
    js=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    for p in (RJD/f'{STEM}_{s}.json',RJD/f'{STEM}_LATEST.json'): p.write_text(js,encoding='utf-8')
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--apply',action='store_true'); args=ap.parse_args()
    rt=R.read_text(encoding='utf-8'); it=I.read_text(encoding='utf-8')
    nr,m1=patch_render(rt); ni,m2=patch_index(it); missing=m1+m2
    checks={'season_name_function_present':'function seasonName(' in nr,'season_colour_function_present':'function seasonColor(' in nr,'season_key_present':'drawSeasonKey' in nr,'season_line_present':'drawSeasonLine' in nr,'fixed_single_yellow_line_removed':"c='#f5c518'" not in nr,'high_low_markers_preserved':'HIGH DAY' in nr and 'LOW DAY' in nr,'selected_inspection_preserved':'SELECTED' in nr,'mwh_logic_preserved':'function val(r){return Number(r.mwh)}' in nr,'cache_buster_updated':'20260611mwhseason1' in ni,'all_markers_found':len(missing)==0,'no_data_files_changed_by_script':True}
    changed=[]
    if nr!=rt: changed.append(rel(R))
    if ni!=it: changed.append(rel(I))
    passed=all(checks.values()) and len(changed)>=1
    if args.apply and passed:
        R.write_text(nr,encoding='utf-8'); I.write_text(ni,encoding='utf-8')
    r={'reportTitle':'Daily MWh Seasonal Colouring','schemaVersion':'1.0.0','generatedUTC':now(),'mode':'apply' if args.apply else 'audit','changedFiles':changed,'missingMarkers':missing,'checks':checks,'pass':passed,'applied':bool(args.apply and passed),'nextAction':'Run apply after audit review.' if not args.apply else 'Open Daily Generation Energy Output and confirm seasonal colours and legend.'}
    write_report(r)
    if not passed: raise SystemExit('seasonal colouring checks failed')
    return 0
if __name__=='__main__': raise SystemExit(main())
