// Full local candidate source -> real Atlas -> cold Back. No intercepted runtime/data.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),edition=process.env.PN_JOURNEY_EDITION||'202611180451';
const out=process.env.JOURNEY_RETURN_OUT||resolve(root,'work/journey-return');mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'D:/githubfiles/.qa-tools/node/node_modules/playwright/index.mjs').href);
const server=createServer((req,res)=>{try{const u=new URL(req.url,'http://local');let p=resolve(root,'.'+decodeURIComponent(u.pathname));assert.ok(p.startsWith(root+sep));if(u.pathname.endsWith('/'))p=resolve(p,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[extname(p)]||'application/octet-stream');res.end(readFileSync(p))}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,entry='/uk_renewables_pipeline/'+edition+'/';
const report={scope:'LOCAL_FULL_CANDIDATE_COLD_BACK_REGRESSION_NOT_PUBLIC_ACCEPTANCE',edition,cases:[]};
function sourceState(expected){
 const value=id=>document.getElementById(id)?.value??null;
 const category=document.querySelector('.pipeline-tabs [aria-selected="true"]')?.dataset.view??null;
 const dc=document.getElementById('datacentreHost');
 const state={category,technology:document.querySelector('#tech [aria-pressed="true"]')?.dataset.technology??null,status:document.querySelector('#status [aria-pressed="true"]')?.dataset.officialStatus??null,county:value('county'),query:value('search'),sort:value('sortProjects'),years:Object.fromEntries(['submittedYear','updatedYear','operationalYear'].map(id=>[id,document.querySelector('[data-year-filter="'+id+'"]')?.value??null])),dc:category==='datacentre'?{query:dc?.querySelector('input[type="search"]')?.value??null,kind:dc?.querySelector('[data-kind][aria-pressed="true"]')?.dataset.kind??null,country:dc?.querySelector('select[aria-label="Country"]')?.value??null}:null};
 return expected?JSON.stringify(state)===JSON.stringify(expected):state;
}
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
try{for(const category of ['solar','bess'])for(const technology of ['all','wind_offshore']){
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const row={category,technology,errors,phase:'source-load'};report.cases.push(row);
 try{
 await page.goto(base+entry+'?technology=all',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#tbody')?.dataset.complete==='true');
 await page.locator('.pipeline-tabs [data-view="'+category+'"]').tap();await page.locator('#tech [data-technology="'+technology+'"]').tap();
 const ref=technology==='all'?'12588':'2470';await page.locator('#search').fill(ref);if(technology==='all')await page.locator('#county').selectOption('Oxfordshire');
 const sort=await page.locator('#sortProjects').evaluate(s=>[...s.options].find(o=>o.value!==s.value)?.value);assert.ok(sort,'real nondefault sort option required');await page.locator('#sortProjects').selectOption(sort);
 const target=page.locator('#tbody .pn-journey-link[href*="repd_ref='+ref+'"]').first();await target.waitFor();row.before=await page.evaluate(sourceState);assert.equal(row.before.category,category);assert.equal(row.before.technology,technology);assert.equal(row.before.query,ref);row.beforeTime=await page.evaluate(()=>performance.timeOrigin);
 row.phase='native-arrival';await target.tap();await page.waitForURL('https://ventusltd.github.io/gridatlas/atlas/**');await page.waitForFunction(id=>window.__GRIDATLAS_MODULES__?.gridVicinity?.snapshot().origin?.id===id,'repd:'+ref,{timeout:100000});assert.equal(await page.evaluate(()=>document.documentElement.dataset.gridatlasGeneration),'202611180026');
 await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen()});row.phase='cold-back';await page.goBack({waitUntil:'domcontentloaded'});await page.waitForURL(base+entry+'**');row.first=await page.evaluate(sourceState);
 await page.waitForFunction(sourceState,row.before,{timeout:60000});row.after=await page.evaluate(sourceState);row.afterTime=await page.evaluate(()=>performance.timeOrigin);assert.notEqual(row.beforeTime,row.afterTime,'a complete cold-document replay is required');assert.deepEqual(row.after,row.before,'all actual controls and category must match, no fields omitted');
 row.phase='trusted-controls';await page.locator('.pipeline-tabs [data-view="bess"]').tap();assert.equal(await page.evaluate(()=>document.querySelector('#tech [aria-pressed="true"]').dataset.technology),'bess');await page.locator('.pipeline-tabs [data-view="bess"]').press('Home');assert.equal(await page.evaluate(()=>document.querySelector('#tech [aria-pressed="true"]').dataset.technology),'solar');
 assert.deepEqual(errors,[]);row.pass=true;row.phase='complete';
 }catch(error){row.pass=false;row.error=String(error);row.last=await page.evaluate(sourceState);row.readiness=await page.evaluate(()=>({url:location.href,ready:document.readyState,complete:document.querySelector('#tbody')?.dataset.complete,total:document.querySelector('#tbody')?.dataset.total}));await page.screenshot({path:resolve(out,category+'-'+technology+'-failure.png')}).catch(()=>{});throw error}
 finally{writeFileSync(resolve(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');await context.close()}
}}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(report));
