/** Real integrated V9.33 browser acceptance against exact source-byte fixtures. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,statSync,existsSync} from 'node:fs';
import {dirname,resolve,relative,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const ACCEPTED_PRIMARY_DONOR='f421513f7cbd85ad45727ef236e053a6c67f92d9';
const ACCEPTED_RENDERER_SHA256='4cc9b278d5638a65fa7d8fc59cd42681666adf49a6089ffd0673f1c37446068c';
assert.match(ACCEPTED_PRIMARY_DONOR,/^[a-f0-9]{40}$/,'Reviewed producer SHA must be pinned');
assert.match(ACCEPTED_RENDERER_SHA256,/^[a-f0-9]{64}$/,'Accepted renderer SHA256 must be pinned');
const EDITION=process.env.V933_CANDIDATE||'uk_renewables_pipeline/202611170512';
const candidate=resolve(ROOT,EDITION),baseline=resolve(ROOT,'uk_renewables_pipeline/202611170324');
const OUT=resolve(process.env.V933_OUT||resolve(tmpdir(),'gg2050-v933-preview'));
const {chromium}=process.env.V933_PLAYWRIGHT
  ? await import(pathToFileURL(resolve(process.env.V933_PLAYWRIGHT))) : await import('playwright');
const {catalogue}=await import(pathToFileURL(resolve(candidate,'scripts/layers/catalogue.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(OUT,{recursive:true});
const receipt={status:'RUNNING',scope:'full integrated host',utc:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),edition:EDITION,index_sha256:sha(readFileSync(resolve(candidate,'index.html'))),checks:[],sources:[],blocked_external:[],limitations:[
  'Local integrated browser proof; no deployment, public served-byte or native-phone acceptance.',
  'Pinned GridAtlas source bytes are replayed exactly; no claim of fresh network-state data or typed substation arrival.',
  'External feeds, Chart.js CDN and original V6 workspace navigation are blocked; saved news and the independently linked workspace are tested.',
  'Prices are historical Elexon system-sell observations grouped by source-declared settlement date; complete source-day coverage does not certify stored UTC alignment.',
  'Android UA, touch gestures and screen orientation are Chromium emulation on this host, not a native Android handset/browser process.',
  'All-row MAP construction is checked separately; this browser suite does not execute the public GridAtlas receiver.']};
const sourceBytes=new Map();
const locationSpec=JSON.parse(readFileSync(resolve(candidate,'contracts/dc-locations.v930.json')));
let locationBytes;
if(process.env.V933_DATA_SOURCE)locationBytes=readFileSync(resolve(process.env.V933_DATA_SOURCE));
else{const response=await fetch(locationSpec.input.url,{redirect:'error',signal:AbortSignal.timeout(15000)});assert.ok(response.ok);locationBytes=Buffer.from(await response.arrayBuffer());}
assert.equal(locationBytes.length,183561);assert.equal(sha(locationBytes),'6f68e078d9b57057acdda679288730e638553f68df884dfd747c5049e56ea88e');
const locationData=JSON.parse(locationBytes),byId=new Map(locationData.features.map(f=>[f.id,f]));
sourceBytes.set(locationSpec.input.url,locationBytes);
receipt.sources.push({id:'dc-address-locations',url:locationSpec.input.url,sha256:sha(locationBytes),bytes:locationBytes.length,transport:process.env.V933_DATA_SOURCE?'explicit data-owner fixture, exact immutable bytes':'immutable HTTPS source'});
let baselineDCLinks,baselineDCCsv,baselineHeadlineHas,baselineNoteButtons={},baselineHeadlineLinks=[],baselineLinksByRef={};
const primarySpec=JSON.parse(readFileSync(resolve(candidate,'contracts/primary-notes.v932.json')));
assert.equal(primarySpec.producer.commit,ACCEPTED_PRIMARY_DONOR);assert.equal(primarySpec.renderer.sha256,ACCEPTED_RENDERER_SHA256);
receipt.primaryContract={producer:primarySpec.producer.commit,manifest_sha256:sha(readFileSync(resolve(candidate,'contracts/primary-notes.v932.json'))),renderer_sha256:primarySpec.renderer.sha256,renderer_bytes:primarySpec.renderer.bytes};
const primaryCache=resolve(ROOT,'automation/primary_note_ui',primarySpec.producer.commit),primaryData=JSON.parse(readFileSync(resolve(primaryCache,'notes.json'))),primaryNote=primaryData.notes.find(n=>n.binding.repd_ref==='12588');
const primaryByRef=new Map(primaryData.notes.map(n=>[n.binding.repd_ref,n]));assert.deepEqual([...primaryByRef.keys()].sort(),['12588','14806','15000','15149']);
const canonicalManifest=JSON.parse(readFileSync(resolve(candidate,'data/v9.1/build_manifest.json'))),canonicalRows=canonicalManifest.project_partitions.flatMap(p=>JSON.parse(readFileSync(resolve(candidate,p.path))).projects),canonicalRefs=canonicalRows.map(r=>r.repd_ref);
receipt.sources.push({id:'curated-primary-government-decision',producer:primarySpec.producer.commit,pdf_sha256:primaryNote.source.sha256,pdf_bytes:primaryNote.source.bytes,decision_date:primaryNote.claim.decision_date,retrieved_at:primaryNote.source.retrieved_at,transport:'exact local reviewed cartridge; no fresh PDF/terms request'});
const priceSpec=JSON.parse(readFileSync(resolve(candidate,'contracts/prices.v931.json')));
const priceModel=await import(pathToFileURL(resolve(ROOT,'automation/price_daily_ui',priceSpec.producer.commit,'model.mjs')));
async function priceBytes(name,pin){
  let raw;if(process.env.V933_PRICE_SOURCE)raw=readFileSync(resolve(process.env.V933_PRICE_SOURCE,name));
  else{const response=await fetch(priceSpec.input.base+name,{redirect:'error',signal:AbortSignal.timeout(15000)});assert.ok(response.ok);raw=Buffer.from(await response.arrayBuffer());}
  assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);sourceBytes.set(priceSpec.input.base+name,raw);return raw;
}
const priceIndex=priceModel.validateIndex(JSON.parse(await priceBytes('index.json',priceSpec.input.index))),priceYears=new Map();
await Promise.all(priceIndex.parts.map(async part=>priceYears.set(part.year,{...JSON.parse(await priceBytes(part.path,part))})));
receipt.sources.push({id:'historical-daily-system-sell',repository:priceSpec.input.repository,commit:priceSpec.input.commit,index_sha256:priceSpec.input.index.sha256,index_bytes:priceSpec.input.index.bytes,annual_parts:priceIndex.parts.length,transport:process.env.V933_PRICE_SOURCE?'explicit existing owner bytes, every pin checked then replayed':'immutable HTTPS owner bytes, every pin checked then replayed'});
for(const layer of catalogue.layers.filter(l=>l.data)){
  let raw,transport;
  try{const response=await fetch(layer.data.url,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw Error('HTTP '+response.status);raw=Buffer.from(await response.arrayBuffer());transport='immutable HTTPS URL';}
  catch{
    if(!process.env.GRIDATLAS_SOURCE)throw Error('Pinned source transport failed; set GRIDATLAS_SOURCE to an existing owner checkout for exact-byte replay.');
    const rel=new URL(layer.data.url).pathname.split('/').slice(4).join('/');
    raw=readFileSync(resolve(process.env.GRIDATLAS_SOURCE,rel));transport='existing owner checkout, exact pinned bytes';
  }
  assert.equal(sha(raw),layer.data.sha256,layer.id+' actual source SHA256');assert.ok(raw.length<=layer.data.maxBytes);
  const doc=JSON.parse(raw);assert.equal(doc.features.length,layer.data.rows);
  sourceBytes.set(layer.data.url,raw);receipt.sources.push({id:layer.id,url:layer.data.url,sha256:sha(raw),bytes:raw.length,rows:doc.features.length,transport});
}
const subs=JSON.parse(sourceBytes.get(catalogue.layers.find(l=>l.id==='substations').data.url));
const named=subs.features.filter(f=>typeof f.properties?.name==='string'&&f.properties.name.trim()).length;
assert.equal(named,4460);assert.equal(subs.features.length-named,1340);
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer((req,res)=>{try{let p=resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!p.startsWith(ROOT+sep)){res.writeHead(403).end();return;}if(statSync(p).isDirectory())p=resolve(p,'index.html');res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const urlFor=dir=>origin+'/'+relative(ROOT,dir).replaceAll('\\','/')+'/';
const pass=(name,details={})=>{receipt.checks.push({name,status:'PASS',...details});console.log('PASS:',name);};
function csv(text){const records=[];let row=[],cell='',quoted=false;text=text.replace(/^\ufeff/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);records.push(row);row=[];cell='';}else cell+=c;}assert.equal(quoted,false);if(cell||row.length){row.push(cell);records.push(row);}return records;}
async function download(page,button,name){const event=page.waitForEvent('download');await button.click();const d=await event,p=resolve(OUT,name);await d.saveAs(p);const raw=readFileSync(p);return{rows:csv(raw.toString('utf8')),sha256:sha(raw)};}
async function open(browser,width,folder,{corrupt=false,reducedMotion=false,mobile=false,height=1000}={}){
  const context=await browser.newContext({viewport:{width,height},acceptDownloads:true,reducedMotion:reducedMotion?'reduce':'no-preference',
    ...(mobile?{isMobile:true,hasTouch:true,deviceScaleFactor:2.625,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/159.0.0.0 Mobile Safari/537.36'}:{})}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const u=route.request().url();requests.push(u);
    if(u.startsWith(origin+'/')){
      const pathname=new URL(u).pathname;
      const manifest=(corrupt==='dc-manifest'&&pathname.endsWith('/contracts/dc-locations.v930.json'))||(corrupt==='price-manifest'&&pathname.endsWith('/contracts/prices.v931.json'));
      const module=(corrupt==='dc-module'&&pathname.endsWith('/automation/dc_location_ui/'+locationSpec.producer.commit+'/actions.mjs'))||(corrupt==='price-module'&&pathname.endsWith('/automation/price_daily_ui/'+priceSpec.producer.commit+'/view.mjs'));
      const primaryManifest=corrupt==='primary-manifest'&&pathname.endsWith('/contracts/primary-notes.v932.json');
      const primaryPaths={'primary-model':'model.mjs','primary-catalogue':'catalogue.mjs','primary-json':'notes.json','primary-mime':'notes.json'};
      const primaryFile=primaryPaths[corrupt]&&pathname.endsWith('/automation/primary_note_ui/'+primarySpec.producer.commit+'/'+primaryPaths[corrupt]);
      const primaryRenderer=corrupt==='primary-renderer'&&pathname.endsWith('/'+primarySpec.renderer.path);
      if(primaryManifest||primaryFile||primaryRenderer){const raw=readFileSync(resolve(ROOT,'.'+pathname)),json=pathname.endsWith('.json');return route.fulfill({status:200,contentType:corrupt==='primary-mime'?'text/plain':json?'application/json':'text/javascript',body:corrupt==='primary-mime'?raw:Buffer.concat([raw,Buffer.from(' ')])});}
      if(manifest||module){const raw=readFileSync(resolve(ROOT,'.'+pathname));return route.fulfill({status:200,contentType:module?'text/javascript':'application/json',body:Buffer.concat([raw,Buffer.from(' ')])});}
      return route.continue();
    }
    if(sourceBytes.has(u)){let raw=sourceBytes.get(u);if((corrupt===true&&u===catalogue.layers.find(l=>l.id==='substations').data.url)||(corrupt==='dc-source'&&u===locationSpec.input.url)||(corrupt==='price-index'&&u===priceSpec.input.base+'index.json')||(corrupt==='price-year'&&u===priceSpec.input.base+'2026.json'))raw=Buffer.concat([raw,Buffer.from(' ')]);return route.fulfill({status:200,contentType:'application/json',body:raw});}receipt.blocked_external.push(u);return route.abort();});
  await context.addInitScript(()=>{
    window.__pricePaths=[];window.__priceLabels=[];window.__priceHollow=0;const paths=new WeakMap(),arcs=new WeakMap();
    for(const name of ['beginPath','moveTo','lineTo','stroke','fillText','arc','fill']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){
      if(this.canvas.closest('.pn-daily-prices')){
        if(name==='beginPath'){paths.set(this,[]);arcs.delete(this);}
        if(name==='moveTo'||name==='lineTo'){const p=paths.get(this)||[];p.push({kind:name,x:args[0],y:args[1]});paths.set(this,p);}
        if(name==='stroke'&&['#00ffff','#ffcc00','#ff3333'].includes(this.strokeStyle)&&(paths.get(this)||[]).length)window.__pricePaths.push({color:this.strokeStyle,points:paths.get(this).map(p=>({...p}))});
        if(name==='fillText')window.__priceLabels.push(String(args[0]));
        if(name==='arc')arcs.set(this,args[2]);
        if(name==='fill'&&arcs.get(this)===3&&this.fillStyle==='#05070c')window.__priceHollow++;
      }return original.apply(this,args);
    };}
  });
  if(corrupt==='primary-evaluation')await context.addInitScript(()=>{const OriginalDate=Date;window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:['2026-11-17T03:16:19.999Z']));}static now(){return new OriginalDate('2026-11-17T03:16:19.999Z').getTime();}};});
  await page.goto(urlFor(folder),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Number(document.getElementById('tbody')?.dataset.total)>0);
  return{context,page,errors,requests};
}
async function fullWidth(page){
  const layout=await page.evaluate(()=>{const main=document.querySelector('main'),r=main.getBoundingClientRect(),s=getComputedStyle(main),b=getComputedStyle(document.body),h=getComputedStyle(document.documentElement);return{viewport:innerWidth,mainLeft:r.left,mainWidth:r.width,mainMarginLeft:s.marginLeft,documentWidth:document.documentElement.scrollWidth,mainOverflowY:s.overflowY,bodyDisplay:b.display,bodyOverflowY:b.overflowY,htmlOverflowY:h.overflowY,bodyHeight:b.height,mainHeight:s.height,asideCount:document.querySelectorAll('aside,.sidebar').length};});
  assert.equal(layout.asideCount,0,'removed sidebar has no visible or hidden DOM remnant');assert.ok(Math.abs(layout.mainLeft)<=1,'main begins at viewport left: '+JSON.stringify(layout));assert.ok(Math.abs(layout.mainWidth-layout.viewport)<=2,'main uses full viewport width: '+JSON.stringify(layout));assert.ok(layout.documentWidth<=layout.viewport+2,'document has no lateral overflow: '+JSON.stringify(layout));assert.equal(layout.mainMarginLeft,'0px');assert.equal(layout.bodyDisplay,'block');assert.notEqual(layout.bodyOverflowY,'hidden');assert.notEqual(layout.mainOverflowY,'hidden');
  return layout;
}
async function painted(page,selector){
  const target=page.locator(selector).first();await target.scrollIntoViewIfNeeded();
  const paint=await target.evaluate(n=>{
    const r=n.getBoundingClientRect(),s=getComputedStyle(n);
    let left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
    // A wide table row may begin offscreen after native horizontal scrolling.
    // Test the visible intersection, including the scroll container's borders.
    for(let a=n.parentElement;a;a=a.parentElement){
      if(a===document.documentElement)continue; // Root scrolling clips to the viewport above.
      const style=getComputedStyle(a),box=a.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,box.left+a.clientLeft);right=Math.min(right,box.left+a.clientLeft+a.clientWidth);}
      if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,box.top+a.clientTop);bottom=Math.min(bottom,box.top+a.clientTop+a.clientHeight);}
    }
    const x=(left+right)/2,y=(top+bottom)/2,hit=right>left&&bottom>top?document.elementFromPoint(x,y):null;
    return{width:r.width,height:r.height,top:r.top,left:r.left,visible:{left,right,top,bottom},hitPoint:{x,y},display:s.display,visibility:s.visibility,opacity:s.opacity,text:n.textContent.trim().slice(0,120),hit:!!hit&&(n===hit||n.contains(hit)),viewport:{width:innerWidth,height:innerHeight}};
  });
  assert.ok(paint.width>0&&paint.height>0&&paint.display!=='none'&&paint.visibility==='visible'&&Number(paint.opacity)>0&&paint.text.length>0&&paint.hit,'visible painted target '+selector+': '+JSON.stringify(paint));return paint;
}
async function settleTouch(page){await page.evaluate(async()=>{let previous='',stable=0;const end=performance.now()+2500;while(performance.now()<end){await new Promise(requestAnimationFrame);const state=[scrollY,visualViewport.pageTop,...[...document.querySelectorAll('.tablewrap')].map(n=>n.scrollLeft)].join('|');if(state===previous)stable++;else stable=0;previous=state;if(stable>=8)return;}});}
async function touchTap(page,selector){await settleTouch(page);await page.locator(selector).first().tap();}
async function touchDrag(session,{x,y,dx=0,dy=0}){
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:2,radiusY:2,force:1}]});
  for(let step=1;step<=10;step++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/10,y:y+dy*step/10,id:1,radiusX:2,radiusY:2,force:1}]});await new Promise(r=>setTimeout(r,16));}
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
async function nativeLandscapeNotePan(browser){
  const test=await open(browser,915,candidate,{mobile:true,height:412});await test.page.waitForFunction(()=>document.documentElement.dataset.primaryNotesState==='available');await allRepd(test.page);await test.page.locator('#search').fill('15149');await test.page.waitForFunction(()=>!!document.getElementById('repd-15149'));
  const wrapper=test.page.locator('.tablewrap:has(#tbody)'),button=test.page.locator('#repd-15149 .machine-note-cell .machine-note-button');await wrapper.scrollIntoViewIfNeeded();const session=await test.context.newCDPSession(test.page),pans=[];
  assert.equal(await wrapper.evaluate(n=>n.scrollLeft),0,'fresh table begins unpanned');assert.ok(await wrapper.evaluate(n=>n.scrollWidth>n.clientWidth),'real table overflows at915px');
  const visible=()=>button.evaluate(n=>{const r=n.getBoundingClientRect(),p=n.closest('.tablewrap').getBoundingClientRect();return r.left>=Math.max(0,p.left)&&r.right<=Math.min(innerWidth,p.right)&&r.top>=0&&r.bottom<=innerHeight;});
  for(let count=0;count<5;count++){
    if(count>0&&await visible())break;
    const rect=await wrapper.evaluate(n=>{const r=n.getBoundingClientRect();return{left:r.left,top:r.top,width:r.width,height:r.height,before:n.scrollLeft};});const x=Math.min(875,rect.left+rect.width*.85),y=Math.max(50,Math.min(360,rect.top+rect.height*.55));
    await touchDrag(session,{x,y,dx:-Math.min(500,rect.width*.6)});await settleTouch(test.page);const after=await wrapper.evaluate(n=>n.scrollLeft);pans.push({...rect,after});assert.ok(after>rect.before+2,'trusted touch drag pans the actual table');
  }
  assert.equal(await visible(),true,'desktop note button is physically visible after native panning');
  let taps=0;for(;taps<2;taps++){await settleTouch(test.page);await button.tap();try{await test.page.waitForSelector('.machine-note-dialog[open]',{timeout:1000});break;}catch(error){if(taps===1)throw error;}}
  const dialog=test.page.locator('.machine-note-dialog[open]');assert.equal(await dialog.locator('.machine-note-primary').count(),1);assert.ok((await dialog.innerText()).includes('15149'));await test.page.locator('.machine-note-close').tap();await test.page.waitForSelector('.machine-note-dialog[open]',{state:'detached'});
  await settleTouch(test.page);assert.equal(await visible(),true);await button.tap();await test.page.waitForSelector('.machine-note-dialog[open]');assert.equal(await test.page.locator('.machine-note-primary').count(),1);
  const screenshot=await orientationScreenshot(session,'v933-native915-primary-pan-reopen.png',{width:915,height:412});await test.page.keyboard.press('Escape');assert.deepEqual(test.errors,[]);await test.context.close();pass('Android-UA/touch-emulated915 table pans to visible primary button; native tap/close/reopen works without JS scroll or mouse fallback',{pans,openTaps:taps+1,screenshot,actualHandset:false});
}
async function orientationScreenshot(session,name,size){
  // Playwright's screenshot helper restores its cached context viewport. Capture
  // directly through CDP so synthetic landscape metrics remain unchanged.
  const result=await session.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
  const png=Buffer.from(result.data,'base64'),width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  assert.ok(Math.abs(width/height-size.width/size.height)<.005,'PNG must match actual requested orientation: '+JSON.stringify({name,width,height,requested:size}));
  writeFileSync(resolve(OUT,name),png);return{file:name,width,height,sha256:sha(png)};
}
async function tab(page,id){await page.locator('#'+id).click();await page.waitForFunction(id=>document.getElementById(id)?.getAttribute('aria-selected')==='true',id);const panel=await page.locator('#'+id).getAttribute('aria-controls');assert.equal(await page.locator('#'+panel).isVisible(),true);}
async function allRepd(page){await tab(page,'solarTab');await page.locator('#clearFilters').click();await page.waitForFunction(()=>document.getElementById('tbody')?.dataset.total==='7775');}
async function headlineHas(page){return page.evaluate(refs=>Object.fromEntries(refs.map(ref=>[ref,window.pipelineMachineNotes.has(ref)])),canonicalRefs);}
async function noteButton(page,ref){
  await page.locator('#search').fill(ref);await page.waitForFunction(ref=>!!document.getElementById('repd-'+ref),ref);
  const selector='#repd-'+ref+' .machine-note-button:visible',button=page.locator(selector).first();await painted(page,selector);return button;
}
async function existingBriefLinks(page){return page.locator('.machine-note-dialog .machine-note-source:not(.machine-note-primary) a').evaluateAll(nodes=>nodes.map(n=>({href:n.href,text:n.textContent})));}
async function verifyPrimary(page,width,requests){
  await page.waitForFunction(()=>document.documentElement.dataset.primaryNotesState==='available');assert.deepEqual(await headlineHas(page),baselineHeadlineHas,'primary source does not alter any of7775 legacy headline.has booleans');
  const requestsBefore=requests.filter(u=>u.includes('/data/v9.1/projects/')).length;
  await allRepd(page);const button=await noteButton(page,'12588'),map=await page.locator('#repd-12588 .atlaslink').getAttribute('href');assert.match(await button.innerText(),/PROVISIONAL.*GOVERNMENT DECISION.*10 NOV 2026/s);
  assert.deepEqual(await page.locator('[data-note-primary]').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.noteRef))]),['12588']);await button.click();
  const dialog=page.locator('.machine-note-dialog[open]');assert.equal(await dialog.count(),1);assert.equal(await dialog.locator('.machine-note-primary').count(),1);assert.equal(await page.locator('main > section').count(),2);
  const text=await dialog.innerText();assert.match(text,/PRIMARY GOVERNMENT SOURCE - PROVISIONAL PROJECT ASSOCIATION/);assert.match(text,/OFFICIAL SOURCE STATUS \(FROZEN REPD\).*Application Submitted/);assert.match(text,/Primary government decision/);assert.match(text,/10 Nov 2026/);assert.match(text,/11 November|2026-11-11/);
  const primary=dialog.locator('.machine-note-primary');assert.equal(await primary.getByRole('link',{name:'Open the government decision letter',exact:true}).getAttribute('href'),primaryNote.source.url);assert.deepEqual(await dialog.locator('.machine-note-source:not(.machine-note-primary) a').evaluateAll(nodes=>nodes.map(n=>({href:n.href,text:n.textContent}))),baselineHeadlineLinks);
  const details=primary.locator('details');assert.equal(await details.getAttribute('open'),null);await details.locator('summary').click();const qualified=await primary.innerText();
  for(const expected of ['Application Submitted','14 Nov 2024','15 Nov 2024','840 MW','final reduced capacity is not established','judicial review status remain unknown',primaryNote.source.retrieved_at,primaryNote.source.sha256,'1,247,918 bytes',primaryNote.rights.attribution,'government-authored decision facts','third-party','No official endorsement'])assert.ok(qualified.includes(expected),expected+' retained in primary qualifications');
  assert.equal(await primary.getByRole('link',{name:'Open Government Licence v3.0',exact:true}).getAttribute('href'),primaryNote.rights.licence_url);assert.doesNotMatch(await primary.innerText(),/VERIFIED association|final (?:reduced )?capacity (?:is|of) 840/i);
  await page.screenshot({path:resolve(OUT,`v933-primary-brief-${width}.png`)});await page.keyboard.press('Escape');assert.equal(await page.locator('.machine-note-dialog[open]').count(),0);assert.equal(await button.evaluate(n=>n===document.activeElement),true,'native dialog restores opener focus');assert.equal(await page.locator('#repd-12588 .atlaslink').getAttribute('href'),map);
  for(const ref of ['10529','18174']){const other=await noteButton(page,ref);assert.equal(await other.getAttribute('data-note-primary'),null);assert.equal(await other.innerText(),baselineNoteButtons[ref]);}
  await allRepd(page);await page.locator('.pager-btn[data-page-step="1"]').click();await page.waitForFunction(()=>document.querySelector('.pager-meta')?.textContent.includes('21'));assert.equal(await page.locator('#tbody').getAttribute('data-total'),'7775');
  const again=await noteButton(page,'12588');assert.equal(await again.getAttribute('data-note-primary'),'provisional');assert.equal(requests.filter(u=>u.includes('/data/v9.1/projects/')).length,requestsBefore,'opening/filtering primary notes does not refetch canonical partitions');
  await allRepd(page);pass('unique12588 provisional primary brief preserves7775 headline.has states, original headline links, frozen status, dates/rights/nulls, MAP, keyboard focus and rerenders',{width});
}
async function dcOriginalLinks(page){return page.locator('#datacentreHost tbody tr').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.querySelector('.ggdc-id')?.textContent.trim(),[...row.querySelectorAll('a')].filter(a=>!a.closest('.ggdc-location-actions')).map(a=>a.href)])));}
async function dcGlobal(page){await page.locator('#datacentreHost').getByRole('button',{name:/^Global leads/}).click();await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost tbody tr').length===100);}
async function verifyLocations(page,width){
  await page.waitForFunction(()=>document.getElementById('datacentreHost')?.dataset.locationsState==='available');
  assert.equal(await page.locator('#datacentreHost .ggdc-screen-actions').count(),34);
  await dcGlobal(page);await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost .ggdc-reported-address').length===38);
  assert.equal(await page.locator('#datacentreHost .ggdc-reported-address > p').count(),39);
  const actual=await page.locator('#datacentreHost tbody tr').evaluateAll(rows=>rows.map(row=>({id:row.querySelector('.ggdc-id')?.textContent.trim(),addresses:[...row.querySelectorAll('.ggdc-reported-address > p')].map(n=>n.textContent),screen:!!row.querySelector('.ggdc-screen-actions')})));
  for(const row of actual){const feature=byId.get(row.id);assert.ok(feature,'exact original ID');assert.deepEqual(row.addresses,feature.properties.addresses.map(a=>a.text));assert.equal(row.screen,!!feature.geometry&&feature.properties.country.code==='GB');}
  assert.equal(actual.filter(x=>x.screen).length,34);assert.deepEqual(await dcOriginalLinks(page),baselineDCLinks);
  assert.equal(await page.locator('#datacentreHost .ggdc-screen-location').allTextContents().then(x=>x.filter(v=>v.startsWith('Approx. postcode:')).length),25);
  assert.equal(await page.locator('#datacentreHost .ggdc-screen-footnote').count(),1);assert.match(await page.locator('#datacentreHost .ggdc-screen-footnote').innerText(),/UK screening coverage.*not a grid-capacity assessment/);
  const disclosure=page.locator('#datacentreHost .ggdc-location-sources');assert.equal(await disclosure.count(),1);assert.equal(await disclosure.getAttribute('open'),null);
  await disclosure.locator('summary').click();const text=await disclosure.innerText();for(const credit of [...new Set(locationData.features.flatMap(f=>f.properties.location_precision==='POSTCODE_CENTROID_APPROXIMATE'?f.properties.geometry_attribution:[]))])assert.ok(text.includes(credit));
  assert.equal(await disclosure.getByRole('link',{name:'Source GeoJSON (100 records)'}).getAttribute('href'),locationSpec.input.url);
  assert.equal(await disclosure.getByRole('link',{name:'Postcode-provider terms'}).getAttribute('href'),'https://postcodes.io/docs/licences/');await disclosure.locator('summary').click();
  const exported=await download(page,page.locator('#datacentreHost button.ggdc-download'),`v933-dc-global-${width}.csv`);assert.deepEqual(exported.rows,baselineDCCsv.rows,'optional locations never rewrite original100-record CSV');
  const search=page.getByRole('searchbox',{name:'Search Data Centre records'});
  for(const feature of [locationData.features.find(f=>f.properties.country.code!=='GB'&&f.properties.addresses.length),locationData.features.find(f=>!f.geometry&&f.properties.addresses.length)]){
    assert.ok(feature,'real foreign/null-geometry address fixture exists');await search.fill(feature.id);await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost tbody tr').length===1);
    assert.deepEqual(await page.locator('#datacentreHost .ggdc-reported-address > p').allTextContents(),feature.properties.addresses.map(a=>a.text));assert.equal(await page.locator('#datacentreHost .ggdc-screen-actions').count(),0);
  }
  await search.fill('CyrusOne LON1');await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost .ggdc-screen-actions').length===1);assert.match(await page.locator('#datacentreHost .ggdc-screen-location').innerText(),/Approx\. postcode/);
  await tab(page,'solarTab');await tab(page,'datacentreTab');assert.equal(await search.inputValue(),'CyrusOne LON1');assert.equal(await page.locator('#datacentreHost .ggdc-location-sources').count(),1);assert.equal(await page.locator('#datacentreHost .ggdc-screen-footnote').count(),1);
  await search.fill('');await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost .ggdc-reported-address').length===38);
  await painted(page,'#datacentreHost tbody tr');await page.screenshot({path:resolve(OUT,`v933-dc-global-${width}.png`)});
  pass('actual host100ID join/38addressrecords/39statements/34GBScreen/source links and originalCSV preserved across filters',{width});
}
async function verifyAddedConsents(page,width,requests){
  for(const [ref,sibling,applicant,dates] of [
    ['15149','15150','Elements Green Trent Limited',['27 Oct 2026','27 Jun 2025','22 Jul 2025']],
    ['14806','14807','One Earth Solar Farm Limited',['8 Jul 2026','27 Feb 2025','27 Mar 2025']],
    ['15000','15001','RWE Renewables UK Solar and Storage Limited',['2 Jul 2026','21 Feb 2025','21 Mar 2025']]
  ]){
    const note=primaryByRef.get(ref),project=canonicalRows.find(p=>p.repd_ref===ref),button=await noteButton(page,ref),map=await page.locator('#repd-'+ref+' .atlaslink').getAttribute('href');
    assert.equal(await button.getAttribute('data-note-primary'),'provisional');assert.match(await button.innerText(),/PROVISIONAL.*GOVERNMENT/s);await button.click();
    const dialog=page.locator('.machine-note-dialog[open]'),primary=dialog.locator('.machine-note-primary');assert.equal(await dialog.count(),1);assert.equal(await primary.count(),1);assert.match(await dialog.innerText(),/PROVISIONAL PROJECT ASSOCIATION/);assert.ok((await dialog.innerText()).includes('OFFICIAL SOURCE STATUS (FROZEN REPD)')&&(await dialog.innerText()).includes(project.status));
    const sourceLink=primary.locator('a').first();assert.equal(await sourceLink.getAttribute('href'),note.source.url);
    assert.deepEqual(await existingBriefLinks(page),baselineLinksByRef[ref],'existing headline attribution/links stay separate and unchanged');
    if(ref==='15000'){assert.match(await sourceLink.innerText(),/page|announcement|publication|HTML/i);assert.doesNotMatch(await sourceLink.innerText(),/letter|PDF/i);assert.doesNotMatch(await primary.innerText(),/with modifications/i);}
    else assert.match(await sourceLink.innerText(),/letter|PDF/i);
    const details=primary.locator('details');assert.equal(await details.getAttribute('open'),null);await details.locator('summary').click();const text=await primary.innerText();
    for(const expected of [...dates,project.operator,applicant,sibling,note.source.retrieved_at,note.source.sha256,note.rights.attribution])assert.ok(text.includes(expected),ref+': '+expected+' retained');
    const publication=primary.locator('p').filter({hasText:'Government page published:'});assert.equal(await publication.count(),1);const publicationText=await publication.innerText();
    (receipt.publicationPrecisionChecks??=[]).push({repd_ref:ref,source_precision:note.news_metadata.publication_precision,source_published_at:note.news_metadata.published_at,rendered:publicationText});
    if(note.news_metadata.publication_precision==='DAY'){
      const label=new Date(note.news_metadata.published_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});assert.ok(publicationText.includes(label));assert.match(publicationText,/day precision/i);assert.doesNotMatch(publicationText,/T00:00:00(?:\.0+)?(?:Z|\+00:00)/,'day-only publication must not become a fabricated midnight instant');
    }else{assert.ok(publicationText.includes(note.news_metadata.published_at)||publicationText.includes(note.news_metadata.published_at_original),ref+': recorded source timestamp retained; actual: '+publicationText);assert.match(publicationText,/recorded publication metadata/i);}
    assert.match(text,/unknown|not established/i);assert.doesNotMatch(text,/battery[^.]{0,60}\b0\s*MW/i);assert.doesNotMatch(text,/VERIFIED association|current installed capacity (?:is|of) (?:800|740|320)/i);
    if(ref==='15149')assert.doesNotMatch(text,/submission dates (?:differ|conflict)|submission discrepancy exists/i);
    assert.equal(await primary.getByRole('link',{name:'Open Government Licence v3.0',exact:true}).getAttribute('href'),note.rights.licence_url);
    const geometry=await dialog.evaluate(n=>({client:n.clientWidth,scroll:n.scrollWidth}));assert.ok(geometry.scroll<=geometry.client+1,'no horizontal dialog overflow');
    await page.screenshot({path:resolve(OUT,`v933-primary-${ref}-${width}.png`)});await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await button.evaluate(n=>document.activeElement===n),true);assert.equal(await page.locator('#repd-'+ref+' .atlaslink').getAttribute('href'),map);
  }
  const government=raw=>{const host=new URL(raw).hostname;return host==='www.gov.uk'||host.endsWith('.planninginspectorate.gov.uk')||host==='www.nationalarchives.gov.uk';};assert.equal(requests.filter(government).length,0,'note display must not fetch government source bodies or rights pages');
  await allRepd(page);assert.deepEqual(await headlineHas(page),baselineHeadlineHas);assert.equal(await page.locator('main > section').count(),2);
  pass('three added government consents preserve case dates/applicants/operators, separate BESS identities, HTML/PDF labels, rights scope and original MAP',{width,associations:4,verified:0,governmentBodyFetches:0});
}
async function resetPriceTrace(page){await page.evaluate(()=>{window.__pricePaths=[];window.__priceLabels=[];window.__priceHollow=0;});}
async function priceRange(page,end,days='30'){
  await resetPriceTrace(page);await page.getByLabel('Daily window',{exact:true}).selectOption(days);
  await page.getByLabel('Window end date',{exact:true}).fill(end);await page.getByLabel('Window end date',{exact:true}).dispatchEvent('change');
  await page.waitForFunction(()=>document.querySelector('.pn-daily-prices')?.dataset.state==='available');
}
async function assertPriceDrawing(page,rows){
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const actual=await page.locator('#pricesLayerHost canvas').evaluate(canvas=>{
    const r=canvas.getBoundingClientRect(),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let colored=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>150&&(pixels[i]>150||pixels[i+2]>150))colored++;
    return{series:JSON.parse(canvas.dataset.series),paths:window.__pricePaths,labels:window.__priceLabels,hollow:window.__priceHollow,canvas:{width:r.width,height:r.height,backingWidth:canvas.width,backingHeight:canvas.height,colored}};
  });
  const fields=[['maximum_observed_gbp_per_mwh','#ffcc00'],['mean_available_gbp_per_mwh','#00ffff'],['minimum_observed_gbp_per_mwh','#ff3333']];
  for(const [field,color] of fields){const groups=priceModel.segments(rows,field),receipt=actual.series.find(s=>s.field===field);assert.deepEqual(receipt.segments,groups.map(g=>g.map(p=>p.date)));
    const draws=actual.paths.filter(p=>p.color===color).slice(-groups.length);assert.deepEqual(draws.map(p=>p.points.length),groups.map(g=>g.length),'actual Canvas2D paths preserve each source gap');
    assert.ok(draws.every(p=>p.points[0].kind==='moveTo'&&p.points.slice(1).every(q=>q.kind==='lineTo')));
  }
  assert.ok(actual.canvas.width>=240&&actual.canvas.height>=300&&actual.canvas.colored>100,'actual chart paints visible colored pixels');return actual;
}
async function verifyPrices(page,width,requests){
  assert.equal(requests.filter(u=>u.startsWith(priceSpec.input.base)).length,0,'price source remains lazy until the owner category is opened');
  await tab(page,'pricesTab');await page.waitForFunction(()=>document.querySelector('#pricesLayerHost .pn-daily-prices')?.dataset.state==='available');
  assert.equal(await page.locator('#pricesLayerHost .pn-daily-prices').count(),1);assert.equal(await page.locator('#pricesLayerHost iframe').count(),0);
  assert.match(await page.locator('#pricesLayerHost .pnd-source').innerText(),/Latest source date: 2026-10-31.*historical Elexon system-sell.*GBP\/MWh/);
  assert.match(await page.locator('#pricesLayerHost .pnd-note').innerText(),/source-declared.*Complete source-day coverage does not certify stored UTC alignment/);
  assert.match(await page.locator('#pricesLayerHost .pnd-quality').innerText(),/106,668.*without timestamp repair/);
  assert.match(await page.locator('#pricesLayerHost .pnd-status').innerText(),/^2026-10-02 to 2026-10-31/);
  assert.deepEqual(requests.filter(u=>u.startsWith(priceSpec.input.base)).map(u=>u.slice(priceSpec.input.base.length)),['index.json','2026.json'],'only index and selected source year load');
  const defaultRows=priceYears.get(2026).rows.filter(r=>r.date>='2026-10-02'),drawing=await assertPriceDrawing(page,defaultRows);assert.ok(drawing.labels.some(t=>/LOW £-28\.49/.test(t)),'actual negative observed low remains a negative GBP chart annotation');
  assert.match(await page.locator('#pricesLayerHost .pnd-stats').innerText(),/-28\.49/);
  await page.locator('#pricesLayerHost canvas').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(OUT,`v933-prices-default-${width}.png`)});
  const disclosure=page.locator('#pricesLayerHost .pn-daily-prices > details');assert.equal(await disclosure.getAttribute('open'),null);await disclosure.locator('summary').click();
  assert.equal(await disclosure.getByRole('link',{name:'Pinned data index',exact:true}).getAttribute('href'),priceSpec.input.base+'index.json');assert.match(await disclosure.innerText(),/unweighted mean of available daily means.*Partial days can affect/);
  const original=page.locator('#pricesPanel').getByRole('link',{name:'Open the original electricity workspace',exact:true});assert.equal(await original.getAttribute('href'),'https://globalgrid2050.com/uk_energy_tracking_v6/');assert.equal(await original.getAttribute('target'),'_blank');
  await priceRange(page,'2026-07-04');await page.waitForFunction(()=>document.querySelector('.pnd-status').textContent.startsWith('2026-06-05 to 2026-07-04'));
  const gapRows=priceYears.get(2026).rows.filter(r=>r.date>='2026-06-05'&&r.date<='2026-07-04'),gap=await assertPriceDrawing(page,gapRows);assert.equal(gap.series[1].segments.length,2);assert.ok(gap.hollow>=3,'partial day is drawn with hollow markers in every series');
  assert.match(await page.locator('#pricesLayerHost .pnd-coverage').innerText(),/16 complete source days.*1 partial.*13 missing/);
  assert.equal(await page.locator('#pricesLayerHost tbody tr').filter({hasText:'NO_OBSERVATIONS'}).count(),13);assert.equal(await page.locator('#pricesLayerHost tbody tr').filter({hasText:'PARTIAL_SOURCE_DAY'}).count(),1);
  await page.locator('#pricesLayerHost canvas').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(OUT,`v933-prices-gap-${width}.png`)});
  // No UI window is short enough to contain only the thirteen missing days.
  // Exercise the same imported canvas runtime against those actual owner rows.
  const missingRows=priceYears.get(2026).rows.filter(r=>r.date>='2026-06-18'&&r.date<='2026-06-30');
  const empty=await page.evaluate(async({url,rows})=>{const {drawDaily}=await import(url),host=document.getElementById('pricesLayerHost'),canvas=document.createElement('canvas');host.querySelector('.pn-daily-prices').append(canvas);canvas.style.width='300px';canvas.style.height='350px';window.__pricePaths=[];window.__priceLabels=[];const result=drawDaily(canvas,{start:'2026-06-18',end:'2026-06-30',rows});const answer={result,paths:window.__pricePaths.length,labels:window.__priceLabels};canvas.remove();return answer;},{url:origin+'/automation/price_daily_ui/'+priceSpec.producer.commit+'/canvas.mjs',rows:missingRows});
  assert.equal(empty.paths,0);assert.ok(empty.result.every(s=>s.segments.length===0));assert.ok(empty.labels.includes('No reported prices in this window'));
  await page.getByLabel('Source year',{exact:true}).selectOption('2025');await page.waitForFunction(()=>document.querySelector('.pnd-status').textContent.startsWith('2025-01-01 to 2025-12-31'));assert.equal(await page.getByLabel('Daily window',{exact:true}).inputValue(),'year');assert.equal(await page.locator('#pricesLayerHost tbody tr').count(),365);
  await priceRange(page,'2099-01-01');assert.equal(await page.getByLabel('Window end date',{exact:true}).inputValue(),'2026-10-31');await page.waitForFunction(()=>document.querySelector('.pnd-status').textContent.startsWith('2026-10-02 to 2026-10-31'));
  assert.equal(requests.filter(u=>u===priceSpec.input.base+'2026.json').length,1,'returning to accepted 2026 reuses immutable cache');assert.equal(requests.filter(u=>u===priceSpec.input.base+'2025.json').length,1);
  await tab(page,'solarTab');await tab(page,'pricesTab');assert.equal(await page.locator('#pricesLayerHost .pn-daily-prices').count(),1);assert.equal(requests.filter(u=>u===priceSpec.input.base+'index.json').length,1,'returning category reuses accepted index');
  await fullWidth(page);pass('historical daily host lazy index/year cache, actual Canvas2D negative/gapped/partial/empty paths, source clocks and bounded year/date controls',{width,defaultDays:30,gapMissingDays:13,actualAllMissingRuntimeProbe:true});
}
let browser;
try{
  browser=await chromium.launch({headless:true});receipt.browser=browser.version();
  if(!process.env.V933_ROTATION_ONLY){
  const b=await open(browser,1440,baseline);await allRepd(b.page);await b.page.waitForFunction(()=>!/^loading/i.test(document.getElementById('newsMeta')?.textContent||'loading'));
  const oldCsv=await download(b.page,b.page.locator('#exportInline'),'v929-all.csv');assert.equal(oldCsv.rows.length,7776);
  await tab(b.page,'datacentreTab');await b.page.waitForFunction(()=>document.querySelectorAll('#datacentreHost tbody tr').length===54);await dcGlobal(b.page);baselineDCLinks=await dcOriginalLinks(b.page);baselineDCCsv=await download(b.page,b.page.locator('#datacentreHost button.ggdc-download'),'v931-dc-global.csv');
  await allRepd(b.page);baselineHeadlineHas=await headlineHas(b.page);
  for(const ref of ['12588','10529','18174','15149','14806','15000']){const button=await noteButton(b.page,ref);baselineNoteButtons[ref]=await button.innerText();if(['12588','15149','14806','15000'].includes(ref)){await button.click();baselineLinksByRef[ref]=await existingBriefLinks(b.page);if(ref==='12588')baselineHeadlineLinks=baselineLinksByRef[ref];await b.page.keyboard.press('Escape');}}
  await b.context.close();
  pass('frozen V9.32 browser CSV establishes complete original population',{rows:7775,sha256:oldCsv.sha256});
  for(const width of [390,393,1440]){
    const {context,page,errors,requests}=await open(browser,width,candidate);
    assert.equal(await page.locator('main > section').count(),2);
    const fullWidthLayout=await fullWidth(page);await painted(page,'.release-header');
    assert.deepEqual((await page.locator('main > section').evaluateAll(nodes=>nodes.map(n=>n.querySelector('h2')?.textContent.replace(/\s+/g,' ').trim().toUpperCase()))),['GLOBALGRID2050 HEADLINES','REPD PIPELINE ANALYTICS']);
    assert.deepEqual((await page.locator('.pipeline-tabs > [role=tab]').allTextContents()).map(x=>x.trim()),['Solar','BESS','Grid','Data Centres','Offtakers','Prices']);
    assert.equal(requests.filter(u=>sourceBytes.has(u)).length,0,'asset source layers remain lazy before selection');
    await page.waitForFunction(()=>document.getElementById('tbody')?.dataset.total==='3604');
    await tab(page,'bessTab');assert.ok((await page.locator('#tbody tr .badge').allTextContents()).every(t=>/battery/i.test(t)));
    await allRepd(page);await page.locator('#search').fill('8162');await page.waitForFunction(()=>document.getElementById('repd-8162'));
    const receiver=await import(pathToFileURL(resolve(baseline,'scripts/core/atlas-receiver-v9-7.js'))),m=JSON.parse(readFileSync(resolve(baseline,'data/v9.1/build_manifest.json')));
    const row=m.project_partitions.flatMap(p=>JSON.parse(readFileSync(resolve(baseline,p.path))).projects).find(p=>String(p.repd_ref)==='8162');
    assert.equal(await page.locator('#repd-8162 a.atlaslink').getAttribute('href'),receiver.buildAtlasDeepLinkV9_7(row));
    await allRepd(page);await page.waitForFunction(()=>!/^loading/i.test(document.getElementById('newsMeta')?.textContent||'loading'));
    await verifyPrimary(page,width,requests);await verifyAddedConsents(page,width,requests);
    if(width===1440){const actual=await download(page,page.locator('#exportInline'),'v933-all.csv');assert.deepEqual(actual.rows,oldCsv.rows);pass('all 7,775 exported CSV rows/fields/order equal frozen V9.32',{sha256:actual.sha256});}
    await page.waitForFunction(()=>document.querySelectorAll('#headlineTicker ul:not([aria-hidden]) li').length===10);
    assert.equal(await page.locator('#newsStatus').getAttribute('data-state'),'snapshot');
    const tickerLabel=await page.locator('#headlineTicker .pn-ticker-label').textContent();
    assert.match(tickerLabel,/Latest available.*source unavailable.*saved snapshot collected.*articles may be older/i);
    const sourceClock=JSON.parse(readFileSync(resolve(candidate,'news/snapshot-provenance.json'))).generated_at;
    const clock=new Date(sourceClock),clockLabel=clock.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})+' '+String(clock.getUTCHours()).padStart(2,'0')+':'+String(clock.getUTCMinutes()).padStart(2,'0')+' UTC';
    assert.ok(tickerLabel.includes(clockLabel),'ticker preserves original source collection clock');
    const headlineItems=JSON.parse(readFileSync(resolve(candidate,'news/pipeline_headlines.snapshot.json'))).items;
    const sourceLinks=new Set(headlineItems.map(x=>x.link));
    for(const a of await page.locator('#headlineTicker ul:not([aria-hidden]) a').all())assert.ok(sourceLinks.has(await a.getAttribute('href')));
    assert.equal(await page.locator('#headlineTicker a').first().evaluate(n=>getComputedStyle(n).color),'rgb(255, 85, 85)');
    await page.locator('#headlineTicker button').click();assert.equal(await page.locator('#headlineTicker').evaluate(n=>n.classList.contains('pn-paused')),true);
    await tab(page,'gridTab');await page.waitForFunction(()=>document.querySelector('#gridLayerHost .pn-count')?.textContent.includes('5,800'));
    assert.match(await page.locator('#gridLayerHost .pn-count').innerText(),/4,460 source names/);assert.equal(await page.locator('#gridLayerHost tbody tr').count(),100);
    await page.locator('#gridLayerHost').getByRole('button',{name:'Next',exact:true}).click();assert.match(await page.locator('#gridLayerHost .pn-tools').last().innerText(),/Page 2/);
    const search=page.locator('#gridLayerHost input[type=search]');await search.fill('grid_substations:0');assert.match(await page.locator('#gridLayerHost tbody').innerText(),/Name not recorded/);
    await search.fill('Barrow');const selected=await download(page,page.locator('#gridLayerHost').getByRole('button',{name:'Export results'}),`substations-search-${width}.csv`);assert.ok(selected.rows.length>1);
    const map=new URL(await page.locator('#gridLayerHost tbody a').first().getAttribute('href'));assert.equal(map.searchParams.has('repd_ref'),false);assert.equal(map.searchParams.has('capacity_mw'),false);assert.ok(map.searchParams.has('longitude')&&map.searchParams.has('latitude'));
    await search.fill('');await page.locator('#gridLayerHost').getByRole('button',{name:'2D locations'}).click();assert.equal(await page.locator('#gridLayerHost canvas').isVisible(),true);
    await page.locator('#gridLayerHost').getByRole('button',{name:'Analytics',exact:true}).click();assert.ok(await page.locator('#gridLayerHost meter').count()>0);
    await page.locator('#gridLayerHost').getByRole('tab',{name:'Grid Projects',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#gridLayerHost .pn-panel').textContent.includes('No independently approved'));
    assert.equal(await page.locator('#gridLayerHost tbody tr').count(),0);
    await tab(page,'offtakersTab');await page.waitForFunction(()=>document.querySelector('#offtakersLayerHost .pn-count')?.textContent.includes('1,568'));
    const offtakersCsv=await download(page,page.locator('#offtakersLayerHost').getByRole('button',{name:'Export results'}),`offtakers-${width}.csv`);
    assert.equal(offtakersCsv.rows.length,1569);assert.ok(offtakersCsv.rows[0].includes('Source record'));const exported=JSON.stringify(offtakersCsv.rows);assert.match(exported,/ODbL/);assert.match(exported,/OGL/);assert.match(exported,/NAEI/);
    await verifyPrices(page,width,requests);
    await tab(page,'datacentreTab');await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost .ggdc-table tbody tr').length===54);
    await verifyLocations(page,width);
    await tab(page,'gridTab');await page.locator('#gridLayerHost').getByRole('tab',{name:'Substations',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#gridLayerHost .pn-count')?.textContent.includes('5,800'));
    assert.equal(requests.filter(u=>u===catalogue.layers.find(l=>l.id==='substations').data.url).length,1,'returning to Grid reuses pinned source cache');
    await page.locator('#pricesTab').focus();await page.keyboard.press('Home');assert.equal(await page.locator('#solarTab').evaluate(n=>n===document.activeElement),true);
    await page.waitForFunction(()=>document.getElementById('tbody')?.dataset.total==='3604');
    const geometry=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily}));assert.ok(geometry.width<=width+2);assert.match(geometry.font,/mono|courier/i);
    await page.screenshot({path:resolve(OUT,`v933-solar-${width}.png`)});await tab(page,'gridTab');await page.screenshot({path:resolve(OUT,`v933-grid-${width}.png`)});
    assert.deepEqual(errors,[]);pass('integrated categories, provenance, ticker, search/CSV/MAP, cache and controls',{width,substations:5800,named:4460,unnamed:1340,offtakers:1568,geometry,fullWidthLayout});await context.close();
  }
  }
  const rotating=await open(browser,390,candidate,{mobile:true,height:844});
  await tab(rotating.page,'datacentreTab');await rotating.page.waitForFunction(()=>document.getElementById('datacentreHost')?.dataset.locationsState==='available');await dcGlobal(rotating.page);
  await rotating.page.getByRole('searchbox',{name:'Search Data Centre records'}).fill('CyrusOne LON1');await rotating.page.waitForFunction(()=>document.querySelectorAll('#datacentreHost .ggdc-screen-actions').length===1);
  await rotating.page.locator('.ggdc-reported-address summary').tap();
  const session=await rotating.context.newCDPSession(rotating.page),states=[];
  for(const [name,size] of [['portrait',{width:390,height:844}],['landscape',{width:915,height:412}],['portrait-return',{width:390,height:844}]]){
    await rotating.page.setViewportSize(size);
    await session.send('Emulation.setDeviceMetricsOverride',{...size,screenWidth:size.width,screenHeight:size.height,deviceScaleFactor:2.625,mobile:true,screenOrientation:{type:name==='landscape'?'landscapePrimary':'portraitPrimary',angle:name==='landscape'?90:0}});
    await rotating.page.waitForFunction(size=>Math.abs(innerWidth-size.width)<=1&&Math.abs(innerHeight-size.height)<=2,size);
    const layout=await fullWidth(rotating.page),paint=await painted(rotating.page,'#datacentreHost .ggdc-reported-address > p');
    assert.equal(await rotating.page.getByRole('searchbox',{name:'Search Data Centre records'}).inputValue(),'CyrusOne LON1');assert.equal(await rotating.page.locator('.ggdc-reported-address').getAttribute('open'),'');
    assert.equal(await rotating.page.locator('#datacentreHost .ggdc-screen-actions').count(),1);assert.equal(await rotating.page.locator('#datacentreHost .ggdc-screen-footnote').count(),1);assert.equal(await rotating.page.locator('#datacentreHost .ggdc-location-sources').count(),1);
    const screenshot=await orientationScreenshot(session,`v933-dc-${name}.png`,size);states.push({name,...size,layout,paint,screenshot});
  }
  assert.deepEqual(rotating.errors,[]);await rotating.context.close();pass('Android-UA/touch-emulated DC portrait-landscape-return preserves address disclosure/search/Screen/onefooter',{states,actualHandset:false});
  const priceRotation=await open(browser,393,candidate,{mobile:true,height:851});await tab(priceRotation.page,'pricesTab');await priceRotation.page.waitForFunction(()=>document.querySelector('.pn-daily-prices')?.dataset.state==='available');
  await priceRange(priceRotation.page,'2026-07-04');await priceRotation.page.waitForFunction(()=>document.querySelector('.pnd-status').textContent.startsWith('2026-06-05 to 2026-07-04'));
  const priceSession=await priceRotation.context.newCDPSession(priceRotation.page),priceStates=[];
  for(const [name,size] of [['portrait',{width:393,height:851}],['landscape',{width:915,height:412}],['portrait-return',{width:393,height:851}]]){
    await priceRotation.page.setViewportSize(size);await priceSession.send('Emulation.setDeviceMetricsOverride',{...size,screenWidth:size.width,screenHeight:size.height,deviceScaleFactor:2.625,mobile:true,screenOrientation:{type:name==='landscape'?'landscapePrimary':'portraitPrimary',angle:name==='landscape'?90:0}});
    await priceRotation.page.waitForFunction(size=>Math.abs(innerWidth-size.width)<=1&&Math.abs(innerHeight-size.height)<=2,size);const layout=await fullWidth(priceRotation.page);
    assert.equal(await priceRotation.page.getByLabel('Window end date',{exact:true}).inputValue(),'2026-07-04');assert.equal(await priceRotation.page.locator('#pricesLayerHost .pn-daily-prices').count(),1);
    const chart=await assertPriceDrawing(priceRotation.page,priceYears.get(2026).rows.filter(r=>r.date>='2026-06-05'&&r.date<='2026-07-04'));await priceRotation.page.locator('#pricesLayerHost canvas').scrollIntoViewIfNeeded();
    const screenshot=await orientationScreenshot(priceSession,`v933-prices-${name}.png`,size);priceStates.push({name,...size,layout,canvas:chart.canvas,screenshot});
  }
  assert.deepEqual(priceRotation.errors,[]);await priceRotation.context.close();pass('Android-UA/touch-emulated Prices rotation keeps one painted gap chart and selected source window',{states:priceStates,actualHandset:false});
  const primaryRotation=await open(browser,393,candidate,{mobile:true,height:851});await primaryRotation.page.waitForFunction(()=>document.documentElement.dataset.primaryNotesState==='available');await allRepd(primaryRotation.page);await (await noteButton(primaryRotation.page,'12588')).tap();
  await primaryRotation.page.locator('.machine-note-primary details summary').tap();const primarySession=await primaryRotation.context.newCDPSession(primaryRotation.page),primaryStates=[];
  for(const [name,size] of [['portrait',{width:393,height:851}],['landscape',{width:915,height:412}],['portrait-return',{width:393,height:851}]]){
    await primaryRotation.page.setViewportSize(size);await primarySession.send('Emulation.setDeviceMetricsOverride',{...size,screenWidth:size.width,screenHeight:size.height,deviceScaleFactor:2.625,mobile:true,screenOrientation:{type:name==='landscape'?'landscapePrimary':'portraitPrimary',angle:name==='landscape'?90:0}});await primaryRotation.page.waitForFunction(size=>Math.abs(innerWidth-size.width)<=1&&Math.abs(innerHeight-size.height)<=2,size);
    const layout=await fullWidth(primaryRotation.page),paint=await painted(primaryRotation.page,'.machine-note-primary h3');assert.equal(await primaryRotation.page.locator('.machine-note-primary').count(),1);assert.equal(await primaryRotation.page.locator('.machine-note-primary details').getAttribute('open'),'');assert.equal(await primaryRotation.page.locator('#search').inputValue(),'12588');
    const screenshot=await orientationScreenshot(primarySession,`v933-primary-${name}.png`,size);primaryStates.push({name,...size,layout,paint,screenshot});
  }
  await primaryRotation.page.keyboard.press('Escape');assert.equal(await primaryRotation.page.locator('.machine-note-dialog[open]').count(),0);assert.deepEqual(primaryRotation.errors,[]);await primaryRotation.context.close();pass('Android-UA/touch-emulated primary dialog rotates without losing provisional details/search/frozen record',{states:primaryStates,actualHandset:false});
  await nativeLandscapeNotePan(browser);
  for(const corrupt of ['primary-manifest','primary-model','primary-catalogue','primary-json','primary-mime','primary-renderer','primary-evaluation']){
    const test=await open(browser,393,candidate,{corrupt});await test.page.waitForFunction(()=>document.documentElement.dataset.primaryNotesState==='unavailable');await test.page.waitForFunction(()=>!/^loading/i.test(document.getElementById('newsMeta')?.textContent||'loading'));
    assert.deepEqual(await headlineHas(test.page),baselineHeadlineHas);assert.equal(await test.page.locator('[data-note-primary]').count(),0);await allRepd(test.page);const button=await noteButton(test.page,'12588');assert.match(await button.innerText(),baselineHeadlineHas['12588']?/POSSIBLE/:/NO MATCHED HEADLINE/);await button.click();assert.equal(await test.page.locator('.machine-note-dialog .machine-note-primary').count(),0);assert.deepEqual(await existingBriefLinks(test.page),baselineHeadlineLinks);assert.match(await test.page.locator('.machine-note-dialog').innerText(),/OFFICIAL SOURCE STATUS \(FROZEN REPD\).*Application Submitted/);await test.page.keyboard.press('Escape');
    await allRepd(test.page);assert.equal(await test.page.locator('#tbody').getAttribute('data-total'),'7775');await tab(test.page,'datacentreTab');await test.page.waitForFunction(()=>document.getElementById('datacentreHost')?.dataset.locationsState==='available');assert.equal(await test.page.locator('#datacentreHost tbody tr').count(),54);assert.equal(await test.page.locator('#datacentreHost .ggdc-screen-actions').count(),34);
    await tab(test.page,'pricesTab');await test.page.waitForFunction(()=>document.querySelector('.pn-daily-prices')?.dataset.state==='available');assert.match(await test.page.locator('.pnd-status').innerText(),/^2026-10-02 to 2026-10-31/);assert.deepEqual(test.errors,[]);await test.context.close();pass('invalid primary cartridge/evaluation withholds only primary source; original headline brief/7775REPD/DC/Prices remain usable',{corrupt});
  }
  for(const corrupt of ['price-manifest','price-module','price-index','price-year']){
    const test=await open(browser,393,candidate,{corrupt});await tab(test.page,'pricesTab');await test.page.waitForFunction(()=>document.getElementById('pricesLayerHost')?.dataset.priceState==='unavailable');
    assert.equal(await test.page.locator('#pricesLayerHost canvas:visible').count(),0);assert.equal(await test.page.locator('#pricesLayerHost tbody tr').count(),0);assert.equal(await test.page.locator('#pricesLayerHost .pnd-stats:not([hidden])').count(),0);
    assert.equal(await test.page.locator('#pricesPanel').getByRole('link',{name:'Open the original electricity workspace',exact:true}).getAttribute('href'),'https://globalgrid2050.com/uk_energy_tracking_v6/');
    await allRepd(test.page);assert.equal(await test.page.locator('#tbody').getAttribute('data-total'),'7775');await tab(test.page,'datacentreTab');await test.page.waitForFunction(()=>document.getElementById('datacentreHost')?.dataset.locationsState==='available');
    assert.equal(await test.page.locator('#datacentreHost tbody tr').count(),54);assert.equal(await test.page.locator('#datacentreHost .ggdc-screen-actions').count(),34);await dcGlobal(test.page);assert.deepEqual(await dcOriginalLinks(test.page),baselineDCLinks);
    assert.deepEqual(test.errors,[]);await test.context.close();pass('price corruption withholds chart/results while all REPD rows, original workspace and DC locations/maps remain usable',{corrupt});
  }
  for(const corrupt of ['dc-manifest','dc-module','dc-source']){
    const test=await open(browser,390,candidate,{corrupt});await tab(test.page,'datacentreTab');await test.page.waitForFunction(()=>document.getElementById('datacentreHost')?.dataset.locationsState==='unavailable');
    assert.equal(await test.page.locator('#datacentreHost tbody tr').count(),54);assert.equal(await test.page.locator('#datacentreHost .ggdc-location-actions').count(),0);assert.equal(await test.page.locator('#datacentreHost .ggdc-screen-footnote').count(),0);
    assert.match(await test.page.locator('#datacentreHost .dc-location-status').innerText(),/Additional location data unavailable/);await dcGlobal(test.page);assert.deepEqual(await dcOriginalLinks(test.page),baselineDCLinks);
    await test.page.getByRole('searchbox',{name:'Search Data Centre records'}).fill('CyrusOne LON1');await test.page.waitForFunction(()=>document.querySelectorAll('#datacentreHost tbody tr').length===1);await allRepd(test.page);assert.equal(await test.page.locator('#tbody').getAttribute('data-total'),'7775');assert.deepEqual(test.errors,[]);await test.context.close();
    pass('optional location corruption fails closed without changing original DC controls/maps or REPD',{corrupt});
  }
  const bad=await open(browser,393,candidate,{corrupt:true,reducedMotion:true});await tab(bad.page,'gridTab');await bad.page.waitForFunction(()=>document.querySelector('#gridLayerHost .pn-panel')?.dataset.state==='unavailable');assert.equal(await bad.page.locator('#gridLayerHost tbody tr').count(),0);
  await allRepd(bad.page);assert.equal(await bad.page.locator('#tbody').getAttribute('data-total'),'7775');await tab(bad.page,'offtakersTab');await bad.page.waitForFunction(()=>document.querySelector('#offtakersLayerHost .pn-count')?.textContent.includes('1,568'));
  await bad.page.waitForFunction(()=>document.querySelector('#headlineTicker .pn-ticker-track'));assert.equal(await bad.page.locator('#headlineTicker .pn-ticker-track').evaluate(n=>getComputedStyle(n).animationName),'none');assert.deepEqual(bad.errors,[]);await bad.context.close();
  pass('corrupt pinned substation source fails closed while REPD/Offtakers remain usable; reduced motion suppresses ticker animation');receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.failure=error.stack;throw error;}
finally{receipt.blocked_external=[...new Set(receipt.blocked_external)];writeFileSync(resolve(OUT,'browser.json'),JSON.stringify(receipt,null,2)+'\n');if(browser)await browser.close();await new Promise(r=>server.close(r));}
