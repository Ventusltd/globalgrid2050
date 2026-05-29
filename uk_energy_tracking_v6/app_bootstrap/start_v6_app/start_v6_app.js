window.V6StartApp=(function(){
  function refreshLive(){var cfg=window.V6LiveConfig,load=window.V6LoadJson.loadJson;Promise.all([load(cfg.energy),load(cfg.price),load(cfg.commodities)]).then(function(r){var energy=r[0]||{},price=r[1]||{},commodities=r[2]||{};window.V6RenderLiveSnapshot.render(energy,price);window.V6RenderGenerationMix.render(energy);window.V6RenderCommodities.render(commodities)})}
  function start(){refreshLive();setInterval(refreshLive,5*60*1000);if(window.V6ControlPriceHistory)window.V6ControlPriceHistory.start()}
  document.addEventListener('DOMContentLoaded',start);
  return{start:start,refreshLive:refreshLive};
})();
