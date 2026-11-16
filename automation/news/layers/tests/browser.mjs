/* Deterministic UI proof using the existing exact source bytes, not live MAP proof. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {catalogue} from '../catalogue.mjs';
import {assetRows,selectRows} from '../model.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../../..');
const GRID=resolve(process.env.GRIDATLAS_SOURCE||'D:/githubfiles/gridatlas');
const OUT=resolve(process.env.LAYERS_OUT||'D:/githubfiles/.qa-artifacts/pipeline-layers');
const {chromium}=await import(pathToFileURL(resolve(process.env.LAYERS_PLAYWRIGHT||'D:/githubfiles/.qa-tools/node/node_modules/playwright/index.mjs')));
const hash=b=>createHash('sha256').update(b).digest('hex');
const inputs=new Map();
for(const layer of catalogue.layers.filter(x=>x.data)) {
  const path=new URL(layer.data.url).pathname.split('/').slice(4).join('/');
  const bytes=readFileSync(resolve(GRID,path));assert.equal(hash(bytes),layer.data.sha256,'Actual source blob pin');inputs.set(layer.data.url,bytes);
}
const headlines=readFileSync(process.env.LAYERS_HEADLINES||'D:/githubfiles/.worktrees/gg2050-v928-preview/uk_renewables_pipeline/202611161757/news/pipeline_headlines.snapshot.json');
mkdirSync(OUT,{recursive:true});
const server=createServer((req,res)=>{
  try {
    let path=resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
    if(!path.startsWith(ROOT+sep)){res.writeHead(403).end();return;}
    if(statSync(path).isDirectory())path=resolve(path,'index.html');
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(path));
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const receipt={status:'RUNNING',at:new Date().toISOString(),headlines_sha256:hash(headlines),checks:[],limitations:['Exact local pinned-data replay; destination GridAtlas and original Price graphs not certified by this harness.','Browser touch emulation is not a native phone test.'],blocked:[]};
let browser;
try {
  browser=await chromium.launch({headless:true});receipt.browser=browser.version();
  for(const width of [390,393,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500,acceptDownloads:true});const page=await context.newPage();
    const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*',async route=>{
      const url=route.request().url();requests.push(url);
      if(url.startsWith(origin+'/'))return route.continue();
      if(inputs.has(url))return route.fulfill({status:200,contentType:'application/json',body:inputs.get(url)});
      if(url.includes('/pipeline-news-data/dist/pipeline_headlines.json'))return route.fulfill({status:200,contentType:'application/json',body:headlines});
      receipt.blocked.push(url);return route.abort();
    });
    await page.goto(origin+'/automation/news/layers/demo/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('.pn-count')?.textContent.includes('5,800'));
    assert.equal(requests.filter(u=>u.includes('offtakers_filtered')).length,0,'Unselected layer is not eagerly fetched');
    assert.equal(await page.locator('.pn-tablewrap tbody tr').count(),100,'Bounded visible rows');
    assert.equal(await page.locator('.pn-ticker ul:not([aria-hidden]) li').count(),10,'Ten source headlines; scrolling copy is accessibility-hidden');
    const firstName=await page.locator('.pn-ticker li').first().innerText();assert.ok(firstName.length>10);
    const search=page.getByRole('searchbox',{name:'Search Substations'});await search.fill('grid_substations:0');
    assert.match(await page.locator('.pn-count').innerText(),/^1 records/);assert.match(await page.locator('tbody').innerText(),/Name not recorded/);
    await search.fill('Barrow');const expected=selectRows(assetRows(JSON.parse(inputs.get(catalogue.layers[0].data.url)),'substation'),'Barrow');
    assert.ok(expected.length>0);
    const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export results'}).click();const download=await downloadEvent;
    const csvPath=resolve(OUT,`substations-${width}.csv`);await download.saveAs(csvPath);
    const csv=readFileSync(csvPath,'utf8');for(const row of expected)assert.ok(csv.includes(row.sourceId));
    const href=await page.getByRole('link',{name:'MAP',exact:true}).first().getAttribute('href');assert.equal(new URL(href).searchParams.has('repd_ref'),false);
    await search.fill('');await page.getByRole('button',{name:'2D locations'}).click();assert.equal(await page.locator('canvas').isVisible(),true);
    await page.getByRole('button',{name:'Analytics',exact:true}).click();assert.ok(await page.locator('meter').count()>0);
    await page.getByRole('tab',{name:'Grid Projects',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pn-panel').textContent.includes('No independently approved'));
    await page.getByRole('tab',{name:'Offtakers',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pn-count')?.textContent.includes('1,568'));
    assert.match(await page.locator('.pn-note').innerText(),/overlap is retained/);
    await page.getByRole('tab',{name:'Prices',exact:true}).click();await page.getByRole('button',{name:'Show original graphs here'}).click();
    assert.equal(await page.locator('iframe').getAttribute('src'),'https://globalgrid2050.com/uk_energy_tracking_v6/');
    await page.getByRole('tab',{name:'Grid',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pn-count')?.textContent.includes('5,800'));
    if(width===393) {
      const race=await page.evaluate(async()=>{
        const {mountLayerControls}=await import('/automation/news/layers/controls.mjs');
        const root=document.createElement('div');root.id='race-proof';document.body.append(root);
        let release;const delayed=new Promise(r=>{release=r;});
        const layers=[{id:'slow',label:'Slow',group:'Grid',renderer:'slow'},{id:'fast',label:'Fast',group:'Grid',renderer:'fast'},{id:'bad',label:'Bad',group:'Grid',renderer:'bad'}];
        const controls=mountLayerControls(root,{registry:{layers,load:async()=>null,clear(){}},initial:'slow',renderers:{slow:async host=>{await delayed;host.textContent='stale';},fast:host=>{host.textContent='latest';},bad:()=>{throw Error('Module failure');}}});
        await controls.activate('fast');release();await new Promise(r=>setTimeout(r,0));
        const latest=root.querySelector('[role="tabpanel"]').textContent;
        await controls.activate('bad');const failed=root.querySelector('[role="tabpanel"]').dataset.state;
        await controls.activate('fast');const recovered=root.querySelector('[role="tabpanel"]').textContent;
        controls.destroy();root.remove();return {latest,failed,recovered};
      });
      assert.deepEqual(race,{latest:'latest',failed:'unavailable',recovered:'latest'},'Late response cannot overwrite new tab and a failed module does not poison neighbors');
    }
    // Return reuses the same pinned raw source rather than downloading it again.
    assert.equal(requests.filter(u=>u===catalogue.layers[0].data.url).length,1);
    await page.getByRole('tab',{name:'Grid',exact:true}).focus();await page.keyboard.press('End');await page.waitForFunction(()=>document.querySelector('iframe')===null&&document.querySelector('.pn-panel').textContent.includes('Original Electricity'));
    await page.getByRole('tab',{name:'Grid',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pn-count')?.textContent.includes('5,800'));
    const geometry=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geometry.scroll<=geometry.width+1,'No document horizontal overflow');
    await page.getByRole('button',{name:'Pause headline scrolling'}).click();assert.equal(await page.getByRole('button',{name:'Resume headline scrolling'}).getAttribute('aria-pressed'),'true');
    await page.screenshot({path:resolve(OUT,`layers-${width}.png`),fullPage:false});assert.deepEqual(errors,[]);
    receipt.checks.push({width,status:'PASS',records:5800,offtakers:1568,csv_selected:expected.length,geometry});await context.close();
  }
  // Corrupted feed must not leak old rows or prevent another tab from working.
  const context=await browser.newContext({viewport:{width:393,height:852},reducedMotion:'reduce'}),page=await context.newPage();
  await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith(origin+'/'))return route.continue();if(inputs.has(u))return route.fulfill({status:200,contentType:'application/json',body:Buffer.concat([inputs.get(u),Buffer.from(' ')])});if(u.includes('pipeline_headlines.json'))return route.fulfill({status:200,contentType:'application/json',body:headlines});return route.abort();});
  await page.goto(origin+'/automation/news/layers/demo/');await page.waitForFunction(()=>document.querySelector('.pn-panel')?.dataset.state==='unavailable');
  assert.equal(await page.locator('tbody tr').count(),0);await page.getByRole('tab',{name:'Prices',exact:true}).click();await page.getByRole('button',{name:'Show original graphs here'}).waitFor();
  assert.equal(await page.locator('.pn-ticker-track').evaluate(n=>getComputedStyle(n).animationName),'none');
  receipt.checks.push({name:'Changed-source isolation and reduced motion',status:'PASS'});await context.close();receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.failure=error.stack;throw error;}
finally{receipt.blocked=[...new Set(receipt.blocked)];writeFileSync(resolve(OUT,'browser.json'),JSON.stringify(receipt,null,2)+'\n');if(browser)await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(receipt,null,2));
