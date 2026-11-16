import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parsePriorityBundle} from '../bundle.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const result=JSON.parse(execFileSync('python',['-c',"import json; from automation.news.build_prospecting_priority import build_artifacts; print(json.dumps({k:v.decode() for k,v in build_artifacts(as_of='2026-11-16T17:40:00Z').items()}))"],{cwd:root,encoding:'utf8',maxBuffer:24*1024*1024}));
const bytes=value=>new TextEncoder().encode(value);
const priority=bytes(result['priority.json']),manifest=bytes(result['manifest.json']);
const sha=value=>createHash('sha256').update(value).digest('hex');
test('actual producer bundle preserves all official and pilot identities',async()=>{
  const b=await parsePriorityBundle(priority,manifest,sha(manifest));
  assert.equal(b.members.size,7775);assert.equal(b.byId.size,1000);assert.equal(b.manifest.inventory.solar1000_ids.length,1000);
  assert.equal(b.model.records.every(r=>r.heat.state==='UNKNOWN'&&r.evidence.length===0),true);
});
test('requires a trusted manifest digest',async()=>{await assert.rejects(parsePriorityBundle(priority,manifest),/pinned/);});
test('altered manifest rejected',async()=>{await assert.rejects(parsePriorityBundle(priority,bytes(result['manifest.json']+' '),sha(manifest)),/digest/);});
test('altered priority rejected',async()=>{const altered=priority.slice();altered[4]^=1;await assert.rejects(parsePriorityBundle(altered,manifest,sha(manifest)),/hash/);});
for(const [name,mutate,pattern] of [
  ['duplicate inventory',m=>{m.inventory.official_ids[1]=m.inventory.official_ids[0];},/inventory/],
  ['wrong pilot order',m=>m.inventory.solar1000_ids.reverse(),/order/],
  ['wrong rank count',m=>m.ranked_count++,/differs/],
  ['wrong source receipt',m=>m.input_receipts[0].manifest_sha256='0'.repeat(64),/receipt/],
  ['wrong as-of',m=>m.as_of='2026-11-17T17:40:00Z',/differs/],
  ['missing output',m=>delete m.files['priority.csv'],/files/],
])test(name,async()=>{const m=JSON.parse(result['manifest.json']);mutate(m);const raw=bytes(JSON.stringify(m));await assert.rejects(parsePriorityBundle(priority,raw,sha(raw)),pattern);});
