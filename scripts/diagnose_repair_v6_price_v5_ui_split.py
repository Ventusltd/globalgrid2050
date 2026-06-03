from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
V5 = ROOT / "uk_energy_tracking_v5"
V6 = ROOT / "uk_energy_tracking_v6"
RENDER = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
INDEX = V6 / "index.md"
REPORT = V6 / "V6_PRICE_V5_UI_SPLIT_DIAGNOSTIC_REPAIR.md"
COMPARE_V2 = V6 / "V5_V6_COMPARISON_REPORT_V2.md"

required = [
    ROOT / "AI_START_HERE.md",
    V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    V6 / "V5_V6_COMPARISON_REPORT.md",
    V5 / "price-history-ui.js",
    V5 / "price-history-fullscreen.js",
    RENDER,
    INDEX,
]
for path in required:
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {path.relative_to(ROOT)}")
    path.read_text(encoding="utf-8", errors="replace")

v5_ui = (V5 / "price-history-ui.js").read_text(encoding="utf-8", errors="replace")
v5_full = (V5 / "price-history-fullscreen.js").read_text(encoding="utf-8", errors="replace")
v5_ui_before = v5_ui
v5_full_before = v5_full

checks = []
for token in ["function eventBox", "function drawPointer", "function drawEvents", "function drawDailyEvents"]:
    ok = token in v5_ui
    checks.append((f"V5 in-page token {token}", ok))
    if not ok:
        raise RuntimeError(f"V5 in-page reference token missing: {token}")
for token in ["function eventText", "function drawEvents", "function draw", "function ensureControls"]:
    ok = token in v5_full
    checks.append((f"V5 fullscreen token {token}", ok))
    if not ok:
        raise RuntimeError(f"V5 fullscreen reference token missing: {token}")

js = RENDER.read_text(encoding="utf-8", errors="replace")
index = INDEX.read_text(encoding="utf-8", errors="replace")

findings = []
if "render_price_chart_box_overlay.js" in index:
    findings.append("index.md still loads the temporary overlay workaround.")
if "render_price_chart_v6_clean_boxes.js" in index:
    findings.append("index.md still references the broken clean replacement renderer.")
if "drawSummary(g,s,q,w,h,pad,isFull,isLandscape)" in js:
    findings.append("V6 renderer still calls the bottom summary box layer.")
if "function drawHighAverageLowTrackers" in js:
    findings.append("V6 currently routes both in-page and fullscreen annotation through one shared function.")
if "function eventText" not in js:
    findings.append("V6 renderer does not yet contain V5 fullscreen eventText logic.")
if "function eventBox" not in js:
    findings.append("V6 renderer does not yet contain V5 in-page eventBox logic.")

