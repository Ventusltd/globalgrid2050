import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base=process.env.HUD_URL||'http://127.0.0.1:8765/uk_renewables_pipeline/202611201709/';
const out=process.env.HUD_ARTIFACTS||'/tmp/pn-hud';
await mkdir(out,{recursive:true});
const failures=[];
for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch({headless:true});
 try{
 for(const [width,height] of [[320,568],[393,852],[667,375],[768,1024],[1280,480],[1440,900],[1920,1080]]){
  const name=engine+'-'+width;
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.route("https://cdn.jsdelivr.net/npm/chart.js@4.5.1/**", route => route.abort());
   await page.goto(base+'?technology=solar',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>document.querySelector('#v2')?.textContent.replaceAll(',','')==='3604'&&document.querySelectorAll('#tbody tr[id^="repd-"]').length>0,null,{timeout:90000});
   await page.waitForFunction(()=>typeof Chart==='function'&&['g1','g2','g3'].every(id=>Chart.getChart(document.getElementById(id))?.data.datasets[0].data[0]>0),null,{timeout:30000});
   await page.waitForFunction(()=>document.querySelector('#headlineTicker .pn-ticker-title'),null,{timeout:30000});
   const v=await page.evaluate(()=>{
    const box=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}};
    const t=document.querySelector('#headlineTicker .pn-ticker-title'),style=getComputedStyle(t);
    return {main:box('.main'),gauges:box('.hud-gauges'),ticker:box('#headlineTicker'),cards:[...document.querySelectorAll('.hud-gauges>.card')].map(e=>({w:e.clientWidth,h:e.clientHeight})),canvases:['g1','g2','g3'].map(id=>box('#'+id)),values:['v1','v2','v3'].map(id=>document.getElementById(id).textContent),shadow:style.textShadow,color:style.color,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,inner:innerHeight,hidden:!!document.querySelector('.hud-gauges').closest('details:not([open])')};
   });
   assert.equal(v.cards.length,3);assert.equal(v.hidden,false);assert.ok(v.canvases.every(c=>c.w>35&&c.h>40));assert.ok(v.gauges.bottom<=height,'HUD outside initial viewport '+JSON.stringify(v));assert.ok(v.ticker.bottom<=v.gauges.y,'ticker must precede HUD');assert.ok(v.scroll<=v.client+2,'page overflows horizontally');assert.ok(Math.abs(v.main.x-(v.client-v.main.right))<=4,'main not centred');assert.notEqual(v.shadow,'none');assert.equal(v.color,'rgb(255, 48, 56)');
   assert.match(await page.title(), /V9\.57.*202611201709/);
   assert.equal(await page.locator("#gaugeWarning").isVisible(), false);
   assert.deepEqual(errors, []);
   await page.screenshot({path:out+'/'+name+'.png'});
   const rows = await page.locator('#tbody tr[id^="repd-"]').evaluateAll(records => records.map(record => {
     const name = record.querySelector('td.site');
     const capacity = record.querySelector('td.mw');
     return {height:record.getBoundingClientRect().height, beside:capacity.cellIndex===name.cellIndex+1,
       alignment:getComputedStyle(capacity).textAlign, notes:record.querySelector('td.machine-note-cell .machine-note-button')?.getBoundingClientRect().height};
   }));
   assert.equal(rows.length, 50);
   assert.ok(rows.every(row => row.beside && row.alignment === 'center'), 'MW column lost alignment');
   assert.ok(rows.filter(row => row.notes).every(row => row.notes <= 34), 'Expanded news preview inflated a collapsed row');
   const wrap=page.locator('#repdScroll');await wrap.scrollIntoViewIfNeeded();
   const result=await page.evaluate(()=>{const w=document.querySelector('#repdScroll'),cell=w.querySelector('tbody tr[id^="repd-"] td.site');const before=cell.getBoundingClientRect().x;w.scrollLeft=Math.min(350,w.scrollWidth-w.clientWidth);return {before,after:cell.getBoundingClientRect().x,scroll:w.scrollLeft,width:cell.getBoundingClientRect().width,wrap:w.clientWidth}});
   assert.ok(result.scroll>0,'table not horizontally scrollable');assert.ok(Math.abs(result.before-result.after)<3,'project column not frozen');assert.ok(result.width<result.wrap*.85,'project column consumes viewport');
   await page.screenshot({path:out+'/'+name+'-register.png'});
   console.log(JSON.stringify({name,status:'PASS',...v,table:result,pageErrors:errors}));
  }catch(e){failures.push(name+': '+e.message);console.error(name,e.message,errors);await page.screenshot({path:out+'/'+name+'-FAIL.png'}).catch(()=>{});}
  finally{await page.close();}
 }

 if (process.env.HUD_TEST_LOCAL_FAILURE !== '0') {
  const page = await browser.newPage({viewport:{width:393,height:852}});
  try {
   await page.route('**/vendor/chart.umd.min.js', route => route.abort());
   await page.goto(base+'?technology=solar', {waitUntil:'domcontentloaded'});
   await page.waitForFunction(() => document.querySelector('#v2')?.textContent === '3,604');
   assert.equal(await page.locator('#gaugeWarning').isVisible(), true);
   assert.equal(await page.locator('#tbody tr[id^="repd-"]').count(), 50);
  } catch (error) {
   failures.push(engine + ' local chart outage: ' + error.message);
  } finally {
   await page.close();
  }
 }
 }finally{await browser.close();}
}
await import('./repd-summary-regression.mjs');
assert.deepEqual(failures,[]);
