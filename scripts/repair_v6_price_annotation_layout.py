from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"
V5 = ROOT / "uk_energy_tracking_v5"
RENDER = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
INDEX = V6 / "index.md"
REPORT = V6 / "V6_REPAIR_PRICE_ANNOTATION_LAYOUT_REPORT.md"

REQUIRED = [
    ROOT / "AI_START_HERE.md",
    V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    V6 / "V5_V6_COMPARISON_REPORT.md",
    V5 / "price-history-ui.js",
    RENDER,
    INDEX,
]

for path in REQUIRED:
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {path.relative_to(ROOT)}")
    path.read_text(encoding="utf-8")

v5_before = (V5 / "price-history-ui.js").read_text(encoding="utf-8")
for token in ["function eventBox", "function drawPointer", "function drawEvents", "function drawDailyEvents"]:
    if token not in v5_before:
        raise RuntimeError(f"V5 reference behaviour missing: {token}")

js = RENDER.read_text(encoding="utf-8")
index = INDEX.read_text(encoding="utf-8")

issues = []
if "function drawTrackerPointer" in js and "lineTo" in js[js.find("function drawTrackerPointer"):js.find("function drawTrackerPointer") + 350]:
    issues.append("Visible pointer lines are still drawn by drawTrackerPointer, causing diagonal clutter.")
if "function drawHighAverageLowTrackers" not in js:
    raise RuntimeError("V6 tracker function missing; refusing to patch a different renderer shape.")
if "drawSummary(g,s,q,w,h,pad,isFull,isLandscape)" in js:
    issues.append("Bottom summary box is still being called, creating a competing annotation layer.")
if "render_price_chart_box_overlay.js" in index:
    issues.append("Overlay workaround is loaded in index.md, causing duplicate annotation passes.")
if "render_price_chart_v6_clean_boxes.js" in index:
    issues.append("Broken replacement renderer is still referenced in index.md.")
if "(mm.hi-v)/(mm.hi-mm.lo)" not in js:
    issues.append("Could not confirm normal y-axis mapping formula statically.")
else:
    issues.append("Y-axis formula is statically normal: higher prices map upward, lower prices map downward.")

# Turn the old pointer helper into a safe no-op so any old calls cannot draw stray diagonals.
js = re.sub(
    r"  function drawTrackerPointer\(g,point,q,x,y\)\{.*?\}\n  function drawTrackerBox",
    "  function drawTrackerPointer(g,point,q,x,y){return}\n  function drawTrackerBox",
    js,
    count=1,
    flags=re.S,
)
if "function drawTrackerPointer(g,point,q,x,y){return}" not in js:
    raise RuntimeError("Failed to make drawTrackerPointer a no-op")

# Replace only the V6 tracker layout. Keep the rest of the renderer intact.
new_tracker = """  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){
    var plotLeft=pad.left,plotRight=w-pad.right,plotTop=pad.top,plotBottom=h-pad.bottom;
    var chartWidth=plotRight-plotLeft,chartHeight=plotBottom-plotTop;
    var highPoint={x:X(s.hi),y:Y(s.hiValue)};
    var lowPoint={x:X(s.lo),y:Y(s.loValue)};
    var avgPoint={x:plotLeft+chartWidth*.50,y:Y(s.avg)};
    function dot(p){g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(p.x,p.y,5*q,0,Math.PI*2);g.fill();g.restore()}
    function connector(from,to){g.save();g.strokeStyle='rgba(255,51,51,.78)';g.shadowColor='rgba(0,255,255,.42)';g.shadowBlur=6*q;g.lineWidth=1.15*q;g.beginPath();g.moveTo(from.x,from.y);g.lineTo(to.x,to.y-25*q);g.stroke();g.restore()}
    dot(highPoint);dot(lowPoint);
    var maxW=chartWidth*.92,highBox,avgBox,lowBox;
    if(isFull&&isLandscape){
      var boxX=plotRight-chartWidth*.18;
      highBox={x:boxX,y:plotTop+chartHeight*.18};
      avgBox={x:boxX,y:plotTop+chartHeight*.50};
      lowBox={x:boxX,y:plotTop+chartHeight*.82};
      maxW=chartWidth*.36
    }else{
      var blankTop=plotBottom+46*q;
      var blankBottom=h-(isFull?18*q:22*q);
      if(blankBottom-blankTop<150*q){blankTop=plotBottom+22*q;blankBottom=h-10*q}
      var zoneH=Math.max(150*q,blankBottom-blankTop);
      var boxX=plotLeft+chartWidth*.50;
      highBox={x:boxX,y:blankTop+zoneH*.18};
      avgBox={x:boxX,y:blankTop+zoneH*.50};
      lowBox={x:boxX,y:blankTop+zoneH*.82}
    }
    connector(highPoint,highBox);connector(avgPoint,avgBox);connector(lowPoint,lowBox);
    drawTrackerBox(g,trackerLines('HIGH',s.hiValue,s.hiDate,s.hiClock),q,highBox.x,highBox.y,'center');
    drawTrackerBox(g,trackerLines('AVERAGE',s.avg,'Visible period',''),q,avgBox.x,avgBox.y,'center');
    drawTrackerBox(g,trackerLines('LOW',s.loValue,s.loDate,s.loClock),q,lowBox.x,lowBox.y,'center')
  }
"""

