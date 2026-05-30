---
layout: page
title: UK Live Grid Tracker V6
permalink: /uk_energy_tracking_v6/
---

<link rel="stylesheet" href="/uk_energy_tracking_v6/styles/app.css?v=20260530e">

<div class="scada-grid v6-app" id="scada-grid">
  <header class="scada-hero">
    <div class="scada-subtitle">GLOBALGRID2050 · UK LIVE GRID TRACKER V6</div>
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

  <p class="scada-intro scada-dev-note"><strong>V6 modular development build.</strong> V5 remains the protected reference while this page runs the same tracker through modular V6 files.</p>

  <div id="scada-status" class="scada-status stale">Awaiting live feed.</div>

  <section class="scada-live-summary" id="live-electricity-snapshot">
    <div class="scada-summary-title">Live electricity snapshot</div>
    <div class="scada-summary-grid">
      <div><span>Demand</span><strong id="summary-demand">—</strong><em>GW</em></div>
      <div><span>Price</span><strong id="summary-price">—</strong><em>£/MWh</em></div>
      <div><span>Carbon</span><strong id="summary-carbon">—</strong><em>g/kWh</em></div>
    </div>
    <div class="scada-summary-time" id="summary-timestamps">Awaiting V6 live data.</div>
  </section>

  <section>
    <h2 class="section-title">Generation Mix</h2>
    <div id="generation-mix-grid" class="scada-mix-grid"></div>
  </section>

  <section id="electricity-price-history-panel">
    <h2 class="section-title">Electricity Price History</h2>
    <div class="trend-panel">
      <div class="price-history-actions">
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Electricity half hourly settlement price in GBP (£) per MWh</strong>
        <label class="price-history-date-label">Year <select id="price-history-year"></select></label>
        <label class="price-history-date-label">Start <input type="date" id="price-history-start"></label>
        <label class="price-history-date-label">Period <select id="price-history-period">
          <option value="12hday">12 hours day</option>
          <option value="12hnight">12 hours night</option>
          <option value="1d">1 day</option>
          <option value="7d" selected>1 week</option>
          <option value="30d">1 month</option>
          <option value="3m">3 months</option>
          <option value="6m">6 months</option>
          <option value="12m">12 months</option>
          <option value="5y">5 years</option>
          <option value="10y">10 years</option>
        </select></label>
        <a href="/uk_energy_tracking_v6/electricity_price_history.csv" download>Download CSV</a>
        <button type="button" id="price-history-fullscreen-btn" class="price-history-fullscreen-btn">Full screen chart</button>
        <button type="button" id="price-history-refresh">Refresh chart</button>
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
      <details id="price-history-discovery" class="price-history-discovery">
        <summary>What does this Elexon price mean?</summary>
        <p><strong>Interpretation:</strong> this is an Elexon System Price / imbalance price signal used in GB electricity settlement. It is not a retail tariff and it is not a simple consumer wholesale bill.</p>
        <p><strong>Market meaning:</strong> it reflects the marginal stress or surplus cost of balancing the power system in each settlement period. It can correlate with wholesale spot prices, but it is a balancing and settlement signal rather than a pure day ahead or intraday merchant price.</p>
        <p><strong>How to read the chart:</strong> p/kWh values are indicative equivalents for human intuition. The formal unit remains £/MWh. High, average and low boxes expose volatility, storage opportunity and system stress.</p>
      </details>
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
  </section>

  <section class="scada-credit">
    <h2>Data sources & attribution</h2>
    <p>This tracker uses free public sources. Generation mix and demand use Elexon BMRS Insights. Carbon intensity uses National Energy System Operator Carbon Intensity API. Commodity prices use public market feeds. Indicative near real time values for screening and situational awareness only.</p>
  </section>
</div>

<div id="price-history-fullscreen-overlay" class="price-history-fullscreen-overlay">
  <div class="price-history-fullscreen-shell">
    <div class="price-history-fullscreen-toolbar">
      <strong>£/MWh</strong>
      <span id="price-history-fullscreen-meta">Selected range will appear here.</span>
      <button type="button" id="price-history-fullscreen-close" aria-label="Close">×</button>
    </div>
    <button type="button" id="price-history-fullscreen-period-back" class="price-history-fullscreen-arrow price-history-fullscreen-arrow-left" aria-label="Previous period">‹</button>
    <button type="button" id="price-history-fullscreen-period-forward" class="price-history-fullscreen-arrow price-history-fullscreen-arrow-right" aria-label="Next period">›</button>
    <canvas id="price-history-fullscreen-canvas"></canvas>
  </div>
</div>

<script src="/uk_energy_tracking_v6/shared_helpers/dom_text/dom_text.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/live_data_pipeline/live-config.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/live_data_pipeline/load_json/load_json.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/live_data_pipeline/render_live_snapshot/render_live_snapshot.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/live_data_pipeline/render_generation_mix/render_generation_mix.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/commodity_price_signals/render_commodities/render_commodities.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js?v=20260530e"></script>
<script src="/uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js?v=20260530e"></script>
