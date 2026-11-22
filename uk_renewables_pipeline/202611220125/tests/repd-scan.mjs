// V9.62: Project/MW/MAP visible on first paint, status/year filters and full-table opt-in.
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {mkdir} from 'node:fs/promises';
const URL='http://127.0.0.1:8765/uk_renewables_pipeline/202611220125/';
const OUT='/tmp/pn-v962-scan';
await mkdir(OUT,{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const viewport of [{label:'portrait',width:393,height:852,visible:[1,2,13]},
                         {label:'landscape',width:852,height:393,visible:[1,2,3,4,13]}]){
   const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},reducedMotion:'reduce'});
   try{
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length>0,null,{timeout:90000});
    const sample=()=>page.evaluate(()=>{
      const wrap=document.getElementById('repdScroll'),row=document.querySelector('#tbody tr[id^="repd-"]');
      return {scan:wrap.classList.contains('pn-scan-mode'),
        columns:[...wrap.querySelectorAll('thead th')].flatMap((th,i)=>getComputedStyle(th).display==='none'?[]:[i+1]),
        horizontalScroll:wrap.scrollWidth>wrap.clientWidth+2,
        rowHeight:row.getBoundingClientRect().height,
        name:row.querySelector('.phone-project-label')?.textContent,
        mw:row.querySelector('td.mw')?.textContent,
        map:row.lastElementChild?.textContent,
        notesHidden:getComputedStyle(wrap.querySelector('thead th:nth-child(12)')).display==='none',
        gauges:document.querySelectorAll('#repdPanel>.hud-gauges canvas').length,
        count:document.querySelectorAll('#tbody tr[id^="repd-"]').length};
    });
    const baseline=await sample();
    assert.equal(baseline.scan,true);
    assert.deepEqual(baseline.columns,viewport.visible);
    assert.equal(baseline.notesHidden,true);
    assert.equal(baseline.gauges,3);
    assert.ok(baseline.rowHeight<50,JSON.stringify(baseline));
    assert.equal(baseline.horizontalScroll,false,JSON.stringify(baseline));
    assert.ok(baseline.name&&baseline.mw&&baseline.map,JSON.stringify(baseline));
    assert.ok(await page.locator('#tbody tr[id^="repd-"] td:last-child a.atlaslink').count()>0,'MAP action exists');
    await page.locator('#pnScanStatus').selectOption('Application Submitted');
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('status')==='Application Submitted');
    assert.equal(await page.locator('#pnScanStatus').inputValue(),'Application Submitted');
    await page.locator('#pnScanStatus').selectOption('All');
    await page.waitForFunction(()=>!new URL(location.href).searchParams.has('status'));
    const fast=page.locator('#pnScanDates select[data-year-filter="updatedYear"]');
    const options=await fast.locator('option').allTextContents();
    assert.ok(options.includes('Not supplied')&&options.length>2,JSON.stringify(options));
    await fast.selectOption('missing');
    await page.waitForFunction(()=>new URL(location.href).searchParams.get('updated_year')==='missing');
    assert.equal(await page.locator('#pnScanDateCount').textContent(),'1');
    await fast.selectOption('All');
    await page.waitForFunction(()=>!new URL(location.href).searchParams.has('updated_year'));
    await page.locator('#pnScanModeToggle').click();
    const full=await sample();
    assert.equal(full.scan,false);
    assert.ok(full.columns.length>=10,JSON.stringify(full));
    await page.locator('#pnScanModeToggle').click();
    const again=await sample();
    assert.equal(again.scan,true);
    assert.deepEqual(again.columns,baseline.columns);
    assert.equal(again.name,baseline.name);
    assert.equal(again.mw,baseline.mw);
    await page.screenshot({path:OUT+'/'+name+'-'+viewport.label+'.png'});
    console.log('PASS',name,viewport.label,JSON.stringify({baseline,fullColumns:full.columns.length,reset:again.scan}));
   } finally {await page.close();}
  }
 } finally {await browser.close();}
}
