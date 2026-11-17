import {SOURCE,createStore,summarise,trailingWindow,dateMs,dateAt} from './model.mjs';
import {drawDaily} from './canvas.mjs';
const MOUNTS=new WeakMap();
const number=n=>n.toLocaleString('en-GB'),money=n=>n===null?'Not available':'£'+n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+'/MWh';
const element=(doc,tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function anchor(doc,label,url){const a=element(doc,'a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
export function mountDailyPrices(host,{transport=fetch}={}){
  if(host?.nodeType!==1)throw Error('Daily price host required');if(MOUNTS.has(host))return MOUNTS.get(host);
  const doc=host.ownerDocument,root=element(doc,'section',undefined,'pn-daily-prices');root.setAttribute('aria-label','Historical daily system-sell prices');
  root.append(element(doc,'h3','Historical electricity system-sell prices'));
  const sourceLine=element(doc,'p','Loading dated source data…','pnd-source');root.append(sourceLine);
  const tools=element(doc,'div',undefined,'pnd-tools'),year=element(doc,'select'),period=element(doc,'select'),end=element(doc,'input');end.type='date';
  year.setAttribute('aria-label','Source year');period.setAttribute('aria-label','Daily window');end.setAttribute('aria-label','Window end date');
  for(const [value,label] of [['30','30 days'],['90','90 days'],['365','365 days'],['year','Selected year']]){const option=element(doc,'option',label);option.value=value;period.append(option);}
  for(const [label,input] of [['Year',year],['Window',period],['End date',end]]){const item=element(doc,'label',label);item.append(input);tools.append(item);}root.append(tools);
  const status=element(doc,'p','Loading…','pnd-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
  const canvas=element(doc,'canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Daily high, available mean and low system-sell prices; gaps and partial source days retained.');root.append(canvas);
  const stats=element(doc,'dl',undefined,'pnd-stats');root.append(stats);
  const coverage=element(doc,'p',undefined,'pnd-coverage'),quality=element(doc,'p',undefined,'pnd-quality');root.append(coverage,quality);
  root.append(element(doc,'p','Historical observations only. Daily groups use source-declared GB settlement dates. Complete source-day coverage does not certify stored UTC alignment.','pnd-note'));
  const details=element(doc,'details'),summary=element(doc,'summary','Source and daily observations');details.append(summary);
  const links=element(doc,'p');links.append(anchor(doc,'Pinned data index',SOURCE.base+'index.json'),doc.createTextNode(' · '),anchor(doc,'Source file hashes',SOURCE.base+'sources.json'),doc.createTextNode(' · '),anchor(doc,'Data-owner method','https://github.com/'+SOURCE.repository+'/blob/'+SOURCE.commit+'/derived/PRICE_DAILY_BROWSER.md'));details.append(links);
  details.append(element(doc,'p','Elexon system-sell prices, GBP/MWh. Daily means use available prices; the displayed window mean is the unweighted mean of available daily means. Partial days can affect that mean. No market-index merge, interpolation, forecast or realtime quote.'));
  const tableWrap=element(doc,'div',undefined,'pnd-table'),table=element(doc,'table'),thead=element(doc,'thead'),header=element(doc,'tr');
  for(const label of ['Source date','Available mean £/MWh','High £/MWh','Low £/MWh','Priced / expected','Source-day coverage','UTC disagreements']){const th=element(doc,'th',label);th.scope='col';header.append(th);}thead.append(header);const tbody=element(doc,'tbody');table.append(thead,tbody);tableWrap.append(table);details.append(tableWrap);root.append(details);
  host.append(root);tools.hidden=true;canvas.hidden=true;stats.hidden=true;coverage.hidden=true;quality.hidden=true;
  let store=null,closed=false,generation=0,current=null,resizeFrame=null;
  function paint(result){
    if(closed)return;current=result;const s=summarise(result.rows);canvas.hidden=false;stats.hidden=false;coverage.hidden=false;quality.hidden=false;
    const receipt=drawDaily(canvas,result);canvas.dataset.series=JSON.stringify(receipt);
    status.textContent=result.start+' to '+result.end+' · '+number(s.calendarDays)+' calendar days';root.dataset.state='available';
    stats.replaceChildren();for(const [label,value] of [['High observed',money(s.high)],['Mean of available daily means',money(s.dailyMean)],['Low observed',money(s.low)]]){const block=element(doc,'div');block.append(element(doc,'dt',label),element(doc,'dd',value));stats.append(block);}
    coverage.textContent=number(s.completeDays)+' complete source days · '+number(s.partialDays)+' partial · '+number(s.missingDays)+' missing · '+number(s.priced)+' priced / '+number(s.expected)+' expected periods ('+number(s.observed)+' observed).';
    quality.textContent='Stored UTC disagreements: '+number(s.clockMismatches)+' in this window; '+number(store.index.utc_alignment_mismatches)+' in the full source snapshot. History is retained without timestamp repair.';
    tbody.replaceChildren();for(const row of result.rows){const tr=element(doc,'tr');for(const value of [row.date,row.mean_available_gbp_per_mwh,row.maximum_observed_gbp_per_mwh,row.minimum_observed_gbp_per_mwh,row.priced_periods+' / '+row.expected_periods,row.coverage_status,row.utc_alignment_mismatches])tr.append(element(doc,'td',value===null?'Not available':String(value)));tbody.append(tr);}
  }
  async function load(){
    if(!store||closed)return;const token=++generation;root.dataset.state='loading';status.textContent='Loading selected source days…';
    // Hide the previous window while another window is loading or fails.
    canvas.hidden=true;stats.hidden=true;coverage.hidden=true;quality.hidden=true;tbody.replaceChildren();current=null;
    try{
      const last=store.index.last_date,first=store.index.first_date;
      const boundedEnd=dateAt(Math.min(dateMs(last),Math.max(dateMs(first),dateMs(end.value))));end.value=boundedEnd;
      let range;
      if(period.value==='year'){const y=Number(year.value);range={start:dateAt(Math.max(dateMs(first),Date.UTC(y,0,1))),end:dateAt(Math.min(dateMs(last),Date.UTC(y+1,0,1)-86400000))};end.value=range.end;}
      else{range=trailingWindow(boundedEnd,Number(period.value),first);year.value=boundedEnd.slice(0,4);}
      const result=await store.window(range.start,range.end);if(!closed&&token===generation)paint(result);
    }catch{if(!closed&&token===generation){root.dataset.state='unavailable';status.textContent='Selected daily price data unavailable. Inspect the pinned source links or select another window.';}}
  }
  year.addEventListener('change',()=>{period.value='year';void load();});period.addEventListener('change',()=>void load());end.addEventListener('change',()=>{if(period.value==='year')period.value='30';void load();});
  const resize=new ResizeObserver(()=>{if(!current||closed)return;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(current&&!closed)drawDaily(canvas,current);});});resize.observe(root);
  const controller={ready:null,disconnect(){closed=true;generation++;resize.disconnect();cancelAnimationFrame(resizeFrame);root.remove();MOUNTS.delete(host);}};
  MOUNTS.set(host,controller);
  controller.ready=(async()=>{
    try{
      store=await createStore(transport);if(closed)return;const index=store.index;
      sourceLine.textContent='Latest source date: '+index.last_date+' · historical Elexon system-sell prices · GBP/MWh';
      for(const part of [...index.parts].reverse()){const option=element(doc,'option',String(part.year));option.value=String(part.year);year.append(option);}
      year.value=index.last_date.slice(0,4);end.min=index.first_date;end.max=index.last_date;end.value=index.last_date;tools.hidden=false;await load();
    }catch{if(!closed){root.dataset.state='unavailable';sourceLine.textContent='Historical system-sell source unavailable.';status.textContent='Daily price data unavailable. The original electricity workspace remains separate.';}}
  })();return controller;
}
