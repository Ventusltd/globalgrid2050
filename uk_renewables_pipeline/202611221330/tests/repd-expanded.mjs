// V9.65: same DOM dashboard/table, all-column fullscreen, original A4 and normal restoration.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
await mkdir('/tmp/pn-v965-native',{recursive:true});
for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await driver.launch({headless:true});
 try{
  for(const vp of [{label:'portrait',width:393,height:852},{label:'landscape',width:852,height:393}]){
   const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.goto('http://127.0.0.1:8765/uk_renewables_pipeline/202611221330/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50 &&
      document.querySelectorAll('#tbody .pn-report-launch').length===50 &&
      !!document.getElementById('pnLiquidLaunch'),null,{timeout:90000});
    const originals=await page.evaluate(()=>{window.__originalREPD={
      root:document.getElementById('officialRegister'),
      table:document.querySelector('#repdScroll table'),
      gauges:[...document.querySelectorAll('#repdPanel .hud-gauges canvas')]
    };return window.__originalREPD.gauges.length;});
    assert.equal(originals,3);
    await page.locator('#pnLiquidLaunch').click();
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===100);
    const info=await page.evaluate(()=>{
      const v=document.getElementById('repdScroll');
      const td=document.querySelector('#tbody tr[id^="repd-"]>td:nth-child(4)');
      return {sameRoot:window.__originalREPD.root===document.querySelector('#pnExpandedHost #officialRegister'),
        sameTable:window.__originalREPD.table===document.querySelector('#pnExpandedHost #repdScroll table'),
        sameGauges:window.__originalREPD.gauges.every(el=>el.closest('#pnExpandedHost')!==null),
        width:td.getBoundingClientRect().width,scrollWidth:v.scrollWidth,clientWidth:v.clientWidth,
        firstPosition:getComputedStyle(document.querySelector('#tbody tr[id^="repd-"]>td:first-child')).position,
        headCount:document.querySelectorAll('#repdScroll thead th').length};
    });
    assert.ok(info.sameRoot&&info.sameTable&&info.sameGauges,JSON.stringify(info));
    assert.equal(info.headCount,13);assert.ok(info.width<105,JSON.stringify(info));
    assert.ok(info.scrollWidth>info.clientWidth,JSON.stringify(info));
    assert.notEqual(info.firstPosition,'sticky',JSON.stringify(info));
    // Save real full-screen evidence before exiting the native table.
    await page.screenshot({path:'/tmp/pn-v965-native/'+engine+'-'+vp.label+'-expanded.png'});
    assert.equal(await page.locator('#pnExpandedHost .pn-expanded-column-filter').count(),9);
    const tech=page.locator('#pnExpandedHost #tech');
    for(const type of ['all','solar','bess','wind_onshore','wind_offshore'])
      assert.equal(await tech.locator('[data-technology="'+type+'"]').count(),1);
    await tech.locator('[data-technology="bess"]').click();
    await page.waitForFunction(()=>document.getElementById('tbody').dataset.total===''+
      document.querySelector('#resultsMeta').dataset.filteredCount);
    await tech.locator('[data-technology="all"]').click();
    await page.waitForFunction(()=>document.getElementById('tbody').dataset.total==='7775');
    await page.locator('[data-pn-expanded-filter="updated"]').click();
    assert.ok(await page.locator('#pnExpandedFilter select').isVisible());
    await page.locator('#pnExpandedHost #repdScroll thead [data-column-sort="capacity"]').click();
    await page.waitForFunction(()=>new URLSearchParams(location.search).get('sort')==='capacity_asc');
    assert.equal(await page.locator('#tbody tr[id^="repd-"]').count(),100);
    const first=page.locator('#tbody tr[id^="repd-"]').first();
    assert.ok(await first.locator('a.atlaslink, a.pn-journey-action, .pn-journey-action').count()>=1);
    await first.locator('.pn-report-launch').click();
    await page.waitForSelector('#pnRepdReport:not([hidden])');
    assert.equal(await page.locator('[data-report-action="pdf"]').count(),1);
    await page.locator('[data-report-action="close"]').click();
    await page.locator('#pnExpandedClose').click();
    assert.ok(await page.locator('#pnExpandedHost').isHidden());
    assert.equal(await page.locator('#tbody tr[id^="repd-"]').count(),50);
    assert.ok(await page.evaluate(()=>document.getElementById('officialRegister').closest('main')!==null));
    assert.ok(await page.evaluate(()=>document.getElementById('tech').closest('.compact-register-filters')!==null));
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'/tmp/pn-v965-native/'+engine+'-'+vp.label+'.png'});
    console.log('PASS native expanded REPD',engine,vp.label,JSON.stringify(info));
   }finally{await page.close();}
  }
 }finally{await browser.close();}
}
