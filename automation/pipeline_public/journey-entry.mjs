/* Unintercepted public sender -> accepted Vicinity controller. Device emulation
 * is bounded integration evidence, never physical-phone or fleet certification. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const edition=process.env.PN_PUBLIC_EDITION,generation=process.env.EXPECTED_ATLAS_GENERATION;
assert.match(edition||'',/^\d{12}$/,'explicit published Pipeline edition required');assert.match(generation||'',/^\d{12}$/,'explicit accepted Atlas generation required');
const source='https://globalgrid2050.com/uk_renewables_pipeline/'+edition+'/';
const expected=createHash('sha256').update(readFileSync(resolve(root,'uk_renewables_pipeline/'+edition+'/index.html'))).digest('hex');
const pw=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'D:/githubfiles/.qa-tools/node/node_modules/playwright/index.mjs').href);
const out=process.env.PN_PUBLIC_OUT||resolve(root,'work/public-journey-entry');mkdirSync(out,{recursive:true});
const report={source,expectedAtlasGeneration:generation,scope:'actual public bounded entry sample; no interception, injected runtime or inferred connections',results:[]};
try{for(const [engine,device]of [['chromium','Pixel 7'],['webkit','iPhone 13']]){
 const browser=await pw[engine].launch({headless:true});
 try{for(const kind of ['repd','substation','datacentre','manual']){
 const context=await browser.newContext(pw.devices[device]),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const row={engine,device,kind,started:new Date().toISOString(),errors};report.results.push(row);
 try{
 const response=await page.goto(source,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),expected);
 await page.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)>0,null,{timeout:60000});
 let link;
 if(kind==='repd'){await page.locator('#clearFilters').tap();await page.locator('#search').fill('12588');link=page.locator('#tbody .pn-journey-link[href*="repd_ref=12588"]').first()}
 else if(kind==='substation'){await page.locator('.pipeline-tabs [data-view="grid"]').tap();link=page.locator('#gridLayerHost .pn-journey-link').first()}
 else if(kind==='datacentre'){await page.locator('.pipeline-tabs [data-view="datacentre"]').tap();await page.waitForFunction(()=>document.getElementById('datacentreHost')?.dataset.locationsState==='available',null,{timeout:60000});link=page.locator('#datacentreHost .ggdc-location-actions .pn-journey-link').first()}
 else link=page.locator('#journeyAtlasNav');
 await link.waitFor({state:'visible',timeout:60000});await link.scrollIntoViewIfNeeded();const href=await link.getAttribute('href'),url=new URL(href);row.href=href;assert.equal(url.origin+url.pathname,'https://ventusltd.github.io/gridatlas/atlas/');assert.equal(url.searchParams.get('journey'),'vicinity');
 if(kind!=='manual')assert.equal(url.searchParams.get('origin_type'),kind);
 row.hit=await link.evaluate(a=>{const r=a.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{width:r.width,height:r.height,reachable:h===a||a.contains(h)}});assert.ok(row.hit.reachable&&row.hit.width>=44&&row.hit.height>=44);
 await link.tap();await page.waitForURL('https://ventusltd.github.io/gridatlas/atlas/**',{timeout:30000});assert.equal(context.pages().length,1);
 await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__?.gridVicinity?.snapshot().opened,null,{timeout:100000});
 const panel=page.getByRole('region',{name:'Vicinity familiarisation'});await panel.waitFor({state:'visible'});
 row.arrival=await page.evaluate(()=>({url:location.href,generation:document.documentElement.dataset.gridatlasGeneration,router:document.body.dataset.gridatlasRouter,state:window.__GRIDATLAS_MODULES__.gridVicinity.snapshot()}));
 const arrived=new URL(row.arrival.url);assert.equal(arrived.origin+arrived.pathname,'https://ventusltd.github.io/gridatlas/atlas/');assert.equal(row.arrival.generation,generation);assert.notEqual(row.arrival.router,'failed');assert.equal(row.arrival.state.realConnectionsInferred,0);assert.equal(row.arrival.state.error,null);
 if(kind!=='manual'){
  const state=row.arrival.state;assert.equal(state.origin.type,kind);assert.equal(state.origin.id,url.searchParams.get('origin_id'));assert.deepEqual(state.origin.at,[Number(url.searchParams.get('longitude')),Number(url.searchParams.get('latitude'))]);assert.equal(state.radiusKm,Number(url.searchParams.get('radius_km')));
  if(url.searchParams.has('name'))assert.equal(state.origin.name,url.searchParams.get('name'));
  assert.equal(arrived.searchParams.get('origin_id'),state.origin.id);
 }
 await page.getByRole('slider',{name:'Vicinity radius in kilometres'}).focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().radiusKm),50);await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().radiusKm),1);
 const checkbox=panel.getByRole('checkbox',{name:'400 kV',exact:true});await checkbox.uncheck();assert.equal(await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().selectedBands.includes('400')),false);
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);const box=await panel.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=845&&box.y+box.height<=391);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:resolve(out,engine+'-'+kind+'.png')});
 await page.goBack({waitUntil:'domcontentloaded'});await page.waitForURL(source+'**');assert.equal(new URL(page.url()).origin+new URL(page.url()).pathname,source);
 if(kind==='repd')await page.waitForFunction(()=>document.querySelector('#search')?.value==='12588',null,{timeout:60000});
 if(kind==='datacentre')await page.waitForFunction(()=>document.querySelector('.pipeline-tabs [data-view="datacentre"]')?.getAttribute('aria-selected')==='true',null,{timeout:60000});
 assert.deepEqual(errors,[]);row.pass=true;
 }catch(e){row.pass=false;row.error=String(e);throw e}
 finally{row.finished=new Date().toISOString();writeFileSync(resolve(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');await context.close()}
 }}finally{await browser.close()}
}
report.pass=true;
}finally{report.finished=new Date().toISOString();writeFileSync(resolve(out,'receipt.json'),JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report));
