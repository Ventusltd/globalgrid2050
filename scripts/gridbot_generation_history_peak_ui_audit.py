#!/usr/bin/env python3
from __future__ import annotations

import argparse, hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RENDERER = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'render_generation_history_chart.js'
INDEX = ROOT / 'uk_energy_tracking_v6' / 'generation_history' / 'index.md'
REPORT = ROOT / 'data_science_protocol' / 'audit_reports' / 'GENERATION_HISTORY_PEAK_UI_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol' / 'audit_reports' / 'json' / 'GENERATION_HISTORY_PEAK_UI_LATEST.json'

NEW_RENDERER = r"""window.V6RenderGenerationHistoryChart=(function(){
  function fmt(n,d){return n==null||isNaN(Number(n))?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function niceDate(v){var d=v instanceof Date?v:new Date(String(v).replace(' ','T'));return isNaN(d.getTime())?'—':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
  function niceClock(v){var s=String(v||'');var m=s.match(/(\d{2}:\d{2})/);return m?m[1]:''}
  function isSolarDaily(result){return result&&result.mode==='daily'&&result.technology==='Solar'}
  function valueOf(r,mode){return mode==='daily'?Number(r.averageMW):Number(r.generationMW)}
  function highOf(r,result){return isSolarDaily(result)&&r.highMW!=null?Number(r.highMW):valueOf(r,result.mode)}
  function lowOf(r,result){return isSolarDaily(result)&&r.lowMW!=null?Number(r.lowMW):valueOf(r,result.mode)}
  function avgOf(r,result){return valueOf(r,result.mode)}
  function timeOf(r,mode){return mode==='daily'?r.date+'T12:00:00Z':r.time}
  function colour(tech){return {'Solar':'#f5c518','Wind':'#00d0ff','Hydro':'#0090c0','Gas':'#ff4fbf','Coal':'#888888','Biomass':'#f59e2b','Nuclear':'#5cff8d','Pumped Storage':'#b16cff','Imports & Exports':'#e8615a','Other':'#a6adbb','All generation total':'#00ffff'}[tech]||'#00ffff'}
  function compactMode(result){if(isSolarDaily(result))return 'Daily high · average · low';return result.mode==='daily'?'Daily average':'30 min output'}
  function dateLabel(t,span){var d=new Date(t);return span>45*86400000?d.toLocaleDateString('en-GB',{month:'short',year:'numeric'}):d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
  function shortTickLabel(t,span){var d=new Date(t);if(span<=2.1*86400000)return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}
  function stats(result){var rows=result.rows||[];if(!rows.length)return null;var h=rows[0],l=rows[0],s=0,n=0,mwh=0,samples=0,complete=0;rows.forEach(function(r){var av=avgOf(r,result),hi=highOf(r,result),lo=lowOf(r,result);if(!isNaN(av)){s+=av;n++}if(!isNaN(hi)&&hi>highOf(h,result))h=r;if(!isNaN(lo)&&lo<lowOf(l,result))l=r;if(r.mwh!=null&&!isNaN(Number(r.mwh)))mwh+=Number(r.mwh);if(r.sampleCount!=null&&!isNaN(Number(r.sampleCount)))samples+=Number(r.sampleCount);if(r.completeness!=null&&!isNaN(Number(r.completeness)))complete+=Number(r.completeness)});return n?{hi:h,lo:l,avg:s/n,totalMwh:mwh,samples:samples,meanCompleteness:complete&&n?complete/n:null,hiValue:highOf(h,result),loValue:lowOf(l,result),hiDate:niceDate(timeOf(h,result.mode)),loDate:niceDate(timeOf(l,result.mode)),hiClock:niceClock(timeOf(h,result.mode)),loClock:niceClock(timeOf(l,result.mode)),avgDate:niceDate(result.start)+' to '+niceDate(result.end)}:null}
  function minMax(rows,result){var lo=0,hi=0;rows.forEach(function(r){var vals=isSolarDaily(result)?[highOf(r,result),avgOf(r,result),lowOf(r,result)]:[valueOf(r,result.mode)];vals.forEach(function(v){if(isNaN(v))return;if(v<lo)lo=v;if(v>hi)hi=v})});if(lo===hi)hi=lo+1;var m=Math.max((hi-lo)*.10,50);return{lo:lo-m,hi:hi+m}}
  function step(span){var raw=span/5,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),n=raw/p;if(n<=1)return p;if(n<=2)return 2*p;if(n<=5)return 5*p;return 10*p}
  function drawTitle(g,result,q,w,pad,cssW){var c=colour(result.technology);g.save();g.font='900 '+(cssW<520?11:15)*q+'px Courier New';g.fillStyle='#00ffff';g.textAlign='left';var title=(cssW<520?'GB GEN · ':'GB GENERATION HISTORY · ')+(result.technology||'Technology')+' · '+compactMode(result);g.fillText(title,18*q,28*q);var lx=pad.left,ly=pad.top-24*q;g.shadowColor=c;g.shadowBlur=6*q;g.fillStyle=c;g.fillRect(lx,ly-8*q,9*q,9*q);g.shadowBlur=0;g.fillStyle='#9aa3b6';g.font=(cssW<520?9:10)*q+'px Courier New';g.fillText(result.technology||'Technology',lx+14*q,ly);g.fillText(compactMode(result),lx+(cssW<520?100:130)*q,ly);g.restore()}
  function drawTicks(g,w,h,q,mm,pad,t0,t1){var st=step(mm.hi-mm.lo),start=Math.ceil(mm.lo/st)*st,span=t1-t0,plotW=w-pad.left-pad.right;g.save();g.font=(w/q<520?9:11)*q+'px Courier New';for(var v=start;v<=mm.hi+st*.5;v+=st){var y=pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom);g.fillStyle='#d8deeb';g.textAlign='left';g.fillText(fmt(v,0)+' MW',8*q,y+4*q);g.strokeStyle='rgba(255,255,255,.055)';g.beginPath();g.moveTo(pad.left,y);g.lineTo(w-pad.right,y);g.stroke()}g.strokeStyle='rgba(255,255,255,.26)';g.beginPath();g.moveTo(pad.left,h-pad.bottom);g.lineTo(w-pad.right,h-pad.bottom);g.stroke();g.fillStyle='#d8deeb';g.textAlign='left';g.fillText(dateLabel(t0,span),pad.left,h-pad.bottom+24*q);g.textAlign='right';g.fillText(dateLabel(t1,span),w-pad.right,h-pad.bottom+24*q);if(span<=35*86400000){var interval=span<=2.1*86400000?6*3600000:86400000,first=Math.ceil(t0/interval)*interval;g.textAlign='center';for(var t=first;t<t1;t+=interval){var x=pad.left+((t-t0)/(t1-t0))*plotW;g.strokeStyle='rgba(255,255,255,.10)';g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.fillStyle='rgba(154,163,182,.75)';g.fillText(shortTickLabel(t,span),x,h-pad.bottom+42*q)}}g.restore()}
  function pointFns(result,w,h,pad,mm,t0,t1){var plotW=w-pad.left-pad.right,plotH=h-pad.top-pad.bottom;return{X:function(r){var t=new Date(timeOf(r,result.mode)).getTime();return pad.left+((t-t0)/(t1-t0))*plotW},Y:function(v){return pad.top+((mm.hi-v)/(mm.hi-mm.lo))*plotH}}}
  function callout(g,label,val,date,clock,x,y,q,w,h,pad,c){var left=x<w/2,tx=left?Math.min(w-pad.right-160*q,x+18*q):Math.max(pad.left+160*q,x-18*q),ty=Math.max(pad.top+54*q,Math.min(h-pad.bottom-28*q,y+(label.indexOf('PEAK')>=0?-24:58)*q));g.save();g.strokeStyle='#ff3333';g.lineWidth=1.4*q;g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty-24*q);g.stroke();var lines=[label,fmt(val,1)+' MW',date+(clock?' '+clock:'')],lh=17*q,bw=0;g.font='900 '+(w/q<520?10:13)*q+'px Courier New';lines.forEach(function(t){bw=Math.max(bw,g.measureText(t).width)});var padb=8*q,bh=lines.length*lh+padb*2,bx=left?tx:tx-bw-padb*2;g.fillStyle='rgba(5,7,12,.82)';g.strokeStyle='rgba(0,255,255,.45)';g.lineWidth=1*q;g.beginPath();g.roundRect(bx,ty-bh+4*q,bw+padb*2,bh,7*q);g.fill();g.stroke();g.fillStyle='#ff3333';g.textAlign=left?'left':'right';var textX=left?tx+padb:tx-padb;lines.forEach(function(t,i){g.fillText(t,textX,ty-(lines.length-1-i)*lh)});g.restore()}
  function drawSeries(g,rows,result,w,h,q,pad,mm,t0,t1,getter,stroke,fill,lineWidth,shadow){if(!rows.length)return;var p=pointFns(result,w,h,pad,mm,t0,t1);g.save();g.strokeStyle=stroke;g.lineWidth=lineWidth*q;g.shadowColor=shadow||stroke;g.shadowBlur=shadow?7*q:0;g.beginPath();rows.forEach(function(r,i){var x=p.X(r),y=p.Y(getter(r));if(i===0)g.moveTo(x,y);else g.lineTo(x,y)});g.stroke();g.shadowBlur=0;if(fill){g.globalAlpha=.08;g.lineTo(p.X(rows[rows.length-1]),p.Y(0));g.lineTo(p.X(rows[0]),p.Y(0));g.closePath();g.fillStyle=fill;g.fill();g.globalAlpha=1}g.restore()}
  function drawLegend(g,result,q,pad){if(!isSolarDaily(result))return;g.save();var x=pad.left,y=pad.top-4*q,items=[['High MW','#ff4444'],['Average MW','#f5c518'],['Low MW','#4fd1ff']];g.font=9*q+'px Courier New';items.forEach(function(it,i){var xx=x+i*96*q;g.fillStyle=it[1];g.fillRect(xx,y,9*q,9*q);g.fillStyle='#d8deeb';g.fillText(it[0],xx+14*q,y+8*q)});g.restore()}
  function drawLine(g,rows,result,w,h,q,pad,mm,t0,t1){if(!rows.length)return;var c=colour(result.technology),p=pointFns(result,w,h,pad,mm,t0,t1);if(isSolarDaily(result)){drawSeries(g,rows,result,w,h,q,pad,mm,t0,t1,function(r){return highOf(r,result)},'#ff4444',null,1.4,'rgba(255,64,64,.45)');drawSeries(g,rows,result,w,h,q,pad,mm,t0,t1,function(r){return avgOf(r,result)},c,'rgba(245,197,24,.35)',2.1,c);drawSeries(g,rows,result,w,h,q,pad,mm,t0,t1,function(r){return lowOf(r,result)},'#4fd1ff',null,1.0,'rgba(79,209,255,.35)');drawLegend(g,result,q,pad);var s=stats(result);if(s){g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(p.X(s.hi),p.Y(s.hiValue),5*q,0,Math.PI*2);g.fill();g.shadowBlur=0;callout(g,'PEAK HIGH',s.hiValue,s.hiDate,s.hiClock,p.X(s.hi),p.Y(s.hiValue),q,w,h,pad,c)}return}
  g.save();g.strokeStyle=c;g.lineWidth=2.2*q;g.shadowColor=c;g.shadowBlur=9*q;g.beginPath();rows.forEach(function(r,i){var x=p.X(r),y=p.Y(valueOf(r,result.mode));if(i===0)g.moveTo(x,y);else g.lineTo(x,y)});g.stroke();g.shadowBlur=0;if(rows.length<80){g.fillStyle=c;rows.forEach(function(r){var x=p.X(r),y=p.Y(valueOf(r,result.mode));g.beginPath();g.arc(x,y,2.4*q,0,Math.PI*2);g.fill()})}var s=stats(result);if(s){[[s.hi,s.hiValue],[s.lo,s.loValue]].forEach(function(it){g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(p.X(it[0]),p.Y(it[1]),5*q,0,Math.PI*2);g.fill()});callout(g,'HIGH',s.hiValue,s.hiDate,s.hiClock,p.X(s.hi),p.Y(s.hiValue),q,w,h,pad,c);callout(g,'LOW',s.loValue,s.loDate,s.loClock,p.X(s.lo),p.Y(s.loValue),q,w,h,pad,c)}g.restore()}
  function drawSummary(g,s,q,w,h,pad,result){if(!s)return;var y=h-72*q,bw=w-pad.left-pad.right,x=pad.left,cols=isSolarDaily(result)?4:3,col=bw/cols;g.save();g.fillStyle='rgba(5,7,12,.92)';g.strokeStyle='rgba(0,255,255,.42)';g.shadowColor='rgba(0,255,255,.18)';g.shadowBlur=8*q;g.beginPath();g.roundRect(x,y,bw,52*q,9*q);g.fill();g.stroke();g.shadowBlur=0;function cell(i,label,value,sub,accent){var cx=x+i*col+10*q;g.fillStyle='#9aa3b6';g.font='900 '+8.5*q+'px Courier New';g.textAlign='left';g.fillText(label,cx,y+16*q);g.fillStyle=accent;g.font='900 '+(w/q<520?9:11)*q+'px Courier New';g.fillText(value,cx,y+32*q);g.fillStyle='#d8deeb';g.font=(w/q<520?7:8)*q+'px Courier New';g.fillText(sub,cx,y+45*q)}if(isSolarDaily(result)){cell(0,'PEAK HIGH',fmt(s.hiValue,1)+' MW',s.hiDate,'#ff4444');cell(1,'AVG MEAN',fmt(s.avg,1)+' MW',s.avgDate,'#f5c518');cell(2,'LOW',fmt(s.loValue,1)+' MW',s.loDate,'#4fd1ff');cell(3,'ENERGY',fmt(s.totalMwh/1000000,2)+' TWh','PVLive estimate','#00ffff')}else{cell(0,'HIGH',fmt(s.hiValue,1)+' MW',s.hiDate,'#ff4444');cell(1,'MEAN',fmt(s.avg,1)+' MW',s.avgDate,'#00ffff');cell(2,'LOW',fmt(s.loValue,1)+' MW',s.loDate,'#ff4444')}g.restore()}
  function render(canvas,result){var rows=result.rows||[],ctx=canvas.getContext('2d'),box=canvas.getBoundingClientRect(),q=window.devicePixelRatio||1,cssW=Math.max(320,Math.floor(box.width||canvas.clientWidth||600)),cssH=Math.max(420,Math.floor(box.height||canvas.clientHeight||520)),w=Math.floor(cssW*q),h=Math.floor(cssH*q);canvas.width=w;canvas.height=h;ctx.clearRect(0,0,w,h);ctx.fillStyle='#05070c';ctx.fillRect(0,0,w,h);var pad={left:(cssW<520?78:88)*q,right:(cssW<520?20:30)*q,top:66*q,bottom:116*q};drawTitle(ctx,result,q,w,pad,cssW);if(!rows.length){ctx.fillStyle='#9aa3b6';ctx.font=13*q+'px Courier New';ctx.fillText('Awaiting generation history data.',18*q,76*q);return}var t0=result.start.getTime(),t1=result.end.getTime(),mm=minMax(rows,result);drawTicks(ctx,w,h,q,mm,pad,t0,t1);drawLine(ctx,rows,result,w,h,q,pad,mm,t0,t1);drawSummary(ctx,stats(result),q,w,h,pad,result)}
  return{render:render};
})();
"""


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    old = RENDERER.read_text(encoding='utf-8')
    index = INDEX.read_text(encoding='utf-8') if INDEX.exists() else ''
    checks = {
        'renderer_exists': RENDERER.exists(),
        'current_renderer_uses_average_only_daily': "function valueOf(r,mode){return mode==='daily'?Number(r.averageMW):Number(r.generationMW)}" in old,
        'current_title_says_daily_average': "function compactMode(mode){return mode==='daily'?'Daily average':'30 min output'}" in old,
        'new_renderer_has_solar_daily_three_series': 'Daily high · average · low' in NEW_RENDERER and 'PEAK HIGH' in NEW_RENDERER,
        'new_renderer_uses_highMW': 'highMW' in NEW_RENDERER,
        'new_renderer_uses_lowMW': 'lowMW' in NEW_RENDERER,
        'new_renderer_uses_mwh': 'totalMwh' in NEW_RENDERER,
        'index_cache_can_be_bumped': 'render_generation_history_chart.js?v=' in index,
    }
    cache_target = 'render_generation_history_chart.js?v=20260610peakui1'
    index_new = index.replace('render_generation_history_chart.js?v=20260610solarui1', cache_target).replace('render_generation_history_chart.js?v=20260609study1', cache_target)
    passed = all(checks.values())
    changed = old != NEW_RENDERER or index != index_new
    if args.apply and passed:
        RENDERER.write_text(NEW_RENDERER, encoding='utf-8')
        INDEX.write_text(index_new, encoding='utf-8')
    report = {
        'mode': 'apply' if args.apply else 'audit',
        'rendererPath': str(RENDERER.relative_to(ROOT)),
        'indexPath': str(INDEX.relative_to(ROOT)),
        'oldRendererSha256': sha256(old),
        'newRendererSha256': sha256(NEW_RENDERER),
        'wouldChangeRenderer': old != NEW_RENDERER,
        'wouldChangeIndexCache': index != index_new,
        'checks': checks,
        'applied': bool(args.apply and passed),
        'pass': passed,
        'changeSummary': [
            'Solar daily chart title changes to Daily high average low',
            'Solar daily chart draws highMW, averageMW and lowMW',
            'Solar daily peak callout uses highMW and is labelled PEAK HIGH',
            'Solar daily summary adds ENERGY from mwh in TWh',
            'Non solar and 30 minute views retain the existing single line behaviour',
            'No data files or loaders are changed'
        ],
        'riskNotes': [
            'PVLive is an estimated national Solar output layer, not transmission metered generation',
            'Low MW for Solar is usually night time and may be near zero',
            'Peak MW is the key value for grid stress and negative price analysis'
        ]
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text('# Generation History Peak UI Audit\n\n```json\n' + json.dumps(report, indent=2) + '\n```\n', encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if passed else 1

if __name__ == '__main__':
    raise SystemExit(main())
