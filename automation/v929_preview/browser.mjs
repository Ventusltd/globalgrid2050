/** Real integrated V9.29 browser acceptance against exact source-byte fixtures. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,statSync,existsSync} from 'node:fs';
import {dirname,resolve,relative,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const EDITION=process.env.V929_CANDIDATE||'uk_renewables_pipeline/202611162354';
const candidate=resolve(ROOT,EDITION),baseline=resolve(ROOT,'uk_renewables_pipeline/202611161757');
const OUT=resolve(process.env.V929_OUT||resolve(tmpdir(),'gg2050-v929-preview'));
const {chromium}=process.env.V929_PLAYWRIGHT
  ? await import(pathToFileURL(resolve(process.env.V929_PLAYWRIGHT))) : await import('playwright');
const {catalogue}=await import(pathToFileURL(resolve(candidate,'scripts/layers/catalogue.mjs')));
const sha=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(OUT,{recursive:true});
const receipt={status:'RUNNING',utc:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),edition:EDITION,index_sha256:sha(readFileSync(resolve(candidate,'index.html'))),checks:[],sources:[],blocked_external:[],limitations:[
  'Local integrated browser proof; no deployment, public served-byte or native-phone acceptance.',
  'Pinned GridAtlas source bytes are replayed exactly; no claim of fresh network-state data or typed substation arrival.',
  'External feeds, Chart.js CDN and Prices iframe navigation are blocked; existing saved headline and explicit frame URL are tested.',
  'Original Prices can show indicative baselines and stale observations; frame wiring is not actual-price-series acceptance.',
  'Android UA, touch gestures and screen orientation are Chromium emulation on this host, not a native Android handset/browser process.',
  'All-row MAP construction is checked separately; this browser suite does not execute the public GridAtlas receiver.']};
const sourceBytes=new Map();
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
  await context.route('**/*',route=>{const u=route.request().url();requests.push(u);if(u.startsWith(origin+'/'))return route.continue();if(sourceBytes.has(u)){let raw=sourceBytes.get(u);if(corrupt&&u===catalogue.layers.find(l=>l.id==='substations').data.url)raw=Buffer.concat([raw,Buffer.from(' ')]);return route.fulfill({status:200,contentType:'application/json',body:raw});}receipt.blocked_external.push(u);return route.abort();});
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
  const paint=await target.evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),x=Math.max(0,Math.min(innerWidth-1,r.left+Math.min(r.width/2,innerWidth/2))),y=Math.max(0,Math.min(innerHeight-1,r.top+Math.min(r.height/2,innerHeight/2))),hit=document.elementFromPoint(x,y);return{width:r.width,height:r.height,top:r.top,left:r.left,display:s.display,visibility:s.visibility,opacity:s.opacity,text:n.textContent.trim().slice(0,120),hit:!!hit&&(n===hit||n.contains(hit)),viewport:{width:innerWidth,height:innerHeight}};});
  assert.ok(paint.width>0&&paint.height>0&&paint.display!=='none'&&paint.visibility==='visible'&&Number(paint.opacity)>0&&paint.text.length>0&&paint.hit,'visible painted target '+selector+': '+JSON.stringify(paint));return paint;
}
async function settleTouch(page){await page.evaluate(async()=>{let previous='',stable=0;const end=performance.now()+2500;while(performance.now()<end){await new Promise(requestAnimationFrame);const state=[scrollY,visualViewport.pageTop,...[...document.querySelectorAll('.tablewrap')].map(n=>n.scrollLeft)].join('|');if(state===previous)stable++;else stable=0;previous=state;if(stable>=8)return;}});}
async function touchTap(page,selector){await settleTouch(page);await page.locator(selector).first().tap();}
async function touchDrag(session,{x,y,dx=0,dy=0}){
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:2,radiusY:2,force:1}]});
  for(let step=1;step<=10;step++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/10,y:y+dy*step/10,id:1,radiusX:2,radiusY:2,force:1}]});await new Promise(r=>setTimeout(r,16));}
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
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
let browser;
try{
  browser=await chromium.launch({headless:true});receipt.browser=browser.version();
  if(!process.env.V929_ROTATION_ONLY){
  const b=await open(browser,1440,baseline);await allRepd(b.page);await b.page.waitForFunction(()=>!/^loading/i.test(document.getElementById('newsMeta')?.textContent||'loading'));
  const oldCsv=await download(b.page,b.page.locator('#exportInline'),'v928-all.csv');assert.equal(oldCsv.rows.length,7776);await b.context.close();
  pass('frozen V9.28 browser CSV establishes complete original population',{rows:7775,sha256:oldCsv.sha256});
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
    if(width===1440){const actual=await download(page,page.locator('#exportInline'),'v929-all.csv');assert.deepEqual(actual.rows,oldCsv.rows);pass('all 7,775 exported CSV rows/fields/order equal frozen V9.28',{sha256:actual.sha256});}
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
    await tab(page,'pricesTab');await page.locator('#pricesLayerHost').getByRole('button',{name:'Show original graphs here'}).waitFor();assert.equal(await page.locator('#pricesLayerHost iframe').count(),0);
    assert.match(await page.locator('#pricesLayerHost').innerText(),/observation dates/);assert.match(await page.locator('#pricesLayerHost').innerText(),/indicative price baselines/);
    await page.locator('#pricesLayerHost').getByRole('button',{name:'Show original graphs here'}).click();assert.equal(await page.locator('#pricesLayerHost iframe').getAttribute('src'),'https://globalgrid2050.com/uk_energy_tracking_v6/');
    await tab(page,'datacentreTab');await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost .ggdc-table tbody tr').length===54);
    await tab(page,'gridTab');await page.locator('#gridLayerHost').getByRole('tab',{name:'Substations',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#gridLayerHost .pn-count')?.textContent.includes('5,800'));
    assert.equal(requests.filter(u=>u===catalogue.layers.find(l=>l.id==='substations').data.url).length,1,'returning to Grid reuses pinned source cache');
    await page.locator('#pricesTab').focus();await page.keyboard.press('Home');assert.equal(await page.locator('#solarTab').evaluate(n=>n===document.activeElement),true);
    await page.waitForFunction(()=>document.getElementById('tbody')?.dataset.total==='3604');
    const geometry=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily}));assert.ok(geometry.width<=width+2);assert.match(geometry.font,/mono|courier/i);
    await page.screenshot({path:resolve(OUT,`v929-solar-${width}.png`)});await tab(page,'gridTab');await page.screenshot({path:resolve(OUT,`v929-grid-${width}.png`)});
    assert.deepEqual(errors,[]);pass('integrated categories, provenance, ticker, search/CSV/MAP, cache and controls',{width,substations:5800,named:4460,unnamed:1340,offtakers:1568,geometry,fullWidthLayout});await context.close();
  }
  }
  for(const profile of [
    {id:'pixel7',portrait:{width:412,height:839},landscape:{width:915,height:412}},
    {id:'compact393',portrait:{width:393,height:851},landscape:{width:851,height:393}},
    {id:'narrow390',portrait:{width:390,height:844},landscape:{width:844,height:390}},
  ]){
    const {context,page,errors}=await open(browser,profile.portrait.width,candidate,{mobile:true,height:profile.portrait.height});
    const session=await context.newCDPSession(page),orientations=[];
    // Keep Grid rendering on a second genuinely touch-selected page. A post-pan
    // compatibility-click suppression in the emulator must not mask rotation paint.
    const gridCompanion=await open(browser,profile.portrait.width,candidate,{mobile:true,height:profile.portrait.height});
    const gridSession=await gridCompanion.context.newCDPSession(gridCompanion.page);
    await touchTap(gridCompanion.page,'#gridTab');await gridCompanion.page.waitForFunction(()=>document.querySelector('#gridLayerHost .pn-count')?.textContent.includes('5,800'));
    await page.locator('#search').fill('8162');await page.waitForFunction(()=>document.getElementById('repd-8162'));assert.match(await page.locator('#repd-8162 a.atlaslink').getAttribute('href'),/repd_ref=8162/);await page.locator('#search').fill('');
    assert.match(await page.evaluate(()=>navigator.userAgent),/Android.*Pixel 7/);assert.equal(await page.evaluate(()=>navigator.maxTouchPoints>0),true);
    for(const [name,size] of [['portrait',profile.portrait],['landscape',profile.landscape],['portrait-return',profile.portrait]]){
      await session.send('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:2.625,mobile:true,screenWidth:size.width,screenHeight:size.height,screenOrientation:{type:name==='landscape'?'landscapePrimary':'portraitPrimary',angle:name==='landscape'?90:0}});
      await gridSession.send('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:2.625,mobile:true,screenWidth:size.width,screenHeight:size.height,screenOrientation:{type:name==='landscape'?'landscapePrimary':'portraitPrimary',angle:name==='landscape'?90:0}});
      await page.waitForFunction(size=>screen.width===size.width&&screen.height===size.height,size,{timeout:2500});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,physical:{width:screen.width,height:screen.height},visual:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale}}));
      assert.ok(Math.abs(viewport.width-size.width)<=1&&Math.abs(viewport.height-size.height)<=2,'rotation must retain requested CSS viewport without intrinsic-overflow shrink-to-fit: '+JSON.stringify({profile:profile.id,name,requested:size,actual:viewport}));
      assert.ok(Math.abs(viewport.visual.width*viewport.visual.scale-size.width)<=2,'actual visual viewport fills requested physical orientation');
      await page.evaluate(()=>window.scrollTo(0,0));
      const layout=await fullWidth(page),header=await painted(page,'.release-header');
      assert.equal(await page.locator('.release-links a').count(),6);assert.equal(await page.locator('#mapAtlasNav').getAttribute('href'),'https://ventusltd.github.io/gridatlas/atlas/');
      const headerScreenshot=await orientationScreenshot(session,`rotation-${profile.id}-${name}-header.png`,size);
      assert.ok(Math.abs((await page.evaluate(()=>innerWidth))-size.width)<=1,'taking proof must not reset landscape viewport');
      await page.waitForFunction(()=>document.getElementById('tbody')?.dataset.total==='3604');
      const rowPaint=await painted(page,'#tbody tr');
      const wrap=page.locator('#repdPanel .tablewrap');await wrap.scrollIntoViewIfNeeded();
      const table=await wrap.evaluate(n=>({client:n.clientWidth,scroll:n.scrollWidth,left:n.scrollLeft,overflow:getComputedStyle(n).overflowX}));
      assert.ok(table.client<=viewport.width,'table overflow remains inside viewport');
      if(table.scroll>table.client+2){
        await wrap.evaluate(n=>n.scrollLeft=0);const r=await wrap.boundingBox();
        const point={x:Math.max(20,Math.min(viewport.width-20,r.x+r.width*.75)),y:(Math.max(0,r.y)+Math.min(viewport.height,r.y+r.height))/2};
        table.touchTarget=await page.evaluate(p=>{const n=document.elementFromPoint(p.x,p.y),w=document.querySelector('#repdPanel .tablewrap');return{point:p,target:n?.tagName,inWrapper:!!n&&w.contains(n),rect:w.getBoundingClientRect().toJSON(),touchAction:getComputedStyle(w).touchAction,visualViewport:{scale:visualViewport.scale,offsetTop:visualViewport.offsetTop,height:visualViewport.height}};},point);
        assert.equal(table.touchTarget.inWrapper,true,'touch drag must start inside actual scroll container: '+JSON.stringify(table.touchTarget));
        await touchDrag(session,{...point,dx:-Math.min(200,viewport.width*.45)});
        try{await page.waitForFunction(()=>document.querySelector('#repdPanel .tablewrap').scrollLeft>0,null,{timeout:2500});}catch(error){throw Error('Trusted touch horizontal pan did not move table: '+JSON.stringify({...table,after:await wrap.evaluate(n=>n.scrollLeft)}),{cause:error});}table.touchScrollLeft=await wrap.evaluate(n=>n.scrollLeft);
      }
      await page.evaluate(()=>window.scrollTo(0,0));
      const scrollBefore=await page.evaluate(()=>scrollY);
      await touchDrag(session,{x:viewport.width-6,y:Math.floor(viewport.height*.8),dy:-Math.min(320,Math.floor(viewport.height*.6))});
      await page.waitForFunction(before=>scrollY>before,scrollBefore,{timeout:2500});
      const nativeScroll=await page.evaluate(()=>({y:scrollY,scrollHeight:document.scrollingElement.scrollHeight,clientHeight:document.scrollingElement.clientHeight}));
      assert.ok(nativeScroll.scrollHeight>nativeScroll.clientHeight);
      receipt.rotation_in_progress={profile:profile.id,name,...size,viewport,layout,header,rowPaint,table,nativeScroll,touchMethod:'trusted CDP touchStart/move/end; Playwright actionability-checked locator.tap'};
      await page.evaluate(()=>{window.__rotationTouchRecords=[];for(const name of ['touchstart','touchend','click'])document.addEventListener(name,event=>window.__rotationTouchRecords.push({type:event.type,id:event.target.id,tag:event.target.tagName,trusted:event.isTrusted}),{capture:true,once:true});});
      await touchTap(page,'#solarTab');await new Promise(r=>setTimeout(r,350));await touchTap(page,'#solarTab');
      receipt.rotation_in_progress.postPanTap=await page.evaluate(()=>({target:'solarTab',selected:document.getElementById('solarTab').getAttribute('aria-selected'),events:window.__rotationTouchRecords,url:location.href,scrollY}));
      receipt.rotation_in_progress.postPanTap.pages=context.pages().length;
      const gridLayout=await fullWidth(gridCompanion.page),gridPaint=await painted(gridCompanion.page,'#gridLayerHost tbody tr');assert.equal(await gridCompanion.page.locator('#gridLayerHost tbody tr').count(),100);
      const gridScreenshot=await orientationScreenshot(gridSession,`rotation-${profile.id}-${name}-grid.png`,size);
      assert.equal(await page.locator('#tbody').getAttribute('data-total'),'3604');
      orientations.push({name,...size,viewport,layout,header,headerScreenshot,rowPaint,table,nativeScroll,gridLayout,gridPaint,gridScreenshot,sourceRows:5800,searchAndMapIdentity:'REPD8162 checked before panning; canonical population retained',postPanTouchEvents:receipt.rotation_in_progress.postPanTap.events});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(gridCompanion.errors,[]);pass('Android-UA/touch-emulated rotation remains full-width and painted with native scrolling',{profile:profile.id,orientations,actualHandset:false,touchNavigation:'Grid selected by real touch before panning on companion rotation page; post-pan compatibility-click suppression is recorded rather than substituted with JS/mouse clicks.',publicMapReturn:'Not executed by this source-byte replay; separate live receiver gate remains.'});delete receipt.rotation_in_progress;await context.close();await gridCompanion.context.close();
  }
  const bad=await open(browser,393,candidate,{corrupt:true,reducedMotion:true});await tab(bad.page,'gridTab');await bad.page.waitForFunction(()=>document.querySelector('#gridLayerHost .pn-panel')?.dataset.state==='unavailable');assert.equal(await bad.page.locator('#gridLayerHost tbody tr').count(),0);
  await allRepd(bad.page);assert.equal(await bad.page.locator('#tbody').getAttribute('data-total'),'7775');await tab(bad.page,'offtakersTab');await bad.page.waitForFunction(()=>document.querySelector('#offtakersLayerHost .pn-count')?.textContent.includes('1,568'));
  await bad.page.waitForFunction(()=>document.querySelector('#headlineTicker .pn-ticker-track'));assert.equal(await bad.page.locator('#headlineTicker .pn-ticker-track').evaluate(n=>getComputedStyle(n).animationName),'none');assert.deepEqual(bad.errors,[]);await bad.context.close();
  pass('corrupt pinned substation source fails closed while REPD/Offtakers remain usable; reduced motion suppresses ticker animation');receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.failure=error.stack;throw error;}
finally{receipt.blocked_external=[...new Set(receipt.blocked_external)];writeFileSync(resolve(OUT,'browser.json'),JSON.stringify(receipt,null,2)+'\n');if(browser)await browser.close();await new Promise(r=>server.close(r));}
