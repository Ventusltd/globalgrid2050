import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildJourneyUrl,checkedOrigin,mapOrigin,checkedNewsContextBase} from './model.mjs';
const href='https://ventusltd.github.io/gridatlas/atlas/?repd_ref=2470&technology=wind_offshore&latitude=52.1374391&longitude=2.1708996&zoom=12';
const origin={origin_type:'repd',origin_id:'repd:2470',latitude:52.1374391,longitude:2.1708996,name:'East Anglia 3'};
test('REPD journey preserves legacy receiver identity, geometry and technology',()=>{
 const url=new URL(buildJourneyUrl(href,origin));
 for(const [key,value]of new URL(href).searchParams)assert.equal(url.searchParams.get(key),value);
 assert.equal(url.searchParams.get('journey'),'vicinity');assert.equal(url.searchParams.get('origin_id'),'repd:2470');assert.equal(url.searchParams.get('radius_km'),'10');
 assert.equal(url.searchParams.get('name'),'East Anglia 3');
});
test('data centre and substation IDs remain opaque source identities',()=>{
 for(const [kind,id]of [['datacentre','DC-WD-Q100'],['substation','grid_substations:0']]){
 const h='https://ventusltd.github.io/gridatlas/atlas/?latitude=51&longitude=-1&project=Source';
 const o=mapOrigin(h,{origin_type:kind,origin_id:id});assert.equal(new URL(buildJourneyUrl(h,o,{radiusKm:50})).searchParams.get('origin_id'),id);
 }
});
test('missing, nonnumeric, substituted identity/point and out-of-range radius refuse',()=>{
 for(const o of [null,{...origin,latitude:null},{...origin,longitude:Infinity},{...origin,latitude:91},{...origin,latitude:0,longitude:0},{...origin,origin_id:'repd:999'},{...origin,origin_type:'interconnector'},{...origin,origin_id:'repd:2470\n'}])assert.equal(buildJourneyUrl(href,o),null);
 for(const radiusKm of [0,51,10.5,NaN,'10'])assert.equal(buildJourneyUrl(href,origin,{radiusKm}),null);
 assert.equal(buildJourneyUrl(href,{...origin,latitude:52}),null);
 assert.equal(mapOrigin('https://ventusltd.github.io/gridatlas/atlas/?repd_ref=2470',{origin_type:'repd',origin_id:'repd:2470'}),null);
});
test('unsafe receivers and duplicate legacy parameters cannot become journey links',()=>{
 for(const h of ['javascript:alert(1)',href.replace('ventusltd.github.io','example.com'),href.replace('https:','http:'),href+'#other',href+'&repd_ref=999',href+'&latitude=52'])assert.equal(buildJourneyUrl(h,origin),null);
 assert.equal(checkedOrigin({...origin,origin_id:'repd:2470 invalid'}),null);
});
test('optional news context is an immutable canonical base without redirects or incoming query',()=>{
 const base='https://globalgrid2050.com/uk_renewables_pipeline/202611172355/';
 assert.equal(new URL(buildJourneyUrl(href,origin)).searchParams.has('news_context_url'),false);
 assert.equal(new URL(buildJourneyUrl(href+'&news_context_url=https://example.com/',origin)).searchParams.has('news_context_url'),false);
 assert.equal(new URL(buildJourneyUrl(href,origin,{newsContextUrl:base})).searchParams.get('news_context_url'),base);
 for(const value of [base+'?q=x',base+'#x',base.replace('globalgrid2050.com','example.com'),base.replace('https:','http:'),base.replace('globalgrid2050.com','user@globalgrid2050.com'),base.replace('globalgrid2050.com','globalgrid2050.com:444'),base.replace('202611172355','current')]){
  assert.equal(checkedNewsContextBase(value),null);assert.equal(buildJourneyUrl(href,origin,{newsContextUrl:value}),null);
 }
});
