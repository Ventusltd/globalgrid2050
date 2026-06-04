from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ai_start": ROOT / "AI_START_HERE.md",
    "protocol": ROOT / "uk_energy_tracking_v6" / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "renderer": ROOT / "uk_energy_tracking_v6" / "price_history_chart" / "render_price_chart" / "render_price_chart.js",
    "report": ROOT / "uk_energy_tracking_v6" / "V6_REPAIR_CHART_INSPECT_ARROWS_REPORT.md",
}

TOUCHED = []


def read(path):
    if not path.exists():
        raise SystemExit(f"Missing required file: {path}")
    return path.read_text(encoding="utf-8")


def write(path, text):
    old = read(path)
    if old != text:
        path.write_text(text, encoding="utf-8")
        TOUCHED.append(str(path.relative_to(ROOT)))


def must_contain(text, needle, label):
    if needle not in text:
        raise SystemExit(f"Missing expected marker in {label}: {needle}")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly 1 match in {label}, found {count}: {old[:160]}")
    return text.replace(old, new, 1)


INSPECT_HELPERS = r'''  var inspectState={};
  function inspectKey(result){return [result.mode,result.start&&result.start.toISOString?result.start.toISOString():String(result.start),result.end&&result.end.toISOString?result.end.toISOString():String(result.end),(result.rows||[]).length].join('|')}
  function inspectAllowed(result){return result&&result.mode!=='daily'&&result.rows&&result.rows.length&&((result.end.getTime()-result.start.getTime())<=186*86400000)}
  function inspectRows(result){return (result.rows||[]).filter(function(r){var v=price(r),t=new Date(time(r)).getTime();return !isNaN(v)&&!isNaN(t)})}
  function highestInspectIndex(rows){var n=0;for(var i=1;i<rows.length;i++){if(price(rows[i])>price(rows[n]))n=i}return n}
  function nearestInspectIndex(rows,target){if(!rows.length)return 0;var best=0,bestD=Infinity;for(var i=0;i<rows.length;i++){var d=Math.abs(new Date(time(rows[i])).getTime()-target);if(d<bestD){bestD=d;best=i}}return best}
  function ensureInspectState(canvasId,result){var key=inspectKey(result),rows=inspectRows(result),st=inspectState[canvasId]||{};if(st.key!==key){st={key:key,index:highestInspectIndex(rows),moved:false};inspectState[canvasId]=st}return st}
  function inspectLineLabel(r,idx,total){return compactDateText(niceDate(time(r)))+' '+niceClock(time(r))+' | £'+fmt(price(r),2)+'/MWh | point '+(idx+1)+' of '+total.toLocaleString('en-GB')}
  function ensureInspectControls(canvasId,result){var c=document.getElementById(canvasId);if(!c||c.dataset.v6InspectControls==='1')return;c.dataset.v6InspectControls='1';var wrap=c.parentElement;var bar=document.createElement('div');bar.id=canvasId+'-inspect-controls';bar.style.cssText='display:none;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 0 0;font-family:Courier New,Courier,monospace';var prev=document.createElement('button');prev.type='button';prev.textContent='◀ previous point';var out=document.createElement('div');out.id=canvasId+'-inspect-readout';out.textContent='Inspect point';out.style.cssText='flex:1;min-width:260px;color:#00ff88;border:1px solid rgba(0,255,255,.25);border-radius:10px;padding:9px 11px;background:#080b10;line-height:1.35';var next=document.createElement('button');next.type='button';next.textContent='next point ▶';[prev,next].forEach(function(b){b.style.cssText='border:1px solid #00ffff;border-radius:10px;padding:9px 12px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold;cursor:pointer'});function step(dir){if(!lastResult||!inspectAllowed(lastResult))return;var rows=inspectRows(lastResult),st=ensureInspectState(canvasId,lastResult);st.index=Math.max(0,Math.min(rows.length-1,st.index+dir));st.moved=true;renderTo(canvasId,lastResult)}prev.addEventListener('click',function(){step(-1)});next.addEventListener('click',function(){step(1)});bar.appendChild(prev);bar.appendChild(out);bar.appendChild(next);if(wrap&&wrap.parentNode)wrap.parentNode.insertBefore(bar,wrap.nextSibling)}
  function updateInspectControls(canvasId,result,row,idx,total){var bar=document.getElementById(canvasId+'-inspect-controls'),out=document.getElementById(canvasId+'-inspect-readout');if(!bar)return;if(!inspectAllowed(result)){bar.style.display='none';return}bar.style.display='flex';if(out&&row)out.textContent=inspectLineLabel(row,idx,total)}
  function attachInspectEvents(canvasId){var c=document.getElementById(canvasId);if(!c||c.dataset.v6InspectEvents==='1')return;c.dataset.v6InspectEvents='1';function move(ev){if(!lastResult||!inspectAllowed(lastResult))return;var st=inspectState[canvasId];if(!st||!st.geom)return;var rect=c.getBoundingClientRect(),q=window.devicePixelRatio||1,x=(ev.clientX-rect.left)*q,geo=st.geom;if(x<geo.pad.left||x>geo.w-geo.pad.right)return;var target=geo.t0+((x-geo.pad.left)/(geo.w-geo.pad.left-geo.pad.right))*(geo.t1-geo.t0),rows=inspectRows(lastResult);st.index=nearestInspectIndex(rows,target);st.moved=true;renderTo(canvasId,lastResult)}c.addEventListener('pointerdown',move);c.addEventListener('pointermove',function(ev){if(ev.buttons||ev.pointerType==='mouse')move(ev)});c.addEventListener('touchstart',function(ev){if(ev.touches&&ev.touches[0])move(ev.touches[0])},{passive:true})}
  function drawInspectOverlay(g,result,q,w,h,pad,X,Y,canvasId){if(!inspectAllowed(result)){updateInspectControls(canvasId,result,null,0,0);return}var rows=inspectRows(result),st=ensureInspectState(canvasId,result);st.geom={pad:pad,w:w,h:h,t0:result.start.getTime(),t1:result.end.getTime()};var idx=Math.max(0,Math.min(rows.length-1,st.index)),r=rows[idx],x=X(r),y=Y(price(r));g.save();g.strokeStyle='rgba(0,255,255,.72)';g.lineWidth=1*q;g.setLineDash([4*q,4*q]);g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();g.setLineDash([]);g.fillStyle='#00ffff';g.shadowColor='rgba(0,255,255,.75)';g.shadowBlur=7*q;g.beginPath();g.arc(x,y,4*q,0,Math.PI*2);g.fill();g.shadowBlur=0;if(st.moved){var label=['SELECTED','£'+fmt(price(r),2)+'/MWh',compactDateText(niceDate(time(r)))+' '+niceClock(time(r))];var right=x>w/2,tx=right?Math.max(pad.left+150*q,x-18*q):Math.min(w-pad.right-150*q,x+18*q),ty=Math.max(pad.top+58*q,Math.min(h-pad.bottom-16*q,y-28*q));drawPointer(g,{x:x,y:y},q,tx,ty);eventBox(g,label,q,tx,ty,right?'right':'left')}g.restore();updateInspectControls(canvasId,result,r,idx,rows.length)}
'''


