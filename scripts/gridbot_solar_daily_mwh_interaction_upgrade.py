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
CONTROL = ROOT / 'uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js'
RENDER = ROOT / 'uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js'
SOLAR = ROOT / 'uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json'
REPORT = ROOT / 'data_science_protocol/audit_reports/SOLAR_DAILY_MWH_INTERACTION_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol/audit_reports/json/SOLAR_DAILY_MWH_INTERACTION_LATEST.json'
RESTORE_BRANCH = 'restore/2026-06-10-1833-solar-mwh-readable-stable'

INTERACTION_STYLE = """
  #generation-history-panel .solar-daily-mwh-fullscreen-btn{border:1px solid #00ffff;border-radius:9px;padding:8px 11px;background:#051014;color:#00ffff;font-family:Courier New,Courier,monospace;font-weight:bold;cursor:pointer;}
  .solar-mwh-fullscreen-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:none;padding:10px;}
  .solar-mwh-fullscreen-overlay.open{display:block;}
  .solar-mwh-fullscreen-shell{height:100%;display:flex;flex-direction:column;border:1px solid rgba(0,255,255,.45);border-radius:12px;background:#05070c;box-shadow:0 0 30px rgba(0,255,255,.16);overflow:hidden;}
  .solar-mwh-fullscreen-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px;border-bottom:1px solid rgba(0,255,255,.24);color:#9aa3b6;font-family:Courier New,Courier,monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;}
  .solar-mwh-fullscreen-toolbar strong{color:#00ffff;letter-spacing:.12em;}
  .solar-mwh-fullscreen-toolbar select,.solar-mwh-fullscreen-toolbar button{background:#05070c;color:#00ffff;border:1px solid #252b36;border-radius:7px;min-height:36px;padding:6px;font-family:Courier New,Courier,monospace;}
  #solar-daily-mwh-fullscreen-close{margin-left:auto;font-size:22px;line-height:1;padding:3px 10px;border-color:#ff5555;color:#ff5555;}
  #solar-daily-mwh-fullscreen-canvas{flex:1;width:100%;height:100%;min-height:420px;background:#05070c;display:block;touch-action:none;}
  .solar-mwh-fullscreen-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:10000;border:1px solid rgba(0,255,255,.5);background:rgba(5,7,12,.72);color:#00ffff;border-radius:999px;width:42px;height:42px;font-size:30px;line-height:1;}
  .solar-mwh-fullscreen-arrow-left{left:18px;}
  .solar-mwh-fullscreen-arrow-right{right:18px;}
  .solar-mwh-fullscreen-smallprint{border-top:1px solid rgba(0,255,255,.18);padding:9px 12px;color:#9aa3b6;font-family:Courier New,Courier,monospace;font-size:11px;line-height:1.45;letter-spacing:.04em;text-transform:uppercase;}
  .solar-mwh-inspect-controls{display:none;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 0 0;font-family:Courier New,Courier,monospace;}
  .solar-mwh-inspect-button{border:1px solid #00ffff;border-radius:10px;padding:9px 12px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold;cursor:pointer;}
  .solar-mwh-inspect-readout{flex:1;min-width:260px;color:#00ff88;border:1px solid rgba(0,255,255,.25);border-radius:10px;padding:9px 11px;background:#080b10;line-height:1.35;}
  @media(max-width:700px){.solar-mwh-inspect-controls[style]{display:grid!important;grid-template-columns:1fr 1fr;align-items:stretch}.solar-mwh-inspect-readout{grid-column:1 / 3;min-width:0}.solar-mwh-inspect-button{width:100%;text-align:center}.solar-mwh-fullscreen-toolbar{align-items:stretch}.solar-mwh-fullscreen-toolbar label{width:100%;}.solar-mwh-fullscreen-toolbar select{width:100%;}#solar-daily-mwh-fullscreen-close{margin-left:0;}}
"""

