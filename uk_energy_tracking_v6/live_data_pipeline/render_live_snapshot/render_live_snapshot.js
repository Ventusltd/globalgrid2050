window.V6RenderLiveSnapshot=(function(){
  function render(energy,price){var h=window.V6DomText;energy=energy||{};price=price||{};h.setText('summary-demand',h.fmt(energy.demandGW,2));h.setText('summary-price',h.fmt(price.priceGBPperMWh,2));var c=price.carbonGperKWh==null?price.carbonForecast:price.carbonGperKWh;h.setText('summary-carbon',c==null?'—':Math.round(Number(c)));h.setText('summary-timestamps','Updated: energy '+h.isoLabel(energy.updated)+' · price '+h.isoLabel(price.updated));}
  return{render:render};
})();
