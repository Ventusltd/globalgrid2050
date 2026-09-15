// Runs real production modules. Desktop browser viewport emulation, not a physical phone test.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const BASE=process.env.SOLAR_BASE||'http://127.0.0.1:8891/testcode/202609150502/';
const OUT=process.env.PROOF_DIR||'solar-proof';fs.mkdirSync(OUT,{recursive:true});
const report={pass:false,kind:'desktop browser viewport emulation',checks:[],measurements:[],limitations:['No physical phone tested.','No 1 GB device tested.','rAF frame sampling is a desktop measurement, not a phone performance guarantee.']};
const assert=(name,value,detail)=>{report.checks.push({name,pass:!!value,...(detail===undefined?{}:{detail})});if(!value)throw new Error(name);};
const browser=await puppeteer.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox','--enable-gpu','--use-gl=angle',...(process.platform==='win32'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});
try{
report.browser=await browser.version();
for(const [width,height,dpr] of [[1440,900,1],[430,900,2],[900,430,2]]){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewport({width,height,deviceScaleFactor:dpr,isMobile:width<=430,hasTouch:width<=430});
  await page.goto(`${BASE}?repd_ref=14773`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__solar?.ready);
  const before=await page.evaluate(()=>({pos:__solar.positions,state:__solar.state,text:document.body.innerText,n:__solar.core.N,overflow:document.documentElement.scrollWidth-innerWidth,renderer:__solar.renderer}));
  assert(`${width}: ready/all records/null detail`,before.n===3563&&before.text.includes('Missing — no geographic position assigned')&&before.state.key==='14773');
  assert(`${width}: no horizontal overflow`,before.overflow===0);
  await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__solar?.ready);
  assert(`${width}: URL reload reproduces layout`,await page.evaluate(pos=>JSON.stringify(__solar.positions)===JSON.stringify(pos),before.pos));
  await page.click('#table');assert(`${width}: lens switch preserves key/seed`,await page.evaluate(s=>__solar.state.key===s.key&&__solar.state.seed===s.seed&&__solar.state.lens==='table',before.state));
  await page.click('#missing');assert(`${width}: all five nulls selectable`,await page.$$eval('#overlay .project-row',rows=>rows.length===5&&rows.every(r=>r.textContent.includes('coordinates missing'))));
  await page.click('[data-ref="1613"]');assert(`${width}: null selection deep link`,await page.$eval('#detail a',a=>a.href.endsWith('/202609050309/?repd_ref=1613')));
  await page.click('#ring');await page.click('#all');await page.type('#search','10000');await page.click('#matches [data-ref="10000"]');
  assert(`${width}: normal selection deep link`,await page.$eval('#detail a',a=>a.href.endsWith('/202609050309/?repd_ref=10000')));
  await page.evaluate(()=>{document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'));});
  const small=await page.$$eval('button,input,select',els=>els.filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.textContent.slice(0,40),height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})).filter(r=>r.height<44||r.width<44));
  assert(`${width}: touch controls at least 44 CSS pixels`,small.length===0,small);
  const frames=await page.evaluate(async()=>{const a=[];let last=performance.now(),start=last;return await new Promise(resolve=>{const tick=now=>{__solar.render();a.push(now-last);last=now;if(now-start<5000)requestAnimationFrame(tick);else{const s=a.slice(1).sort((x,y)=>x-y);resolve({duration_ms:now-start,samples:s.length,mean_fps:1000/(s.reduce((x,y)=>x+y,0)/s.length),frame_ms_p95:s[Math.floor(s.length*.95)]});}};requestAnimationFrame(tick);});});
  report.measurements.push({viewport:{width,height,dpr},renderer:before.renderer,scenario:'five seconds requesting redraw every animation frame',...frames});
  await page.screenshot({path:path.join(OUT,`solar-${width}x${height}.png`),fullPage:true});
  assert(`${width}: zero console/page errors`,errors.length===0,errors);await page.close();
}
const fallback=await browser.newPage();await fallback.setViewport({width:430,height:900,deviceScaleFactor:2});
const fallbackErrors=[];fallback.on('pageerror',e=>fallbackErrors.push(e.message));fallback.on('console',m=>{if(m.type()==='error')fallbackErrors.push(m.text());});
await fallback.evaluateOnNewDocument(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
await fallback.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
await fallback.goto(`${BASE}?repd_ref=14773`,{waitUntil:'networkidle0'});await fallback.waitForFunction(()=>window.__solar?.ready);
assert('forced no-WebGL2 / reduced-motion fallback',await fallback.evaluate(()=>__solar.renderer==='Canvas2D'&&document.documentElement.scrollWidth===innerWidth&&document.getElementById('detail').innerText.includes('Missing')));
assert('fallback has zero console/page errors',fallbackErrors.length===0,fallbackErrors);
await fallback.screenshot({path:path.join(OUT,'solar-fallback.png'),fullPage:true});await fallback.close();
const bad=await browser.newPage();await bad.goto(`${BASE}?seed=invalid&repd_ref=999999999&lens=invalid`,{waitUntil:'networkidle0'});await bad.waitForFunction(()=>window.__solar?.ready);
assert('malformed seed and unknown key reported',await bad.evaluate(()=>__solar.state.notes.length===3&&__solar.state.focus===-1));await bad.close();
const tamper=await browser.newPage();await tamper.setRequestInterception(true);tamper.on('request',r=>r.url().endsWith('/data/uk-solar.json')?r.respond({status:200,contentType:'application/json',body:'{"projects":[]}'}):r.continue());
await tamper.goto(BASE,{waitUntil:'networkidle0'});await tamper.waitForFunction(()=>window.__solar);
assert('modified data bytes fail closed',await tamper.evaluate(()=>!__solar.ready&&__solar.error.includes('hash mismatch')));await tamper.close();
const absent=await browser.newPage();await absent.setRequestInterception(true);absent.on('request',r=>r.url().endsWith('/data/provenance.json')?r.respond({status:200,contentType:'application/json',body:'{"files":{}}'}):r.continue());
await absent.goto(BASE,{waitUntil:'networkidle0'});await absent.waitForFunction(()=>window.__solar);
assert('missing manifest proof fails closed',await absent.evaluate(()=>!__solar.ready&&__solar.error.includes('snapshot proof')));await absent.close();
report.pass=report.checks.every(c=>c.pass);
}catch(e){report.error=e.stack;}finally{await browser.close();fs.writeFileSync(path.join(OUT,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;}
