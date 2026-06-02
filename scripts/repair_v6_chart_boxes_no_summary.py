from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"
RENDER = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
INDEX = V6 / "index.md"
CSS = V6 / "styles/app.css"
REPORT = V6 / "V6_REPAIR_CHART_BOXES_NO_SUMMARY_REPORT.md"

required = [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
    "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js",
    "uk_energy_tracking_v6/index.md",
    "uk_energy_tracking_v6/styles/app.css",
]
for rel in required:
    p = ROOT / rel
    if not p.exists():
        raise FileNotFoundError(f"Required file missing: {rel}")
    p.read_text(encoding="utf-8")

text = RENDER.read_text(encoding="utf-8")

old_pointer = "  function drawTrackerPointer(g,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.lineWidth=1.4*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y-22*q);g.stroke();g.restore()}\n"
new_pointer = "  function drawTrackerPointer(g,point,q,x,y){return}\n"
if old_pointer not in text:
    raise RuntimeError("Expected pointer function not found")
text = text.replace(old_pointer, new_pointer, 1)

old_box = "  function drawTrackerBox(g,lines,q,x,y,align){var pad=7*q,lh=15*q,wid=0;g.save();g.font='900 '+(align==='center'?10:9.5)*q+'px Courier New';lines.forEach(function(t){wid=Math.max(wid,g.measureText(t).width)});var bh=lines.length*lh+pad*2,bw=wid+pad*2,xx=align==='right'?x-bw:(align==='center'?x-bw/2:x);if(xx<8*q)xx=8*q;if(xx+bw>g.canvas.width-8*q)xx=g.canvas.width-bw-8*q;var yy=y-bh+4*q;if(yy<8*q)yy=8*q;if(yy+bh>g.canvas.height-8*q)yy=g.canvas.height-bh-8*q;g.fillStyle='rgba(5,7,12,.82)';g.strokeStyle='rgba(0,255,255,.42)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,yy,bw,bh,6*q);g.fill();g.stroke();g.shadowBlur=0;g.textAlign='left';lines.forEach(function(t,i){g.fillStyle=i===0?'#ff3333':(i===1?'#f5f7fb':'#9aa3b6');g.fillText(t,xx+pad,yy+pad+lh*(i+0.75))});g.restore()}\n"
new_box = "  function drawTrackerBox(g,lines,q,x,y,align){var pad=7*q,lh=14*q,wid=0;g.save();g.font='900 '+9*q+'px Courier New';lines.forEach(function(t){wid=Math.max(wid,g.measureText(t).width)});var bh=lines.length*lh+pad*2,bw=wid+pad*2;var xx=x-bw/2,yy=y-bh/2;if(xx<8*q)xx=8*q;if(xx+bw>g.canvas.width-8*q)xx=g.canvas.width-bw-8*q;if(yy<8*q)yy=8*q;if(yy+bh>g.canvas.height-8*q)yy=g.canvas.height-bh-8*q;g.fillStyle='rgba(5,7,12,.86)';g.strokeStyle='rgba(0,255,255,.55)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.28)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,yy,bw,bh,6*q);g.fill();g.stroke();g.shadowBlur=0;g.textAlign='left';lines.forEach(function(t,i){g.fillStyle=i===0?'#ff3333':(i===1?'#f5f7fb':'#9aa3b6');g.fillText(t,xx+pad,yy+pad+lh*(i+0.75))});g.restore()}\n"
if old_box not in text:
    raise RuntimeError("Expected tracker box function not found")
text = text.replace(old_box, new_box, 1)

