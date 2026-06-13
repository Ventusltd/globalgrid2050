window.V6LoadGenerationMwhAggregates=(function(){
  var cache={};
  function f(k,u){
    if(cache[k])return cache[k];
    cache[k]=fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});
    return cache[k];
  }
  return{
    annual:function(){return f('annual','/uk_energy_tracking_v6/generation_history/generation_annual_mwh_by_technology.json')},
    monthly:function(){return f('monthly','/uk_energy_tracking_v6/generation_history/generation_monthly_mwh_by_technology.json')},
    seasonal:function(){return f('seasonal','/uk_energy_tracking_v6/generation_history/generation_seasonal_mwh_by_technology.json')},
    dayNight:function(){return f('daynight','/uk_energy_tracking_v6/generation_history/generation_day_night_mwh_by_technology.json')},
    interconnectorIndex:function(){return f('icIndex','/uk_energy_tracking_v6/generation_history/interconnectors/generation_interconnector_index.json')},
    interconnectorTotals:function(){return f('icTotals','/uk_energy_tracking_v6/generation_history/interconnectors/generation_interconnector_total_electricity_summary.json')}
  };
})();
