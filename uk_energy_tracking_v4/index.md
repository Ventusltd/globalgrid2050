---
layout: page
title: UK Live Grid Tracker V4
permalink: /uk_energy_tracking_v4/
---

<link rel="stylesheet" href="/uk_energy_tracking_v4/price-history-ui.css">
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
    <div class="scada-subtitle">UK LIVE GRID TRACKER V4</div>
    <div class="scada-live-row">
      <div class="scada-live-pill"><span class="scada-live-dot"></span>LIVE GRID SOURCE</div>
      <div class="scada-update-panel">
        <div class="scada-update-label">Latest data update</div>
        <div class="scada-update-time" id="m-updated-time">Awaiting feed</div>
        <div class="scada-update-meta" id="m-updated-meta">Energy, price and carbon timestamps will appear here.</div>
      </div>
    </div>
  </header>

  <p class="scada-intro" style="border:1px solid var(--gg-orange);padding:10px 12px;border-radius:4px;color:var(--gg-orange);">V4 experimental clone. Original tracker remains protected at /uk_energy_tracking/. This page uses isolated V4 feeds for development and transport energy testing.</p>

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
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Electricity Price History</strong>
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
        
        <label class="price-history-date-label">From <input type="date" id="price-history-from"></label>
        <label class="price-history-date-label">To <input type="date" id="price-history-to"></label>
        <button type="button" id="price-history-clear-dates" class="price-history-date-apply">Clear dates</button>
        <a href="/uk_energy_tracking_v4/electricity_price_history.csv" download>Download CSV</a>
        <button type="button" id="price-history-fullscreen-btn" class="price-history-fullscreen-btn">Full screen chart</button>
      </div>
      <div id="price-history-range-status" class="price-history-range-status">Selected range will appear here.</div>
      <div class="unit-panel"><strong>Unit:</strong> pounds per Megawatt hour. Historical Elexon System Prices are shown for context. New live Market Index records build forward. Warnings are shown in the table health column.</div>
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
        <button type="button" id="price-history-zoom-reset">Redraw</button>
        <button type="button" id="price-history-fullscreen-close">Close</button>
      </div>
      <canvas id="price-history-fullscreen-canvas"></canvas>
      <div class="price-history-fullscreen-note">Full screen uses the selected inline date range. Esc closes the chart.</div>
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
<script src='/uk_energy_tracking_v4/price-history-ui.js?v=20260526d'></script>
<script src='/uk_energy_tracking_v4/price-history-fullscreen.js?v=20260526d'></script>

<script src='/uk_energy_tracking_v4/live-config.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-helpers.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-gauges.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-transport.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-oil-chart.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v4/live-app.js?v=20260526a'></script>

