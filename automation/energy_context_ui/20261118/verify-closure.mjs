import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const release=resolve(process.argv[2]),root=resolve(release,'../..'),base='automation/energy_context_ui/20261118/';
const bytes=path=>readFileSync(resolve(root,path)),hash=data=>createHash('sha256').update(data).digest('hex');
const pin=JSON.parse(readFileSync(resolve(release,'contracts/energy-context.v945.json'))),raw=bytes(base+'closure.json');
assert.equal(pin.schema,'pipeline.energy-context.v1');assert.match(pin.sha256,/^[a-f0-9]{64}$/);assert.equal(hash(raw),pin.sha256,'context manifest pin');
const manifest=JSON.parse(raw);assert.equal(manifest.schema,'pipeline.energy-context-closure.v1');
const expected=['model.mjs','view.mjs','styles.css','policy.json','review.json','verify-closure.mjs'].map(x=>base+x).concat(['automation/document_facts_ui/20261117-v939/model.mjs','automation/document_facts_ui/20261117-v939/facts.json','automation/grid_notice_ui/20261117-v938/notice.json','automation/grid_notice_ui/20261117-v938/model.mjs']);
assert.deepEqual(Object.keys(manifest.files).sort(),expected.sort(),'complete explicit runtime/checker closure');
for(const [path,sha]of Object.entries(manifest.files)){assert(!relative(root,resolve(root,path)).startsWith('..'));assert.match(sha,/^[a-f0-9]{64}$/);assert.equal(hash(bytes(path)),sha,path);}
const html=readFileSync(resolve(release,'index.html'),'utf8');
for(const name of ['view.mjs','styles.css'])assert(html.includes('../../'+base+name+'" integrity="sha256-'+Buffer.from(manifest.files[base+name],'hex').toString('base64')+'"'),name+' actual-byte SRI');
const source=readFileSync(resolve(release,'scripts/plugins/live-news.js'),'utf8');assert.equal(source.split('getViewAdapter:function(){return qualityAdapter;},').length,2,'single existing-adapter getter');
console.log('V9.45 complete energy context shared SHA/SRI closure: PASS');
