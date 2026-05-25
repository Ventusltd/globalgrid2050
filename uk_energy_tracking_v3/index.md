---
layout: page
title: UK Live Grid Tracker V3
permalink: /uk_energy_tracking_v3/
---

<link rel="stylesheet" href="/uk_energy_tracking_v3/price-history-ui.css">
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
#oil-trend-canvas { width:100%; height:300px; display:block; border:1px solid rgba(255,255,255,.05); background:#070a10; touch-action:none; }
.oil-chart-wrap { position:relative; }
.oil-tooltip { position:absolute; display:none; pointer-events:none; background:rgba(5,5,5,.94); border:1px solid var(--gg-cyan); color:var(--gg-text); padding:8px 10px; border-radius:4px; font-size:12px; line-height:1.45; box-shadow:0 0 18px rgba(0,255,255,.12); z-index:5; }
.oil-stats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:10px; }
.oil-stat { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:4px; padding:9px; }
.oil-stat-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
.oil-stat-value { color:var(--gg-cyan); font-size:16px; font-weight:800; margin-top:4px; }
.unit-panel { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:6px; padding:10px 12px; margin-top:10px; color:var(--gg-muted); font-size:12px; line-height:1.5; }
.unit-panel strong { color:var(--gg-text); }
.fuel-logic-panel, .ev-panel { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:6px; padding:14px; margin-top:14px; color:var(--gg-muted); font-size:13px; line-height:1.55; }
.fuel-logic-panel strong, .ev-panel strong { color:var(--gg-text); }
.fuel-source-links { display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; }
.fuel-source-links a { border:1px solid var(--gg-line); border-radius:4px; padding:7px 9px; color:#7fdfff; }
.ev-card-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:10px; }
.ev-card { border:1px solid var(--gg-line); background:var(--gg-panel); border-radius:6px; padding:12px; }
.ev-card-value { color:var(--gg-green); font-size:22px; font-weight:800; margin-top:6px; }
.ev-map-frame { width:100%; height:360px; border:1px solid var(--gg-line); border-radius:6px; margin-top:12px; background:#050505; }
@media (max-width: 850px) { .ev-card-grid { grid-template-columns:1fr; } .ev-map-frame { height:300px; } }
@media (max-width: 850px) { .oil-stats-grid { grid-template-columns:1fr 1fr; } }
.scada-status { font-size:12px; color:var(--gg-muted); margin-top:18px; border:1px solid var(--gg-line); background:rgba(255,255,255,.03); padding:10px 12px; border-radius:4px; }
.scada-status.stale { color:var(--gg-orange); border-color:var(--gg-orange); }
.scada-credit { font-size:12px; color:var(--gg-muted); margin-top:22px; line-height:1.5; }
.scada-credit h2 { color:var(--gg-cyan); font-size:20px; letter-spacing:.06em; text-transform:uppercase; }
.section-title { color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-size:22px;margin-top:26px; }
@media (max-width: 850px) { .scada-gauges, .scada-mix-grid, .commodity-grid, .pump-grid { grid-template-columns:1fr; } .scada-gauge-card { min-height:190px; } }
</style>

<div class="scada-grid" id="scada-grid">
  <header class="scada-hero">
    <div class="scada-subtitle">UK LIVE GRID TRACKER V3</div>
    <div class="scada-live-row">
      <div class="scada-live-pill"><span class="scada-live-dot"></span>LIVE GRID SOURCE</div>
      <div class="scada-update-panel">
        <div class="scada-update-label">Latest data update</div>
        <div class="scada-update-time" id="m-updated-time">Awaiting feed</div>
        <div class="scada-update-meta" id="m-updated-meta">Energy, price and carbon timestamps will appear here.</div>
      </div>
    </div>
  </header>

  <p class="scada-intro" style="border:1px solid var(--gg-orange);padding:10px 12px;border-radius:4px;color:var(--gg-orange);">V3 experimental clone. Original tracker remains protected at /uk_energy_tracking/. This page uses isolated V3 feeds for development and transport energy testing.</p>

  <p class="scada-intro">Near-real-time GB electricity demand, market price, carbon intensity and generation mix. Generation mix refreshes every 5 minutes; price and carbon update every half hour at their native cadence. Commodity prices update daily through GridBot.</p>

  <section class="scada-gauges">
    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Demand</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="demand"></svg></div>
    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Price</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="price"></svg></div>
    <div class="scada-gauge-card"><div class="scada-gauge-title">Carbon Intensity</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="carbon"></svg></div>
  </section>





  <section>
    <h2 class="section-title">Generation Mix</h2>
    <div id="scada-mix" class="scada-mix-grid"></div>
  </section>  <section id="electricity-price-history-panel">
    <h2 class="section-title">Electricity Price History</h2>
    <div class="trend-panel">
      <div class="price-history-actions">
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Captured Market Index Price</strong>
        <select id="price-history-range">
          <option value="24h">24 hours</option>
          <option value="7d" selected>7 days</option>
          <option value="30d">30 days</option>
          <option value="3m">3 months</option>
          <option value="6m">6 months</option>
          <option value="12m">12 months</option>
          <option value="10y">10 years</option>
          <option value="all">All captured data</option>
        </select>
        <a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>
        <button type="button" id="price-history-fullscreen-btn" class="price-history-fullscreen-btn">Full screen chart</button>
      </div>
      <div class="unit-panel"><strong>Unit:</strong> pounds per Megawatt hour. Independently captured from Elexon BMRS Market Index values.</div>
      <canvas id="price-history-canvas" width="900" height="300"></canvas>
      <div class="price-history-grid">
        <div class="price-history-card"><div class="price-history-label">Latest price</div><div class="price-history-value" id="ph-latest-price">—</div></div>
        <div class="price-history-card"><div class="price-history-label">Settlement time</div><div class="price-history-value" id="ph-latest-time">—</div></div>
        <div class="price-history-card"><div class="price-history-label">Records retained</div><div class="price-history-value" id="ph-row-count">—</div></div>
        <div class="price-history-card"><div class="price-history-label">Source</div><div class="price-history-value" style="font-size:13px;" id="ph-source">Elexon BMRS</div></div>
      </div>
      <details class="price-history-table-toggle">
        <summary>Captured records table</summary>
        <div class="price-history-table-wrap">
          <table class="price-history-table">
            <thead><tr><th>Settlement time</th><th>Price GBP/MWh</th><th>Settlement period</th><th>Captured UTC</th><th>Carbon / health</th></tr></thead>
            <tbody id="price-history-table-body"><tr><td colspan="5">Awaiting captured price history.</td></tr></tbody>
          </table>
        </div>
      </details>
    </div>
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
        <select id="oil-range">
          <option value="7d">1 week</option>
          <option value="1m">1 month</option>
          <option value="3m">3 months</option>
          <option value="6m">6 months</option>
          <option value="9m">9 months</option>
          <option value="1y">1 year</option>
          <option value="5y">5 years</option>
          <option value="10y">10 years</option>
          <option value="25y" selected>25 years</option>
        </select>
      </div>
      <div class="unit-panel"><strong>Unit:</strong> USD per barrel (USD/bbl). Touch or move across the graph to inspect date, Brent and WTI values.</div>
      <div class="oil-chart-wrap"><canvas id="oil-trend-canvas" width="900" height="300"></canvas><div id="oil-tooltip" class="oil-tooltip"></div></div>
      <div id="oil-stats" class="oil-stats-grid"></div>
    </div>
  </section>

  <section>
    <h2 class="section-title" style="font-size:18px;color:#a6adbb;">Road Fuel & EV Charging</h2>
    <div class="pump-grid">
      <div class="pump-card"><div class="pump-label">Petrol</div><div class="pump-value" id="petrol-price">—</div><div class="commodity-unit">DESNZ weekly average, pence per litre</div></div>
      <div class="pump-card"><div class="pump-label">Diesel</div><div class="pump-value" id="diesel-price">—</div><div class="commodity-unit">DESNZ weekly average, pence per litre</div></div>
    </div>
    <div class="fuel-logic-panel">
      <strong>Road fuel price logic:</strong> Brent crude is quoted in US dollars per barrel. A rough product cost proxy converts USD per barrel into GBP per litre by applying an FX assumption and dividing by about 159 litres per barrel. UK pump prices then add refining spread, wholesale margin, logistics, retail margin, fuel duty and VAT.
      <div id="fuel-breakdown" style="margin-top:10px;">Awaiting DESNZ fuel price feed.</div>
      <div class="fuel-source-links">
        <a href="https://www.gov.uk/government/statistics/weekly-road-fuel-prices" target="_blank" rel="noopener noreferrer">DESNZ weekly road fuel prices</a>
        <a href="https://www.gov.uk/tax-on-shopping/fuel-duty" target="_blank" rel="noopener noreferrer">GOV.UK fuel duty</a>
        <a href="https://www.gov.uk/vat-rates" target="_blank" rel="noopener noreferrer">GOV.UK VAT rates</a>
      </div>
    </div>
    <div class="ev-panel">
      <strong>EV charging comparison placeholder:</strong> Public EV tariffs will be compared with petrol, diesel, wholesale electricity and operator tariff data. The Atlas V8 reference is embedded below while the exact EV charging layer path is verified.
      <div class="ev-card-grid">
        <div class="ev-card"><div class="pump-label">Rapid EV</div><div class="ev-card-value" id="ev-rapid-price">Tariff table pending</div><div class="commodity-unit">Pence per kilowatt hour</div></div>
        <div class="ev-card"><div class="pump-label">Ultra rapid EV</div><div class="ev-card-value" id="ev-ultra-price">Tariff table pending</div><div class="commodity-unit">Pence per kilowatt hour</div></div>
        <div class="ev-card"><div class="pump-label">Atlas EV layer</div><div class="ev-card-value">Reference</div><div class="commodity-unit">Copy after exact Atlas V8 path is verified</div></div>
      </div>
      <iframe class="ev-map-frame" src="/repd_grid_atlasv8/" loading="lazy" title="Atlas V8 reference map"></iframe>
    </div>
  </section>

  <div id="price-history-fullscreen-overlay" class="price-history-fullscreen-overlay">
    <div class="price-history-fullscreen-shell">
      <div class="price-history-fullscreen-toolbar">
        <strong>Electricity Price History</strong>
        <span id="price-history-fullscreen-meta">Captured Elexon market index prices</span>
        <button type="button" id="price-history-zoom-out">Zoom out</button>
        <button type="button" id="price-history-zoom-in">Zoom in</button>
        <button type="button" id="price-history-zoom-reset">Reset</button>
        <button type="button" id="price-history-fullscreen-close">Close</button>
      </div>
      <canvas id="price-history-fullscreen-canvas"></canvas>
      <div class="price-history-fullscreen-note">Wheel to zoom. Drag to pan. Esc closes the chart.</div>
    </div>
  </div>


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
<script src='/uk_energy_tracking_v3/price-history-ui.js'></script>
<script src='/uk_energy_tracking_v3/price-history-fullscreen.js'></script>

<script>
(function(){
  var ENERGY="/uk_energy_tracking_v3/live_grid_energy.json", PRICE="/uk_energy_tracking_v3/live_grid_price.json", OIL="/uk_energy_tracking_v3/live_oil_prices.json", OIL_HISTORY="/uk_energy_tracking_v3/oil_price_history.geojson", FUEL="/uk_energy_tracking_v3/live_uk_fuel_prices.json", EV_PRICES="/uk_energy_tracking_v3/ev_charging_prices.json", POLL=5*60*1000;
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
  function renderCommodities(oil,fuel){
    oil=oil||{}; fuel=fuel||{};
    setText("brent-price", oil.brentUSDperBarrel==null?"—":"$"+fmt(oil.brentUSDperBarrel,2));
    setText("wti-price", oil.wtiUSDperBarrel==null?"—":"$"+fmt(oil.wtiUSDperBarrel,2));
    var latest=fuel.latest||{};
    setText("petrol-price", latest.petrolPencePerLitre==null?"—":fmt(latest.petrolPencePerLitre,2)+"p");
    setText("diesel-price", latest.dieselPencePerLitre==null?"—":fmt(latest.dieselPencePerLitre,2)+"p");
    renderFuelBreakdown(oil, latest);
  }
  function renderFuelBreakdown(oil, latest){
    var el=document.getElementById("fuel-breakdown"); if(!el) return;
    var brent=oil&&oil.brentUSDperBarrel, petrol=latest&&latest.petrolPencePerLitre;
    if(brent==null || petrol==null){ el.textContent="Awaiting Brent crude and DESNZ fuel price feed."; return; }
    var gbpUsd=1.27, litresPerBarrel=158.987, duty=52.95, vatRate=0.20;
    var crudePpl=(Number(brent)/gbpUsd/litresPerBarrel)*100;
    var preVat=Number(petrol)/(1+vatRate);
    var vat=Number(petrol)-preVat;
    var spread=preVat-duty-crudePpl;
    el.innerHTML="Brent proxy: $"+fmt(brent,2)+"/bbl divided by FX "+gbpUsd+" and 159 litres equals about "+fmt(crudePpl,1)+"p/l crude input. Petrol pump: "+fmt(petrol,2)+"p/l. VAT at 20%: "+fmt(vat,1)+"p/l. Fuel duty assumption: "+fmt(duty,2)+"p/l. Implied refining, logistics, wholesale and retail spread: "+fmt(spread,1)+"p/l. Week: "+(latest.week||"not stated")+".";
  }
  function parseMarketInputs(){
    fetch("/33kv_uk_dap_price_estimator/").then(function(r){return r.text();}).then(function(html){
      var c=html.match(/LME Copper \(USD\)[\s\S]*?USD\s*([0-9,]+)/i);
      var a=html.match(/LME Aluminium \(USD\)[\s\S]*?USD\s*([0-9,]+)/i);
      setText("copper-price", c?"$"+c[1]:"—");
      setText("aluminium-price", a?"$"+a[1]:"—");
    }).catch(function(){ setText("copper-price","—"); setText("aluminium-price","—"); });
  }
  var oilChartState = { rows: [], x: null, y: null, canvas: null, activeIndex: null, min: 0, max: 0, pad: 54 };
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
    var high=Math.max.apply(null,vals), low=Math.min.apply(null,vals), avg=vals.reduce(function(a,b){return a+b;},0)/vals.length;
    var variance=vals.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/vals.length;
    var vol=avg?Math.sqrt(variance)/avg*100:0;
    el.innerHTML = [
      ["High", "$"+fmt(high,2)], ["Low", "$"+fmt(low,2)], ["Average", "$"+fmt(avg,2)], ["Volatility", fmt(vol,1)+"%"]
    ].map(function(x){return '<div class="oil-stat"><div class="oil-stat-label">'+x[0]+'</div><div class="oil-stat-value">'+x[1]+'</div></div>';}).join("");
  }
  function drawOilTrend(geo, activeIndex){
    var canvas=document.getElementById("oil-trend-canvas"); if(!canvas||!geo||!Array.isArray(geo.features)) return;
    var ctx=canvas.getContext("2d"), range=document.getElementById("oil-range").value;
    var rows=geo.features.map(function(f){return f.properties||{};}).filter(function(p){return p.date&&(p.brentUSDperBarrel||p.wtiUSDperBarrel);});
    var cutoff=rangeCutoff(range); if(cutoff) rows=rows.filter(function(p){return new Date(p.date)>=cutoff;});
    var w=canvas.width,h=canvas.height,pad=54,rightPad=28;
    ctx.clearRect(0,0,w,h); ctx.fillStyle="#070a10"; ctx.fillRect(0,0,w,h);
    if(rows.length<2) { ctx.fillStyle="#a6adbb"; ctx.font="14px Courier New"; ctx.fillText("Waiting for oil history data", pad, 42); oilStats([]); return; }
    var vals=[]; rows.forEach(function(p){ if(p.brentUSDperBarrel) vals.push(p.brentUSDperBarrel); if(p.wtiUSDperBarrel) vals.push(p.wtiUSDperBarrel); });
    var min=Math.min.apply(null,vals), max=Math.max.apply(null,vals); if(max===min){max=min+1;}
    function x(i){return pad+(i/(rows.length-1))*(w-pad-rightPad);} function y(v){return h-pad-((v-min)/(max-min))*(h-pad*1.85);}
    ctx.strokeStyle="#252b36"; ctx.lineWidth=1;
    ctx.fillStyle="#a6adbb"; ctx.font="16px Courier New";
    for(var g=0;g<5;g++){
      var value=max-(g*(max-min)/4), yy=y(value);
      ctx.beginPath();ctx.moveTo(pad,yy);ctx.lineTo(w-rightPad,yy);ctx.stroke();
      ctx.fillText("$"+fmt(value,0), 8, yy+4);
    }
    ctx.save();
    ctx.translate(14, h/2 + 70);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle="#a6adbb";
    ctx.font="11px Courier New";
    ctx.fillText("US dollars per barrel (USD/bbl)", 0, 0);
    ctx.restore();

    function line(field,colour){
      ctx.strokeStyle=colour;ctx.lineWidth=2;ctx.beginPath();var started=false;
      rows.forEach(function(p,i){var v=p[field];if(!v)return; if(!started){ctx.moveTo(x(i),y(v));started=true;}else{ctx.lineTo(x(i),y(v));}});
      ctx.stroke();
    }
    line("brentUSDperBarrel","#ff9900"); line("wtiUSDperBarrel","#00ffff");
    ctx.fillStyle="#a6adbb"; ctx.font="12px Courier New";
    ctx.fillText("Brent",pad,18); ctx.fillStyle="#ff9900"; ctx.fillRect(pad+46,10,18,4);
    ctx.fillStyle="#a6adbb"; ctx.fillText("WTI",pad+78,18); ctx.fillStyle="#00ffff"; ctx.fillRect(pad+112,10,18,4);

    var idx = Number.isFinite(activeIndex) ? Math.max(0, Math.min(rows.length-1, activeIndex)) : null;
    if(idx !== null){
      var xx=x(idx);
      ctx.strokeStyle="rgba(255,255,255,.85)";
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(xx, pad*0.72); ctx.lineTo(xx, h-pad); ctx.stroke();
      var p=rows[idx];
      ["brentUSDperBarrel","wtiUSDperBarrel"].forEach(function(field){
        var v=p[field]; if(!v) return;
        ctx.fillStyle = field==="brentUSDperBarrel" ? "#ff9900" : "#00ffff";
        ctx.beginPath(); ctx.arc(xx, y(v), 4, 0, Math.PI*2); ctx.fill();
      });
    }

    oilChartState={rows:rows,x:x,y:y,canvas:canvas,activeIndex:idx,min:min,max:max,pad:pad}; oilStats(rows); bindOilTooltip();
  }
  function bindOilTooltip(){
    var canvas=document.getElementById("oil-trend-canvas"), tip=document.getElementById("oil-tooltip"); if(!canvas||!tip||canvas.__oilTipBound) return;
    canvas.__oilTipBound=true;
    function show(e){
      var rect=canvas.getBoundingClientRect();
      var clientX=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX);
      var px=(clientX-rect.left)*(canvas.width/rect.width);
      var rows=oilChartState.rows||[]; if(!rows.length) return;
      var pad=oilChartState.pad||54, rightPad=28;
      var idx=Math.max(0,Math.min(rows.length-1,Math.round((px-pad)/(canvas.width-pad-rightPad)*(rows.length-1))));
      drawOilTrend(window.__oilGeojsonCache, idx);
      var p=rows[idx];
      tip.innerHTML='<strong>'+p.date+'</strong><br>Brent: '+(p.brentUSDperBarrel?'$'+fmt(p.brentUSDperBarrel,2):'—')+' USD/bbl<br>WTI: '+(p.wtiUSDperBarrel?'$'+fmt(p.wtiUSDperBarrel,2):'—')+' USD/bbl';
      tip.style.display='block'; tip.style.left=Math.min(rect.width-190,Math.max(8,clientX-rect.left+12))+'px'; tip.style.top='42px';
    }
    function hide(){ tip.style.display='none'; drawOilTrend(window.__oilGeojsonCache, null); }
    canvas.addEventListener('mousemove',show); canvas.addEventListener('touchmove',show,{passive:true}); canvas.addEventListener('mouseleave',hide); canvas.addEventListener('touchend',hide);
  }
  function renderEvPrices(ev){
    var ops=(ev&&ev.operators)||[];
    var rapid=[], ultra=[];
    ops.forEach(function(o){ if(o.rapidPencePerKWh!=null) rapid.push(Number(o.rapidPencePerKWh)); if(o.ultraRapidPencePerKWh!=null) ultra.push(Number(o.ultraRapidPencePerKWh)); });
    if(rapid.length){ setText("ev-rapid-price", fmt(rapid.reduce(function(a,b){return a+b;},0)/rapid.length,1)+"p"); }
    if(ultra.length){ setText("ev-ultra-price", fmt(ultra.reduce(function(a,b){return a+b;},0)/ultra.length,1)+"p"); }
  }
  function refresh(){
    Promise.all([getJSON(ENERGY),getJSON(PRICE),getJSON(OIL),getJSON(OIL_HISTORY),getJSON(FUEL),getJSON(EV_PRICES)]).then(function(res){
      var e=res[0]||{}, p=res[1]||{}, oil=res[2]||{}, hist=res[3], fuel=res[4]||{}, ev=res[5]||{};
      renderGauge("demand", e.demandGW); renderGauge("price", p.priceGBPperMWh); renderGauge("carbon", carbonValue(p));
      if(e.mix) renderMix(e.mix); renderCommodities(oil,fuel); renderEvPrices(ev); if(hist) drawOilTrend(hist);
      var latest=latestIso(e.updated,p.updated,oil.updated);
      document.getElementById("m-updated-time").textContent=timeLabel(latest);
      document.getElementById("m-updated-meta").textContent=(latest?dateLabel(latest)+" · energy "+timeLabel(e.updated)+" · price and carbon "+timeLabel(p.updated)+" · commodities "+timeLabel(oil.updated):"Energy, price, carbon and commodity timestamps will appear here.");
      var s=document.getElementById("scada-status"), mins=ageMin(e.updated);
      if(mins>20){s.textContent="Mix feed is "+Math.round(mins)+" minutes old. It may be stale.";s.className="scada-status stale";}
      else if(e.updated){s.textContent="Data diagnostics recorded in JSON feeds. Energy, price, carbon and commodity source health are being tracked.";s.className="scada-status";}
      else{s.textContent="Live feed unavailable. Awaiting first data write.";s.className="scada-status stale";}
    });
  }
  document.getElementById("oil-range").addEventListener("change", function(){ getJSON(OIL_HISTORY).then(drawOilTrend); });
  parseMarketInputs(); refresh(); setInterval(refresh, POLL);
})();
</script>
