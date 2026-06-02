from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"
TARGET = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
INDEX = V6 / "index.md"
REPORT = V6 / "V6_REPAIR_EVENT_BOXES_VISIBLE_REPORT.md"

for rel in [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
    "uk_energy_tracking_v5/price-history-ui.js",
    "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js",
    "uk_energy_tracking_v6/index.md",
]:
    p = ROOT / rel
    if not p.exists():
        raise FileNotFoundError(f"Required file missing: {rel}")
    p.read_text(encoding="utf-8")

text = TARGET.read_text(encoding="utf-8")
if "function drawHighAverageLowTrackers" not in text:
    raise RuntimeError("Previous tracker function missing. Run or inspect high low tracker repair first.")

old_tracker = """  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){if(isFull&&isLandscape)return;var avgX=(pad.left+w-pad.right)/2,avgY=Y(s.avg);var items=[{label:'HIGH',val:s.hiValue,date:s.hiDate,clock:s.hiClock,x:X(s.hi),y:Y(s.hiValue),kind:'edge'},{label:'AVERAGE',val:s.avg,date:'Visible period',clock:'',x:avgX,y:avgY,kind:'center'},{label:'LOW',val:s.loValue,date:s.loDate,clock:s.loClock,x:X(s.lo),y:Y(s.loValue),kind:'edge'}];items.forEach(function(it){var left=it.x<w/2,tx,ty,align;if(it.kind==='center'){tx=avgX;ty=Math.max(pad.top+52*q,Math.min(h-pad.bottom-60*q,avgY-38*q));align='center'}else{tx=left?Math.min(w-pad.right-150*q,it.x+18*q):Math.max(pad.left+150*q,it.x-18*q);ty=it.label==='HIGH'?Math.max(pad.top+56*q,it.y-24*q):Math.min(h-pad.bottom-36*q,it.y+58*q);align=left?'left':'right'}drawTrackerPointer(g,{x:it.x,y:it.y},q,tx,ty);drawTrackerBox(g,trackerLines(it.label,it.val,it.date,it.clock),q,tx,ty,align)})}
"""

new_tracker = """  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){if(isFull&&isLandscape)return;var avgX=(pad.left+w-pad.right)/2,avgY=Y(s.avg),top=pad.top,bottom=h-pad.bottom;var highX=X(s.hi),highY=Y(s.hiValue),lowX=X(s.lo),lowY=Y(s.loValue);var items=[{label:'HIGH',val:s.hiValue,date:s.hiDate,clock:s.hiClock,x:highX,y:highY,tx:Math.min(w-pad.right-150*q,highX+22*q),ty:Math.max(top+70*q,Math.min(bottom-18*q,highY+70*q)),align:'left'},{label:'AVERAGE',val:s.avg,date:'Visible period',clock:'',x:avgX,y:avgY,tx:avgX,ty:Math.max(top+118*q,Math.min(bottom-74*q,avgY-42*q)),align:'center'},{label:'LOW',val:s.loValue,date:s.loDate,clock:s.loClock,x:lowX,y:lowY,tx:Math.max(pad.left+150*q,lowX-22*q),ty:Math.max(top+74*q,Math.min(bottom-28*q,lowY-46*q)),align:'right'}];items.forEach(function(it){drawTrackerPointer(g,{x:it.x,y:it.y},q,it.tx,it.ty);drawTrackerBox(g,trackerLines(it.label,it.val,it.date,it.clock),q,it.tx,it.ty,it.align)})}
"""

if old_tracker not in text:
    raise RuntimeError("Expected previous tracker function not found. Refusing uncontrolled repair.")
text = text.replace(old_tracker, new_tracker, 1)

old_call = "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);drawSummary(g,s,q,w,h,pad,isFull,isLandscape);"
new_call = "if(isFull){drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}else{drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}"
if old_call not in text:
    raise RuntimeError("Expected tracker plus summary call not found. Refusing uncontrolled repair.")
text = text.replace(old_call, new_call, 1)

TARGET.write_text(text, encoding="utf-8")
updated = TARGET.read_text(encoding="utf-8")
for token in [
    "if(isFull){drawSummary",
    "else{drawHighAverageLowTrackers",
    "top=pad.top,bottom=h-pad.bottom",
    "ty:Math.max(top+70*q",
]:
    if token not in updated:
        raise RuntimeError(f"Post repair assertion failed: {token}")

idx = INDEX.read_text(encoding="utf-8")
old_src = "/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602hilo1"
new_src = "/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602boxes2"
if old_src in idx:
    idx = idx.replace(old_src, new_src, 1)
elif new_src not in idx:
    raise RuntimeError("Expected render script cache version not found")
INDEX.write_text(idx, encoding="utf-8")

REPORT.write_text("""# V6 Repair Report: Event Boxes Visible

Status: prepared by deterministic repair script.

## Problem observed

The previous high low tracker repair committed successfully, but the visual result did not show the floating boxes on the live V6 chart. The existing bottom summary box also remained in normal in-page mode.

## Behaviour changed

1. Repositions HIGH, AVERAGE and LOW tracker boxes inside the visible plot area using explicit top and bottom plot bounds.
2. Draws in-page tracker boxes without drawing the bottom summary box.
3. Keeps the fullscreen portrait bottom summary box, then draws tracker boxes above it.
4. Keeps fullscreen landscape clean by preserving the existing no-tracker behaviour there.
5. Bumps the V6 render script query string so the live page loads the corrected renderer.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/index.md`
3. `uk_energy_tracking_v6/V6_REPAIR_EVENT_BOXES_VISIBLE_REPORT.md`

## Explicit non scope

No V5 file changed.
No CSS changed.
No data feed changed.
No forecast wiring changed.
No period dropdown changed.

## Required maintainer test

Open `/uk_energy_tracking_v6/`. In normal page mode confirm the old bottom summary box is gone and the HIGH, AVERAGE and LOW tracker boxes are visible on the chart. Then test fullscreen portrait and confirm the bottom summary box remains while chart tracker boxes are visible above it. Landscape should stay clean.
""", encoding="utf-8")

print("V6 event boxes visible repair prepared locally by script.")
