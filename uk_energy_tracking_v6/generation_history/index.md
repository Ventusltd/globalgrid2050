---
layout: page
title: UK Generation History V6 Module
permalink: /uk_energy_tracking_v6/generation_history/
---

<link rel="stylesheet" href="/uk_energy_tracking_v6/styles/app.css?v=20260606generation1">

<div class="scada-grid v6-app" id="generation-history-module">
  <header class="scada-hero">
    <div class="scada-subtitle">GLOBALGRID2050 · ISOLATED V6 MODULE</div>
    <h1 class="scada-title">GB Generation History by Technology</h1>
    <div class="scada-title-rule"></div>
  </header>

  <p class="scada-intro"><strong>Separate module.</strong> This page is not linked into the main V6 tracker yet. It uses the same annual CSV and daily aggregate design pattern as the electricity price history chart.</p>

  <section id="generation-history-panel">
    <h2 class="section-title">Generation History</h2>
    <div class="trend-panel">
      <div class="price-history-actions">
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Elexon FUELINST generation history in MW</strong>
        <label class="price-history-date-label">Technology <select id="generation-history-technology"></select></label>
        <label class="price-history-date-label">Year <select id="generation-history-year"></select></label>
        <label class="price-history-date-label">Start <input type="date" id="generation-history-start"></label>
        <label class="price-history-date-label">Period <select id="generation-history-period">
          <option value="12hday">12 hours day</option>
          <option value="12hnight">12 hours night</option>
          <option value="24h">24 hours</option>
          <option value="48h">48 hours</option>
          <option value="7d" selected>1 week</option>
          <option value="30d">1 month</option>
          <option value="3m">3 months</option>
          <option value="6m">6 months</option>
          <option value="12m">12 months</option>
          <option value="5y">5 years</option>
          <option value="10y">10 years</option>
        </select></label>
      </div>
      <div id="generation-history-range-status" class="price-history-range-status">Selected range will appear here.</div>
      <div class="unit-panel"><strong>Unit:</strong> megawatts. Select a technology, year, start date and period. Short windows use half hourly FUELINST data. 12 month, 5 year and 10 year views use daily high, average and low aggregates.</div>
      <canvas id="generation-history-canvas" width="900" height="620"></canvas>
      <details class="price-history-discovery">
        <summary>What does this generation data mean?</summary>
        <p><strong>Interpretation:</strong> this module uses Elexon BMRS FUELINST generation output by fuel type. It is useful for system trend analysis, battery opportunity screening and historic technology behaviour.</p>
        <p><strong>Important limitation:</strong> this V1 module uses Elexon FUELINST only. Embedded distribution solar should be handled carefully and may need a separate PVLive historical correction layer later.</p>
      </details>
    </div>
  </section>
</div>

<script src="/uk_energy_tracking_v6/generation_history/live-config.js?v=20260606generation1"></script>
<script src="/uk_energy_tracking_v6/generation_history/load_generation_history_data.js?v=20260606generation1"></script>
<script src="/uk_energy_tracking_v6/generation_history/render_generation_history_chart.js?v=20260606generation1"></script>
<script src="/uk_energy_tracking_v6/generation_history/control_generation_history.js?v=20260606generation1"></script>