def patch_renderer():
    path = FILES["renderer"]
    text = read(path)
    must_contain(text, "function drawDailyLines", "renderer daily lines")
    must_contain(text, "function renderTo", "renderer render function")
    must_contain(text, "function drawV5StyleEvents", "renderer event boxes")

    if "function inspectAllowed" not in text:
        text = text.replace("  function renderTo(canvasId,result)", INSPECT_HELPERS + "  function renderTo(canvasId,result)", 1)

    old = "function renderTo(canvasId,result){var c=document.getElementById(canvasId);if(!c)return;var isFull=canvasId==='price-history-fullscreen-canvas';var q=window.devicePixelRatio||1,r=c.getBoundingClientRect();c.width=Math.max(320,Math.floor((r.width||1200)*q));c.height=Math.max(360,Math.floor((r.height||720)*q));var g=c.getContext('2d'),w=c.width,h=c.height,cssW=w/q,cssH=h/q,isLandscape=isFull&&cssW>cssH;var nonFullLandscape=!isFull&&cssW>cssH;var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:74*q,bottom:44*q}:{left:58*q,right:18*q,top:104*q,bottom:285*q}):(nonFullLandscape?{left:58*q,right:22*q,top:56*q,bottom:48*q}:{left:66*q,right:24*q,top:88*q,bottom:44*q});g.clearRect(0,0,w,h);g.fillStyle='#05070c';g.fillRect(0,0,w,h);var vals=values(result);if(vals.length<2)vals=[0,100];var mm=minMax(vals),t0=result.start.getTime(),t1=result.end.getTime();var visibleSpan=t1-t0;if(result.mode!=='daily'&&visibleSpan>2.1*86400000&&visibleSpan<=7.1*86400000){pad.bottom=Math.max(pad.bottom,104*q)}drawAxes(g,w,h,q,mm,pad,t0,t1);drawKey(g,q,pad,isFull,result);function X(row,isForecast){var t;if(result.mode==='daily'||isForecast)t=new Date(row.date+'T12:00:00Z').getTime();else t=new Date(time(row)).getTime();return pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right)}function Y(v){return pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom)}drawForecast(g,result,q,X,Y);if(result.mode==='daily'){drawDailyLines(g,result,q,X,Y)}else{var lineRows=decimateRows(result.rows,Math.max(900,Math.floor((w/q)*1.8)));g.save();g.lineWidth=(isLandscape?2.4:2.1)*q;g.lineCap='round';g.lineJoin='round';for(var j=1;j<lineRows.length;j++){var aa=lineRows[j-1],bb=lineRows[j],col2=seasonColor(time(bb));g.strokeStyle=col2;g.shadowColor=col2;g.shadowBlur=(isLandscape?7:5)*q;g.beginPath();g.moveTo(X(aa),Y(price(aa)));g.lineTo(X(bb),Y(price(bb)));g.stroke()}g.restore()}var s=stats(result);if(s){var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.8)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,4.5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,4.5*q,0,Math.PI*2);g.fill();g.restore();drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);set('ph-latest-price','£'+fmt(s.avg,2)+'/MWh');set('ph-latest-time',s.avgDate);set('ph-row-count',(result.rows||[]).length.toLocaleString('en-GB'));set('ph-source','Elexon BMRS')}else{g.save();g.fillStyle='#00ffff';g.font='900 '+13*q+'px Courier New';g.textAlign='center';g.fillText('No actual data yet · showing indicative seasonal baseline',w/2,pad.top+48*q);g.restore();set('ph-latest-price','Forecast baseline');set('ph-row-count','0');set('ph-source','Seasonal baseline')}if(!isFull&&result.forecastRows&&result.forecastRows.length)drawHealthBar(g,result,q,w,h,pad);set('price-history-range-status',new Date(result.start).toLocaleDateString('en-GB')+' to '+new Date(result.end).toLocaleDateString('en-GB')+' | '+(result.rows||[]).length.toLocaleString('en-GB')+' actual points')}"

    new = "function renderTo(canvasId,result){var c=document.getElementById(canvasId);if(!c)return;ensureInspectControls(canvasId,result);attachInspectEvents(canvasId);var isFull=canvasId==='price-history-fullscreen-canvas';var q=window.devicePixelRatio||1,r=c.getBoundingClientRect();c.width=Math.max(320,Math.floor((r.width||1200)*q));c.height=Math.max(360,Math.floor((r.height||720)*q));var g=c.getContext('2d'),w=c.width,h=c.height,cssW=w/q,cssH=h/q,isLandscape=isFull&&cssW>cssH;var nonFullLandscape=!isFull&&cssW>cssH;var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:74*q,bottom:44*q}:{left:58*q,right:18*q,top:104*q,bottom:285*q}):(nonFullLandscape?{left:58*q,right:22*q,top:56*q,bottom:48*q}:{left:66*q,right:24*q,top:88*q,bottom:44*q});g.clearRect(0,0,w,h);g.fillStyle='#05070c';g.fillRect(0,0,w,h);var vals=values(result);if(vals.length<2)vals=[0,100];var mm=minMax(vals),t0=result.start.getTime(),t1=result.end.getTime();var visibleSpan=t1-t0;if(result.mode!=='daily'&&visibleSpan>2.1*86400000&&visibleSpan<=7.1*86400000){pad.bottom=Math.max(pad.bottom,104*q)}drawAxes(g,w,h,q,mm,pad,t0,t1);drawKey(g,q,pad,isFull,result);function X(row,isForecast){var t;if(result.mode==='daily'||isForecast)t=new Date(row.date+'T12:00:00Z').getTime();else t=new Date(time(row)).getTime();return pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right)}function Y(v){return pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom)}drawForecast(g,result,q,X,Y);if(result.mode==='daily'){drawDailyLines(g,result,q,X,Y)}else{var lineRows=decimateRows(result.rows,Math.max(900,Math.floor((w/q)*1.8)));g.save();g.lineWidth=(isLandscape?2.4:2.1)*q;g.lineCap='round';g.lineJoin='round';for(var j=1;j<lineRows.length;j++){var aa=lineRows[j-1],bb=lineRows[j],col2=seasonColor(time(bb));g.strokeStyle=col2;g.shadowColor=col2;g.shadowBlur=(isLandscape?7:5)*q;g.beginPath();g.moveTo(X(aa),Y(price(aa)));g.lineTo(X(bb),Y(price(bb)));g.stroke()}g.restore()}var s=stats(result);if(s){var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.8)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,4.5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,4.5*q,0,Math.PI*2);g.fill();g.restore();drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);set('ph-latest-price','£'+fmt(s.avg,2)+'/MWh');set('ph-latest-time',s.avgDate);set('ph-row-count',(result.rows||[]).length.toLocaleString('en-GB'));set('ph-source','Elexon BMRS')}else{g.save();g.fillStyle='#00ffff';g.font='900 '+13*q+'px Courier New';g.textAlign='center';g.fillText('No actual data yet · showing indicative seasonal baseline',w/2,pad.top+48*q);g.restore();set('ph-latest-price','Forecast baseline');set('ph-row-count','0');set('ph-source','Seasonal baseline')}drawInspectOverlay(g,result,q,w,h,pad,X,Y,canvasId);if(!isFull&&result.forecastRows&&result.forecastRows.length)drawHealthBar(g,result,q,w,h,pad);set('price-history-range-status',new Date(result.start).toLocaleDateString('en-GB')+' to '+new Date(result.end).toLocaleDateString('en-GB')+' | '+(result.rows||[]).length.toLocaleString('en-GB')+' actual points')}"

    if "drawInspectOverlay(g,result,q,w,h,pad,X,Y,canvasId)" not in text:
        text = replace_once(text, old, new, "renderer renderTo inspect overlay")

    for marker in [
        "function inspectAllowed",
        "function nearestInspectIndex",
        "function ensureInspectControls",
        "function attachInspectEvents",
        "function drawInspectOverlay",
        "drawInspectOverlay(g,result,q,w,h,pad,X,Y,canvasId)",
        "<=186*86400000",
    ]:
        must_contain(text, marker, "renderer inspect repair")

    write(path, text)


