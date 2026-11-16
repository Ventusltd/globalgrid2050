import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDataRegistry,validateRegistry} from '../registry.mjs';
import {assetRows,selectRows,locationLink,latestHeadlines,voltageLabel} from '../model.mjs';
import {assetCsv} from '../views.mjs';
const source={type:'FeatureCollection',features:[{type:'Feature',id:'source:1',properties:{name:'Named substation',voltage:'132000'},geometry:{type:'Point',coordinates:[-1,52]}}]};
const bytes=Buffer.from(JSON.stringify(source));
const digest=createHash('sha256').update(bytes).digest('hex');
function spec(){return {schema:'globalgrid2050.pipeline-layers.v1',layers:[{id:'test',label:'Test',group:'Grid',owner:'Owner',renderer:'assets',data:{url:'https://example.org/pinned.json',sha256:digest,maxBytes:4096,rows:1,schema:'geojson.FeatureCollection'}}]};}
test('lazy source is fetched once; returned data cannot corrupt the cached snapshot',async()=>{
  let calls=0;const registry=createDataRegistry(spec(),{fetchImpl:async()=>{calls++;return new Response(bytes);}});
  assert.equal(calls,0);const a=await registry.load('test');a.features.length=0;
  const b=await registry.load('test');assert.equal(b.features.length,1);assert.equal(calls,1);
});
test('caller cannot mutate accepted manifest or its exposed dataset pins',async()=>{
  const manifest=spec();const registry=createDataRegistry(manifest,{fetchImpl:async()=>new Response(bytes)});
  manifest.layers[0].data.sha256='0'.repeat(64);
  assert.throws(()=>{registry.layers[0].data.sha256='0'.repeat(64);},TypeError);
  assert.equal((await registry.load('test')).features.length,1);
});
test('changed bytes fail before parsing or rendering and allow an explicit retry',async()=>{
  let bad=true;const registry=createDataRegistry(spec(),{fetchImpl:async()=>new Response(bad?Buffer.concat([bytes,Buffer.from(' ')]):bytes)});
  await assert.rejects(registry.load('test'),/integrity/);bad=false;assert.equal((await registry.load('test')).features.length,1);
});
test('stream size is enforced without trusting the declared content length',async()=>{
  const manifest=spec();manifest.layers[0].data.maxBytes=1;
  const registry=createDataRegistry(manifest,{fetchImpl:async()=>new Response(bytes)});
  await assert.rejects(registry.load('test'),/byte budget/);
});
test('failed HTTP, redirected inputs, count mismatch and unknown layers fail closed',async()=>{
  const failed=createDataRegistry(spec(),{fetchImpl:async()=>new Response('unavailable',{status:503})});
  await assert.rejects(failed.load('test'),/unavailable/);
  const manifest=spec();manifest.layers[0].data.rows=2;
  await assert.rejects(createDataRegistry(manifest,{fetchImpl:async()=>new Response(bytes)}).load('test'),/schema\/count/);
  await assert.rejects(failed.load('not-present'),/Unknown/);
});
test('invalid catalogue identities, unsafe URLs and unbounded browser products are rejected',()=>{
  const duplicate=spec();duplicate.layers.push(structuredClone(duplicate.layers[0]));assert.throws(()=>validateRegistry(duplicate),/duplicate/);
  for(const url of ['http://example.org/file','javascript:alert(1)','https://user:password@example.org/file']){const x=spec();x.layers[0].data.url=url;assert.throws(()=>validateRegistry(x));}
  const big=spec();big.layers[0].data.rows=100000;assert.throws(()=>validateRegistry(big),/row policy/);
});
test('missing names and locations remain unknown, with original source IDs',()=>{
  const collection=structuredClone(source);collection.features[0].properties={};collection.features[0].geometry=null;
  const [row]=assetRows(collection,'substation');assert.equal(row.name,null);assert.equal(row.coordinates,null);assert.equal(locationLink(row),null);assert.equal(row.sourceId,'source:1');
});
test('null/string coordinates do not become locations and duplicate identities are refused',()=>{
  const collection=structuredClone(source);collection.features[0].geometry.coordinates=[null,'52'];
  assert.equal(assetRows(collection,'substation')[0].coordinates,null);
  collection.features.push(collection.features[0]);assert.throws(()=>assetRows(collection,'substation'),/Duplicate/);
});
test('location links carry no fabricated REPD identity, MW or connection status',()=>{
  const row=assetRows(source,'substation')[0],url=new URL(locationLink(row));
  assert.equal(url.origin+url.pathname,'https://ventusltd.github.io/gridatlas/atlas/');assert.equal(url.searchParams.get('technology'),'substation');
  assert.equal(url.searchParams.get('longitude'),'-1');assert.equal(url.searchParams.has('repd_ref'),false);assert.equal(url.searchParams.has('capacity_mw'),false);
});
test('published OSM voltage remains voltage rather than capacity, with unknowns retained',()=>{
  assert.equal(voltageLabel('132000;33000'),'132 / 33 kV');assert.equal(voltageLabel(null),'Not recorded');
  assert.equal(voltageLabel('unknown'),'unknown');assert.equal(voltageLabel('0'),'0');
});
test('search and CSV cover the same selected rows; deliberate cross-domain overlap is retained',()=>{
  const rows=[...assetRows(source,'substation'),...assetRows(source,'offtaker')];assert.equal(rows.length,2);
  const selected=selectRows(rows,'source:1');assert.equal(selected.length,2);assert.equal(assetCsv(selected).split('\r\n').length,4);
  rows[0].name='=HYPERLINK("malicious")';assert.ok(assetCsv(rows).includes("'=HYPERLINK"));
});
test('ticker selects ten latest dated distinct HTTPS headlines without unsafe URLs',()=>{
  const items=Array.from({length:12},(_,i)=>({title:'Item '+i,link:'https://publisher.example/'+i,date:`2026-11-${String(i+1).padStart(2,'0')}`,source:'Publisher'}));
  items.push({...items[0]},{title:'Unsafe',link:'javascript:alert(1)',date:'2026-11-15'});
  const result=latestHeadlines(items);assert.equal(result.length,10);assert.equal(result[0].title,'Item 11');assert.equal(result.at(-1).title,'Item 2');
});
