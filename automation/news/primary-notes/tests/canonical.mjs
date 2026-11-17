/* Full local canonical snapshot proof; no network or product writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildPrimaryNotes} from '../model.mjs';
import {CATALOGUE} from '../catalogue.mjs';
const [folder,output]=process.argv.slice(2);assert(folder,'Usage: canonical.mjs <edition directory> [proof output file]');
const manifest=JSON.parse(await fs.readFile(path.join(folder,'data/v9.1/build_manifest.json'))),rows=[];
for(const part of manifest.project_partitions){const raw=await fs.readFile(path.join(folder,part.path));const hash=createHash('sha256').update(raw).digest('hex');assert.equal(hash,part.sha256);if(part.path===CATALOGUE.canonical.partition)assert.equal(hash,CATALOGUE.canonical.partition_sha256);rows.push(...JSON.parse(raw).projects);}
const result=buildPrimaryNotes(rows,{asOf:CATALOGUE.review.curated_at});assert.equal(result.association_count,1);assert.equal(result.verified_count,0);
const pilot=JSON.parse(await fs.readFile(path.join(folder,'solar1000/manifest.json')));assert.equal(pilot.ids.some(id=>String(id)==='12588'),false);
const proof={status:'PASS',canonical_rows:rows.length,exact_reference_matches:rows.filter(r=>r.planning_application_reference==='EN010147').length,
 result,solar1000_member:false,source_writes:false,network:false};
if(output)await fs.writeFile(output,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:'PASS',canonical_rows:rows.length,exact_reference_matches:proof.exact_reference_matches,notes:result.association_count,verified:0,solar1000_member:false}));
