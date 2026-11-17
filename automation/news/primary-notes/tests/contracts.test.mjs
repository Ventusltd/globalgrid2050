import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrimaryNotes,CURATED_NOTES,utcInstant} from '../model.mjs';
import {CATALOGUE} from '../catalogue.mjs';
const AS_OF='2026-11-17T03:16:20Z',copy=value=>JSON.parse(JSON.stringify(value));
// Actual reviewed canonical target. Remaining fixture rows are explicitly synthetic.
const TARGET={repd_ref:'12588',gg_project_id:'GG2050-REPD-12588',planning_application_reference:'EN010147',
 name:'Botley West, Botley - Botley West Solar Project',operator:'Photovolt Development Partners & SolarFive',county:'Oxfordshire',country:'England',technology:'solar',
 capacity_known:true,capacity_mw:840,status:'Application Submitted',repd_record_updated:'2024-12-16',planning_application_submitted:'2024-11-15',latitude:51.8132088,longitude:-1.3489728};
function projects(){return [copy(TARGET),...Array.from({length:7774},(_,i)=>({repd_ref:String(500000+i),gg_project_id:'GG2050-REPD-'+(500000+i),name:'SYNTHETIC UNRELATED '+i,planning_application_reference:null}))];}
const evaluate=(rows=projects(),records=copy(CURATED_NOTES.notes),asOf=AS_OF)=>buildPrimaryNotes(rows,{records,asOf});
test('actual canonical target binds one frozen provisional note andzero verifieddelta',()=>{
 const result=evaluate(),note=result.by_repd_ref['12588'][0];
 assert.equal(result.association_count,1);assert.equal(result.verified_count,0);assert.equal(result.solar1000_verified_delta,0);
 assert.equal(note.association,'PROVISIONAL');assert.equal(result.by_project_id['GG2050-REPD-12588'][0],note);
 assert.equal(note.claim.decision_date,'2026-11-10');assert.equal(note.news_metadata.published_at,'2026-11-11T12:29:34Z');
 assert.equal(note.claim.capacity_context.final_reduced_capacity_mw,null);assert.equal(note.claim.unknowns.judicial_review_status,null);
 assert.equal(CATALOGUE.canonical.fields.status,'Application Submitted');
});
test('whole accepted canonical population is required; empty input doesnotinventbinding',()=>{
 assert.throws(()=>evaluate([copy(TARGET)]),/population/);assert.throws(()=>evaluate([]),/population/);
 assert.equal(evaluate(projects(),[]).association_count,0);
});
test('homonym IDs and local planning references are rejected',()=>{
 for(const [ref,planning] of [['10529','P23/V2624/FUL'],['18174','P24/V2489/FUL']]){
  const rows=projects();Object.assign(rows[0],{repd_ref:ref,gg_project_id:'GG2050-REPD-'+ref,planning_application_reference:planning,name:'Botley - Solar Photovoltaic Array',operator:'Red House Solar Limited',capacity_mw:49.99});
  assert.throws(()=>evaluate(rows),/planning reference/);
 }
});
test('wrong exact identity, developer, country, point or frozenstatus withholds',()=>{
 for(const [field,value] of [['operator','Other Developer'],['country','Germany'],['name','Botley'],['county','Hampshire'],['latitude',null],['longitude',-1.3052428],['capacity_mw',49.99],['status','Application Refused'],['planning_application_submitted','2024-11-14'],['repd_record_updated','2026-11-10']]){
  const rows=projects();rows[0][field]=value;assert.throws(()=>evaluate(rows),/canonical/);
 }
 const rows=projects();rows[0].repd_ref='10529';rows[0].gg_project_id='GG2050-REPD-10529';assert.throws(()=>evaluate(rows),/canonical repd_ref/);
});
test('duplicate canonical identities or a second EN010147 cannotbind',()=>{
 const duplicate=projects();duplicate[1]=copy(TARGET);assert.throws(()=>evaluate(duplicate),/duplicate canonical/);
 const shared=projects();shared[1].planning_application_reference='EN010147';assert.throws(()=>evaluate(shared),/unique/);
});
test('duplicate notes or bindings are rejected',()=>{
 const notes=copy(CURATED_NOTES.notes);assert.throws(()=>evaluate(projects(),[notes[0],copy(notes[0])]),/duplicate note/);
 const other=copy(notes[0]);other.id='OTHER';assert.throws(()=>evaluate(projects(),[notes[0],other]),/duplicate note/);
});
test('VERIFIED, currentcapacity and unsupported project claims are rejected',()=>{
 for(const mutate of [n=>n.association='VERIFIED',n=>n.claim.current_capacity_mw=840,n=>n.claim.capacity_context.final_reduced_capacity_mw=840,
  n=>n.claim.type='CONSTRUCTION_STARTED',n=>n.claim.statement='The project is cancelled and grid-connected.',n=>n.claim.unknowns.judicial_review_status='NONE',n=>n.verified_count=1]){
  const notes=copy(CURATED_NOTES.notes);mutate(notes[0]);assert.throws(()=>evaluate(projects(),notes));
 }
});
test('unknown document, changed URL/hash/bytes and forged receipt reject',()=>{
 for(const mutate of [n=>n.source.id='unreviewed',n=>n.source.url=n.source.url.replace('002440','002441'),n=>n.source.sha256='0'.repeat(64),n=>n.source.bytes++,
  n=>n.source.headers['Last-Modified']='Wed, 11 Nov 2026 16:20:36 GMT',n=>n.evidence_review.status='CALLER_ACCEPTED']){
  const notes=copy(CURATED_NOTES.notes);mutate(notes[0]);assert.throws(()=>evaluate(projects(),notes),/catalogue/);
 }
});
test('unsafe links cannotinheritrightsfromapublichostname',()=>{
 for(const url of ['javascript:alert(1)','http://www.gov.uk/','https://u:p@www.gov.uk/x','https://127.0.0.1/x','https://www.gov.uk/a#document']){
  const notes=copy(CURATED_NOTES.notes);notes[0].source.url=url;assert.throws(()=>evaluate(projects(),notes));
 }
});
test('missing, unknown and broadened rights cannot selfapprove',()=>{
 for(const mutate of [n=>n.rights=null,n=>n.rights.status='UNKNOWN',n=>n.rights.status='ACCEPTED',n=>n.rights.terms_receipts=[],
  n=>n.rights.terms_receipts[0].sha256='a'.repeat(64),n=>n.rights.scope='ALL_PINS_DOCUMENTS',n=>n.rights.exclusions=[],n=>n.rights.attribution='']){
  const notes=copy(CURATED_NOTES.notes);mutate(notes[0]);assert.throws(()=>evaluate(projects(),notes));
 }
 assert.throws(()=>buildPrimaryNotes(projects(),{asOf:AS_OF,rightsAccepted:true}),/unsupported/);
});
test('future publication/retrieval/evaluation andmalformedclocks withhold',()=>{
 for(const mutate of [n=>n.source.retrieved_at='2026-11-18T00:00:00Z',n=>n.news_metadata.published_at='2026-11-18T00:00:00Z',
  n=>n.evidence_review.curated_at='2026-11-17T03:16:20.000000001Z',n=>n.source.document_date='2026-11-18']){
  const notes=copy(CURATED_NOTES.notes);mutate(notes[0]);assert.throws(()=>evaluate(projects(),notes),/future/);
 }
 for(const value of ['2026-02-29T00:00:00Z','2026-11-17T24:00:00Z','2026-11-17T03:16:20+01:00','not-a-clock'])assert.throws(()=>evaluate(projects(),copy(CURATED_NOTES.notes),value));
 assert.throws(()=>evaluate(projects(),copy(CURATED_NOTES.notes),'2026-11-17T02:00:00Z'),/future/);
});
test('distinct chronology cannotbequietlyreconciledorrewritten',()=>{
 const notes=copy(CURATED_NOTES.notes);notes[0].news_metadata.first_seen='2026-11-10T00:00:00Z';assert.throws(()=>evaluate(projects(),notes),/chronology/);
 const altered=copy(CURATED_NOTES.notes);altered[0].claim.source_application_submitted='2024-11-15';assert.throws(()=>evaluate(projects(),altered),/claim/);
 assert(utcInstant('2026-11-17T03:16:20.000000001Z')>utcInstant(AS_OF));
});
test('source catalogue, curated inputs and returned records remainimmutable',()=>{
 const notes=copy(CURATED_NOTES.notes),rows=projects(),before=JSON.stringify(rows),result=evaluate(rows,notes),accepted=result.by_repd_ref['12588'][0];
 assert.equal(JSON.stringify(rows),before);
 assert.equal(Reflect.set(CATALOGUE.source,'sha256','0'.repeat(64)),false);assert.equal(Reflect.set(CURATED_NOTES.notes[0].claim,'type','VERIFIED'),false);
 assert.equal(Reflect.set(accepted.rights.terms_receipts[0],'sha256','0'.repeat(64)),false);assert.equal(Reflect.set(result.by_repd_ref['12588'],'0',{}),false);
 notes[0].claim.statement='POISON';rows[0].operator='POISON';assert.notEqual(accepted.claim.statement,'POISON');assert.equal(accepted.association,'PROVISIONAL');
 assert.throws(()=>evaluate(projects(),notes));
});
test('hidden toJSON cannot replace a validated provisional note',()=>{
 const notes=copy(CURATED_NOTES.notes);let called=false;
 Object.defineProperty(notes[0],'toJSON',{enumerable:false,value(){called=true;return {association:'VERIFIED'};}});
 assert.throws(()=>evaluate(projects(),notes),/hidden fields/);assert.equal(called,false);
});
test('accessors and custom prototypes cannot change validated metadata',()=>{
 const notes=copy(CURATED_NOTES.notes);let calls=0;
 Object.defineProperty(notes[0],'source',{enumerable:true,get(){calls++;return copy(CATALOGUE.source);}});
 assert.throws(()=>evaluate(projects(),notes),/accessors/);assert.equal(calls,0);
 const rows=projects();Object.defineProperty(rows[0],'repd_ref',{get(){return '12588';}});assert.throws(()=>evaluate(rows),/accessors/);
 const proto=copy(CURATED_NOTES.notes);Object.setPrototypeOf(proto[0],{selfApproved:true});assert.throws(()=>evaluate(projects(),proto),/prototype/);
});
