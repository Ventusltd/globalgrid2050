import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acceptedPolicy,policyHash,policySource,contextForOrigin,validOrigin,classifyHeadline,relatedHeadlines,newsContextUrl,requestedContext} from './model.mjs';
const bytes=readFileSync(new URL('./policy.json',import.meta.url),'utf8'),data=JSON.parse(bytes);
const dc={origin_type:'datacentre',origin_id:'dc:example'},repd={origin_type:'repd',origin_id:'2470',technology:'solar'};
const article=(title,link='https://publisher.example/story',extra={})=>({title,link,source:'Original publisher',date:'2026-11-17',first_seen:'2026-11-17T10:00:00Z',...extra});
const approval=()=>({state:'APPROVED_FACTS_ONLY',policy_sha256:policyHash,source_sha256:data.source_sha256,scope:data.rights.scope,reviews:[{role:'GRID_ANALYSER',decision:'PASS',reference:'https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-100'},{role:'TRAIN_CONDUCTOR',decision:'PASS',reference:'https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-101'}]});

test('actual pinned policy yields national facts only under synthetic approval',async()=>{
 const result=await acceptedPolicy(bytes,approval());assert.equal(result.source_url,policySource);assert.equal(result.themes.length,5);assert.equal(result.quantities.length,2);assert.equal(result.quantities[1].comparison,'AT_MOST');assert.match(result.quantities[1].meaning,/1\.3 or better/);assert.equal(result.project_compliance,null);assert.equal(result.available_capacity,null);assert.deepEqual(result.asset_associations,[]);
});
test('review pending, duplicated roles/references and wrong source pin fail closed',async()=>{
 const pending=JSON.parse(readFileSync(new URL('./review.json',import.meta.url)));assert.equal(await acceptedPolicy(bytes,pending),null);
 for(const mutate of [r=>r.reviews[1].role=r.reviews[0].role,r=>r.reviews[1].reference=r.reviews[0].reference,r=>r.reviews[1].reference='https://evil.test/fake',r=>r.source_sha256='0'.repeat(64),r=>r.reviews[0].decision='PENDING']){const r=approval();mutate(r);assert.equal(await acceptedPolicy(bytes,r),null);}
});
test('changed source/fact bytes or project compliance cannot pass policy pin',async()=>{
 for(const mutate of [d=>d.quantities[0].value='6000',d=>d.source_url='javascript:alert(1)',d=>d.project_compliance=true,d=>d.connections.push('nearby'),d=>d.themes[0].fragment='evil']){const d=JSON.parse(bytes);mutate(d);assert.equal(await acceptedPolicy(JSON.stringify(d),approval()),null);}
});
test('three origin kinds retain stable identity and explicitly only topic context',()=>{
 for(const o of [repd,dc,{origin_type:'substation',origin_id:'site:XYZ'}]){const result=contextForOrigin(o);assert.equal(result.origin_id,o.origin_id);assert.equal(result.association,'TOPIC_CONTEXT_ONLY');assert.equal(result.compliance,null);assert.equal(result.connection,null);}
 assert.deepEqual(contextForOrigin(repd).topics,['solar']);assert.deepEqual(contextForOrigin(dc).topics,['datacentre','grid']);
});
test('unknown origin, malformed REPD, oversized and URL IDs are refused',()=>{
 for(const o of [{},null,{origin_type:'repd',origin_id:'abc'},{origin_type:'repd',origin_id:'2470<script>'},{origin_type:'datacentre',origin_id:'https://evil.test'},{origin_type:'substation',origin_id:'x'.repeat(121)}])assert.equal(validOrigin(o),null);
});
test('headline classifier handles UK/US data-centre spelling without AI substring false positives',()=>{
 for(const title of ['Data centres and grid','Data-center demand','Datacenter demand','AI energy infrastructure'])assert.ok(classifyHeadline(article(title)).includes('datacentre'));
 assert.deepEqual(classifyHeadline(article('Retail train delays')),[]);
});
test('original article fields and clocks preserved, tracking duplicates suppressed only in context',()=>{
 const first=article('AI power and grid','https://publisher.example/story?utm_source=a'),duplicate=article('Different label','https://publisher.example/story?utm_source=b',{technology:'datacentre'}),other=article('Solar expansion','https://publisher.example/solar');
 const doc={items:[first,duplicate,other]},before=JSON.stringify(doc),result=relatedHeadlines(doc,dc);assert.equal(result.length,1);assert.equal(result[0].item,first);assert.equal(result[0].item.link,first.link);assert.equal(JSON.stringify(doc),before);
});
test('possible match never becomes exact project news or Journey origin',()=>{
 const item=article('Local retail plan','https://publisher.example/retail',{possible_match:{repd_ref:'2470',site_name:'Example'}});assert.deepEqual(relatedHeadlines({items:[item]},repd),[]);
});
test('unsafe URLs, missing credits and arbitrary count inputs do not produce links',()=>{
 for(const bad of ['javascript:alert(1)','https://user:pass@publisher.example/x','http://publisher.example/x','https://127.0.0.1/x','https://host.internal/x'])assert.deepEqual(relatedHeadlines({items:[article('Data centre grid',bad)]},dc),[]);
 assert.deepEqual(relatedHeadlines({items:[article('Grid',{},{source:''})]},dc),[]);assert.deepEqual(relatedHeadlines({items:Array(201).fill(article('Grid'))},dc),[]);
 assert.deepEqual(relatedHeadlines({items:[article('Grid','https://publisher.example/x',{date:'x'.repeat(65)})]},dc),[]);
 assert.deepEqual(relatedHeadlines({items:[article('Grid')]},dc,{limit:100}),[]);
});
test('context links point to current immutable Pipeline edition, no open redirects',()=>{
 const base='https://globalgrid2050.com/uk_renewables_pipeline/202611171940/';const url=new URL(newsContextUrl(base,dc));assert.equal(url.searchParams.get('news_origin_id'),'dc:example');assert.equal(url.searchParams.get('news_topic'),'datacentre');assert.equal(url.hash,'#headlinesHeading');
 for(const bad of ['https://evil.test/uk_renewables_pipeline/202611171940/','https://globalgrid2050.com/','javascript:alert(1)'])assert.equal(newsContextUrl(bad,dc),null);
});
test('requested context has bounded topics and treats bad origin independently',()=>{
 assert.deepEqual(requestedContext('?news_topic=grid&news_origin_type=repd&news_origin_id=2470'),{topic:'grid',origin:{origin_type:'repd',origin_id:'2470',technology:null}});
 assert.equal(requestedContext('?news_topic=<script>'),null);assert.deepEqual(requestedContext('?news_topic=grid&news_origin_type=evil'),{topic:'grid',origin:null});
});