replacement = """  function compactDateText(t){return String(t||'').replace(/January/g,'Jan').replace(/February/g,'Feb').replace(/March/g,'Mar').replace(/April/g,'Apr').replace(/June/g,'Jun').replace(/July/g,'Jul').replace(/August/g,'Aug').replace(/September/g,'Sep').replace(/October/g,'Oct').replace(/November/g,'Nov').replace(/December/g,'Dec')}
  function fullEventDate(date,clock){return compactDateText(date)+(clock?' '+clock:'')}
  function eventBox(g,lines,q,x,y,align){var pad=8*q,lh=18*q,wid=0;g.save();g.font='900 '+14*q+'px Courier New';lines.forEach(function(t){wid=Math.max(wid,g.measureText(t).width)});var bh=lines.length*lh+pad*2,xx=align==='right'?x-wid-pad*2:x;g.fillStyle='rgba(5,7,12,.78)';g.strokeStyle='rgba(0,255,255,.35)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,y-bh+4*q,wid+pad*2,bh,6*q);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#ff3333';g.textAlign=align;lines.forEach(function(t,i){g.fillText(t,x,y-(lines.length-1-i)*lh)});g.restore()}
  function drawPointer(g,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.lineWidth=1.5*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y-24*q);g.stroke();g.restore()}
  function eventText(g,label,val,date,clock,q,x,y,align){g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.75)';g.shadowBlur=8*q;g.textAlign=align;g.font='bold '+10.5*q+'px Courier New';g.fillText(label+' £'+fmt(Number(val),2)+'/MWh',x,y);g.font='bold '+9*q+'px Courier New';g.fillText(fullEventDate(date,clock),x,y+13*q);g.restore()}
  function drawInPageEvents(g,s,X,Y,q,w,h,pad){if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hr=hx<w/2,lr=lx<w/2;var hxText=hr?Math.min(w-pad.right-150*q,hx+18*q):Math.max(pad.left+150*q,hx-18*q);var lxText=lr?Math.min(w-pad.right-150*q,lx+18*q):Math.max(pad.left+150*q,lx-18*q);var hyText=Math.max(pad.top+54*q,hy-24*q);var lyText=Math.min(h-pad.bottom-28*q,ly+54*q);drawPointer(g,{x:hx,y:hy},q,hxText,hyText);drawPointer(g,{x:lx,y:ly},q,lxText,lyText);eventBox(g,['HIGH','£'+fmt(s.hiValue,2)+'/MWh',fullEventDate(s.hiDate,s.hiClock)],q,hxText,hyText,hr?'left':'right');eventBox(g,['LOW','£'+fmt(s.loValue,2)+'/MWh',fullEventDate(s.loDate,s.loClock)],q,lxText,lyText,lr?'left':'right')}
  function drawFullscreenEvents(g,s,X,Y,q,w,h,pad){if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.9)';g.shadowBlur=9*q;g.beginPath();g.arc(hx,hy,4.6*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,4.6*q,0,Math.PI*2);g.fill();g.restore();var hw=150*q,off=12*q;var hRight=hx<((w-pad.right+pad.left)/2),lRight=lx<((w-pad.right+pad.left)/2);var hxText=hRight?Math.max(pad.left,Math.min(w-pad.right-hw,hx+off)):Math.max(pad.left+hw,Math.min(w-pad.right,hx-off));var lxText=lRight?Math.max(pad.left,Math.min(w-pad.right-hw,lx+off)):Math.max(pad.left+hw,Math.min(w-pad.right,lx-off));var hyText=Math.max(pad.top+18*q,Math.min(h-pad.bottom-64*q,hy-12*q));var lyText=Math.max(pad.top+18*q,Math.min(h-pad.bottom-40*q,ly+22*q));eventText(g,'HIGH',s.hiValue,s.hiDate,s.hiClock,q,hxText,hyText,hRight?'left':'right');eventText(g,'LOW',s.loValue,s.loDate,s.loClock,q,lxText,lyText,lRight?'left':'right')}
  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){if(isFull)drawFullscreenEvents(g,s,X,Y,q,w,h,pad);else drawInPageEvents(g,s,X,Y,q,w,h,pad)}
"""

