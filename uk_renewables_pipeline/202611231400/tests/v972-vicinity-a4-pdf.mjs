// V9.72: end-to-end REPD identity / normal MAP / A4 HTML / PDF / expanded MAP parity.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {reportData} from '../report-model.mjs';
import {buildA4Pdf} from '../report-pdf.mjs';
const atlas='https://ventusltd.github.io/gridatlas/atlas/';
const app='http://127.0.0.1:8765/uk_renewables_pipeline/202611222222/';
const testProject={repd_ref:'12588',technology:'solar',name:'Cowley pilot',operator:'Test operator'};
const projectMap=atlas+'?repd_ref=12588&latitude=51.75&longitude=-1.19&journey=vicinity';
const unit=reportData(testProject,projectMap);
assert.equal(unit.mapUrl,projectMap,'Report retains exact project URL');
assert.equal(reportData(testProject,atlas+'?repd_ref=123&latitude=51.75&longitude=-1.19').mapUrl,'','Reject different REPD identity');
assert.equal(reportData(testProject,'https://example.org/?repd_ref=12588').mapUrl,'','Reject unrelated origins');
assert.ok(Buffer.from(buildA4Pdf(unit)).toString('latin1').includes('/URI ('+projectMap+')'),'PDF contains real URI annotation');
const pdfLiteral=url=>url.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
async function compareA4AndPdf(page, rowSelector, expected){
  const row=page.locator(rowSelector).first();
  await row.locator('td:last-child .pn-report-launch').click();
  await page.locator('#pnRepdReport:not([hidden])').waitFor({timeout:15000});
  const reportHref=await page.locator('#pnReportMap').getAttribute('href');
  assert.equal(reportHref,expected,'A4 HTML MAP must equal row MAP');
  assert.equal(await page.locator('#pnReportMap').isVisible(),true,'A4 MAP action must remain visible');
  const down=page.waitForEvent('download',{timeout:15000});
  await page.locator('[data-report-action="pdf"]').click();
  const download=await down;
  assert.ok(download.suggestedFilename().endsWith('.pdf'));
  const content=(await readFile(await download.path())).toString('latin1');
  assert.ok(content.startsWith('%PDF-1.4'),'Download must be PDF');
  const uri='/URI ('+pdfLiteral(expected)+')';
  assert.ok(content.includes(uri),'PDF /URI differs from native MAP: '+content.match(/\/URI \(.{0,250}/)?.[0]);
  assert.equal((content.match(/\/URI \(/g)||[]).length,1,'Exactly one outbound PDF MAP URI');
  await page.locator('[data-report-action="close"]').click();
}
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const vp of [{name:'portrait',width:393,height:852},{name:'landscape',width:852,height:393}]){
   const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},isMobile:true,hasTouch:true,acceptDownloads:true,reducedMotion:'reduce'});
   const page=await context.newPage(), errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('https://raw.githubusercontent.com/**',r=>r.abort());
   await context.route(atlas+'**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>GridAtlas test receiver</title>'}));
   try{
    await page.goto(app,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50
      &&document.querySelector('#tbody .pn-journey-link.atlaslink[href]')
      &&document.querySelector('#tbody .pn-report-launch'),{timeout:90000});
    const first='#tbody tr[id^="repd-"]';
    const row=page.locator(first).first();
    const native=await row.locator('td:last-child .pn-journey-link.atlaslink[href]').getAttribute('href');
    const ref=await row.getAttribute('id');
    assert.equal(new URL(native).origin+new URL(native).pathname,atlas);
    assert.equal(new URL(native).searchParams.get('repd_ref'),ref.slice(5));
    // Distractor link previously won the A4 first-visible-link heuristic.
    await row.evaluate(el=>{
      const other=document.createElement('a');other.href='https://example.org/unrelated';
      other.textContent='OTHER';other.className='irrelevant-action';
      el.querySelector('td:last-child').prepend(other);
    });
    await compareA4AndPdf(page,first,native);
    await page.locator('#pnLiquidLaunch').click();
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===100
      &&document.querySelector('#pnExpandedHost #tbody .pn-expanded-map-launch'),{timeout:30000});
    const expanded='#pnExpandedHost #tbody tr[id^="repd-"]';
    const expandedRow=page.locator(expanded).first();
    const expandedMap=await expandedRow.locator('.pn-expanded-map-cell .pn-expanded-map-launch').getAttribute('href');
    const expandedRef=await expandedRow.getAttribute('id');
    const expandedNative=await expandedRow.locator('td:last-child .pn-journey-link.atlaslink[href]').getAttribute('href');
    assert.equal(expandedMap,expandedNative,'Expanded MAP inherits native project map');
    assert.equal(new URL(expandedMap).searchParams.get('repd_ref'),expandedRef.slice(5));
    await compareA4AndPdf(page,expanded,expandedMap);
    // Actual click navigation, not only event propagation: native target is same tab on touch.
    const link=expandedRow.locator('.pn-expanded-map-cell .pn-expanded-map-launch');
    await Promise.all([page.waitForURL(u=>u.href===expandedMap,{timeout:15000}),link.click()]);
    assert.equal(page.url(),expandedMap,'Expanded MAP must navigate to canonical receiver');
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log('PASS V9.72 MAP/A4/PDF parity',engineName,vp.name,expandedRef);
   } finally{await context.close();}
  }
 } finally{await browser.close();}
}
