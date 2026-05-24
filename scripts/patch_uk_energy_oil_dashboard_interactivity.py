from pathlib import Path

PAGE = Path(__file__).parent.parent / "uk_energy_tracking" / "index.md"
text = PAGE.read_text(encoding="utf-8")

# 1. Add dashboard CSS for tooltip, stats and clearer units.
css_anchor = "#oil-trend-canvas { width:100%; height:260px; display:block; border:1px solid rgba(255,255,255,.05); background:#070a10; }"
css_patch = """#oil-trend-canvas { width:100%; height:300px; display:block; border:1px solid rgba(255,255,255,.05); background:#070a10; touch-action:none; }
.oil-chart-wrap { position:relative; }
.oil-tooltip { position:absolute; display:none; pointer-events:none; background:rgba(5,5,5,.94); border:1px solid var(--gg-cyan); color:var(--gg-text); padding:8px 10px; border-radius:4px; font-size:12px; line-height:1.45; box-shadow:0 0 18px rgba(0,255,255,.12); z-index:5; }
.oil-stats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:10px; }
.oil-stat { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:4px; padding:9px; }
.oil-stat-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
.oil-stat-value { color:var(--gg-cyan); font-size:16px; font-weight:800; margin-top:4px; }
.unit-panel { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:6px; padding:10px 12px; margin-top:10px; color:var(--gg-muted); font-size:12px; line-height:1.5; }
.unit-panel strong { color:var(--gg-text); }
@media (max-width: 850px) { .oil-stats-grid { grid-template-columns:1fr 1fr; } }"""
if css_anchor in text and ".oil-tooltip" not in text:
    text = text.replace(css_anchor, css_patch)

# 2. Replace oil range selector and canvas block.
old_block = """<strong style=\"color:#00ffff;letter-spacing:.12em;text-transform:uppercase;\">Oil Price Trend</strong>
        <select id=\"oil-range\"><option value=\"1\">1 year</option><option value=\"5\">5 years</option><option value=\"10\">10 years</option><option value=\"25\">25 years</option><option value=\"all\" selected>Since 1970s</option></select>
      </div>
      <canvas id=\"oil-trend-canvas\" width=\"900\" height=\"260\"></canvas>"""
new_block = """<strong style=\"color:#00ffff;letter-spacing:.12em;text-transform:uppercase;\">Oil Price Trend</strong>
        <select id=\"oil-range\">
          <option value=\"7d\">1 week</option>
          <option value=\"1m\">1 month</option>
          <option value=\"3m\">3 months</option>
          <option value=\"6m\">6 months</option>
          <option value=\"9m\">9 months</option>
          <option value=\"1y\">1 year</option>
          <option value=\"5y\">5 years</option>
          <option value=\"10y\">10 years</option>
          <option value=\"25y\">25 years</option>
          <option value=\"all\" selected>Since 1970s</option>
        </select>
      </div>
      <div class=\"unit-panel\"><strong>Unit:</strong> USD per barrel (USD/bbl). Touch or move across the graph to inspect date, Brent and WTI values.</div>
      <div class=\"oil-chart-wrap\"><canvas id=\"oil-trend-canvas\" width=\"900\" height=\"300\"></canvas><div id=\"oil-tooltip\" class=\"oil-tooltip\"></div></div>
      <div id=\"oil-stats\" class=\"oil-stats-grid\"></div>"""
if old_block in text:
    text = text.replace(old_block, new_block)

