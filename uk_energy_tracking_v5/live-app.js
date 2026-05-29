// V5 live tracker app boot and refresh loop. Load last.
function ensureV6Notice(){
  if(document.getElementById('v5-v6-notice')) return;
  var s=document.createElement('style');
  s.id='v5-v6-notice-style';
  s.textContent='\n.v5-v6-notice{border:1px solid rgba(0,255,255,.45);background:rgba(0,255,255,.055);border-radius:6px;padding:12px 14px;margin:14px 0;color:#f5f7fb;font-family:"Courier New",monospace;line-height:1.45;box-shadow:0 0 14px rgba(0,255,255,.10)}\n.v5-v6-notice strong{color:#00ffff;text-transform:uppercase;letter-spacing:.12em;display:block;margin-bottom:4px}\n.v5-v6-notice a{color:#00ffff;font-weight:800}\n';
  document.head.appendChild(s);
  var grid=document.getElementById('scada-grid');
  if(!grid) return;
  var note=document.createElement('div');
  note.id='v5-v6-notice';
  note.className='v5-v6-notice';
  note.innerHTML='<strong>Modular V6 now available</strong>V5 remains live for reference. The modular development build is now <a href="/uk_energy_tracking_v6/">UK Live Grid Tracker V6</a>.';
  grid.insertBefore(note,grid.firstChild);
}
function ensureSummaryStyle(){
  if(document.getElementById('v5-live-summary-style')) return;
  var s=document.createElement('style');
  s.id='v5-live-summary-style';
  s.textContent='\n.scada-gauges{display:none!important;}\n.scada-live-summary{border:1px solid var(--gg-cyan,#00ffff);background:rgba(0,255,255,.04);border-radius:6px;padding:18px 16px;margin:18px 0 24px;box-shadow:0 0 18px rgba(0,255,255,.08);font-family:"Courier New",monospace;}\n.scada-summary-title{color:var(--gg-cyan,#00ffff);text-transform:uppercase;letter-spacing:.16em;font-size:13px;margin-bottom:16px;text-align:center;}\n.scada-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}\n.scada-summary-grid div{border:1px solid var(--gg-line,#252b36);background:rgba(255,255,255,.025);border-radius:4px;padding:14px 12px;text-align:center;}\n.scada-summary-grid span{display:block;color:var(--gg-muted,#9aa3b6);text-transform:uppercase;letter-spacing:.14em;font-size:10px;margin-bottom:8px;}\n.scada-summary-grid strong{display:inline-block;color:var(--gg-text,#f5f7fb);font-size:clamp(28px,5vw,46px);line-height:1.05;margin-right:6px;}\n.scada-summary-grid em{font-style:normal;color:var(--gg-muted,#9aa3b6);font-size:13px;}\n.scada-summary-time{margin-top:14px;color:var(--gg-muted,#9aa3b6);font-size:11px;line-height:1.45;text-align:center;}\n@media(max-width:700px){.scada-summary-grid{grid-template-columns:1fr}.scada-summary-grid strong{font-size:34px}}\n';
  document.head.appendChild(s);
}
function ensureSummaryPanel(){
  ensureV6Notice();
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
function loadFrequencyModule(){
  if(document.getElementById('frequency-history-ui-script')) return;
  var script=document.createElement('script');
  script.id='frequency-history-ui-script';
  script.src='/uk_energy_tracking_v5/frequency-history-ui.js?v=20260528b';
  document.body.appendChild(script);
}
function refresh(){
    Promise.all([getJSON(ENERGY),getJSON(PRICE),getJSON(OIL),getJSON(OIL_HISTORY),getJSON(FUEL),getJSON(EV_PRICES)]).then(function(res){
      var e=res[0]||{}, p=res[1]||{}, oil=res[2]||{}, hist=res[3], fuel=res[4]||{}, ev=res[5]||{};
      ensureSummaryPanel();
      renderGauge("demand", e.demandGW); renderGauge("price", p.priceGBPperMWh); renderGauge("carbon", carbonValue(p));
      if(e.mix) renderMix(e.mix); renderCommodities(oil,fuel); renderEvPrices(ev); if(hist) drawOilTrend(hist);
      var latest=latestIso(e.updated,p.updated,oil.updated);
      setText("summary-demand",e.demandGW==null?"—":fmt(e.demandGW,2));
      setText("summary-price",p.priceGBPperMWh==null?"—":fmt(p.priceGBPperMWh,2));
      setText("summary-carbon",carbonValue(p)==null?"—":Math.round(carbonValue(p)));
      setText("summary-timestamps",latest?"Updated: "+dateLabel(latest)+" · energy "+timeLabel(e.updated)+" · price "+timeLabel(p.updated)+" · commodities "+timeLabel(oil.updated):"Awaiting source timestamps.");
      var s=document.getElementById("scada-status");
      if(s){s.textContent="";s.style.display="none";}
    });
  }
  var oilRange=document.getElementById("oil-range");
  if(oilRange) oilRange.addEventListener("change", function(){ getJSON(OIL_HISTORY).then(drawOilTrend); });
  parseMarketInputs(); ensureV6Notice(); ensureSummaryPanel(); loadFrequencyModule(); refresh(); setInterval(refresh, POLL);
