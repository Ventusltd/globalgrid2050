// V9.68 regression: landscape-only, focused native table, original actions.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:8765/uk_renewables_pipeline/202611221705/';
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852},hasTouch:true,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
      await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
      await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50&&
        document.querySelectorAll('#tbody .pn-report-launch').length===50,{timeout:90000});
      assert.equal(await page.locator('#repdPanel>.hud-gauges canvas').count(),3);
      const normal=await page.evaluate(()=>{
        const header=document.querySelector('#repdScroll thead th');
        return {colour:getComputedStyle(header).color,
          hidden:[5,8,12].map(i=>getComputedStyle(document.querySelector('#repdScroll thead th:nth-child('+i+')')).display)};
      });
      assert.ok(normal.hidden.every(v=>v!=='none'));
      await page.locator('#pnLiquidLaunch').click();
      assert.ok(await page.locator('#pnLandscapeGate').isVisible(),'Portrait should request landscape');
      assert.ok(await page.locator('#pnExpandedHost').isHidden(),'No cramped portrait table');
      await page.setViewportSize({width:852,height:393});
      await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===100&&
        !document.getElementById('pnExpandedHost').hidden,{timeout:20000});
      const layout=await page.evaluate(()=>{
        const head=[...document.querySelectorAll('#repdScroll thead th')];
        const row=document.querySelector('#tbody tr[id^="repd-"]');
        const wrap=document.querySelector('#repdScroll');
        return {
          count:head.filter(h=>getComputedStyle(h).display!=='none').length,
          hidden:[4,7,11].map(i=>getComputedStyle(head[i]).display),
          colour:getComputedStyle(head[0]).color,
          gauges:getComputedStyle(document.querySelector('#repdPanel>.hud-gauges')).display,
          tech:getComputedStyle(document.querySelector('#repdPanel>#tech')).display,
          width:wrap.scrollWidth,viewport:wrap.clientWidth,scale:Number(wrap.dataset.zoom),
          buttons:!!row.cells[12].querySelector('.pn-journey-link')&&!!row.cells[12].querySelector('.pn-report-launch'),
          operatorActions:row.cells[3].querySelectorAll('.project-actions').length,
          extraFilters:document.querySelectorAll('.pn-expanded-column-filter').length
        };
      });
      assert.equal(layout.count,10,JSON.stringify(layout));
      assert.deepEqual(layout.hidden,['none','none','none']);
      assert.equal(layout.colour,normal.colour,'Retain exact normal cyan header colour');
      assert.equal(layout.gauges,'none');assert.equal(layout.tech,'none');
      assert.ok(layout.width>layout.viewport,'Native-size table must scroll horizontally');
      assert.equal(layout.scale,1);assert.ok(layout.buttons&&!layout.operatorActions);
      assert.equal(layout.extraFilters,0);
      await page.locator('#repdScroll [data-column-sort="capacity"]').click();
      await page.waitForFunction(()=>new URLSearchParams(location.search).get('sort')==='capacity_asc',{timeout:15000});
      const map=page.locator('#tbody tr[id^="repd-"] td:nth-child(13) .pn-journey-link').first();
      await map.evaluate(el=>el.addEventListener('click',e=>{e.preventDefault();window.__testMapClicked=true},{once:true}));
      await map.click();assert.equal(await page.evaluate(()=>window.__testMapClicked),true);
      await page.locator('#tbody tr[id^="repd-"] td:nth-child(13) .pn-report-launch').first().click();
      await page.waitForSelector('#pnRepdReport:not([hidden])',{timeout:15000});
      assert.equal(await page.locator('[data-report-action="pdf"]').count(),1);
      await page.locator('[data-report-action="close"]').click();
      await page.setViewportSize({width:393,height:852});
      assert.ok(await page.locator('#pnLandscapeGate').isVisible(),'Rotation back shields expanded table');
      await page.locator('#pnLandscapeCancel').click();
      assert.ok(await page.locator('#pnExpandedHost').isHidden());
      assert.equal(await page.locator('#tbody tr[id^="repd-"]').count(),50);
      assert.ok(await page.locator('#repdPanel>.hud-gauges').isVisible(),'Normal cockpit restored');
      assert.ok(await page.evaluate(()=>document.getElementById('tech').closest('.compact-register-filters')!==null),'Normal technology controls restored');
      assert.deepEqual(errors,[]);
      console.log('PASS V9.68',name,JSON.stringify(layout));
    }finally{await page.close()}
  }finally{await browser.close()}
}
