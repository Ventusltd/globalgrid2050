from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"

for rel in [
    "AI_START_HERE.md",
    "uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    "uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md",
    "uk_energy_tracking_v6/index.md",
    "uk_energy_tracking_v6/styles/app.css",
    "uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js",
]:
    p = ROOT / rel
    if not p.exists():
        raise FileNotFoundError(f"Required file missing: {rel}")
    p.read_text(encoding="utf-8")

protocol = (V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md").read_text(encoding="utf-8")
if "Full screen, period arrows, mobile portrait, mobile landscape and desktop" not in protocol:
    raise RuntimeError("V6 protocol fullscreen contract not recognised")

index_path = V6 / "index.md"
css_path = V6 / "styles/app.css"
render_path = V6 / "price_history_chart/render_price_chart/render_price_chart.js"
report_path = V6 / "V6_REPAIR_MOBILE_CHART_READABILITY_REPORT.md"

index = index_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
render = render_path.read_text(encoding="utf-8")

refresh_button = '        <button type="button" id="price-history-refresh">Refresh chart</button>\n'
if refresh_button in index:
    index = index.replace(refresh_button, "", 1)
elif 'id="price-history-refresh"' in index:
    raise RuntimeError("Refresh chart button exists in unexpected form")

css_block = """

/* V6 repair: mobile chart readability and cinematic fullscreen layout. */
#price-history-refresh{display:none!important;}
@media(max-width:850px) and (orientation:portrait){
  #electricity-price-history-panel #price-history-canvas{height:92dvh!important;min-height:720px!important;}
}
@media(orientation:landscape){
  #price-history-fullscreen-canvas{height:100dvh!important;width:100vw!important;}
  .price-history-fullscreen-toolbar{background:rgba(0,0,0,.18);}
}
"""
if "mobile chart readability and cinematic fullscreen layout" not in css:
    css = css.rstrip() + css_block


def replace_function(text, start_marker, end_marker, replacement):
    start = text.find(start_marker)
    if start == -1:
        raise RuntimeError(f"Start marker not found: {start_marker}")
    end = text.find(end_marker, start)
    if end == -1:
        raise RuntimeError(f"End marker not found after {start_marker}: {end_marker}")
    return text[:start] + replacement + text[end:]

new_summary = """  function compactDateText(t){return String(t||'').replace(/January/g,'Jan').replace(/February/g,'Feb').replace(/March/g,'Mar').replace(/April/g,'Apr').replace(/June/g,'Jun').replace(/July/g,'Jul').replace(/August/g,'Aug').replace(/September/g,'Sep').replace(/October/g,'Oct').replace(/November/g,'Nov').replace(/December/g,'Dec')}
  function drawSummary(g,s,q,w,h,pad,isFull,isLandscape){if(isFull&&isLandscape)return;var cssW=w/q,boxH=(isFull?166:118)*q,x=pad.left,bw=w-pad.left-pad.right,y=isFull?h-boxH-86*q:h-128*q;if(!isFull&&cssW<720)y=h-150*q;g.save();g.fillStyle='rgba(5,7,12,.92)';g.strokeStyle='rgba(0,255,255,.55)';g.lineWidth=1.2*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=10*q;g.beginPath();g.roundRect(x,y,bw,boxH,10*q);g.fill();g.stroke();g.shadowBlur=0;if(isFull){var c0=x+16*q,c1=x+bw*.34,c2=x+bw*.56,c3=x+bw*.74;g.textBaseline='middle';g.font='900 '+(cssW<430?9.3:11.5)*q+'px Courier New';g.fillStyle='#00ffff';g.textAlign='left';g.fillText('Metric',c0,y+24*q);g.textAlign='right';g.fillText('p/kWh',c1,y+24*q);g.fillText('£/MWh',c2,y+24*q);g.textAlign='left';g.fillText('Date / Time',c3,y+24*q);function row(label,val,date,clock,yy,colour){g.font='900 '+(cssW<430?10.2:12.4)*q+'px Courier New';g.fillStyle=colour;g.textAlign='left';g.fillText(label,c0,yy);g.fillStyle='#f5f7fb';g.textAlign='right';g.fillText(pence(val),c1,yy);g.fillText(fmt(val,2),c2,yy);g.fillStyle=colour;g.textAlign='left';g.fillText(compactDateText(date)+(clock?'  '+clock:''),c3,yy)}row('High',s.hiValue,s.hiDate,s.hiClock,y+64*q,'#ff4444');row('Average',s.avg,s.avgDate,'',y+104*q,'#ff4444');row('Low',s.loValue,s.loDate,s.loClock,y+144*q,'#ff4444')}else{g.fillStyle='#f5f7fb';g.textAlign='center';var cx=x+bw/2;var small=cssW<720;function line(label,val,date,clock){return label+'  '+pence(val)+'p/kWh   £'+fmt(val,2)+'/MWh   '+compactDateText(date)+(clock?' '+clock:'')}g.font='900 '+(small?8.2:10.5)*q+'px Courier New';g.fillText(line('High',s.hiValue,s.hiDate,s.hiClock),cx,y+24*q);g.fillText(line('Average',s.avg,s.avgDate,''),cx,y+58*q);g.fillText(line('Low',s.loValue,s.loDate,s.loClock),cx,y+92*q)}g.restore()}
"""

new_render_to = """  function renderTo(canvasId,result){var c=document.getElementById(canvasId);if(!c)return;var isFull=canvasId==='price-history-fullscreen-canvas';var q=window.devicePixelRatio||1,r=c.getBoundingClientRect();c.width=Math.max(320,Math.floor((r.width||1200)*q));c.height=Math.max(360,Math.floor((r.height||720)*q));var g=c.getContext('2d'),w=c.width,h=c.height,cssW=w/q,cssH=h/q,isLandscape=isFull&&cssW>cssH;var pad=isFull?(isLandscape?{left:62*q,right:30*q,top:58*q,bottom:52*q}:{left:58*q,right:18*q,top:104*q,bottom:300*q}):{left:74*q,right:24*q,top:96*q,bottom:284*q};g.clearRect(0,0,w,h);g.fillStyle='#05070c';g.fillRect(0,0,w,h);var vals=values(result);if(vals.length<2)vals=[0,100];var mm=minMax(vals),t0=result.start.getTime(),t1=result.end.getTime();drawAxes(g,w,h,q,mm,pad,t0,t1);drawKey(g,q,pad,isFull,result);function X(row,isForecast){var t;if(result.mode==='daily'||isForecast)t=new Date(row.date+'T12:00:00Z').getTime();else t=new Date(time(row)).getTime();return pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right)}function Y(v){return pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom)}drawForecast(g,result,q,X,Y);if(result.mode==='daily'){drawDailyLines(g,result,q,X,Y)}else{var lineRows=decimateRows(result.rows,Math.max(900,Math.floor((w/q)*1.8)));g.save();g.lineWidth=(isLandscape?2.4:2.1)*q;g.lineCap='round';g.lineJoin='round';for(var j=1;j<lineRows.length;j++){var aa=lineRows[j-1],bb=lineRows[j],col2=seasonColor(time(bb));g.strokeStyle=col2;g.shadowColor=col2;g.shadowBlur=(isLandscape?7:5)*q;g.beginPath();g.moveTo(X(aa),Y(price(aa)));g.lineTo(X(bb),Y(price(bb)));g.stroke()}g.restore()}var s=stats(result);if(s){var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.8)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,4.5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,4.5*q,0,Math.PI*2);g.fill();g.restore();drawSummary(g,s,q,w,h,pad,isFull,isLandscape);set('ph-latest-price','£'+fmt(s.avg,2)+'/MWh');set('ph-latest-time',s.avgDate);set('ph-row-count',(result.rows||[]).length.toLocaleString('en-GB'));set('ph-source','Elexon BMRS')}else{g.save();g.fillStyle='#00ffff';g.font='900 '+13*q+'px Courier New';g.textAlign='center';g.fillText('No actual data yet · showing indicative seasonal baseline',w/2,pad.top+48*q);g.restore();set('ph-latest-price','Forecast baseline');set('ph-row-count','0');set('ph-source','Seasonal baseline')}if(!isFull&&result.forecastRows&&result.forecastRows.length)drawHealthBar(g,result,q,w,h,pad);set('price-history-range-status',new Date(result.start).toLocaleDateString('en-GB')+' to '+new Date(result.end).toLocaleDateString('en-GB')+' | '+(result.rows||[]).length.toLocaleString('en-GB')+' actual points')}
"""

render = replace_function(render, "  function drawSummary", "  function decimateRows", new_summary)
render = replace_function(render, "  function renderTo", "  function render(result)", new_render_to)

index_path.write_text(index, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
render_path.write_text(render, encoding="utf-8")

for path, tokens in {
    index_path: ["price-history-fullscreen-btn", "Download CSV"],
    css_path: ["mobile chart readability and cinematic fullscreen layout", "height:92dvh", "#price-history-refresh{display:none"],
    render_path: ["compactDateText", "isLandscape", "drawSummary(g,s,q,w,h,pad,isFull,isLandscape)", "Metric", "Date / Time", "bottom:300*q", "bottom:52*q"],
}.items():
    txt = path.read_text(encoding="utf-8")
    for token in tokens:
        if token not in txt:
            raise RuntimeError(f"Post repair assertion failed: {path} lacks {token}")

if 'id="price-history-refresh"' in index_path.read_text(encoding="utf-8"):
    raise RuntimeError("Refresh chart button still present in index")

report_path.write_text("""# V6 Repair Report: Mobile Chart Readability

Status: prepared by deterministic repair script.

## Scope

This repair improves the mobile electricity price chart layout after the V6 fullscreen restoration.

## Behaviour changed

1. Removes the redundant `Refresh chart` button from the normal page controls.
2. Makes the normal mobile portrait chart use almost the full mobile viewport height.
3. Makes fullscreen portrait mode use a larger compact table style summary box.
4. Uses bolder red metric rows for High, Average and Low to improve readability for weak eyesight.
5. Removes the summary box in fullscreen landscape mode so the graph has maximum cinematic space.
6. Increases fullscreen landscape graph real estate by reducing chart padding.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/index.md`
2. `uk_energy_tracking_v6/styles/app.css`
3. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
4. `uk_energy_tracking_v6/V6_REPAIR_MOBILE_CHART_READABILITY_REPORT.md`

## Explicit non scope

No data feeds changed.
No V5 file changed.
No forecast wiring changed.

## Required maintainer test

1. Open `/uk_energy_tracking_v6/` on mobile portrait.
2. Confirm the normal chart fills most of the portrait screen.
3. Open fullscreen portrait and confirm the bottom summary table is readable.
4. Rotate to landscape and confirm the graph is cinematic with no summary box.
5. Confirm arrows and swipe still change period.
""", encoding="utf-8")

print("V6 mobile chart readability repair completed locally by script.")
