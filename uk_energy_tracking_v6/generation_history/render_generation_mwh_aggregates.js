window.V6RenderGenerationMwhAggregates=(function(){
  var colours={Solar:'#f5c518',Wind:'#00d0ff',Hydro:'#0090c0',Gas:'#c0399a',Coal:'#888888',Biomass:'#f59e2b',Nuclear:'#5cb85c','Pumped Storage':'#9b59b6',Other:'#a6adbb'};
  var hide={'Imports & Exports':1};
  var ord={Solar:10,Wind:20,Gas:30,Nuclear:40,Biomass:50,Hydro:60,'Pumped Storage':70,Coal:80,Other:90};
  function fmt(n,d){return n==null||isNaN(Number(n))?'--':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function clean(rows){return(rows||[]).filter(function(r){return r&&!hide[r.technology]})}
  function latestYear(rows,extraRows){var ys=[];(rows||[]).forEach(function(r){ys.push(Number(r.year)||0)});(extraRows||[]).forEach(function(r){ys.push(Number(r.year)||0)});return Math.max.apply(null,ys)}
  function barRow(label,pct,value,colour,title){return '<div class="mwh-row" title="'+(title||label)+'"><div class="mwh-label">'+label+'</div><div class="mwh-track"><i style="width:'+Math.max(0,Math.min(100,pct))+'%;background:'+colour+'"></i></div><div class="mwh-value">'+value+'</div></div>'}
  function metric(label,value){return '<div class="mwh-check-metric"><span>'+label+'</span><strong>'+value+'</strong></div>'}
  function annual(el,rows,icIndex,totals){
    if(!el)return;
    rows=rows||[];icIndex=icIndex||[];totals=totals||[];
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data.</div>';return}
    var y=latestYear(rows,icIndex);
    var genRows=clean(rows.filter(function(r){return Number(r.year)===y})).sort(function(a,b){return(ord[a.technology]||999)-(ord[b.technology]||999)});
    var genTotal=genRows.reduce(function(s,r){return s+Math.max(0,Number(r.totalMWh||0))},0);
    var h='<div class="mwh-aggregate-head"><strong>Annual MWh by technology</strong><span>'+y+' - generation shown</span></div><div class="mwh-bars">';
    genRows.forEach(function(r){var v=Number(r.totalMWh||0),p=genTotal?Math.max(0,v)/genTotal*100:0,c=colours[r.technology]||'#00ffff';h+=barRow(r.technology,p,fmt(v/1000000,2)+' TWh',c,r.technology+' '+fmt(v/1000000,2)+' TWh')});
    h+='</div>';
    var links=(icIndex||[]).filter(function(r){return Number(r.year)===y}).sort(function(a,b){return(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0)});
    if(links.length){
      var maxAbs=Math.max.apply(null,links.map(function(r){return Math.max(Math.abs(Number(r.importMWh||0)),Math.abs(Number(r.exportMWh||0)),Math.abs(Number(r.netMWh||0)),1)}));
      h+='<div class="mwh-aggregate-head mwh-section-head"><strong>Interconnectors</strong><span>net flow shown</span></div><div class="mwh-bars">';
      links.forEach(function(r){var net=Number(r.netMWh||0),imp=Number(r.importMWh||0),exp=Number(r.exportMWh||0),p=Math.max(2,Math.abs(net)/maxAbs*100),c=net>=0?'#00d0ff':'#ff7777',label=r.country+' - '+r.bmrsCode,title=r.label+' | import '+fmt(imp/1000000,2)+' TWh | export '+fmt(exp/1000000,2)+' TWh | net '+fmt(net/1000000,2)+' TWh';h+=barRow(label,p,fmt(net/1000000,2)+' TWh',c,title)});
      h+='</div>';
    }
    var total=(totals||[]).filter(function(r){return Number(r.year)===y})[0];
    if(total){h+='<div class="mwh-total-check"><div class="mwh-aggregate-head mwh-section-head"><strong>Total electricity check</strong><span>reconciliation</span></div><div class="mwh-check-grid">'+metric('Generation',fmt(total.generationShownMWh/1000000,2)+' TWh')+metric('Imports',fmt(total.totalImportMWh/1000000,2)+' TWh')+metric('Exports',fmt(total.totalExportMWh/1000000,2)+' TWh')+metric('Net interconnector',fmt(total.netInterconnectorMWh/1000000,2)+' TWh')+metric('Supply proxy',fmt(total.supplyProxyMWh/1000000,2)+' TWh')+'</div></div>'}
    el.innerHTML=h;
  }
  function monthly(el,rows,technology){if(!el)return;rows=clean(rows).filter(function(r){return !technology||r.technology===technology});if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting monthly MWh aggregate data.</div>';return}rows=rows.slice().sort(function(a,b){return(a.year-b.year)||(a.month-b.month)});var mx=Math.max.apply(null,rows.map(function(r){return Number(r.totalMWh)||0})),sample=rows.slice(-24),h='<div class="mwh-aggregate-head"><strong>Monthly MWh trend</strong><span>'+(technology||'All generation technologies')+'</span></div><div class="mwh-mini-chart">';sample.forEach(function(r){var p=mx?Math.max(2,Number(r.totalMWh)/mx*100):2;h+='<div class="mwh-col" title="'+r.year+'-'+String(r.month).padStart(2,'0')+' '+r.technology+' '+fmt(r.totalMWh/1000000,2)+' TWh"><i style="height:'+p+'%;background:'+(colours[r.technology]||'#00ffff')+'"></i></div>'});el.innerHTML=h+'</div>'}
  function dayNight(el,rows,technology){if(!el)return;rows=clean(rows).filter(function(r){return !technology||r.technology===technology});if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting day/night aggregate data.</div>';return}var y=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0})),day=0,night=0;rows.filter(function(r){return Number(r.year)===y}).forEach(function(r){day+=Number(r.dayMWh||0);night+=Number(r.nightMWh||0)});var t=day+night,dp=t?day/t*100:0,np=t?night/t*100:0;el.innerHTML='<div class="mwh-aggregate-head"><strong>Day versus night MWh</strong><span>'+y+' - '+(technology||'All generation technologies')+'</span></div><div class="mwh-split"><div style="width:'+dp+'%">Day '+fmt(dp,1)+'%</div><div style="width:'+np+'%">Night '+fmt(np,1)+'%</div></div><div class="mwh-note-line">Day '+fmt(day/1000000,2)+' TWh - Night '+fmt(night/1000000,2)+' TWh</div>'}
  return{annual:annual,monthly:monthly,dayNight:dayNight};
})();
