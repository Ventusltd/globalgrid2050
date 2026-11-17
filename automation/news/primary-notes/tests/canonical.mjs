/* Full local canonical snapshot proof; no network or product writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildPrimaryNotes} from '../model.mjs';
import {CATALOGUE,CATALOGUES} from '../catalogue.mjs';
const [folder,output]=process.argv.slice(2);assert(folder,'Usage: canonical.mjs <edition directory> [proof output file]');
const manifest=JSON.parse(await fs.readFile(path.join(folder,'data/v9.1/build_manifest.json'))),rows=[];
for(const part of manifest.project_partitions){const raw=await fs.readFile(path.join(folder,part.path));const hash=createHash('sha256').update(raw).digest('hex');assert.equal(hash,part.sha256);for(const entry of CATALOGUES)if(part.path===entry.catalogue.canonical.partition)assert.equal(hash,entry.catalogue.canonical.partition_sha256);const batch=JSON.parse(raw).projects;assert.equal(batch.length,part.record_count);rows.push(...batch);}
const result=buildPrimaryNotes(rows,{asOf:CATALOGUES.at(-1).catalogue.review.curated_at});assert.equal(result.association_count,4);assert.equal(result.verified_count,0);
const pilot=JSON.parse(await fs.readFile(path.join(folder,'solar1000/manifest.json')));assert.equal(pilot.ids.some(id=>['12588','15149','14806','15000'].includes(String(id))),false);
const exact=Object.fromEntries(CATALOGUES.map(entry=>[entry.catalogue.source.planning_reference,rows.filter(r=>r.planning_application_reference===entry.catalogue.source.planning_reference).length]));
assert(Object.values(exact).every(n=>n===1));
const fullPath=path.join(folder,'../202611132345/fixtures/2026q3/project_identity_2026q3.json');
const fullRaw=await fs.readFile(fullPath),full=JSON.parse(fullRaw).records;assert.equal(full.length,14967);
for(const entry of CATALOGUES.slice(1)){
 const scope=entry.catalogue.claim.development_scope;
 assert.equal(createHash('sha256').update(fullRaw).digest('hex'),scope.full_identity_fixture_sha256);
 const pair=full.filter(r=>r.planning_application_reference===entry.catalogue.source.planning_reference);
 assert.deepEqual(pair.map(r=>r.repd_ref).sort(),[...scope.component_repd_refs].sort());
 assert(pair.every(r=>r.gg_development_id===scope.gg_development_id));
 const battery=pair.find(r=>r.repd_ref===scope.battery_component.repd_ref);
 assert.equal(battery.technology,'Battery');assert.equal(battery.capacity_mw,null);
}
const proof={status:'PASS',canonical_rows:rows.length,exact_reference_matches:exact.EN010147,exact_reference_matches_by_planning_ref:exact,
 full_source_records:full.length,paired_bess_capacities_unknown:true,
 result,solar1000_member:false,source_writes:false,network:false};
if(output)await fs.writeFile(output,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:'PASS',canonical_rows:rows.length,exact_reference_matches:proof.exact_reference_matches,notes:result.association_count,verified:0,solar1000_member:false}));
