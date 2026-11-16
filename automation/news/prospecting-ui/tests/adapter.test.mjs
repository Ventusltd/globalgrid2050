import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {fixture,article} from './fixture.mjs';import {validateTriage,parseArtifact,selectRecords,safeSourceURL} from '../adapter.mjs';
test('keeps canonical source identities, distinct capacity bases, rank reasons and unknown momentum',()=>{const model=validateTriage(fixture());assert.equal(model.records[0].capacities.repd_installed_mw,50);assert.equal(model.records[1].capacities.it_load_mw,null);assert.equal(model.records[1].heat.independent_signal_count,null);assert.equal(selectRecords(model,{query:'1018'})[0].id,'REPD-1018');assert.equal(selectRecords(model,{recordType:'data_centre'})[0].id,'DC-WD-Q123');});
const invalid={
  paywall:p=>p.source_policy.paywalled_channels='SECONDARY',
  sme:p=>p.source_policy.sme_targeting=true,
  personal:p=>p.source_policy.directors_officers_residential_addresses=true,
  population:p=>p.input_receipts[0].population=7774,
  seed:p=>p.input_receipts[0].solar1000_count=999,
  score:p=>p.records[0].score=99,
  verification:p=>p.records[1].record_state='VERIFIED',
  momentum:p=>p.records[0].heat.state='HOT',
  financeEvent:p=>p.records[0].event_at=p.as_of,
  groupInference:p=>p.records[0].corporate_eligibility.eligible=true,
  capacity:p=>p.records[1].capacities.it_load_mw=0,
  negativeMW:p=>p.records[0].capacities.repd_installed_mw=-1,
  wrongID:p=>p.records[0].id='DC-WD-Q123',
  rank:p=>p.records[0].rank=2,
  count:p=>p.returned_count=1,
  source:p=>p.records[0].source.url='javascript:alert(1)',
  future:p=>p.records[1].source.retrieved_at='2027-01-01T00:00:00Z',
  falseFresh:p=>p.records[1].retrieval_freshness.age_days=10,
  impossibleDate:p=>p.as_of='2026-02-30T00:00:00Z',
  reason:p=>p.records[0].reasons[0].name='funding',
  enabledSource:p=>p.unsupported_interfaces[0].enabled=true,
};
for(const [name,mutate] of Object.entries(invalid))test(`rejects ${name}`,()=>{const input=fixture();mutate(input);assert.throws(()=>validateTriage(input));});
test('stale record clock stays stale and retrieval date cannot overwrite it',()=>{const input=fixture();input.records[0].record_freshness={state:'STALE',basis:'official record update date',timestamp:'2026-01-01',age_days:319};assert.equal(validateTriage(input).records[0].record_freshness.state,'STALE');});
test('source texts remain literal and unused personal fields are never projected',()=>{const input=fixture();input.records[0].officer_address='DO NOT PROJECT';const model=validateTriage(input);assert.match(model.records[0].name,/<img/);assert.equal(JSON.stringify(model).includes('DO NOT PROJECT'),false);});
test('article requires an admitted input, provisional state and open channel plus per-article access',()=>{const input=fixture();input.records[0].evidence=[article()];input.records[0].research_state='PROVISIONAL';assert.throws(()=>validateTriage(input));Object.assign(input.input_receipts[1],{state:'PROVISIONAL',sha256:'b'.repeat(64),rights_state:'ACCEPTED_RECEIPTS_SUPPLIED',generated_at:input.as_of,source_run_at:input.as_of,freshness:{state:'WITHIN_WINDOW',basis:'source run time',timestamp:input.as_of,age_days:0}});assert.equal(validateTriage(input).records[0].evidence.length,1);input.records[0].evidence[0].access.state='PAYWALLED';assert.throws(()=>validateTriage(input));});
test('hash mismatch fails before display and invalid UTF8 is rejected',async()=>{const bytes=new TextEncoder().encode(JSON.stringify(fixture()));const sha=createHash('sha256').update(bytes).digest('hex');assert.equal((await parseArtifact(bytes,sha)).returned_count,2);await assert.rejects(parseArtifact(bytes,'0'.repeat(64)));await assert.rejects(parseArtifact(new Uint8Array([255])));});
for(const url of ['https://127.0.0.1/x','https://host.internal/x','https://user:pass@example.org/x','https://example.org:444/x','http://example.org/x'])test(`unsafe URL ${url}`,()=>assert.throws(()=>safeSourceURL(url)));
