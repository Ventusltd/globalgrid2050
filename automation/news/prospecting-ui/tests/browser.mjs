// Isolated test server and installed Chrome; does not alter the release harness.
import {createServer} from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {resolve,sep,extname} from 'node:path';import assert from 'node:assert/strict';
import {chromium} from '../../acquisition/browser/node_modules/playwright/index.mjs';
import {fixture} from './fixture.mjs';
import {parseArtifact} from '../adapter.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(process.env.PRIORITY_SCREENSHOTS||'tmp/prospecting-ui-browser');await mkdir(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw new Error('path');const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;let passed=0;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [375,390,393,768,1440]){
    const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    assert.equal(await page.locator('[data-priority-id]').count(),0);
    assert.equal(await page.evaluate(()=>Boolean(document.querySelector('#news').compareDocumentPosition(document.querySelector('#pipeline'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
    await page.locator('#artifact').setInputFiles({name:'SYNTHETIC-TEST-ONLY.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture()))});
    await page.locator('[data-priority-id="REPD-1018"]').waitFor();
    await page.locator('[data-priority-id] > summary').click();
    assert.match(await page.locator('#reviewRows').innerText(),/Momentum: unknown/);
    assert.match(await page.locator('#reviewRows').innerText(),/Current financing: not assessed/);
    assert.equal(await page.locator('#reviewRows img').count(),0);
    assert.match(await page.locator('#reviewRows').innerText(),/<img src=x/);
    assert.equal(await page.locator('#reviewRows a').getAttribute('rel'),'noopener noreferrer');
    assert.equal(await page.evaluate(async()=>{const {attachPriority}=await import('./view.mjs');const {validateTriage}=await import('./adapter.mjs');const {fixture}=await import('./tests/fixture.mjs');const model=validateTriage(fixture());const host=document.createElement('div');attachPriority(host,model.records[0],model.as_of);attachPriority(host,model.records[0],model.as_of);return host.querySelectorAll('[data-priority-id]').length;}),1);
    await page.locator('#search').fill('no such site');assert.equal(await page.locator('[data-record-id]').count(),0);await page.locator('#search').fill('1018');assert.equal(await page.locator('[data-record-id]').count(),1);await page.locator('#search').fill('');
    await page.locator('#dcTab').click();await page.locator('[data-priority-id="DC-WD-Q123"] > summary').click();
    assert.match(await page.locator('#reviewRows').innerText(),/IT load: unknown/);assert.match(await page.locator('#reviewRows').innerText(),/Grid connection: unknown/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#pipeline').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(output,`priority-${width}.png`),fullPage:true});
    await page.locator('#dcTab').press('ArrowLeft');assert.equal(await page.locator('#ukTab').getAttribute('aria-selected'),'true');
    if(process.env.PRIORITY_REVIEW_ARTIFACT){
      const bytes=await readFile(process.env.PRIORITY_REVIEW_ARTIFACT),actual=await parseArtifact(bytes);
      await page.locator('#artifact').setInputFiles({name:'generated-local-review.json',mimeType:'application/json',buffer:bytes});
      await page.waitForFunction(()=>document.querySelector('#artifactStatus').textContent.includes('Review artifact validated'));
      await page.locator(actual.record_type_filter==='data_centre'?'#dcTab':'#ukTab').click();
      assert.equal(await page.locator('[data-record-id]').count(),actual.records.filter(r=>r.record_type===(actual.record_type_filter||'renewable_project')).length);
      await page.locator('[data-priority-id] > summary').first().click();await page.locator('#pipeline').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(output,`producer-review-${width}.png`)});
    }
    const broken=fixture();broken.source_policy.paywalled_channels='ALLOWED';await page.locator('#artifact').setInputFiles({name:'INVALID-TEST-ONLY.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(broken))});
    await page.waitForFunction(()=>document.querySelector('#artifactStatus').textContent.includes('validation failed'));assert.equal(await page.locator('[data-priority-id]').count(),0);assert.deepEqual(errors,[]);passed++;await page.close();
  }
  console.log(JSON.stringify({browser:'installed Google Chrome',version:browser.version(),viewport_checks:passed,widths:[375,390,393,768,1440],fixtures:'synthetic tests only',additional_producer_artifact:Boolean(process.env.PRIORITY_REVIEW_ARTIFACT),android_device:false}));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
