window.V6ControlGenerationMwhAggregates=(function(){
  var hide={'Imports & Exports':1};
  function byId(id){return document.getElementById(id)}
  function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}
  function fillTech(){var e=byId('generation-mwh-technology');if(!e)return;var opts=((window.V6GenerationHistoryConfig&&window.V6GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear']).filter(function(t){return !hide[t]});e.innerHTML='';opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});e.value=opts.indexOf('Solar')>=0?'Solar':(opts[0]||'')}
  function setStatus(t){var e=byId('generation-mwh-status');if(e)e.textContent=t}
  function refresh(){setStatus('Loading MWh data...');Promise.all([window.V6LoadGenerationMwhAggregates.annual(),window.V6LoadGenerationMwhAggregates.monthly(),window.V6LoadGenerationMwhAggregates.dayNight(),window.V6LoadGenerationMwhAggregates.interconnectorIndex(),window.V6LoadGenerationMwhAggregates.interconnectorTotals()]).then(function(p){window.V6RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),p[0],p[3],p[4]);window.V6RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),p[1],tech());window.V6RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),p[2],tech());setStatus('Loaded - generation rows '+p[0].length+' - interconnector rows '+p[3].length+' - total check rows '+p[4].length)}).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})}
  function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}
  return{init:init,refresh:refresh};
})();
document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationMwhAggregates.init()});
