window.V62ControlGenerationHistory=(function(){
  var lastResult=null;
  function byId(id){return document.getElementById(id)}
  function ymd(d){return d.toISOString().slice(0,10)}
  function daysForPeriod(p){return {'12hday':1,'12hnight':1,'24h':1,'48h':2,'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[p]||7}
  function isRecentPeriod(p){return ['12hday','12hnight','24h','48h','7d','30d'].indexOf(p)>=0}
  function fillYears(){var sel=byId('generation-history-year');if(!sel)return;var now=new Date().getUTCFullYear(),first=(window.V62GenerationHistoryConfig.firstYear||2016);sel.innerHTML='';for(var y=now;y>=first;y--){var o=document.createElement('option');o.value=String(y);o.textContent=String(y);sel.appendChild(o)}}
  function fillTech(){var sel=byId('generation-history-technology');if(!sel)return;sel.innerHTML='';(window.V62GenerationHistoryConfig.technologies||['Wind']).forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o)});sel.value=(window.V62GenerationHistoryConfig.defaultTechnology||'Wind')}
  function setStartForPeriod(){var start=byId('generation-history-start'),period=byId('generation-history-period');if(!start||!period)return;var p=period.value,d=new Date();d.setUTCDate(d.getUTCDate()-daysForPeriod(p)+1);start.value=ymd(d)}
  function setStartForYear(){var year=byId('generation-history-year'),start=byId('generation-history-start');if(year&&start)start.value=String(year.value)+'-01-01'}
  function state(){var year=byId('generation-history-year'),start=byId('generation-history-start'),period=byId('generation-history-period'),tech=byId('generation-history-technology');return{year:year?year.value:String(new Date().getUTCFullYear()),start:start?start.value:'',period:period?period.value:'12m',technology:tech?tech.value:(window.V62GenerationHistoryConfig.defaultTechnology||'Wind')}}
  function setStatus(text){var e=byId('generation-history-range-status');if(e)e.textContent=text}
  function drawCached(){var canvas=byId('generation-history-canvas');if(canvas&&lastResult)window.V62RenderGenerationHistoryChart.render(canvas,lastResult)}
  function refresh(){var s=state(),start=s.start?new Date(s.start+'T00:00:00Z'):new Date(Date.UTC(Number(s.year),0,1));setStatus('Loading '+s.technology+' generation data...');window.V62LoadGenerationHistoryData.loadWindow(start,s.period,s.technology,'all').then(function(result){lastResult=result;drawCached();setStatus(window.V62LoadGenerationHistoryData.periodLabel(s.period)+' · '+s.technology+' · '+(result.tier||result.mode)+' · '+result.rows.length+' records · '+result.start.toISOString().slice(0,10)+' to '+result.end.toISOString().slice(0,10))}).catch(function(exc){setStatus('Generation history load failed: '+exc)})}
  function init(){fillYears();fillTech();var period=byId('generation-history-period');if(period)period.value='12m';setStartForPeriod();var year=byId('generation-history-year');if(year)year.addEventListener('change',function(){setStartForYear();refresh()});if(period)period.addEventListener('change',function(){setStartForPeriod();refresh()});['generation-history-start','generation-history-technology'].forEach(function(id){var e=byId(id);if(e)e.addEventListener('change',refresh)});refresh();window.addEventListener('resize',function(){clearTimeout(window.__v6GenResize);window.__v6GenResize=setTimeout(drawCached,180)})}
  return{init:init,refresh:refresh};
})();

document.addEventListener('DOMContentLoaded',function(){window.V62ControlGenerationHistory.init()});
