import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'../..'), edition='uk_renewables_pipeline/202611171141';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const manifest=JSON.parse(readFileSync(resolve(root,edition,'data/v9.1/build_manifest.json')));
const rows=manifest.project_partitions.flatMap(p=>JSON.parse(readFileSync(resolve(root,edition,p.path))).projects);
const fixture=JSON.parse(readFileSync(resolve(root,'uk_renewables_pipeline/202611132345/fixtures/2026q3/project_identity_2026q3.json')));
const source=new Map(fixture.records.map(r=>[r.repd_ref,r]));
for(const row of rows) for(const key of ['planning_application_submitted','repd_record_updated']) assert.equal(row[key],source.get(row.repd_ref)[key],row.repd_ref+' '+key);
const cases=[rows.find(r=>r.planning_application_submitted&&r.planning_application_submitted!==r.repd_record_updated),rows.find(r=>!r.planning_application_submitted)];
assert.ok(cases.every(Boolean));
const server=createServer((req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));assert.ok(file.startsWith(root));const bytes=readFileSync(file);res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'})[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port, out=resolve(process.env.V934_OUT||'D:/githubfiles/.qa-artifacts/v934-agent-a');mkdirSync(out,{recursive:true});
let browser;
const proof={edition,checks:[],canonical_rows:rows.length,source_dates_equal:true,submitted:rows.filter(r=>r.planning_application_submitted).length,missing:rows.filter(r=>!r.planning_application_submitted).length,limitations:['Local Chromium with external network blocked; no deployed or physical handset certification.']};
const display=v=>v?v.split('-').reverse().join('/'):'not supplied by REPD';
try{
 browser=await chromium.launch({headless:true});
 for(const width of [1440,393,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage();await page.goto(origin+'/'+edition+'/index.html?technology=all');await page.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)===7775);
  assert.equal(await page.locator('#planningSubmittedHeader').evaluate(n=>n.previousElementSibling.id),'repdUpdatedHeader');
  for(const project of cases){
   await page.locator('#search').fill(project.repd_ref);const row=page.locator('#repd-'+project.repd_ref);await row.waitFor();
   assert.equal(await row.getAttribute('data-planning-application-submitted'),project.planning_application_submitted||'');
   assert.equal(await row.locator('.planning-submitted').textContent(),display(project.planning_application_submitted));
   assert.equal(await row.locator('.planning-submitted').evaluate(n=>n.previousElementSibling.classList.contains('repd-updated')),true);
   await row.locator('summary').click();assert.match(await row.locator('.record-grid').innerText(),new RegExp(display(project.planning_application_submitted).replaceAll('/','\\/')));
   assert.match(await row.locator('.record-grid').innerText(),/PLANNING APPLICATION SUBMITTED/);
   const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const csv=readFileSync(await download.path(),'utf8');assert.ok(csv.includes('"Planning Application Submitted"'));assert.ok(csv.includes('"'+(project.planning_application_submitted||'')+'"'));
   proof.checks.push({width,ref:project.repd_ref,submitted:project.planning_application_submitted,status:'PASS'});
  }
  await page.locator('#clearFilters').click();
  for(const [field,prefix,yearId] of [['planning_application_submitted','submitted','submittedYear'],['repd_record_updated','updated','updatedYear']]){
   const yearSelect=page.locator('[data-year-filter="'+yearId+'"]').first();
   assert.deepEqual(await yearSelect.locator('option').evaluateAll(ns=>ns.slice(2).map(n=>n.value)),[...new Set(rows.map(r=>r[field]?.slice(0,4)).filter(Boolean))].sort().reverse());
   for(const direction of ['asc','desc']){
    await page.locator('#sortProjects').selectOption(prefix+'_'+direction);
    const sorted=[...rows].sort((a,b)=>!a[field]?(b[field]?1:0):!b[field]?-1:direction==='asc'?a[field].localeCompare(b[field]):b[field].localeCompare(a[field]));
    assert.equal(await page.locator('#tbody tr').first().getAttribute('id'),'repd-'+sorted[0].repd_ref);
    assert.equal(await page.locator(prefix==='updated'?'#repdUpdatedHeader':'#planningSubmittedHeader').getAttribute('aria-sort'),direction==='asc'?'ascending':'descending');
   }
   for(const year of ['2025','missing']){
    await yearSelect.selectOption(year);const expected=rows.filter(r=>year==='missing'?!r[field]:r[field]?.startsWith(year+'-'));
    assert.equal(await page.locator('#tbody').getAttribute('data-total'),String(expected.length));
    assert.equal(new URL(page.url()).searchParams.get(prefix+'_year'),year);
    const promise=page.waitForEvent('download');await page.locator('#export').click();const csv=readFileSync(await (await promise).path(),'utf8');assert.equal(csv.split('\r\n').length-1,expected.length);
    await page.reload();await page.waitForFunction(n=>Number(document.querySelector('#tbody')?.dataset.total)===n,expected.length);
    assert.equal(await yearSelect.inputValue(),year);
   }
   await yearSelect.selectOption('All');proof.checks.push({width,field,sort_both_directions:true,years_and_missing:true,url_restored:true,csv_count:true,status:'PASS'});
  }
  await page.locator('[data-year-filter="submittedYear"]').first().selectOption('2025');await page.locator('[data-year-filter="updatedYear"]').first().selectOption('2025');
  assert.equal(await page.locator('#tbody').getAttribute('data-total'),String(rows.filter(r=>r.planning_application_submitted?.startsWith('2025-')&&r.repd_record_updated?.startsWith('2025-')).length));
  await page.locator('#clearFilters').click();assert.equal(await page.locator('#tbody').getAttribute('data-total'),'7775');
  if(width===1440){
   for(const prefix of ['submitted','updated']){
    const header=page.locator(prefix==='submitted'?'#planningSubmittedHeader':'#repdUpdatedHeader');await header.locator('summary').click();await header.locator('[data-date-sort="'+prefix+'_asc"]').click();assert.equal(await header.getAttribute('aria-sort'),'ascending');
    await header.locator('summary').click();await header.locator('select').selectOption('2025');assert.equal(await page.locator('[data-year-filter="'+(prefix==='submitted'?'submittedYear':'updatedYear')+'"]').first().inputValue(),'2025');await header.locator('summary').click();await page.locator('#clearFilters').click();
   }
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:resolve(out,'planning-'+width+'.png')});await context.close();
 }
 proof.status='PASS';
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));writeFileSync(resolve(out,'receipt.json'),JSON.stringify(proof,null,2));}
console.log(JSON.stringify(proof));
