---
layout: page
title: UK Live Grid Tracker
permalink: /uk_energy_tracking/
---

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
.scada-grid { font-family: "Courier New", monospace; max-width: 1180px; margin: 0 auto; }
.scada-hero { border-bottom: 1px solid var(--gg-line); padding: 18px 0 16px; margin-bottom: 22px; }
.scada-kicker { letter-spacing: .38em; font-weight: 700; color: var(--gg-text); font-size: clamp(20px, 5vw, 42px); text-transform: uppercase; }
.scada-subtitle { letter-spacing: .28em; color: var(--gg-muted); font-size: 12px; text-transform: uppercase; margin-top: 4px; }
.scada-live-row { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-top:16px; }
.scada-live-pill { border: 1px solid #1b6b4c; color: var(--gg-green); background: rgba(0,255,136,.06); padding: 10px 14px; border-radius: 4px; text-transform: uppercase; letter-spacing: .18em; font-size: 12px; }
.scada-live-dot { display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--gg-green); box-shadow:0 0 14px var(--gg-green); margin-right:8px; }
.scada-update-panel { flex: 1 1 260px; border:1px solid var(--gg-cyan); background:rgba(0,255,255,.05); border-radius:4px; padding:10px 14px; box-shadow:0 0 18px rgba(0,255,255,.08); }
.scada-update-label { color: var(--gg-muted); font-size:11px; text-transform:uppercase; letter-spacing:.18em; }
.scada-update-time { color: var(--gg-cyan); font-size: clamp(20px, 5vw, 34px); font-weight: 800; line-height: 1.1; margin-top: 4px; }
.scada-update-meta { color: var(--gg-muted); font-size: 11px; margin-top: 2px; }
.scada-intro { color: var(--gg-muted); font-size: 14px; line-height:1.55; margin-bottom:22px; max-width:900px; }
.scada-gauges { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:18px; margin: 18px 0 22px; }
.scada-gauge-card { background: var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:18px 16px; min-height:220px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.02); }
.scada-gauge-title { color: var(--gg-muted); text-align:center; text-transform:uppercase; letter-spacing:.18em; font-size:12px; font-weight:700; min-height:34px; }
.scada-gauge { width:100%; max-width:260px; margin: 8px auto 0; display:block; }
.scada-gauge-bg { fill:none; stroke:#1d2330; stroke-width:18; stroke-linecap:round; }
.scada-gauge-fill { fill:none; stroke-width:18; stroke-linecap:round; filter: drop-shadow(0 0 8px currentColor); transition: stroke-dasharray .6s ease; }
.scada-gauge-value { fill: var(--gg-text); font-size:24px; font-weight:800; text-anchor:middle; dominant-baseline:middle; }
.scada-gauge-unit { fill: var(--gg-muted); font-size:9px; text-anchor:middle; text-transform:uppercase; }
.scada-mix-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:14px; margin-top:18px; }
.scada-mini { background:var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:12px 12px 10px; }
.scada-mini-top { display:flex; justify-content:space-between; gap:10px; align-items:baseline; }
.scada-mini-name { color:var(--gg-text); text-transform:uppercase; letter-spacing:.12em; font-size:12px; }
.scada-mini-value { color:var(--gg-cyan); font-size:13px; white-space:nowrap; }
.scada-mini-track { height:8px; border-radius:5px; background:rgba(255,255,255,.08); overflow:hidden; margin-top:10px; }
.scada-mini-fill { height:100%; border-radius:5px; transition:width .6s ease; }
.scada-status { font-size:12px; color:var(--gg-muted); margin-top:18px; border:1px solid var(--gg-line); background:rgba(255,255,255,.03); padding:10px 12px; border-radius:4px; }
.scada-status.stale { color:var(--gg-orange); border-color:var(--gg-orange); }
.scada-credit { font-size:12px; color:var(--gg-muted); margin-top:22px; line-height:1.5; }
.scada-credit h2 { color:var(--gg-cyan); font-size:20px; letter-spacing:.06em; text-transform:uppercase; }
@media (max-width: 850px) { .scada-gauges { grid-template-columns:1fr; } .scada-mix-grid { grid-template-columns:1fr; } .scada-gauge-card { min-height:190px; } }
</style>

<div class="scada-grid" id="scada-grid">
  <header class="scada-hero">
    <div class="scada-kicker">GLOBALGRID2050</div>
    <div class="scada-subtitle">UK LIVE GRID TRACKER</div>
    <div class="scada-live-row">
      <div class="scada-live-pill"><span class="scada-live-dot"></span>LIVE GRID SOURCE</div>
      <div class="scada-update-panel">
        <div class="scada-update-label">Latest data update</div>
        <div class="scada-update-time" id="m-updated-time">Awaiting feed</div>
        <div class="scada-update-meta" id="m-updated-meta">Energy, price and carbon timestamps will appear here.</div>
      </div>
    </div>
  </header>

  <p class="scada-intro">Near-real-time GB electricity demand, market price, carbon intensity and generation mix. Generation mix refreshes every 5 minutes; price and carbon update every half hour at their native cadence.</p>

  <section class="scada-gauges">
    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Demand</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="demand"></svg></div>
    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Price</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="price"></svg></div>
    <div class="scada-gauge-card"><div class="scada-gauge-title">Carbon Emissions</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="carbon"></svg></div>
  </section>

  <section>
    <h2 style="color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-size:22px;">Generation Mix</h2>
    <div id="scada-mix" class="scada-mix-grid"></div>
  </section>

  <div class="scada-status" id="scada-status">Loading live feed…</div>

  <section class="scada-credit">
    <h2>Data sources & attribution</h2>
    <p>This tracker uses three free public sources. We gratefully acknowledge them:</p>
    <p><strong>Generation mix & demand</strong> — Elexon BMRS Insights, used under the BMRS Data Licence Terms.</p>
    <p><strong>Carbon intensity</strong> — National Energy System Operator <a href="https://carbonintensity.org.uk/">Carbon Intensity API</a>, developed with the Environmental Defense Fund, University of Oxford and WWF. Licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</p>
    <p><strong>Solar generation</strong> — <a href="https://www.solar.sheffield.ac.uk/api/">Sheffield Solar PV_Live</a>, University of Sheffield.</p>
    <p>Indicative near-real-time values for screening and situational awareness only. No representation is made that the data is accurate or complete.</p>
  </section>
