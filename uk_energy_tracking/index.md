---
layout: page
title: UK Live Grid Tracker
permalink: /uk_energy_tracking/
---

<style>
:root {
  --gg-bg: #050505;
  --gg-panel: #0b0f17;
  --gg-line: #252b36;
  --gg-text: #f5f7fb;
  --gg-muted: #9aa3b6;
  --gg-cyan: #00ffff;
  --gg-magenta: #ff00e6;
  --gg-green: #00ff88;
  --gg-yellow: #ffcc00;
  --gg-orange: #ff9900;
  --gg-red: #ff4444;
}
body { background: var(--gg-bg) !important; color: var(--gg-text) !important; }
a { color: #7fdfff; }
.page-content, .wrapper, main { background: var(--gg-bg) !important; color: var(--gg-text) !important; }
.scada-grid { font-family: "Courier New", monospace; max-width: 1180px; margin: 0 auto; }
.scada-hero { border-bottom: 1px solid var(--gg-line); padding: 18px 0 16px; margin-bottom: 22px; }
.scada-subtitle { letter-spacing: .28em; color: var(--gg-muted); font-size: 14px; text-transform: uppercase; }
.scada-live-row { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-top:16px; }
.scada-live-pill { border: 1px solid #1b6b4c; color: var(--gg-green); background: rgba(0,255,136,.06); padding: 10px 14px; border-radius: 4px; text-transform: uppercase; letter-spacing: .18em; font-size: 12px; }
.scada-live-dot { display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--gg-green); box-shadow:0 0 14px var(--gg-green); margin-right:8px; }
.scada-update-panel { flex: 1 1 260px; border:1px solid var(--gg-cyan); background:rgba(0,255,255,.05); border-radius:4px; padding:10px 14px; box-shadow:0 0 18px rgba(0,255,255,.08); }
.scada-update-label { color: var(--gg-muted); font-size:11px; text-transform:uppercase; letter-spacing:.18em; }
.scada-update-time { color: var(--gg-cyan); font-size: clamp(20px, 5vw, 34px); font-weight: 800; line-height: 1.1; margin-top: 4px; }
.scada-update-meta { color: var(--gg-muted); font-size: 11px; margin-top: 2px; }
.scada-intro { color: var(--gg-muted); font-size: 14px; line-height:1.55; margin-bottom:22px; max-width:900px; }
.scada-gauges { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:18px; margin: 18px 0 22px; }
.scada-gauge-card { background: var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:18px 16px; min-height:220px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.02); }
.scada-gauge-title { color: var(--gg-muted); text-align:center; text-transform:uppercase; letter-spacing:.18em; font-size:12px; font-weight:700; min-height:34px; }
.scada-gauge { width:100%; max-width:260px; margin: 8px auto 0; display:block; }
.scada-gauge-bg { fill:none; stroke:#1d2330; stroke-width:18; stroke-linecap:round; }
.scada-gauge-fill { fill:none; stroke-width:18; stroke-linecap:round; filter: drop-shadow(0 0 8px currentColor); transition: stroke-dasharray .6s ease; }
.scada-gauge-value { fill: var(--gg-text); font-size:24px; font-weight:800; text-anchor:middle; dominant-baseline:middle; }
.scada-gauge-unit { fill: var(--gg-muted); font-size:8px; text-anchor:middle; text-transform:uppercase; }
.scada-mix-grid, .commodity-grid, .pump-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:14px; margin-top:18px; }
.scada-mini { background:var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:12px 12px 10px; }
.scada-mini-top { display:flex; justify-content:space-between; gap:10px; align-items:baseline; }
.scada-mini-name { color:var(--gg-text); text-transform:uppercase; letter-spacing:.12em; font-size:12px; }
.scada-mini-value { color:var(--gg-cyan); font-size:13px; white-space:nowrap; }
.scada-mini-track { height:8px; border-radius:5px; background:rgba(255,255,255,.08); overflow:hidden; margin-top:10px; }
.scada-mini-fill { height:100%; border-radius:5px; transition:width .6s ease; }
.commodity-card { background:var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:14px; }
.commodity-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.16em; font-size:12px; }
.commodity-value { color:var(--gg-text); font-size:clamp(24px,5vw,38px); font-weight:800; margin-top:8px; }
.commodity-unit { color:var(--gg-muted); font-size:11px; margin-top:4px; }
.commodity-card.oil .commodity-value { color:var(--gg-orange); }
.commodity-card.metal .commodity-value { color:var(--gg-cyan); }
.pump-grid { grid-template-columns: repeat(2, minmax(0,1fr)); opacity:.86; }
.pump-card { background:rgba(255,255,255,.03); border:1px solid var(--gg-line); border-radius:6px; padding:12px; }
.pump-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.14em; font-size:11px; }
.pump-value { color:var(--gg-yellow); font-size:24px; font-weight:800; margin-top:6px; }
.trend-panel { background:var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:14px; margin-top:18px; }
.trend-controls { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
.trend-controls select { background:#050505; color:var(--gg-cyan); border:1px solid var(--gg-line); padding:8px; font-family:"Courier New", monospace; }
#oil-trend-canvas { width:100%; height:260px; display:block; border:1px solid rgba(255,255,255,.05); background:#070a10; }
.scada-status { font-size:12px; color:var(--gg-muted); margin-top:18px; border:1px solid var(--gg-line); background:rgba(255,255,255,.03); padding:10px 12px; border-radius:4px; }
.scada-status.stale { color:var(--gg-orange); border-color:var(--gg-orange); }
.scada-credit { font-size:12px; color:var(--gg-muted); margin-top:22px; line-height:1.5; }
.scada-credit h2 { color:var(--gg-cyan); font-size:20px; letter-spacing:.06em; text-transform:uppercase; }
.section-title { color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-size:22px;margin-top:26px; }
@media (max-width: 850px) { .scada-gauges, .scada-mix-grid, .commodity-grid, .pump-grid { grid-template-columns:1fr; } .scada-gauge-card { min-height:190px; } }
</style>

<div class="scada-grid" id="scada-grid">
  <header class="scada-hero">
    <div class="scada-subtitle">UK LIVE GRID TRACKER</div>
    <div class="scada-live-row">
      <div class="scada-live-pill"><span class="scada-live-dot"></span>LIVE GRID SOURCE</div>
      <div class="scada-update-panel">
        <div class="scada-update-label">Latest data update</div>
        <div class="scada-update-time" id="m-updated-time">Awaiting feed</div>
        <div class="scada-update-meta" id="m-updated-meta">Energy, price and carbon timestamps will appear here.</div>
      </div>
    </div>
  </header>

  <p class="scada-intro">Near-real-time GB electricity demand, market price, carbon intensity and generation mix. Generation mix refreshes every 5 minutes; price and carbon update every half hour at their native cadence. Commodity prices update daily through GridBot.</p>

  <section class="scada-gauges">
    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Demand</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="demand"></svg></div>
    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Price</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="price"></svg></div>
    <div class="scada-gauge-card"><div class="scada-gauge-title">Carbon Intensity</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="carbon"></svg></div>
  </section>

  <section>
    <h2 class="section-title">Generation Mix</h2>
    <div id="scada-mix" class="scada-mix-grid"></div>
  </section>

  <section>
    <h2 class="section-title">Commodity Price Signals</h2>
    <div class="commodity-grid">
      <div class="commodity-card oil"><div class="commodity-label">Brent crude</div><div class="commodity-value" id="brent-price">—</div><div class="commodity-unit">US dollars per barrel (USD/bbl)</div></div>
      <div class="commodity-card oil"><div class="commodity-label">WTI crude</div><div class="commodity-value" id="wti-price">—</div><div class="commodity-unit">US dollars per barrel (USD/bbl)</div></div>
      <div class="commodity-card metal"><div class="commodity-label">Copper</div><div class="commodity-value" id="copper-price">—</div><div class="commodity-unit">US dollars per tonne (USD/t)</div></div>
      <div class="commodity-card metal"><div class="commodity-label">Aluminium</div><div class="commodity-value" id="aluminium-price">—</div><div class="commodity-unit">US dollars per tonne (USD/t)</div></div>
    </div>
    <div class="trend-panel">
      <div class="trend-controls">
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Oil Price Trend</strong>
        <select id="oil-range"><option value="1">1 year</option><option value="5">5 years</option><option value="10">10 years</option><option value="25">25 years</option><option value="all" selected>Since 1970s</option></select>
      </div>
      <canvas id="oil-trend-canvas" width="900" height="260"></canvas>
    </div>
  </section>

  <section>
    <h2 class="section-title" style="font-size:18px;color:#a6adbb;">UK Pump Prices</h2>
    <div class="pump-grid">
      <div class="pump-card"><div class="pump-label">Petrol</div><div class="pump-value" id="petrol-price">—</div><div class="commodity-unit">Pence per litre</div></div>
      <div class="pump-card"><div class="pump-label">Diesel</div><div class="pump-value" id="diesel-price">—</div><div class="commodity-unit">Pence per litre</div></div>
    </div>
  </section>

  <div class="scada-status" id="scada-status">Loading live feed…</div>

  <section class="scada-credit">
    <h2>Data sources & attribution</h2>
    <p>This tracker uses free public sources. We gratefully acknowledge them:</p>
    <p><strong>Generation mix & demand</strong> — Elexon BMRS Insights, used under the BMRS Data Licence Terms.</p>
    <p><strong>Carbon intensity</strong> — National Energy System Operator <a href="https://carbonintensity.org.uk/">Carbon Intensity API</a>, developed with the Environmental Defense Fund, University of Oxford and WWF. Licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</p>
    <p><strong>Solar generation</strong> — <a href="https://www.solar.sheffield.ac.uk/api/">Sheffield Solar PV_Live</a>, University of Sheffield.</p>
    <p><strong>Commodity prices</strong> — Yahoo Finance live chart endpoints and FRED historic oil series. UK pump prices are a best effort public page read and should be treated as indicative only.</p>
    <p>Indicative near-real-time values for screening and situational awareness only. No representation is made that the data is accurate or complete.</p>
  </section>
</div>

<script>
(function(){
  var ENERGY="./live_grid_energy.json", PRICE="./live_grid_price.json", OIL="./live_oil_prices.json", OIL_HISTORY="./oil_price_history.geojson", POLL=5*60*1000;
  var GAUGES={
    demand:{min:0,max:45,unit:"Gigawatts (GW)",colour:"#00ffff"},
    price:{min:-50,max:250,unit:"Pounds per Megawatt hour (£/MWh)",colour:"#ff00e6"},
    carbon:{min:0,max:400,unit:"Grams per Kilowatt hour (g/kWh)",colour:"#00ff88"}
  };
  function fmt(n,dp){return (n===null||n===undefined||isNaN(n))?"—":Number(n).toLocaleString("en-GB",{minimumFractionDigits:dp==null?2:dp,maximumFractionDigits:dp==null?2:dp});}
  function pct(n,min,max){ if(n===null||n===undefined||isNaN(n)) return 0; return Math.max(0,Math.min(1,(Number(n)-min)/(max-min))); }
  function arcPath(cx,cy,r,start,end){
    var s=(start-90)*Math.PI/180, e=(end-90)*Math.PI/180;
    var x1=cx+r*Math.cos(s), y1=cy+r*Math.sin(s), x2=cx+r*Math.cos(e), y2=cy+r*Math.sin(e);
    var large=end-start<=180?0:1;
    return "M "+x1+" "+y1+" A "+r+" "+r+" 0 "+large+" 1 "+x2+" "+y2;
  }
  function renderGauge(name,value){
    var cfg=GAUGES[name], svg=document.querySelector('[data-gauge="'+name+'"]'); if(!svg) return;
    var p=pct(value,cfg.min,cfg.max), end=-90+(180*p);
    var display=value===null||value===undefined||isNaN(value)?"—":(name==="carbon"?Math.round(value):fmt(value, name==="price"?0:2));
    svg.innerHTML='<path class="scada-gauge-bg" d="'+arcPath(30,115,80,-90,90)+'"></path>'+
      '<path class="scada-gauge-fill" style="color:'+cfg.colour+';stroke:'+cfg.colour+'" d="'+arcPath(30,115,80,-90,end)+'"></path>'+
      '<text class="scada-gauge-value" x="110" y="94">'+display+'</text>'+
      '<text class="scada-gauge-unit" x="110" y="120">'+cfg.unit+'</text>';
  }
  function renderMix(mix){
    var w=document.getElementById("scada-mix"); if(!Array.isArray(mix)){return;}
    w.innerHTML=mix.map(function(r){
      var width=Math.max(0,Math.min(100,Math.abs(r.pct)));
      return '<div class="scada-mini"><div class="scada-mini-top"><div class="scada-mini-name">'+r.label+'</div><div class="scada-mini-value">'+fmt(r.gw)+' Gigawatts (GW) · '+fmt(r.pct)+'%</div></div>'+
        '<div class="scada-mini-track"><div class="scada-mini-fill" style="width:'+width+'%;background:'+r.color+';box-shadow:0 0 10px '+r.color+'"></div></div></div>';
    }).join("");
  }
  function ageMin(iso){return iso?(Date.now()-new Date(iso).getTime())/60000:Infinity;}
  function timeLabel(iso){return iso?new Date(iso).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"Awaiting feed";}
  function dateLabel(iso){return iso?new Date(iso).toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}):"";}
  function latestIso(a,b,c){ var arr=[a,b,c].filter(Boolean).sort(function(x,y){return new Date(y)-new Date(x)}); return arr[0]||null; }
  function carbonValue(p){ return p.carbonGperKWh==null ? p.carbonForecast : p.carbonGperKWh; }
  function getJSON(u){return fetch(u+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return null;});}
  function setText(id,val){ var el=document.getElementById(id); if(el) el.textContent=val; }
  function renderCommodities(oil){
    oil=oil||{};
    setText("brent-price", oil.brentUSDperBarrel==null?"—":"$"+fmt(oil.brentUSDperBarrel,2));
    setText("wti-price", oil.wtiUSDperBarrel==null?"—":"$"+fmt(oil.wtiUSDperBarrel,2));
    var pump=oil.ukPumpPrices||{};
    setText("petrol-price", pump.petrolPencePerLitre==null?"—":fmt(pump.petrolPencePerLitre,2)+"p");
    setText("diesel-price", pump.dieselPencePerLitre==null?"—":fmt(pump.dieselPencePerLitre,2)+"p");
  }
  function parseMarketInputs(){
    fetch("/33kv_uk_dap_price_estimator/").then(function(r){return r.text();}).then(function(html){
      var c=html.match(/LME Copper \(USD\)[\s\S]*?USD\s*([0-9,]+)/i);
      var a=html.match(/LME Aluminium \(USD\)[\s\S]*?USD\s*([0-9,]+)/i);
      setText("copper-price", c?"$"+c[1]:"—");
      setText("aluminium-price", a?"$"+a[1]:"—");
    }).catch(function(){ setText("copper-price","—"); setText("aluminium-price","—"); });
  }
  function drawOilTrend(geo){
    var canvas=document.getElementById("oil-trend-canvas"); if(!canvas||!geo||!Array.isArray(geo.features)) return;
    var ctx=canvas.getContext("2d"), range=document.getElementById("oil-range").value;
    var rows=geo.features.map(function(f){return f.properties||{};}).filter(function(p){return p.date&&(p.brentUSDperBarrel||p.wtiUSDperBarrel);});
    if(range!=="all") { var cutoff=new Date(); cutoff.setFullYear(cutoff.getFullYear()-Number(range)); rows=rows.filter(function(p){return new Date(p.date)>=cutoff;}); }
    var w=canvas.width,h=canvas.height,pad=34;
    ctx.clearRect(0,0,w,h); ctx.fillStyle="#070a10"; ctx.fillRect(0,0,w,h);
    if(rows.length<2) return;
    var vals=[]; rows.forEach(function(p){ if(p.brentUSDperBarrel) vals.push(p.brentUSDperBarrel); if(p.wtiUSDperBarrel) vals.push(p.wtiUSDperBarrel); });
    var min=Math.min.apply(null,vals), max=Math.max.apply(null,vals); if(max===min){max=min+1;}
    function x(i){return pad+(i/(rows.length-1))*(w-pad*1.5);} function y(v){return h-pad-((v-min)/(max-min))*(h-pad*1.7);}
    ctx.strokeStyle="#252b36"; ctx.lineWidth=1; for(var g=0;g<5;g++){var yy=pad+g*(h-pad*1.7)/4;ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(w-pad/2,yy);ctx.stroke();}
    function line(field,colour){ctx.strokeStyle=colour;ctx.lineWidth=2;ctx.beginPath();var started=false;rows.forEach(function(p,i){var v=p[field];if(!v)return; if(!started){ctx.moveTo(x(i),y(v));started=true;}else{ctx.lineTo(x(i),y(v));}});ctx.stroke();}
    line("brentUSDperBarrel","#ff9900"); line("wtiUSDperBarrel","#00ffff");
    ctx.fillStyle="#a6adbb"; ctx.font="12px Courier New"; ctx.fillText("Brent",pad,18); ctx.fillStyle="#ff9900"; ctx.fillRect(pad+46,10,18,4); ctx.fillStyle="#a6adbb"; ctx.fillText("WTI",pad+78,18); ctx.fillStyle="#00ffff"; ctx.fillRect(pad+112,10,18,4);
    ctx.fillStyle="#a6adbb"; ctx.fillText("$"+Math.round(max)+"/bbl",pad,34); ctx.fillText("$"+Math.round(min)+"/bbl",pad,h-10);
  }
  function refresh(){
    Promise.all([getJSON(ENERGY),getJSON(PRICE),getJSON(OIL),getJSON(OIL_HISTORY)]).then(function(res){
      var e=res[0]||{}, p=res[1]||{}, oil=res[2]||{}, hist=res[3];
      renderGauge("demand", e.demandGW); renderGauge("price", p.priceGBPperMWh); renderGauge("carbon", carbonValue(p));
      if(e.mix) renderMix(e.mix); renderCommodities(oil); if(hist) drawOilTrend(hist);
      var latest=latestIso(e.updated,p.updated,oil.updated);
      document.getElementById("m-updated-time").textContent=timeLabel(latest);
      document.getElementById("m-updated-meta").textContent=(latest?dateLabel(latest)+" · energy "+timeLabel(e.updated)+" · price and carbon "+timeLabel(p.updated)+" · commodities "+timeLabel(oil.updated):"Energy, price, carbon and commodity timestamps will appear here.");
      var s=document.getElementById("scada-status"), mins=ageMin(e.updated);
      if(mins>20){s.textContent="Mix feed is "+Math.round(mins)+" minutes old. It may be stale.";s.className="scada-status stale";}
      else if(e.updated){s.textContent="Energy health: "+JSON.stringify(e.health||{})+" · Price health: "+JSON.stringify(p.health||{})+" · Oil health: "+JSON.stringify(oil.health||{});s.className="scada-status";}
      else{s.textContent="Live feed unavailable. Awaiting first data write.";s.className="scada-status stale";}
    });
  }
  document.getElementById("oil-range").addEventListener("change", function(){ getJSON(OIL_HISTORY).then(drawOilTrend); });
  parseMarketInputs(); refresh(); setInterval(refresh, POLL);
})();
</script>
