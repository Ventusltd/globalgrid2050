---
layout: page
title: UK Live Grid Tracker V5
permalink: /uk_energy_tracking_v5/
---

<link rel="stylesheet" href="/uk_energy_tracking_v5/price-history-ui.css">
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
.scada-grid { font-family: "Courier New", monospace; max-width: 1280px; margin: 0 auto; }
.scada-hero { border-bottom: 1px solid var(--gg-line); padding: 18px 0 12px; margin-bottom: 18px; }
.scada-subtitle { letter-spacing: .28em; color: var(--gg-muted); font-size: 14px; text-transform: uppercase; }
.scada-title { margin: 10px 0 8px 0; color: var(--gg-text); font-size: clamp(28px, 5vw, 44px); line-height: 1.1; font-weight: 800; }
.scada-title-rule { height: 1px; background: var(--gg-text); opacity: .75; margin: 12px 0 0 0; }
.scada-live-row, .scada-live-pill, .scada-update-panel, .scada-intro, .scada-dev-note, .scada-status, .scada-gauges { display:none !important; }
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
.trend-controls, .price-history-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
.trend-controls select, .price-history-actions select, .price-history-actions input { background:#050505; color:var(--gg-cyan); border:1px solid var(--gg-line); padding:8px; font-family:"Courier New", monospace; border-radius:4px; }
.price-history-actions a, .price-history-actions button { border:1px solid var(--gg-line); border-radius:4px; padding:8px 10px; color:#7fdfff; background:rgba(255,255,255,.03); font-family:"Courier New", monospace; }
.price-history-date-label { display:flex; gap:6px; align-items:center; color:var(--gg-muted); text-transform:uppercase; letter-spacing:.12em; font-size:11px; }
#electricity-price-history-panel .price-history-range-status,
#electricity-price-history-panel .unit-panel,
#electricity-price-history-panel .price-history-grid,
#electricity-price-history-panel .price-history-table-toggle { display:none !important; }
#electricity-price-history-panel .trend-panel { padding:12px; }
#electricity-price-history-panel .price-history-actions::after { content:"Scrollable Elexon System Price history · select start, period and hour filter · red line marks £0/MWh"; display:block; width:100%; color:var(--gg-muted); font-size:12px; letter-spacing:.08em; text-transform:uppercase; margin-top:4px; }
#electricity-price-history-panel #price-history-canvas { height: min(76dvh, 760px) !important; min-height:520px !important; width:100% !important; display:block; touch-action: pan-y; }
#oil-trend-canvas { width:100%; height:300px; display:block; border:1px solid rgba(255,255,255,.05); background:#070a10; touch-action:auto; }
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
.ev-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:10px; }
.ev-card { border:1px solid var(--gg-line); background:var(--gg-panel); border-radius:6px; padding:12px; }
.ev-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.14em; font-size:11px; }
.ev-value { color:var(--gg-green); font-size:22px; font-weight:800; margin-top:6px; }
.scada-credit { font-size:12px; color:var(--gg-muted); margin-top:22px; line-height:1.5; }
.scada-credit h2 { color:var(--gg-cyan); font-size:20px; letter-spacing:.06em; text-transform:uppercase; }
.section-title { color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-size:22px;margin-top:26px; }
html.v5-chart-open, body.v5-chart-open { overflow:hidden !important; height:100dvh !important; }
@media (max-width: 850px) { .scada-mix-grid, .commodity-grid, .pump-grid, .ev-card-grid { grid-template-columns:1fr; } .oil-stats-grid { grid-template-columns:1fr 1fr; } #electricity-price-history-panel #price-history-canvas { min-height:560px !important; height:72dvh !important; } }
@media (orientation: landscape) and (max-height: 520px) {
  #electricity-price-history-panel #price-history-canvas { height:68dvh !important; min-height:260px !important; }
  #electricity-price-history-panel .trend-panel { padding:8px !important; }
  #electricity-price-history-panel .price-history-actions { max-height:none !important; overflow:visible !important; }
  .price-history-scroller, .price-history-time-tabs { padding:7px 8px !important; margin:7px 0 !important; }
}

#electricity-price-history-panel .gg-machine-note {
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.018);
  color: var(--gg-muted);
  font-size: 10.5px;
  line-height: 1.45;
  letter-spacing: .04em;
  padding: 8px 10px;
  margin: 8px 0 10px;
  border-radius: 5px;
}
#electricity-price-history-panel .gg-machine-note strong {
  color: var(--gg-cyan);
  text-transform: uppercase;
  letter-spacing: .10em;
  display: block;
  margin-bottom: 4px;
}
#electricity-price-history-panel .gg-machine-note span {
  display: block;
}
#electricity-price-history-panel .gg-machine-note b {
  color: var(--gg-text);
}

</style>

