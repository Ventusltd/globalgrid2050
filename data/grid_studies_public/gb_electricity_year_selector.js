(function(){
  function latestStart(period){
    var days=window.V6LoadPriceHistoryData.periodDays(period||'7d');
    var max=window.V6LoadPriceHistoryData.maxDate();
    return new Date(max.getTime()-days*86400000);
  }
  function restoreHalfHourlyTracker(){
    if(!window.V6LoadPriceHistoryData||!window.V6RenderPriceChart)return;
    var injected=document.querySelector('.gg2050-year-period-controls');
    if(injected&&injected.parentNode)injected.parentNode.removeChild(injected);
    var buttons=document.querySelectorAll('#preset-grid button');
    buttons.forEach(function(b){b.classList.remove('active')});
    var active=document.querySelector('#preset-grid button[data-period="7d"][data-dynamic="latest"]')||document.querySelector('#preset-grid button[data-period="24h"]')||document.querySelector('#preset-grid button');
    if(active)active.classList.add('active');
    var period=active&&active.getAttribute('data-period')?active.getAttribute('data-period'):'7d';
    var start=active&&active.getAttribute('data-dynamic')==='latest'?latestStart(period):new Date((active&&active.getAttribute('data-start')?active.getAttribute('data-start'):'2016-01-01')+'T00:00:00Z');
    window.V6LoadPriceHistoryData.loadWindow(start,period,'all').then(function(result){
      window.V6RenderPriceChart.render(result);
      var status=document.getElementById('price-history-range-status');
      if(status)status.textContent='Restored half hourly tracker view: '+period+' | '+(result.rows||[]).length.toLocaleString('en-GB')+' records';
    }).catch(function(err){
      var status=document.getElementById('price-history-range-status');
      if(status)status.textContent='Chart restore failed: '+err;
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(restoreHalfHourlyTracker,150)});else setTimeout(restoreHalfHourlyTracker,150);
})();
