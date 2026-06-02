from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"
V5 = ROOT / "uk_energy_tracking_v5"
RENDER = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
INDEX = V6 / "index.md"
REPORT = V6 / "V6_REPAIR_PRICE_ANNOTATIONS_V5_STYLE_REPORT.md"

required = [
    ROOT / "AI_START_HERE.md",
    V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    V6 / "V5_V6_COMPARISON_REPORT.md",
    V5 / "price-history-ui.js",
    RENDER,
    INDEX,
]
for path in required:
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {path.relative_to(ROOT)}")
    path.read_text(encoding="utf-8")

v5_before = (V5 / "price-history-ui.js").read_text(encoding="utf-8")
for token in ["function eventBox", "function drawPointer", "function drawEvents", "function drawDailyEvents"]:
    if token not in v5_before:
        raise RuntimeError(f"V5 reference token missing: {token}")

js = RENDER.read_text(encoding="utf-8")
index = INDEX.read_text(encoding="utf-8")
issues = []
if "render_price_chart_box_overlay.js" in index:
    issues.append("Overlay workaround loaded after renderer")
if "render_price_chart_v6_clean_boxes.js" in index:
    issues.append("Broken replacement renderer reference present")
if "drawSummary(g,s,q,w,h,pad,isFull,isLandscape)" in js:
    issues.append("Bottom summary box still being drawn")
if "function drawHighAverageLowTrackers" in js:
    issues.append("Current V6 has custom tracker layout instead of V5 event annotation logic")

# V5 UI method, adapted only at the data boundary for V6 field names.
# No data loading, filtering, period selection, forecast or control logic is touched.
replacement = """  function compactDateText(t){return String(t||'').replace(/January/g,'Jan').replace(/February/g,'Feb').replace(/March/g,'Mar').replace(/April/g,'Apr').replace(/June/g,'Jun').replace(/July/g,'Jul').replace(/August/g,'Aug').replace(/September/g,'Sep').replace(/October/g,'Oct').replace(/November/g,'Nov').replace(/December/g,'Dec')}
  function eventBox(g,lines,q,x,y,align){var pad=8*q,lh=18*q,wid=0;g.save();g.font='900 '+14*q+'px Courier New';lines.forEach(function(t){wid=Math.max(wid,g.measureText(t).width)});var bh=lines.length*lh+pad*2,xx=align==='right'?x-wid-pad*2:x;g.fillStyle='rgba(5,7,12,.78)';g.strokeStyle='rgba(0,255,255,.35)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,y-bh+4*q,wid+pad*2,bh,6*q);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#ff3333';g.textAlign=align;lines.forEach(function(t,i){g.fillText(t,x,y-(lines.length-1-i)*lh)});g.restore()}
  function drawPointer(g,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.lineWidth=1.5*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y-24*q);g.stroke();g.restore()}
  function drawV5StyleEvents(g,s,X,Y,q,w,h,pad){if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hr=hx<w/2,lr=lx<w/2;var hxText=hr?Math.min(w-pad.right-150*q,hx+18*q):Math.max(pad.left+150*q,hx-18*q);var lxText=lr?Math.min(w-pad.right-150*q,lx+18*q):Math.max(pad.left+150*q,lx-18*q);var hyText=Math.max(pad.top+54*q,hy-24*q);var lyText=Math.min(h-pad.bottom-28*q,ly+54*q);drawPointer(g,{x:hx,y:hy},q,hxText,hyText);drawPointer(g,{x:lx,y:ly},q,lxText,lyText);eventBox(g,['HIGH','£'+fmt(s.hiValue,2)+'/MWh',compactDateText(s.hiDate)+(s.hiClock?' '+s.hiClock:'')],q,hxText,hyText,hr?'left':'right');eventBox(g,['LOW','£'+fmt(s.loValue,2)+'/MWh',compactDateText(s.loDate)+(s.loClock?' '+s.loClock:'')],q,lxText,lyText,lr?'left':'right')}
  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){drawV5StyleEvents(g,s,X,Y,q,w,h,pad)}
"""