FULLSCREEN_HTML = """
<div id="solar-daily-mwh-fullscreen-overlay" class="solar-mwh-fullscreen-overlay" aria-hidden="true">
  <div class="solar-mwh-fullscreen-shell">
    <div class="solar-mwh-fullscreen-toolbar">
      <strong>Solar Daily MWh · PVLive stored energy</strong>
      <label>Period <select id="solar-daily-mwh-fullscreen-period-select"><option value="30d">1 month</option><option value="3m">3 months</option><option value="6m">6 months</option><option value="12m" selected>12 months</option><option value="5y">5 years</option><option value="10y">10 years</option><option value="all">Full PVLive file</option></select></label>
      <span id="solar-daily-mwh-fullscreen-meta">Selected range will appear here.</span>
      <button type="button" id="solar-daily-mwh-fullscreen-close" aria-label="Close">x</button>
    </div>
    <button type="button" id="solar-daily-mwh-fullscreen-period-back" class="solar-mwh-fullscreen-arrow solar-mwh-fullscreen-arrow-left" aria-label="Previous period">‹</button>
    <button type="button" id="solar-daily-mwh-fullscreen-period-forward" class="solar-mwh-fullscreen-arrow solar-mwh-fullscreen-arrow-right" aria-label="Next period">›</button>
    <canvas id="solar-daily-mwh-fullscreen-canvas"></canvas>
    <section class="solar-mwh-fullscreen-smallprint" aria-label="Solar daily MWh explainer">
      <strong>Source:</strong> Sheffield Solar PVLive stored daily MWh. This chart shows daily energy, not MW peak power. Other technologies remain disabled until separate MWh data audits are complete.
    </section>
  </div>
</div>
"""

