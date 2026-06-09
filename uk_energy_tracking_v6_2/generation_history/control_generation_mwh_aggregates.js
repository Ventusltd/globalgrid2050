window.V6 22ControlGenerationMwhAggregates=(function(){
  function byId(id){return document.getElementById(id)}
  function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}
  function fillTech(){var e=byId('generation-mwh-technology');if(!e)return;var opts=(window.V6 22GenerationHistoryConfig&&window.V6 22GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear'];e.innerHTML='';opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});e.value='Solar'}
  function setStatus(text){var e=byId('generation-mwh-status');if(e)e.textContent=text}
  function refresh(){setStatus('Loading MWh aggregate intelligence...');Promise.all([window.V6 22LoadGenerationMwhAggregates.annual(),window.V6 22LoadGenerationMwhAggregates.monthly(),window.V6 22LoadGenerationMwhAggregates.dayNight()]).then(function(parts){window.V6 22RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),parts[0]);window.V6 22RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),parts[1],tech());window.V6 22RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),parts[2],tech());setStatus('Aggregate files loaded · annual '+parts[0].length+' rows · monthly '+parts[1].length+' rows · day/night '+parts[2].length+' rows')}).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})}
  function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}
  return{init:init,refresh:refresh};
})();

document.addEventListener('DOMContentLoaded',function(){window.V6 22ControlGenerationMwhAggregates.init()});
