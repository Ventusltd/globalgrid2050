from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"

for rel in [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/index.md",
    "uk_energy_tracking_v6/styles/app.css",
    "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js",
]:
    p = ROOT / rel
    if not p.exists():
        raise FileNotFoundError(f"Required file missing: {rel}")
    p.read_text(encoding="utf-8")

css_path = V6 / "styles/app.css"
render_path = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
report_path = V6 / "V6_REPAIR_MOBILE_CHART_STABILISE_REPORT.md"

css = css_path.read_text(encoding="utf-8")
render = render_path.read_text(encoding="utf-8")

# Normal page regression repair: remove the late override that forced the normal page chart to 92dvh.
old_css = """@media(max-width:850px) and (orientation:portrait){
  #electricity-price-history-panel #price-history-canvas{height:92dvh!important;min-height:720px!important;}
}
"""
if old_css in css:
    css = css.replace(old_css, "")

css_add = """

/* V6 repair: stabilise mobile chart after readability experiment. */
@media(max-width:850px) and (orientation:portrait){
  #electricity-price-history-panel #price-history-canvas{height:74dvh!important;min-height:580px!important;}
}
@media(orientation:landscape){
  #price-history-fullscreen-canvas{width:100vw!important;height:100dvh!important;}
}
"""
if "stabilise mobile chart after readability experiment" not in css:
    css = css.rstrip() + css_add

start_marker = "  function compactDateText"
end_marker = "  function decimateRows"
start = render.find(start_marker)
end = render.find(end_marker, start)
if start == -1 or end == -1:
    raise RuntimeError("Could not locate summary function block")

new_summary_block = """  function compactDateText(t){return String(t||'').replace(/January/g,'Jan').replace(/February/g,'Feb').replace(/March/g,'Mar').replace(/April/g,'Apr').replace(/June/g,'Jun').replace(/July/g,'Jul').replace(/August/g,'Aug').replace(/September/g,'Sep').replace(/October/g,'Oct').replace(/November/g,'Nov').replace(/December/g,'Dec')}
  function drawSummary(g,s,q,w,h,pad,isFull,isLandscape){if(isFull&&isLandscape)return;var cssW=w/q,boxH=(isFull?148:118)*q,x=pad.left,bw=w-pad.left-pad.right,y=isFull?h-boxH-92*q:h-128*q;g.save();g.fillStyle='rgba(5,7,12,.92)';g.strokeStyle='rgba(0,255,255,.55)';g.lineWidth=1.2*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=10*q;g.beginPath();g.roundRect(x,y,bw,boxH,10*q);g.fill();g.stroke();g.shadowBlur=0;function splitDate(date,clock){var d=compactDateText(date);return clock?d+' '+clock:d}if(isFull){var c0=x+16*q,c1=x+bw*.32,c2=x+bw*.55,c3=x+bw*.78;g.textBaseline='middle';g.font='900 '+(cssW<430?8.4:10.5)*q+'px Courier New';g.fillStyle='#00ffff';g.textAlign='left';g.fillText('Metric',c0,y+22*q);g.textAlign='right';g.fillText('p/kWh',c1,y+22*q);g.fillText('£/MWh',c2,y+22*q);g.textAlign='left';g.fillText('Date',c3,y+22*q);function row(label,val,date,clock,yy){g.font='900 '+(cssW<430?8.8:11.2)*q+'px Courier New';g.fillStyle='#ff5555';g.textAlign='left';g.fillText(label,c0,yy);g.fillStyle='#f5f7fb';g.textAlign='right';g.fillText(pence(val),c1,yy);g.fillText(fmt(val,2),c2,yy);g.fillStyle='#ff5555';g.textAlign='left';var dateText=splitDate(date,clock);if(dateText.length>17)dateText=dateText.slice(0,17);g.fillText(dateText,c3,yy)}row('High',s.hiValue,s.hiDate,s.hiClock,y+58*q);row('Average',s.avg,s.avgDate,'',y+94*q);row('Low',s.loValue,s.loDate,s.loClock,y+130*q)}else{g.fillStyle='#f5f7fb';g.textAlign='center';var cx=x+bw/2;function line(label,val,date,clock){return label+'  '+pence(val)+'p/kWh   £'+fmt(val,2)+'/MWh   '+compactDateText(date)+(clock?' '+clock:'')}g.font='900 '+(cssW<720?8.2:10.5)*q+'px Courier New';g.fillText(line('High',s.hiValue,s.hiDate,s.hiClock),cx,y+24*q);g.fillText(line('Average',s.avg,s.avgDate,''),cx,y+58*q);g.fillText(line('Low',s.loValue,s.loDate,s.loClock),cx,y+92*q)}g.restore()}
"""
render = render[:start] + new_summary_block + render[end:]

old_pad = "var pad=isFull?(isLandscape?{left:62*q,right:30*q,top:58*q,bottom:52*q}:{left:58*q,right:18*q,top:104*q,bottom:300*q}):{left:74*q,right:24*q,top:96*q,bottom:284*q};"
new_pad = "var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:74*q,bottom:44*q}:{left:58*q,right:18*q,top:104*q,bottom:270*q}):{left:74*q,right:24*q,top:96*q,bottom:284*q};"
if old_pad not in render:
    raise RuntimeError("Expected current pad expression not found")
render = render.replace(old_pad, new_pad, 1)

css_path.write_text(css, encoding="utf-8")
render_path.write_text(render, encoding="utf-8")

checks = {
    css_path: ["stabilise mobile chart", "height:74dvh", "min-height:580px"],
    render_path: ["if(isFull&&isLandscape)return", "bottom:270*q", "bottom:44*q", "Date", "dateText.slice(0,17)"],
}
for path, tokens in checks.items():
    text = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            raise RuntimeError(f"Post repair assertion failed: {path} lacks {token}")

report_path.write_text("""# V6 Repair Report: Mobile Chart Stabilise

Status: prepared by deterministic repair script.

## Problem observed

The previous mobile readability workflow changed the normal mobile chart height too aggressively and the fullscreen portrait table overflowed horizontally. Landscape fullscreen improved but the title/key area remained cramped.

## Behaviour changed

1. Reverts the normal mobile page chart height to the earlier stable mobile size.
2. Keeps fullscreen landscape summary hidden.
3. Reduces landscape chart padding so graph space improves without clipping the title/key area.
4. Makes the portrait fullscreen summary table more compact.
5. Shortens long date strings inside the portrait summary table so they stay inside the box.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/styles/app.css`
2. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
3. `uk_energy_tracking_v6/V6_REPAIR_MOBILE_CHART_STABILISE_REPORT.md`

## Required maintainer test

1. Normal mobile page should look like the earlier stable view again.
2. Fullscreen portrait summary should stay inside the box.
3. Fullscreen landscape should show graph only, with no summary box.
""", encoding="utf-8")

print("V6 mobile chart stabilise repair completed locally by script.")
