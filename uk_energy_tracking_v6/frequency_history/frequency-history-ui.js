// GlobalGrid2050 V6 frequency chart. Inserts itself below the Elexon price chart.
(function(){
  var CSV_URL = "/uk_energy_tracking_v6/grid_frequency_history.csv";
  var LIVE_URL = "/uk_energy_tracking_v6/live_grid_frequency.json";
  var WEEKLY_URL = "/uk_energy_tracking_v6/live_grid_frequency_weekly_health.json";
  var REFRESH_MS = 120000;
  var installed = false;

  function $(id){ return document.getElementById(id); }
  function txt(id, value){ var el=$(id); if(el) el.textContent=value; }
  function css(){
    if($("gg-frequency-style")) return;
    var s=document.createElement("style");
    s.id="gg-frequency-style";
    s.textContent="\n#grid-frequency-panel .frequency-shell{background:var(--gg-panel,#0b0f17);border:1px solid var(--gg-line,#252b36);border-radius:6px;padding:14px;margin-top:18px}\n#grid-frequency-panel .frequency-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px}\n#grid-frequency-panel .frequency-actions strong{color:var(--gg-cyan,#00ffff);letter-spacing:.12em;text-transform:uppercase}\n#grid-frequency-panel .frequency-actions a{border:1px solid var(--gg-line,#252b36);border-radius:4px;padding:8px 10px;color:#7fdfff;background:rgba(255,255,255,.03);font-family:'Courier New',monospace;text-decoration:none}\n#frequency-history-canvas,#frequency-weekly-canvas{width:100%;height:340px;display:block;border:1px solid rgba(255,255,255,.05);background:#070a10;touch-action:auto}\n#frequency-weekly-canvas{height:300px;margin-top:12px}\n.frequency-mini-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px}\n.frequency-mini{border:1px solid var(--gg-line,#252b36);background:rgba(255,255,255,.03);border-radius:4px;padding:9px}\n.frequency-mini span{display:block;color:var(--gg-muted,#9aa3b6);text-transform:uppercase;letter-spacing:.12em;font-size:10px}\n.frequency-mini strong{display:block;color:var(--gg-cyan,#00ffff);font-size:16px;margin-top:4px}\n.frequency-note{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.018);color:var(--gg-muted,#9aa3b6);font-size:11px;line-height:1.45;letter-spacing:.04em;padding:8px 10px;margin:8px 0 10px;border-radius:5px}\n.frequency-note b{color:var(--gg-text,#f5f7fb)}\n.frequency-subtitle{color:var(--gg-cyan,#00ffff);letter-spacing:.12em;text-transform:uppercase;font-size:13px;margin:18px 0 8px}\n@media(max-width:850px){.frequency-mini-grid{grid-template-columns:1fr 1fr}#frequency-history-canvas{height:320px}#frequency-weekly-canvas{height:280px}}\n";
    document.head.appendChild(s);
  }
  function install(){
    if(installed || $("grid-frequency-panel")) return true;
    var price=$("electricity-price-history-panel");
    if(!price || !price.parentNode) return false;
    css();
    var section=document.createElement("section");
    section.id="grid-frequency-panel";
    section.innerHTML="<h2 class='section-title'>Grid Frequency 24 Hour Trace</h2>"+
      "<div class='frequency-shell'>"+
      "<div class='frequency-actions'><strong>UK grid frequency from Elexon</strong><a href='/uk_energy_tracking_v6/grid_frequency_history.csv' download>Download frequency CSV</a><a href='/uk_energy_tracking_v6/grid_frequency_weekly_health.csv' download>Download weekly health CSV</a></div>"+
      "<div class='frequency-note'><b>Grid stability signal:</b> frequency shows the live balance between generation and demand. The 50 Hz reference line exposes stress, recovery and control behaviour over the last rolling 24 hours.</div>"+
      "<canvas id='frequency-history-canvas' width='900' height='340'></canvas>"+
      "<div class='frequency-mini-grid'>"+
      "<div class='frequency-mini'><span>Latest</span><strong><b id='frequency-latest'>—</b> Hz</strong></div>"+
      "<div class='frequency-mini'><span>Records</span><strong id='frequency-records'>—</strong></div>"+
      "<div class='frequency-mini'><span>Window</span><strong id='frequency-window'>24 hours</strong></div>"+
      "<div class='frequency-mini'><span>Min to max</span><strong id='frequency-minmax'>—</strong></div>"+
      "</div><div class='scada-credit' id='frequency-updated' style='margin-top:10px;'>Awaiting frequency update.</div>"+
      "<div class='frequency-subtitle'>Weekly grid health trend</div>"+
      "<div class='frequency-note'><b>Health proxy:</b> weekly average frequency and largest deviation from 50 Hz. Historic depth depends on what the public Elexon frequency endpoint returns during backfill.</div>"+
      "<canvas id='frequency-weekly-canvas' width='900' height='300'></canvas>"+
      "<div class='frequency-mini-grid'>"+
      "<div class='frequency-mini'><span>Weeks</span><strong id='frequency-weekly-count'>—</strong></div>"+
      "<div class='frequency-mini'><span>Latest avg</span><strong id='frequency-weekly-avg'>—</strong></div>"+
      "<div class='frequency-mini'><span>Largest dev</span><strong id='frequency-weekly-dev'>—</strong></div>"+
      "<div class='frequency-mini'><span>Weekly health</span><strong id='frequency-weekly-health'>—</strong></div>"+
      "</div></div>";
    price.parentNode.insertBefore(section, price.nextSibling);
    installed=true;
    return true;
  }
  function parseCsv(text){
    text=(text||"").trim();
    if(!text) return [];
    return text.split(/\r?\n/).slice(1).map(function(line){
      var p=line.split(",");
      if(p.length<2) return null;
      var hz=parseFloat(p[1]);
      if(!isFinite(hz)) return null;
      return {t:p[0], hz:hz};
    }).filter(Boolean);
  }
  function timeLabel(iso){
    if(!iso) return "—";
    var d=new Date(iso);
    if(isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  }
  function weekLabel(iso){
    if(!iso) return "—";
    var d=new Date(iso);
    if(isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
  }
  function getText(url){return fetch(url+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok) throw new Error(String(r.status)); return r.text();});}
  function getJson(url){return fetch(url+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok) throw new Error(String(r.status)); return r.json();});}
  function canvasSetup(id, minH){
    var c=$(id); if(!c) return null;
    var ctx=c.getContext("2d"), rect=c.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    var w=Math.max(340,Math.floor(rect.width*dpr)), h=Math.max(minH||260,Math.floor(rect.height*dpr));
    c.width=w; c.height=h; ctx.fillStyle="#070a10"; ctx.fillRect(0,0,w,h);
    return {c:c,ctx:ctx,dpr:dpr,w:w,h:h,L:58*dpr,R:18*dpr,T:24*dpr,B:44*dpr};
  }
  function draw(rows){
    var g=canvasSetup("frequency-history-canvas",260); if(!g) return;
    var ctx=g.ctx,dpr=g.dpr,L=g.L,R=g.R,T=g.T,B=g.B,w=g.w,h=g.h,pw=w-L-R,ph=h-T-B;
    ctx.strokeStyle="rgba(255,255,255,.12)"; ctx.lineWidth=1*dpr; ctx.strokeRect(L,T,pw,ph);
    [49.8,49.9,50.0,50.1,50.2].forEach(function(v){
      var y=T+(50.2-v)/0.4*ph;
      ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(L+pw,y); ctx.stroke();
      ctx.fillStyle=v===50?"#00ffff":"#9aa3b6"; ctx.font=(11*dpr)+"px Courier New"; ctx.fillText(v.toFixed(1),8*dpr,y+4*dpr);
    });
    if(!rows.length){ctx.fillStyle="#9aa3b6"; ctx.font=(14*dpr)+"px Courier New"; ctx.fillText("Awaiting frequency records",L+18*dpr,T+42*dpr); return;}
    var vals=rows.map(function(r){return r.hz;});
    var min=Math.min.apply(null,vals.concat([49.8])), max=Math.max.apply(null,vals.concat([50.2]));
    var span=Math.max(0.2,max-min); min-=span*0.08; max+=span*0.08;
    var y50=T+(max-50)/(max-min)*ph;
    ctx.strokeStyle="rgba(0,255,255,.60)"; ctx.setLineDash([6*dpr,6*dpr]); ctx.beginPath(); ctx.moveTo(L,y50); ctx.lineTo(L+pw,y50); ctx.stroke(); ctx.setLineDash([]);
    ctx.shadowColor="rgba(0,255,136,.45)"; ctx.shadowBlur=12*dpr; ctx.strokeStyle="#00ff88"; ctx.lineWidth=2*dpr; ctx.beginPath();
    rows.forEach(function(r,i){var x=L+(rows.length===1?0.5:i/(rows.length-1))*pw; var y=T+(max-r.hz)/(max-min)*ph; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);});
    ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle="#9aa3b6"; ctx.font=(11*dpr)+"px Courier New";
    ctx.fillText(timeLabel(rows[0].t),L,T+ph+26*dpr);
    ctx.fillText(timeLabel(rows[rows.length-1].t),Math.max(L,L+pw-150*dpr),T+ph+26*dpr);
  }
  function drawWeekly(rows){
    var g=canvasSetup("frequency-weekly-canvas",240); if(!g) return;
    var ctx=g.ctx,dpr=g.dpr,L=g.L,R=g.R,T=g.T,B=g.B,w=g.w,h=g.h,pw=w-L-R,ph=h-T-B;
    ctx.strokeStyle="rgba(255,255,255,.12)"; ctx.lineWidth=1*dpr; ctx.strokeRect(L,T,pw,ph);
    [49.95,50.0,50.05].forEach(function(v){
      var y=T+(50.05-v)/0.10*ph;
      ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(L+pw,y); ctx.stroke();
      ctx.fillStyle=v===50?"#00ffff":"#9aa3b6"; ctx.font=(11*dpr)+"px Courier New"; ctx.fillText(v.toFixed(2),6*dpr,y+4*dpr);
    });
    if(!rows.length){ctx.fillStyle="#9aa3b6"; ctx.font=(14*dpr)+"px Courier New"; ctx.fillText("Awaiting weekly health rows",L+18*dpr,T+42*dpr); return;}
    var vals=rows.map(function(r){return Number(r.avg_hz);}).filter(function(v){return isFinite(v);});
    var min=Math.min.apply(null,vals.concat([49.95])), max=Math.max.apply(null,vals.concat([50.05]));
    var span=Math.max(0.05,max-min); min-=span*0.1; max+=span*0.1;
    var y50=T+(max-50)/(max-min)*ph;
    ctx.strokeStyle="rgba(0,255,255,.60)"; ctx.setLineDash([6*dpr,6*dpr]); ctx.beginPath(); ctx.moveTo(L,y50); ctx.lineTo(L+pw,y50); ctx.stroke(); ctx.setLineDash([]);
    ctx.shadowColor="rgba(255,204,0,.35)"; ctx.shadowBlur=10*dpr; ctx.strokeStyle="#ffcc00"; ctx.lineWidth=2*dpr; ctx.beginPath();
    rows.forEach(function(r,i){var x=L+(rows.length===1?0.5:i/(rows.length-1))*pw; var y=T+(max-Number(r.avg_hz))/(max-min)*ph; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);});
    ctx.stroke(); ctx.shadowBlur=0;
    ctx.fillStyle="#9aa3b6"; ctx.font=(11*dpr)+"px Courier New";
    ctx.fillText(weekLabel(rows[0].week_start_utc),L,T+ph+26*dpr);
    ctx.fillText(weekLabel(rows[rows.length-1].week_start_utc),Math.max(L,L+pw-90*dpr),T+ph+26*dpr);
  }
  function refresh(){
    if(!install()) return;
    Promise.all([getText(CSV_URL).catch(function(){return "";}),getJson(LIVE_URL).catch(function(){return null;}),getJson(WEEKLY_URL).catch(function(){return null;})]).then(function(res){
      var rows=parseCsv(res[0]), live=res[1]||{}, weekly=res[2]||{}, latest=live.latest||{}, weeklyRows=weekly.rows||[], latestWeek=weekly.latest_week||weeklyRows[weeklyRows.length-1]||{};
      draw(rows); drawWeekly(weeklyRows);
      txt("frequency-latest", latest.frequency_hz!=null?Number(latest.frequency_hz).toFixed(3):rows.length?Number(rows[rows.length-1].hz).toFixed(3):"—");
      txt("frequency-records", String(live.record_count||rows.length||0));
      txt("frequency-window", (live.window_hours||24)+" hours");
      txt("frequency-minmax", live.min_hz!=null&&live.max_hz!=null?Number(live.min_hz).toFixed(3)+" to "+Number(live.max_hz).toFixed(3)+" Hz":"—");
      txt("frequency-updated", live.updated_utc?"Updated: "+timeLabel(live.updated_utc):"Awaiting frequency update.");
      txt("frequency-weekly-count", String(weekly.record_count||weeklyRows.length||0));
      txt("frequency-weekly-avg", latestWeek.avg_hz!=null?Number(latestWeek.avg_hz).toFixed(4)+" Hz":"—");
      txt("frequency-weekly-dev", latestWeek.largest_deviation_hz!=null?Number(latestWeek.largest_deviation_hz).toFixed(4)+" Hz":"—");
      txt("frequency-weekly-health", latestWeek.data_health||weekly.health||"—");
    });
  }
  window.addEventListener("resize", refresh);
  refresh(); setInterval(refresh, REFRESH_MS);
})();
