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
  #generation-history-panel .price-history-actions::after{content:"Recent and historic generation output by technology";display:block;width:100%;color:var(--gg-muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px;}
  #generation-history-panel #generation-history-canvas{height:min(76dvh,760px)!important;min-height:520px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:6px;}
  #generation-history-panel .generation-study-summary{margin:0 0 14px;padding:12px 14px;border:1px solid rgba(0,255,255,.36);border-radius:10px;background:rgba(0,255,255,.045);color:#9aa3b6;font-size:12px;line-height:1.55;letter-spacing:.06em;text-transform:uppercase;}
  #generation-history-panel .generation-study-summary strong{display:block;color:#00ffff;margin-bottom:6px;letter-spacing:.12em;}
  #generation-history-panel .generation-study-summary a{color:#00ffff;text-decoration:underline;font-weight:bold;}
  #generation-history-panel .generation-source-warning{margin:12px 0 0;padding:12px 14px;border:1px solid rgba(255,64,64,.72);border-radius:8px;background:rgba(80,0,0,.18);color:#ff5555;font-size:12px;line-height:1.55;letter-spacing:.06em;text-transform:uppercase;}
  #generation-history-panel .generation-source-warning strong{color:#ff3333;}
  #generation-history-panel .generation-source-warning a{color:#ff7777;text-decoration:underline;font-weight:bold;}
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

  #generation-history-panel .solar-daily-mwh-panel{margin:18px 0 20px;padding:16px;border:1px solid rgba(0,255,255,.34);border-radius:12px;background:rgba(0,255,255,.04);}
  #generation-history-panel .solar-daily-mwh-panel.standalone{box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 0 22px rgba(0,255,255,.05);}
  #generation-history-panel .solar-daily-mwh-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0 12px;color:#9aa3b6;font-size:12px;letter-spacing:.08em;text-transform:uppercase;}
  #generation-history-panel .solar-daily-mwh-controls strong{color:#00ffff;letter-spacing:.12em;}
  #generation-history-panel .solar-daily-mwh-controls label{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  #generation-history-panel .solar-daily-mwh-controls select,#generation-history-panel .solar-daily-mwh-controls input{min-height:38px;background:#05070c;color:#00ffff;border:1px solid #252b36;border-radius:6px;padding:6px;max-width:100%;}
  #generation-history-panel #solar-daily-mwh-canvas{height:min(76dvh,760px)!important;min-height:560px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:8px;}
  @media(max-width:850px){#generation-history-panel .solar-daily-mwh-controls{align-items:stretch;}#generation-history-panel .solar-daily-mwh-controls label{width:100%;justify-content:space-between;}#generation-history-panel .solar-daily-mwh-controls select,#generation-history-panel .solar-daily-mwh-controls input{flex:1;min-width:0;}#generation-history-panel #solar-daily-mwh-canvas{height:70dvh!important;min-height:560px!important;}}

  #generation-history-panel .solar-daily-mwh-fullscreen-btn{border:1px solid #00ffff;border-radius:9px;padding:8px 11px;background:#051014;color:#00ffff;font-family:Courier New,Courier,monospace;font-weight:bold;cursor:pointer;}
  .solar-mwh-fullscreen-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:none;padding:10px;}
  .solar-mwh-fullscreen-overlay.open{display:block;}
  .solar-mwh-fullscreen-shell{height:100%;display:flex;flex-direction:column;border:1px solid rgba(0,255,255,.45);border-radius:12px;background:#05070c;box-shadow:0 0 30px rgba(0,255,255,.16);overflow:hidden;}
  .solar-mwh-fullscreen-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px;border-bottom:1px solid rgba(0,255,255,.24);color:#9aa3b6;font-family:Courier New,Courier,monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;}
  .solar-mwh-fullscreen-toolbar strong{color:#00ffff;letter-spacing:.12em;}
  .solar-mwh-fullscreen-toolbar select,.solar-mwh-fullscreen-toolbar button{background:#05070c;color:#00ffff;border:1px solid #252b36;border-radius:7px;min-height:36px;padding:6px;font-family:Courier New,Courier,monospace;}
  #solar-daily-mwh-fullscreen-close{margin-left:auto;font-size:22px;line-height:1;padding:3px 10px;border-color:#ff5555;color:#ff5555;}
  #solar-daily-mwh-fullscreen-canvas{flex:1;width:100%;height:100%;min-height:420px;background:#05070c;display:block;touch-action:none;}
  .solar-mwh-fullscreen-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:10000;border:1px solid rgba(0,255,255,.5);background:rgba(5,7,12,.72);color:#00ffff;border-radius:999px;width:42px;height:42px;font-size:30px;line-height:1;}
  .solar-mwh-fullscreen-arrow-left{left:18px;}
  .solar-mwh-fullscreen-arrow-right{right:18px;}
  .solar-mwh-fullscreen-smallprint{border-top:1px solid rgba(0,255,255,.18);padding:9px 12px;color:#9aa3b6;font-family:Courier New,Courier,monospace;font-size:11px;line-height:1.45;letter-spacing:.04em;text-transform:uppercase;}
  .solar-mwh-inspect-controls{display:none;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 0 0;font-family:Courier New,Courier,monospace;}
  .solar-mwh-inspect-button{border:1px solid #00ffff;border-radius:10px;padding:9px 12px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold;cursor:pointer;}
  .solar-mwh-inspect-readout{flex:1;min-width:260px;color:#00ff88;border:1px solid rgba(0,255,255,.25);border-radius:10px;padding:9px 11px;background:#080b10;line-height:1.35;}
  @media(max-width:700px){.solar-mwh-inspect-controls[style]{display:grid!important;grid-template-columns:1fr 1fr;align-items:stretch}.solar-mwh-inspect-readout{grid-column:1 / 3;min-width:0}.solar-mwh-inspect-button{width:100%;text-align:center}.solar-mwh-fullscreen-toolbar{align-items:stretch}.solar-mwh-fullscreen-toolbar label{width:100%;}.solar-mwh-fullscreen-toolbar select{width:100%;}#solar-daily-mwh-fullscreen-close{margin-left:0;}}
</style>

<div class="scada-grid v6-app" id="generation-history-module">
  <header class="scada-hero">
    <div class="scada-subtitle">GLOBALGRID2050 · ISOLATED V6 MODULE</div>
    <h1 class="scada-title">GB Generation History by Technology</h1>
    <div class="scada-title-rule"></div>
  </header>

  <p class="scada-intro"><strong>Separate module.</strong> Recent views show short term generation movement. Historic views use settled Elexon FUELHH daily MW facts where available.</p>

  <section id="generation-history-panel">
    <h2 class="section-title">Generation History</h2>
    <div class="trend-panel">
      <div class="generation-study-summary"><strong>Deep study summary</strong> This MW chart is the operating pulse. Recent views use 30 minute generation movement for grid behaviour and balancing studies. Historic views use settled FUELHH transmission metered data for non solar fuels. Solar uses a separate Sheffield Solar PVLive output layer, while the <a href="/uk_renewables_pipeline/dashboard.html">Solar Pipeline</a> gives grid scale project and capacity intelligence. Full study: <a href="/uk_energy_tracking_v6/generation_history/deep_studies/2026-06-09-fuelhh-solar-mw-integration.md">FUELHH Solar MW Integration</a>.</div>
      <div class="mwh-panel">
        <div class="mwh-controls"><strong>Generation output in MWh</strong><label>Technology <select id="generation-mwh-technology"></select></label></div>
        <div id="generation-mwh-status" class="mwh-status">Loading aggregate files.</div>
        <div class="mwh-grid">
          <div class="mwh-card wide" id="generation-mwh-annual"></div>
          <div class="mwh-card" id="generation-mwh-monthly"></div>
          <div class="mwh-card" id="generation-mwh-daynight"></div>
        </div>
      </div>


      <div class="solar-daily-mwh-panel standalone" id="solar-daily-mwh-panel">
        <div class="generation-study-summary"><strong>Daily generation energy output</strong> Standalone daily MWh chart. Solar uses stored Sheffield Solar PVLive daily MWh. Elexon technologies use audited FUELHH derived daily MWh calculated from half hourly MW values multiplied by 0.5 hours. This chart presents total energy across each full day, not peak MW or average MW.</div>
        <div class="solar-daily-mwh-controls">
          <strong>Daily energy chart</strong>
          <button type="button" id="solar-daily-mwh-fullscreen-btn" class="solar-daily-mwh-fullscreen-btn">Full screen chart</button>
          <label>Technology <select id="solar-daily-mwh-technology"><option value="Solar" selected>Solar</option></select></label>
          <label>Year <select id="solar-daily-mwh-year"></select></label>
          <label>Start <input type="date" id="solar-daily-mwh-start"></label>
          <label>Period <select id="solar-daily-mwh-period"><option value="30d">1 month</option><option value="3m">3 months</option><option value="6m">6 months</option><option value="12m" selected>12 months</option><option value="5y">5 years</option><option value="10y">10 years</option><option value="all">Full PVLive file</option></select></label>
        </div>
        <div id="solar-daily-mwh-status" class="price-history-range-status">Daily MWh chart awaiting selected technology data.</div>
        <canvas id="solar-daily-mwh-canvas" width="1200" height="760"></canvas>
      </div>

      <details class="price-history-discovery" open>
        <summary>Generation output by technology</summary>
        <div class="price-history-actions">
          <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Generation output</strong>
          <label class="price-history-date-label">Technology <select id="generation-history-technology"></select></label>
          <label class="price-history-date-label">Year <select id="generation-history-year"></select></label>
          <label class="price-history-date-label">Start <input type="date" id="generation-history-start"></label>
          <label class="price-history-date-label">Period <select id="generation-history-period">
            <option value="12hday">12 hours day</option><option value="12hnight">12 hours night</option><option value="24h">24 hours</option><option value="48h">48 hours</option><option value="7d">1 week</option><option value="30d">1 month</option><option value="3m">3 months</option><option value="6m">6 months</option><option value="12m" selected>12 months</option><option value="5y">5 years</option><option value="10y">10 years</option>
          </select></label>
        </div>
        <div id="generation-history-range-status" class="price-history-range-status">Selected range will appear here.</div>
        <canvas id="generation-history-canvas" width="900" height="720"></canvas>


        <div class="generation-source-warning"><strong>Source transparency:</strong> Historic MW generation uses Elexon FUELHH transmission-metered generation for non solar technologies. It excludes most embedded distribution generation. Solar output is routed through a separate Sheffield Solar PVLive candidate layer, solar.sheffield.ac.uk, and is stamped as a PVLive embedded estimate. For grid-scale solar capacity and project intelligence, use the <a href="/uk_renewables_pipeline/dashboard.html">GlobalGrid2050 solar pipeline</a>, currently showing 52,866 MW across 2,667 projects above 1 MW.</div>
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

<div id="solar-daily-mwh-fullscreen-overlay" class="solar-mwh-fullscreen-overlay" aria-hidden="true">
  <div class="solar-mwh-fullscreen-shell">
    <div class="solar-mwh-fullscreen-toolbar">
      <strong>Daily MWh by technology</strong>
      <label>Period <select id="solar-daily-mwh-fullscreen-period-select"><option value="30d">1 month</option><option value="3m">3 months</option><option value="6m">6 months</option><option value="12m" selected>12 months</option><option value="5y">5 years</option><option value="10y">10 years</option><option value="all">Full PVLive file</option></select></label>
      <span id="solar-daily-mwh-fullscreen-meta">Selected range will appear here.</span>
      <button type="button" id="solar-daily-mwh-fullscreen-close" aria-label="Close">x</button>
    </div>
    <button type="button" id="solar-daily-mwh-fullscreen-period-back" class="solar-mwh-fullscreen-arrow solar-mwh-fullscreen-arrow-left" aria-label="Previous period">‹</button>
    <button type="button" id="solar-daily-mwh-fullscreen-period-forward" class="solar-mwh-fullscreen-arrow solar-mwh-fullscreen-arrow-right" aria-label="Next period">›</button>
    <canvas id="solar-daily-mwh-fullscreen-canvas"></canvas>
    <section class="solar-mwh-fullscreen-smallprint" aria-label="Solar daily MWh explainer">
      <strong>Source:</strong> Solar uses Sheffield Solar PVLive stored daily MWh. Other technologies use Elexon FUELHH derived daily MWh after chart wiring. This chart shows daily energy, not MW peak power or average MW.
    </section>
  </div>
</div>

<script src="/uk_energy_tracking_v6/generation_history/live-config.js?v=20260610solarui1"></script>
<script src="/uk_energy_tracking_v6/generation_history/load_generation_mwh_aggregates.js?v=20260610solarui1"></script>
<script src="/uk_energy_tracking_v6/generation_history/render_generation_mwh_aggregates.js?v=20260610solarui1"></script>
<script src="/uk_energy_tracking_v6/generation_history/control_generation_mwh_aggregates.js?v=20260610solarui1"></script>
<script src="/uk_energy_tracking_v6/generation_history/load_generation_history_data.js?v=20260610solarui1"></script>
<script src="/uk_energy_tracking_v6/generation_history/render_generation_history_chart.js?v=20260610solarui1"></script>
<script src="/uk_energy_tracking_v6/generation_history/control_generation_history.js?v=20260610solarui1"></script>

<script src="/uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js?v=20260611mwhmulti1"></script>
<script src="/uk_energy_tracking_v6/generation_history/control_solar_daily_mwh_chart.js?v=20260611mwhmulti1"></script>
