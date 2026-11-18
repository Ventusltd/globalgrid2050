import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const moduleRoot=process.env.PLAYWRIGHT_MODULE_ROOT||'D:/githubfiles/.qa-tools/node';
const {chromium}=createRequire(resolve(moduleRoot,'package.json'))('playwright');
const source=readFileSync(new URL('./navigation.mjs',import.meta.url));
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>a{display:inline-block;min-width:44px;min-height:44px}</style>
<div id="tech"><button aria-pressed="true" data-technology="all">All</button></div>
<div id="status"><button aria-pressed="true" data-official-status="All">All</button></div>
<input id="search" value="2470"><select id="county"><option>All</option></select><select id="sortProjects"><option>capacity_desc</option></select>
<a id="mapAtlasNav" href="/destination">MAP ATLAS</a>
<div class="tablewrap"><table><tbody id="tbody" data-total="7775"><tr><td><a class="atlaslink" target="_blank" rel="noopener" href="/destination?repd_ref=2470">MAP</a></td></tr></tbody></table></div>
<nav id="projectPager" data-page="1" data-pages="1"></nav><script type="module" src="/navigation.mjs"></script>`;
const server=createServer((req,res)=>{const u=new URL(req.url,'http://local');
if(u.pathname==='/navigation.mjs'){res.setHeader('content-type','text/javascript');res.end(source)}
else{res.setHeader('content-type','text/html');res.end(u.pathname==='/destination'?'<h1>Destination</h1>':fixture)}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();const results=[];
try{
for(const mobile of [true,false]){
 const context=await browser.newContext({viewport:{width:mobile?393:1440,height:852},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/source');const a=page.locator('a.atlaslink');
 await page.waitForFunction(()=>document.querySelector('a.atlaslink')?.dataset.mapNavigation);
 assert.equal(await a.getAttribute('target'),mobile?'_self':'_blank');
 assert.equal(await page.locator('#mapAtlasNav').getAttribute('target'),mobile?'_self':null);
 if(mobile){
   await a.tap();await page.waitForURL('**/destination?repd_ref=2470');assert.equal(context.pages().length,1);
   await page.goBack();await page.waitForFunction(()=>document.querySelector('a.atlaslink')?.dataset.mapNavigation==='current-tab');
   assert.equal(new URL(page.url()).searchParams.get('q'),'2470');
   // Search rerenders get the same target before a native keyboard activation.
   await page.evaluate(()=>{const a=document.querySelector('a.atlaslink');a.replaceWith(a.cloneNode(true))});
   await page.locator('a.atlaslink').focus();await page.keyboard.press('Enter');await page.waitForURL('**/destination?repd_ref=2470');
 }else{
   const opened=context.waitForEvent('page');await a.click();const popup=await opened;await popup.waitForLoadState();assert.equal(new URL(popup.url()).searchParams.get('repd_ref'),'2470');assert.equal(new URL(page.url()).pathname,'/source');await popup.close();
 }
 assert.deepEqual(errors,[]);results.push({mobile,pass:true});await context.close();
}
}finally{await browser.close();await new Promise(r=>server.close(r))}
if(process.env.MOBILE_MAP_REPORT)writeFileSync(process.env.MOBILE_MAP_REPORT,JSON.stringify({scope:'sender mechanics on local real HTTP pages; not live receiver acceptance',results},null,2)+'\n');
console.log(JSON.stringify(results));
