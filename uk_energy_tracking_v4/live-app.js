// V4 live tracker app boot and refresh loop. Load last.
function refresh(){
    Promise.all([getJSON(ENERGY),getJSON(PRICE),getJSON(OIL),getJSON(OIL_HISTORY),getJSON(FUEL),getJSON(EV_PRICES)]).then(function(res){
      var e=res[0]||{}, p=res[1]||{}, oil=res[2]||{}, hist=res[3], fuel=res[4]||{}, ev=res[5]||{};
      renderGauge("demand", e.demandGW); renderGauge("price", p.priceGBPperMWh); renderGauge("carbon", carbonValue(p));
      if(e.mix) renderMix(e.mix); renderCommodities(oil,fuel); renderEvPrices(ev); if(hist) drawOilTrend(hist);
      var latest=latestIso(e.updated,p.updated,oil.updated);
      document.getElementById("m-updated-time").textContent=timeLabel(latest);
      document.getElementById("m-updated-meta").textContent=(latest?dateLabel(latest)+" · energy "+timeLabel(e.updated)+" · price and carbon "+timeLabel(p.updated)+" · commodities "+timeLabel(oil.updated):"Energy, price, carbon and commodity timestamps will appear here.");
      var s=document.getElementById("scada-status"), mins=ageMin(e.updated);
      if(mins>20){s.textContent="Mix feed is "+Math.round(mins)+" minutes old. It may be stale.";s.className="scada-status stale";}
      else if(e.updated){s.textContent="Data diagnostics recorded in JSON feeds. Energy, price, carbon and commodity source health are being tracked.";s.className="scada-status";}
      else{s.textContent="Live feed unavailable. Awaiting first data write.";s.className="scada-status stale";}
    });
  }
  document.getElementById("oil-range").addEventListener("change", function(){ getJSON(OIL_HISTORY).then(drawOilTrend); });
  parseMarketInputs(); refresh(); setInterval(refresh, POLL);
