import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const edition=resolve(root,'uk_renewables_pipeline/202611172355'),parent=resolve(root,'uk_renewables_pipeline/202611171940');
const read=(base,p)=>readFileSync(resolve(base,p));
const hash=b=>createHash('sha256').update(b).digest('hex');
function walk(p,prefix=''){return readdirSync(p,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'||e.name==='__pycache__'?[]:e.isDirectory()?walk(resolve(p,e.name),prefix+e.name+'/'):[prefix+e.name])}
test('mobile navigation module is exact-pinned and the real entry loads it',()=>{
 const c=JSON.parse(read(edition,'contracts/mobile-map.v942.json'));
 assert.equal(c.schema,'globalgrid2050.mobile-map-native.v942');
 const bytes=read(root,c.module);assert.equal(hash(bytes),c.sha256);
 const html=read(edition,'index.html').toString();assert.ok(html.includes('src="../../'+c.module+'" integrity="sha256-'+createHash('sha256').update(bytes).digest('base64')+'"'));
});
test('all retained parent application/data bytes are unchanged',()=>{
 const permitted=new Set(['index.html','README.md','CHANGES.md','tests/run_v9_41.sh','tests/check_v9_41.mjs']);
 const retained=walk(parent).filter(p=>!permitted.has(p));assert.ok(retained.length>280);
 for(const p of retained)assert.deepEqual(read(edition,p),read(parent,p),p);
});
test('published candidate remains inside accepted edition byte budget',()=>{
 const size=walk(edition).reduce((n,p)=>n+read(edition,p).length,0);assert.ok(size<=18*1024*1024,'edition bytes '+size);
});