</div>

<script>
(function(){
  var ENERGY="./live_grid_energy.json", PRICE="./live_grid_price.json", POLL=5*60*1000;
  var GAUGES={
    demand:{min:0,max:45,unit:"GW",colour:"#00ffff"},
    price:{min:-50,max:250,unit:"£/MWh",colour:"#ff00e6"},
    carbon:{min:0,max:400,unit:"g/kWh",colour:"#00ff88"}
  };
  function fmt(n,dp){return (n===null||n===undefined||isNaN(n))?"—":Number(n).toFixed(dp==null?2:dp);}
  function pct(n,min,max){ if(n===null||n===undefined||isNaN(n)) return 0; return Math.max(0,Math.min(1,(Number(n)-min)/(max-min))); }
  function arcPath(cx,cy,r,start,end){
    var s=(start-90)*Math.PI/180, e=(end-90)*Math.PI/180;
    var x1=cx+r*Math.cos(s), y1=cy+r*Math.sin(s), x2=cx+r*Math.cos(e), y2=cy+r*Math.sin(e);
    var large=end-start<=180?0:1;
    return "M "+x1+" "+y1+" A "+r+" "+r+" 0 "+large+" 1 "+x2+" "+y2;
  }
  function renderGauge(name,value,label){
    var cfg=GAUGES[name], svg=document.querySelector('[data-gauge="'+name+'"]'); if(!svg) return;
    var p=pct(value,cfg.min,cfg.max), end=-90+(180*p);
    var display=value===null||value===undefined||isNaN(value)?"—":(name==="carbon"?Math.round(value):fmt(value, name==="price"?0:2));
    svg.innerHTML='<path class="scada-gauge-bg" d="'+arcPath(30,115,80,-90,90)+'"></path>'+
      '<path class="scada-gauge-fill" style="color:'+cfg.colour+';stroke:'+cfg.colour+'" d="'+arcPath(30,115,80,-90,end)+'"></path>'+
      '<text class="scada-gauge-value" x="110" y="96">'+display+'</text>'+
      '<text class="scada-gauge-unit" x="110" y="120">'+cfg.unit+'</text>';
  }
  function renderMix(mix){
    var w=document.getElementById("scada-mix"); if(!Array.isArray(mix)){return;}
    w.innerHTML=mix.map(function(r){
      var width=Math.max(0,Math.min(100,Math.abs(r.pct)));
      return '<div class="scada-mini"><div class="scada-mini-top"><div class="scada-mini-name">'+r.label+'</div><div class="scada-mini-value">'+fmt(r.gw)+' GW · '+fmt(r.pct)+'%</div></div>'+
        '<div class="scada-mini-track"><div class="scada-mini-fill" style="width:'+width+'%;background:'+r.color+';box-shadow:0 0 10px '+r.color+'"></div></div></div>';
    }).join("");
  }
  function ageMin(iso){return iso?(Date.now()-new Date(iso).getTime())/60000:Infinity;}
  function timeLabel(iso){return iso?new Date(iso).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"Awaiting feed";}
  function dateLabel(iso){return iso?new Date(iso).toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}):"";}
  function latestIso(a,b){ if(!a) return b; if(!b) return a; return new Date(a)>new Date(b)?a:b; }
  function getJSON(u){return fetch(u+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return null;});}
  function refresh(){
    Promise.all([getJSON(ENERGY),getJSON(PRICE)]).then(function(res){
      var e=res[0]||{}, p=res[1]||{};
      renderGauge("demand", e.demandGW, "Demand");
      renderGauge("price", p.priceGBPperMWh, "Price");
      renderGauge("carbon", p.carbonGperKWh, "Carbon");
      if(e.mix) renderMix(e.mix);
      var latest=latestIso(e.updated,p.updated);
      document.getElementById("m-updated-time").textContent=timeLabel(latest);
      document.getElementById("m-updated-meta").textContent=(latest?dateLabel(latest)+" · energy "+timeLabel(e.updated)+" · price/carbon "+timeLabel(p.updated):"Energy, price and carbon timestamps will appear here.");
      var s=document.getElementById("scada-status"), mins=ageMin(e.updated);
      if(mins>20){s.textContent="Mix feed is "+Math.round(mins)+" min old. It may be stale.";s.className="scada-status stale";}
      else if(e.updated){s.textContent="Energy health: "+JSON.stringify(e.health||{})+" · Price health: "+JSON.stringify(p.health||{});s.className="scada-status";}
      else{s.textContent="Live feed unavailable. Awaiting first data write.";s.className="scada-status stale";}
    });
  }
  refresh(); setInterval(refresh, POLL);
})();
</script>
