window.V62ControlGenerationMwhAggregates=(function(){
  function byId(id){return document.getElementById(id)}
  function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}
  function fillTech(){var e=byId('generation-mwh-technology');if(!e)return;var opts=(window.V62GenerationHistoryConfig&&window.V62GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear'];e.innerHTML='';opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});e.value='Solar'}
  function setStatus(text){var e=byId('generation-mwh-status');if(e)e.textContent=text}
  function refresh(){setStatus('Loading MWh aggregate intelligence...');Promise.all([window.V62LoadGenerationMwhAggregates.annual(),window.V62LoadGenerationMwhAggregates.monthly(),window.V62LoadGenerationMwhAggregates.dayNight()]).then(function(parts){window.V62RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),parts[0]);window.V62RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),parts[1],tech());window.V62RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),parts[2],tech());setStatus('Aggregate files loaded · annual '+parts[0].length+' rows · monthly '+parts[1].length+' rows · day/night '+parts[2].length+' rows')}).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})}
  function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}
  return{init:init,refresh:refresh};
})();

document.addEventListener('DOMContentLoaded',function(){window.V62ControlGenerationMwhAggregates.init()});
