// Genuine installed Chrome against the existing 7,775-row page; no release edits.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium} from '../../acquisition/browser/node_modules/playwright/index.mjs';
import {createTestServer} from '../../acquisition/browser/server.mjs';
const artifact=process.env.PRIORITY_REVIEW_DIR||'tmp/prospecting-v927';
const priority=await readFile(resolve(artifact,'priority.json'));
const manifest=await readFile(resolve(artifact,'manifest.json'));
const spec=JSON.parse(manifest),raw=JSON.parse(priority),ranked=raw.records[0].id;
const unranked=spec.inventory.official_ids.find(id=>!raw.records.some(r=>r.id===id));
const pin=createHash('sha256').update(manifest).digest('hex');
const server=createTestServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
const screenshots=resolve('tmp/prospecting-register-browser');await mkdir(screenshots,{recursive:true});
let browser;const checks=[];
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [375,768,1440]){
    const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    // External source health is independent; retain the page's honest saved/unavailable labels.
    await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    await page.goto(origin+'/uk_renewables_pipeline/202611161630/');
    await page.addStyleTag({url:origin+'/automation/news/prospecting-ui/inline.css'});
    await page.waitForFunction(()=>document.querySelector('#tbody')?.dataset.complete==='true');
    assert.match(await page.locator('#resultsMeta').innerText(),/7,775/);
    await page.evaluate(async({priority,manifest,pin})=>{
      const {parsePriorityBundle}=await import('/automation/news/prospecting-ui/bundle.mjs');
      window.priorityTestBundle=await parsePriorityBundle(new TextEncoder().encode(priority),new TextEncoder().encode(manifest),pin);
    },{priority:priority.toString(),manifest:manifest.toString(),pin});
    for(const [identity,expected] of [[ranked,'ranked'],[unranked,'unranked']]){
      const ref=identity.slice(5);await page.locator('#search').fill(ref);
      const row=page.locator('#repd-'+ref),record=row.locator('.project-record');
      const before=await row.locator('a.atlaslink').getAttribute('href');
      await page.evaluate(async({ref,identity})=>{const {attachProjectPriority}=await import('/automation/news/prospecting-ui/bundle.mjs');const host=document.querySelector('#repd-'+ref+' .project-record');attachProjectPriority(host,identity,window.priorityTestBundle);attachProjectPriority(host,identity,window.priorityTestBundle);},{ref,identity});
      await record.locator(':scope > summary').click();
      if(expected==='ranked'){
        assert.equal(await record.locator('[data-priority-id]').count(),1);
        await record.locator('[data-priority-id] > summary').click();
        assert.match(await record.innerText(),/Momentum: unknown/);
        await record.screenshot({path:resolve(screenshots,`record-${width}.png`)});
      }else assert.equal(await record.locator('[data-priority-state]').innerText(),'Outside this research-priority subset');
      assert.equal(await row.locator('a.atlaslink').getAttribute('href'),before);
    }
    const identityCheck=await page.evaluate(async({unranked,ranked})=>{const {attachProjectPriority}=await import('/automation/news/prospecting-ui/bundle.mjs');const host=document.querySelector('#repd-'+unranked.slice(5)+' .project-record');try{attachProjectPriority(host,ranked,window.priorityTestBundle);return false;}catch{return true;}},{unranked,ranked});
    assert.equal(identityCheck,true);
    await page.evaluate(async({unranked})=>{const {attachProjectPriority}=await import('/automation/news/prospecting-ui/bundle.mjs');const host=document.querySelector('#repd-'+unranked.slice(5)+' .project-record');attachProjectPriority(host,unranked,null);},{unranked});
    assert.equal(await page.locator('#repd-'+unranked.slice(5)+' [data-priority-state]').innerText(),'Research priority unavailable');
    await page.locator('#clearFilters').click();
    const downloadPromise=page.waitForEvent('download');await page.locator('#exportInline').click();const download=await downloadPromise;
    assert.equal((await readFile(await download.path(),'utf8')).trim().split(/\r?\n/).length,7776);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);checks.push({width,official_rows:7775,csv_rows:7775,identity_guard:true});await page.close();
  }
  console.log(JSON.stringify({browser:'installed Google Chrome',version:browser.version(),checks,native_android:false,live_source_health_tested:false}));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
