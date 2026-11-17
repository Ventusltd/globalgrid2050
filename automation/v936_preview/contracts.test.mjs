import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {latestHeadlines} from '../../uk_renewables_pipeline/202611171507/scripts/layers/model.mjs';
const asOf=Date.parse('2026-11-17T23:00:00Z');
const fixture=count=>Array.from({length:count},(_,i)=>({title:'Synthetic attributed headline '+i,source:'Fixture publisher',link:'https://publisher.example/article/'+i,date:new Date(Date.parse('2026-11-01T00:00:00Z')+i*60000).toISOString(),first_seen:'2026-11-17T00:00:00Z'}));
for(const count of [0,1,10,71,100])test('available '+count+' headlines stay '+count+' without padding',()=>{
 const input=fixture(count),copy=structuredClone(input),result=latestHeadlines(input,100,{asOf});assert.equal(result.length,count);assert.equal(new Set(result.map(row=>row.link)).size,count);assert.deepEqual(input,copy);
 for(const row of result){const original=input.find(item=>item.link===row.link);assert.equal(row.title,original.title);assert.equal(row.source,original.source);assert.equal(row.date,original.date);assert.equal(row.dateKind,'Publisher date');}
});
test('default ceiling100 and explicit10 retain latest deterministic source order',()=>{
 const items=fixture(130);assert.equal(latestHeadlines(items,undefined,{asOf}).length,100);const ten=latestHeadlines(items,10,{asOf});assert.equal(ten.length,10);assert.equal(ten[0].title,items.at(-1).title);assert.equal(ten.at(-1).title,items.at(-10).title);
 for(const value of [0,-1,101,1.2,'10',NaN])assert.deepEqual(latestHeadlines(items,value,{asOf}),[]);
});
test('duplicates collapse by source URL and latest genuine date wins',()=>{
 const items=fixture(2);items.push({...items[0],date:'2026-11-10',title:'Updated source headline'});const result=latestHeadlines(items,100,{asOf});assert.equal(result.length,2);assert.equal(result[0].title,'Updated source headline');
});
test('unsafe URLs, malformed/impossible/future clocks and blank titles withheld',()=>{
 const original=fixture(1)[0];
 for(const date of ['2026-02-30','2026-11-31T12:00:00Z','2026-11-17T24:00:00Z','2050-01-01','not-a-date','2026-13-01'])assert.deepEqual(latestHeadlines([{...original,date}],100,{asOf}),[],date);
 for(const link of ['javascript:alert(1)','http://publisher.example/a','https://user:pass@publisher.example/a','https://127.0.0.1/a','https://localhost/a','https://192.168.1.1/a','https://[::1]/a','https://router.internal/a'])assert.deepEqual(latestHeadlines([{...original,link}],100,{asOf}),[],link);
 for(const title of ['', '   ',null,{},'x'.repeat(1001)])assert.deepEqual(latestHeadlines([{...original,title}],100,{asOf}),[]);
 assert.deepEqual(latestHeadlines(null),[]);assert.deepEqual(latestHeadlines(Array(10001).fill(original)),[]);assert.deepEqual(latestHeadlines([original],100,{asOf:NaN}),[]);
});
test('first-collected fallback and missing attribution remain explicitly unknown',()=>{
 const item={...fixture(1)[0],date:null,first_seen:'2026-11-16T09:17:00Z',source:null};const [row]=latestHeadlines([item],100,{asOf});assert.equal(row.dateKind,'First collected');assert.equal(row.date,item.first_seen);assert.equal(row.source,'Publisher not supplied');
 assert.deepEqual(latestHeadlines([{...item,first_seen:null}],100,{asOf}),[]);
 assert.equal(latestHeadlines([{...item,date:'2024-02-29'}],100,{asOf})[0].dateKind,'Publisher date');
});
test('actual saved source snapshot supplies71 real attributed links and unchanged clocks',()=>{
 const path=new URL('../../uk_renewables_pipeline/202611171507/news/pipeline_headlines.snapshot.json',import.meta.url),bytes=readFileSync(path),doc=JSON.parse(bytes);const result=latestHeadlines(doc.items,100,{asOf});assert.equal(doc.items.length,71);assert.equal(result.length,71);
 for(const row of result){const original=doc.items.find(item=>item.link===row.link);assert.ok(original);assert.equal(row.title,original.title);assert.equal(row.source,original.source);assert.equal(row.date,original.date||original.first_seen);}
 console.log('Pinned saved snapshot SHA256 '+createHash('sha256').update(bytes).digest('hex')+'; generated '+doc.generated_at+'; eligible '+result.length);
});
