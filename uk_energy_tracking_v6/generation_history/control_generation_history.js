window.V6ControlGenerationHistory=(function(){
  var lastResult=null;
  function byId(id){return document.getElementById(id)}
  function ymd(d){return d.toISOString().slice(0,10)}
  function fillYears(){var sel=byId('generation-history-year');if(!sel)return;var now=new Date().getUTCFullYear(),first=(window.V6GenerationHistoryConfig.firstYear||2016);sel.innerHTML='';for(var y=now;y>=first;y--){var o=document.createElement('option');o.value=String(y);o.textContent=String(y);sel.appendChild(o)}}
  function fillTech(){var sel=byId('generation-history-technology');if(!sel)return;sel.innerHTML='';(window.V6GenerationHistoryConfig.technologies||['Wind']).forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o)});sel.value=(window.V6GenerationHistoryConfig.defaultTechnology||'Wind')}
  function state(){var year=byId('generation-history-year'),start=byId('generation-history-start'),period=byId('generation-history-period'),tech=byId('generation-history-technology');return{year:year?year.value:String(new Date().getUTCFullYear()),start:start?start.value:'',period:period?period.value:'12m',technology:tech?tech.value:(window.V6GenerationHistoryConfig.defaultTechnology||'Wind')}}
  function setStatus(text){var e=byId('generation-history-range-status');if(e)e.textContent=text}
  function drawCached(){var canvas=byId('generation-history-canvas');if(canvas&&lastResult)window.V6RenderGenerationHistoryChart.render(canvas,lastResult)}
  function refresh(){var s=state(),start=s.start?new Date(s.start+'T00:00:00Z'):new Date(Date.UTC(Number(s.year),0,1));setStatus('Loading '+s.technology+' generation data...');window.V6LoadGenerationHistoryData.loadWindow(start,s.period,s.technology,'all').then(function(result){lastResult=result;drawCached();setStatus(window.V6LoadGenerationHistoryData.periodLabel(s.period)+' · '+s.technology+' · '+result.rows.length+' records · '+result.start.toISOString().slice(0,10)+' to '+result.end.toISOString().slice(0,10))}).catch(function(exc){setStatus('Generation history load failed: '+exc)})}
  function init(){fillYears();fillTech();var period=byId('generation-history-period');if(period)period.value='12m';var start=byId('generation-history-start');if(start){var d=new Date();d.setUTCFullYear(d.getUTCFullYear()-1);d.setUTCDate(d.getUTCDate()+1);start.value=ymd(d)}['generation-history-year','generation-history-start','generation-history-period','generation-history-technology'].forEach(function(id){var e=byId(id);if(e)e.addEventListener('change',refresh)});refresh();window.addEventListener('resize',function(){clearTimeout(window.__v6GenResize);window.__v6GenResize=setTimeout(drawCached,180)})}
  return{init:init,refresh:refresh};
})();

document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationHistory.init()});
