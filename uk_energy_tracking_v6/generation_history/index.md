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
  #generation-history-panel .price-history-actions::after{content:"Secondary engineering MW view · primary dashboard now uses MWh aggregate intelligence";display:block;width:100%;color:var(--gg-muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px;}
  #generation-history-panel #generation-history-canvas{height:min(76dvh,760px)!important;min-height:520px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:6px;}
  #generation-history-panel .generation-source-warning{margin:12px 0 0;padding:12px 14px;border:1px solid rgba(255,64,64,.72);border-radius:8px;background:rgba(80,0,0,.18);color:#ff5555;font-size:12px;line-height:1.55;letter-spacing:.06em;text-transform:uppercase;}
  #generation-history-panel .generation-source-warning strong{color:#ff3333;}
  #generation-history-panel .generation-source-warning a{color:#ff7777;text-decoration:underline;}
  #generation-history-panel .price-history-actions select,
  #generation-history-panel .price-history-actions input{min-height:38px;max-width:100%;}
  #generation-history-panel .mwh-panel{margin-bottom:18px;padding:14px;border:1px solid rgba(0,255,255,.30);border-radius:10px;background:rgba(0,255,255,.035);}
  #generation-history-panel .mwh-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0 12px;color:#9aa3b6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;}
  #generation-history-panel .mwh-controls strong{color:#00ffff;letter-spacing:.12em;}
  #generation-history-panel .mwh-controls select{min-height:36px;background:#05070c;color:#00ffff;border:1px solid #252b36;border-radius:6px;padding:6px;}
  #generation-history-panel .mwh-status{color:#9aa3b6;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin:8px 0 12px;}
  #generation-history-panel .mwh-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;}
  #generation-history-panel .mwh-card{border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(5,7,12,.82);padding:12px;min-height:150px;}
  #generation-history-panel .mwh-card.wide{grid-column:1/-1;}
  #generation-history-panel .mwh-aggregate-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;color:#9aa3b6;font-size:12px;letter-spacing:.07em;text-transform:uppercase;margin-bottom:10px;}
  #generation-history-panel .mwh-aggregate-head strong{color:#00ffff;font-size:14px;}
  #generation-history-panel .mwh-row{display:grid;grid-template-columns:120px 1fr 90px;gap:8px;align-items:center;margin:7px 0;color:#d8deeb;font-size:12px;}
  #generation-history-panel .mwh-track{height:9px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;}
  #generation-history-panel .mwh-track i{display:block;height:100%;border-radius:999px;box-shadow:0 0 10px currentColor;}
  #generation-history-panel .mwh-value{text-align:right;color:#f5f7fb;}
  #generation-history-panel .mwh-mini-chart{height:180px;display:flex;align-items:flex-end;gap:3px;border-left:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08);padding:8px;}
  #generation-history-panel .mwh-col{flex:1;height:100%;display:flex;align-items:flex-end;min-width:4px;}
  #generation-history-panel .mwh-col i{display:block;width:100%;min-height:2px;border-radius:3px 3px 0 0;box-shadow:0 0 8px rgba(0,255,255,.25);}
  #generation-history-panel .mwh-split{height:42px;display:flex;overflow:hidden;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:#05070c;color:#05070c;font-size:12px;font-weight:bold;text-transform:uppercase;}
  #generation-history-panel .mwh-split div:first-child{background:#f5c518;display:flex;align-items:center;justify-content:center;min-width:42px;}
  #generation-history-panel .mwh-split div:last-child{background:#00d0ff;display:flex;align-items:center;justify-content:center;min-width:42px;}
  #generation-history-panel .mwh-note-line,.mwh-empty{color:#9aa3b6;font-size:12px;margin-top:10px;letter-spacing:.07em;text-transform:uppercase;}
  #generation-history-panel .ons-generation-placeholder{margin-top:16px;padding:14px;border:1px solid rgba(0,255,255,.28);border-radius:10px;background:rgba(0,255,255,.035);color:#9aa3b6;font-size:12px;line-height:1.55;letter-spacing:.07em;text-transform:uppercase;}
  #generation-history-panel .ons-generation-placeholder strong{display:block;color:#00ffff;font-size:13px;margin-bottom:8px;letter-spacing:.12em;}
  #generation-history-panel .ons-generation-placeholder .placeholder-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px;}
  #generation-history-panel .ons-generation-placeholder .placeholder-card{border:1px solid rgba(255,255,255,.08);background:rgba(5,7,12,.72);border-radius:8px;padding:10px;min-height:58px;}
  #generation-history-panel .ons-generation-placeholder .placeholder-card b{display:block;color:#f5f7fb;font-size:16px;margin-top:4px;}
  #generation-history-panel .ons-generation-placeholder a{color:#00ffff;}
  @media(max-width:850px){
    #generation-history-panel #generation-history-canvas{min-height:420px!important;height:52dvh!important;}
    #generation-history-panel .price-history-actions{align-items:stretch;}
    #generation-history-panel .price-history-date-label{width:100%;justify-content:space-between;}
    #generation-history-panel .price-history-date-label select,
    #generation-history-panel .price-history-date-label input{flex:1;min-width:0;}
    #generation-history-panel .ons-generation-placeholder .placeholder-grid,#generation-history-panel .mwh-grid{grid-template-columns:1fr;}
    #generation-history-panel .mwh-row{grid-template-columns:90px 1fr 76px;font-size:11px;}
    #generation-history-panel .mwh-card.wide{grid-column:auto;}
  }