<div class="scada-grid" id="scada-grid">
  <header class="scada-hero">
    <div class="scada-subtitle">GLOBALGRID2050 · UK LIVE GRID TRACKER V5</div>
    <h1 class="scada-title">GB Electricity, Price, Carbon, Oil and Transport Energy Monitor</h1>
    <div class="scada-title-rule"></div>
    <div class="scada-live-row">
      <div class="scada-live-pill"><span class="scada-live-dot"></span>LIVE GRID SOURCE</div>
      <div class="scada-update-panel">
        <div class="scada-update-label">Latest data update</div>
        <div class="scada-update-time" id="m-updated-time">Awaiting feed</div>
        <div class="scada-update-meta" id="m-updated-meta">Energy, price, carbon and commodity timestamps will appear here.</div>
      </div>
    </div>
  </header>

  <p class="scada-intro scada-dev-note"><strong>V5 experimental clone.</strong> Original tracker remains protected at /uk_energy_tracking/. This page uses isolated V5 feeds for development, transport energy and price history testing.</p>

  <p class="scada-intro">Near real time GB electricity demand, market price, carbon intensity and generation mix. Generation mix refreshes every 5 minutes; price and carbon update every half hour at their native cadence. Commodity prices update daily through GridBot.</p>

  <div id="scada-status" class="scada-status stale">Awaiting live feed.</div>

  <section class="scada-gauges">
    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Demand</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="demand"></svg></div>
    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Price</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="price"></svg></div>
    <div class="scada-gauge-card"><div class="scada-gauge-title">Carbon Intensity</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="carbon"></svg></div>
  </section>

  <section>
    <h2 class="section-title">Generation Mix</h2>
    <div id="scada-mix" class="scada-mix-grid"></div>
  </section>

  <section id="electricity-price-history-panel">
    <h2 class="section-title">Electricity Price History</h2>
    <div class="trend-panel">
      <div class="price-history-actions">
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Electricity Price History</strong>
        <label class="price-history-date-label">Year <select id="price-history-year"></select></label>
        <label class="price-history-date-label">Start <input type="date" id="price-history-start"></label>
        <label class="price-history-date-label">Period <select id="price-history-period">
          <option value="7d" selected>1 week</option>
          <option value="30d">1 month</option>
          <option value="3m">3 months</option>
        </select></label>
        <button type="button" id="price-history-clear-start" class="price-history-date-apply">Reset start</button>
        <a href="/uk_energy_tracking_v5/electricity_price_history.csv" download>Download CSV</a>
        <button type="button" id="price-history-fullscreen-btn" class="price-history-fullscreen-btn">Full screen chart</button>
      </div>
      <div id="price-history-range-status" class="price-history-range-status">Selected range will appear here.</div>
      <div class="unit-panel"><strong>Unit:</strong> pounds per Megawatt hour. Select a year, a start date and a period. The chart automatically loads the required Elexon annual CSV file and calculates the end date. The red line marks £0/MWh.</div>
      
      <div class="gg-machine-note">
        <strong>Grid intelligence machine:</strong>
        <span><b>Inputs:</b> Elexon prices, live demand, carbon data, oil and fuel data, time windows, day and night filters.</span>
        <span><b>Mechanism:</b> lazy loading, event detection, high and low marker logic, date windowing, chart rendering, mobile full screen controls.</span>
        <span><b>Outputs:</b> price volatility insight, peak and trough timing, market spread visibility, battery opportunity signals, future circuit sizing logic.</span>
      </div>

<canvas id="price-history-canvas" width="900" height="720"></canvas>
      <div class="price-history-grid">
        <div class="price-history-card"><div class="price-history-label">Latest visible price</div><div class="price-history-value" id="ph-latest-price">—</div></div>
        <div class="price-history-card"><div class="price-history-label">Settlement time</div><div class="price-history-value" id="ph-latest-time">—</div></div>
        <div class="price-history-card"><div class="price-history-label">Visible records</div><div class="price-history-value" id="ph-row-count">—</div></div>
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
        <div class="ev-card"><div class="ev-label">Rapid charging average</div><div class="ev-value" id="ev-rapid-price">—</div><div class="commodity-unit">pence per kilowatt hour</div></div>
        <div class="ev-card"><div class="ev-label">Ultra rapid average</div><div class="ev-value" id="ev-ultra-price">—</div><div class="commodity-unit">pence per kilowatt hour</div></div>
      </div>
    </div>
  </section>

  <section class="scada-credit">
    <h2>Data sources & attribution</h2>
    <p>This tracker uses free public sources. We gratefully acknowledge them:</p>
    <p><strong>Generation mix & demand</strong> — Elexon BMRS Insights, used under the BMRS Data Licence Terms.</p>
    <p><strong>Carbon intensity</strong> — National Energy System Operator <a href="https://carbonintensity.org.uk/">Carbon Intensity API</a>, developed with the Environmental Defense Fund, University of Oxford and WWF. Licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</p>
    <p><strong>Solar generation</strong> — <a href="https://www.solar.sheffield.ac.uk/api/">Sheffield Solar PV_Live</a>, University of Sheffield.</p>
    <p><strong>Commodity prices</strong> — Yahoo Finance live chart endpoints and FRED historic oil series. UK pump prices are a best effort public page read and should be treated as indicative only.</p>
    <p>Indicative near real time values for screening and situational awareness only. No representation is made that the data is accurate or complete.</p>
  </section>
</div>

<div id="price-history-fullscreen-overlay" class="price-history-fullscreen-overlay">
  <div class="price-history-fullscreen-shell">
    <div class="price-history-fullscreen-toolbar">
      <strong>Electricity price history</strong>
      <span id="price-history-fullscreen-meta">Selected range will appear here.</span>
      <button type="button" id="price-history-zoom-reset">Redraw</button>
      <button type="button" id="price-history-fullscreen-close">Close</button>
    </div>
    <canvas id="price-history-fullscreen-canvas"></canvas>
    <div class="price-history-fullscreen-note">Elexon System Price history. Red line marks £0/MWh. Date labels show from, middle and to points.</div>
  </div>
</div>

<script src='/uk_energy_tracking_v5/price-history-ui.js?v=20260527e'></script>
<script src='/uk_energy_tracking_v5/price-history-fullscreen.js?v=20260527e'></script>
<script src='/uk_energy_tracking_v5/live-config.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v5/live-helpers.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v5/live-gauges.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v5/live-transport.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v5/live-oil-chart.js?v=20260526a'></script>
<script src='/uk_energy_tracking_v5/live-app.js?v=20260527a'></script>
