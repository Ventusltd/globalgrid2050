window.V6LoadGenerationMwhAggregates=(function(){
  var cache={};
  function fetchRows(key,url){
    if(cache[key])return cache[key];
    cache[key]=fetch(url+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});
    return cache[key];
  }
  function annual(){return fetchRows('annual','/uk_energy_tracking_v6/generation_history/generation_annual_mwh_by_technology.json')}
  function monthly(){return fetchRows('monthly','/uk_energy_tracking_v6/generation_history/generation_monthly_mwh_by_technology.json')}
  function seasonal(){return fetchRows('seasonal','/uk_energy_tracking_v6/generation_history/generation_seasonal_mwh_by_technology.json')}
  function dayNight(){return fetchRows('daynight','/uk_energy_tracking_v6/generation_history/generation_day_night_mwh_by_technology.json')}
  return{annual:annual,monthly:monthly,seasonal:seasonal,dayNight:dayNight};
})();
