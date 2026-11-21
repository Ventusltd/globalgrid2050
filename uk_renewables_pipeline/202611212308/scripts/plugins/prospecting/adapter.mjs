/** Bounded consumer for the V9.26 research-triage proposal. No acquisition. */
export const SCHEMA='globalgrid2050.prospecting.research-triage.v1';
export const MAX_BYTES=16*1024*1024;
const SHA=/^[a-f0-9]{64}$/;
const policy={paywalled_channels:'EXCLUDED',unknown_access:'DISABLED',corporate_enrichment:'LISTED_PARENT_GROUP_ONLY_WITH_IDENTITY_AND_MEMBERSHIP_EVIDENCE',sme_targeting:false,directors_officers_residential_addresses:false,government_hosting_implies_reuse_permission:false};
function require(value,message){if(!value)throw new Error(message);}
function text(value,label,nullable=false){require(nullable&&value===null||typeof value==='string'&&value.trim().length>0&&value.length<=1000,`${label}: bounded text required`);return value;}
function number(value,label){require(typeof value==='number'&&Number.isFinite(value)&&value>=0,`${label}: nonnegative finite number required`);return value;}
function integer(value,label){number(value,label);require(Number.isInteger(value),`${label}: integer required`);return value;}
function hash(value){require(SHA.test(value),'SHA256 required');return value;}
function moment(value){
  require(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value),'UTC timestamp required');
  const parsed=new Date(value);require(Number.isFinite(+parsed)&&parsed.toISOString().slice(0,19)===value.slice(0,19),'Invalid calendar timestamp');return +parsed;
}
function past(value,asOf){const result=moment(value);require(result<=asOf,'Future source timestamp');return result;}
export function safeSourceURL(value){
  require(typeof value==='string'&&!/[\s\\\x00-\x1f]/.test(value),'Invalid source URL');
  const url=new URL(value);const host=url.hostname.toLowerCase();
  require(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&host.includes('.')&&!host.startsWith('[')&&!/^\d+(?:\.\d+){3}$/.test(host)&&!/(?:^|\.)(?:localhost|local|internal|test)$/.test(host),'Public HTTPS source required');return url.href;
}
function freshness(value,asOf,windowDays,calendar=false){
  require(value&&typeof value==='object','Freshness required');text(value.basis,'Freshness basis');
  if(value.state==='UNKNOWN'){require(value.timestamp===null&&value.age_days===null,'Unknown freshness must retain nulls');return {...value};}
  require(['STALE','WITHIN_WINDOW'].includes(value.state),'Unsupported freshness state');
  let when;
  if(calendar){require(/^\d{4}-\d{2}-\d{2}$/.test(value.timestamp),'Official calendar date required');when=moment(`${value.timestamp}T00:00:00Z`);}
  else when=past(value.timestamp,asOf);
  const reference=calendar?Math.floor(asOf/86400000)*86400000:asOf;
  const age=(reference-when)/86400000;require(age>=0,'Future record date');number(value.age_days,'Freshness age');
  require(Math.abs(value.age_days-age)<0.00011,'Freshness age disagrees with source clock');
  require(value.state===(age>windowDays?'STALE':'WITHIN_WINDOW'),'Freshness state disagrees with source clock');return {...value};
}
function access(value,asOf){require(value?.state==='OPEN','Paywalled or unknown access excluded');safeSourceURL(value.review_url);past(value.checked_at,asOf);}
function evidence(article,asOf){
  require(article.state==='PROVISIONAL','Machine evidence must remain provisional');
  text(article.id,'Article ID');text(article.title,'Headline');require(article.title.length<=300,'Headline display limit');text(article.publisher,'Publisher');safeSourceURL(article.url);
  const published=past(article.pub_date,asOf),first=past(article.first_seen,asOf),last=past(article.last_seen,asOf);require(published<=last&&first<=last,'Article clocks disagree');
  require(['exact_name','repd_id'].includes(article.match_method),'Unsupported match');
  const source=article.source;require(source&&typeof source==='object','Article receipt missing');text(source.id,'Source ID');safeSourceURL(source.url);safeSourceURL(source.rights_review_url);hash(source.response_sha256);past(source.fetched_at,asOf);access(source.channel_access,asOf);access(article.access,asOf);
  return {title:article.title,url:article.url,publisher:article.publisher,pub_date:article.pub_date,state:'PROVISIONAL',freshness:freshness(article.freshness,asOf,30),retrieval_freshness:freshness(article.retrieval_freshness,asOf,14)};
}
function candidate(row,index,asOf){
  require(row&&typeof row==='object','Record required');
  const official=row.record_type==='renewable_project';require(official||row.record_type==='data_centre','Unsupported record type');
  require((official?/^REPD-[1-9]\d*$/:/^DC-WD-Q[1-9]\d*$/).test(row.id),'Identity/type mismatch');
  require(row.rank===index+1,'Ranks must be consecutive');text(row.name,'Name',true);text(row.country,'Country',true);text(row.technology,'Technology');
  require(row.record_state===(official?'OFFICIAL':'PROVISIONAL'),'Unsupported record state');require(['UNKNOWN','PROVISIONAL'].includes(row.research_state),'Unsupported research state');text(row.official_status,'Official status',true);
  require(row.event_at===null,'Current adapter cannot assert an event');text(row.research_note,'Research note');require(row.research_note.startsWith('Research note:'),'Generated note must be labelled');
  const corporate=row.corporate_eligibility;
  require(corporate?.eligible===false&&corporate.state==='UNKNOWN'&&corporate.listed_parent===null&&Array.isArray(corporate.identity_evidence)&&corporate.identity_evidence.length===0&&Array.isArray(corporate.membership_evidence)&&corporate.membership_evidence.length===0,'Listed-parent eligibility not established');text(corporate.reason,'Corporate policy reason');
  const heat=row.heat;require(heat?.state==='UNKNOWN'&&heat.momentum_status==='UNKNOWN'&&heat.score===0&&heat.independent_signal_count===null&&Array.isArray(heat.components)&&heat.components.length===0,'Independent momentum not established');text(heat.reason,'Momentum reason');
  const capacities=row.capacities;require(capacities&&typeof capacities==='object','Typed capacity required');
  const keys=official?['repd_installed_mw']:['grid_connection_mw','it_load_mw','site_demand_mw'];require(JSON.stringify(Object.keys(capacities).sort())===JSON.stringify(keys),'Capacity basis mismatch');
  for(const value of Object.values(capacities)){if(value!==null)number(value,'Capacity');if(!official)require(value===null,'DC figures need reviewed successor adapter');}
  const source=row.source;require(source&&typeof source==='object','Source required');safeSourceURL(source.url);hash(source.sha256);
  if(!official){safeSourceURL(source.revision_url);require(source.publisher==='Wikidata'&&source.licence==='CC0-1.0','Unsupported DC attribution');past(source.retrieved_at,asOf);}
  const allowed=official?['capacity','technology','national_route','evidence_tier','research_follow_up']:['data_centre_topic'];
  require(Array.isArray(row.reasons)&&row.reasons.length===allowed.length,'Named reasons required');
  const reasons=row.reasons.map((reason,i)=>{require(reason.name===allowed[i],'Unexpected score component');number(reason.points,'Points');number(reason.max,'Maximum');require(reason.points<=reason.max,'Points exceed component maximum');text(reason.basis,'Score reason');return {name:reason.name,points:reason.points,max:reason.max,basis:reason.basis};});
  number(row.score,'Score');require(Math.abs(row.score-Math.round(reasons.reduce((sum,r)=>sum+r.points,0)*100)/100)<0.00001,'Score does not equal named components');
  require(Array.isArray(row.evidence)&&row.evidence.length<=100,'Evidence exceeds bounded display');const articles=row.evidence.map(article=>evidence(article,asOf));require(new Set(articles.map(a=>a.url)).size===articles.length,'Duplicate article');require(row.research_state===(articles.length?'PROVISIONAL':'UNKNOWN'),'Research state/count disagree');
  if(row.last_researched_at!==null)past(row.last_researched_at,asOf);
  return {id:row.id,rank:row.rank,name:row.name,country:row.country,record_type:row.record_type,technology:row.technology,record_state:row.record_state,official_status:row.official_status,score:row.score,reasons,capacities:{...capacities},source:{url:source.revision_url||source.url,sha256:source.sha256},record_freshness:freshness(row.record_freshness,asOf,90,official),retrieval_freshness:row.retrieval_freshness?freshness(row.retrieval_freshness,asOf,14):null,evidence:articles,heat:{...heat},research_note:row.research_note,corporate_reason:corporate.reason};
}
export function validateTriage(payload){
  require(payload?.schema===SCHEMA,'Unsupported research-priority schema');const asOf=moment(payload.as_of);
  require(payload.source_policy&&Object.entries(policy).every(([key,value])=>payload.source_policy[key]===value),'Source policy is not eligible');
  hash(payload.profile_sha256);require(payload.profile?.id==='research-triage.v1','Unsupported scoring profile');text(payload.purpose,'Purpose');text(payload.coverage,'Coverage');
  integer(payload.input_count,'Input count');integer(payload.eligible_count,'Eligible count');integer(payload.returned_count,'Returned count');integer(payload.limit,'Limit');
  require(payload.limit>=1&&payload.limit<=1000&&payload.input_count>=7775&&payload.eligible_count<=payload.input_count&&payload.returned_count<=payload.eligible_count&&payload.returned_count<=payload.limit,'Counts inconsistent');
  require([null,'renewable_project','data_centre'].includes(payload.record_type_filter),'Unsupported type filter');
  const receipts=payload.input_receipts;require(Array.isArray(receipts)&&receipts.length===3&&new Set(receipts.map(r=>r.id)).size===3,'Input receipts required');
  const official=receipts.find(r=>r.id==='official_repd');require(official?.state==='OFFICIAL'&&official.population===7775&&official.solar1000_count===1000&&official.release==='202611161244','Official population changed');hash(official.manifest_sha256);hash(official.solar1000_manifest_sha256);hash(official.source_workbook_sha256);
  for(const id of ['news_evidence','global_data_centres']){const r=receipts.find(r=>r.id===id);require(r&&['UNKNOWN','PROVISIONAL'].includes(r.state),'Invalid optional input receipt');if(r.state==='PROVISIONAL'){hash(r.sha256);freshness(r.freshness,asOf,14);}else text(r.reason,'Missing input reason');}
  require(Array.isArray(payload.unsupported_interfaces)&&payload.unsupported_interfaces.every(i=>i.enabled===false),'Unsupported source enabled');
  require(Array.isArray(payload.records)&&payload.records.length===payload.returned_count,'Record count differs');const records=payload.records.map((row,index)=>candidate(row,index,asOf));require(new Set(records.map(r=>r.id)).size===records.length,'Duplicate record identity');
  const news=receipts.find(r=>r.id==='news_evidence'),dc=receipts.find(r=>r.id==='global_data_centres');
  if(news.state==='PROVISIONAL'){require(news.rights_state==='ACCEPTED_RECEIPTS_SUPPLIED','Accepted news receipts required');const generated=past(news.generated_at,asOf);require(past(news.source_run_at,asOf)<=generated&&news.freshness.timestamp===news.source_run_at,'News receipt clocks disagree');}
  records.forEach((row,i)=>{require(!payload.record_type_filter||row.record_type===payload.record_type_filter,'Filter/type mismatch');require(!row.evidence.length||news.state==='PROVISIONAL','Article lacks admitted news input');require(row.record_type!=='data_centre'||dc.state==='PROVISIONAL','DC record lacks admitted input');if(i){const prior=records[i-1];require(prior.score>row.score||prior.score===row.score&&prior.id<row.id,'Ranking order disagrees with score and ID');}});
  return {as_of:payload.as_of,purpose:payload.purpose,coverage:payload.coverage,input_count:payload.input_count,eligible_count:payload.eligible_count,returned_count:payload.returned_count,record_type_filter:payload.record_type_filter,profile_sha256:payload.profile_sha256,records};
}
export async function parseArtifact(bytes,expectedSHA256){
  require(bytes.byteLength<=MAX_BYTES,'Priority artifact exceeds size limit');
  if(expectedSHA256){hash(expectedSHA256);const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');require(actual===expectedSHA256,'Priority artifact hash mismatch');}
  return validateTriage(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export function selectRecords(model,{recordType='renewable_project',query='',sort='priority'}={}){
  const needle=query.trim().toLocaleLowerCase('en-GB');const rows=model.records.filter(row=>row.record_type===recordType&&[row.id,row.name||'',row.country||'',row.technology].join(' ').toLocaleLowerCase('en-GB').includes(needle));
  return sort==='name'?rows.sort((a,b)=>(a.name||a.id).localeCompare(b.name||b.id,'en-GB')||a.id.localeCompare(b.id)):rows.sort((a,b)=>a.rank-b.rank);
}