js, count = re.subn(
    r"  function compactDateText\(t\)\{.*?\n  function drawSummary",
    replacement + "  function drawSummary",
    js,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Could not replace the V6 annotation helper block exactly once")

# Remove bottom summary calls from render path only. Keep definition for rollback audit.
patterns = [
    "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);drawSummary(g,s,q,w,h,pad,isFull,isLandscape);",
    "drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);",
    "if(isFull){drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}else{drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}",
]
for p in patterns:
    js = js.replace(p, "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape);")

if "drawSummary(g,s,q,w,h,pad,isFull,isLandscape);" in js:
    raise RuntimeError("drawSummary call still remains in render path")
for token in ["function eventBox", "function drawPointer", "function eventText", "function drawInPageEvents", "function drawFullscreenEvents", "if(isFull)drawFullscreenEvents"]:
    if token not in js:
        raise RuntimeError(f"Split V5 UI assertion failed: {token}")

# Clean index so only the V6 working renderer is used.
index = re.sub(r'\n<script src="/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart_box_overlay\.js\?v=[^"]+"></script>', "", index)
index = re.sub(r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart_v6_clean_boxes\.js\?v=[^"]+',
               '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260603v5split1', index)
index = re.sub(r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart\.js\?v=[^"]+',
               '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260603v5split1', index)
if "render_price_chart_box_overlay.js" in index or "render_price_chart_v6_clean_boxes.js" in index:
    raise RuntimeError("Old overlay or broken replacement renderer still referenced in index.md")
if "render_price_chart.js?v=20260603v5split1" not in index:
    raise RuntimeError("Cache-busted working renderer reference missing")

RENDER.write_text(js, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")

# Confirm V5 untouched.
if (V5 / "price-history-ui.js").read_text(encoding="utf-8", errors="replace") != v5_ui_before:
    raise RuntimeError("V5 in-page file changed unexpectedly")
if (V5 / "price-history-fullscreen.js").read_text(encoding="utf-8", errors="replace") != v5_full_before:
    raise RuntimeError("V5 fullscreen file changed unexpectedly")

# Optional comparison V2 regeneration, if script exists.
compare_status = "not run"
compare_script = ROOT / "scripts" / "compare_uk_energy_v5_v6_v2.py"
if compare_script.exists():
    ns = {"__name__": "__main__"}
    exec(compile(compare_script.read_text(encoding="utf-8"), str(compare_script), "exec"), ns)
    compare_status = "regenerated V5_V6_COMPARISON_REPORT_V2.md"

REPORT.write_text(f"""# V6 Price Chart V5 UI Split Diagnostic Repair

Status: generated by deterministic diagnostic and repair script.

## Diagnosis before repair

{chr(10).join('- ' + item for item in findings) if findings else '- No prior overlay or summary issue detected before repair.'}

## V5 reference checks

{chr(10).join('- ' + name + ': ' + ('pass' if ok else 'fail') for name, ok in checks)}

## Root cause

V5 does not use a single annotation method for every mode.

1. V5 in-page chart uses boxed event annotations through `eventBox`, `drawPointer`, `drawEvents` and `drawDailyEvents`.
2. V5 fullscreen uses a separate fullscreen renderer with `eventText` and its own `drawEvents` behaviour.
3. V6 previously sent in-page and fullscreen through one shared annotation function, so earlier attempts mixed the 2 V5 behaviours.

## Repair applied

1. V6 data loading, V6 stats, V6 X/Y scaling and V6 period controls remain in place.
2. V6 in-page canvas now uses V5-style `eventBox` plus `drawPointer` behaviour.
3. V6 fullscreen canvas now uses V5 fullscreen-style `eventText` behaviour.
4. HIGH and LOW annotations only.
5. No AVERAGE annotation box.
6. No bottom summary box call.
7. No overlay workaround loaded from `index.md`.
8. No broken replacement renderer reference.
9. Working V6 renderer cache-busted to `20260603v5split1`.
10. V5 files were checked after repair and were not modified.

## Comparison report

{compare_status}

## Files changed by workflow

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/index.md`
3. `uk_energy_tracking_v6/V6_PRICE_V5_UI_SPLIT_DIAGNOSTIC_REPAIR.md`
4. `uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md` if regenerated

## Test instruction

Open `/uk_energy_tracking_v6/` and hard refresh.

Expected result:

1. In-page chart keeps V6 data but uses V5-style boxed HIGH and LOW annotations.
2. Fullscreen chart keeps V6 data but uses V5 fullscreen-style HIGH and LOW text annotations.
3. No bottom summary box.
4. No average annotation box.
5. No overlay duplicate annotations.
""", encoding="utf-8")

print("V6 split V5 UI diagnostic repair prepared and comparison report status:", compare_status)
