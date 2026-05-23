---
layout: page
title: UK Live Grid Tracker
permalink: /uk_energy_tracking/
---

<style>
.scada-grid { font-family: "Courier New", monospace; }
.scada-metrics { display:flex; flex-wrap:wrap; gap:18px; margin:18px 0; }
.scada-card { flex:1 1 160px; border:1px solid #00ffff; border-radius:4px;
  background:rgba(0,255,255,0.05); padding:14px 16px; }
.scada-card .val { font-size:30px; font-weight:bold; color:#00ffff; letter-spacing:-1px; }
.scada-card .val .u { font-size:15px; color:#7fdfff; font-weight:normal; }
.scada-card .lab { font-size:13px; color:#a6adbb; margin-top:4px; text-transform:uppercase; }
.scada-bar-name { display:flex; justify-content:space-between; font-size:14px; margin:10px 0 4px; }
.scada-bar-name b { color:#e8e8f0; font-weight:normal; }
.scada-bar-name span { color:#7fdfff; font-variant-numeric:tabular-nums; }
.scada-track { height:7px; border-radius:4px; background:rgba(255,255,255,0.08); overflow:hidden; }
.scada-fill { height:100%; border-radius:4px; transition:width .6s ease; }
.scada-status { font-size:12px; color:#a6adbb; margin-top:14px; }
.scada-status.stale { color:#ffb020; }
.scada-credit { font-size:12px; color:#a6adbb; margin-top:10px; line-height:1.5; }
.scada-credit a { color:#7fdfff; }
</style>

# UK Live Grid Tracker

Near-real-time GB electricity demand, market price, carbon intensity and generation mix.
Generation mix refreshes every 5 minutes; price and carbon update every half hour (their native cadence).

<div class="scada-grid" id="scada-grid">
  <div class="scada-metrics">
    <div class="scada-card"><div class="val" id="m-demand">—<span class="u"> GW</span></div><div class="lab">Electricity demand</div></div>
    <div class="scada-card"><div class="val" id="m-price">£—<span class="u">/MWh</span></div><div class="lab">Electricity price</div></div>
    <div class="scada-card"><div class="val" id="m-carbon">—<span class="u"> g/kWh</span></div><div class="lab">Carbon emissions</div></div>
  </div>
  <div id="scada-mix"></div>
  <div class="scada-status" id="scada-status">Loading live feed…</div>
</div>

<script>
(function(){
  var ENERGY="./live_grid_energy.json", PRICE="./live_grid_price.json", POLL=5*60*1000;
  function fmt(n,dp){return (n===null||n===undefined||isNaN(n))?"\u2014":Number(n).toFixed(dp==null?2:dp);}
  function renderMix(mix){
    var w=document.getElementById("scada-mix"); if(!Array.isArray(mix)){return;}
    w.innerHTML=mix.map(function(r){
      var width=Math.max(0,Math.min(100,Math.abs(r.pct)));
      return '<div class="scada-bar-name"><b>'+r.label+'</b><span>'+fmt(r.gw)+' GW &nbsp; '+fmt(r.pct)+'%</span></div>'+
        '<div class="scada-track"><div class="scada-fill" style="width:'+width+'%;background:'+r.color+'"></div></div>';
    }).join("");
  }
  function ageMin(iso){return iso?(Date.now()-new Date(iso).getTime())/60000:Infinity;}
  function getJSON(u){return fetch(u+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return null;});}
  function refresh(){
    Promise.all([getJSON(ENERGY),getJSON(PRICE)]).then(function(res){
      var e=res[0]||{}, p=res[1]||{};
      if(e.demandGW!=null) document.getElementById("m-demand").innerHTML=fmt(e.demandGW)+'<span class="u"> GW</span>';
      document.getElementById("m-price").innerHTML='£'+(p.priceGBPperMWh==null?"\u2014":fmt(p.priceGBPperMWh))+'<span class="u">/MWh</span>';
      document.getElementById("m-carbon").innerHTML=(p.carbonGperKWh==null?"\u2014":Math.round(p.carbonGperKWh))+'<span class="u"> g/kWh</span>';
      if(e.mix) renderMix(e.mix);
      var s=document.getElementById("scada-status"), mins=ageMin(e.updated);
      if(mins>20){s.textContent="Mix feed is "+Math.round(mins)+" min old \u2014 may be stale.";s.className="scada-status stale";}
      else if(e.updated){s.textContent="Mix updated "+new Date(e.updated).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+" \u00b7 price/carbon updated "+(p.updated?new Date(p.updated).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"\u2014");s.className="scada-status";}
      else{s.textContent="Live feed unavailable \u2014 awaiting first data write.";s.className="scada-status stale";}
    });
  }
  refresh(); setInterval(refresh, POLL);
})();
</script>

## Data sources & attribution

This tracker uses three free public sources. We gratefully acknowledge them:

- **Generation mix & demand** — Elexon BMRS Insights (Balancing Mechanism Reporting Service), used under the BMRS Data Licence Terms.
- **Carbon intensity** — National Energy System Operator [Carbon Intensity API](https://carbonintensity.org.uk/), developed with the Environmental Defense Fund, University of Oxford and WWF. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Solar generation** — [Sheffield Solar PV_Live](https://www.solar.sheffield.ac.uk/api/), University of Sheffield.

Indicative near-real-time values for screening and situational awareness only. No representation is made that the data is accurate or complete.
