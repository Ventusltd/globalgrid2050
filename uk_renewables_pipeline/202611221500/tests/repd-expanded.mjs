// V9.66: same DOM dashboard/table, all-column fullscreen, original A4 and normal restoration.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
await mkdir('/tmp/pn-v966-operator-actions',{recursive:true});
for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await driver.launch({headless:true});
 try{
  for(const vp of [{label:'portrait',width:393,height:852},{label:'landscape',width:852,height:393}]){
   const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.goto('http://127.0.0.1:8765/uk_renewables_pipeline/202611221500/',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50 &&
      document.querySelectorAll('#tbody .pn-report-launch').length===50 &&
      !!document.getElementById('pnLiquidLaunch'),null,{timeout:90000});
    const originals=await page.evaluate(()=>{window.__originalREPD={
      root:document.getElementById('officialRegister'),
      table:document.querySelector('#repdScroll table'),
      gauges:[...document.querySelectorAll('#repdPanel .hud-gauges canvas')]
    };return window.__originalREPD.gauges.length;});
    assert.equal(originals,3);
    // The original gauges are the persistent REPD cockpit, also in the normal dashboard.
    assert.equal(await page.locator('#repdPanel > .hud-gauges').evaluate(
      el=>getComputedStyle(el).position),'sticky');
    const normalPin=await page.evaluate(()=>{
      const g=document.querySelector('#repdPanel > .hud-gauges');
      const panel=document.getElementById('repdPanel');
      const initialY=window.scrollY;
      const panelTop=window.scrollY+panel.getBoundingClientRect().top;
      window.scrollTo(0,panelTop+420);
      return {initialY,scrollY:window.scrollY};
    });
    await page.waitForTimeout(80);
    const normalGauge=await page.locator('#repdPanel > .hud-gauges').boundingBox();
    assert.ok(normalGauge.y>=-3&&normalGauge.y<80,
      'Real cockpit must remain visible over normal REPD scrolling: '+JSON.stringify({normalPin,normalGauge}));
    await page.evaluate(()=>window.scrollTo(0,0));
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
        rowHeight:document.querySelector('#tbody tr[id^="repd-"]').getBoundingClientRect().height,
        gaugeOverflow:Math.max(...[...document.querySelectorAll('#repdPanel>.hud-gauges>.card')]
          .map(card=>Math.max(0,card.querySelector('canvas').getBoundingClientRect().bottom-
            card.getBoundingClientRect().bottom))),
        headCount:document.querySelectorAll('#repdScroll thead th').length};
    });
    assert.ok(info.sameRoot&&info.sameTable&&info.sameGauges,JSON.stringify(info));
    assert.equal(info.headCount,13);assert.ok(info.width<=54,JSON.stringify(info));
    // The original row still has all 13 REPD fields, but Notes and MAP are
    // visually hidden in this mode and their working actions live in Operator.
    const controls=await page.evaluate(()=>{
      const row=document.querySelector('#tbody tr[id^="repd-"]');
      const td=row.cells[3],actions=td.querySelector('.project-actions');
      const noteTh=document.querySelector('#repdScroll thead th:nth-child(12)');
      const mapTh=document.querySelector('#repdScroll thead th:nth-child(13)');
      const b=td.getBoundingClientRect();
      const link=actions?.querySelector('.pn-journey-link');
      const a4=actions?.querySelector('.pn-report-launch');
      const inside=e=>{if(!e)return true;const r=e.getBoundingClientRect();
        return r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1;};
      return {note:getComputedStyle(noteTh).display,map:getComputedStyle(mapTh).display,
        actions:!!actions,mapLink:!!link,a4:!!a4,mapInside:inside(link),a4Inside:inside(a4),
        width:b.width,shade:getComputedStyle(document.querySelector('#pnExpandedHost .pn-expanded-top strong')).color,
        originalInMapCell:!!row.cells[12].querySelector('.project-actions')};
    });
    assert.equal(controls.note,'none');assert.equal(controls.map,'none');
    assert.ok(controls.actions&&controls.a4&&!controls.originalInMapCell,JSON.stringify(controls));
    assert.ok(controls.mapInside&&controls.a4Inside,JSON.stringify(controls));
    assert.equal(controls.shade,'rgb(255, 51, 51)');
    assert.ok(controls.width<=54,JSON.stringify(controls));
    const gaugesBefore=await page.locator('#pnExpandedHost #repdPanel > .hud-gauges').boundingBox();
    await page.locator('#pnExpandedHost #repdScroll').evaluate(el=>{el.scrollTop=600;});
    await page.waitForTimeout(60);
    const gaugesAfter=await page.locator('#pnExpandedHost #repdPanel > .hud-gauges').boundingBox();
    assert.ok(Math.abs(gaugesBefore.y-gaugesAfter.y)<=3,
      'Expanded REPD table scroll must not displace the cockpit: '+
      JSON.stringify({gaugesBefore,gaugesAfter}));
    assert.ok(info.scrollWidth>info.clientWidth,JSON.stringify(info));
    assert.notEqual(info.firstPosition,'sticky',JSON.stringify(info));
    assert.ok(info.rowHeight<=67,'Expanded rows must stay compact: '+JSON.stringify(info));
    assert.ok(info.gaugeOverflow<=4,'Speedometer canvas must stay in card: '+JSON.stringify(info));
    // Save real full-screen evidence before exiting the native table.
    await page.screenshot({path:'/tmp/pn-v966-operator-actions/'+engine+'-'+vp.label+'-expanded.png'});
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
    assert.ok(await first.locator('td:nth-child(4) .project-actions .pn-report-launch').count()===1);
    assert.equal(await first.locator('td:nth-child(13) .project-actions').count(),0);
    const workingMap=page.locator('#tbody td:nth-child(4) a.pn-journey-link').first();
    assert.ok(await workingMap.count()===1,'At least one direct operator MAP action must exist');
    const actualMapHref=await workingMap.getAttribute('href');
    assert.ok(actualMapHref.startsWith('https://ventusltd.github.io/gridatlas/atlas/'),
      'Operator MAP must keep the actual GridAtlas journey URL');
    // Prove the relocated MAP element receives a real pointer click.
    // Prevent external navigation only inside this browser acceptance test.
    await page.evaluate(()=>{
      window.__operatorMapClicked=false;
      document.addEventListener('click',event=>{
        if(event.target.closest('.pn-expanded-actions .pn-journey-link')){
          event.preventDefault();
          window.__operatorMapClicked=true;
        }
      },{once:true});
    });
    await workingMap.click();
    assert.ok(await page.evaluate(()=>window.__operatorMapClicked),
      'Operator MAP click did not reach original live link');
    await first.locator('td:nth-child(4) .pn-report-launch').click();
    await page.waitForSelector('#pnRepdReport:not([hidden])');
    assert.equal(await page.locator('[data-report-action="pdf"]').count(),1);
    await page.locator('[data-report-action="close"]').click();
    await page.locator('#pnExpandedClose').click();
    assert.ok(await page.locator('#pnExpandedHost').isHidden());
    assert.equal(await page.locator('#tbody tr[id^="repd-"]').count(),50);
    assert.ok(await page.locator('#tbody tr[id^="repd-"] td:last-child .project-actions').count()===50,
      'Normal view must restore all MAP/A4 actions to their original column');
    assert.ok(await page.locator('#tbody tr[id^="repd-"] td:nth-child(4) .pn-expanded-actions').count()===0,
      'Expanded mode must not leak into normal dashboard');
    assert.ok(await page.evaluate(()=>document.getElementById('officialRegister').closest('main')!==null));
    assert.ok(await page.evaluate(()=>document.getElementById('tech').closest('.compact-register-filters')!==null));
    // Full-screen news reading is the intentional exception to the cockpit.
    if(await page.locator('#pnNewsMaximise').count()){
      await page.locator('#pnNewsMaximise').click();
      await page.waitForFunction(()=>document.documentElement.classList.contains('pn-news-max-open'));
      assert.equal(await page.locator('#repdPanel > .hud-gauges').evaluate(
        el=>getComputedStyle(el).visibility),'hidden');
      await page.locator('#pnNewsMaximise').click();
      assert.ok(!(await page.evaluate(()=>document.documentElement.classList.contains('pn-news-max-open'))));
    }
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'/tmp/pn-v966-operator-actions/'+engine+'-'+vp.label+'.png'});
    console.log('PASS native expanded REPD',engine,vp.label,JSON.stringify(info));
   }finally{await page.close();}
  }
 }finally{await browser.close();}
}
