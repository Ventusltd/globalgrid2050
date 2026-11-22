import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const url='http://127.0.0.1:8765/uk_renewables_pipeline/202611221243/';
const out='/tmp/pn-v964-liquid';
await mkdir(out,{recursive:true});
for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await driver.launch({headless:true});
 try{
  for(const size of [{label:'portrait',width:393,height:852},{label:'landscape',width:852,height:393}]){
   const page=await browser.newPage({viewport:{width:size.width,height:size.height},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   try{
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50 &&
      document.querySelectorAll('#tbody .pn-report-launch').length===50 &&
      !!document.getElementById('pnLiquidLaunch'),null,{timeout:90000});
    await page.locator('#pnLiquidLaunch').click();
    await page.waitForSelector('#pnLiquidOverview:not([hidden])');
    const initial=await page.evaluate(async()=>{
      const {state}=await import('./scripts/core/state.js');
      const {atlasUrlV9_5_1}=await import('./scripts/plugins/projects-v9-8.js');
      const wrap=document.getElementById('pnLiquidViewport');
      const body=document.getElementById('pnLiquidBody');
      const project=state.filtered[0];
      return {count:state.filtered.length,all:state.all.length,
        first:project.repd_ref,name:project.name,
        map:atlasUrlV9_5_1(project),rendered:Number(body.dataset.rendered),
        width:document.getElementById('pnLiquidSheet').getBoundingClientRect().width,
        pageWidth:wrap.clientWidth,scrollWidth:wrap.scrollWidth};
    });
    assert.ok(initial.count>50&&initial.all>=initial.count,JSON.stringify(initial));
    assert.ok(initial.rendered>0&&initial.rendered<100,JSON.stringify(initial));
    assert.ok(initial.width>1500&&initial.scrollWidth>initial.pageWidth);
    assert.equal(await page.locator('#pnLiquidTable thead th').count(),13);
    assert.equal(await page.locator('#pnLiquidBody tr.pn-liquid-project').first().getAttribute('data-overview-ref'),initial.first);
    assert.ok((await page.locator('#pnLiquidBody tr.pn-liquid-project').first().textContent()).includes(initial.name));
    if(initial.map){
      assert.equal(await page.locator('#pnLiquidBody tr.pn-liquid-project').first().locator('a.pn-liquid-map').getAttribute('href'),initial.map);
    }
    await page.locator('#pnLiquidBody tr.pn-liquid-project').first().locator('.pn-liquid-note').click();
    await page.waitForSelector('dialog.machine-note-dialog[open]',{timeout:10000});
    assert.ok((await page.locator('#machineNoteBody').textContent()).includes(initial.first));
    await page.locator('.machine-note-close').click();
    await page.locator('[data-liquid-sort="name"]').click();
    await page.waitForFunction(()=>new URLSearchParams(location.search).get('sort')==='name_asc');
    const sorted=await page.evaluate(async()=>{
      const {state}=await import('./scripts/core/state.js');
      return {first:state.filtered[0].repd_ref,name:state.filtered[0].name,last:state.filtered.at(-1).repd_ref};
    });
    assert.equal(await page.locator('#pnLiquidBody tr.pn-liquid-project').first().getAttribute('data-overview-ref'),sorted.first);
    console.log('DEBUG before full scroll',JSON.stringify(await page.evaluate(async()=>{
      const {state}=await import('./scripts/core/state.js');
      const w=document.getElementById('pnLiquidViewport'),b=document.getElementById('pnLiquidBody');
      const last=b.lastElementChild;
      return {n:state.filtered.length,all:state.all.length,
        search:document.getElementById('search')?.value,status:document.getElementById('pnScanStatus')?.value,
        tech:[...document.querySelectorAll('#tech [data-technology]')].filter(x=>x.getAttribute('aria-pressed')==='true').map(x=>x.dataset.technology),
        scrollTop:w.scrollTop,scrollHeight:w.scrollHeight,clientHeight:w.clientHeight,
        bodyHeight:b.getBoundingClientRect().height,lastHeight:last?.getBoundingClientRect().height,
        lastDivHeight:last?.querySelector('div')?.getBoundingClientRect().height,
        rendered:b.dataset.rendered,start:b.dataset.start,end:b.dataset.end,
        url:location.href};
    })));
    // Scroll the complete canonical filtered source, not merely its original first 50 rows.
    await page.locator('#pnLiquidViewport').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    await page.waitForFunction(async()=>{
      const {state}=await import('./scripts/core/state.js');
      const list=[...document.querySelectorAll('#pnLiquidBody tr.pn-liquid-project')];
      return Number(document.getElementById('pnLiquidBody').dataset.start)>0 && list.length&&
        list.at(-1).dataset.overviewRef===state.filtered.at(-1).repd_ref;
    },null,{timeout:30000});
    console.log('DEBUG after full scroll',JSON.stringify(await page.evaluate(async()=>{
      const {state}=await import('./scripts/core/state.js');
      const w=document.getElementById('pnLiquidViewport'),b=document.getElementById('pnLiquidBody');
      return {n:state.filtered.length,scrollTop:w.scrollTop,scrollHeight:w.scrollHeight,
        clientHeight:w.clientHeight,rendered:b.dataset.rendered,start:b.dataset.start,end:b.dataset.end};
    })));
    const atEnd=await page.locator('#pnLiquidBody').evaluate(el=>({
      shown:Number(el.dataset.rendered),from:Number(el.dataset.start),to:Number(el.dataset.end)
    }));
    assert.ok(atEnd.from>0&&atEnd.shown<100,JSON.stringify(atEnd));
    assert.equal(await page.locator('#tbody tr[id^="repd-"]').count(),50);
    // The overview can also expose the complete official REPD universe, not only Solar.
    const types=await page.locator('#pnLiquidTech option').evaluateAll(options=>options.map(o=>o.value));
    assert.ok(types.includes('all'),JSON.stringify(types));
    await page.locator('#pnLiquidTech').selectOption('all');
    await page.waitForFunction(async()=>{
      const {state}=await import('./scripts/core/state.js');
      return document.getElementById('pnLiquidBody').dataset.total===String(state.all.length);
    });
    assert.equal(await page.locator('#pnLiquidBody').getAttribute('data-total'),String(initial.all));
    // A4/A3 are live HTML widths, not a screenshot or a generated PDF.
    await page.locator('#pnLiquidFormat').selectOption('a4');
    const a4=await page.locator('#pnLiquidSheet').evaluate(el=>el.getBoundingClientRect().width);
    assert.ok(a4>1120&&a4<1127,a4);
    await page.locator('[data-liquid-action="plus"]').click();
    assert.notEqual(await page.locator('#pnLiquidZoom').textContent(),'100%');
    await page.locator('[data-liquid-action="fit"]').click();
    const fit=await page.locator('#pnLiquidSheet').evaluate(el=>el.getBoundingClientRect().width);
    assert.ok(fit<=a4,JSON.stringify({fit,a4}));
    await page.locator('#pnLiquidFormat').selectOption('a3');
    await page.locator('#pnLiquidX').evaluate(input=>{input.value='100';input.dispatchEvent(new Event('input',{bubbles:true}));});
    const x=await page.locator('#pnLiquidViewport').evaluate(el=>el.scrollLeft);
    assert.ok(x>0,JSON.stringify({x}));
    // User text search delegates to original #search and canonical filtered data.
    await page.locator('#pnLiquidSearch').fill(sorted.name);
    await page.waitForFunction(()=>document.querySelector('#pnLiquidBody').dataset.total===
      document.getElementById('resultsMeta').dataset.filteredCount);
    const searched=await page.evaluate(async()=>{
      const {state}=await import('./scripts/core/state.js');
      return state.filtered.length;
    });
    assert.ok(searched>=1&&searched<=initial.count);
    await page.locator('[data-liquid-action="clear"]').click();
    await page.waitForFunction(()=>document.getElementById('search').value==='');
    assert.equal(await page.locator('#pnLiquidBody').getAttribute('data-total'),String(initial.all));
    await page.screenshot({path:out+'/'+engine+'-'+size.label+'.png'});
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#pnLiquidOverview').isHidden());
    assert.equal(await page.locator('#tbody tr[id^="repd-"]').count(),50);
    assert.equal(await page.locator('#tbody .pn-report-launch').count(),50);
    // Older individual-project A4 must still work as before, including PDF option.
    await page.locator('#tbody .pn-report-launch').first().click();
    await page.waitForSelector('#pnRepdReport:not([hidden])');
    assert.equal(await page.locator('[data-report-action="pdf"]').count(),1);
    assert.ok((await page.locator('#pnReportMap').isVisible())||(await page.locator('#pnReportNoMap').isVisible()));
    await page.locator('[data-report-action="close"]').click();
    assert.ok(await page.locator('#pnRepdReport').isHidden());
    assert.deepEqual(errors,[]);
    console.log('PASS',engine,size.label,JSON.stringify({all:initial.count,virtual:initial.rendered,
      end:atEnd.to,map:!!initial.map,originalA4:true}));
   }finally{await page.close();}
  }
 }finally{await browser.close();}
}
