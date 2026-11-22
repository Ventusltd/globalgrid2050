// V9.69 — full-height portrait/landscape, MAP second, A4 last, normal intact.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const url='http://127.0.0.1:8765/uk_renewables_pipeline/202611221900/';
for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    for(const vp of [{name:'portrait',width:393,height:852},{name:'landscape',width:852,height:393}]){
      const page=await browser.newPage({viewport:{width:vp.width,height:vp.height},hasTouch:true,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',err=>errors.push(err.message));
      try{
        await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
        await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
        await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50 &&
          document.querySelectorAll('#tbody .pn-report-launch').length===50,{timeout:90000});
        const oldColour=await page.locator('#repdScroll thead th').first().evaluate(e=>getComputedStyle(e).color);
        await page.locator('#pnLiquidLaunch').click();
        await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===100 &&
          !!document.querySelector('#pnExpandedHost #repdScroll thead .pn-expanded-map-heading'),{timeout:20000});
        const v=await page.evaluate(()=>{
          const rows=[...document.querySelectorAll('#tbody tr[id^="repd-"]')];
          const h=[...document.querySelectorAll('#repdScroll thead th')];
          const row=rows.find(r=>r.cells[1]?.querySelector('a.pn-expanded-map-launch'));
          const actions=row?.cells[row.cells.length-1];
          const host=document.getElementById('pnExpandedHost'),wrap=document.getElementById('repdScroll');
          return {headCount:h.length,visible:h.filter(x=>getComputedStyle(x).display!=='none').length,
            heading:h[1]?.textContent,normalRows:rows.length,mapCount:rows.filter(r=>!!r.cells[1]?.querySelector('a.pn-expanded-map-launch')).length,
            colour:getComputedStyle(h[0]).color,hostVisible:!host.hidden,
            topBar:getComputedStyle(document.querySelector('#pnExpandedHost .pn-expanded-top')).position,
            viewportWidth:wrap.clientWidth,tableWidth:wrap.scrollWidth,
            originalMap:!!actions?.querySelector('a.pn-journey-link[href],a.atlaslink[href]'),
            lastA4:!!actions?.querySelector('.pn-report-launch'),
            cells:row?.cells.length,
            gauges:getComputedStyle(document.querySelector('#pnExpandedHost .hud-gauges')).display,
            headerButtons:!!h[2]?.querySelector('[data-column-sort="capacity"]')};
        });
        assert.equal(v.headCount,14,JSON.stringify(v));
        assert.equal(v.visible,11,JSON.stringify(v));
        assert.equal(v.heading,'MAP');
        assert.equal(v.cells,14);
        assert.equal(v.normalRows,100);
        assert.ok(v.mapCount>0,JSON.stringify(v));
        assert.ok(v.originalMap&&v.lastA4,'MAP cloned but original MAP/A4 still at far right');
        assert.equal(v.colour,oldColour);
        assert.ok(v.hostVisible&&v.topBar==='absolute');
        assert.equal(v.gauges,'none');
        assert.ok(v.headerButtons);
        assert.ok(v.tableWidth>v.viewportWidth);
        await page.locator('#pnExpandedHost #repdScroll [data-column-sort="capacity"]').click();
        await page.waitForFunction(()=>new URLSearchParams(location.search).get('sort')==='capacity_asc',{timeout:15000});
        const mapped=page.locator('#pnExpandedHost #tbody tr[id^="repd-"] td:nth-child(2) .pn-expanded-map-launch').first();
        await mapped.evaluate(el=>el.addEventListener('click',event=>{event.preventDefault();window.__mapHit=true},{once:true}));
        await mapped.click();assert.equal(await page.evaluate(()=>window.__mapHit),true);
        const a4=page.locator('#pnExpandedHost #tbody tr[id^="repd-"] td:last-child .pn-report-launch').first();
        await a4.click();await page.waitForSelector('#pnRepdReport:not([hidden])',{timeout:15000});
        assert.equal(await page.locator('[data-report-action="pdf"]').count(),1);
        const map=await page.locator('#pnReportMap').evaluate(el=>({href:el.href,hidden:el.hidden}));
        assert.ok(!map.hidden&&map.href.startsWith('https://'),'A4 must retain original MAP link');
        await page.locator('[data-report-action="close"]').click();
        await page.setViewportSize({width:vp.height,height:vp.width});
        assert.ok(await page.locator('#pnExpandedHost').isVisible(),'Rotation must not dismiss expanded view');
        await page.locator('#pnExpandedClose').click();
        assert.equal(await page.locator('#repdScroll thead th').count(),13);
        assert.equal(await page.locator('#tbody tr[id^="repd-"] td').count(),50*13);
        assert.equal(await page.locator('#tbody tr[id^="repd-"] td:last-child .pn-report-launch').count(),50);
        assert.ok(await page.locator('#repdPanel>.hud-gauges').isVisible(),'Normal cockpit restored');
        assert.deepEqual(errors,[],JSON.stringify(errors));
        console.log('PASS V9.69',engineName,vp.name,JSON.stringify(v));
      }finally{await page.close()}
    }
  }finally{await browser.close()}
}
