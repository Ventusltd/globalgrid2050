// V4 live tracker app boot and refresh loop. Load last.
function ensureSummaryStyle(){
  if(document.getElementById('v4-live-summary-style')) return;
  var s=document.createElement('style');
  s.id='v4-live-summary-style';
  s.textContent='\n.scada-gauges{display:none!important;}\n.scada-live-summary{border:1px solid var(--gg-cyan,#00ffff);background:rgba(0,255,255,.045);border-radius:6px;padding:14px;margin:18px 0 22px;box-shadow:0 0 18px rgba(0,255,255,.08);font-family:"Courier New",monospace;}\n.scada-summary-title{color:var(--gg-cyan,#00ffff);text-transform:uppercase;letter-spacing:.14em;font-size:13px;margin-bottom:12px;}\n.scada-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}\n.scada-summary-grid div{border:1px solid var(--gg-line,#252b36);background:rgba(255,255,255,.025);border-radius:4px;padding:10px 12px;}\n.scada-summary-grid span{display:block;color:var(--gg-muted,#9aa3b6);text-transform:uppercase;letter-spacing:.14em;font-size:10px;margin-bottom:5px;}\n.scada-summary-grid strong{display:inline-block;color:var(--gg-text,#f5f7fb);font-size:24px;line-height:1.1;margin-right:6px;}\n.scada-summary-grid em{font-style:normal;color:var(--gg-muted,#9aa3b6);font-size:11px;}\n.scada-summary-time{margin-top:10px;color:var(--gg-muted,#9aa3b6);font-size:11px;line-height:1.45;}\n@media(max-width:700px){.scada-summary-grid{grid-template-columns:1fr}.scada-summary-grid strong{font-size:22px}}\n';
  document.head.appendChild(s);
}
function ensureSummaryPanel(){
  ensureSummaryStyle();
  var existing=document.getElementById('scada-live-summary');
  if(existing) return existing;
  var gauges=document.querySelector('.scada-gauges');
  var panel=document.createElement('section');
  panel.id='scada-live-summary';
  panel.className='scada-live-summary';
  panel.innerHTML='<div class="scada-summary-title">Live electricity snapshot</div>'+
    '<div class="scada-summary-grid">'+
    '<div><span>Demand</span><strong id="summary-demand">—</strong><em>GW</em></div>'+
    '<div><span>Price</span><strong id="summary-price">—</strong><em>£/MWh</em></div>'+
    '<div><span>Carbon</span><strong id="summary-carbon">—</strong><em>g/kWh</em></div>'+
    '</div>'+
    '<div class="scada-summary-time" id="summary-timestamps">Awaiting source timestamps.</div>';
  if(gauges&&gauges.parentNode){gauges.parentNode.insertBefore(panel,gauges);}
  else{document.getElementById('scada-grid').appendChild(panel);}
  return panel;
}
function refresh(){
    Promise.all([getJSON(ENERGY),getJSON(PRICE),getJSON(OIL),getJSON(OIL_HISTORY),getJSON(FUEL),getJSON(EV_PRICES)]).then(function(res){
      var e=res[0]||{}, p=res[1]||{}, oil=res[2]||{}, hist=res[3], fuel=res[4]||{}, ev=res[5]||{};
      ensureSummaryPanel();
      renderGauge("demand", e.demandGW); renderGauge("price", p.priceGBPperMWh); renderGauge("carbon", carbonValue(p));
      if(e.mix) renderMix(e.mix); renderCommodities(oil,fuel); renderEvPrices(ev); if(hist) drawOilTrend(hist);
      var latest=latestIso(e.updated,p.updated,oil.updated);
      setText("m-updated-time",timeLabel(latest));
      setText("m-updated-meta",latest?dateLabel(latest)+" · energy "+timeLabel(e.updated)+" · price and carbon "+timeLabel(p.updated)+" · commodities "+timeLabel(oil.updated):"Energy, price, carbon and commodity timestamps will appear here.");
      setText("summary-demand",e.demandGW==null?"—":fmt(e.demandGW,2));
      setText("summary-price",p.priceGBPperMWh==null?"—":fmt(p.priceGBPperMWh,2));
      setText("summary-carbon",carbonValue(p)==null?"—":Math.round(carbonValue(p)));
      setText("summary-timestamps",latest?"Latest combined update: "+dateLabel(latest)+" · energy "+timeLabel(e.updated)+" · price and carbon "+timeLabel(p.updated)+" · commodities "+timeLabel(oil.updated):"Awaiting source timestamps.");
      var s=document.getElementById("scada-status"), mins=ageMin(e.updated);
      if(mins>20){s.textContent="Mix feed is "+Math.round(mins)+" minutes old. It may be stale.";s.className="scada-status stale";}
      else if(e.updated){s.textContent="Data diagnostics recorded in JSON feeds. Energy, price, carbon and commodity source health are being tracked.";s.className="scada-status";}
      else{s.textContent="Live feed unavailable. Awaiting first data write.";s.className="scada-status stale";}
    });
  }
  document.getElementById("oil-range").addEventListener("change", function(){ getJSON(OIL_HISTORY).then(drawOilTrend); });
  parseMarketInputs(); ensureSummaryPanel(); refresh(); setInterval(refresh, POLL);
