<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>UK Live Grid Tracker V4</title>
<link rel="stylesheet" href="/uk_energy_tracking_v4/price-history-ui.css">
<style>
:root{--bg:#050505;--panel:#0b0e14;--line:#252b36;--text:#f5f7fb;--muted:#9aa3b6;--cyan:#00ffff;--green:#00ff88;--red:#ff3333;--orange:#ff9900;--pink:#ff00e6;}
*{box-sizing:border-box} body{margin:0;background:radial-gradient(circle at top,#101623 0,#050505 55%,#000 100%);color:var(--text);font-family:"Courier New",monospace;padding:22px} .wrap{max-width:1180px;margin:0 auto}.hero{border:1px solid var(--line);background:rgba(6,10,16,.95);padding:22px;border-radius:10px;box-shadow:0 0 30px rgba(0,255,255,.08)}.kicker{color:var(--cyan);letter-spacing:.18em;text-transform:uppercase;font-size:12px}.hero h1{margin:8px 0 8px;font-size:30px}.hero p{color:var(--muted);line-height:1.55}.scada-status{margin-top:12px;border:1px solid rgba(0,255,136,.4);color:var(--green);padding:10px;border-radius:6px;background:rgba(0,255,136,.06)}.scada-status.stale{border-color:rgba(255,51,51,.5);color:var(--red);background:rgba(255,51,51,.06)}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:18px 0}.metric{border:1px solid var(--line);background:var(--panel);border-radius:8px;padding:16px}.metric-label{color:var(--muted);font-size:12px;letter-spacing:.1em;text-transform:uppercase}.metric-value{font-size:34px;color:var(--cyan);font-weight:800;margin-top:8px}.metric-unit{color:var(--muted);font-size:12px}.scada-gauge-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:18px 0}.scada-gauge-card{border:1px solid var(--line);background:var(--panel);border-radius:8px;padding:16px}.scada-gauge-title{color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-size:12px}.scada-gauge{width:100%;height:150px}.scada-gauge-bg{stroke:#1e2733;stroke-width:16;fill:none}.scada-gauge-fill{stroke-width:16;fill:none;filter:drop-shadow(0 0 6px currentColor)}.scada-gauge-value{fill:#fff;font-size:30px;font-weight:800}.scada-gauge-unit{fill:var(--muted);font-size:10px}.section-title{margin:26px 0 12px;color:var(--cyan);letter-spacing:.12em;text-transform:uppercase;font-size:14px}.scada-mix-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.scada-mini{border:1px solid var(--line);background:var(--panel);border-radius:7px;padding:12px}.scada-mini-top{display:flex;justify-content:space-between;gap:10px}.scada-mini-name{color:#fff}.scada-mini-value{color:var(--muted);font-size:12px}.scada-mini-track{height:7px;background:#111823;border-radius:999px;margin-top:10px;overflow:hidden}.scada-mini-fill{height:100%;border-radius:999px}.commodity-grid,.pump-grid,.ev-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.commodity-card,.pump-card,.ev-card{border:1px solid var(--line);background:var(--panel);border-radius:8px;padding:14px}.commodity-label,.pump-label,.ev-label{color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-size:11px}.commodity-value,.pump-value,.ev-value{font-size:28px;color:var(--cyan);font-weight:800;margin:6px 0}.commodity-unit{color:var(--muted);font-size:12px}.trend-panel,.fuel-logic-panel,.ev-panel,.scada-credit,.unit-panel{border:1px solid var(--line);background:rgba(11,14,20,.95);border-radius:8px;padding:14px;margin-top:12px;color:var(--muted);line-height:1.5}.trend-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}select{background:#050505;color:var(--cyan);border:1px solid var(--line);padding:7px;border-radius:4px;font-family:inherit}canvas{width:100%;max-width:100%;border:1px solid var(--line);background:#070a10;border-radius:6px}.oil-chart-wrap{position:relative}.oil-tooltip{position:absolute;display:none;top:40px;left:40px;background:#05070c;border:1px solid var(--cyan);color:#fff;padding:8px;border-radius:4px;font-size:12px;pointer-events:none;z-index:5}.oil-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:10px}.oil-stat{border:1px solid var(--line);background:#070a10;border-radius:6px;padding:10px}.oil-stat-label{color:var(--muted);font-size:10px;text-transform:uppercase}.oil-stat-value{color:var(--cyan);font-weight:800}.fuel-source-links a{display:inline-block;color:#7fdfff;margin:8px 10px 0 0}.scada-credit a{color:#7fdfff}.dev-note{border:1px solid var(--orange);color:var(--orange);background:rgba(255,153,0,.06);padding:10px;border-radius:6px;margin-top:12px}@media(max-width:600px){body{padding:12px}.hero h1{font-size:24px}.metric-value{font-size:28px}}
a { color: #7fdfff; }
</style>
</head>
<body>
<div class="wrap">
  <section class="hero">
    <div class="kicker">GlobalGrid2050 · UK Live Grid Tracker V4</div>
    <h1>GB Electricity, Price, Carbon, Oil and Transport Energy Monitor</h1>
    <p>Experimental V4 build. Original tracker remains protected at <a href="/uk_energy_tracking/">/uk_energy_tracking/</a>. V4 uses isolated feeds for development, transport energy and price history testing.</p>
    <div class="dev-note"><strong>V4 development note:</strong> generation mix refreshes every five minutes. Electricity price and carbon update on their native half hourly cadence. Oil, fuel and EV comparison layers are still being validated.</div>
    <div id="scada-status" class="scada-status stale">Awaiting live feed.</div>
  </section>

  <section class="metrics">
    <div class="metric"><div class="metric-label">Latest combined update</div><div class="metric-value" id="m-updated-time">—</div><div class="metric-unit" id="m-updated-meta">Awaiting feed</div></div>
    <div class="metric"><div class="metric-label">Generation cadence</div><div class="metric-value">5 min</div><div class="metric-unit">Elexon BMRS Insights plus Sheffield Solar</div></div>
    <div class="metric"><div class="metric-label">Price and carbon cadence</div><div class="metric-value">30 min</div><div class="metric-unit">Elexon Market Index and NESO Carbon Intensity</div></div>
  </section>

  <section class="scada-gauge-grid">
    <div class="scada-gauge-card"><div class="scada-gauge-title">Demand</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="demand"></svg></div>
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
        </select>
        
        <label class="price-history-date-label">From <input type="date" id="price-history-from"></label>
        <label class="price-history-date-label">To <input type="date" id="price-history-to"></label>
        <button type="button" id="price-history-clear-dates" class="price-history-date-apply">Clear dates</button>
        <a href="/uk_energy_tracking_v4/electricity_price_history.csv" download>Download CSV</a>
        <button type="button" id="price-history-fullscreen-btn" class="price-history-fullscreen-btn">Full screen chart</button>
      </div>
      <div id="price-history-range-status" class="price-history-range-status">Selected range will appear here.</div>
      <div class="unit-panel"><strong>Unit:</strong> pounds per Megawatt hour. Historical Elexon System Prices are loaded from annual CSV files for a maximum 30 day visible window. The red line marks £0/MWh.</div>
      <canvas id="price-history-canvas" width="900" height="300"></canvas>
      <div class="price-history-grid">
        <div class="price-history-card"><div class="price-history-label">Latest price</div><div class="price-history-value" id="ph-latest-price">—</div></div>
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