old_trackers = "  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){if(isFull&&isLandscape)return;var avgX=(pad.left+w-pad.right)/2,avgY=Y(s.avg),top=pad.top,bottom=h-pad.bottom;var highX=X(s.hi),highY=Y(s.hiValue),lowX=X(s.lo),lowY=Y(s.loValue);var items=[{label:'HIGH',val:s.hiValue,date:s.hiDate,clock:s.hiClock,x:highX,y:highY,tx:Math.min(w-pad.right-150*q,highX+22*q),ty:Math.max(top+70*q,Math.min(bottom-18*q,highY+70*q)),align:'left'},{label:'AVERAGE',val:s.avg,date:'Visible period',clock:'',x:avgX,y:avgY,tx:avgX,ty:Math.max(top+118*q,Math.min(bottom-74*q,avgY-42*q)),align:'center'},{label:'LOW',val:s.loValue,date:s.loDate,clock:s.loClock,x:lowX,y:lowY,tx:Math.max(pad.left+150*q,lowX-22*q),ty:Math.max(top+74*q,Math.min(bottom-28*q,lowY-46*q)),align:'right'}];items.forEach(function(it){drawTrackerPointer(g,{x:it.x,y:it.y},q,it.tx,it.ty);drawTrackerBox(g,trackerLines(it.label,it.val,it.date,it.clock),q,it.tx,it.ty,it.align)})}\n"
new_trackers = "  function drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape){var avgX=(pad.left+w-pad.right)/2,avgY=Y(s.avg),top=pad.top,bottom=h-pad.bottom;var highX=X(s.hi),highY=Y(s.hiValue),lowX=X(s.lo),lowY=Y(s.loValue);var items=[{label:'HIGH',val:s.hiValue,date:s.hiDate,clock:s.hiClock,x:highX,y:Math.max(top+42*q,Math.min(bottom-42*q,highY))},{label:'AVERAGE',val:s.avg,date:'Visible period',clock:'',x:avgX,y:Math.max(top+62*q,Math.min(bottom-62*q,avgY))},{label:'LOW',val:s.loValue,date:s.loDate,clock:s.loClock,x:lowX,y:Math.max(top+42*q,Math.min(bottom-42*q,lowY))}];items.forEach(function(it){drawTrackerBox(g,trackerLines(it.label,it.val,it.date,it.clock),q,it.x,it.y,'center')})}\n"
if old_trackers not in text:
    raise RuntimeError("Expected visible tracker function not found")
text = text.replace(old_trackers, new_trackers, 1)

old_render = "var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:74*q,bottom:44*q}:{left:58*q,right:18*q,top:104*q,bottom:285*q}):{left:74*q,right:24*q,top:96*q,bottom:284*q};"
new_render = "var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:78*q,bottom:48*q}:{left:58*q,right:18*q,top:132*q,bottom:86*q}):{left:74*q,right:24*q,top:96*q,bottom:96*q};"
if old_render not in text:
    raise RuntimeError("Expected pad definition not found")
text = text.replace(old_render, new_render, 1)

old_call = "if(isFull){drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}else{drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)}"
new_call = "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)"
if old_call not in text:
    raise RuntimeError("Expected summary plus tracker call not found")
text = text.replace(old_call, new_call, 1)

RENDER.write_text(text, encoding="utf-8")
updated = RENDER.read_text(encoding="utf-8")
for forbidden in ["drawSummary(g,s,q,w,h,pad,isFull,isLandscape);drawHighAverageLowTrackers", "lineTo(x,y-22*q)"]:
    if forbidden in updated:
        raise RuntimeError(f"Forbidden old behaviour remains: {forbidden}")
for token in ["function drawTrackerPointer(g,point,q,x,y){return}", "bottom:96*q", "top:132*q", "drawHighAverageLowTrackers(g,s,q,w,h,pad,X,Y,isFull,isLandscape)"]:
    if token not in updated:
        raise RuntimeError(f"Post repair assertion failed: {token}")

idx = INDEX.read_text(encoding="utf-8")
old_src = "/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602boxes2"
new_src = "/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602boxes3"
if old_src in idx:
    idx = idx.replace(old_src, new_src, 1)
elif new_src not in idx:
    raise RuntimeError("Expected render script cache version not found")
INDEX.write_text(idx, encoding="utf-8")

