/** Local integrated acceptance; external requests are blocked and recorded. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CANDIDATE = resolve(ROOT, process.env.V928_CANDIDATE || 'uk_renewables_pipeline/202611161757');
const BASELINE = resolve(ROOT,'uk_renewables_pipeline/202611161244');
const OUT = resolve(process.env.V928_OUT || resolve(tmpdir(),'gg2050-v928-preview'));
const PLAYWRIGHT = process.env.V928_PLAYWRIGHT;
const { chromium } = PLAYWRIGHT ? await import(pathToFileURL(resolve(PLAYWRIGHT))) : await import('playwright');
mkdirSync(OUT,{recursive:true});
const sha = b => createHash('sha256').update(b).digest('hex');
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json',
  '.geojson':'application/geo+json','.css':'text/css','.csv':'text/csv','.svg':'image/svg+xml','.png':'image/png'};
const server = createServer((req,res)=>{
  try {
    let file = resolve(ROOT, '.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (!file.startsWith(ROOT+sep)) {res.writeHead(403).end();return;}
    if (existsSync(file) && statSync(file).isDirectory()) file=resolve(file,'index.html');
    if(!existsSync(file)) {res.writeHead(404).end('Fixture not checked out');return;}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(readFileSync(file));
  } catch {res.writeHead(500).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const urlFor = dir => origin+'/'+relative(ROOT,dir).replaceAll('\\','/')+'/';
const receipt = {status:'RUNNING',utc:new Date().toISOString(),
  head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
  candidate:relative(ROOT,CANDIDATE).replaceAll('\\','/'),
  index_sha256:sha(readFileSync(resolve(CANDIDATE,'index.html'))),checks:[],blocked_external:[],
  limitations:['Localhost preview only; no deployment/public served-byte acceptance.',
    'External feeds and Chart.js CDN blocked: saved/unavailable states and numeric gauges tested, not live acquisition or chart rendering.',
    'All-row original MAP links are gated separately; this suite does not contact or certify the public GridAtlas receiver.',
    'Fixture records retain their provisional/quarantined states; browser success does not certify rights or project facts.']};
function pass(name,details={}) {receipt.checks.push({name,status:'PASS',...details});console.log('PASS:',name);}
function parseCsv(input) {
  const text=input.replace(/^\ufeff/,'');const records=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {const c=text[i];
    if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++;}
    else if(c==='"'){quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);records.push(row);row=[];cell='';}
    else cell+=c;
  }
  assert.equal(quoted,false,'CSV quoted field must terminate');
  if(cell.length||row.length){row.push(cell);records.push(row);}return records;
}
async function openPage(browser,width,folder,tamper=false) {
  const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});
  const page=await context.newPage();
  const failures=[];page.on('pageerror',e=>failures.push(String(e)));
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin) {receipt.blocked_external.push(url.origin+url.pathname);return route.abort();}
    if(tamper==='context-manifest' && url.pathname.endsWith('/automation/v928_context/preview/manifest.json')) {
      return route.fulfill({status:404,contentType:'application/json',body:'{}'});
    }
    if(tamper==='context-data' && url.pathname.endsWith('/automation/v928_context/preview/transition-context.json')) {
      return route.fulfill({status:200,contentType:'application/json',body:readFileSync(resolve(ROOT,'.'+url.pathname),'utf8')+' '});
    }
    if(tamper && url.pathname===new URL(urlFor(CANDIDATE)+'global-datacentres/projects.json').pathname) {
      const raw=readFileSync(resolve(ROOT,'.'+url.pathname),'utf8');
      return route.fulfill({status:200,contentType:'application/json',body:raw+' '});
    }
    return route.continue();
  });
  await page.goto(urlFor(folder),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Number(document.getElementById('tbody')?.dataset.total)>0);
  return {context,page,failures};
}
async function allRows(page) {
  await page.locator('#clearFilters').click();
  await page.waitForFunction(()=>document.getElementById('tbody')?.dataset.total==='7775');
  assert.equal(await page.locator('#v2').innerText(),'7,775');
}
async function downloadCsv(page,name) {
  const event=page.waitForEvent('download');await page.locator('#exportInline').click();
  const download=await event;const path=resolve(OUT,name);await download.saveAs(path);
  const bytes=readFileSync(path);return {bytes,rows:parseCsv(bytes.toString('utf8')),sha256:sha(bytes)};
}
async function activate(page,id) {
  const tab=page.locator('#'+id);await tab.focus();await page.keyboard.press('Enter');
  await page.waitForFunction(id=>document.getElementById(id)?.getAttribute('aria-selected')==='true',id);
  const panelId=await tab.getAttribute('aria-controls');
  assert.ok(panelId, id+' controls a panel');
  const panel=page.locator('#'+panelId);assert.equal(await panel.isVisible(),true,id+' panel visible');
  assert.equal(await panel.getAttribute('aria-labelledby'),id,id+' panel accessible name follows selected tab');
}
let browser;
try {
  browser=await chromium.launch({headless:true});receipt.browser=browser.version();
  // Frozen baseline is exercised through its existing controls, not a duplicated exporter.
  const base=await openPage(browser,1440,BASELINE);
  await allRows(base.page);
  await base.page.waitForFunction(()=>!/^loading/i.test(document.getElementById('newsMeta')?.textContent||'loading'));
  const baselineCsv=await downloadCsv(base.page,'baseline-v924-all.csv');
  assert.equal(baselineCsv.rows.length,7776);
  await base.context.close();
  pass('V9.24 baseline browser exports full canonical CSV',{rows:7775,sha256:baselineCsv.sha256});
  for(const width of [390,393,1440]) {
    const {context,page,failures}=await openPage(browser,width,CANDIDATE);
    const blocks=page.locator('main > section');assert.equal(await blocks.count(),2,'exactly two principal blocks');
    const titles=[];
    for(const block of await blocks.all()) titles.push(await block.locator('h2').first().innerText());
    const normalised=titles.map(s=>s.replace(/\s+/g,' ').trim().toUpperCase());
    assert.deepEqual(normalised,['GLOBALGRID2050 HEADLINES','REPD PIPELINE ANALYTICS'],'principal headings');
    const tabs=page.locator('#officialRegister [role="tab"]');assert.equal(await tabs.count(),4,'four principal tabs');
    assert.deepEqual((await tabs.allTextContents()).map(s=>s.replace(/\s+/g,' ').trim()),['Solar','BESS','Grid','Data Centres']);
    assert.equal(await page.getByRole('columnheader',{name:'NEWS SIGNAL',exact:true}).count(),0,'withdrawn signal column');
    assert.equal(await page.locator('#solar1000Pilot').isVisible().catch(()=>false),false);
    const headings=await page.locator('main h1, main h2, main h3').allTextContents();
    assert.ok(!headings.some(s=>/REGISTER CHANGES: JULY TO OCTOBER|SOLAR 1000 EVIDENCE PILOT/i.test(s)));
    await activate(page,'solarTab');
    await page.waitForFunction(()=>document.getElementById('tbody')?.dataset.total==='3604');
    await page.locator('#solarTab').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#bessTab').evaluate(n=>n===document.activeElement),true,'ArrowRight moves tab focus');
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.getElementById('bessTab')?.getAttribute('aria-selected')==='true');
    const tech=await page.locator('#tbody tr .badge').allTextContents();assert.ok(tech.length>0&&tech.every(t=>/battery/i.test(t)),'BESS rows only');
    await page.locator('#bessTab').focus();await page.keyboard.press('End');
    assert.equal(await page.locator('#datacentreTab').evaluate(n=>n===document.activeElement),true,'End focuses final tab');
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#solarTab').evaluate(n=>n===document.activeElement),true,'Home focuses first tab');
    await activate(page,'solarTab');await allRows(page);
    await page.locator('#search').fill('8162');
    await page.waitForFunction(()=>[...document.querySelectorAll('#tbody tr')].some(tr=>tr.id==='repd-8162'));
    const mapHref=await page.locator('#repd-8162 a.atlaslink').getAttribute('href');
    const baselineReceiver=await import(pathToFileURL(resolve(BASELINE,'scripts/core/atlas-receiver-v9-7.js')));
    const dataManifest=JSON.parse(readFileSync(resolve(BASELINE,'data/v9.1/build_manifest.json'),'utf8'));
    const original=dataManifest.project_partitions.flatMap(p=>JSON.parse(readFileSync(resolve(BASELINE,p.path),'utf8')).projects)
      .find(p=>String(p.repd_ref)==='8162');
    assert.equal(mapHref,baselineReceiver.buildAtlasDeepLinkV9_7(original),'rendered search result original MAP route');
    const note = width <= 768 ? page.locator('#repd-8162 .mobile-machine-note') : page.locator('#repd-8162 .machine-note-cell .machine-note-button');
    await note.click();
    assert.equal(await page.locator('.machine-note-dialog').isVisible(),true,'Machine Read Notes remain reachable after signal column removal');
    assert.match(await page.locator('.machine-note-dialog').innerText(),/INSUFFICIENT EVIDENCE|NOT INDEPENDENTLY VERIFIED/);
    await page.locator('.machine-note-close').click();
    const searched=await downloadCsv(page,`candidate-search-${width}.csv`);
    const refColumn=searched.rows[0].indexOf('REPD Ref');assert.ok(refColumn>=0);
    assert.ok(searched.rows.slice(1).some(r=>r[refColumn]==='8162'),'searched CSV contains correct REPD identity');
    await allRows(page);
    await page.waitForFunction(()=>!/^loading/i.test(document.getElementById('newsMeta')?.textContent||'loading'));
    if(width===1440) {
      const candidateCsv=await downloadCsv(page,'candidate-v928-all.csv');
      assert.deepEqual(candidateCsv.rows,baselineCsv.rows,'all exported fields and row order equal V9.24');
      pass('full candidate CSV equals V9.24 across all canonical fields and 7,775 rows',{sha256:candidateCsv.sha256});
    }
    await page.waitForFunction(()=>['snapshot','unavailable','failed'].includes(document.getElementById('newsStatus')?.dataset.state));
    const sourceState=await page.locator('#newsStatus').getAttribute('data-state');
    assert.ok(['snapshot','unavailable','failed'].includes(sourceState),'offline headline state disclosed: '+sourceState);
    assert.ok(await page.locator('#liveNews .ln-item').count()>0,'pinned existing source headlines remain useful offline');
    for(const row of await page.locator('#liveNews .ln-item').all()) {
      assert.match(await row.locator('.ln-title').getAttribute('href'),/^https:\/\//,'original source HTTPS link');
      assert.ok((await row.locator('.ln-meta').innerText()).includes('·'),'publisher/date attribution');
    }
    assert.doesNotMatch(await page.locator('#liveNews').innerText(),/\bPriority\s+\d/i,'internal ranking stays hidden');
    const geometry=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,
      font:getComputedStyle(document.body).fontFamily,background:getComputedStyle(document.body).backgroundColor}));
    assert.ok(geometry.width<=width+2,'page remains within viewport');assert.match(geometry.font,/mono|courier/i,'V9.24 monospace family');
    await page.evaluate(()=>{document.querySelector('.main').scrollTop=0;window.scrollTo(0,0);});
    await page.screenshot({path:resolve(OUT,`preview-solar-${width}.png`)});
    await activate(page,'gridTab');
    await page.waitForFunction(()=>document.getElementById('gridDirectory')?.dataset.state==='directory-only');
    assert.equal(await page.locator('#gridDirectory .grid-source').count(),14,'source directories remain distinct from project events');
    assert.match(await page.locator('#gridPanel').innerText(),/REVIEW_REQUIRED|review required|unassessed|restricted|source|unavailable/i,'honest grid state');
    await page.screenshot({path:resolve(OUT,`preview-grid-${width}.png`)});
    await activate(page,'datacentreTab');
    await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost .ggdc-table tbody tr').length===54);
    assert.match(await page.locator('#datacentreHost').innerText(),/not assessed|not_assessed/i);
    assert.doesNotMatch(await page.locator('#datacentreHost').innerText(),/100 verified operating/i);
    await page.screenshot({path:resolve(OUT,`preview-datacentre-${width}.png`)});
    await page.locator('#datacentreHost [data-kind="global"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('#datacentreHost .ggdc-table tbody tr').length===100);
    const globalDownloadEvent=page.waitForEvent('download');
    await page.locator('#datacentreHost button.ggdc-download').click();
    const globalDownload=await globalDownloadEvent;
    const globalCsvPath=resolve(OUT,`candidate-global-datacentres-${width}.csv`);
    await globalDownload.saveAs(globalCsvPath);
    assert.equal(parseCsv(readFileSync(globalCsvPath,'utf8')).length,101,'Global view must export all 100 displayed leads, not the UK subset');
    const country=page.locator('#datacentreHost select[aria-label="Country"]');
    const foreign=await country.locator('option').evaluateAll(options=>options.find(o=>o.value&&o.textContent!=='United Kingdom').value);
    await country.selectOption(foreign);
    const foreignRows=await page.locator('#datacentreHost .ggdc-table tbody tr').count();
    assert.ok(foreignRows>0&&foreignRows<100,'foreign country filter yields a bounded visible subset');
    const foreignDownloadEvent=page.waitForEvent('download');
    await page.locator('#datacentreHost button.ggdc-download').click();
    const foreignDownload=await foreignDownloadEvent;
    const foreignCsvPath=resolve(OUT,`candidate-country-datacentres-${width}.csv`);
    await foreignDownload.saveAs(foreignCsvPath);
    assert.equal(parseCsv(readFileSync(foreignCsvPath,'utf8')).length,foreignRows+1,'country CSV matches displayed foreign leads');
    await page.locator('#contextDisclosure > summary').click();
    await page.waitForFunction(()=>document.querySelector('#contextHost [data-transition-context-root]')?.dataset.state==='available');
    assert.equal(await page.locator('#contextHost [data-context-id]').count(),14);
    assert.equal(await page.locator('#contextHost [data-figure-claim]').count(),3);
    assert.deepEqual(await page.locator('#contextHost').evaluate(host=>[...host.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()).map(n=>n.textContent)),[],'successful Context mount removes unavailable placeholder');
    await activate(page,'solarTab');assert.equal(await page.locator('#tbody').isVisible(),true,'return from optional modules preserves canonical table');
    assert.deepEqual(failures,[],'uncaught browser JavaScript errors');
    pass(`integrated frame, keyboard tabs, search, CSV, original MAP, offline source states and optional hosts at ${width}`,{geometry,headline_state:sourceState});
    await context.close();
  }
  const bad=await openPage(browser,393,CANDIDATE,true);
  await activate(bad.page,'datacentreTab');
  await bad.page.waitForFunction(()=>/unavailable/i.test(document.getElementById('datacentreHost')?.innerText||''));
  assert.equal(await bad.page.locator('#datacentreHost .ggdc-table tbody tr').count(),0,'integrated corrupted source clears DC rows');
  await activate(bad.page,'solarTab');await allRows(bad.page);
  await bad.page.screenshot({path:resolve(OUT,'preview-after-dc-integrity-failure-393.png')});
  await bad.context.close();pass('Data Centre corrupted served bytes fail closed while canonical REPD remains usable');
  for (const scenario of ['context-manifest','context-data']) {
    const missing=await openPage(browser,393,CANDIDATE,scenario);
    await missing.page.locator('#contextDisclosure > summary').click();
    await missing.page.waitForFunction(()=>/Context unavailable/.test(document.getElementById('contextHost')?.textContent||''));
    assert.equal(await missing.page.locator('#contextHost [data-context-id], #contextHost [data-figure-claim]').count(),0);
    await allRows(missing.page);
    await missing.context.close();
    pass(scenario+' fails closed without context figures or REPD regression');
  }
  receipt.status='PASS';
} catch(error) {receipt.status='FAIL';receipt.failure=error.stack||String(error);throw error;}
finally {
  receipt.blocked_external=[...new Set(receipt.blocked_external)];
  writeFileSync(resolve(OUT,'browser.json'),JSON.stringify(receipt,null,2)+'\n');
  if(browser)await browser.close();await new Promise(r=>server.close(r));
}