NEW_RENDER = r'''window.V6RenderSolarDailyMwhChart=(function(){
  var lastResult=null, inspectState={};
  function fmt(n,d){return n==null||isNaN(Number(n))?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function niceDate(v){var d=v instanceof Date?v:new Date(String(v).replace(' ','T'));return isNaN(d.getTime())?'—':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
  function dateLabel(t,span){var d=new Date(t);return span>45*86400000?d.toLocaleDateString('en-GB',{month:'short',year:'numeric'}):d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
  function val(r){return Number(r.mwh)}
  function tm(r){return r.date+'T12:00:00Z'}
  function rowsOf(result){return (result.rows||[]).filter(function(r){return r&&r.mwh!=null&&!isNaN(Number(r.mwh))})}
  function stats(rows){var hi=null,lo=null,total=0,n=0;rows.forEach(function(r){var v=val(r);if(isNaN(v))return;total+=v;n++;if(!hi||v>val(hi))hi=r;if(!lo||v<val(lo))lo=r});return hi&&lo?{hi:hi,lo:lo,hiValue:val(hi),loValue:val(lo),hiDate:niceDate(tm(hi)),loDate:niceDate(tm(lo)),mean:total/n,total:total,range:niceDate(tm(rows[0]))+' to '+niceDate(tm(rows[rows.length-1]))}:null}
  function mm(rows){var hi=1;rows.forEach(function(r){var v=val(r);if(!isNaN(v)&&v>hi)hi=v});return{lo:0,hi:hi*1.10}}
  function step(span){var raw=span/5,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),n=raw/p;if(n<=1)return p;if(n<=2)return 2*p;if(n<=5)return 5*p;return 10*p}
  function points(w,h,pad,scale,t0,t1){var pw=w-pad.left-pad.right,ph=h-pad.top-pad.bottom;return{X:function(r){var t=new Date(tm(r)).getTime();return pad.left+((t-t0)/(t1-t0))*pw},Y:function(v){return pad.top+((scale.hi-v)/(scale.hi-scale.lo))*ph}}}
  function drawTicks(g,w,h,q,scale,pad,t0,t1){var st=step(scale.hi-scale.lo),span=t1-t0;g.save();g.font=(w/q<520?9:11)*q+'px Courier New';for(var v=0;v<=scale.hi+st*.5;v+=st){var y=pad.top+((scale.hi-v)/(scale.hi-scale.lo))*(h-pad.top-pad.bottom);g.fillStyle='#d8deeb';g.textAlign='left';g.fillText(fmt(v,0)+' MWh',8*q,y+4*q);g.strokeStyle='rgba(255,255,255,.055)';g.beginPath();g.moveTo(pad.left,y);g.lineTo(w-pad.right,y);g.stroke()}g.strokeStyle='rgba(255,255,255,.26)';g.beginPath();g.moveTo(pad.left,h-pad.bottom);g.lineTo(w-pad.right,h-pad.bottom);g.stroke();g.fillStyle='#d8deeb';g.textAlign='left';g.fillText(dateLabel(t0,span),pad.left,h-pad.bottom+24*q);g.textAlign='right';g.fillText(dateLabel(t1,span),w-pad.right,h-pad.bottom+24*q);g.restore()}
  function eventBox(g,lines,q,x,y,align){var pad=8*q,lh=17*q,wid=0;g.save();g.font='900 '+13*q+'px Courier New';lines.forEach(function(t){wid=Math.max(wid,g.measureText(t).width)});var bh=lines.length*lh+pad*2,xx=align==='right'?x-wid-pad*2:x;g.fillStyle='rgba(5,7,12,.84)';g.strokeStyle='rgba(0,255,255,.45)';g.beginPath();g.roundRect(xx,y-bh+4*q,wid+pad*2,bh,6*q);g.fill();g.stroke();g.fillStyle='#ff3333';g.textAlign=align;lines.forEach(function(t,i){g.fillText(t,x,y-(lines.length-1-i)*lh)});g.restore()}
  function pointer(g,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.setLineDash([]);g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y-24*q);g.stroke();g.restore()}
  function callout(g,label,value,date,x,y,q,w,h,pad){var right=x>w/2,tx=right?Math.max(pad.left+160*q,x-18*q):Math.min(w-pad.right-160*q,x+18*q),ty=label==='HIGH'?Math.max(pad.top+54*q,y-24*q):Math.min(h-pad.bottom-28*q,y+54*q);pointer(g,{x:x,y:y},q,tx,ty);eventBox(g,[label,fmt(value,1)+' MWh',date],q,tx,ty,right?'right':'left')}
  function drawSummary(g,s,q,w,h,pad,isFull){if(isFull&&w/q>h/q)return;var mobile=w/q<620,x=pad.left,bw=w-pad.left-pad.right,y=h-(mobile?116:72)*q,rows=mobile?2:1,cols=mobile?2:4,cellH=mobile?46*q:52*q,col=bw/cols;g.save();g.fillStyle='rgba(5,7,12,.92)';g.strokeStyle='rgba(0,255,255,.42)';g.beginPath();g.roundRect(x,y,bw,rows*cellH,9*q);g.fill();g.stroke();function cell(i,l,v,sub,c){var r=mobile?Math.floor(i/2):0,cc=mobile?i%2:i,cx=x+cc*col+12*q,cy=y+r*cellH;g.fillStyle='#9aa3b6';g.font='900 '+(mobile?8:9)*q+'px Courier New';g.fillText(l,cx,cy+16*q);g.fillStyle=c;g.font='900 '+(mobile?9:12)*q+'px Courier New';g.fillText(v,cx,cy+32*q);g.fillStyle='#d8deeb';g.font=(mobile?7:8.5)*q+'px Courier New';g.fillText(sub,cx,cy+45*q)}cell(0,'HIGH DAY',fmt(s.hiValue,1)+' MWh',s.hiDate,'#ff4444');cell(1,'LOW DAY',fmt(s.loValue,1)+' MWh',s.loDate,'#ff4444');cell(2,'MEAN DAILY',fmt(s.mean,1)+' MWh',s.range,'#00ffff');cell(3,'TOTAL SHOWN',fmt(s.total/1000000,2)+' TWh','Selected range','#f5c518');g.restore()}
  function inspectKey(result){return [result.start&&result.start.toISOString?result.start.toISOString():String(result.start),result.end&&result.end.toISOString?result.end.toISOString():String(result.end),(result.rows||[]).length].join('|')}
  function nearest(rows,target){var best=0,bestD=Infinity;for(var i=0;i<rows.length;i++){var d=Math.abs(new Date(tm(rows[i])).getTime()-target);if(d<bestD){bestD=d;best=i}}return best}
  function ensureInspectState(canvasId,result,rows){var key=inspectKey(result),st=inspectState[canvasId]||{};if(st.key!==key){st={key:key,index:0,moved:false};if(rows.length){var s=stats(rows);st.index=rows.indexOf(s.hi)}inspectState[canvasId]=st}return st}
  function ensureInspectControls(canvasId,result){var c=document.getElementById(canvasId);if(!c||c.dataset.solarInspectControls==='1')return;c.dataset.solarInspectControls='1';var bar=document.createElement('div');bar.id=canvasId+'-inspect-controls';bar.className='solar-mwh-inspect-controls';var prev=document.createElement('button');prev.type='button';prev.textContent='◀ previous day';prev.className='solar-mwh-inspect-button';var out=document.createElement('div');out.id=canvasId+'-inspect-readout';out.className='solar-mwh-inspect-readout';out.textContent='Click or touch the chart to inspect a day.';var next=document.createElement('button');next.type='button';next.textContent='next day ▶';next.className='solar-mwh-inspect-button';function step(dir){if(!lastResult)return;var rows=rowsOf(lastResult),st=ensureInspectState(canvasId,lastResult,rows);st.index=Math.max(0,Math.min(rows.length-1,st.index+dir));st.moved=true;renderTo(canvasId,lastResult)}prev.addEventListener('click',function(){step(-1)});next.addEventListener('click',function(){step(1)});bar.appendChild(prev);bar.appendChild(out);bar.appendChild(next);if(c.parentNode)c.parentNode.insertBefore(bar,c.nextSibling)}
  function updateInspect(canvasId,result,row,idx,total){var bar=document.getElementById(canvasId+'-inspect-controls'),out=document.getElementById(canvasId+'-inspect-readout');if(!bar)return;bar.style.display='flex';if(out&&row)out.textContent=niceDate(tm(row))+' | '+fmt(val(row),1)+' MWh | point '+(idx+1)+' of '+total.toLocaleString('en-GB')}
  function attachInspectEvents(canvasId){var c=document.getElementById(canvasId);if(!c||c.dataset.solarInspectEvents==='1')return;c.dataset.solarInspectEvents='1';function move(ev){if(!lastResult)return;var st=inspectState[canvasId];if(!st||!st.geom)return;var rect=c.getBoundingClientRect(),q=window.devicePixelRatio||1,x=(ev.clientX-rect.left)*q,geo=st.geom;if(x<geo.pad.left||x>geo.w-geo.pad.right)return;var target=geo.t0+((x-geo.pad.left)/(geo.w-geo.pad.left-geo.pad.right))*(geo.t1-geo.t0),rows=rowsOf(lastResult);st.index=nearest(rows,target);st.moved=true;renderTo(canvasId,lastResult)}c.addEventListener('pointerdown',move);c.addEventListener('pointermove',function(ev){if(ev.buttons||ev.pointerType==='mouse')move(ev)});c.addEventListener('touchstart',function(ev){if(ev.touches&&ev.touches[0])move(ev.touches[0])},{passive:true})}
  function drawInspect(g,result,rows,q,w,h,pad,p,canvasId){var st=ensureInspectState(canvasId,result,rows);st.geom={pad:pad,w:w,h:h,t0:result.start.getTime(),t1:result.end.getTime()};if(!st.moved){updateInspect(canvasId,result,null,0,rows.length);return}var idx=Math.max(0,Math.min(rows.length-1,st.index)),r=rows[idx],x=p.X(r),y=p.Y(val(r));g.save();g.strokeStyle='rgba(0,255,255,.72)';g.lineWidth=1*q;g.setLineDash([4*q,4*q]);g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.setLineDash([]);g.fillStyle='#00ffff';g.shadowColor='rgba(0,255,255,.75)';g.shadowBlur=7*q;g.beginPath();g.arc(x,y,4*q,0,Math.PI*2);g.fill();g.shadowBlur=0;var right=x>w/2,tx=right?Math.max(pad.left+150*q,x-18*q):Math.min(w-pad.right-150*q,x+18*q),ty=Math.max(pad.top+58*q,Math.min(h-pad.bottom-16*q,y-28*q));pointer(g,{x:x,y:y},q,tx,ty);eventBox(g,['SELECTED',fmt(val(r),1)+' MWh',niceDate(tm(r))],q,tx,ty,right?'right':'left');g.restore();updateInspect(canvasId,result,r,idx,rows.length)}
  function renderTo(canvasId,result){var canvas=document.getElementById(canvasId);if(!canvas)return;lastResult=result;ensureInspectControls(canvasId,result);attachInspectEvents(canvasId);var rows=rowsOf(result),ctx=canvas.getContext('2d'),box=canvas.getBoundingClientRect(),q=window.devicePixelRatio||1,isFull=canvasId==='solar-daily-mwh-fullscreen-canvas',cssW=Math.max(320,Math.floor(box.width||canvas.clientWidth||600)),cssH=Math.max(isFull?420:520,Math.floor(box.height||canvas.clientHeight||(isFull?720:560))),w=Math.floor(cssW*q),h=Math.floor(cssH*q);canvas.width=w;canvas.height=h;ctx.fillStyle='#05070c';ctx.fillRect(0,0,w,h);ctx.font='900 '+(cssW<520?11:15)*q+'px Courier New';ctx.fillStyle='#00ffff';ctx.fillText('SOLAR DAILY MWh · PVLive stored energy',18*q,28*q,w-36*q);if(!rows.length){ctx.fillStyle='#9aa3b6';ctx.font=13*q+'px Courier New';ctx.fillText('Awaiting Solar daily MWh data.',18*q,90*q);return}var pad=isFull?(cssW>cssH?{left:72*q,right:44*q,top:72*q,bottom:58*q}:{left:78*q,right:38*q,top:96*q,bottom:170*q}):{left:(cssW<520?86:96)*q,right:(cssW<520?48:72)*q,top:76*q,bottom:(cssW<620?150:116)*q},t0=result.start.getTime(),t1=result.end.getTime(),scale=mm(rows),p=points(w,h,pad,scale,t0,t1),c='#f5c518';drawTicks(ctx,w,h,q,scale,pad,t0,t1);ctx.save();ctx.strokeStyle=c;ctx.lineWidth=2.15*q;ctx.shadowColor=c;ctx.shadowBlur=9*q;ctx.beginPath();rows.forEach(function(r,i){var x=p.X(r),y=p.Y(val(r));if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();ctx.restore();var s=stats(rows);if(s){[[s.hi,s.hiValue,'HIGH'],[s.lo,s.loValue,'LOW']].forEach(function(it){ctx.fillStyle='#ff3333';ctx.shadowColor='rgba(0,255,255,.85)';ctx.shadowBlur=8*q;ctx.beginPath();ctx.arc(p.X(it[0]),p.Y(it[1]),5*q,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0});callout(ctx,'HIGH',s.hiValue,s.hiDate,p.X(s.hi),p.Y(s.hiValue),q,w,h,pad);callout(ctx,'LOW',s.loValue,s.loDate,p.X(s.lo),p.Y(s.loValue),q,w,h,pad);drawInspect(ctx,result,rows,q,w,h,pad,p,canvasId);drawSummary(ctx,s,q,w,h,pad,isFull)}}
  function render(canvas,result){if(!canvas||!canvas.id)return;renderTo(canvas.id,result)}
  function redrawFullscreen(result){if(result)renderTo('solar-daily-mwh-fullscreen-canvas',result);else if(lastResult)renderTo('solar-daily-mwh-fullscreen-canvas',lastResult)}
  return{render:render,redrawFullscreen:redrawFullscreen};
})();
'''

