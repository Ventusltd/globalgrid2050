import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {SOURCE} from '../model.mjs';
const [dataFolder,artifactFolder,mode]=process.argv.slice(2);assert(dataFolder&&artifactFolder,'Usage: browser.mjs <owner daily product directory> <artifacts> [live]');
const live=mode==='live',{chromium,devices}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const moduleFolder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const indexRaw=await fs.readFile(path.join(dataFolder,'index.json'));assert.equal(indexRaw.length,SOURCE.index.bytes);assert.equal(createHash('sha256').update(indexRaw).digest('hex'),SOURCE.index.sha256);
const sourceIndex=JSON.parse(indexRaw),annual2026=JSON.parse(await fs.readFile(path.join(dataFolder,'2026.json')));
const legacyClockCount=JSON.parse(await fs.readFile(path.join(dataFolder,'2016.json'))).rows.reduce((n,r)=>n+r.utc_alignment_mismatches,0);
const resources=new Map();for(const file of ['model.mjs','view.mjs','canvas.mjs','styles.css'])resources.set('/'+file,[await fs.readFile(path.join(moduleFolder,file)),file.endsWith('.css')?'text/css':'text/javascript']);
const html=Buffer.from(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daily price cartridge acceptance</title><link rel="stylesheet" href="/styles.css"><style>html,body{margin:0;background:#000;color:#fff}main{padding:10px;max-width:1200px;margin:auto;min-width:0}</style><main id="host"></main><script>
window.pathProof=[];{let paths=new WeakMap();for(const name of ['beginPath','moveTo','lineTo','stroke']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(name==='beginPath')paths.set(this,[]);if(name==='moveTo'||name==='lineTo'){const p=paths.get(this)||[];p.push({kind:name,x:args[0],y:args[1]});paths.set(this,p);}if(name==='stroke'&&this.strokeStyle==='#00ffff'&&(paths.get(this)||[]).length)window.pathProof.push((paths.get(this)||[]).map(p=>({...p})));return original.apply(this,args);};}}
</script><script type="module">import{mountDailyPrices}from'/view.mjs';window.canvasModule=await import('/canvas.mjs');window.viewModule={mountDailyPrices};window.controller=mountDailyPrices(document.querySelector('#host'));await window.controller.ready;window.initialReady=true;</script>`);
const server=createServer((req,res)=>{const item=resources.get(req.url)||(req.url==='/'?[html,'text/html']:null);if(!item){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':item[1]});res.end(item[0]);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
await fs.mkdir(artifactFolder,{recursive:true});const browser=await chromium.launch({headless:true}),proofs=[];
try{
 for(const [label,options] of (live?[['live-android',{...devices['Pixel 7'],viewport:{width:390,height:844}}]]:[['android-portrait',{...devices['Pixel 7'],viewport:{width:390,height:844}}],['android-landscape',{...devices['Pixel 7'],viewport:{width:915,height:412}}],['desktop',{viewport:{width:1440,height:900}}]])){
  const context=await browser.newContext(options),page=await context.newPage(),errors=[],requests=[];let corrupt=null,blocked=false,delayed=null,releaseDelay=null;
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.url().startsWith(SOURCE.base))requests.push(r.url().slice(SOURCE.base.length));});
  if(!live)await context.route(SOURCE.base+'**',async route=>{
   const name=route.request().url().slice(SOURCE.base.length);if(blocked){await route.fulfill({status:503,body:'unavailable'});return;}
   assert(/^(index|\d{4})\.json$/.test(name));const raw=await fs.readFile(path.join(dataFolder,name));
   if(delayed===name)await new Promise(resolve=>releaseDelay=resolve);
   await route.fulfill({contentType:'text/plain; charset=utf-8',body:corrupt===name?Buffer.from(raw.toString('utf8').replace('"year":2024','"year":2023')):raw});
  });
  await page.goto(base);await page.waitForFunction(()=>window.initialReady);assert.equal(await page.locator('.pn-daily-prices').getAttribute('data-state'),'available');
  assert.match(await page.locator('.pnd-source').innerText(),/Latest source date: 2026-10-31/);
  assert.equal(await page.getByLabel('Window end date').inputValue(),'2026-10-31');assert.match(await page.locator('.pnd-status').innerText(),/2026-10-02 to 2026-10-31/);
  assert.deepEqual([...new Set(requests)],['index.json','2026.json']);assert.match(await page.locator('.pnd-coverage').innerText(),/30 complete source days/);
  const latest=annual2026.rows.filter(r=>r.date>='2026-10-02');const low=Math.min(...latest.map(r=>r.minimum_observed_gbp_per_mwh));assert(low<0);
  assert((await page.locator('.pnd-stats').innerText()).includes(low.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})));
  assert.equal(await page.evaluate(()=>window.controller===window.viewModule.mountDailyPrices(document.querySelector('#host'))),true);
  if(!live){
   await page.evaluate(()=>window.pathProof=[]);await page.getByLabel('Daily window').selectOption('365');
   await page.waitForFunction(()=>document.querySelector('.pn-daily-prices').dataset.state==='available'&&document.querySelector('.pnd-status').textContent.includes('365 calendar days'));
   assert.match(await page.locator('.pnd-coverage').innerText(),/13 missing/);
   const plotted=await page.evaluate(()=>({paths:window.pathProof,series:JSON.parse(document.querySelector('canvas').dataset.series),width:document.querySelector('canvas').getBoundingClientRect().width}));
   const average=plotted.series.find(s=>s.field==='mean_available_gbp_per_mwh');assert.equal(average.segments.length,2);assert.equal(average.segments.flat().length,352);
   const rendered=plotted.paths.filter(p=>p.length>1);assert(rendered.length>=2);for(const p of rendered)for(let i=1;i<p.length;i++)assert(p[i].x-p[i-1].x<=(plotted.width-71)/365+.01,'Canvas connected a calendar gap');
   await page.getByLabel('Source year').selectOption('2016');await page.waitForFunction(()=>document.querySelector('.pn-daily-prices').dataset.state==='available'&&document.querySelector('.pnd-status').textContent.startsWith('2016-01-01'));
   assert.match(await page.locator('.pnd-coverage').innerText(),/364 complete source days · 2 partial/);assert((await page.locator('.pnd-quality').innerText()).includes('Stored UTC disagreements: '+legacyClockCount.toLocaleString('en-GB')));
   const gapProbe=await page.evaluate(rows=>{
    const c=document.createElement('canvas');c.style.width='330px';c.style.height='390px';document.body.append(c);window.pathProof=[];
    const missing=rows.filter(r=>r.date>='2026-06-18'&&r.date<='2026-06-30');
    const empty=window.canvasModule.drawDaily(c,{start:'2026-06-18',end:'2026-06-30',rows:missing});const emptyPaths=window.pathProof.length;
    const omitted=rows.filter(r=>r.date>='2026-10-01'&&r.date<='2026-10-05'&&r.date!=='2026-10-03');window.pathProof=[];
    const separated=window.canvasModule.drawDaily(c,{start:'2026-10-01',end:'2026-10-05',rows:omitted});const p=window.pathProof;c.remove();return {empty,emptyPaths,separated,paths:p};
   },annual2026.rows);
   assert.equal(gapProbe.emptyPaths,0);assert(gapProbe.empty.every(s=>s.segments.length===0));assert(gapProbe.separated.every(s=>s.segments.length===2));assert.equal(gapProbe.paths.filter(p=>p.length===2).length,2);
   // A caller cannot replace accepted pins or poison rows reused by later windows.
   const expected2017=JSON.parse(await fs.readFile(path.join(dataFolder,'2017.json'))).rows[0].mean_available_gbp_per_mwh;
   const expectedLatest=annual2026.rows.at(-1).mean_available_gbp_per_mwh;
   const immutableProof=await page.evaluate(async()=>{
    const {createStore}=await import('/model.mjs');const store=await createStore();const part=store.index.parts.find(p=>p.year===2017);
    const pinRejected=Reflect.set(part,'sha256','0'.repeat(64))===false&&Reflect.set(store,'index',{})===false;
    const yearWindow=await store.window('2017-01-01','2017-01-02');
    const first=await store.window('2026-10-31','2026-10-31'),record=first.rows[0];
    const rowRejected=Reflect.set(record,'mean_available_gbp_per_mwh',999)===false&&Reflect.set(first.rows,'0',{})===false;
    const again=await store.window('2026-10-31','2026-10-31');
    return {pinRejected,rowRejected,indexFrozen:Object.isFrozen(store.index)&&Object.isFrozen(store.index.parts)&&Object.isFrozen(store.index.sources),
      sourceMean:yearWindow.rows[0].mean_available_gbp_per_mwh,latestMean:again.rows[0].mean_available_gbp_per_mwh};
   });
   assert.equal(immutableProof.pinRejected,true);assert.equal(immutableProof.indexFrozen,true);assert.equal(immutableProof.sourceMean,expected2017);
   assert.equal(immutableProof.rowRejected,true);assert.equal(immutableProof.latestMean,expectedLatest);
   corrupt='2024.json';await page.getByLabel('Source year').selectOption('2024');await page.waitForFunction(()=>document.querySelector('.pn-daily-prices').dataset.state==='unavailable');
   assert.equal(await page.locator('canvas').isVisible(),false);assert.equal(await page.locator('.pnd-stats').isVisible(),false);assert.equal(await page.locator('tbody tr').count(),0);
   corrupt=null;delayed='2024.json';await page.getByLabel('Source year').selectOption('2024');
   for(let n=0;n<100&&!releaseDelay;n++)await page.waitForTimeout(10);assert(releaseDelay,'Older request was not delayed');
   await page.getByLabel('Source year').selectOption('2023');await page.waitForFunction(()=>document.querySelector('.pn-daily-prices').dataset.state==='available'&&document.querySelector('.pnd-status').textContent.startsWith('2023-01-01'));
   delayed=null;releaseDelay();await page.waitForTimeout(100);assert.match(await page.locator('.pnd-status').innerText(),/^2023-01-01/);
   await page.getByLabel('Source year').selectOption('2026');await page.waitForFunction(()=>document.querySelector('.pn-daily-prices').dataset.state==='available');
   await page.getByLabel('Daily window').selectOption('30');await page.waitForFunction(()=>document.querySelector('.pnd-status').textContent.includes('30 calendar days'));
   await page.evaluate(()=>{document.querySelector('canvas').getContext=()=>null;});
   await page.getByLabel('Source year').selectOption('2025');await page.waitForFunction(()=>document.querySelector('.pn-daily-prices').dataset.state==='unavailable');
   assert.equal(await page.locator('canvas').isVisible(),false);assert.equal(await page.locator('.pnd-stats').isVisible(),false);assert.equal(await page.locator('.pnd-stats').innerText(),'');assert.equal(await page.locator('tbody tr').count(),0);
   await page.evaluate(()=>{delete document.querySelector('canvas').getContext;});await page.getByLabel('Source year').selectOption('2026');await page.waitForFunction(()=>document.querySelector('.pn-daily-prices').dataset.state==='available');
   await page.getByLabel('Daily window').selectOption('30');await page.waitForFunction(()=>document.querySelector('.pnd-status').textContent.includes('30 calendar days'));
  }
  if(label==='android-portrait'||live)for(const viewport of [{width:915,height:412},{width:390,height:844}]){await page.setViewportSize(viewport);await page.waitForTimeout(80);assert.equal(await page.locator('.pn-daily-prices').getAttribute('data-state'),'available');const size=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));assert(size.document<=size.width+1,JSON.stringify(size));}
  await page.getByText('Source and daily observations',{exact:true}).click();assert((await page.locator('tbody tr').count())>0);assert.equal(await page.getByRole('link',{name:'Pinned data index',exact:true}).getAttribute('href'),SOURCE.base+'index.json');
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,canvas:document.querySelector('canvas').getBoundingClientRect().width}));assert(dimensions.document<=dimensions.viewport+1);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(artifactFolder,label+'.png'),fullPage:true});proofs.push({label,mode:live?'actual HTTPS without route interception':'exact owner snapshot with controlled transport',sourceCommit:SOURCE.commit,defaultRange:'2026-10-02/2026-10-31',lazyRequests:requests,negativeLow:low,dimensions,errors,gaps:live?'unit + deterministic browser separately':'explicit null/omitted gaps verified in actual canvas paths; no zero/baseline'});
  if(!live){
   assert.equal(await page.evaluate(async()=>{
    const old=window.controller,host=document.querySelector('#host');old.disconnect();
    const replacement=window.viewModule.mountDailyPrices(host);await replacement.ready;old.disconnect();
    const again=window.viewModule.mountDailyPrices(host);window.controller=replacement;
    return replacement===again&&host.querySelectorAll('.pn-daily-prices').length===1;
   }),true);
  }
  await page.evaluate(()=>window.controller.disconnect());assert.equal(await page.locator('.pn-daily-prices').count(),0);
  if(!live){blocked=true;await page.reload();await page.waitForFunction(()=>window.initialReady);assert.equal(await page.locator('.pn-daily-prices').getAttribute('data-state'),'unavailable');assert.equal(await page.locator('canvas').isVisible(),false);assert.equal(await page.locator('.pnd-tools').isVisible(),false);}
  await context.close();
 }
 await fs.writeFile(path.join(artifactFolder,'browser.json'),JSON.stringify(proofs,null,2)+'\n');console.log(JSON.stringify(proofs));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
