/** Exact-source and historical-preservation acceptance for the formal V9.29 edition. */
import assert from 'node:assert/strict';
import {protectedEditionChanges} from '../pipeline_release/edition_history.mjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,basename,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const EDITION=process.env.V929_CANDIDATE||'uk_renewables_pipeline/202611162354';
const candidate=resolve(ROOT,EDITION),baseline=resolve(ROOT,'uk_renewables_pipeline/202611161757');
const sourceBase=process.env.V929_BASE_SHA||execFileSync('git',['rev-parse','origin/main'],{cwd:ROOT,encoding:'utf8'}).trim();
const out=process.env.V929_OUT;
const bytes=p=>readFileSync(p),json=p=>JSON.parse(bytes(p)),hash=b=>createHash('sha256').update(b).digest('hex');
const git=args=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const receipt={status:'RUNNING',utc:new Date().toISOString(),head:git(['rev-parse','HEAD']),edition:EDITION,
  historical_base:sourceBase,checks:[],limitations:['Source-byte and local data/MAP-construction acceptance only; no public GridAtlas execution or source-rights approval.']};
const pass=(name,details={})=>{receipt.checks.push({name,status:'PASS',...details});console.log('PASS:',name);};
function treeBytes(dir){return readdirSync(dir).filter(n=>n!=='__pycache__').reduce((total,name)=>{const p=resolve(dir,name);return total+(statSync(p).isDirectory()?treeBytes(p):statSync(p).size);},0);}
function population(folder){
  const manifest=json(resolve(folder,'data/v9.1/build_manifest.json')),rows=[];
  for(const part of manifest.project_partitions){const raw=bytes(resolve(folder,part.path));assert.equal(hash(raw),part.sha256,part.path);const projects=JSON.parse(raw).projects;assert.equal(projects.length,part.record_count);rows.push(...projects);}
  for(const part of manifest.atlas_partitions){const raw=bytes(resolve(folder,part.path));assert.equal(hash(raw),part.sha256);assert.equal(JSON.parse(raw).features.length,part.feature_count);}
  assert.equal(rows.length,7775);assert.equal(rows.filter(x=>x.technology==='solar').length,3604);assert.equal(new Set(rows.map(x=>String(x.repd_ref))).size,7775);
  return rows;
}
try{
  const pageSource=bytes(resolve(candidate,'index.html')).toString('utf8');
  assert.doesNotMatch(pageSource,/<aside\b|class=["'][^"']*\bsidebar\b/i,'new edition must not restore the removed navigation sidebar');
  for(const required of ['class="release-header"','aria-label="Pipeline navigation"','../versions.html','../202611161757/','id="mapAtlasNav"','id="export"'])assert.ok(pageSource.includes(required),'compact navigation retains '+required);
  pass('sidebar markup removed; compact header preserves Versions, previous edition, MAP and CSV navigation');
  const pins=json(resolve(candidate,'contracts/layers-v929.json'));
  assert.equal(pins.source_commit,'8f94299afc8628908dc8bf461cb5ea607560332b');assert.equal(pins.files.length,8);
  for(const pin of pins.files){
    const raw=bytes(resolve(candidate,'scripts/layers',basename(pin.path)));
    const donor=execFileSync('git',['show',pins.source_commit+':'+pin.path],{cwd:ROOT});
    assert.deepEqual(raw,donor,pin.path+' must match the actual immutable donor, not only a self-declared manifest');
    assert.equal(hash(raw),pin.sha256,pin.path+' exact donor bytes');assert.equal(raw.length,pin.bytes);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${raw.length}\0`),raw])).digest('hex'),pin.git_blob);
  }
  pass('eight imported runtime assets exactly match reviewed donor Git blobs/SHA-256',{source_commit:pins.source_commit});
  const size=treeBytes(candidate);assert.ok(size<=18*1024*1024,`${size} exceeds 18 MiB`);pass('complete working edition fits unchanged 18 MiB budget',{bytes:size,limit:18*1024*1024});
  const current=population(candidate),original=population(baseline);assert.deepEqual(current,original);
  pass('all 7,775 official records and order equal frozen V9.28; 3,604 solar',{records:7775,solar:3604});
  for(const name of ['solar1000/manifest.json','solar1000/candidates.json'])assert.deepEqual(bytes(resolve(candidate,name)),bytes(resolve(baseline,name)),name);
  const selected=json(resolve(candidate,'solar1000/manifest.json'));assert.equal(selected.ids.length,1000);assert.equal(selected.independently_verified,0);
  assert.deepEqual(selected.ids,current.filter(x=>x.technology==='solar').map(x=>String(x.repd_ref)).sort((a,b)=>Number(a)-Number(b)).slice(0,1000));
  pass('ordered immutable Solar-1000 and provisional receipt bytes equal frozen V9.28',{sha256:hash(bytes(resolve(candidate,'solar1000/manifest.json')))});
  const receiver=await import(pathToFileURL(resolve(candidate,'scripts/core/atlas-receiver-v9-7.js')));
  const oldReceiver=await import(pathToFileURL(resolve(baseline,'scripts/core/atlas-receiver-v9-7.js')));
  for(let i=0;i<current.length;i++)assert.equal(receiver.buildAtlasDeepLinkV9_7(current[i]),oldReceiver.buildAtlasDeepLinkV9_7(original[i]),String(current[i].repd_ref));
  const existing=execFileSync(process.execPath,[resolve(candidate,'tests/check_map_contract_all_rows.mjs')],{cwd:ROOT,encoding:'utf8'}).trim();
  pass('all 7,775 original MAP routes and established all-row contract preserved',{established_check:existing});
  const snapshot=bytes(resolve(candidate,'news/pipeline_headlines.snapshot.json')),source=json(resolve(candidate,'news/snapshot-provenance.json'));
  assert.deepEqual(bytes(resolve(candidate,'news/snapshot-provenance.json')),bytes(resolve(baseline,'news/snapshot-provenance.json')),'original source clock/provenance receipt bytes preserved');
  assert.equal(hash(snapshot),source.sha256);assert.equal(JSON.parse(snapshot).items.length,71);assert.deepEqual(snapshot,bytes(resolve(baseline,'news/pipeline_headlines.snapshot.json')));
  pass('original saved 71-headline source bytes and publication clock preserved',{source_commit:source.source_commit,generated_at:source.generated_at,sha256:source.sha256});
  const historical=protectedEditionChanges({cwd:ROOT,base:sourceBase});
  assert.deepEqual(historical,[],'all numeric edition trees present in the pinned base remain immutable, including staged/unstaged changes and deletions');
  pass('every historical edition tree remains unchanged against origin/main',{base:sourceBase});
  receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.failure=error.stack;throw error;}
finally{if(out){mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'invariants.json'),JSON.stringify(receipt,null,2)+'\n');}}
