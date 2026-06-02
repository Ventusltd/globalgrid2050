from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"
TARGET = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
INDEX = V6 / "index.md"
REPORT = V6 / "V6_REPAIR_HIGH_LOW_TRACKERS_REPORT.md"

required = [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
    "uk_energy_tracking_v5/price-history-ui.js",
    "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js",
    "uk_energy_tracking_v6/index.md",
]

for rel in required:
    path = ROOT / rel
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {rel}")
    path.read_text(encoding="utf-8")

protocol = (V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md").read_text(encoding="utf-8")
if "High, average and low values must not be hidden" not in protocol:
    raise RuntimeError("V6 high average low chart contract not recognised")

v5 = (ROOT / "uk_energy_tracking_v5/price-history-ui.js").read_text(encoding="utf-8")
for token in ["function eventBox", "function drawPointer", "function drawEvents", "function drawDailyEvents"]:
    if token not in v5:
        raise RuntimeError(f"V5 reference tracker token missing: {token}")

text = TARGET.read_text(encoding="utf-8")
if "function drawHighAverageLowTrackers" in text:
    raise RuntimeError("High average low trackers already present. Refusing duplicate repair.")

insert_after = "  function compactDateText(t){return String(t||'').replace(/January/g,'Jan').replace(/February/g,'Feb').replace(/March/g,'Mar').replace(/April/g,'Apr').replace(/June/g,'Jun').replace(/July/g,'Jul').replace(/August/g,'Aug').replace(/September/g,'Sep').replace(/October/g,'Oct').replace(/November/g,'Nov').replace(/December/g,'Dec')}\n"
if insert_after not in text:
    raise RuntimeError("Expected compactDateText marker not found. Refusing uncontrolled repair.")

tracker_functions = """  function trackerLines(label,val,date,clock){return[label,'£'+fmt(val,2)+'/MWh  '+pence(val)+'p/kWh',compactDateText(date)+(clock?' '+clock:'')]}\n  function drawTrackerPointer(g,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.lineWidth=1.4*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y-22*q);g.stroke();g.restore()}\n  function drawTrackerBox(g,lines,q,x,y,align){var pad=7*q,lh=15*q,wid=0;g.save();g.font='900 '+(align==='center'?10:9.5)*q+'px Courier New';lines.forEach(function(t){wid=Math.max(wid,g.measureText(t).width)});var bh=lines.length*lh+pad*2,bw=wid+pad*2,xx=align==='right'?x-bw:(align==='center'?x-bw/2:x);if(xx<8*q)xx=8*q;if(xx+bw>g.canvas.width-8*q)xx=g.canvas.width-bw-8*q;var yy=y-bh+4*q;if(yy<8*q)yy=8*q;if(yy+bh>g.canvas.height-8*q)yy=g.canvas.height-bh-8*q;g.fillStyle='rgba(5,7,12,.82)';g.strokeStyle='rgba(0,255,255,.42)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,yy,bw,bh,6*q);g.fill();g.stroke();g.shadowBlur=0;g.textAlign='left';lines.forEach(function(t,i){g.fillStyle=i===0?'#ff3333':(i===1?'#f5f7fb':'#9aa3b6');g.fillText(t,xx+pad,yy+pad+lh*(i+0.75))});g.restore()}\n  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){if(isFull&&isLandscape)return;var avgX=(pad.left+w-pad.right)/2,avgY=Y(s.avg);var items=[{label:'HIGH',val:s.hiValue,date:s.hiDate,clock:s.hiClock,x:X(s.hi),y:Y(s.hiValue),kind:'edge'},{label:'AVERAGE',val:s.avg,date:'Visible period',clock:'',x:avgX,y:avgY,kind:'center'},{label:'LOW',val:s.loValue,date:s.loDate,clock:s.loClock,x:X(s.lo),y:Y(s.loValue),kind:'edge'}];items.forEach(function(it){var left=it.x<w/2,tx,ty,align;if(it.kind==='center'){tx=avgX;ty=Math.max(pad.top+52*q,Math.min(h-pad.bottom-60*q,avgY-38*q));align='center'}else{tx=left?Math.min(w-pad.right-150*q,it.x+18*q):Math.max(pad.left+150*q,it.x-18*q);ty=it.label==='HIGH'?Math.max(pad.top+56*q,it.y-24*q):Math.min(h-pad.bottom-36*q,it.y+58*q);align=left?'left':'right'}drawTrackerPointer(g,{x:it.x,y:it.y},q,tx,ty);drawTrackerBox(g,trackerLines(it.label,it.val,it.date,it.clock),q,tx,ty,align)})}\n"""
text = text.replace(insert_after, insert_after + tracker_functions, 1)

old_call = "g.restore();drawSummary(g,s,q,w,h,pad,isFull,isLandscape);set('ph-latest-price'"
new_call = "g.restore();drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);drawSummary(g,s,q,w,h,pad,isFull,isLandscape);set('ph-latest-price'"
if old_call not in text:
    raise RuntimeError("Expected post-dot drawSummary call not found. Refusing uncontrolled repair.")
text = text.replace(old_call, new_call, 1)

TARGET.write_text(text, encoding="utf-8")
updated = TARGET.read_text(encoding="utf-8")
for token in ["function drawHighAverageLowTrackers", "trackerLines", "drawTrackerPointer", "drawTrackerBox", "AVERAGE", "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)"]:
    if token not in updated:
        raise RuntimeError(f"Post repair assertion failed: {token}")

index_text = INDEX.read_text(encoding="utf-8")
old_src = "/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260601c"
new_src = "/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602hilo1"
if old_src in index_text:
    index_text = index_text.replace(old_src, new_src, 1)
elif new_src not in index_text:
    raise RuntimeError("Expected V6 render script cache-bust URL not found")
INDEX.write_text(index_text, encoding="utf-8")

REPORT.write_text("""# V6 Repair Report: High Low Trackers

Status: prepared by deterministic repair script.

## Scope

This repair restores V5-style floating price tracker boxes inside the V6 electricity price chart.

## Behaviour changed

1. Adds floating chart callouts for HIGH, AVERAGE and LOW.
2. Uses the V5 event-box and pointer concept as the behavioural reference.
3. Applies to the normal in-page chart and fullscreen portrait chart.
4. Keeps fullscreen landscape clean by not drawing tracker boxes there.
5. Leaves the existing fullscreen portrait bottom summary box in place.
6. Bumps the V6 render script query string so the live page loads the repaired renderer.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/index.md`
3. `uk_energy_tracking_v6/V6_REPAIR_HIGH_LOW_TRACKERS_REPORT.md`

## Explicit non scope

No V5 file changed.
No CSS changed.
No data feed changed.
No forecast wiring changed.
No period dropdown changed.

## Required maintainer test

Open `/uk_energy_tracking_v6/`, test the in-page chart, then enter fullscreen portrait. Confirm HIGH, AVERAGE and LOW tracker boxes render on the chart and the existing bottom summary box remains readable. Rotate to landscape and confirm the graph remains clean without tracker boxes.
""", encoding="utf-8")

print("V6 high low tracker repair prepared locally by script.")
