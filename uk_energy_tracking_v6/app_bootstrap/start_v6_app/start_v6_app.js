window.V6StartApp=(function(){
  function refreshLive(){
    var cfg=window.V6LiveConfig,load=window.V6LoadJson.loadJson;
    Promise.all([load(cfg.energy),load(cfg.price),load(cfg.commodities),load(cfg.fuel),load(cfg.evPrices),load(cfg.oilHistory)]).then(function(r){
      var energy=r[0]||{},price=r[1]||{},commodities=r[2]||{},fuel=r[3]||{},ev=r[4]||{},oilHistory=r[5]||null;
      window.V6RenderLiveSnapshot.render(energy,price);
      window.V6RenderGenerationMix.render(energy);
      window.V6RenderCommodities.render(commodities,fuel,ev,oilHistory);
    })
  }
  function start(){refreshLive();setInterval(refreshLive,5*60*1000);if(window.V6ControlPriceHistory)window.V6ControlPriceHistory.start();if(window.V6FullscreenPeriodMenu)window.V6FullscreenPeriodMenu.start()}
  document.addEventListener('DOMContentLoaded',start);
  return{start:start,refreshLive:refreshLive};
})();