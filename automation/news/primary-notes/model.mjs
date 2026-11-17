/* Offline curated primary notes. This validates one reviewed association, not a matcher. */
import data from './notes.json' with {type:'json'};
import {CATALOGUE} from './catalogue.mjs';
const SCHEMA='globalgrid2050.primary-notes.v1';
const NOTE_ID='PRIMARY-EN010147-002440-REFUSAL-20261110';
const requireValid=(ok,why)=>{if(!ok)throw Error('Primary note withheld: '+why);};
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function jsonCopy(value,seen=new Set(),depth=0){
  requireValid(depth<=20,'JSON depth');
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='string'){requireValid(value.length<=20000,'JSON text bound');return value;}
  if(typeof value==='number'){requireValid(Number.isFinite(value),'finite JSON number');return value;}
  requireValid(value&&typeof value==='object'&&!seen.has(value),'plain acyclic JSON required');
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
  requireValid(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'plain JSON prototype');
  const own=Reflect.ownKeys(value);requireValid(own.length<=1000,'JSON member bound');
  seen.add(value);const result=array?[]:Object.create(null);
  for(const key of own){
    if(array&&key==='length')continue;
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    requireValid(typeof key==='string'&&descriptor.enumerable&&'value'in descriptor,'JSON accessors or hidden fields forbidden');
    if(array)requireValid(/^(0|[1-9]\d*)$/.test(key)&&Number(key)<value.length,'JSON array keys');
    result[key]=jsonCopy(descriptor.value,seen,depth+1);
  }
  if(array)requireValid(result.length===value.length&&Object.keys(result).length===value.length,'dense JSON arrays required');
  seen.delete(value);return result;
}
const serial=value=>value&&typeof value==='object'?Array.isArray(value)?'['+value.map(serial).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+serial(value[k])).join(',')+'}':JSON.stringify(value);
function keys(value,wanted,role){requireValid(value&&typeof value==='object'&&!Array.isArray(value)&&serial(Object.keys(value).sort())===serial([...wanted].sort()),role+' fields');}
function same(actual,expected,role){requireValid(serial(actual)===serial(expected),role+' differs from reviewed catalogue');}
function https(value){
  requireValid(typeof value==='string'&&!/[\u0000-\u0020]/.test(value),'unsafe URL');let url;
  try{url=new URL(value);}catch{throw Error('Primary note withheld: unsafe URL');}
  requireValid(url.protocol==='https:'&&url.hostname&&!url.username&&!url.password&&!url.port&&!url.hash,'unsafe URL');return value;
}
// Compare actual UTC instants at nanosecond precision, including receipt fractions.
export function utcInstant(value){
  requireValid(typeof value==='string','UTC timestamp');
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|\+00:00)$/);
  requireValid(match,'UTC timestamp');const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
  requireValid(year>=1900&&year<=2100&&hour<24&&minute<60&&second<60,'UTC range');
  const ms=Date.UTC(year,month-1,day,hour,minute,second);
  requireValid(new Date(ms).toISOString().slice(0,19)===value.slice(0,19),'UTC calendar');
  return BigInt(ms)*1000000n+BigInt((match[7]||'').padEnd(9,'0'));
}
function day(value){requireValid(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'date');return utcInstant(value+'T00:00:00Z');}
function canonical(projects){
  requireValid(Array.isArray(projects)&&projects.length===CATALOGUE.canonical.expected_population,'complete canonical population required');
  const refs=new Set(),ids=new Set();
  const field=(row,name)=>{const d=Object.getOwnPropertyDescriptor(row,name);requireValid(!d||'value'in d,'canonical accessors forbidden');return d?.value;};
  for(const row of projects){
    requireValid(row&&typeof row==='object','canonical row');const ref=field(row,'repd_ref'),id=field(row,'gg_project_id');
    requireValid(typeof ref==='string'&&/^[1-9]\d*$/.test(ref)&&id==='GG2050-REPD-'+ref,'canonical original IDs');
    requireValid(!refs.has(ref)&&!ids.has(id),'duplicate canonical identity');refs.add(ref);ids.add(id);
  }
  const matches=projects.filter(row=>field(row,'planning_application_reference')===CATALOGUE.source.planning_reference);
  requireValid(matches.length===1,'exact planning reference must be unique');const row=jsonCopy(matches[0]);
  for(const [field,expected] of Object.entries(CATALOGUE.canonical.fields))requireValid(Object.is(row[field],expected),'canonical '+field+' mismatch');
  return row;
}
function clocks(note,cutoff){
  const source=note.source,review=note.evidence_review,news=note.news_metadata;
  const moments=[source.retrieved_at,review.independent_review_at,review.curated_at,news.read_at,news.feed_generated_at,news.published_at,news.first_seen,
    ...note.rights.terms_receipts.map(r=>r.retrieved_at)];
  requireValid(moments.every(value=>utcInstant(value)<=cutoff),'future receipt, publication or evaluation clock');
  for(const value of [source.document_date,source.document_stated_publication_date,note.claim.decision_date,note.claim.source_application_submitted])requireValid(day(value)<=cutoff,'future document/event date');
  const modified=Date.parse(source.headers['Last-Modified']);requireValid(Number.isFinite(modified)&&BigInt(modified)*1000000n<=cutoff,'future/invalid HTTP clock');
  requireValid(day(note.claim.decision_date)<=day(source.document_date)&&day(source.document_stated_publication_date)<=utcInstant(source.retrieved_at),'decision/publication chronology');
  requireValid(utcInstant(source.retrieved_at)<=utcInstant(review.independent_review_at)&&note.rights.terms_receipts.every(r=>utcInstant(r.retrieved_at)<=utcInstant(review.independent_review_at)),'primary review chronology');
  requireValid(utcInstant(news.published_at)<=utcInstant(news.first_seen)&&utcInstant(news.first_seen)<=utcInstant(news.feed_generated_at)&&
    utcInstant(news.feed_generated_at)<=utcInstant(news.read_at)&&utcInstant(news.read_at)<=utcInstant(review.curated_at)&&
    utcInstant(review.independent_review_at)<=utcInstant(review.curated_at),'auxiliary metadata/curation chronology');
}
function validate(note,row,cutoff){
  note=jsonCopy(note);
  keys(note,['id','association','binding','source','rights','claim','news_metadata','evidence_review'],'note');
  requireValid(note.id===NOTE_ID&&note.association==='PROVISIONAL','only reviewed provisional association allowed');
  keys(note.binding,['repd_ref','gg_project_id','planning_reference','canonical_edition','canonical_partition','canonical_partition_sha256'],'binding');
  requireValid(note.binding.repd_ref===row.repd_ref&&note.binding.gg_project_id===row.gg_project_id&&
    note.binding.planning_reference===row.planning_application_reference,'exact binding mismatch');
  same(note.binding,{repd_ref:row.repd_ref,gg_project_id:row.gg_project_id,planning_reference:row.planning_application_reference,
    canonical_edition:CATALOGUE.canonical.edition,canonical_partition:CATALOGUE.canonical.partition,canonical_partition_sha256:CATALOGUE.canonical.partition_sha256},'canonical snapshot');
  requireValid(note.source&&note.rights&&note.claim&&note.news_metadata&&note.evidence_review&&
    Array.isArray(note.rights.terms_receipts)&&note.source.headers,'source/rights/claim receipts required');
  for(const field of ['source','rights','claim','news_metadata'])keys(note[field],Object.keys(CATALOGUE[field]),field);
  keys(note.evidence_review,Object.keys(CATALOGUE.review),'evidence review');
  for(const receipt of note.rights.terms_receipts)keys(receipt,['url','bytes','sha256','retrieved_at'],'rights receipt');
  for(const url of [note.source.url,note.source.project_url,note.rights.licence_url,note.news_metadata.source_url,note.news_metadata.article_url,...note.rights.terms_receipts.map(r=>r.url)])https(url);
  clocks(note,cutoff);
  // Exact trusted document and claim scope, not caller rights flags or a common hostname.
  same(note.source,CATALOGUE.source,'source receipt');same(note.rights,CATALOGUE.rights,'narrow rights evidence');
  same(note.claim,CATALOGUE.claim,'bounded decision claim');same(note.news_metadata,CATALOGUE.news_metadata,'auxiliary metadata');
  same(note.evidence_review,CATALOGUE.review,'actual review metadata');
  return freeze(note);
}
export const CURATED_NOTES=freeze(data);
export function buildPrimaryNotes(projects,options={}){
  requireValid(options&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).every(k=>['asOf','records'].includes(k)),'unsupported evaluation options');
  const {asOf,records=CURATED_NOTES.notes}=options;
  const cutoff=utcInstant(asOf);same(CURATED_NOTES.schema,SCHEMA,'curated schema');const row=canonical(projects);
  requireValid(Array.isArray(records)&&records.length<=10,'bounded note records');const proposals=jsonCopy(records),ids=new Set(),bindings=new Set();
  for(const record of proposals){
    requireValid(record&&typeof record==='object','note object');const binding=record.binding?.gg_project_id;
    requireValid(!ids.has(record.id)&&!bindings.has(binding),'duplicate note/binding');ids.add(record.id);bindings.add(binding);
  }
  requireValid(proposals.length<=1,'one reviewed decision only');
  const accepted=proposals.map(record=>validate(record,row,cutoff));
  const byRef=Object.create(null),byId=Object.create(null);
  for(const note of accepted){byRef[note.binding.repd_ref]=[note];byId[note.binding.gg_project_id]=[note];}
  return freeze({schema:SCHEMA,validated_as_of:asOf,association_count:accepted.length,verified_count:0,solar1000_verified_delta:0,
    by_repd_ref:byRef,by_project_id:byId});
}