# 3. Replace the drawOilTrend function with an interactive version and hide raw health diagnostics.
start = text.find("  function drawOilTrend(geo){")
end = text.find("  function refresh(){", start)
if start != -1 and end != -1:
    replacement = r'''  var oilChartState = { rows: [], x: null, y: null, canvas: null };
  function rangeCutoff(range){
    if(range === "all") return null;
    var d = new Date();
    if(range === "7d") d.setDate(d.getDate()-7);
    else if(range === "1m") d.setMonth(d.getMonth()-1);
    else if(range === "3m") d.setMonth(d.getMonth()-3);
    else if(range === "6m") d.setMonth(d.getMonth()-6);
    else if(range === "9m") d.setMonth(d.getMonth()-9);
    else if(range === "1y") d.setFullYear(d.getFullYear()-1);
    else if(range === "5y") d.setFullYear(d.getFullYear()-5);
    else if(range === "10y") d.setFullYear(d.getFullYear()-10);
    else if(range === "25y") d.setFullYear(d.getFullYear()-25);
    return d;
  }
  function oilStats(rows){
    var vals=[]; rows.forEach(function(p){ if(p.brentUSDperBarrel) vals.push(p.brentUSDperBarrel); if(p.wtiUSDperBarrel) vals.push(p.wtiUSDperBarrel); });
    var el=document.getElementById("oil-stats"); if(!el) return;
    if(!vals.length){ el.innerHTML=""; return; }
    var peak=Math.max.apply(null,vals), trough=Math.min.apply(null,vals), avg=vals.reduce(function(a,b){return a+b;},0)/vals.length;
    var variance=vals.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/vals.length;
    var vol=avg?Math.sqrt(variance)/avg*100:0;
    el.innerHTML = [
      ["Peak", "$"+fmt(peak,2)], ["Trough", "$"+fmt(trough,2)], ["Average", "$"+fmt(avg,2)], ["Volatility", fmt(vol,1)+"%"]
    ].map(function(x){return '<div class="oil-stat"><div class="oil-stat-label">'+x[0]+'</div><div class="oil-stat-value">'+x[1]+'</div></div>';}).join("");
  }
  function drawOilTrend(geo){
    var canvas=document.getElementById("oil-trend-canvas"); if(!canvas||!geo||!Array.isArray(geo.features)) return;
    var ctx=canvas.getContext("2d"), range=document.getElementById("oil-range").value;
    var rows=geo.features.map(function(f){return f.properties||{};}).filter(function(p){return p.date&&(p.brentUSDperBarrel||p.wtiUSDperBarrel);});
    var cutoff=rangeCutoff(range); if(cutoff) rows=rows.filter(function(p){return new Date(p.date)>=cutoff;});
    var w=canvas.width,h=canvas.height,pad=42;
    ctx.clearRect(0,0,w,h); ctx.fillStyle="#070a10"; ctx.fillRect(0,0,w,h);
    if(rows.length<2) { ctx.fillStyle="#a6adbb"; ctx.font="14px Courier New"; ctx.fillText("Waiting for oil history data", pad, 42); oilStats([]); return; }
    var vals=[]; rows.forEach(function(p){ if(p.brentUSDperBarrel) vals.push(p.brentUSDperBarrel); if(p.wtiUSDperBarrel) vals.push(p.wtiUSDperBarrel); });
    var min=Math.min.apply(null,vals), max=Math.max.apply(null,vals); if(max===min){max=min+1;}
    function x(i){return pad+(i/(rows.length-1))*(w-pad*1.7);} function y(v){return h-pad-((v-min)/(max-min))*(h-pad*1.9);}
    ctx.strokeStyle="#252b36"; ctx.lineWidth=1; for(var g=0;g<5;g++){var yy=pad+g*(h-pad*1.9)/4;ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(w-pad/2,yy);ctx.stroke();}
    function line(field,colour){ctx.strokeStyle=colour;ctx.lineWidth=2;ctx.beginPath();var started=false;rows.forEach(function(p,i){var v=p[field];if(!v)return; if(!started){ctx.moveTo(x(i),y(v));started=true;}else{ctx.lineTo(x(i),y(v));}});ctx.stroke();}
    line("brentUSDperBarrel","#ff9900"); line("wtiUSDperBarrel","#00ffff");
    ctx.fillStyle="#a6adbb"; ctx.font="12px Courier New"; ctx.fillText("Brent",pad,18); ctx.fillStyle="#ff9900"; ctx.fillRect(pad+46,10,18,4); ctx.fillStyle="#a6adbb"; ctx.fillText("WTI",pad+78,18); ctx.fillStyle="#00ffff"; ctx.fillRect(pad+112,10,18,4);
    ctx.fillStyle="#a6adbb"; ctx.fillText("$"+Math.round(max)+"/bbl",pad,36); ctx.fillText("$"+Math.round(min)+"/bbl",pad,h-10);
    oilChartState={rows:rows,x:x,y:y,canvas:canvas}; oilStats(rows); bindOilTooltip();
  }
  function bindOilTooltip(){
    var canvas=document.getElementById("oil-trend-canvas"), tip=document.getElementById("oil-tooltip"); if(!canvas||!tip||canvas.__oilTipBound) return;
    canvas.__oilTipBound=true;
    function show(e){
      var rect=canvas.getBoundingClientRect();
      var clientX=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX);
      var px=(clientX-rect.left)*(canvas.width/rect.width);
      var rows=oilChartState.rows||[]; if(!rows.length) return;
      var idx=Math.max(0,Math.min(rows.length-1,Math.round((px-42)/(canvas.width-42*1.7)*(rows.length-1))));
      var p=rows[idx];
      tip.innerHTML='<strong>'+p.date+'</strong><br>Brent: '+(p.brentUSDperBarrel?'$'+fmt(p.brentUSDperBarrel,2):'—')+' USD/bbl<br>WTI: '+(p.wtiUSDperBarrel?'$'+fmt(p.wtiUSDperBarrel,2):'—')+' USD/bbl';
      tip.style.display='block'; tip.style.left=Math.min(rect.width-170,Math.max(8,clientX-rect.left+12))+'px'; tip.style.top='42px';
    }
    function hide(){ tip.style.display='none'; }
    canvas.addEventListener('mousemove',show); canvas.addEventListener('touchmove',show,{passive:true}); canvas.addEventListener('mouseleave',hide); canvas.addEventListener('touchend',hide);
  }
'''
    text = text[:start] + replacement + text[end:]

# 4. Hide public raw JSON health diagnostics.
old_status = 's.textContent="Energy health: "+JSON.stringify(e.health||{})+" · Price health: "+JSON.stringify(p.health||{})+" · Oil health: "+JSON.stringify(oil.health||{});s.className="scada-status";'
new_status = 's.textContent="Data diagnostics recorded in JSON feeds. Energy, price, carbon and commodity source health are being tracked.";s.className="scada-status";'
if old_status in text:
    text = text.replace(old_status, new_status)

PAGE.write_text(text, encoding="utf-8")
print("Patched UK energy tracker oil chart interactivity, ranges, units, stats and status text.")
