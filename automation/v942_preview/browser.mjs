/* Real source tap -> public receiver. No request interception or forced click.
 * This proves sender navigation and engine completion, not handset acceptance
 * or the separate GridAtlas card-presentation repair. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.env.V942_OUT||resolve(root,'work/v942-browser');mkdirSync(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'D:/githubfiles/.qa-tools/node/node_modules/playwright/index.mjs').href);
const server=createServer((req,res)=>{try{const url=new URL(req.url,'http://local');let p=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(p.startsWith(root+sep));if(url.pathname.endsWith('/'))p=resolve(p,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[extname(p)]||'application/octet-stream');res.end(readFileSync(p))}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),results=[];
try{
for(const width of [393,1440]){
 const mobile=width<500,context=await browser.newContext({viewport:{width,height:852},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=base+'/uk_renewables_pipeline/202611172355/?technology=all';
 const receipt={width,source,started:new Date().toISOString()};results.push(receipt);
 try{
 await page.goto(source,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)>0);
 await page.locator('#clearFilters').click();await page.waitForFunction(()=>document.querySelector('#tbody')?.dataset.total==='7775');
 await page.locator('#search').fill('2470');const anchor=page.locator('a.atlaslink[href*="repd_ref=2470"]').first();await anchor.scrollIntoViewIfNeeded();
 await page.waitForFunction(m=>document.querySelector('a.atlaslink')?.dataset.mapNavigation===(m?'current-tab':'new-tab'),mobile);
 const href=await anchor.getAttribute('href');receipt.href=href;assert.equal(new URL(href).searchParams.get('repd_ref'),'2470');
 receipt.hit=await anchor.evaluate(a=>{const r=a.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{width:r.width,height:r.height,reachable:a===h||a.contains(h)}});
 assert.ok(receipt.hit.reachable&&receipt.hit.width>=44&&receipt.hit.height>=44);
 let arrival;
 if(mobile){await anchor.tap();await page.waitForURL('https://ventusltd.github.io/gridatlas/atlas/**');arrival=page;assert.equal(context.pages().length,1)}
 else{const opened=context.waitForEvent('page');await anchor.click();arrival=await opened;await arrival.waitForLoadState('domcontentloaded')}
 await arrival.waitForFunction(()=>window.__GRIDATLAS_NEON_LINKS__?.arrival_engine?.terminal&&window.__GRIDATLAS_NEON_LINKS__?.compute_receipt?.status==='completed',null,{timeout:85000});
 receipt.receiver=await arrival.evaluate(()=>{const s=window.__GRIDATLAS_NEON_LINKS__;return{url:location.href,generation:document.documentElement.dataset.gridatlasGeneration,engine:s.arrival_engine,identity:s.compute_receipt.entity,nearest:s.compute_receipt.summary,failures:s.failures}});
 assert.equal(new URL(receipt.receiver.url).searchParams.get('repd_ref'),'2470');assert.equal(receipt.receiver.identity.id,'2470');assert.deepEqual(receipt.receiver.failures,[]);assert.ok(receipt.receiver.nearest.measured_count>0);
 await arrival.screenshot({path:resolve(output,'receiver-'+width+'.png')});
 if(mobile){await page.goBack({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#search')?.value==='2470'&&!!document.querySelector('a.atlaslink[href*="repd_ref=2470"]'),null,{timeout:60000});assert.equal(new URL(page.url()).searchParams.get('q'),'2470');receipt.backRetainedSearch=true}
 assert.deepEqual(errors,[]);receipt.pass=true;
 }catch(e){receipt.pass=false;receipt.error=String(e);throw e}
 finally{receipt.finished=new Date().toISOString();writeFileSync(resolve(output,'receipt.json'),JSON.stringify({scope:'sender native navigation and receiver computation; GridAtlas visible-card acceptance separate',results},null,2)+'\n');await context.close()}
}
}finally{await browser.close();await new Promise(r=>server.close(r))}
console.log(JSON.stringify(results));