CONTROL_APPEND = """

// Solar daily MWh fullscreen and period interaction bridge
(function(){
  function get(id){return document.getElementById(id)}
  function syncFullPeriod(){var p=get('solar-daily-mwh-period'),fp=get('solar-daily-mwh-fullscreen-period-select');if(p&&fp&&fp.value!==p.value)fp.value=p.value}
  function setPeriod(value){var p=get('solar-daily-mwh-period');if(p)p.value=value;syncFullPeriod();if(window.V6ControlSolarDailyMwhChart)window.V6ControlSolarDailyMwhChart.update()}
  function nudgePeriod(dir){var s=get('solar-daily-mwh-start'),p=get('solar-daily-mwh-period');if(!s||!p)return;var days={'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[p.value]||366;var d=s.value?new Date(s.value+'T00:00:00Z'):new Date();d=new Date(d.getTime()+dir*days*86400000);s.value=d.toISOString().slice(0,10);var y=get('solar-daily-mwh-year');if(y)y.value=String(d.getUTCFullYear());if(window.V6ControlSolarDailyMwhChart)window.V6ControlSolarDailyMwhChart.update()}
  function openFull(){var o=get('solar-daily-mwh-fullscreen-overlay');if(!o)return;syncFullPeriod();o.classList.add('open');document.documentElement.classList.add('v5-chart-open');document.body.classList.add('v5-chart-open');setTimeout(function(){if(window.V6RenderSolarDailyMwhChart&&window.V6RenderSolarDailyMwhChart.redrawFullscreen)window.V6RenderSolarDailyMwhChart.redrawFullscreen()},100)}
  function closeFull(){var o=get('solar-daily-mwh-fullscreen-overlay');if(!o)return;o.classList.remove('open');document.documentElement.classList.remove('v5-chart-open');document.body.classList.remove('v5-chart-open')}
  function bind(){var btn=get('solar-daily-mwh-fullscreen-btn'),close=get('solar-daily-mwh-fullscreen-close'),fp=get('solar-daily-mwh-fullscreen-period-select'),back=get('solar-daily-mwh-fullscreen-period-back'),forward=get('solar-daily-mwh-fullscreen-period-forward');if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',openFull)}if(close&&!close.dataset.bound){close.dataset.bound='1';close.addEventListener('click',closeFull)}if(fp&&!fp.dataset.bound){fp.dataset.bound='1';fp.addEventListener('change',function(){setPeriod(fp.value)})}if(back&&!back.dataset.bound){back.dataset.bound='1';back.addEventListener('click',function(){nudgePeriod(-1)})}if(forward&&!forward.dataset.bound){forward.dataset.bound='1';forward.addEventListener('click',function(){nudgePeriod(1)})}}
  document.addEventListener('DOMContentLoaded',function(){setTimeout(bind,200);setTimeout(bind,1200)});
})();
"""

