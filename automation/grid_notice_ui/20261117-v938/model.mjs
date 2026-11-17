export const factsHash='f9802c96444c21e84b328d612475353861c8053cde31f55196d1ea5862918afb';
const pins=new Map([
 ['https://www.gov.uk/government/news/sea-link-development-consent-decision-announced',{publisher:'Planning Inspectorate',sha256:'b9ba26b90820292e0b181da7993d2d3a2180fc2de0ac53cc6239adeb4cccfaeb',bytes:68432}],
 ['https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008',{publisher:'Department for Energy Security and Net Zero',sha256:'c26f93aa307740f8b4ec8ad150b152fb6d30e77f201e5bc31a6da52bba16e0d0',bytes:69536}],
]);
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
function day(value){return value?.precision==='DAY'&&value.value==='2026-10-30'&&Object.keys(value).sort().join(',')==='precision,value';}
export async function acceptedNotice(payload){
 try{
  if(payload?.schema!=='globalgrid2050.reviewed-grid-notice.v1'||payload.facts_sha256!==factsHash)throw Error('Unpinned notice');
  const encoded=new TextEncoder().encode(JSON.stringify(canonical(payload.facts))),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))).map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==factsHash)throw Error('Changed fact bytes');
  const f=payload.facts;if(f.application_ref!=='EN020026'||f.reported_network_operator!=='NGET'||f.reported_stage!=='consented'||!day(f.event_date)||!Array.isArray(f.documents)||f.documents.length!==2)throw Error('Unknown fact scope');
  const seen=new Set();for(const d of f.documents){const pin=pins.get(d.url),r=d.source_receipt;if(!pin||seen.has(d.url)||d.publisher!==pin.publisher||d.role!=='government_authority'||d.source_sha256!==pin.sha256||!day(d.published_date)||!day(d.event_date)||d.published_at!==null||r?.source_url!==d.url||r.sha256!==pin.sha256||r.bytes!==pin.bytes||r.http_status!==200||r.retrieved_at!==d.retrieved_at)throw Error('Unreviewed document');seen.add(d.url);}
  const a=payload.approval,reviews=a?.reviews;if(!payload.publishable||payload.review_state!=='NARROW_FACTS_REVIEWED'||payload.notice_count!==1||payload.document_count!==2||a?.state!=='APPROVED_FACTS_ONLY'||a.rights_scope!=='government_html_facts_only_no_images_or_third_party_material'||a.facts_sha256!==factsHash||!Array.isArray(reviews)||reviews.length!==2||new Set(reviews.map(r=>r.role)).size!==2||!reviews.some(r=>r.role==='AGENT_A')||!reviews.some(r=>r.role==='AGENT_B')||reviews.some(r=>r.decision!=='PASS'||!/^https:\/\/github\.com\/Ventusltd\/neural-link-between-agents\/issues\/42#issuecomment-\d+$/.test(r.reference))||reviews[0].reference===reviews[1].reference)throw Error('Independent narrow rights review required');
  return f;
 }catch{return null;}
}
