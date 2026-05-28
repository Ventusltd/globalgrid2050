window.V5PriceHistoryData = (function(){
  var JSON_URL='/uk_energy_tracking_v5/electricity_price_history.json';
  var FOUR_BUCKET_URL='/uk_energy_tracking_v5/electricity_price_history_4bucket_decade.json';
  var ANNUAL_URL_BASE='/data/electricity/elexon_system_prices_';
  var FIRST_YEAR=2016;
  var ANNUAL_CACHE={};
  var CAPTURE_CACHE=null;
  var FOUR_BUCKET_CACHE=null;
  var TODAY=new Date();
  var MAX_DATE=new Date(Date.UTC(TODAY.getUTCFullYear(),TODAY.getUTCMonth(),TODAY.getUTCDate(),23,59,59));
  var MIN_DATE=new Date(Date.UTC(FIRST_YEAR,0,1,0,0,0));
  var MODES={HALFHOURLY:'halfhourly',FOUR_BUCKET:'4bucket'};
  function csvLine(l){var o=[],v='',q=false;for(var i=0;i<l.length;i++){var c=l[i];if(c==='"'){if(q&&l[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){o.push(v);v=''}else v+=c}o.push(v);return o}
  function parseCsv(t){t=(t||'').trim();if(!t)return[];var lines=t.split(/\r?\n/),h=csvLine(lines[0]).map(function(x){return x.trim()});return lines.slice(1).map(function(line){var c=csvLine(line),r={};h.forEach(function(x,i){r[x]=(c[i]||'').trim()});var p=r.systemBuyPriceGBPperMWh||r.systemSellPriceGBPperMWh||r.priceGBPperMWh||'';return{source:r.source||'Elexon BMRS System Prices',priceTimeUTC:r.periodStartUTC||r.priceTimeUTC||'',capturedAtUTC:r.fetchedAtUTC||r.capturedAtUTC||'',settlementDate:r.settlementDate||'',settlementPeriod:r.settlementPeriod||'',priceGBPperMWh:p,carbonGperKWh:r.carbonGperKWh||'',carbonIndex:r.carbonIndex||'',priceHealth:r.priceHealth||'historical system price',carbonHealth:r.carbonHealth||'',netImbalanceVolumeMWh:r.netImbalanceVolumeMWh||''}}).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))})}
  function norm(rows){var seen={};return(rows||[]).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))}).map(function(r){var o=Object.assign({},r);o.priceGBPperMWh=Number(o.priceGBPperMWh);return o}).sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)}).filter(function(r){var k=r.priceTimeUTC+'|'+r.priceGBPperMWh+'|'+(r.source||'');if(seen[k])return false;seen[k]=1;return true})}
  function loadCaptured(){if(CAPTURE_CACHE)return CAPTURE_CACHE;CAPTURE_CACHE=fetch(JSON_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return norm(d.rows||[])}).catch(function(){return[]});return CAPTURE_CACHE}
  function loadAnnual(year){if(ANNUAL_CACHE[year])return ANNUAL_CACHE[year];ANNUAL_CACHE[year]=fetch(ANNUAL_URL_BASE+year+'.csv?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():''}).then(parseCsv).then(norm).catch(function(){return[]});return ANNUAL_CACHE[year]}
  function loadFourBucket(){if(FOUR_BUCKET_CACHE)return FOUR_BUCKET_CACHE;FOUR_BUCKET_CACHE=fetch(FOUR_BUCKET_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return{rows:(d.rows||[]).map(function(r){return Object.assign({},r,{date:r.date})}),meta:d}}).catch(function(){return{rows:[],meta:{}}});return FOUR_BUCKET_CACHE}
  function yearsBetween(a,b){var y=[],s=a.getUTCFullYear(),e=b.getUTCFullYear();for(var n=s;n<=e;n++)y.push(n);return y}
  function periodDays(period){return {'7d':7,'30d':30,'3m':92,'6m':183,'1y':366,'5y':1827,'10y':3653}[period]||7}
  function periodLabel(period){return {'7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','1y':'1 year','5y':'5 years','10y':'10 years'}[period]||'1 week'}
  function modeForDays(days){return days<=183?MODES.HALFHOURLY:MODES.FOUR_BUCKET}
  function filterTimeMode(rows,timeMode){if(!timeMode||timeMode==='all')return rows;return rows.filter(function(r){var h=new Date(r.priceTimeUTC).getUTCHours(),day=h>=6&&h<18;return timeMode==='day'?day:!day})}
  function merge(sys,cap){var rows=[];sys.forEach(function(r){rows.push(Object.assign({},r,{source:'Elexon BMRS System Prices',priceHealth:r.priceHealth||'historical system price'}))});cap.forEach(function(r){rows.push(Object.assign({},r,{source:r.source||'V5 captured Elexon Market Index Price'}))});return norm(rows)}
  function loadHalfHourly(start,end,timeMode){var years=yearsBetween(start,end);return Promise.all([loadCaptured()].concat(years.map(loadAnnual))).then(function(parts){var cap=parts[0],sys=[];parts.slice(1).forEach(function(a){sys=sys.concat(a)});var all=merge(sys,cap);var rows=all.filter(function(r){var t=new Date(r.priceTimeUTC);return t>=start&&t<=end});rows=filterTimeMode(rows,timeMode);return{rows:rows,mode:MODES.HALFHOURLY,source:'Elexon annual CSVs plus V5 captured audit',sourceRows:sys.length,loadedYears:years,meta:{}}})}
  function loadFourBucketRange(start,end){return loadFourBucket().then(function(d){var rows=d.rows.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=start&&t<=end});return{rows:rows,mode:MODES.FOUR_BUCKET,source:'V5 4 bucket daily aggregate',sourceRows:d.rows.length,loadedYears:[],meta:d.meta||{}}})}
  function loadForWindow(win){var start=win.start,end=win.end,days=Math.max(1,Math.ceil((end-start)/86400000)),mode=modeForDays(days);if(mode===MODES.FOUR_BUCKET)return loadFourBucketRange(start,end).then(function(r){r.window=win;r.days=days;r.label=periodLabel(win.period);return r});return loadHalfHourly(start,end,win.timeMode).then(function(r){r.window=win;r.days=days;r.label=periodLabel(win.period);return r})}
  return {loadForWindow:loadForWindow,periodDays:periodDays,periodLabel:periodLabel,modeForDays:modeForDays,modes:MODES,FIRST_YEAR:FIRST_YEAR,MIN_DATE:MIN_DATE,MAX_DATE:MAX_DATE};
})();
