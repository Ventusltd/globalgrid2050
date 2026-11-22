// V9.67: same DOM dashboard/table, all-column fullscreen, original A4 and normal restoration.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
await mkdir('/tmp/pn-v967-all-columns',{recursive:true});
for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await driver.launch({headless:true});
 try{
  for(const vp of [{label:'portrait',width:393,height:852},{label:'landscape',width:852,height:393}]){
   const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},hasTouch:true,reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
    await page.goto('http://127.0.0.1:8765/uk_renewables_pipeline/202611221625/',{waitUntil:'domcontentloaded',timeout:60000});
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
    await page.evaluate(()=>{
      window.__normalColor=getComputedStyle(
        document.querySelector('#repdScroll thead th:first-child')).color;
    });
    await page.locator('#pnLiquidLaunch').click();
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===100);
    // Same 13 columns, presented as a fit-to-screen overview before pinch.
    await page.waitForFunction(()=>{
      const el=document.querySelector('#repdScroll');
      return !!el?.dataset.zoom&&el.querySelector('table').getBoundingClientRect().width<=el.clientWidth+5;
    },null,{timeout:15000});

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
    assert.equal(info.headCount,13);
    assert.ok(info.width>=110&&info.width<=120,JSON.stringify(info));
    // Actual source table has all 13 columns visibly available. Original
    // MAP/A4 controls are in their original far-right actions cell, not Operator.
    const columns=await page.evaluate(()=>{
      const row=document.querySelector('#tbody tr[id^="repd-"]');
      const header=[...document.querySelectorAll('#repdScroll thead th')];
      const normal=window.__normalColor;
      const actions=row.cells[12]?.querySelector('.project-actions');
      const map=actions?.querySelector('.pn-journey-link');
      const a4=actions?.querySelector('.pn-report-launch');
      const b=row.cells[12].getBoundingClientRect();
      const within=(el)=>{
        if(!el)return false;
        const r=el.getBoundingClientRect();
        return r.left>=b.left-1 && r.right<=b.right+1 &&
          r.top>=b.top-1 && r.bottom<=b.bottom+1;
      };
      return {visible:header.filter(h=>getComputedStyle(h).display!=='none').length,
        notes:getComputedStyle(header[11]).display,
        mapColumn:getComputedStyle(header[12]).display,
        map:!!map,a4:!!a4,mapWithin:within(map),a4Within:within(a4),
        operatorActions:row.cells[3].querySelectorAll('.project-actions').length,
        operatorWidth:row.cells[3].getBoundingClientRect().width,
        actionsWidth:b.width,
        expandedColour:getComputedStyle(header[0]).color,
        normalColour:normal};
    });
    assert.equal(columns.visible,13,JSON.stringify(columns));
    assert.notEqual(columns.notes,'none');assert.notEqual(columns.mapColumn,'none');
    assert.ok(columns.map&&columns.a4&&columns.mapWithin&&columns.a4Within,JSON.stringify(columns));
    assert.equal(columns.operatorActions,0,JSON.stringify(columns));
    assert.equal(columns.expandedColour,columns.normalColour,JSON.stringify(columns));
    const gaugesBefore=await page.locator('#pnExpandedHost #repdPanel > .hud-gauges').boundingBox();
    await page.locator('#pnExpandedHost #repdScroll').evaluate(el=>{el.scrollTop=600;});
    await page.waitForTimeout(60);
    const gaugesAfter=await page.locator('#pnExpandedHost #repdPanel > .hud-gauges').boundingBox();
    assert.ok(Math.abs(gaugesBefore.y-gaugesAfter.y)<=3,
      'Expanded REPD table scroll must not displace the cockpit: '+
      JSON.stringify({gaugesBefore,gaugesAfter}));
    assert.ok(info.scrollWidth<=info.clientWidth+5,
      'At initial fit zoom every REPD column must be in view: '+JSON.stringify(info));
    // Exercise a real two-finger pinch TouchEvent on the REPD viewport.
    const pinch=await page.evaluate(()=>{
      const el=document.getElementById('repdScroll');
      const before=Number(el.dataset.zoom);
      const rect=el.getBoundingClientRect();
      const midX=rect.left+rect.width/2,midY=rect.top+Math.min(150,rect.height/2);
      const touch=(id,x,y)=>new Touch({identifier:id,target:el,clientX:x,clientY:y,
        pageX:x,pageY:y,screenX:x,screenY:y});
      const start=[touch(1,midX-32,midY),touch(2,midX+32,midY)];
      const end=[touch(1,midX-156,midY),touch(2,midX+156,midY)];
      el.dispatchEvent(new TouchEvent('touchstart',{touches:start,targetTouches:start,
        changedTouches:start,bubbles:true,cancelable:true}));
      el.dispatchEvent(new TouchEvent('touchmove',{touches:end,targetTouches:end,
        changedTouches:end,bubbles:true,cancelable:true}));
      el.dispatchEvent(new TouchEvent('touchend',{touches:[],targetTouches:[],
        changedTouches:end,bubbles:true,cancelable:true}));
      return {before,after:Number(el.dataset.zoom),
        width:el.querySelector('table').getBoundingClientRect().width,
        viewport:el.clientWidth,scrollWidth:el.scrollWidth};
    });
    assert.ok(pinch.before>0&&pinch.before<.5,
      'Initial preview must fit all 13 columns on a phone: '+JSON.stringify(pinch));
    assert.ok(pinch.after>pinch.before*3,
      'Two-finger pinch must magnify the actual REPD table: '+JSON.stringify(pinch));
    assert.ok(pinch.scrollWidth>pinch.viewport,
      'At close zoom the user must have horizontal navigation: '+JSON.stringify(pinch));
    assert.notEqual(info.firstPosition,'sticky',JSON.stringify(info));
    assert.ok(info.rowHeight<=60,'Expanded rows must stay compact: '+JSON.stringify(info));
    assert.ok(info.gaugeOverflow<=4,'Speedometer canvas must stay in card: '+JSON.stringify(info));
    // Save real full-screen evidence before exiting the native table.
    await page.screenshot({path:'/tmp/pn-v967-all-columns/'+engine+'-'+vp.label+'-expanded.png'});
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
    assert.equal(await first.locator('td:nth-child(4) .project-actions').count(),0);
    assert.equal(await first.locator('td:nth-child(13) .project-actions .pn-report-launch').count(),1);
    const liveMap=page.locator('#tbody td:nth-child(13) .pn-journey-link').first();
    assert.ok(await liveMap.count()===1);
    await liveMap.evaluate(el=>{
      el.addEventListener('click',event=>{event.preventDefault();window.__mapClicked=true;},{once:true});
    });
    await liveMap.click();
    assert.equal(await page.evaluate(()=>window.__mapClicked),true);
    await first.locator('td:nth-child(13) .pn-report-launch').click();
    await page.waitForSelector('#pnRepdReport:not([hidden])');
    assert.equal(await page.locator('[data-report-action="pdf"]').count(),1);
    await page.locator('[data-report-action="close"]').click();
    await page.locator('#pnExpandedClose').click();
    assert.ok(await page.locator('#pnExpandedHost').isHidden());
    assert.equal(await page.locator('#repdScroll table').evaluate(el=>el.style.zoom),'',
      'Closing the preview must fully reset the original dashboard zoom');
    assert.equal(await page.locator('#tbody tr[id^="repd-"]').count(),50);
    assert.equal(await page.locator('#tbody tr[id^="repd-"] td:last-child .project-actions').count(),50,
      'Normal dashboard MAP/A4 column must be preserved');
    assert.equal(await page.locator('#tbody tr[id^="repd-"] td:nth-child(4) .project-actions').count(),0);
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
    await page.screenshot({path:'/tmp/pn-v967-all-columns/'+engine+'-'+vp.label+'.png'});
    console.log('PASS native expanded REPD',engine,vp.label,JSON.stringify(info));
   }finally{await page.close();}
  }
 }finally{await browser.close();}
}
