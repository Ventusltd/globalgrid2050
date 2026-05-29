---
layout: page
title: UK Live Grid Tracker V6
permalink: /uk_energy_tracking_v6/
---

<link rel="stylesheet" href="/uk_energy_tracking_v6/styles/app.css?v=20260529a">

<div class="v6-app" id="v6-app">
  <header class="v6-hero">
    <div class="v6-kicker">GLOBALGRID2050 · UK LIVE GRID TRACKER V6</div>
    <h1>GB Electricity, Price, Carbon, Commodities and Frequency Monitor</h1>
    <p>Modular V6 clone of V5. V5 remains intact while V6 becomes the operational development build.</p>
  </header>

  <section class="v6-panel" id="live-electricity-snapshot">
    <h2>Live electricity snapshot</h2>
    <div class="v6-snapshot-grid">
      <div><span>Demand</span><strong id="summary-demand">—</strong><em>GW</em></div>
      <div><span>Price</span><strong id="summary-price">—</strong><em>£/MWh</em></div>
      <div><span>Carbon</span><strong id="summary-carbon">—</strong><em>g/kWh</em></div>
    </div>
    <p class="v6-small" id="summary-timestamps">Awaiting V6 live data.</p>
  </section>

  <section class="v6-panel">
    <h2>Generation mix</h2>
    <div id="generation-mix-grid" class="v6-card-grid"></div>
  </section>

  <section class="v6-panel" id="electricity-price-history-panel">
    <h2>Electricity price history</h2>
    <div class="v6-controls">
      <label>Start <input type="date" id="price-history-start"></label>
      <label>Period <select id="price-history-period">
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
      <button type="button" id="price-history-refresh">Refresh chart</button>
    </div>
    <canvas id="price-history-canvas" width="1200" height="720"></canvas>
    <details class="v6-discovery">
      <summary>What does this Elexon price mean?</summary>
      <p>This chart shows the GB settlement price signal used for power system balancing. It is useful for reading volatility and stress, but it is not a retail tariff.</p>
    </details>
  </section>

  <section class="v6-panel">
    <h2>Commodity price signals</h2>
    <div class="v6-card-grid">
      <div class="v6-card"><span>Brent crude</span><strong id="brent-price">—</strong><em>USD/bbl</em></div>
      <div class="v6-card"><span>WTI crude</span><strong id="wti-price">—</strong><em>USD/bbl</em></div>
      <div class="v6-card"><span>Copper</span><strong id="copper-price">—</strong><em>USD · EUR · GBP/t</em></div>
      <div class="v6-card"><span>Aluminium</span><strong id="aluminium-price">—</strong><em>USD · EUR · GBP/t</em></div>
    </div>
  </section>
</div>

<script src="/uk_energy_tracking_v6/shared_helpers/dom_text/dom_text.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/live_data_pipeline/live-config.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/live_data_pipeline/load_json/load_json.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/live_data_pipeline/render_live_snapshot/render_live_snapshot.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/live_data_pipeline/render_generation_mix/render_generation_mix.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/commodity_price_signals/render_commodities/render_commodities.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js?v=20260529a"></script>
<script src="/uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js?v=20260529a"></script>
