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
    issues.append("Current V6 has custom tracker layout rather than V5 style event labels")

# Replace any existing V6 annotation helper block from compactDateText to drawSummary with V5 style helpers.
replacement = """  function compactDateText(t){return String(t||'').replace(/January/g,'Jan').replace(/February/g,'Feb').replace(/March/g,'Mar').replace(/April/g,'Apr').replace(/June/g,'Jun').replace(/July/g,'Jul').replace(/August/g,'Aug').replace(/September/g,'Sep').replace(/October/g,'Oct').replace(/November/g,'Nov').replace(/December/g,'Dec')}
  function v5LabelLines(label,val,date,clock){return[label+' £'+fmt(val,2)+'/MWh',compactDateText(date)+(clock?' '+clock:'')]}
  function v5MeasureBox(g,lines,q){g.save();g.font='900 '+12*q+'px Courier New';var w=0;lines.forEach(function(t){w=Math.max(w,g.measureText(t).width)});g.restore();return{w:w+18*q,h:50*q}}
  function v5DrawBox(g,lines,q,x,y,anchor){var m=v5MeasureBox(g,lines,q),xx=anchor==='right'?x-m.w:x,yy=y-m.h/2;if(xx<8*q)xx=8*q;if(xx+m.w>g.canvas.width-8*q)xx=g.canvas.width-m.w-8*q;if(yy<8*q)yy=8*q;if(yy+m.h>g.canvas.height-8*q)yy=g.canvas.height-m.h-8*q;g.save();g.fillStyle='rgba(5,7,12,.78)';g.strokeStyle='rgba(0,255,255,.48)';g.lineWidth=1.1*q;g.shadowColor='rgba(0,255,255,.22)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,yy,m.w,m.h,7*q);g.fill();g.stroke();g.shadowBlur=0;g.textAlign='left';g.font='900 '+12*q+'px Courier New';g.fillStyle='#ff3333';g.fillText(lines[0],xx+9*q,yy+20*q);g.fillText(lines[1],xx+9*q,yy+39*q);g.restore();return{x:xx,y:yy,w:m.w,h:m.h}}
  function v5DrawConnector(g,from,box,q){var tx=from.x<box.x?box.x:box.x+box.w,ty=box.y+box.h*.50;g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.45)';g.shadowBlur=6*q;g.lineWidth=1.2*q;g.beginPath();g.moveTo(from.x,from.y);g.lineTo(tx,ty);g.stroke();g.restore()}
  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){var plotLeft=pad.left,plotRight=w-pad.right,plotTop=pad.top,plotBottom=h-pad.bottom,plotW=plotRight-plotLeft,plotH=plotBottom-plotTop;var highPoint={x:X(s.hi),y:Y(s.hiValue)},lowPoint={x:X(s.lo),y:Y(s.loValue)};function dot(p){g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(p.x,p.y,5.5*q,0,Math.PI*2);g.fill();g.restore()}dot(highPoint);dot(lowPoint);var highAnchor,lowAnchor,highX,highY,lowX,lowY;if(isFull&&isLandscape){highAnchor='right';lowAnchor='right';highX=plotRight-10*q;highY=plotTop+plotH*.18;lowX=plotRight-10*q;lowY=plotTop+plotH*.82}else{highAnchor=highPoint.x>plotLeft+plotW*.55?'right':'left';lowAnchor=lowPoint.x>plotLeft+plotW*.55?'right':'left';highX=highAnchor==='right'?Math.min(plotRight-8*q,highPoint.x+plotW*.36):Math.max(plotLeft+8*q,highPoint.x-plotW*.08);highY=Math.max(plotTop+44*q,Math.min(plotTop+plotH*.30,highPoint.y-38*q));lowX=lowAnchor==='right'?Math.min(plotRight-8*q,lowPoint.x+plotW*.30):Math.max(plotLeft+8*q,lowPoint.x-plotW*.18);lowY=Math.max(plotTop+plotH*.70,Math.min(plotBottom-44*q,lowPoint.y+46*q))}var highBox=v5DrawBox(g,v5LabelLines('HIGH',s.hiValue,s.hiDate,s.hiClock),q,highX,highY,highAnchor);var lowBox=v5DrawBox(g,v5LabelLines('LOW',s.loValue,s.loDate,s.loClock),q,lowX,lowY,lowAnchor);v5DrawConnector(g,highPoint,highBox,q);v5DrawConnector(g,lowPoint,lowBox,q)}
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

# Remove every known bottom summary draw call from the render path. Keep function definition for rollback, but do not call it.
patterns = [
    "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);drawSummary(g,s,q,w,h,pad,isFull,isLandscape);",
    "drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);",
    "if(isFull){drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}else{drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}",
]
for p in patterns:
    js = js.replace(p, "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);")

if "drawSummary(g,s,q,w,h,pad,isFull,isLandscape);" in js:
    raise RuntimeError("Bottom summary call remains after repair")
for token in ["v5DrawBox", "v5DrawConnector", "HIGH", "LOW", "isFull&&isLandscape"]:
    if token not in js:
        raise RuntimeError(f"V5 style assertion failed: {token}")
if "AVERAGE" in js[js.find("function drawHighAverageLowTrackers"):js.find("function drawHighAverageLowTrackers")+1800]:
    raise RuntimeError("Average label still present in V5 style event annotation block")

# Clean index.md so only the working renderer is loaded and cache-busted.
index = re.sub(r'\n<script src="/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart_box_overlay\.js\?v=[^"]+"></script>', "", index)
index = re.sub(r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart_v6_clean_boxes\.js\?v=[^"]+',
               '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602v5style1', index)
index = re.sub(r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart\.js\?v=[^"]+',
               '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602v5style1', index)
if "render_price_chart_box_overlay.js" in index or "render_price_chart_v6_clean_boxes.js" in index:
    raise RuntimeError("Old overlay or replacement renderer still referenced in index.md")
if "render_price_chart.js?v=20260602v5style1" not in index:
    raise RuntimeError("Working renderer cache bust missing")

RENDER.write_text(js, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")

v5_after = (V5 / "price-history-ui.js").read_text(encoding="utf-8")
if v5_after != v5_before:
    raise RuntimeError("V5 changed unexpectedly")

REPORT.write_text(f"""# V6 Repair Report: V5 Style Price Annotations

Status: generated by deterministic diagnostic repair script.

## User instruction

Copy the V5 annotation style into V6.

## Diagnosis before repair

{chr(10).join('- ' + i for i in issues) if issues else '- No duplicate overlay issue detected before repair.'}

## V5 reference confirmed

The script verified V5 contains:

1. `eventBox`
2. `drawPointer`
3. `drawEvents`
4. `drawDailyEvents`

V5 was read as the behavioural reference and was not modified.

## Behaviour applied to V6

1. HIGH and LOW event labels only, matching the V5 concept.
2. Red dots remain at the exact high and low data points.
3. Connector lines run from the real high and low points to the event label boxes.
4. No AVERAGE event box is drawn, because V5 does not use an average event label.
5. The bottom summary box draw call is removed.
6. The overlay workaround is removed from `index.md`.
7. The broken replacement renderer reference is removed if present.
8. Fullscreen landscape receives the same simple V5 style: big chart, high box top right, low box lower right, connectors to true points.
9. The working renderer is cache-busted to `20260602v5style1`.

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

Expected result: V6 chart resembles V5, with large chart area, high and low event labels, red dots at the exact points and connector lines to those points. No bottom summary box and no average event box.
""", encoding="utf-8")

print("V6 V5 style price annotation repair prepared.")
