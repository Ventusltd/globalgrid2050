// V9.61: regression of compact/minimised REPD columns and short landscape rows.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';
const ORIGIN='http://127.0.0.1:8765/uk_renewables_pipeline/202611220100/';
const OUT='/tmp/pn-v961-density';
await mkdir(OUT,{recursive:true});
for(const [engine,driver] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await driver.launch({headless:true});
  try {
    for(const view of [{name:'portrait',w:393,h:852},{name:'landscape',w:852,h:393}]){
      const page=await browser.newPage({viewport:{width:view.w,height:view.h},reducedMotion:'reduce'});
      try {
        await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
        await page.goto(ORIGIN,{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length>0,null,{timeout:90000});
        assert.match(await page.title(),/V9\.61/);
        const select=page.locator('#repdProjectWidth');
        assert.equal(await select.inputValue(),'compact');
        const snapshot=async()=>page.evaluate(()=>{
          const wrap=document.getElementById('repdScroll');
          const first=wrap.querySelector('th[data-column-heading="name"]');
          const row=document.querySelector('#tbody tr[id^="repd-"]');
          const box=wrap.getBoundingClientRect();
          const visible=[...wrap.querySelectorAll('thead th')].filter(e=>{
            const r=e.getBoundingClientRect();
            return getComputedStyle(e).display!=='none'&&r.left<box.right&&r.right>box.left;
          });
          return {first:first.getBoundingClientRect().width,rowHeight:row.getBoundingClientRect().height,
            count:document.querySelectorAll('#tbody tr[id^="repd-"]').length,capacity:row.querySelector('td.mw').textContent,
            visible:visible.length,scroll:wrap.scrollWidth>wrap.clientWidth,
            frozen:getComputedStyle(row.querySelector('td.site')).position==='sticky',
            gauges:document.querySelectorAll('#repdPanel .hud-gauges canvas').length};
        });
        const compact=await snapshot();
        assert.ok(compact.first<=175&&compact.first>=120,JSON.stringify(compact));
        assert.ok(compact.rowHeight<=52,JSON.stringify(compact));
        assert.ok(compact.scroll&&compact.frozen&&compact.gauges===3,JSON.stringify(compact));
        await select.selectOption('mini');
        const mini=await snapshot();
        assert.ok(mini.first>=50&&mini.first<=60,JSON.stringify(mini));
        assert.equal(mini.count,compact.count);
        assert.equal(mini.capacity,compact.capacity);
        if(view.name==='portrait')assert.ok(mini.visible>=4,JSON.stringify(mini));
        await select.selectOption('full');
        const full=await snapshot();
        assert.ok(full.first>=220,JSON.stringify(full));
        await select.selectOption('compact');
        if(view.name==='landscape'){
          assert.ok(compact.visible>=6,JSON.stringify(compact));
          await page.locator('#pnRepdWideToggle').click();
          await page.waitForFunction(()=>document.querySelector('#officialRegister').classList.contains('pn-repd-wide'));
          const wide=await snapshot();
          assert.ok(wide.visible>=6&&wide.count===compact.count,JSON.stringify(wide));
          assert.equal(await page.locator('#repdPanel .hud-gauges canvas').count(),3);
          await page.screenshot({path:OUT+'/'+engine+'-'+view.name+'-wide.png'});
          await page.locator('#pnRepdWideToggle').click();
        }else{
          await page.screenshot({path:OUT+'/'+engine+'-'+view.name+'-mini.png'});
        }
        console.log('PASS',engine,view.name,JSON.stringify({compact,mini,fullWidth:full.first}));
      } finally {await page.close();}
    }
  } finally {await browser.close();}
}