js, tracker_count = re.subn(
    r"  function drawHighAverageLowTrackers\(g,s,q,w,h,pad,X,Y,isFull,isLandscape\)\{.*?\n  \}\n  function drawSummary",
    new_tracker + "  function drawSummary",
    js,
    count=1,
    flags=re.S,
)
if tracker_count != 1:
    raise RuntimeError("Failed to replace exactly one drawHighAverageLowTrackers function")

# Remove all known forms of drawSummary usage from the render path. Keep drawSummary definition untouched for rollback traceability.
known_calls = [
    "if(isFull){drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}else{drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}",
    "g.restore();drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);drawSummary(g,s,q,w,h,pad,isFull,isLandscape);set('ph-latest-price'",
    "g.restore();drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);set('ph-latest-price'",
]
for call in known_calls:
    if call in js:
        if call.startswith("g.restore();"):
            js = js.replace(call, "g.restore();drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);set('ph-latest-price'", 1)
        else:
            js = js.replace(call, "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)", 1)

if "drawSummary(g,s,q,w,h,pad,isFull,isLandscape);" in js:
    raise RuntimeError("drawSummary call still remains in renderer path")
if "function drawTrackerPointer(g,point,q,x,y){return}" not in js:
    raise RuntimeError("Pointer no-op assertion failed")
for token in ["isFull&&isLandscape", "boxX=plotRight-chartWidth*.18", "blankTop=plotBottom+46*q", "connector(highPoint,highBox)"]:
    if token not in js:
        raise RuntimeError(f"Annotation layout assertion failed: {token}")

# Clean index.md so only the working renderer is loaded.
index = re.sub(r'\n<script src="/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart_box_overlay\.js\?v=[^"]+"></script>', "", index)
index = re.sub(r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart_v6_clean_boxes\.js\?v=[^"]+',
               '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602anno2', index)
index = re.sub(r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart\.js\?v=[^"]+',
               '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602anno2', index)

if "render_price_chart_box_overlay.js" in index:
    raise RuntimeError("Overlay workaround still referenced in index.md")
if "render_price_chart_v6_clean_boxes.js" in index:
    raise RuntimeError("Broken clean renderer still referenced in index.md")
if "render_price_chart.js?v=20260602anno2" not in index:
    raise RuntimeError("Cache-busted working renderer not referenced")

RENDER.write_text(js, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")

# Confirm V5 has not changed.
v5_after = (V5 / "price-history-ui.js").read_text(encoding="utf-8")
if v5_after != v5_before:
    raise RuntimeError("V5 changed unexpectedly. Aborting.")

REPORT.write_text(f"""# V6 Repair Report: Price Annotation Layout

Status: generated by deterministic diagnostic and repair script.

## Diagnosis before repair

{chr(10).join('- ' + item for item in issues)}

## Why the earlier attempts failed

1. Pointer lines were still active and crossed the chart.
2. The old bottom summary box was still being drawn.
3. The temporary overlay workaround created duplicate annotation passes.
4. The boxes were being placed inside the plot area rather than being assigned to deliberate zones.
5. Landscape mode had no specific design contract, so it inherited portrait logic and looked poor.

## V5 comparison

The script verified that V5 still contains the original event annotation concepts:

1. `eventBox`
2. `drawPointer`
3. `drawEvents`
4. `drawDailyEvents`

V5 was not modified.

## V6 repair behaviour

1. Keeps the existing working V6 renderer file.
2. Turns `drawTrackerPointer` into a no-op so old diagonal lines cannot appear.
3. Replaces only the `drawHighAverageLowTrackers` layout function.
4. Keeps the high and low red dots at the true data points.
5. Uses a mid-plot average reference point.
6. Removes the bottom summary box call.
7. Removes the prior overlay workaround from `index.md`.
8. Removes any broken replacement renderer reference from `index.md`.
9. Cache-busts the working renderer to `20260602anno2`.

## Portrait behaviour

HIGH, AVERAGE and LOW boxes are placed in the blank space below the plot:

1. HIGH in the upper blank zone.
2. AVERAGE in the middle blank zone.
3. LOW in the lower blank zone.

Connector lines run from the actual chart points to those boxes.

## Fullscreen landscape behaviour

Fullscreen landscape is treated separately:

1. The chart remains large.
2. Boxes are compact and placed on the right-hand side in top, middle and lower zones.
3. Connector lines run from the actual high, average and low points to the boxes.
4. The old bottom summary box is not drawn.

## Files modified by workflow

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/index.md`
3. `uk_energy_tracking_v6/V6_REPAIR_PRICE_ANNOTATION_LAYOUT_REPORT.md`

## Files deliberately not modified

1. `uk_energy_tracking_v5/price-history-ui.js`
2. V5 data files
3. V6 data pipeline files
4. V6 control logic
5. V6 CSS

## Test instruction

Open `/uk_energy_tracking_v6/`, hard refresh, then test:

1. Normal in-page mobile portrait.
2. Fullscreen mobile portrait.
3. Fullscreen mobile landscape.

Expected result: no duplicate bottom summary box, no overlay boxes, red dots remain at true high and low points, portrait boxes sit below the chart in the blank space, and landscape shows a large chart with compact right-side pointer boxes.
""", encoding="utf-8")

print("V6 price annotation layout diagnosis and repair prepared.")
