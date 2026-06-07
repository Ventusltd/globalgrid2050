---
layout: page
title: UK Generation History V6 Module
permalink: /uk_energy_tracking_v6/generation_history/
---

<link rel="stylesheet" href="/uk_energy_tracking_v6/styles/app.css?v=20260604toolbargrid1">
<style>
  #generation-history-module .scada-intro{display:block!important;color:#9aa3b6;font-size:13px;line-height:1.5;margin:10px 0 18px;}
  #generation-history-panel .price-history-range-status{display:block!important;color:#9aa3b6;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin:8px 0 10px;}
  #generation-history-panel .unit-panel{display:none!important;}
  #generation-history-panel .trend-panel{padding:12px;width:100%;max-width:100%;overflow:hidden;background:#070a10!important;border:1px solid #252b36!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 0 22px rgba(0,255,255,.05);}
  #generation-history-panel .price-history-actions::after{content:"V7 loading ladder · daily aggregate landing view until recent slice is populated · one technology at a time";display:block;width:100%;color:var(--gg-muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px;}
  #generation-history-panel #generation-history-canvas{height:min(76dvh,760px)!important;min-height:520px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:6px;}
  #generation-history-panel .price-history-actions select,
  #generation-history-panel .price-history-actions input{min-height:38px;max-width:100%;}
  #generation-history-panel .ons-generation-placeholder{margin-top:16px;padding:14px;border:1px solid rgba(0,255,255,.28);border-radius:10px;background:rgba(0,255,255,.035);color:#9aa3b6;font-size:12px;line-height:1.55;letter-spacing:.07em;text-transform:uppercase;}
  #generation-history-panel .ons-generation-placeholder strong{display:block;color:#00ffff;font-size:13px;margin-bottom:8px;letter-spacing:.12em;}
  #generation-history-panel .ons-generation-placeholder .placeholder-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px;}
  #generation-history-panel .ons-generation-placeholder .placeholder-card{border:1px solid rgba(255,255,255,.08);background:rgba(5,7,12,.72);border-radius:8px;padding:10px;min-height:58px;}
  #generation-history-panel .ons-generation-placeholder .placeholder-card b{display:block;color:#f5f7fb;font-size:16px;margin-top:4px;}
  #generation-history-panel .ons-generation-placeholder a{color:#00ffff;}
  @media(max-width:850px){
    #generation-history-panel #generation-history-canvas{min-height:560px!important;height:70dvh!important;}
    #generation-history-panel .price-history-actions{align-items:stretch;}
    #generation-history-panel .price-history-date-label{width:100%;justify-content:space-between;}
    #generation-history-panel .price-history-date-label select,
    #generation-history-panel .price-history-date-label input{flex:1;min-width:0;}
    #generation-history-panel .ons-generation-placeholder .placeholder-grid{grid-template-columns:1fr;}
  }
  @media(max-width:950px) and (orientation:landscape){
    #generation-history-panel .trend-panel{padding:6px!important;}
    #generation-history-panel #generation-history-canvas{height:88dvh!important;min-height:420px!important;max-height:none!important;}
  }
</style>

<div class="scada-grid v6-app" id="generation-history-module">
  <header class="scada-hero">
    <div class="scada-subtitle">GLOBALGRID2050 · ISOLATED V6 MODULE</div>
    <h1 class="scada-title">GB Generation History by Technology</h1>
    <div class="scada-title-rule"></div>
  </header>

  <p class="scada-intro"><strong>Separate module.</strong> This page is not linked into the main V6 tracker yet. It now follows the V7 loading ladder: recent slice for short windows and daily aggregate for long windows.</p>

  <section id="generation-history-panel">
    <h2 class="section-title">Generation History</h2>
    <div class="trend-panel">
      <div class="price-history-actions">
        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Generation history in MW</strong>
        <label class="price-history-date-label">Technology <select id="generation-history-technology"></select></label>
        <label class="price-history-date-label">Year <select id="generation-history-year"></select></label>
        <label class="price-history-date-label">Start <input type="date" id="generation-history-start"></label>
        <label class="price-history-date-label">Period <select id="generation-history-period">
          <option value="12hday">12 hours day</option>
          <option value="12hnight">12 hours night</option>
          <option value="24h">24 hours</option>
          <option value="48h">48 hours</option>
          <option value="7d">1 week</option>
          <option value="30d">1 month</option>
          <option value="3m">3 months</option>
          <option value="6m">6 months</option>
          <option value="12m" selected>12 months</option>
          <option value="5y">5 years</option>
          <option value="10y">10 years</option>
        </select></label>
      </div>
      <div id="generation-history-range-status" class="price-history-range-status">Selected range will appear here.</div>
      <div class="unit-panel"><strong>Unit:</strong> megawatts. Short windows use a small recent half hourly slice. Long windows use daily high, average and low aggregates.</div>
      <canvas id="generation-history-canvas" width="900" height="720"></canvas>
      <div class="ons-generation-placeholder" id="ons-generation-placeholder">
        <strong>Annual MWh energy accounting layer</strong>
        ONS energy use data belongs here as a separate MWh app, not inside the Elexon MW chart. It will support primary energy, final energy, fossil replacement and electrification analysis.
        <div class="placeholder-grid">
          <div class="placeholder-card">Annual MWh by source<b>Scaffold</b></div>
          <div class="placeholder-card">ONS workbook/API automation<b>Annual</b></div>
          <div class="placeholder-card">Standalone MWh app<b><a href="/uk_energy_tracking_v6/generation_history/mwh_energy_use/">Open</a></b></div>
        </div>
      </div>
      <details class="price-history-discovery">
        <summary>What does this generation data mean?</summary>
        <p><strong>Interpretation:</strong> this module uses generation output by technology. It is useful for system trend analysis, battery opportunity screening and historic technology behaviour.</p>
        <p><strong>Loading rule:</strong> the page should never load the full raw generation universe by default. It should load only the visible time window at the required resolution.</p>
      </details>
    </div>
  </section>
</div>

<script src="/uk_energy_tracking_v6/generation_history/live-config.js?v=20260607genmwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/load_generation_history_data.js?v=20260607genmwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/render_generation_history_chart.js?v=20260607genmwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/control_generation_history.js?v=20260607genmwh1"></script>