js, count = re.subn(
    r"  function compactDateText\(t\)\{.*?\n  function drawSummary",
    replacement + "  function drawSummary",
    js,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Could not replace V6 annotation helper block safely")

# Remove bottom summary draw calls, keeping the function definition untouched for rollback traceability.
patterns = [
    "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);drawSummary(g,s,q,w,h,pad,isFull,isLandscape);",
    "drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);",
    "if(isFull){drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}else{drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}",
]
for p in patterns:
    js = js.replace(p, "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);")

if "drawSummary(g,s,q,w,h,pad,isFull,isLandscape);" in js:
    raise RuntimeError("Bottom summary call remains after repair")
for token in ["function eventBox", "function drawPointer", "function drawV5StyleEvents", "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)"]:
    if token not in js:
        raise RuntimeError(f"V5 style assertion failed: {token}")
tracker_slice = js[js.find("function drawHighAverageLowTrackers"):js.find("function drawHighAverageLowTrackers")+500]
if "AVERAGE" in tracker_slice:
    raise RuntimeError("Average label still present in event annotation block")

# Clean index.md so only the working V6 renderer is loaded and cache-busted.
index = re.sub(r'\n<script src="/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart_box_overlay\.js\?v=[^"]+"></script>', "", index)
index = re.sub(r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart_v6_clean_boxes\.js\?v=[^"]+',
               '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602v5exact1', index)
index = re.sub(r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart\.js\?v=[^"]+',
               '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602v5exact1', index)
if "render_price_chart_box_overlay.js" in index or "render_price_chart_v6_clean_boxes.js" in index:
    raise RuntimeError("Old overlay or replacement renderer still referenced in index.md")
if "render_price_chart.js?v=20260602v5exact1" not in index:
    raise RuntimeError("Working renderer cache bust missing")

RENDER.write_text(js, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")

v5_after = (V5 / "price-history-ui.js").read_text(encoding="utf-8")
if v5_after != v5_before:
    raise RuntimeError("V5 changed unexpectedly")

REPORT.write_text(f"""# V6 Repair Report: V5 Style Price Annotations

Status: generated by deterministic diagnostic repair script.

## User instruction

Copy the V5 in-page price annotation UI method into V6, on and off fullscreen, while keeping V6 data logic.

## Diagnosis before repair

{chr(10).join('- ' + i for i in issues) if issues else '- No duplicate overlay issue detected before repair.'}

## V5 reference confirmed

The script verified V5 contains:

1. `eventBox`
2. `drawPointer`
3. `drawEvents`
4. `drawDailyEvents`

V5 was read as the UI reference and was not modified.

## Behaviour applied to V6

1. Uses V5-style `eventBox` and `drawPointer` functions inside the V6 renderer.
2. Uses V6 rows, V6 stats, V6 X/Y scaling and V6 period controls.
3. Draws HIGH and LOW labels only, matching V5.
4. Red dots remain at the exact high and low data points.
5. Removes the AVERAGE event label.
6. Removes the bottom summary box draw call.
7. Removes the overlay workaround from `index.md`.
8. Removes the broken replacement renderer reference if present.
9. Cache-busts the working renderer to `20260602v5exact1`.

## Files modified by workflow

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/index.md`
3. `uk_energy_tracking_v6/V6_REPAIR_PRICE_ANNOTATIONS_V5_STYLE_REPORT.md`

## Files deliberately not modified

1. `uk_energy_tracking_v5/price-history-ui.js`
2. V5 data files
3. V6 data feeds
4. V6 control logic
5. V6 CSS

## Required test

Open `/uk_energy_tracking_v6/` and hard refresh.

Expected result: V6 keeps its data and controls but the chart annotations behave like V5: HIGH and LOW only, red dots at the exact points and V5-style labels in page and fullscreen modes. No bottom summary box and no average box.
""", encoding="utf-8")

print("V6 V5 exact UI annotation repair prepared.")