</style>

<div class="scada-grid v6-app" id="generation-history-module">
  <header class="scada-hero">
    <div class="scada-subtitle">GLOBALGRID2050 · ISOLATED V6 MODULE</div>
    <h1 class="scada-title">GB Generation History by Technology</h1>
    <div class="scada-title-rule"></div>
  </header>

  <p class="scada-intro"><strong>Separate module.</strong> The primary view now uses small MWh aggregate files. Raw Elexon and PVLive data is processed in GitHub Actions, then discarded before commit.</p>

  <section id="generation-history-panel">
    <h2 class="section-title">Generation History</h2>
    <div class="trend-panel">
      <div class="mwh-panel">
        <div class="mwh-controls"><strong>Generation output in MWh</strong><label>Technology <select id="generation-mwh-technology"></select></label></div>
        <div id="generation-mwh-status" class="mwh-status">Loading aggregate files.</div>
        <div class="mwh-grid">
          <div class="mwh-card wide" id="generation-mwh-annual"></div>
          <div class="mwh-card" id="generation-mwh-monthly"></div>
          <div class="mwh-card" id="generation-mwh-daynight"></div>
        </div>
      </div>

      <details class="price-history-discovery" open>
        <summary>Secondary engineering MW view</summary>
        <div class="price-history-actions">
          <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Generation history in MW</strong>
          <label class="price-history-date-label">Technology <select id="generation-history-technology"></select></label>
          <label class="price-history-date-label">Year <select id="generation-history-year"></select></label>
          <label class="price-history-date-label">Start <input type="date" id="generation-history-start"></label>
          <label class="price-history-date-label">Period <select id="generation-history-period">
            <option value="12hday">12 hours day</option><option value="12hnight">12 hours night</option><option value="24h">24 hours</option><option value="48h">48 hours</option><option value="7d">1 week</option><option value="30d">1 month</option><option value="3m">3 months</option><option value="6m">6 months</option><option value="12m" selected>12 months</option><option value="5y">5 years</option><option value="10y">10 years</option>
          </select></label>
        </div>
        <div id="generation-history-range-status" class="price-history-range-status">Selected range will appear here.</div>
        <canvas id="generation-history-canvas" width="900" height="720"></canvas>
        <div class="generation-source-warning"><strong>Source transparency:</strong> Historic MW generation uses Elexon FUELHH transmission-metered generation. It excludes most embedded distribution generation. Historic solar from this source is not national solar output and may show no records. Recent short-term views remain for grid behaviour. For grid-scale solar capacity and project intelligence, use the GlobalGrid2050 solar pipeline, currently showing 52,866 MW across 2,667 projects above 1 MW. Embedded or national solar output will be added as a separate layer.</div>
      </details>

      <div class="ons-generation-placeholder" id="ons-generation-placeholder">
        <strong>Annual MWh energy accounting layer</strong>
        ONS energy use data belongs here as a separate MWh app, not inside the Elexon MW chart. It will support primary energy, final energy, fossil replacement and electrification analysis.
        <div class="placeholder-grid">
          <div class="placeholder-card">Annual MWh by source<b>Scaffold</b></div>
          <div class="placeholder-card">ONS workbook/API automation<b>Annual</b></div>
          <div class="placeholder-card">Standalone MWh app<b><a href="/uk_energy_tracking_v6/generation_history/mwh_energy_use/">Open</a></b></div>
        </div>
      </div>
    </div>
  </section>
</div>

<script src="/uk_energy_tracking_v6/generation_history/live-config.js?v=20260608mwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/load_generation_mwh_aggregates.js?v=20260608mwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/render_generation_mwh_aggregates.js?v=20260608mwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/control_generation_mwh_aggregates.js?v=20260608mwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/load_generation_history_data.js?v=20260608mwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/render_generation_history_chart.js?v=20260608mwh1"></script>
<script src="/uk_energy_tracking_v6/generation_history/control_generation_history.js?v=20260608mwh1"></script>
