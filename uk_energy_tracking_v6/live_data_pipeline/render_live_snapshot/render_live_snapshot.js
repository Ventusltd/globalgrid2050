window.V6RenderLiveSnapshot=(function(){
  function latestIso(){
    var out=null;
    for(var i=0;i<arguments.length;i++){
      var v=arguments[i];
      if(!v)continue;
      var d=new Date(v);
      if(isNaN(d))continue;
      if(!out||d>out)out=d;
    }
    return out?out.toISOString():null;
  }
  function dateLabel(v){if(!v)return'—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})+' '+d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
  function timeLabel(v){if(!v)return'—';var d=new Date(v);return isNaN(d)?'—':d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
  function render(energy,price){
    var h=window.V6DomText;
    energy=energy||{};
    price=price||{};
    h.setText('summary-demand',h.fmt(energy.demandGW,2));
    h.setText('summary-price',h.fmt(price.priceGBPperMWh,2));
    var c=price.carbonGperKWh==null?price.carbonForecast:price.carbonGperKWh;
    h.setText('summary-carbon',c==null?'—':Math.round(Number(c)));
    var latest=latestIso(energy.updated,price.updated);
    h.setText('summary-timestamps',latest?'Updated: '+dateLabel(latest)+' · energy '+timeLabel(energy.updated)+' · price '+timeLabel(price.updated):'Awaiting source timestamps.');
    h.setText('m-updated-time',latest?dateLabel(latest):'Awaiting feed');
    h.setText('m-updated-meta','Energy '+timeLabel(energy.updated)+' · price '+timeLabel(price.updated));
  }
  return{render:render};
})();