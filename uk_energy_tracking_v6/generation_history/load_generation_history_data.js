window.V6LoadGenerationHistoryData=(function(){
var cache={daily:null,recent:null};
function cfg(){return window.V6GenerationHistoryConfig}
function todayMax(){var d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),23,59,59))}
function minDate(){return new Date(Date.UTC((cfg().firstYear||2016),0,1,0,0,0))}
function groupFor(fuel){var f=String(fuel||'').toUpperCase();if(f.indexOf('SOLAR')===0||f.indexOf('PV')===0)return'Solar';if(f.indexOf('WIND')===0)return'Wind';if(f.indexOf('NPSHYD')===0||f.indexOf('HYDRO')===0)return'Hydro';if(f.indexOf('CCGT')===0||f.indexOf('OCGT')===0)return'Gas';if(f.indexOf('COAL')===0)return'Coal';if(f.indexOf('BIOMASS')===0)return'Biomass';if(f.indexOf('NUCLEAR')===0)return'Nuclear';if(f.indexOf('PS')===0)return'Pumped Storage';if(f.indexOf('INT')===0)return'Imports & Exports';return'Other'}
function periodDays(p){return{'12hday':0.5,'12hnight':0.5,'1d':1,'24h':1,'48h':2,'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[p]||7}
function periodLabel(p){return{'12hday':'12 hours day','12hnight':'12 hours night','1d':'1 day','24h':'24 hours','48h':'48 hours','7d':'1 week','30d':'1 month','3m':'3 months','6m':'3 months','12m':'12 months','5y':'5 years','10y':'10 years'}[p]||'1 week'}
function isDayNight(p){return p==='12hday'||p==='12hnight'}
function tierFor(p){return ['12hday','12hnight','1d','24h','48h','7d','30d'].indexOf(p)>=0?'recent':'daily'}
function isDaily(p){return tierFor(p)==='daily'}
function isAll(t){return!t||t==='All'}
function selectedWindow(start,period){var min=minDate(),max=todayMax();if(isDayNight(period))start.setUTCHours(period==='12hday'?6:18,0,0,0);if(start<min)start=new Date(min);if(start>max)start=new Date(max);var end=new Date(start.getTime()+periodDays(period)*86400000-1000);if(end>max)end=new Date(max);return{start:start,end:end,period:period,mode:tierFor(period)==='recent'?'halfhourly':'daily',tier:tierFor(period)}}
function sortHalf(rows){return rows.slice().sort(function(a,b){return new Date(a.time)-new Date(b.time)})}
function sortDaily(rows){return rows.slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0})}
function dedupe(rows,fn){var seen={};return rows.filter(function(r){var k=fn(r);if(seen[k])return false;seen[k]=1;return true})}
function loadJsonOnce(key,url){if(cache[key])return cache[key];cache[key]=fetch(url+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});return cache[key]}
function loadDaily(){return loadJsonOnce('daily',cfg().dailyHistory)}
function loadSolarDaily(){return loadJsonOnce('solarDaily',cfg().solarDaily||cfg().dailyHistory)}
function loadRecent(){return loadJsonOnce('recent',cfg().recentEcg||cfg().recentHalfHourly)}
function totalHalf(rows){var by={};rows.forEach(function(r){var k=r.time;if(!by[k])by[k]={time:k,generationMW:0,source:'Sum of generation technologies'};by[k].generationMW+=Number(r.generationMW)||0});return sortHalf(Object.keys(by).map(function(k){return by[k]}))}
function totalDaily(rows){var by={};rows.forEach(function(r){var k=r.date;if(!by[k])by[k]={date:k,averageMW:0,highMW:0,lowMW:0,source:'Sum of generation technologies'};by[k].averageMW+=Number(r.averageMW)||0;by[k].highMW+=Number(r.highMW)||0;by[k].lowMW+=Number(r.lowMW)||0});return sortDaily(Object.keys(by).map(function(k){return by[k]}))}
function seriesHalf(rows){var by={};rows.forEach(function(r){(by[r.technology]=by[r.technology]||[]).push(r)});return Object.keys(by).map(function(t){return{technology:t,rows:sortHalf(by[t])}})}
function seriesDaily(rows){var by={};rows.forEach(function(r){(by[r.technology]=by[r.technology]||[]).push(r)});return Object.keys(by).map(function(t){return{technology:t,rows:sortDaily(by[t])}})}
function loadHalf(meta,technology,timeMode){return loadRecent().then(function(all){var rows=all.filter(function(r){var t=new Date(r.time);if(t<meta.start||t>meta.end)return false;if(timeMode==='day'){var h=t.getUTCHours();return h>=6&&h<18}if(timeMode==='night'){var hn=t.getUTCHours();return hn>=18||hn<6}return true});rows=dedupe(sortHalf(rows),function(r){return r.time+'|'+r.technology});if(isAll(technology))return{rows:totalHalf(rows),series:seriesHalf(rows),technology:'All generation total'};var only=sortHalf(rows.filter(function(r){return r.technology===technology}));return{rows:only,series:[{technology:technology,rows:only}],technology:technology}})}
function loadDailyWindow(meta,technology){var source=technology==='Solar'?loadSolarDaily():loadDaily();return source.then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});rows=dedupe(sortDaily(rows),function(r){return r.date+'|'+r.technology});if(isAll(technology))return{rows:totalDaily(rows),series:seriesDaily(rows),technology:'All generation total'};var only=sortDaily(rows.filter(function(r){return r.technology===technology}));return{rows:only,series:[{technology:technology,rows:only}],technology:technology}})}
function loadWindow(start,period,technology,timeMode){var meta=selectedWindow(new Date(start),period),tech=technology||cfg().defaultTechnology||'Wind',build=meta.tier==='recent'?loadHalf(meta,tech,timeMode||'all'):loadDailyWindow(meta,tech);return build.then(function(out){return{mode:meta.mode,tier:meta.tier,start:meta.start,end:meta.end,period:period,technology:out.technology,timeMode:timeMode||'all',rows:out.rows,series:out.series}})}
return{loadWindow:loadWindow,periodDays:periodDays,periodLabel:periodLabel,isDaily:isDaily,minDate:minDate,maxDate:todayMax,groupFor:groupFor};
})();
