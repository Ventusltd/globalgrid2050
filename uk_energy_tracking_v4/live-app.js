// V4 live tracker app boot and refresh loop. Load last.
function ensureSummaryPanel(){
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
