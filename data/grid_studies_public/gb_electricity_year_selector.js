(function(){
  var FIRST_YEAR=2016;
  var YEAR_ROLLOVER_MONTH=0;
  var YEAR_ROLLOVER_DAY=15;
  var PERIODS=[
    {value:'7d',label:'1 week'},
    {value:'30d',label:'1 month'},
    {value:'3m',label:'3 months'},
    {value:'6m',label:'6 months'},
    {value:'12m',label:'12 months Jan to Dec'}
  ];
  function $(id){return document.getElementById(id)}
  function activeDataYear(){var d=new Date();var y=d.getUTCFullYear();if(d.getUTCMonth()===YEAR_ROLLOVER_MONTH&&d.getUTCDate()<YEAR_ROLLOVER_DAY)return y-1;return y}
  function ymd(d){return d.toISOString().slice(0,10)}
  function label(year){return year===activeDataYear()?String(year)+' YTD':String(year)}
  function maxDate(){return window.V6LoadPriceHistoryData&&window.V6LoadPriceHistoryData.maxDate?window.V6LoadPriceHistoryData.maxDate():new Date()}
  function periodDays(period){return window.V6LoadPriceHistoryData&&window.V6LoadPriceHistoryData.periodDays?window.V6LoadPriceHistoryData.periodDays(period):365}
  function periodLabel(period){var found=PERIODS.filter(function(p){return p.value===period})[0];return found?found.label:period}
  function yearStart(year){return new Date(Date.UTC(year,0,1,0,0,0))}
  function yearEnd(year){return year===activeDataYear()?maxDate():new Date(Date.UTC(year,11,31,23,59,59))}
  function selectedYear(){var sel=$('gg2050-electricity-year-select');return sel?Number(sel.value):activeDataYear()}
  function selectedPeriod(){var sel=$('gg2050-electricity-period-select');return sel&&sel.value?sel.value:'12m'}
  function rangeFor(year,period){var start=yearStart(year),end=yearEnd(year);if(period==='12m')return{start:start,end:end};var days=periodDays(period),candidate=new Date(start.getTime()+days*86400000-1000);if(candidate<end)end=candidate;return{start:start,end:end}}
  function addStyles(){if($('gg2050-year-selector-style'))return;var s=document.createElement('style');s.id='gg2050-year-selector-style';s.textContent='.gg2050-year-period-controls{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin:0 0 10px 0}.gg2050-year-select-label{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid rgba(0,255,255,.45);border-radius:10px;padding:8px 10px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold}.gg2050-year-select-label select{background:#05070c;color:#fff;border:1px solid rgba(0,255,255,.35);border-radius:8px;padding:8px;font-family:Courier New,Courier,monospace;font-weight:bold;min-width:48%}.gg2050-apply-selection{grid-column:1 / -1;border:1px solid #00ffff;border-radius:10px;padding:10px 12px;color:#00ffff;background:#051014;font-family:Courier New,Courier,monospace;font-weight:bold;cursor:pointer;text-align:left}.gg2050-apply-selection.active{background:#06282c;color:#fff;box-shadow:0 0 14px rgba(0,255,255,.25)}@media(max-width:700px){.gg2050-year-period-controls{grid-template-columns:1fr}.gg2050-year-select-label{width:100%}.gg2050-year-select-label select{width:55%}}';document.head.appendChild(s)}
  function filterRows(result,start,end){result.rows=(result.rows||[]).filter(function(r){var raw=r.date?r.date+'T12:00:00Z':(r.priceTimeUTC||r.time);var t=new Date(raw);return t>=start&&t<=end});return result}
  function clearPresetButtons(){var grid=$('preset-grid');if(!grid)return;grid.querySelectorAll('button').forEach(function(b){b.classList.remove('active')});var apply=$('gg2050-apply-selection');if(apply)apply.classList.add('active')}
  function renderSelection(){var year=selectedYear(),period=selectedPeriod(),range=rangeFor(year,period);clearPresetButtons();window.V6LoadPriceHistoryData.loadWindow(range.start,period,'all').then(function(result){result.end=range.end;result.period=period;filterRows(result,range.start,range.end);window.V6RenderPriceChart.render(result);var status=$('price-history-range-status');if(status)status.textContent=ymd(range.start)+' to '+ymd(range.end)+' | '+label(year)+' | '+periodLabel(period)+' | '+(result.rows||[]).length.toLocaleString('en-GB')+' points';}).catch(function(err){var status=$('price-history-range-status');if(status)status.textContent='Year and period chart load failed: '+err;});}
  function buildSelect(id,items,value){var sel=document.createElement('select');sel.id=id;items.forEach(function(item){var o=document.createElement('option');o.value=item.value;o.textContent=item.label;sel.appendChild(o)});sel.value=value;return sel}
  function init(){var grid=$('preset-grid');if(!grid||$('gg2050-electricity-year-select'))return;if(!window.V6LoadPriceHistoryData||!window.V6RenderPriceChart)return;addStyles();var wrap=document.createElement('div');wrap.className='gg2050-year-period-controls';var yearLab=document.createElement('label');yearLab.className='gg2050-year-select-label';yearLab.appendChild(document.createTextNode('Year'));var years=[],active=activeDataYear();for(var y=active;y>=FIRST_YEAR;y--)years.push({value:String(y),label:label(y)});var yearSel=buildSelect('gg2050-electricity-year-select',years,String(active));yearLab.appendChild(yearSel);var periodLab=document.createElement('label');periodLab.className='gg2050-year-select-label';periodLab.appendChild(document.createTextNode('Period'));var periodSel=buildSelect('gg2050-electricity-period-select',PERIODS,'12m');periodLab.appendChild(periodSel);var apply=document.createElement('button');apply.type='button';apply.id='gg2050-apply-selection';apply.className='gg2050-apply-selection';apply.textContent='Apply selected year and period';wrap.appendChild(yearLab);wrap.appendChild(periodLab);wrap.appendChild(apply);grid.insertBefore(wrap,grid.firstChild);function userChanged(){renderSelection()}yearSel.addEventListener('change',userChanged);yearSel.addEventListener('input',userChanged);periodSel.addEventListener('change',userChanged);periodSel.addEventListener('input',userChanged);apply.addEventListener('click',renderSelection);setTimeout(renderSelection,120)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
