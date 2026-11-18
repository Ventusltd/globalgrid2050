import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const {chromium}=createRequire(resolve(process.env.PLAYWRIGHT_MODULE_ROOT||'D:/githubfiles/.qa-tools/node','package.json'))('playwright');
const maps={repd:'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=2470&technology=wind_offshore&latitude=52&longitude=2&zoom=12',sub:'https://ventusltd.github.io/gridatlas/atlas/?technology=substation&latitude=51&longitude=-1&project=Sub',dc:'https://ventusltd.github.io/gridatlas/atlas/?technology=datacentre&latitude=52&longitude=-1&project=DC'};
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>a{display:inline-block;min-height:44px;min-width:44px}.project-actions{width:124px}</style><link rel="stylesheet" href="/styles.css"><a id="mapAtlasNav" href="https://ventusltd.github.io/gridatlas/atlas/">MAP ATLAS</a><div id="tech"><button aria-pressed="true" data-technology="all">All</button></div><div id="status"><button aria-pressed="true" data-official-status="All">All</button></div><input id="search" value="2470"><select id="county"><option>All</option></select><select id="sortProjects"><option>capacity_desc</option></select><table><tbody id="tbody" data-total="1"><tr><td class="site">Origin</td><td><div class="project-actions"><a class="atlaslink" target="_blank" href="${maps.repd}">MAP</a></div></td></tr></tbody></table><div id="gridLayerHost"><table><tr data-source-id="grid_substations:0"><td><strong>Sub</strong></td><td><a href="${maps.sub}">MAP</a></td></tr></table></div><div id="datacentreHost"><table class="ggdc-table"><tbody><tr><td><div class="ggdc-identity">DC<small class="ggdc-id">DC-WD-Q100</small></div></td><td><div class="ggdc-location-actions"><a href="${maps.dc}">Screen</a></div></td></tr><tr><td><small class="ggdc-id">DC-WD-Q200</small></td><td>No point</td></tr></tbody></table></div><script type="module" src="/navigation.mjs"></script><script type="module" src="/view.mjs"></script>`;
const server=createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname.slice(1);if(['model.mjs','view.mjs','navigation.mjs','styles.css'].includes(name)){res.setHeader('content-type',name.endsWith('.css')?'text/css':'text/javascript');res.end(readFileSync(name==='navigation.mjs'?resolve(root,'mobile_map_ui/20261118-v942/navigation.mjs'):new URL('./'+name,import.meta.url)))}else{res.setHeader('content-type','text/html');res.end(fixture)}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
try{for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:{width:mobile?393:1440,height:852},isMobile:mobile,hasTouch:mobile});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelectorAll('.pn-journey-link').length===4);
 const entries=await page.locator('.pn-journey-link').evaluateAll(links=>links.map(a=>({text:a.textContent,url:a.href,target:a.target})));
 assert.equal(entries.filter(a=>new URL(a.url).searchParams.get('origin_type')==='repd').length,1);assert.equal(entries.filter(a=>new URL(a.url).searchParams.get('origin_type')==='substation').length,1);assert.equal(entries.filter(a=>new URL(a.url).searchParams.get('origin_type')==='datacentre').length,1);
 if(mobile){const boxes=await page.locator('#tbody .project-actions').evaluate(el=>{const [map,journey]=[el.querySelector('a:not(.pn-journey-link)'),el.querySelector('.pn-journey-link')].map(a=>a.getBoundingClientRect());return{map:{x:map.x,y:map.y,w:map.width,h:map.height},journey:{x:journey.x,y:journey.y,w:journey.width,h:journey.height}}});assert.ok(Math.abs(boxes.map.y-boxes.journey.y)<1&&boxes.map.w>=44&&boxes.journey.w>=62&&boxes.journey.x>=boxes.map.x+boxes.map.w,'adjacent thumb targets');}
 assert.equal(await page.locator('.pn-journey-unavailable').count(),1);assert.equal(await page.locator('#tbody a:not(.pn-journey-link)').getAttribute('href'),maps.repd);
 await page.locator('#tbody .pn-journey-link').focus();assert.equal(await page.locator('#tbody .pn-journey-link').evaluate(a=>a===document.activeElement),true);
 if(!mobile){
   await page.evaluate(()=>{window.originEvents=[];window.addEventListener('pipeline-journey-origin',e=>window.originEvents.push(e.detail))});
   const opened=context.waitForEvent('page');await page.locator('#tbody .pn-journey-link').click();await(await opened).close();
   assert.equal(await page.evaluate(()=>window.originEvents.length),1);
 }
 await page.evaluate(()=>{const row=document.querySelector('#tbody tr');row.replaceWith(row.cloneNode(true))});await page.waitForTimeout(100);assert.equal(await page.locator('#tbody .pn-journey-link').count(),1);assert.deepEqual(errors,[]);
 if(!mobile){
   const opened=context.waitForEvent('page');await page.locator('#tbody .pn-journey-link').click();await(await opened).close();
   assert.equal(await page.evaluate(()=>window.originEvents.length),2,'cloned Journey action must still emit its checked origin');
 }
 assert.ok(entries.every(a=>!new URL(a.url).searchParams.has('news_context_url')),'entry release does not predeclare contextual news');
 const contextBase='https://globalgrid2050.com/uk_renewables_pipeline/202611172355/';
 await page.evaluate(base=>window.pipelineJourneyEntry.setNewsContextUrl(base),contextBase);
 const linked=await page.locator('.pn-journey-link').evaluateAll(as=>as.map(a=>a.href));
 assert.ok(linked.every(h=>new URL(h).searchParams.get('news_context_url')===contextBase),'explicit later opt-in reaches assets and manual Layers entry');
 const rejected=await page.evaluate(()=>{try{window.pipelineJourneyEntry.setNewsContextUrl('https://example.com/');return false}catch{return true}});assert.equal(rejected,true);
 assert.deepEqual(await page.locator('.pn-journey-link').evaluateAll(as=>as.map(a=>a.href)),linked);
 console.log(JSON.stringify({mobile,entries,unavailable:1,sourceHrefUnchanged:true,rerenderSingular:true,pass:true}));await context.close();
}}finally{await browser.close();await new Promise(r=>server.close(r))}
