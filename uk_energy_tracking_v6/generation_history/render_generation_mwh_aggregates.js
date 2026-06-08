window.V6RenderGenerationMwhAggregates=(function(){
  var colours={Solar:'#f5c518',Wind:'#00d0ff',Hydro:'#0090c0',Gas:'#c0399a',Coal:'#888888',Biomass:'#f59e2b',Nuclear:'#5cb85c','Pumped Storage':'#9b59b6','Imports & Exports':'#e8615a',Other:'#a6adbb'};
  function fmt(n,d){return n==null||isNaN(Number(n))?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function renderAnnual(el,rows){
    if(!el)return;
    rows=rows||[];
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data.</div>';return;}
    var latest=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0}));
    var latestRows=rows.filter(function(r){return Number(r.year)===latest}).sort(function(a,b){return Number(b.totalMWh)-Number(a.totalMWh)});
    var total=latestRows.reduce(function(s,r){return s+Number(r.totalMWh||0)},0);
    var html='<div class="mwh-aggregate-head"><strong>Annual MWh by technology</strong><span>'+latest+' · '+fmt(total/1000000,2)+' TWh total shown</span></div>';
    html+='<div class="mwh-bars">';
    latestRows.forEach(function(r){var v=Number(r.totalMWh||0),pct=total?Math.max(0,v/total*100):0,c=colours[r.technology]||'#00ffff';html+='<div class="mwh-row"><div class="mwh-label">'+r.technology+'</div><div class="mwh-track"><i style="width:'+pct+'%;background:'+c+'"></i></div><div class="mwh-value">'+fmt(v/1000000,2)+' TWh</div></div>'});
    html+='</div>';el.innerHTML=html;
  }
  function renderMonthly(el,rows,technology){
    if(!el)return;
    rows=(rows||[]).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting monthly MWh aggregate data.</div>';return;}
    rows=rows.slice().sort(function(a,b){return (a.year-b.year)||(a.month-b.month)});
    var max=Math.max.apply(null,rows.map(function(r){return Number(r.totalMWh)||0}));
    var sample=rows.slice(-24);
    var html='<div class="mwh-aggregate-head"><strong>Monthly MWh trend</strong><span>'+(technology||'All technologies')+'</span></div><div class="mwh-mini-chart">';
    sample.forEach(function(r){var h=max?Math.max(2,Number(r.totalMWh)/max*100):2;html+='<div class="mwh-col" title="'+r.year+'-'+String(r.month).padStart(2,'0')+' '+r.technology+' '+fmt(r.totalMWh/1000000,2)+' TWh"><i style="height:'+h+'%;background:'+(colours[r.technology]||'#00ffff')+'"></i></div>'});
    html+='</div>';el.innerHTML=html;
  }
  function renderDayNight(el,rows,technology){
    if(!el)return;
    rows=(rows||[]).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting day/night aggregate data.</div>';return;}
    var latest=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0}));
    var subset=rows.filter(function(r){return Number(r.year)===latest});
    var day=0,night=0;subset.forEach(function(r){day+=Number(r.dayMWh||0);night+=Number(r.nightMWh||0)});
    var total=day+night,dp=total?day/total*100:0,np=total?night/total*100:0;
    el.innerHTML='<div class="mwh-aggregate-head"><strong>Day versus night MWh</strong><span>'+latest+' · '+(technology||'All technologies')+'</span></div><div class="mwh-split"><div style="width:'+dp+'%">Day '+fmt(dp,1)+'%</div><div style="width:'+np+'%">Night '+fmt(np,1)+'%</div></div><div class="mwh-note-line">Day '+fmt(day/1000000,2)+' TWh · Night '+fmt(night/1000000,2)+' TWh</div>';
  }
  return{annual:renderAnnual,monthly:renderMonthly,dayNight:renderDayNight};
})();
