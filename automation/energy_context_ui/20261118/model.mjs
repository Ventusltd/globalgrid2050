export const policySource='https://www.gov.uk/government/publications/data-centre-covenant/the-data-centre-covenant';
export const policyHash='e2ba6c89c9bfd47456442ccb4c20e12d8297682630bca4b135da9a2e83a6d1ff';
const originKinds=new Set(['repd','datacentre','substation']);
const topics=new Set(['datacentre','grid','renewables','storage','solar','wind']);
const themes={datacentre:/\b(?:data[ -]?cent(?:re|er)s?|AI (?:power|energy|infrastructure|demand))\b/i,grid:/\b(?:grid|substation|transmission|distribution|connection|network upgrade)s?\b/i,storage:/\b(?:battery|batteries|storage|BESS|flexibility)\b/i,solar:/\b(?:solar|photovoltaic|PV)\b/i,wind:/\b(?:wind|offshore|onshore)\b/i,renewables:/\b(?:renewable|clean (?:power|energy)|energy transition)s?\b/i};
const safeUrl=value=>{try{const u=new URL(value);return typeof value==='string'&&u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&!/(^|\.)(localhost|local|internal)$/.test(u.hostname)&&u.hostname.includes('.')&&!/^[\d.]+$/.test(u.hostname)?u:null;}catch{return null;}};
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');

export function validOrigin(origin){
 if(!origin||!originKinds.has(origin.origin_type)||typeof origin.origin_id!=='string'||!/^[\w:.-]{1,120}$/.test(origin.origin_id))return null;
 if(origin.origin_type==='repd'&&!/^\d+$/.test(origin.origin_id))return null;
 return {origin_type:origin.origin_type,origin_id:origin.origin_id,technology:typeof origin.technology==='string'?origin.technology.slice(0,50):null};
}
export function contextForOrigin(origin){
 const value=validOrigin(origin);if(!value)return null;
 const selected=value.origin_type==='datacentre'?['datacentre','grid']:value.origin_type==='substation'?['grid']:['solar','wind','storage'].filter(t=>value.technology?.toLowerCase().includes(t));
 return {...value,topics:selected.length?selected:['renewables','grid'],association:'TOPIC_CONTEXT_ONLY',compliance:null,connection:null};
}
export function classifyHeadline(item){
 if(!item||typeof item.title!=='string'||typeof item.source!=='string')return [];
 const text=[item.title,item.technology,item.category].filter(v=>typeof v==='string').join(' ');
 return Object.entries(themes).filter(([,rule])=>rule.test(text)).map(([topic])=>topic);
}
export function relatedHeadlines(doc,origin,{limit=6}={}){
 const context=contextForOrigin(origin);if(!context||!Array.isArray(doc?.items)||doc.items.length>200||!Number.isInteger(limit)||limit<1||limit>12)return [];
 const seen=new Set(),result=[];
 for(const item of doc.items){
  const url=safeUrl(item?.link);if(!url||typeof item.title!=='string'||!item.title.trim()||item.title.length>600||typeof item.source!=='string'||!item.source.trim()||item.source.length>160||[item.date,item.first_seen].some(v=>v!==undefined&&v!==null&&(typeof v!=='string'||v.length>64)))continue;
  const matches=classifyHeadline(item).filter(t=>context.topics.includes(t));if(!matches.length)continue;
  // Only the duplicate key is normalised; original publisher URL/text/clocks remain untouched.
  url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key))url.searchParams.delete(key);
  if(seen.has(url.href))continue;seen.add(url.href);
  result.push({item,topics:matches,association:'TOPIC_CONTEXT_ONLY'});if(result.length===limit)break;
 }
 return result;
}
export function newsContextUrl(base,origin){
 const context=contextForOrigin(origin),url=safeUrl(base);if(!context||!url||url.hostname!=='globalgrid2050.com'||!/^\/uk_renewables_pipeline\/\d{12}\/(?:index.html)?$/.test(url.pathname))return null;
 url.searchParams.set('news_topic',context.topics[0]);url.searchParams.set('news_origin_type',context.origin_type);url.searchParams.set('news_origin_id',context.origin_id);url.hash='headlinesHeading';return url.href;
}
export function requestedContext(search){
 const p=new URLSearchParams(search),topic=p.get('news_topic');if(!topics.has(topic))return null;
 const origin=validOrigin({origin_type:p.get('news_origin_type'),origin_id:p.get('news_origin_id')});return {topic,origin};
}
export async function acceptedPolicy(bytes,review){
 try{
  if(typeof bytes!=='string'||bytes.length>16000||await digest(bytes)!==policyHash)return null;
  const data=JSON.parse(bytes);
  if(data.schema!=='globalgrid2050.energy-policy-context.v1'||data.source_url!==policySource||data.scope!=='NATIONAL_POLICY_CONTEXT_ONLY'||data.publisher!=='HM Treasury'||data.project_compliance!==null||data.available_capacity!==null||data.connections.length||data.asset_associations.length||data.themes.length!==5||data.quantities.length!==2)return null;
  if(review?.state!=='APPROVED_FACTS_ONLY'||review.policy_sha256!==policyHash||review.source_sha256!==data.source_sha256||review.scope!==data.rights.scope||!Array.isArray(review.reviews)||review.reviews.length!==2)return null;
  const roles=new Set(),refs=new Set();for(const r of review.reviews){if(!['GRID_ANALYSER','TRAIN_CONDUCTOR','INDEPENDENT_REVIEWER'].includes(r.role)||roles.has(r.role)||refs.has(r.reference)||r.decision!=='PASS'||!/^https:\/\/github\.com\/Ventusltd\/[\w.-]+\/(?:issues|pull)\/\d+#issuecomment-\d+$/.test(r.reference))return null;roles.add(r.role);refs.add(r.reference);}
  return data;
 }catch{return null;}
}
