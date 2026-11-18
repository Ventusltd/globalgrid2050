/* Unintercepted public sender -> accepted Vicinity controller. Device emulation
 * is bounded integration evidence, never physical-phone or fleet certification. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
assert.ok(process.env.PN_PUBLIC_ROOT,'explicit accepted Pipeline worktree/root required');
const root=resolve(process.env.PN_PUBLIC_ROOT);
const expectedIndex=process.env.EXPECTED_PN_INDEX_SHA256;assert.match(expectedIndex||'',/^[a-f0-9]{64}$/,'explicit accepted Pipeline index blob pin required');
const edition=process.env.PN_PUBLIC_EDITION,generation=process.env.EXPECTED_ATLAS_GENERATION;
assert.match(edition||'',/^\d{12}$/,'explicit published Pipeline edition required');assert.match(generation||'',/^\d{12}$/,'explicit accepted Atlas generation required');
const acceptedAtlas={sourceHead:'2834131b017ebfbb3b4b6b5fe755d72bfb11b074',generation:'202611180026',runtime:{path:'atlas/modules/202611180026-grid-vicinity.js',bytes:128364,sha256:'b6dab63111d672cacfdd84031ddd8d6d785412e6f0bfe03046fca326a9f6681b'},composition:{path:'atlas/manifests/202611180026-composition.json',bytes:71864,sha256:'df6649abf0104728cf36ec3b6e4de0799b68683743eefb7fe5e5ff882655cca9'},stationSource:{path:'atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson',bytes:1192748,sha256:'87976435766a58ddf19c99540b58cd7f18a224148af42ba55075d8851f9e6251',features:5800,basis:'Expected immutable loader input; not a runtime payload revalidation'}};
assert.equal(generation,acceptedAtlas.generation,'reviewed receiver generation required');
const source='https://globalgrid2050.com/uk_renewables_pipeline/'+edition+'/';
const expected=createHash('sha256').update(readFileSync(resolve(root,'uk_renewables_pipeline/'+edition+'/index.html'))).digest('hex');
assert.equal(expected,expectedIndex,'local root must contain the accepted Pipeline index blob');
assert.ok(process.env.PLAYWRIGHT_MODULE,'explicit installed Playwright module path required');
const pw=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=process.env.PN_PUBLIC_OUT||resolve(root,'work/public-journey-entry');mkdirSync(out,{recursive:true});assert.ok(!existsSync(resolve(out,'receipt.json')),'use a fresh output directory; retain earlier attempts');
const report={source,root,expectedPipelineIndex:expectedIndex,expectedAtlasGeneration:generation,scope:'actual public bounded entry sample; no interception, injected runtime or inferred connections',results:[]};
async function verifyAtlasPins(){
 const base='https://ventusltd.github.io/';
 const get=async path=>{const response=await fetch(base+'gridatlas/'+path,{signal:AbortSignal.timeout(60000)});assert.equal(response.status,200,path);return Buffer.from(await response.arrayBuffer())};
 const currentBytes=await get('atlas/current.json'),current=JSON.parse(currentBytes);assert.equal(current.generation,generation);
 const cartridge=current.cartridges.find(c=>c.id==='grid-vicinity');assert.ok(cartridge);assert.equal(cartridge.generation,generation);assert.equal(cartridge.sha256,acceptedAtlas.runtime.sha256);assert.equal(cartridge.bytes,acceptedAtlas.runtime.bytes);
 report.receiverPins={sourceHead:acceptedAtlas.sourceHead,currentGeneration:current.generation,assets:[]};
 for(const pin of [acceptedAtlas.runtime,acceptedAtlas.composition,acceptedAtlas.stationSource]){const bytes=await get(pin.path),sha=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,pin.bytes,pin.path+' bytes');assert.equal(sha,pin.sha256,pin.path+' hash');report.receiverPins.assets.push({path:pin.path,bytes:bytes.length,sha256:sha});if(pin===acceptedAtlas.stationSource)assert.equal(JSON.parse(bytes).features.length,pin.features)}
 report.receiverPins.stationRuntimePinStatus='The runtime tag is CALLER_SUPPLIED_NOT_REVALIDATED; separate public source bytes were checked, not a cryptographic runtime payload assertion.';
}
function sourceState(expected){
 const value=id=>document.getElementById(id)?.value??null;
 const category=document.querySelector('.pipeline-tabs [aria-selected="true"]')?.dataset.view??null;
 const dc=document.getElementById('datacentreHost');
 const state={category,technology:document.querySelector('#tech [aria-pressed="true"]')?.dataset.technology??null,status:document.querySelector('#status [aria-pressed="true"]')?.dataset.officialStatus??null,county:value('county'),query:value('search'),sort:value('sortProjects'),years:Object.fromEntries(['submittedYear','updatedYear','operationalYear'].map(id=>[id,document.querySelector('[data-year-filter="'+id+'"]')?.value??null])),dc:category==='datacentre'?{query:dc?.querySelector('input[type="search"]')?.value??null,kind:dc?.querySelector('[data-kind][aria-pressed="true"]')?.dataset.kind??null,country:dc?.querySelector('select[aria-label="Country"]')?.value??null}:null};
 return expected?JSON.stringify(state)===JSON.stringify(expected):state;
}
try{await verifyAtlasPins();for(const [engine,device,desktop]of [['chromium','Pixel 7',false],['webkit','iPhone 13',false],['chromium','Desktop Chrome',true]]){
 const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}: {})});
 try{for(const kind of ['repd','substation','datacentre','manual']){
 const context=await browser.newContext(pw.devices[device]),sourcePage=await context.newPage(),errors=[];let page=sourcePage;page.on('pageerror',e=>errors.push(e.message));context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const row={engine,device,desktop,kind,started:new Date().toISOString(),errors};report.results.push(row);
 try{
 const response=await page.goto(source,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),expected);
 await page.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)>0,null,{timeout:60000});
 let link;
 if(kind==='repd'){await page.locator('#clearFilters')[desktop?'click':'tap']();await page.locator('#search').fill('12588');link=page.locator('#tbody .pn-journey-link[href*="repd_ref=12588"]').first()}
 else if(kind==='substation'){await page.locator('.pipeline-tabs [data-view="grid"]')[desktop?'click':'tap']();link=page.locator('#gridLayerHost .pn-journey-link').first()}
 else if(kind==='datacentre'){await page.locator('.pipeline-tabs [data-view="datacentre"]')[desktop?'click':'tap']();await page.waitForFunction(()=>document.getElementById('datacentreHost')?.dataset.locationsState==='available',null,{timeout:60000});link=page.locator('#datacentreHost .ggdc-location-actions .pn-journey-link').first()}
 else link=page.locator('#journeyAtlasNav');
 await link.waitFor({state:'visible',timeout:60000});await link.scrollIntoViewIfNeeded();const href=await link.getAttribute('href'),url=new URL(href);row.href=href;assert.equal(url.origin+url.pathname,'https://ventusltd.github.io/gridatlas/atlas/');assert.equal(url.searchParams.get('journey'),'vicinity');
 if(kind!=='manual')assert.equal(url.searchParams.get('origin_type'),kind);
 row.hit=await link.evaluate(a=>{const r=a.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{width:r.width,height:r.height,reachable:h===a||a.contains(h)}});assert.ok(row.hit.reachable&&row.hit.width>=44&&row.hit.height>=44);
 row.sourceState=await page.evaluate(sourceState);
 if(desktop){const opened=context.waitForEvent('page');await link.click();page=await opened;await page.waitForLoadState('domcontentloaded');assert.equal(context.pages().length,2);row.navigation='native-new-tab'}else{await link.tap();assert.equal(context.pages().length,1);row.navigation='native-current-tab'}await page.waitForURL('https://ventusltd.github.io/gridatlas/atlas/**',{timeout:30000});
 await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__?.gridVicinity?.snapshot().opened,null,{timeout:100000});
 const panel=page.getByRole('region',{name:'Vicinity familiarisation'});await panel.waitFor({state:'visible'});
 if(kind==='manual'){
  row.manualInitial=await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot());assert.equal(row.manualInitial.phase,'CHOOSE_ORIGIN');assert.equal(row.manualInitial.origin,null);assert.equal(row.manualInitial.loadedRecords,0);
  await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__&&!window.__GRIDATLAS_V9_MAP__.isMoving(),null,{timeout:60000});
  row.manualChosenPoint=await page.evaluate(()=>{const c=window.__GRIDATLAS_V9_MAP__.getCenter();return[c.lng,c.lat]});
  await panel.getByRole('button',{name:'Use map centre',exact:true})[desktop?'click':'tap']();
 }
 await page.locator('#scada-ui-container input[data-layer-id="subs"]').waitFor({state:'attached',timeout:60000});
 await panel.getByRole('button',{name:'Show physical grid',exact:true})[desktop?'click':'tap']();
 await page.waitForFunction(()=>{const s=window.__GRIDATLAS_MODULES__?.gridVicinity?.snapshot();return s?.opened&&s.origin&&s.phase==='READY'&&Number.isInteger(s.loadedRecords)&&s.loadedRecords>0&&s.error===null},null,{timeout:100000});
 row.arrival=await page.evaluate(()=>({url:location.href,generation:document.documentElement.dataset.gridatlasGeneration,router:document.body.dataset.gridatlasRouter,state:window.__GRIDATLAS_MODULES__.gridVicinity.snapshot()}));
 const arrived=new URL(row.arrival.url);assert.equal(arrived.origin+arrived.pathname,'https://ventusltd.github.io/gridatlas/atlas/');assert.equal(row.arrival.generation,generation);assert.notEqual(row.arrival.router,'failed');assert.equal(row.arrival.state.realConnectionsInferred,0);assert.equal(row.arrival.state.error,null);assert.ok(Number.isInteger(row.arrival.state.loadedRecords)&&row.arrival.state.loadedRecords>0,'actual Vicinity data must be loaded; zero nearby matches remains legitimate');
 if(kind==='manual'){assert.equal(row.arrival.state.origin.type,'map-centre');assert.equal(row.arrival.state.origin.id,null);assert.deepEqual(row.arrival.state.origin.at,row.manualChosenPoint)}else{
  const state=row.arrival.state;assert.equal(state.origin.type,kind);assert.equal(state.origin.id,url.searchParams.get('origin_id'));assert.deepEqual(state.origin.at,[Number(url.searchParams.get('longitude')),Number(url.searchParams.get('latitude'))]);assert.equal(state.radiusKm,Number(url.searchParams.get('radius_km')));
  if(url.searchParams.has('name'))assert.equal(state.origin.name,url.searchParams.get('name'));
  assert.equal(arrived.searchParams.get('origin_id'),state.origin.id);
 }
 await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__?.gridVicinity?.snapshot().train?.index?.indexedRecords===5800,null,{timeout:100000});
 const route=panel.getByRole('group',{name:'Great Grid Journeys',exact:true});await route.waitFor({state:'visible'});
 const query=route.getByRole('searchbox',{name:'Station name, source ID, place or postcode',exact:true});await query.scrollIntoViewIfNeeded();await query.focus();assert.equal(await query.evaluate(e=>e===document.activeElement),true);
 const role=route.getByRole('combobox',{name:'Use search choice as',exact:true});row.routeOptions=await role.locator('option').evaluateAll(options=>options.map(o=>({value:o.value,label:o.textContent})));
 assert.deepEqual(row.routeOptions,[{value:'start',label:'START'},{value:'waypoint',label:'WAYPOINT'},{value:'finish',label:'FINISH'}]);
 for(const value of ['start','finish','waypoint','start'])await role.selectOption(value);
 for(const name of ['Find stations','Find place / postcode','Clear selected stops','Draw itinerary','Play','Pause','Previous stop','Step / next stop','Fit itinerary on map'])assert.equal(await route.getByRole('button',{name,exact:true}).count(),1,name+' accessible route control');
 const train=await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().train);row.routeInitial=train;
 assert.equal(train.itinerary.schema,'gridatlas.user-itinerary.v1');assert.equal(train.itinerary.mode,'vicinity');assert.equal(train.itinerary.limit,90);assert.equal(train.itinerary.selectedCount,0);assert.equal(train.plan,null);
 assert.equal(train.index.schema,'gridatlas.station-index.v1');assert.equal(train.index.sourceRecords,5800);assert.equal(train.index.indexedRecords,5800);assert.equal(train.index.connectionsInferred,0);assert.equal(train.index.datasetPinStatus,'CALLER_SUPPLIED_NOT_REVALIDATED');assert.deepEqual(train.index.datasetPin,acceptedAtlas.stationSource);
 await route.getByRole('button',{name:'Journey \u00b7 10 stops',exact:true})[desktop?'click':'tap']();
 let state=await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot());assert.equal(state.train.itinerary.mode,'journey');assert.equal(state.train.itinerary.limit,10);assert.equal(state.train.itinerary.selectedCount,0);assert.deepEqual(state.origin,row.arrival.state.origin);
 await route.getByRole('button',{name:'Vicinity \u00b7 90 stops',exact:true})[desktop?'click':'tap']();
 state=await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot());assert.equal(state.train.itinerary.mode,'vicinity');assert.equal(state.train.itinerary.limit,90);assert.equal(state.train.itinerary.selectedCount,0);assert.equal(state.train.plan,null);assert.deepEqual(state.origin,row.arrival.state.origin);row.routeControls='Accessible selectors and empty selected-stop caps checked; no itinerary was constructed or route claimed.';
 await panel.getByRole('group',{name:'Radius in whole kilometres',exact:true}).getByRole('slider',{name:'Vicinity radius in kilometres',exact:true}).focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().radiusKm),50);await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().radiusKm),1);
 const checkbox=panel.getByRole('group',{name:'Source voltage tags',exact:true}).getByRole('checkbox',{name:'400 kV',exact:true});await checkbox.uncheck();assert.equal(await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().selectedBands.includes('400')),false);
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);const box=await panel.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=845&&box.y+box.height<=391);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:resolve(out,engine+'-'+device.replace(/[^a-zA-Z0-9.-]+/g,'-')+'-'+kind+'.png')});
 if(desktop){await page.close();page=sourcePage;assert.equal(context.pages().length,1);row.returnState='source-tab-retained'}else{await page.goBack({waitUntil:'domcontentloaded'});row.returnState='native-back'}await page.waitForURL(source+'**');assert.equal(new URL(page.url()).origin+new URL(page.url()).pathname,source);
 if(kind==='repd')await page.waitForFunction(()=>document.querySelector('#search')?.value==='12588',null,{timeout:60000});
 if(kind==='substation')await page.waitForFunction(()=>document.querySelector('.pipeline-tabs [data-view="grid"]')?.getAttribute('aria-selected')==='true',null,{timeout:60000});
 if(kind==='datacentre')await page.waitForFunction(()=>document.querySelector('.pipeline-tabs [data-view="datacentre"]')?.getAttribute('aria-selected')==='true',null,{timeout:60000});
 await page.waitForFunction(sourceState,row.sourceState,{timeout:60000});row.restoredSourceState=await page.evaluate(sourceState);assert.deepEqual(row.restoredSourceState,row.sourceState,'actual source controls and active category must be restored or retained');
 assert.deepEqual(errors,[]);row.pass=true;
 }catch(e){row.pass=false;row.error=String(e);throw e}
 finally{row.finished=new Date().toISOString();writeFileSync(resolve(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');await context.close()}
 }}finally{await browser.close()}
}
report.pass=true;
}catch(error){report.pass=false;report.error=String(error);throw error}finally{report.finished=new Date().toISOString();writeFileSync(resolve(out,'receipt.json'),JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report));
