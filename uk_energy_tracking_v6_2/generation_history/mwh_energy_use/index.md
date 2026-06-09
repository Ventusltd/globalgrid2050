---
layout: page
title: UK Annual Energy Use MWh Module
permalink: /uk_energy_tracking_v6_2_2/generation_history/mwh_energy_use/
---

<link rel="stylesheet" href="/uk_energy_tracking_v6_2/styles/app.css?v=20260604toolbargrid1">
<style>
  #mwh-energy-use-module .mwh-panel{padding:14px;border:1px solid #252b36;border-radius:10px;background:#070a10;box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 0 22px rgba(0,255,255,.05);}
  #mwh-energy-use-module .mwh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0;}
  #mwh-energy-use-module .mwh-card{border:1px solid rgba(0,255,255,.26);border-radius:10px;background:rgba(0,255,255,.035);padding:12px;color:#9aa3b6;font-size:12px;line-height:1.5;letter-spacing:.07em;text-transform:uppercase;}
  #mwh-energy-use-module .mwh-card strong{display:block;color:#00ffff;font-size:13px;margin-bottom:8px;letter-spacing:.12em;}
  #mwh-energy-use-module .mwh-card b{display:block;color:#f5f7fb;font-size:18px;margin-top:5px;}
  #mwh-energy-use-module .mwh-placeholder-chart{height:360px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:linear-gradient(180deg,rgba(0,255,255,.035),rgba(5,7,12,.92));display:flex;align-items:center;justify-content:center;text-align:center;color:#9aa3b6;font-size:13px;letter-spacing:.08em;text-transform:uppercase;padding:16px;}
  #mwh-energy-use-module .mwh-note{color:#9aa3b6;font-size:13px;line-height:1.6;margin:12px 0;}
  @media(max-width:850px){#mwh-energy-use-module .mwh-grid{grid-template-columns:1fr;}#mwh-energy-use-module .mwh-placeholder-chart{height:300px;}}
</style>

<div class="scada-grid v6_2-app" id="mwh-energy-use-module">
  <header class="scada-hero">
    <div class="scada-subtitle">GLOBALGRID2050 · ONS ENERGY ACCOUNTING MODULE</div>
    <h1 class="scada-title">Annual UK Energy Use in MWh</h1>
    <div class="scada-title-rule"></div>
  </header>

  <section class="mwh-panel">
    <h2 class="section-title">MWh Energy Accounting Placeholder</h2>
    <p class="mwh-note">This standalone module will sit inside the generation history folder but remain separate from the Elexon MW operational chart. It is intended for annual ONS energy use data converted from Mtoe into TWh and MWh.</p>
    <div class="mwh-grid">
      <div class="mwh-card"><strong>Conversion</strong>MWh equals Mtoe multiplied by 11.63 and then by 1,000,000.<b>Ready</b></div>
      <div class="mwh-card"><strong>Dataset</strong>ONS energy use by industry, source and fuel, annual series.<b>Pending import</b></div>
      <div class="mwh-card"><strong>Automation</strong>Annual refresh workflow scaffold for future ONS connector or workbook upload.<b>Scaffold</b></div>
    </div>
    <div class="mwh-placeholder-chart">Future chart area: annual energy use by fuel, sector and activity in MWh. This will support primary energy versus final energy, electrification potential and investor education.</div>
    <p class="mwh-note">Planned outputs: annual MWh by fuel, annual MWh by economic sector, top fossil fuel uses, domestic heat, road transport, power station fuels and electrification replacement scenarios.</p>
    <p class="mwh-note"><a href="/uk_energy_tracking_v6_2_2/generation_history/">Back to generation history</a></p>
  </section>
</div>
