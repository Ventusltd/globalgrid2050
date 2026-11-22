// V9.60: isolated Chromium and WebKit landscape-only REPD dashboard acceptance.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {mkdir} from 'node:fs/promises';
const URL='http://127.0.0.1:8765/uk_renewables_pipeline/202611212344/';
const OUT='/tmp/pn-v960-landscape';
await mkdir(OUT,{recursive:true});
const failures=[];
const modes=[
  {name:'phone-portrait-rotate',portrait:[393,852],wide:[852,393]},
  {name:'tablet-portrait-rotate',portrait:[768,1024],wide:[1024,768]},
  {name:'phone-landscape',wide:[667,375]},
  {name:'desktop-landscape',wide:[1440,900]},
];
for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await launcher.launch({headless:true});
 try{
  for(const mode of modes){
   const [w,h]=mode.portrait||mode.wide;
   const page=await browser.newPage({viewport:{width:w,height:h},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const label=engine+'-'+mode.name;
   try{
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#pnRepdWideToggle',{state:'visible',timeout:20000});
    await page.waitForFunction(()=>document.querySelector('#v2')?.textContent.replaceAll(',','')==='3604' &&
      document.querySelectorAll('#tbody tr[id^="repd-"]').length>0,null,{timeout:90000});
    assert.match(await page.title(),/V9\.60.*202611212344/);
    const original=await page.evaluate(()=>({
      rows:document.querySelectorAll('#tbody tr[id^="repd-"]').length,
      gauge:document.getElementById('v2').textContent,
      newsButton:!!document.getElementById('pnNewsMaximise'),
      width:document.getElementById('repdScroll').clientWidth,
      htmlOverflow:document.documentElement.style.overflow,
      max:document.getElementById('repdScroll').scrollWidth
    }));
    assert.equal(original.newsButton,true,'independent news toggle retained');
    assert.ok(original.max>original.width,'original table has real horizontal columns');
    const toggle=page.locator('#pnRepdWideToggle');
    await toggle.scrollIntoViewIfNeeded();
    const beforeY=await page.evaluate(()=>scrollY);
    if(mode.portrait){
      await toggle.click();
      assert.equal(await page.locator('#pnRepdWidePrompt').isVisible(),true,'rotate hint in portrait');
      assert.equal(await page.locator('#officialRegister').evaluate(e=>e.classList.contains('pn-repd-wide')),false,'portrait never expanded');
      await page.setViewportSize({width:mode.wide[0],height:mode.wide[1]});
      await page.waitForFunction(()=>document.querySelector('#officialRegister').classList.contains('pn-repd-wide'),null,{timeout:10000});
    }else{
      await toggle.click();
      await page.waitForFunction(()=>document.querySelector('#officialRegister').classList.contains('pn-repd-wide'),null,{timeout:10000});
    }
    const wide=await page.evaluate(()=>{
      const root=document.getElementById('officialRegister'),box=root.getBoundingClientRect();
      const gauges=document.querySelector('#repdPanel>.hud-gauges');
      const table=document.getElementById('repdScroll');
      const status=document.querySelector('#repdScroll [data-column-heading="status"]');
      return {x:box.x,y:box.y,w:box.width,h:box.height,innerWidth:innerWidth,innerHeight:innerHeight,
        position:getComputedStyle(root).position,role:root.getAttribute('role'),
        modal:root.getAttribute('aria-modal'),newsInert:document.querySelector('.main>.newspaper').inert,
        toggleLabel:document.getElementById('pnRepdWideToggle').getAttribute('aria-label'),
        gaugeText:document.getElementById('v2').textContent,
        gaugeHeight:gauges.getBoundingClientRect().height,
        width:table.clientWidth,scrollWidth:table.scrollWidth,
        rows:document.querySelectorAll('#tbody tr[id^="repd-"]').length,
        status:status?getComputedStyle(status).display:null,
        hasHeader:!!document.querySelector('#repdScroll thead [data-column-heading="name"]')};
    });
    assert.equal(wide.position,'fixed');
    assert.equal(wide.role,'dialog');assert.equal(wide.modal,'true');
    assert.equal(wide.newsInert,true);
    assert.equal(wide.toggleLabel,'Restore REPD dashboard');
    assert.equal(wide.gaugeText,original.gauge);
    assert.ok(wide.gaugeHeight>40,'analytics gauges remain in REPD dashboard');
    assert.equal(wide.rows,original.rows,'unchanged register project rows');
    assert.ok(wide.hasHeader,'sortable table header remains');
    assert.notEqual(wide.status,'none','status column visible in wide layout');
    assert.ok(wide.scrollWidth>wide.width,'all original project columns remain horizontally scrollable');
    assert.ok(Math.abs(wide.x)<2 && Math.abs(wide.y)<2,JSON.stringify(wide));
    assert.ok(Math.abs(wide.w-wide.innerWidth)<3 && Math.abs(wide.h-wide.innerHeight)<3,JSON.stringify(wide));
    await page.screenshot({path:OUT+'/'+label+'.png'});
    await page.evaluate(()=>document.getElementById('repdScroll').scrollLeft=210);
    await toggle.click();
    await page.waitForFunction(()=>!document.querySelector('#officialRegister').classList.contains('pn-repd-wide'),null,{timeout:10000});
    await page.waitForFunction(y=>Math.abs(window.scrollY-y)<3,beforeY,{timeout:10000});
    const closed=await page.evaluate(()=>({
      gauge:document.getElementById('v2').textContent,
      news:document.getElementById('pnNewsMaximise').getAttribute('aria-label'),
      role:document.getElementById('officialRegister').getAttribute('role'),
      newsInert:document.querySelector('.main>.newspaper').inert,
      htmlOverflow:document.documentElement.style.overflow,
      tableX:document.getElementById('repdScroll').scrollLeft,
      hasFull:document.querySelector('#officialRegister').classList.contains('pn-repd-wide')
    }));
    assert.equal(closed.hasFull,false);assert.equal(closed.role,null);
    assert.equal(closed.newsInert,false);
    assert.equal(closed.gauge,original.gauge);
    assert.equal(closed.htmlOverflow,original.htmlOverflow);
    assert.equal(closed.tableX,0,'horizontal position returns to previous view');
    assert.equal(closed.news,'Maximise news window');
    // Open and test automatic exit when device is rotated back to portrait.
    await toggle.click();
    await page.waitForFunction(()=>document.querySelector('#officialRegister').classList.contains('pn-repd-wide'));
    if(mode.portrait){
      await page.setViewportSize({width:mode.portrait[0],height:mode.portrait[1]});
      await page.waitForFunction(()=>!document.querySelector('#officialRegister').classList.contains('pn-repd-wide'),null,{timeout:10000});
      assert.equal(await page.locator('#pnRepdWidePrompt').isVisible(),false);
    }else{
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('#officialRegister').classList.contains('pn-repd-wide'));
    }
    assert.deepEqual(errors,[],'no uncaught browser errors');
    console.log('PASS '+label+' orientation gate, gauges, status column, scroll and restore');
   }catch(error){
    failures.push(label+': '+(error.stack||error));
    await page.screenshot({path:OUT+'/'+label+'-FAIL.png'}).catch(()=>{});
   }finally{await page.close();}
  }
 }finally{await browser.close();}
}
if(failures.length)throw Error(failures.join('\n'));
console.log('PASS: 8 REPD landscape-only browser scenarios');