css = CSS.read_text(encoding="utf-8")
css_old = """.price-history-fullscreen-toolbar{position:sticky;z-index:6;top:0;height:42px;display:flex;align-items:center;gap:8px;padding:0 max(8px,env(safe-area-inset-right)) 0 max(8px,env(safe-area-inset-left));background:rgba(0,0,0,.58);backdrop-filter:blur(4px);color:#f5f7fb;font-family:\"Courier New\",monospace;}
.price-history-fullscreen-toolbar strong{color:#00ffff;text-transform:uppercase;letter-spacing:.08em;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.price-history-fullscreen-toolbar span{display:none!important;}
.price-history-fullscreen-toolbar button{margin-left:auto;border:1px solid rgba(0,255,255,.22);border-radius:50%;width:34px;height:34px;color:#00ffff;background:rgba(0,255,255,.05);font:24px/1 \"Courier New\",monospace;cursor:pointer;flex:0 0 auto;}
"""
css_new = """.price-history-fullscreen-toolbar{position:fixed;z-index:6;top:0;left:0;right:0;min-height:94px;display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;gap:8px 12px;align-items:center;padding:calc(10px + env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 10px max(12px,env(safe-area-inset-left));background:linear-gradient(180deg,rgba(0,0,0,.88),rgba(0,0,0,.48));backdrop-filter:blur(5px);color:#f5f7fb;font-family:\"Courier New\",monospace;box-sizing:border-box;}
.price-history-fullscreen-toolbar strong{grid-column:1/2;color:#00ffff;text-transform:uppercase;letter-spacing:.08em;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.price-history-fullscreen-period-label{grid-column:1/3;display:flex;align-items:center;gap:10px;color:#9aa3b6;font-size:11px;text-transform:uppercase;letter-spacing:.10em;}
.price-history-fullscreen-period-label select{background:#05070c!important;color:#00ffff!important;border:1px solid rgba(0,255,255,.42)!important;border-radius:6px!important;padding:8px 12px!important;font-family:\"Courier New\",monospace!important;box-shadow:0 0 12px rgba(0,255,255,.10)!important;min-width:180px;}
.price-history-fullscreen-toolbar span{display:none!important;}
.price-history-fullscreen-toolbar button{grid-column:2/3;grid-row:1/2;margin-left:auto;border:1px solid rgba(0,255,255,.35);border-radius:50%;width:34px;height:34px;color:#00ffff;background:rgba(0,255,255,.06);font:24px/1 \"Courier New\",monospace;cursor:pointer;flex:0 0 auto;}
"""
if css_old not in css:
    raise RuntimeError("Expected fullscreen toolbar CSS block not found")
css = css.replace(css_old, css_new, 1)
css = css.replace("#price-history-fullscreen-canvas{width:100vw;height:calc(100dvh - 42px);min-height:620px;display:block;background:#05070c;touch-action:pan-y;transform:translateZ(0);will-change:transform;}", "#price-history-fullscreen-canvas{width:100vw;height:100dvh;min-height:620px;display:block;background:#05070c;touch-action:pan-y;transform:translateZ(0);will-change:transform;}" , 1)
css = css.replace("#price-history-fullscreen-canvas{height:calc(100dvh - 36px);min-height:0;}", "#price-history-fullscreen-canvas{height:100dvh;min-height:0;}" , 1)
CSS.write_text(css, encoding="utf-8")
css_updated = CSS.read_text(encoding="utf-8")
for token in ["position:fixed;z-index:6;top:0;left:0;right:0;min-height:94px", "background:#05070c!important;color:#00ffff!important", "height:100dvh"]:
    if token not in css_updated:
        raise RuntimeError(f"CSS assertion failed: {token}")

REPORT.write_text("""# V6 Repair Report: Chart Boxes, No Summary

Status: prepared by deterministic repair script.

## Problem observed

The previous repair made HIGH, AVERAGE and LOW boxes visible, but it kept pointer lines and left the bottom summary box in place. In fullscreen mode the summary box consumed too much vertical space. The period dropdown also used default browser styling and sat too high in the toolbar.

## Behaviour changed

1. Removes tracker pointer lines.
2. Places HIGH, AVERAGE and LOW tracker boxes directly over their chart positions.
3. Removes the bottom summary box in both normal page mode and fullscreen mode.
4. Reduces chart bottom padding so the chart occupies more of the available space.
5. Lets the fullscreen canvas occupy the full viewport height.
6. Lowers and colour matches the fullscreen period dropdown to the site style.
7. Bumps the V6 render script query string so the live page loads the corrected renderer.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/styles/app.css`
3. `uk_energy_tracking_v6/index.md`
4. `uk_energy_tracking_v6/V6_REPAIR_CHART_BOXES_NO_SUMMARY_REPORT.md`

## Explicit non scope

No V5 file changed.
No data feed changed.
No forecast wiring changed.
No period calculation changed.

## Required maintainer test

Open `/uk_energy_tracking_v6/`. Confirm that normal in-page mode has no bottom summary box and no pointer lines, and that HIGH, AVERAGE and LOW boxes appear over the chart. Then enter fullscreen portrait and confirm the dropdown is site-coloured, the chart uses the full available viewport and the old bottom summary box is gone.
""", encoding="utf-8")

print("V6 chart boxes no summary repair prepared.")
