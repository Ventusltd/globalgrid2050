// Verify publication/evidence integrity. A successful run does not pass the unmet device gates.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),read=p=>fs.readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=json('publication.json'),assessment=json('assessment.json'),bench=json('proof/bench.json');
for(const [file,proof]of Object.entries(manifest.files)){
  assert.ok(!file.startsWith('/')&&!file.includes('..'));
  const bytes=read(file);assert.equal(bytes.length,proof.bytes,file);assert.equal(sha(bytes),proof.sha256,file);
}
assert.equal(sha(read('proof/bench.json')),assessment.benchSha256);
assert.equal(sha(read('supplemental.json')),assessment.supplementalSha256);
assert.equal(bench.lenses.length,12);assert.equal(bench.coordination.length,2);
assert.equal(assessment.pass,false);assert.equal(assessment.checks.mobileTargets,false);assert.equal(assessment.checks.noWebGL2Fallback,false);
assert.equal(assessment.physicalPhoneTest,false);assert.equal(bench.pass,true);
console.log(JSON.stringify({pass:true,meaning:'Published evidence is internally consistent; device acceptance remains false',files:Object.keys(manifest.files).length}));