def write_report():
    report = f"""# V6 Repair Report: Chart Inspect Arrows

Generated UTC: {datetime.now(timezone.utc).isoformat()}

## Scope

This repair adds chart inspection behaviour to the shared V6 price chart renderer.

## Behaviour

1. Inspection is available only for raw half hourly chart windows up to 6 months.
2. The initial inspection line appears at the highest visible half hourly price point.
3. The selected data box appears only after the user moves the pointer or uses the previous or next point arrows.
4. Mouse movement, touch movement, previous point and next point all snap to exact loaded half hourly points.
5. Long daily aggregate views remain unchanged.

## Files touched by script

{chr(10).join('- ' + x for x in TOUCHED) if TOUCHED else '- No file content changes were required'}

## Guardrails

- No CSV files changed.
- No data loader files changed.
- No source paths changed.
- No annual calculations changed.
- Both the live V6 page and the main article chart use the same shared renderer.

## Manual checks

1. Open /uk_energy_tracking_v6/.
2. Select Latest 1 week.
3. Confirm a thin inspection line starts at the high point.
4. Press previous point and next point.
5. Confirm the selected data box appears with exact date, time and £/MWh.
6. Touch or move mouse across the chart and confirm snapping to points.
7. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html and repeat.
8. Confirm 10 year daily view is not changed.
"""
    FILES["report"].write_text(report, encoding="utf-8")
    if str(FILES["report"].relative_to(ROOT)) not in TOUCHED:
        TOUCHED.append(str(FILES["report"].relative_to(ROOT)))


def main():
    ai = read(FILES["ai_start"])
    protocol = read(FILES["protocol"])
    must_contain(ai, "Do not directly rewrite large HTML, CSS or JavaScript files", "AI_START_HERE")
    must_contain(protocol, "All V6 changes", "V6 protocol")
    patch_renderer()
    write_report()
    print("V6 chart inspect arrow repair completed.")
    for item in TOUCHED:
        print("touched:", item)


if __name__ == "__main__":
    main()
