/* Daily historical system-sell data only. The data owner defines its grain. */
export const SOURCE = Object.freeze({
  repository: 'Ventusltd/data-gb-electricity',
  commit: 'cf48c8d6fdd9ab686c4af7261149d81a0129f7fc',
  base: 'https://raw.githubusercontent.com/Ventusltd/data-gb-electricity/cf48c8d6fdd9ab686c4af7261149d81a0129f7fc/derived/price-daily-browser/',
  index: Object.freeze({path:'index.json',bytes:3616,sha256:'3c3ad8e0d8169b4bc253dabbad2a7d35b64984f40accce1abd016e1ca15a1e8e'})
});
const SCHEMA='data-gb-electricity.system-sell-daily.v1',BASIS='ELEXON_SYSTEM_SELL_PRICE',DAY=86400000;
const fail=(ok,message)=>{if(!ok)throw Error('Daily prices rejected: '+message);};
const integer=(n,max=2000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export function dateMs(date){
  fail(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date),'date');
  const n=Date.parse(date+'T00:00:00Z');fail(Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===date,'calendar date');return n;
}
export const dateAt=n=>new Date(n).toISOString().slice(0,10);
function lastSunday(year,month){const d=new Date(Date.UTC(year,month+1,0));return dateAt(d.getTime()-d.getUTCDay()*DAY);}
export function expectedPeriods(date){const year=Number(date.slice(0,4));dateMs(date);fail(year>=1996&&year<=2100,'GB calendar range');return date===lastSunday(year,2)?46:date===lastSunday(year,9)?50:48;}
function pin(value,path,max){fail(value?.path===path&&integer(value.bytes,max)&&value.bytes>0&&hash(value.sha256),'part identity');}
export function validateIndex(index){
  fail(index?.schema===SCHEMA+'.index'&&index.unit==='GBP/MWh'&&index.price_basis===BASIS,'index schema/basis');
  const first=dateMs(index.first_date),last=dateMs(index.last_date);
  fail(last>=first&&index.rows===(last-first)/DAY+1&&integer(index.rows,40000),'date span');
  fail(integer(index.source_periods)&&index.source_periods>0&&index.source_periods===index.observed_periods&&
    integer(index.priced_periods)&&index.priced_periods<=index.observed_periods&&
    integer(index.utc_alignment_mismatches)&&index.utc_alignment_mismatches<=index.observed_periods,'input counters');
  fail(hash(index.producer_sha256)&&typeof index.calendar_quality==='string'&&index.calendar_quality.includes('Source-declared'),'producer/quality');
  pin(index.sources,'sources.json',100000);pin(index.parquet,'daily.parquet',2000000);
  fail(Array.isArray(index.parts)&&index.parts.length>0&&index.parts.length<=100,'annual parts');
  let previous=Number(index.first_date.slice(0,4))-1,total=0;
  for(const p of index.parts){
    fail(integer(p.year,2100)&&p.year===previous+1,'ordered years');previous=p.year;pin(p,p.year+'.json',150000);
    const a=Math.max(first,Date.UTC(p.year,0,1)),b=Math.min(last,Date.UTC(p.year+1,0,1)-DAY);
    fail(b>=a&&p.calendar_days===(b-a)/DAY+1&&['observed_days','complete_days','partial_days','missing_days'].every(k=>integer(p[k],366))&&
      p.complete_days+p.partial_days===p.observed_days&&p.observed_days+p.missing_days===p.calendar_days,'year coverage');total+=p.calendar_days;
  }
  fail(total===index.rows&&previous===Number(index.last_date.slice(0,4)),'calendar population');return index;
}
export function validateYear(data,part,index){
  fail(data?.schema===SCHEMA&&data.year===part.year&&data.unit==='GBP/MWh'&&data.price_basis===BASIS&&Array.isArray(data.rows),'year schema/basis');
  const start=Math.max(dateMs(index.first_date),Date.UTC(part.year,0,1));let complete=0,partial=0,missing=0;
  fail(data.rows.length===part.calendar_days,'year row count');
  for(let i=0;i<data.rows.length;i++){
    const r=data.rows[i];fail(r?.date===dateAt(start+i*DAY)&&r.expected_periods===expectedPeriods(r.date),'daily calendar');
    fail(integer(r.observed_periods,50)&&integer(r.priced_periods,50)&&r.priced_periods<=r.observed_periods&&r.observed_periods<=r.expected_periods&&
      integer(r.utc_alignment_mismatches,50)&&r.utc_alignment_mismatches<=r.observed_periods,'daily grain');
    const status=!r.observed_periods?'NO_OBSERVATIONS':r.priced_periods===r.observed_periods&&r.observed_periods===r.expected_periods?'COMPLETE_SOURCE_DAY':'PARTIAL_SOURCE_DAY';
    fail(r.coverage_status===status&&Number.isFinite(r.price_coverage_pct)&&Math.abs(r.price_coverage_pct-100*r.priced_periods/r.expected_periods)<0.000001,'daily coverage');
    const values=[r.minimum_observed_gbp_per_mwh,r.mean_available_gbp_per_mwh,r.maximum_observed_gbp_per_mwh];
    fail(r.priced_periods?values.every(Number.isFinite)&&values[0]<=values[1]&&values[1]<=values[2]:values.every(v=>v===null),'daily prices/nulls');
    if(status==='COMPLETE_SOURCE_DAY')complete++;else if(status==='PARTIAL_SOURCE_DAY')partial++;else missing++;
  }
  fail(complete===part.complete_days&&partial===part.partial_days&&missing===part.missing_days,'observed year coverage');return data.rows;
}
export async function readPinned(url,pin,transport=fetch){
  fail(url.startsWith(SOURCE.base)&&/^\d{4}\.json$|^index\.json$/.test(url.slice(SOURCE.base.length)),'immutable source URL');
  fail(integer(pin?.bytes,150000)&&pin.bytes>0&&hash(pin.sha256),'byte/hash bound');
  const response=await transport(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(15000)});
  fail(response.ok&&!response.redirected,'HTTP response');const reader=response.body?.getReader();fail(reader,'bounded response stream');
  const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>pin.bytes){await reader.cancel();throw Error('Daily prices rejected: byte limit');}chunks.push(value);}
  fail(size===pin.bytes,'exact bytes');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  fail(actual===pin.sha256,'SHA-256');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export async function createStore(transport=fetch){
  const index=validateIndex(await readPinned(SOURCE.base+'index.json',SOURCE.index,transport)),cache=new Map();
  async function year(n){
    const part=index.parts.find(p=>p.year===n);fail(part,'available year');
    if(cache.has(n)){const promise=cache.get(n);cache.delete(n);cache.set(n,promise);return promise;}
    const promise=readPinned(SOURCE.base+part.path,part,transport).then(data=>validateYear(data,part,index)).catch(e=>{if(cache.get(n)===promise)cache.delete(n);throw e;});
    cache.set(n,promise);if(cache.size>3)cache.delete(cache.keys().next().value);return promise;
  }
  return {index,async window(start,end){
    const a=Math.max(dateMs(start),dateMs(index.first_date)),b=Math.min(dateMs(end),dateMs(index.last_date));
    fail(b>=a&&(b-a)/DAY<366,'bounded historical window');
    const years=[];for(let y=new Date(a).getUTCFullYear();y<=new Date(b).getUTCFullYear();y++)years.push(y);
    const rows=(await Promise.all(years.map(year))).flat().filter(r=>dateMs(r.date)>=a&&dateMs(r.date)<=b);
    fail(rows.length===(b-a)/DAY+1,'window calendar continuity');return {start:dateAt(a),end:dateAt(b),rows};
  }};
}
export function summarise(rows){
  const values=rows.filter(r=>r.priced_periods>0);return {
    calendarDays:rows.length,completeDays:rows.filter(r=>r.coverage_status==='COMPLETE_SOURCE_DAY').length,
    partialDays:rows.filter(r=>r.coverage_status==='PARTIAL_SOURCE_DAY').length,missingDays:rows.filter(r=>r.coverage_status==='NO_OBSERVATIONS').length,
    expected:rows.reduce((n,r)=>n+r.expected_periods,0),observed:rows.reduce((n,r)=>n+r.observed_periods,0),priced:rows.reduce((n,r)=>n+r.priced_periods,0),
    clockMismatches:rows.reduce((n,r)=>n+r.utc_alignment_mismatches,0),
    dailyMean:values.length?values.reduce((n,r)=>n+r.mean_available_gbp_per_mwh,0)/values.length:null,
    high:values.length?Math.max(...values.map(r=>r.maximum_observed_gbp_per_mwh)):null,
    low:values.length?Math.min(...values.map(r=>r.minimum_observed_gbp_per_mwh)):null};
}
export function segments(rows,field){
  const output=[];let current=[],previous=null;
  for(const row of rows){
    const value=row[field],t=dateMs(row.date);
    if(!Number.isFinite(value)||!row.priced_periods||previous!==null&&t-previous!==DAY){if(current.length)output.push(current);current=[];}
    if(Number.isFinite(value)&&row.priced_periods)current.push({date:row.date,value,partial:row.coverage_status!=='COMPLETE_SOURCE_DAY'});
    previous=t;
  }
  if(current.length)output.push(current);return output;
}
export function trailingWindow(end,days,first){const b=dateMs(end);fail(integer(days,366)&&days>0,'window length');return {start:dateAt(Math.max(dateMs(first),b-(days-1)*DAY)),end};}
