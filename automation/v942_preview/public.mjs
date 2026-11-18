/* Actual public mobile tap, visible result, rotation and Back. No interception.
 * Browser device emulation is not physical handset certification. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const pw=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'D:/githubfiles/.qa-tools/node/node_modules/playwright/index.mjs').href);
const output=process.env.V942_PUBLIC_OUT||resolve(root,'work/v942-public');mkdirSync(output,{recursive:true});
const source='https://globalgrid2050.com/uk_renewables_pipeline/202611172355/';
const digest=b=>createHash('sha256').update(b).digest('hex');
const expected=digest(readFileSync(resolve(root,'uk_renewables_pipeline/202611172355/index.html')));
const report={started:new Date().toISOString(),scope:'actual public V9.42 sender and served Atlas mobile result; bounded sample, not fleet or physical-device acceptance',results:[]};
const cases=[{engine:'chromium',device:'Pixel 7'},{engine:'chromium',device:'Galaxy S9+'},{engine:'webkit',device:'iPhone 13'}];
try{
for(const spec of cases){
 const browser=await pw[spec.engine].launch({headless:true,...(spec.engine==='chromium'?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}: {})});
 try{for(const ref of ['2470','12588']){
 const options=pw.devices[spec.device];assert.ok(options,'device descriptor missing');
 const context=await browser.newContext(options),page=await context.newPage(),errors=[];
 const row={...spec,ref,started:new Date().toISOString(),errors};report.results.push(row);page.on('pageerror',e=>errors.push(e.message));
 try{
 const response=await page.goto(source,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200);assert.equal(digest(await response.body()),expected);
 await page.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)>0,null,{timeout:60000});
 await page.locator('#clearFilters').tap();await page.waitForFunction(()=>document.querySelector('#tbody')?.dataset.total==='7775');await page.locator('#search').fill(ref);
 const link=page.locator('a.atlaslink[href*="repd_ref='+ref+'"]').first();await link.scrollIntoViewIfNeeded();assert.equal(await link.getAttribute('target'),'_self');
 const href=await link.getAttribute('href'),url=new URL(href);assert.equal(url.origin+url.pathname,'https://ventusltd.github.io/gridatlas/atlas/');assert.equal(url.searchParams.get('repd_ref'),ref);row.clickedHref=href;
 row.hit=await link.evaluate(a=>{const r=a.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{width:r.width,height:r.height,reachable:h===a||a.contains(h)}});assert.ok(row.hit.reachable&&row.hit.width>=44&&row.hit.height>=44);
 await link.tap();await page.waitForURL('https://ventusltd.github.io/gridatlas/atlas/**',{timeout:30000});assert.equal(context.pages().length,1);
 await page.waitForFunction(id=>{const s=window.__GRIDATLAS_NEON_LINKS__;return s?.compute_receipt?.status==='completed'&&s.compute_receipt.entity.id===id&&s.arrival_engine?.terminal&&s.last_selection?.nearest_name},ref,{timeout:100000});
 const summary=page.locator('.gridatlas-arrival-summary').first();await summary.waitFor({state:'visible',timeout:30000});
 row.receiver=await page.evaluate(()=>{const s=window.__GRIDATLAS_NEON_LINKS__;return{url:location.href,generation:document.documentElement.dataset.gridatlasGeneration,selection:s.last_selection,identity:s.compute_receipt.entity,engine:s.arrival_engine,measurements:s.compute_receipt.summary,failures:s.failures}});
 assert.equal(row.receiver.identity.id,ref);assert.deepEqual(row.receiver.failures,[]);const text=await summary.innerText();assert.ok(text.includes(row.receiver.selection.nearest_name));assert.ok(text.includes('km straight-line'));assert.ok(text.includes('Screening only; connection unverified.'));row.visibleSummary=text;
 const within=async locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1});assert.ok(await within(summary),'compact result outside viewport');
 const details=page.getByRole('button',{name:'Show project details',exact:true});const box=await details.boundingBox();assert.ok(box.width>=44&&box.height>=44);await details.tap();await page.locator('.neon-km').first().waitFor({state:'visible'});
 if(ref==='2470')await page.waitForTimeout(12000);
 assert.ok(await page.locator('.neon-km').first().isVisible(),'reader restore was lost');await page.getByRole('button',{name:'Minimise project details',exact:true}).tap();
 if(spec.engine==='chromium'){
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:options.deviceScaleFactor,mobile:true,screenOrientation:{type:'landscapePrimary',angle:90}});row.rotation='CDP portrait to landscape';
 }else{await page.setViewportSize({width:844,height:390});row.rotation='WebKit viewport landscape emulation'}
 await page.waitForTimeout(300);assert.ok(await within(summary),'landscape result outside viewport');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:resolve(output,spec.engine+'-'+spec.device.replaceAll(' ','-')+'-'+ref+'.png')});
 await page.goBack({waitUntil:'domcontentloaded'});await page.waitForFunction(id=>document.querySelector('#search')?.value===id&&!!document.querySelector('a.atlaslink[href*="repd_ref='+id+'"]'),ref,{timeout:60000});assert.equal(new URL(page.url()).searchParams.get('q'),ref);row.backRetainedSearch=true;assert.deepEqual(errors,[]);row.pass=true;
 }catch(e){row.pass=false;row.error=String(e);throw e}
 finally{row.finished=new Date().toISOString();writeFileSync(resolve(output,'receipt.json'),JSON.stringify(report,null,2)+'\n');await context.close()}
 }}finally{await browser.close()}
}
report.pass=true;
}finally{report.finished=new Date().toISOString();writeFileSync(resolve(output,'receipt.json'),JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report));
