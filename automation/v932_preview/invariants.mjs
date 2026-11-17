/** Exact-source and historical-preservation acceptance for the formal V9.32 edition. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,basename,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {protectedEditionChanges} from '../pipeline_release/edition_history.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const EDITION=process.env.V932_CANDIDATE||'uk_renewables_pipeline/202611170324';
const candidate=resolve(ROOT,EDITION),baseline=resolve(ROOT,'uk_renewables_pipeline/202611170243');
const sourceBase=process.env.V932_BASE_SHA||execFileSync('git',['rev-parse','origin/main'],{cwd:ROOT,encoding:'utf8'}).trim();
const out=process.env.V932_OUT;
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
  const primaryContractBytes=bytes(resolve(candidate,'contracts/primary-notes.v932.json')),primaryContract=JSON.parse(primaryContractBytes),primaryDonor='b5eed3d2ae878c78e5153be06ef531c11fff2148';
  assert.equal(primaryContract.schema,'globalgrid2050.primary-note-cartridge.v1');assert.equal(primaryContract.producer.commit,primaryDonor);assert.deepEqual(Object.keys(primaryContract.files).sort(),['catalogue.mjs','model.mjs','notes.json']);
  const primaryCache=resolve(ROOT,'automation/primary_note_ui',primaryDonor);
  for(const [name,pin] of Object.entries(primaryContract.files)){
    const raw=bytes(resolve(primaryCache,name)),donor=execFileSync('git',['show',primaryDonor+':'+pin.source_path],{cwd:ROOT});assert.deepEqual(raw,donor,name+' exact reviewed donor');assert.equal(raw.length,pin.bytes);assert.equal(hash(raw),pin.sha256);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${raw.length}\0`),raw])).digest('hex'),pin.git_blob);
  }
  const renderer=bytes(resolve(ROOT,primaryContract.renderer.path));assert.equal(renderer.length,3748);assert.equal(hash(renderer),'45344a1ad8b3926811f7146bb0bdc458d605e688af30b286bec294fc5f0a4806');assert.equal(primaryContract.renderer.bytes,renderer.length);assert.equal(primaryContract.renderer.sha256,hash(renderer));
  assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${renderer.length}\0`),renderer])).digest('hex'),primaryContract.renderer.git_blob);
  const primaryBoot=bytes(resolve(candidate,'scripts/plugins/primary-notes-v932.mjs')).toString('utf8');assert.ok(primaryBoot.includes("const manifestHash = '"+hash(primaryContractBytes)+"'"));assert.match(primaryBoot,/state\.canonicalModel\?\.projects/);assert.doesNotMatch(primaryBoot,/fetch\([^)]*projects|project_partitions/);
  const primaryModel=await import(pathToFileURL(resolve(primaryCache,'model.mjs'))),primaryCatalogue=(await import(pathToFileURL(resolve(primaryCache,'catalogue.mjs')))).CATALOGUE;
  assert.match(bytes(resolve(primaryCache,'model.mjs')).toString('utf8'),/import data from '\.\/notes\.json' with \{type:'json'\}/);
  const allCanonical=population(candidate),canonicalBefore=JSON.stringify(allCanonical),primaryIndex=primaryModel.buildPrimaryNotes(allCanonical,{asOf:new Date().toISOString()});
  assert.deepEqual(primaryContract.expected,{canonical_population:7775,associations:1,verified:0,solar1000_verified_delta:0});assert.equal(primaryIndex.association_count,1);assert.equal(primaryIndex.verified_count,0);assert.equal(primaryIndex.solar1000_verified_delta,0);assert.deepEqual(Object.keys(primaryIndex.by_repd_ref),['12588']);assert.equal(JSON.stringify(allCanonical),canonicalBefore);
  const primary=primaryIndex.by_repd_ref['12588'][0];assert.equal(primary.association,'PROVISIONAL');assert.equal(primary.source.sha256,'335eff9eed9c8e32658fe70186d2f02f4bf82a92ffbed1eaa835ac7ced0f857e');assert.equal(primary.source.bytes,1247918);assert.equal(primary.source.document_date,'2026-11-10');assert.equal(primary.news_metadata.published_at,'2026-11-11T12:29:34Z');assert.equal(primary.source.retrieved_at.slice(0,10),'2026-11-17');
  assert.equal(primary.rights.scope,'GOVERNMENT_AUTHORED_DECISION_FACTS_ONLY');assert.equal(primary.rights.terms_receipts.length,2);assert.equal(primary.news_metadata.publisher_content_rights,'NOT_ASSESSED');assert.equal(primary.claim.capacity_context.original_application_repd_baseline_mw,840);assert.equal(primary.claim.capacity_context.final_reduced_capacity_mw,null);assert(Object.values(primary.claim.unknowns).every(v=>v===null));
  assert.equal(hash(bytes(resolve(ROOT,'uk_renewables_pipeline',primaryCatalogue.canonical.edition,primaryCatalogue.canonical.partition))),primaryCatalogue.canonical.partition_sha256);
  assert.equal(allCanonical.find(r=>r.repd_ref==='12588').status,'Application Submitted');assert.equal(primary.claim.source_application_submitted,'2024-11-14');assert.equal(primaryCatalogue.canonical.fields.planning_application_submitted,'2024-11-15');
  for(const ref of ['10529','18174'])assert.equal(primaryIndex.by_repd_ref[ref],undefined);
  assert.throws(()=>primaryModel.buildPrimaryNotes(allCanonical,{asOf:'2026-11-17T03:16:19.999999999Z'}),/future/);
  pass('three exact primary donor blobs and ROOT renderer preserve unique canonical provisional binding, receipt/rights/date/null distinctions',{producer:primaryDonor,runtime_bytes:Object.values(primaryContract.files).reduce((n,p)=>n+p.bytes,0),renderer_sha256:hash(renderer),canonical:7775,associations:1,verified:0,solar1000_verified_delta:0,source_document_sha256:primary.source.sha256});
  const priceContractBytes=bytes(resolve(candidate,'contracts/prices.v931.json')),priceContract=JSON.parse(priceContractBytes);
  const priceProducer='78d5360239e1a5fcffa83fcb30d5937c5521acb9',priceCache=resolve(ROOT,'automation/price_daily_ui',priceProducer);
  assert.equal(priceContract.producer.commit,priceProducer);assert.deepEqual(Object.keys(priceContract.files).sort(),['canvas.mjs','model.mjs','styles.css','view.mjs']);
  for(const [name,pin] of Object.entries(priceContract.files)){
    const raw=bytes(resolve(priceCache,name)),donor=execFileSync('git',['show',priceProducer+':automation/news/price-daily-ui/'+name],{cwd:ROOT});
    assert.deepEqual(raw,donor,name+' actual accepted producer bytes');assert.equal(raw.length,pin.bytes);assert.equal(hash(raw),pin.sha256);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${raw.length}\0`),raw])).digest('hex'),pin.git_blob);
  }
  const priceBoot=bytes(resolve(candidate,'scripts/plugins/prices-v931.mjs')).toString('utf8');assert.ok(priceBoot.includes("const manifestHash = '"+hash(priceContractBytes)+"'"));
  const priceModel=await import(pathToFileURL(resolve(priceCache,'model.mjs')));assert.deepEqual(priceContract.input,priceModel.SOURCE);
  assert.equal(priceModel.SOURCE.commit,'cf48c8d6fdd9ab686c4af7261149d81a0129f7fc');assert.equal(priceModel.SOURCE.index.sha256,'3c3ad8e0d8169b4bc253dabbad2a7d35b64984f40accce1abd016e1ca15a1e8e');assert.equal(priceModel.SOURCE.index.bytes,3616);
  async function priceInput(name,pin){
    let raw;if(process.env.V932_PRICE_SOURCE)raw=bytes(resolve(process.env.V932_PRICE_SOURCE,name));
    else{const response=await fetch(priceModel.SOURCE.base+name,{redirect:'error',signal:AbortSignal.timeout(15000)});assert.ok(response.ok);raw=Buffer.from(await response.arrayBuffer());}
    assert.equal(raw.length,pin.bytes);assert.equal(hash(raw),pin.sha256,name+' immutable source bytes');return raw;
  }
  const priceIndex=priceModel.validateIndex(JSON.parse(await priceInput('index.json',priceModel.SOURCE.index)));
  const annualRows=(await Promise.all(priceIndex.parts.map(async part=>priceModel.validateYear(JSON.parse(await priceInput(part.path,part)),part,priceIndex)))).flat();
  const priceSources=JSON.parse(await priceInput(priceIndex.sources.path,priceIndex.sources));await priceInput(priceIndex.parquet.path,priceIndex.parquet);
  const priceSummary=priceModel.summarise(annualRows),expected={daily_rows:annualRows.length,source_parts:priceSources.files.length,source_prices:priceSummary.priced,complete_days:priceSummary.completeDays,partial_days:priceSummary.partialDays,missing_days:priceSummary.missingDays,utc_disagreements:priceSummary.clockMismatches,first_date:annualRows[0].date,last_date:annualRows.at(-1).date};
  assert.deepEqual(expected,{daily_rows:3957,source_parts:188,source_prices:189270,complete_days:3919,partial_days:25,missing_days:13,utc_disagreements:106668,first_date:'2016-01-01',last_date:'2026-10-31'});assert.deepEqual(priceContract.expected,expected);
  assert.equal(priceSources.input_grain.rows,189270);assert.equal(priceSources.utc_alignment_mismatches,106668);assert.equal(new Set(priceSources.files.map(p=>p.path)).size,188);
  assert.match(priceIndex.calendar_quality,/Source-declared/);assert.match(priceContract.scope,/no interpolation.*realtime/);
  pass('four exact price donor blobs and accepted source/index/annual/hash provenance preserve source-day gaps/partial/UTC distinctions',{producer:priceProducer,source:priceModel.SOURCE.commit,runtime_bytes:Object.values(priceContract.files).reduce((n,p)=>n+p.bytes,0),expected,transport:process.env.V932_PRICE_SOURCE?'existing data-owner bytes matched to immutable pins':'immutable source-owner HTTPS'});
  const contractPath=resolve(candidate,'contracts/dc-locations.v930.json'),contractBytes=bytes(contractPath),contract=JSON.parse(contractBytes);
  const donorCommit='83e7c36d08ef98f3665f7f35b8637405391dc4be';
  assert.equal(contract.producer.commit,donorCommit);assert.deepEqual(Object.keys(contract.files).sort(),['actions.css','actions.mjs']);
  const cache=resolve(ROOT,'automation/dc_location_ui',donorCommit);
  for(const [name,pin] of Object.entries(contract.files)){
    const local=bytes(resolve(cache,name)),donor=execFileSync('git',['show',donorCommit+':automation/news/dc-locations/'+name],{cwd:ROOT});
    assert.deepEqual(local,donor,name+' actual immutable producer bytes');assert.equal(hash(local),pin.sha256);assert.equal(local.length,pin.bytes);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${local.length}\0`),local])).digest('hex'),pin.git_blob);
  }
  const boot=bytes(resolve(candidate,'scripts/plugins/dc-locations-v930.mjs')).toString('utf8');
  assert.ok(boot.includes("const manifestHash = '"+hash(contractBytes)+"'"),'host pins exact accepted manifest bytes');
  const imported=await import(pathToFileURL(resolve(cache,'actions.mjs')));assert.deepEqual(contract.input,imported.INPUT);
  assert.equal(contract.input.sha256,'6f68e078d9b57057acdda679288730e638553f68df884dfd747c5049e56ea88e');assert.equal(contract.input.bytes,183561);
  let input,transport;
  if(process.env.V932_DATA_SOURCE){input=bytes(resolve(process.env.V932_DATA_SOURCE));transport='explicit existing data-owner file, byte checked';}
  else{const response=await fetch(contract.input.url,{redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(response.ok,true);input=Buffer.from(await response.arrayBuffer());transport='immutable data-owner HTTPS source';}
  assert.equal(input.length,contract.input.bytes);assert.equal(hash(input),contract.input.sha256);
  const locations=JSON.parse(input),indexed=imported.indexLocations(locations),oldDC=json(resolve(baseline,'global-datacentres/projects.json')).records;
  assert.deepEqual([...indexed.keys()].sort(),oldDC.map(x=>x.id).sort(),'exact100originalIDs; no name-based join');
  const observed={records:locations.features.length,with_address:locations.features.filter(f=>f.properties.addresses.length).length,address_statements:locations.features.flatMap(f=>f.properties.addresses).length,with_geometry:locations.features.filter(f=>f.geometry).length,wikidata_reported_points:locations.features.filter(f=>f.properties.location_precision==='WIKIDATA_REPORTED_POINT').length,postcode_centroids:locations.features.filter(f=>f.properties.location_precision==='POSTCODE_CENTROID_APPROXIMATE').length,unknown_geometry:locations.features.filter(f=>!f.geometry).length,screenable_gb_records:locations.features.filter(f=>imported.screenUrl(f)!==null).length};
  assert.deepEqual(observed,{records:100,with_address:38,address_statements:39,with_geometry:64,wikidata_reported_points:39,postcode_centroids:25,unknown_geometry:36,screenable_gb_records:34});assert.deepEqual(contract.expected,observed);
  assert.ok(locations.features.every(f=>f.properties.facility_identity_review==='NOT_INDEPENDENTLY_VERIFIED'&&f.properties.grid_connection_assessed===false));
  pass('exact83e cartridge/cache/host-manifest pins and100originalIDs/38addressrecords/39statements/34GBscreens',{donorCommit,observed,source_sha256:hash(input),transport,cache_bytes:treeBytes(cache)});
  const pageSource=bytes(resolve(candidate,'index.html')).toString('utf8');
  assert.ok(pageSource.includes('integrity="sha256-'+createHash('sha256').update(bytes(resolve(priceCache,'styles.css'))).digest('base64')+'"'),'price CSS SRI');
  assert.ok(pageSource.includes('https://globalgrid2050.com/uk_energy_tracking_v6/'),'original independent V6 workspace link retained');
  assert.ok(!bytes(resolve(candidate,'scripts/plugins/layers-v929.mjs')).toString('utf8').includes("prices: {host:"),'only the new price owner mounts the Prices category');
  const cssSRI='sha256-'+createHash('sha256').update(bytes(resolve(cache,'actions.css'))).digest('base64');assert.ok(pageSource.includes('integrity="'+cssSRI+'"'),'optional CSS is pinned by SRI');
  assert.doesNotMatch(pageSource,/<aside\b|class=["'][^"']*\bsidebar\b/i,'new edition must not restore the removed navigation sidebar');
  for(const required of ['class="release-header"','aria-label="Pipeline navigation"','../versions.html','../202611170243/','id="mapAtlasNav"','id="export"'])assert.ok(pageSource.includes(required),'compact navigation retains '+required);
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
  pass('all 7,775 official records and order equal frozen V9.31; 3,604 solar',{records:7775,solar:3604});
  for(const name of ['solar1000/manifest.json','solar1000/candidates.json'])assert.deepEqual(bytes(resolve(candidate,name)),bytes(resolve(baseline,name)),name);
  const selected=json(resolve(candidate,'solar1000/manifest.json'));assert.equal(selected.ids.length,1000);assert.equal(selected.independently_verified,0);
  assert.deepEqual(selected.ids,current.filter(x=>x.technology==='solar').map(x=>String(x.repd_ref)).sort((a,b)=>Number(a)-Number(b)).slice(0,1000));
  pass('ordered immutable Solar-1000 and provisional receipt bytes equal frozen V9.31',{sha256:hash(bytes(resolve(candidate,'solar1000/manifest.json')))});
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
  assert.deepEqual(historical,[],'every edition directory present in the pinned base remains unchanged');
  pass('every baseline edition tree remains unchanged against the pinned Git base',{base:sourceBase});
  receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.failure=error.stack;throw error;}
finally{if(out){mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'invariants.json'),JSON.stringify(receipt,null,2)+'\n');}}
