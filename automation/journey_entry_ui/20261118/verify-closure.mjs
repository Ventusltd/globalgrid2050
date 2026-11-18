import {readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const release=resolve(process.argv[2]),root=resolve(release,'../..');
const contract=JSON.parse(readFileSync(resolve(release,'contracts/journey-entry.v943.json')));
assert.equal(contract.schema,'pipeline.journey-entry.v1');
for(const [path,hash] of Object.entries(contract.files)){
 const target=resolve(root,path);assert(!relative(root,target).startsWith('..'));
 assert.equal(createHash('sha256').update(readFileSync(target)).digest('hex'),hash,path);
}
const html=readFileSync(resolve(release,'index.html'),'utf8');
for(const name of ['styles.css','view.mjs']){
 const path='automation/journey_entry_ui/20261118/'+name;
 const sri='sha256-'+Buffer.from(contract.files[path],'hex').toString('base64');
 assert(html.includes('../../'+path+'" integrity="'+sri+'"'),name+' SRI');
}
console.log('V9.43 shared Journey closure: PASS');
