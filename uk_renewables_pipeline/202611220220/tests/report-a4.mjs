import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {HA_TO_ACRES,areaFromEvidence,reportData} from '../report-model.mjs';
import {buildA4Pdf} from '../report-pdf.mjs';
const project={repd_ref:'123',name:'Example Solar',operator:'Operator A',capacity_mw:50,technology:'solar',
 country:'England',county:'County A',region:'South',status:'Application Submitted'};
const entry={repd_ref:'123',verified:true,area_kind:'development_area',value:100,unit:'ha',
 source_title:'Planning statement',source_url:'https://example.org/area'};
const source={schema:'globalgrid2050.repd-area-evidence.v1',records:{'123':entry}};
assert.ok(HA_TO_ACRES>2.47);
assert.equal(areaFromEvidence(project,{...source,records:{}}).display,'Area not reported');
assert.equal(areaFromEvidence(project,source).reported,true);
assert.match(areaFromEvidence(project,source).display,/100 ha/);
assert.match(areaFromEvidence(project,source).display,/247\.11 acres/);
assert.equal(areaFromEvidence(project,source).kind,'Development area');
assert.equal(areaFromEvidence(project,{...source,records:{'123':{...entry,verified:false}}}).reported,false);
assert.equal(areaFromEvidence(project,{...source,records:{'123':{...entry,repd_ref:'999'}}}).reported,false);
assert.equal(areaFromEvidence(project,{...source,records:{'123':{...entry,source_url:'javascript:alert(1)'}}}).reported,false);
assert.equal(areaFromEvidence(project,{...source,records:{'123':{...entry,unit:'acres',value:247.105381467}}}).reported,true);
const report=reportData(project,'https://ventusltd.github.io/gridatlas/atlas/?repd=123',source);
assert.equal(report.operator,'Operator A');
assert.equal(report.developer,'Developer not separately reported');
assert.ok(Buffer.from(buildA4Pdf(report)).toString('latin1').includes('/Subtype /Link'));
assert.ok(Buffer.from(buildA4Pdf(report,{landscape:true})).toString('latin1').includes('/MediaBox [0 0 841.89 595.28]'));
const missing=reportData(project,'',{...source,records:{}});
assert.equal(missing.area.display,'Area not reported');
assert.ok(!Buffer.from(buildA4Pdf(missing)).toString('latin1').includes('/Subtype /Link'));
console.log('PASS area authenticity, land-take distinction, conversion, PDF link structure');

const out='/tmp/pn-v963-report',url='http://127.0.0.1:8765/uk_renewables_pipeline/202611220220/';
await mkdir(out,{recursive:true});
for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await driver.launch({headless:true});
 try{
  for(const viewport of [{name:'portrait',width:393,height:852},{name:'landscape',width:852,height:393}]){
   const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},acceptDownloads:true,reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50&&
      document.querySelectorAll('#tbody .pn-report-launch').length===50,null,{timeout:90000});
    const row=page.locator('#tbody tr[id^="repd-"]').first();
    const expected={
      name:await row.locator('.record-grid > div:first-child span').textContent(),
      operator:(await row.locator('td:nth-child(4)').textContent()).trim(),
      mw:await row.locator('td.mw').textContent(),
      map:await row.evaluate(el=>{const links=[...el.querySelectorAll('td:last-child a[href]')];
        const selected=links.find(a=>getComputedStyle(a).display!=='none'&&getComputedStyle(a).visibility!=='hidden'&&a.href.startsWith('https://'))||el.querySelector('td:last-child a.atlaslink[href]');
        return selected?.getAttribute('href')||'';}),
    };
    const prior=await page.evaluate(()=>({url:location.href,x:document.getElementById('repdScroll').scrollLeft,
      n:document.querySelectorAll('#tbody tr[id^="repd-"]').length}));
    await row.locator('button[data-pn-a4]').click();
    await page.waitForSelector('#pnRepdReport:not([hidden])');
    assert.equal(await page.locator('#pnReportName').textContent(),expected.name);
    assert.equal(await page.locator('#pnReportOperator').textContent(),expected.operator||'Operator not reported');
    assert.ok((await page.locator('#pnReportCapacity').textContent()).startsWith(expected.mw.trim().split(' ')[0]));
    assert.equal(await page.locator('#pnReportArea').textContent(),'Area not reported');
    assert.equal(await page.locator('#pnReportMap').getAttribute('href'),expected.map);
    assert.ok(await page.locator('#pnReportSheet').isVisible());
    await page.locator('[data-report-action="plus"]').click();
    await page.locator('[data-report-action="fitwidth"]').click();
    const received=page.waitForEvent('download');
    await page.locator('[data-report-action="pdf"]').click();
    const download=await received;
    await download.saveAs(out+'/'+engine+'-'+viewport.name+'-a4.pdf');
    assert.match(download.suggestedFilename(),/REPD-.*A4-report\.pdf/);
    if(engine==='chromium'&&viewport.name==='portrait'){
      await page.emulateMedia({media:'print'});
      await writeFile(out+'/chromium-print-a4.pdf',await page.pdf({preferCSSPageSize:true,printBackground:true}));
      await page.emulateMedia({media:'screen'});
    }
    await page.locator('[data-report-action="rotate"]').click();
    assert.equal(await page.locator('#pnReportSheet').evaluate(el=>el.classList.contains('pn-report-landscape')),true);
    const landscapeDownload=page.waitForEvent('download');
    await page.locator('[data-report-action="pdf"]').click();
    await (await landscapeDownload).saveAs(out+'/'+engine+'-'+viewport.name+'-landscape.pdf');
    await page.screenshot({path:out+'/'+engine+'-'+viewport.name+'.png'});
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#pnRepdReport').isHidden());
    const after=await page.evaluate(()=>({url:location.href,x:document.getElementById('repdScroll').scrollLeft,
      n:document.querySelectorAll('#tbody tr[id^="repd-"]').length}));
    assert.deepEqual(after,prior);assert.deepEqual(errors,[]);
    console.log('PASS',engine,viewport.name,expected.name,'MAP and A4 link preserved');
   }finally{await page.close()}
  }
 }finally{await browser.close()}
}
