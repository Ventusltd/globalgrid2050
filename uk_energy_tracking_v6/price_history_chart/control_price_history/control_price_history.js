window.V6ControlPriceHistory=(function(){
  function todayStart(){var d=new Date();d.setUTCHours(0,0,0,0);return d}
  function ymd(d){return d.toISOString().slice(0,10)}
  function load(){var startEl=document.getElementById('price-history-start');var periodEl=document.getElementById('price-history-period');var period=periodEl&&periodEl.value?periodEl.value:'7d';var start=startEl&&startEl.value?new Date(startEl.value+'T00:00:00Z'):new Date(todayStart().getTime()-7*86400000);if(period==='12hday')start.setUTCHours(6,0,0,0);if(period==='12hnight')start.setUTCHours(18,0,0,0);if(startEl&&!startEl.value)startEl.value=ymd(start);return window.V6LoadPriceHistoryData.loadWindow(start,period).then(window.V6RenderPriceChart.render)}
  function start(){var startEl=document.getElementById('price-history-start');if(startEl&&!startEl.value)startEl.value=ymd(new Date(todayStart().getTime()-7*86400000));var btn=document.getElementById('price-history-refresh');var period=document.getElementById('price-history-period');if(btn)btn.addEventListener('click',load);if(period)period.addEventListener('change',load);if(startEl)startEl.addEventListener('change',load);load()}
  return{start:start,load:load};
})();