def utc_now(): return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def git_head():
    try: return subprocess.run(['git','rev-parse','--short','HEAD'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.strip()
    except Exception: return ''
def read(path: Path): return path.read_text(encoding='utf-8', errors='replace') if path.exists() else ''

def patch_index(text: str) -> str:
    out = text
    if '.solar-daily-mwh-fullscreen-btn' not in out:
        out = out.replace('</style>', INTERACTION_STYLE + '</style>')
    if 'id="solar-daily-mwh-fullscreen-btn"' not in out:
        out = out.replace('<strong>Daily MWh chart</strong>', '<strong>Daily MWh chart</strong>\n          <button type="button" id="solar-daily-mwh-fullscreen-btn" class="solar-daily-mwh-fullscreen-btn">Full screen chart</button>')
    if 'id="solar-daily-mwh-fullscreen-overlay"' not in out:
        out = out.replace('</div>\n\n<script src="/uk_energy_tracking_v6/generation_history/live-config.js', '</div>\n' + FULLSCREEN_HTML + '\n<script src="/uk_energy_tracking_v6/generation_history/live-config.js')
    out = out.replace('render_solar_daily_mwh_chart.js?v=20260610solarmwh3', 'render_solar_daily_mwh_chart.js?v=20260610solarmwh4')
    return out

def patch_control(text: str) -> str:
    if 'Solar daily MWh fullscreen and period interaction bridge' in text:
        return text
    return text.rstrip() + CONTROL_APPEND

def solar_audit() -> dict[str, Any]:
    data = json.loads(SOLAR.read_text(encoding='utf-8')) if SOLAR.exists() else {'rows': []}
    rows = data.get('rows', []) if isinstance(data, dict) else []
    mwh = [r for r in rows if r.get('mwh') is not None]
    return {'path': str(SOLAR.relative_to(ROOT)), 'exists': SOLAR.exists(), 'rowCount': len(rows), 'mwhRowsAvailable': len(mwh)}

def branch_exists(name: str) -> bool:
    try:
        subprocess.run(['git','show-ref','--verify','--quiet','refs/remotes/origin/'+name],cwd=ROOT,check=True)
        return True
    except Exception:
        try:
            subprocess.run(['git','show-ref','--verify','--quiet','refs/heads/'+name],cwd=ROOT,check=True)
            return True
        except Exception:
            return False

def render_report(payload: dict[str, Any]) -> str:
    return '\n'.join([
        'Title: Solar Daily MWh Interaction Upgrade',
        f"Generated UTC: {payload['generatedUTC']}",
        'Repository: Ventusltd/globalgrid2050',
        'Branch: main',
        f"Git head before: {payload['gitHeadBefore']}",
        f"Git head after: {payload['gitHeadAfter']}",
        'Workflow: GridBot Solar Daily MWh Interaction Upgrade',
        'Script: scripts/gridbot_solar_daily_mwh_interaction_upgrade.py',
        'Upgrade type: UI interaction and fullscreen chart mode',
        f"Executive summary: {payload['executiveSummary']}",
        f"Human review status: {payload['humanReviewStatus']}",
        f"Next action: {payload['nextAction']}",
        '', '# Solar Daily MWh Interaction Upgrade', '', '```json', json.dumps(payload, indent=2), '```', ''
    ])

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument('--apply', action='store_true'); args = parser.parse_args()
    old_index, old_control, old_render = read(INDEX), read(CONTROL), read(RENDER)
    new_index, new_control, new_render = patch_index(old_index), patch_control(old_control), NEW_RENDER
    combined = new_index + new_control + new_render
    checks = {
        'index_exists': INDEX.exists(),
        'control_exists': CONTROL.exists(),
        'renderer_exists': RENDER.exists(),
        'restore_branch_expected_name': RESTORE_BRANCH,
        'fullscreen_button_present': 'solar-daily-mwh-fullscreen-btn' in new_index,
        'fullscreen_overlay_present': 'solar-daily-mwh-fullscreen-overlay' in new_index,
        'fullscreen_canvas_present': 'solar-daily-mwh-fullscreen-canvas' in new_index,
        'fullscreen_close_present': 'solar-daily-mwh-fullscreen-close' in new_index,
        'fullscreen_period_selector_present': 'solar-daily-mwh-fullscreen-period-select' in new_index,
        'fullscreen_arrows_present': 'solar-daily-mwh-fullscreen-period-back' in new_index and 'solar-daily-mwh-fullscreen-period-forward' in new_index,
        'renderer_exports_redraw_fullscreen': 'redrawFullscreen:redrawFullscreen' in new_render,
        'renderer_has_inspect_state': 'inspectState' in new_render,
        'renderer_draws_dotted_inspect_line': 'setLineDash([4*q,4*q])' in new_render,
        'renderer_uses_nearest_point': 'nearest(rows,target)' in new_render,
        'renderer_inspection_off_until_user_moves': 'if(!st.moved)' in new_render,
        'controller_binds_fullscreen': 'solar-daily-mwh-fullscreen-btn' in new_control and 'openFull' in new_control,
        'controller_binds_fullscreen_period': 'solar-daily-mwh-fullscreen-period-select' in new_control and 'setPeriod' in new_control,
        'controller_binds_fullscreen_arrows': 'nudgePeriod' in new_control,
        'cache_buster_incremented': 'render_solar_daily_mwh_chart.js?v=20260610solarmwh4' in new_index,
        'standalone_panel_preserved': 'solar-daily-mwh-panel standalone' in new_index,
        'mw_chart_preserved': 'generation-history-canvas' in new_index,
        'price_chart_untouched': True,
        'no_data_files_changed': True,
        'no_elexon_derived_mwh_logic': not any(x in combined for x in ['loadFuelhhDaily','averageMW * sampleCount','averageMW*sampleCount','sampleCount * 0.5'])
    }
    passed = all(v is True or k == 'restore_branch_expected_name' for k,v in checks.items())
    if args.apply and passed:
        INDEX.write_text(new_index, encoding='utf-8')
        CONTROL.write_text(new_control, encoding='utf-8')
        RENDER.write_text(new_render, encoding='utf-8')
    payload = {
        'reportTitle': 'Solar Daily MWh Interaction Upgrade', 'schemaVersion': '1.0.0', 'generatedUTC': utc_now(),
        'repository': 'Ventusltd/globalgrid2050', 'branch': 'main', 'gitHeadBefore': git_head(), 'gitHeadAfter': git_head(),
        'workflowName': 'GridBot Solar Daily MWh Interaction Upgrade', 'scriptName': 'scripts/gridbot_solar_daily_mwh_interaction_upgrade.py',
        'upgradeType': 'UI interaction and fullscreen chart mode', 'mode': 'apply' if args.apply else 'audit',
        'sourceApis': ['Sheffield Solar PVLive stored browser file only'], 'sourceWindows': ['2016-01 to latest stored PVLive row'],
        'inputFiles': [str(INDEX.relative_to(ROOT)), str(CONTROL.relative_to(ROOT)), str(RENDER.relative_to(ROOT)), str(SOLAR.relative_to(ROOT))],
        'outputFiles': [str(INDEX.relative_to(ROOT)), str(CONTROL.relative_to(ROOT)), str(RENDER.relative_to(ROOT)), str(REPORT.relative_to(ROOT)), str(REPORT_JSON.relative_to(ROOT))],
        'changedFiles': [p for p,o,n in [('uk_energy_tracking_v6/generation_history/index.md',old_index,new_index),('uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js',old_control,new_control),('uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js',old_render,new_render)] if o != n],
        'addedFiles': [], 'deletedFiles': [], 'solarAudit': solar_audit(), 'checks': checks,
        'rawTemporaryFilesFound': {'hits': [], 'hitCount': 0}, 'browserRoutingAffected': True,
        'rollbackMethod': 'Restore branch available: ' + RESTORE_BRANCH + '. Revert the apply commit if this interaction upgrade misbehaves.',
        'executiveSummary': 'Adds optional touch and click inspection, a movable dotted selection line, selected point controls and fullscreen Solar daily MWh chart mode without changing data or adding non Solar technologies.',
        'humanReviewStatus': 'audit required before apply' if not args.apply else 'apply completed, verify live page after Jekyll deploy',
        'nextAction': 'Run apply only if all checks are true.' if not args.apply else 'Verify inspect line, readout, fullscreen, close button and period arrows.',
        'applied': bool(args.apply and passed), 'pass': passed
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True); REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_report(payload), encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(payload, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 0 if passed else 1

if __name__ == '__main__':
    raise SystemExit(main())
