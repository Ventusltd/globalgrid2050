window.V6ControlGenerationHistory=(function(){
  function byId(id){return document.getElementById(id)}
  function ymd(d){return d.toISOString().slice(0,10)}
  function fillYears(){var sel=byId('generation-history-year');if(!sel)return;var now=new Date().getUTCFullYear(),first=(window.V6GenerationHistoryConfig.firstYear||2016);sel.innerHTML='';for(var y=now;y>=first;y--){var o=document.createElement('option');o.value=String(y);o.textContent=String(y);sel.appendChild(o)}}
  function fillTech(){var sel=byId('generation-history-technology');if(!sel)return;sel.innerHTML='';['All'].concat(window.V6GenerationHistoryConfig.technologies||[]).forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o)})}
  function state(){var year=byId('generation-history-year'),start=byId('generation-history-start'),period=byId('generation-history-period'),tech=byId('generation-history-technology');return{year:year?year.value:String(new Date().getUTCFullYear()),start:start?start.value:'',period:period?period.value:'7d',technology:tech?tech.value:'All'}}
  function setStatus(text){var e=byId('generation-history-range-status');if(e)e.textContent=text}
  function refresh(){var s=state(),start=s.start?new Date(s.start+'T00:00:00Z'):new Date(Date.UTC(Number(s.year),0,1));setStatus('Loading '+s.technology+' generation data...');window.V6LoadGenerationHistoryData.loadWindow(start,s.period,s.technology,'all').then(function(result){var canvas=byId('generation-history-canvas');if(canvas)window.V6RenderGenerationHistoryChart.render(canvas,result);setStatus(window.V6LoadGenerationHistoryData.periodLabel(s.period)+' · '+s.technology+' · '+result.rows.length+' records · '+result.start.toISOString().slice(0,10)+' to '+result.end.toISOString().slice(0,10))}).catch(function(exc){setStatus('Generation history load failed: '+exc)})}
  function init(){fillYears();fillTech();var start=byId('generation-history-start');if(start){var d=new Date();d.setUTCDate(d.getUTCDate()-7);start.value=ymd(d)}['generation-history-year','generation-history-start','generation-history-period','generation-history-technology'].forEach(function(id){var e=byId(id);if(e)e.addEventListener('change',refresh)});refresh();window.addEventListener('resize',function(){clearTimeout(window.__v6GenResize);window.__v6GenResize=setTimeout(refresh,180)})}
  return{init:init,refresh:refresh};
})();

document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationHistory.init()});
