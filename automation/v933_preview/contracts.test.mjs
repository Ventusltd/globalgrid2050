/** Exact producer tests plus independent V9.33 actual-population contracts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const ACCEPTED_PRIMARY_DONOR='f421513f7cbd85ad45727ef236e053a6c67f92d9';
assert.match(ACCEPTED_PRIMARY_DONOR,/^[a-f0-9]{40}$/,'Reviewed final producer SHA must be pinned');
const donorTests=execFileSync('git',['show',ACCEPTED_PRIMARY_DONOR+':automation/news/primary-notes/tests/contracts.test.mjs'],{cwd:ROOT,encoding:'utf8'});
const adapted=donorTests.replaceAll("'../model.mjs'",JSON.stringify(pathToFileURL(resolve(ROOT,'automation/primary_note_ui',ACCEPTED_PRIMARY_DONOR,'model.mjs')).href)).replaceAll("'../catalogue.mjs'",JSON.stringify(pathToFileURL(resolve(ROOT,'automation/primary_note_ui',ACCEPTED_PRIMARY_DONOR,'catalogue.mjs')).href));
await import('data:text/javascript;base64,'+Buffer.from(adapted).toString('base64'));
const {buildPrimaryNotes,CURATED_NOTES}=await import(pathToFileURL(resolve(ROOT,'automation/primary_note_ui',ACCEPTED_PRIMARY_DONOR,'model.mjs')));
const old=await import('../primary_note_ui/b5eed3d2ae878c78e5153be06ef531c11fff2148/model.mjs');
const EDITION=resolve(ROOT,process.env.V933_CANDIDATE||'uk_renewables_pipeline/202611170512');
const copy=value=>structuredClone(value),digest=raw=>createHash('sha256').update(raw).digest('hex');
const manifest=JSON.parse(readFileSync(resolve(EDITION,'data/v9.1/build_manifest.json'))),projects=[];
for(const part of manifest.project_partitions){const raw=readFileSync(resolve(EDITION,part.path));assert.equal(digest(raw),part.sha256);projects.push(...JSON.parse(raw).projects);}
assert.equal(projects.length,7775);const byRef=new Map(CURATED_NOTES.notes.map(n=>[n.binding.repd_ref,n]));
const asOf=()=>new Date().toISOString();
test('four reviewed notes stay PROVISIONAL withzeroverified/pilotdelta; Botley bytes remain unchanged',()=>{
 assert.deepEqual([...byRef.keys()].sort(),['12588','14806','15000','15149']);
 assert.deepEqual(byRef.get('12588'),old.CURATED_NOTES.notes.find(n=>n.binding.repd_ref==='12588'));
 const before=JSON.stringify(projects),result=buildPrimaryNotes(projects,{asOf:asOf()});
 assert.equal(result.association_count,4);assert.equal(result.verified_count,0);assert.equal(result.solar1000_verified_delta,0);assert.equal(JSON.stringify(projects),before);
 assert.deepEqual(Object.keys(result.by_repd_ref).sort(),['12588','14806','15000','15149']);assert(Object.values(result.by_repd_ref).every(notes=>notes.length===1&&notes[0].association==='PROVISIONAL'));
});
test('cross-record source/binding substitution cannot borrow another reviewed government receipt',()=>{
 const records=copy(CURATED_NOTES.notes),a=records.find(n=>n.binding.repd_ref==='15149'),b=records.find(n=>n.binding.repd_ref==='14806');[a.source,b.source]=[b.source,a.source];assert.throws(()=>buildPrimaryNotes(projects,{records,asOf:asOf()}));
 const changed=copy(CURATED_NOTES.notes);changed.find(n=>n.binding.repd_ref==='15000').claim.type='DEVELOPMENT_CONSENT_GRANTED_WITH_MODIFICATIONS';assert.throws(()=>buildPrimaryNotes(projects,{records:changed,asOf:asOf()}));
});
test('component substitutions and VERIFIED promotion cannot create accepted project notes',()=>{
 for(const [solar,component] of [['15149','15150'],['14806','14807'],['15000','15001']]){
  const records=copy(CURATED_NOTES.notes),note=records.find(n=>n.binding.repd_ref===solar);note.binding.repd_ref=component;note.binding.gg_project_id='GG2050-REPD-'+component;assert.throws(()=>buildPrimaryNotes(projects,{records,asOf:asOf()}));
 }
 const records=copy(CURATED_NOTES.notes);records[0].association='VERIFIED';assert.throws(()=>buildPrimaryNotes(projects,{records,asOf:asOf()}));
});
test('GNR submission isJune27; acceptingJuly22 doesnotrewrite the frozen submission',()=>{
 assert.equal(projects.find(p=>p.repd_ref==='15149').planning_application_submitted,'2025-06-27');
 const records=copy(CURATED_NOTES.notes),note=records.find(n=>n.binding.repd_ref==='15149');note.claim.source_application_submitted='2025-07-22';assert.throws(()=>buildPrimaryNotes(projects,{records,asOf:asOf()}));
});
test('actual-population notes reject exclusive solar scope, zero battery power and operator/applicant conflation',()=>{
 for(const change of [n=>n.claim.development_scope.exclusive_solar_claim=true,n=>n.claim.development_scope.battery_component.capacity_mw=0,n=>n.claim.capacity_context.component_allocation_mw=800,n=>n.source.government_applicant=projects.find(p=>p.repd_ref==='15149').operator]){
  const records=copy(CURATED_NOTES.notes);change(records.find(n=>n.binding.repd_ref==='15149'));assert.throws(()=>buildPrimaryNotes(projects,{records,asOf:asOf()}));
 }
});
