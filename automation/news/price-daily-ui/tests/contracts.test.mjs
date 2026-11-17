import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SOURCE,dateMs,expectedPeriods,validateIndex,validateYear,readPinned,segments,summarise,trailingWindow} from '../model.mjs';
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const pin=path=>({path,bytes:100,sha256:'a'.repeat(64)});
const row=(date,mean,priced=48,expected=48)=>({date,expected_periods:expected,observed_periods:priced,priced_periods:priced,
 coverage_status:priced===0?'NO_OBSERVATIONS':priced===expected?'COMPLETE_SOURCE_DAY':'PARTIAL_SOURCE_DAY',utc_alignment_mismatches:0,
 price_coverage_pct:Math.round(100000000*priced/expected)/1000000,mean_available_gbp_per_mwh:mean,
 minimum_observed_gbp_per_mwh:mean===null?null:mean-10,maximum_observed_gbp_per_mwh:mean===null?null:mean+10});
function fixture(){
 const rows=[row('2026-01-01',-5),row('2026-01-02',null,0),row('2026-01-03',15,24)];
 const part={...pin('2026.json'),year:2026,calendar_days:3,observed_days:2,complete_days:1,partial_days:1,missing_days:1};
 const index={schema:'data-gb-electricity.system-sell-daily.v1.index',unit:'GBP/MWh',price_basis:'ELEXON_SYSTEM_SELL_PRICE',
  first_date:'2026-01-01',last_date:'2026-01-03',rows:3,source_periods:72,observed_periods:72,priced_periods:72,
  utc_alignment_mismatches:0,producer_sha256:'b'.repeat(64),calendar_quality:'Source-declared dates retained',sources:pin('sources.json'),parquet:pin('daily.parquet'),parts:[part]};
 const data={schema:'data-gb-electricity.system-sell-daily.v1',year:2026,unit:'GBP/MWh',price_basis:'ELEXON_SYSTEM_SELL_PRICE',rows};return {index,part,data,rows};
}
test('GB spring and autumn days are46/50; ordinary leap days48',()=>{
 assert.equal(expectedPeriods('2026-03-29'),46);assert.equal(expectedPeriods('2026-10-25'),50);assert.equal(expectedPeriods('2016-10-30'),50);assert.equal(expectedPeriods('2024-02-29'),48);
 assert.throws(()=>dateMs('2026-02-29'));assert.throws(()=>expectedPeriods('1995-01-01'));
});
test('accepted daily schema distinguishes missing, partial and complete',()=>{
 const {index,part,data}=fixture();assert.equal(validateIndex(index),index);assert.equal(validateYear(data,part,index),data.rows);
});
test('index rejects swapped basis, traversal, duplicate years and false coverage',()=>{
 for(const mutate of [i=>i.price_basis='MARKET_INDEX',i=>i.parts[0].path='../2026.json',i=>i.parts.push(i.parts[0]),i=>i.parts[0].complete_days=2,i=>i.source_periods=73,i=>i.sources.path='https://bad.example/a']){
  const {index}=fixture();mutate(index);assert.throws(()=>validateIndex(index));
 }
});
test('daily row validation rejects null-to-zero, fake completeness and impossible clocks',()=>{
 for(const mutate of [d=>d.rows[1].mean_available_gbp_per_mwh=0,d=>d.rows[2].coverage_status='COMPLETE_SOURCE_DAY',d=>d.rows[0].utc_alignment_mismatches=49,d=>d.rows[0].minimum_observed_gbp_per_mwh=100,d=>d.rows[2].date='2026-01-04']){
  const {index,part,data}=fixture();mutate(data);assert.throws(()=>validateYear(data,part,index));
 }
});
test('negative values remain prices; missing days break every series withoutzero',()=>{
 const {rows}=fixture();for(const field of ['mean_available_gbp_per_mwh','minimum_observed_gbp_per_mwh','maximum_observed_gbp_per_mwh']){
  const result=segments(rows,field);assert.deepEqual(result.map(g=>g.map(p=>p.date)),[['2026-01-01'],['2026-01-03']]);
 }
 assert.equal(segments(rows,'mean_available_gbp_per_mwh')[0][0].value,-5);
});
test('omitted calendar rows also break connected paths; realzero stays',()=>{
 const rows=[row('2026-01-01',0),row('2026-01-03',3)];const groups=segments(rows,'mean_available_gbp_per_mwh');
 assert.equal(groups.length,2);assert.equal(groups[0][0].value,0);
});
test('partial days are retained and marked; clock quality is independent',()=>{
 const {rows}=fixture();rows[0].utc_alignment_mismatches=48;
 const s=summarise(rows);assert.equal(s.clockMismatches,48);assert.equal(s.completeDays,1);assert.equal(s.partialDays,1);assert.equal(s.missingDays,1);
 assert.equal(s.dailyMean,5);assert.equal(s.priced,72);assert.equal(s.expected,144);assert.equal(s.low,-15);
 assert.equal(segments(rows,'mean_available_gbp_per_mwh')[1][0].partial,true);
});
test('all-missing windows have null summary values without an indicative baseline',()=>{
 const s=summarise([row('2026-01-01',null,0)]);assert.equal(s.dailyMean,null);assert.equal(s.high,null);assert.equal(s.low,null);
});
test('last30source days anchorOct31 even when wallclock differs',()=>{
 assert.deepEqual(trailingWindow('2026-10-31',30,'2016-01-01'),{start:'2026-10-02',end:'2026-10-31'});
 assert.deepEqual(trailingWindow('2016-01-03',30,'2016-01-01'),{start:'2016-01-01',end:'2016-01-03'});
 assert.throws(()=>trailingWindow('2026-10-31',1000,'2016-01-01'));
});
test('bounded immutable loader rejects changed, excessive and short bytes',async()=>{
 const raw=new TextEncoder().encode('{"fixture":"metadata only"}'),p={bytes:raw.length,sha256:sha(raw)},url=SOURCE.base+'2026.json';
 assert.deepEqual(await readPinned(url,p,async()=>new Response(raw)),{fixture:'metadata only'});
 await assert.rejects(readPinned(url,{...p,sha256:'0'.repeat(64)},async()=>new Response(raw)),/SHA/);
 await assert.rejects(readPinned(url,{...p,bytes:raw.length-1},async()=>new Response(raw)),/byte limit/);
 await assert.rejects(readPinned(url,{...p,bytes:raw.length+1},async()=>new Response(raw)),/exact bytes/);
});
test('invalid endpoint or bounds fail before transport; redirects andHTTPerrorsreject',async()=>{
 for(const [url,p] of [['https://127.0.0.1/',{bytes:2,sha256:'a'.repeat(64)}],[SOURCE.base+'../index.json',{bytes:2,sha256:'a'.repeat(64)}],[SOURCE.base+'index.json',{bytes:Infinity,sha256:'a'.repeat(64)}]]){
  let called=false;await assert.rejects(readPinned(url,p,async()=>{called=true;return new Response('{}');}));assert.equal(called,false);
 }
 await assert.rejects(readPinned(SOURCE.base+'index.json',{bytes:2,sha256:sha('{}')},async()=>new Response('{}',{status:503})),/HTTP/);
 await assert.rejects(readPinned(SOURCE.base+'index.json',{bytes:2,sha256:sha('{}')},async()=>({ok:true,redirected:true})),/HTTP/);
});
