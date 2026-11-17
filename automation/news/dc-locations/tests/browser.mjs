/* Actual original DC renderer + exact pinned address bytes. Receiver itself is tested separately over public HTTPS. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {INPUT} from '../actions.mjs';

const [productRoot,dataRoot,artifactRoot]=process.argv.slice(2);
assert(productRoot&&dataRoot&&artifactRoot,'Usage: browser.mjs <original-product-root> <data-grid-root> <artifacts>');
const {chromium,devices}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const local=path.dirname(fileURLToPath(import.meta.url));
const edition=path.join(productRoot,'uk_renewables_pipeline/202611161757/global-datacentres');
const readJson=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const bundle={projects:await readJson(path.join(edition,'projects.json')),
 official:await readJson(path.join(edition,'official-projects.json')),
 groups:await readJson(path.join(edition,'project-groups.json')),
 audit:await readJson(path.join(edition,'selection-audit.json')),
 baseline:await readJson(path.join(productRoot,'uk_renewables_pipeline/202611161747/global-datacentres/projects.json'))};
const raw=await fs.readFile(path.join(dataRoot,'datacentres/locations/data/20261117T002200Z/datacentre-locations.geojson'));
assert.equal(raw.length,INPUT.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),INPUT.sha256);
const locations=JSON.parse(raw),mapped=new Set(locations.features.filter(x=>x.geometry).map(x=>x.id));
const expectedUK=bundle.projects.records.filter(x=>['GB','UK'].includes(x.country.code)&&mapped.has(x.id)).length;
const resources=new Map([
 ['/model.js',[await fs.readFile(path.join(productRoot,'automation/news/datacentre-ui/model.js')),'text/javascript']],
 ['/view.js',[await fs.readFile(path.join(productRoot,'automation/news/datacentre-ui/view.js')),'text/javascript']],
 ['/component.css',[await fs.readFile(path.join(productRoot,'automation/news/datacentre-ui/styles.css')),'text/css']],
 ['/actions.mjs',[await fs.readFile(path.join(local,'../actions.mjs')),'text/javascript']],
 ['/actions.css',[await fs.readFile(path.join(local,'../actions.css')),'text/css']],
 ['/dataset',[raw,'application/json']]
]);
const html=Buffer.from('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/component.css"><link rel="stylesheet" href="/actions.css"><style>html,body{margin:0;background:#000;color:#fff;max-width:100%}main{padding:12px;min-width:0;box-sizing:border-box}</style><main id="host"></main><script src="/model.js"></script><script src="/view.js"></script>');
const server=createServer((req,res)=>{const [body,type]=resources.get(req.url)||[html,'text/html'];res.writeHead(200,{'Content-Type':type});res.end(body);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
await fs.mkdir(artifactRoot,{recursive:true});
const browser=await chromium.launch({headless:true});const proofs=[];
try {
 for(const [label,options] of [['android-portrait',{...devices['Pixel 7'],viewport:{width:390,height:844}}],['android-landscape',{...devices['Pixel 7'],viewport:{width:915,height:412}}],['desktop',{viewport:{width:1440,height:900}}]]){
  const context=await browser.newContext(options),page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.goto(base);
  await page.evaluate(async bundle=>{
   const host=document.querySelector('#host');window.original=window.GGDataCentreUI.render(host,bundle);
   window.runtime=await import('/actions.mjs');window.fetches=0;
   const options={transport:()=>{window.fetches++;return fetch('/dataset');}};
   const first=window.runtime.attachLocationActions(host,options),second=window.runtime.attachLocationActions(host,options);
   window.actions=await first;window.sameHandle=window.actions===await second;
  },bundle);
  assert.equal(await page.locator('.ggdc-screen-actions').count(),expectedUK);
  assert.equal(await page.locator('.ggdc-screen-footnote').count(),1);
  assert.deepEqual(await page.evaluate(()=>({fetches:window.fetches,same:window.sameHandle})),{fetches:1,same:true});
  await page.getByRole('button',{name:/^Global leads/}).click();
  await page.waitForFunction(n=>document.querySelectorAll('.ggdc-screen-actions').length===n,mapped.size);
  assert.equal(await page.locator('.ggdc-screen-footnote').count(),1);
  const unmapped=locations.features.filter(f=>!f.geometry).map(f=>f.id);
  const invalid=await page.evaluate(ids=>[...document.querySelectorAll('tbody tr')].filter(r=>ids.includes(r.querySelector('.ggdc-id')?.textContent.trim())&&r.querySelector('.ggdc-screen-actions')).length,unmapped);
  assert.equal(invalid,0);
  await page.getByRole('searchbox',{name:'Search Data Centre records'}).fill('CyrusOne LON1');
  await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===1&&document.querySelectorAll('.ggdc-screen-actions').length===1);
  assert.match(await page.locator('.ggdc-screen-location').innerText(),/Approx\. postcode: SL1 4QZ/);
  const href=await page.getByRole('link',{name:'Screen¹',exact:true}).getAttribute('href');
  const url=new URL(href);assert.equal(url.searchParams.get('longitude'),'-0.622812');assert.equal(url.searchParams.has('repd_ref'),false);
  await context.route('https://ventusltd.github.io/gridatlas/atlas/**',r=>r.fulfill({contentType:'text/html',body:'Navigation target captured; public receiver checked separately.'}));
  const [target]=await Promise.all([context.waitForEvent('page'),page.getByRole('link',{name:'Screen¹',exact:true}).click()]);
  await target.waitForLoadState('domcontentloaded');assert.equal(target.url(),href);await target.close();
  await page.evaluate(id=>{document.querySelector('tbody tr .ggdc-id').firstChild.data=id;},unmapped[0]);
  await page.waitForFunction(()=>document.querySelectorAll('.ggdc-screen-actions').length===0);
  assert.equal(await page.locator('.ggdc-screen-footnote').isVisible(),false);
  await page.evaluate(()=>{document.querySelector('tbody tr .ggdc-id').textContent='DC-WD-Q138394549';});
  await page.waitForFunction(()=>document.querySelectorAll('.ggdc-screen-actions').length===1);
  assert.equal(await page.getByRole('link',{name:'Screen¹',exact:true}).getAttribute('href'),href);
  const before=await page.locator('#host').innerHTML();
  await page.evaluate(async()=>{try{await window.runtime.loadLocations(()=>fetch('/dataset'),{...window.runtime.INPUT,sha256:'0'.repeat(64)});throw Error('Accepted wrong digest');}catch(e){if(!e.message.includes('digest'))throw e;}});
  assert.equal(await page.locator('#host').innerHTML(),before);
  await page.screenshot({path:path.join(artifactRoot,label+'.png'),fullPage:true});
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,notes:document.querySelectorAll('.ggdc-screen-footnote').length}));
  assert(dimensions.document<=dimensions.viewport+1,JSON.stringify(dimensions));assert.deepEqual(errors,[]);
  if(label==='android-portrait'){
   for(const viewport of [{width:915,height:412},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    assert.equal(await page.getByRole('searchbox',{name:'Search Data Centre records'}).inputValue(),'CyrusOne LON1');
    assert.equal(await page.locator('.ggdc-screen-actions').count(),1);
    assert.equal(await page.locator('.ggdc-screen-footnote').count(),1);
    const width=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
    assert(width.document<=width.viewport+1,JSON.stringify(width));
   }
  }
  await page.evaluate(()=>window.actions.disconnect());assert.equal(await page.locator('.ggdc-screen-actions').count(),0);assert.equal(await page.locator('.ggdc-screen-footnote').count(),0);
  assert.equal(await page.getByText('No mapped coordinates',{exact:true}).isVisible(),true);
  proofs.push({label,expectedUK,totalMapped:mapped.size,dimensions,errors,screenHref:href,duplicateMount:'one fetch / one handle',corruptInput:'rejected / DOM unchanged',disconnect:'original source message restored'});
  await context.close();
 }
 await fs.writeFile(path.join(artifactRoot,'browser.json'),JSON.stringify(proofs,null,2));console.log(JSON.stringify(proofs));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
