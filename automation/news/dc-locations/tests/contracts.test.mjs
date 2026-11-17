import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {indexLocations,screenUrl,loadLocations,INPUT} from '../actions.mjs';

function fixture() {
  return {type:'FeatureCollection',schema:'data-grid-gb.dc-address-locations.v1',
    counts:{records:1,with_geometry:1,unknown_geometry:0,postcode_centroids:1,with_address:1},
    features:[{type:'Feature',id:'DC-WD-Q1',geometry:{type:'Point',coordinates:[-0.1,51.5]},properties:{
      id:'DC-WD-Q1',wikidata_id:'Q1',name:'SYNTHETIC <site>',country:{code:'GB'},
      addresses:[{text:'1 Synthetic Street, London SW1A 1AA'}],location_precision:'POSTCODE_CENTROID_APPROXIMATE',
      source_revision_url:'https://www.wikidata.org/w/index.php?title=Q1&oldid=1',
      geometry_licence:'OS OpenData: GB postcode source terms',geometry_licence_url:'https://postcodes.io/docs/licences/',
      geometry_attribution:['SYNTHETIC attribution'],grid_connection_assessed:false,facility_identity_review:'NOT_INDEPENDENTLY_VERIFIED',
      screening_url:'javascript:globalThis.__probe=1'}}]};
}

test('exact original IDs and actual counts are required',()=>{
 const d=fixture();assert.equal(indexLocations(d).size,1);
 d.features.push(structuredClone(d.features[0]));d.counts.records=2;
 assert.throws(()=>indexLocations(d),/identity/);
});
test('count mismatches and false verification claims reject',()=>{
 const d=fixture();d.counts.with_geometry=0;assert.throws(()=>indexLocations(d),/counts/);
 const e=fixture();e.features[0].properties.facility_identity_review='VERIFIED';assert.throws(()=>indexLocations(e),/scope/);
});
test('unsafe or unrelated source-revision links reject',()=>{
 for(const url of ['javascript:alert(1)','https://127.0.0.1/a','https://www.wikidata.org/w/index.php?title=Q2&oldid=1','https://u@www.wikidata.org/w/index.php?title=Q1&oldid=1','https://www.wikidata.org/w/index.php?title=Q1&title=Q2&oldid=1']){
  const d=fixture();d.features[0].properties.source_revision_url=url;assert.throws(()=>indexLocations(d));
 }
});
test('direct action reconstruction ignores executable producer URL',()=>{
 const f=fixture().features[0];const u=new URL(screenUrl(f));assert.equal(u.origin,'https://ventusltd.github.io');
 assert.equal(u.searchParams.get('project'),'SYNTHETIC <site>');assert.equal(u.searchParams.has('repd_ref'),false);
 assert.equal(u.searchParams.has('capacity_mw'),false);assert.equal(globalThis.__probe,undefined);
});
test('direct action caller cannot bypass coordinate validation',()=>{
 for(const xy of [[0,0],[NaN,51],[-0.1,91],[true,51]]){
  const f=fixture().features[0];f.geometry.coordinates=xy;assert.throws(()=>screenUrl(f));
 }
});
test('missing points remain without screening actions',()=>{
 const d=fixture();d.features[0].geometry=null;d.features[0].properties.location_precision='UNKNOWN';
 Object.assign(d.counts,{with_geometry:0,unknown_geometry:1,postcode_centroids:0});
 assert.equal(screenUrl(indexLocations(d).get('DC-WD-Q1')),null);
});
test('foreign and unknown country points keep geometry without a GB screening route',()=>{
 for(const country of [{code:'FR'},{code:'US'},{code:'UK'},{code:null},undefined]){
  const d=fixture(),f=d.features[0];f.properties.country=country;
  f.geometry.coordinates=[7.73,48.58];f.properties.location_precision='WIKIDATA_REPORTED_POINT';
  f.properties.geometry_licence='CC0-1.0';f.properties.geometry_licence_url='https://www.wikidata.org/wiki/Wikidata:Copyright';
  d.counts.postcode_centroids=0;
  assert.equal(indexLocations(d).size,1);assert.deepEqual(f.geometry.coordinates,[7.73,48.58]);
  assert.equal(screenUrl(f),null);
 }
});
test('postcode points require their own terms and GB bounds',()=>{
 for(const mutate of [p=>p.geometry_licence='CC0-1.0',p=>p.geometry_licence_url='https://bad.example/terms']){
  const d=fixture();mutate(d.features[0].properties);assert.throws(()=>indexLocations(d),/terms/);
 }
 const d=fixture();d.features[0].geometry.coordinates=[2.35,48.85];assert.throws(()=>indexLocations(d),/terms/);
});
test('pinned bounded loader rejects altered or excessive source bytes',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(fixture()));
 const pin={url:INPUT.url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 assert.equal((await loadLocations(async()=>new Response(bytes),pin)).size,1);
 await assert.rejects(loadLocations(async()=>new Response(bytes),{...pin,sha256:'0'.repeat(64)}),/digest/);
 await assert.rejects(loadLocations(async()=>new Response(bytes),{...pin,bytes:bytes.length-1}),/byte limit/);
 await assert.rejects(loadLocations(async()=>new Response(bytes),{...pin,bytes:bytes.length+1}),/byte count/);
});
test('invalid pin bounds or endpoints reject before any network call',async()=>{
 for(const bad of [{bytes:NaN},{bytes:Infinity},{bytes:-1},{bytes:2147483647},{url:'https://127.0.0.1/'},{url:'javascript:alert(1)'},{sha256:'bad'}]){
  let fetched=false;await assert.rejects(loadLocations(async()=>{fetched=true;return new Response('{}');},{...INPUT,...bad}),/source contract/);
  assert.equal(fetched,false);
 }
});
