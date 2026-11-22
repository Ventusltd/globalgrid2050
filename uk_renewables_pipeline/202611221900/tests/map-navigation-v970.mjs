// V9.70 regression: prove real normal versus expanded MAP navigation, not click events.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const app='http://127.0.0.1:8765/uk_renewables_pipeline/202611221900/';
const atlas='https://ventusltd.github.io/gridatlas/atlas/';
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    for(const cfg of [
      {name:'portrait-touch',width:393,height:852,touch:true},
      {name:'landscape-touch',width:852,height:393,touch:true},
      {name:'desktop',width:1280,height:800,touch:false}
    ]){
      const ctx=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},
        isMobile:cfg.touch,hasTouch:cfg.touch,reducedMotion:'reduce'});
      const page=await ctx.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await ctx.route('https://raw.githubusercontent.com/**',r=>r.abort());
      await ctx.route('https://ventusltd.github.io/gridatlas/atlas/**',r=>
        r.fulfill({status:200,contentType:'text/html',
          body:'<!doctype html><title>GridAtlas test receiver</title><h1>GridAtlas test receiver</h1>'}));
      const nativeSelector='#tbody tr[id^="repd-"] td:last-child .pn-journey-action.atlaslink[href]';
      const expandedSelector='#pnExpandedHost #tbody tr[id^="repd-"] .pn-expanded-map-cell a.pn-expanded-map-launch';
      try{
        await page.goto(app,{waitUntil:'domcontentloaded',timeout:90000});
        await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50
          &&document.querySelector('#tbody .pn-journey-action.atlaslink[href]'),{timeout:90000});
        const native=page.locator(nativeSelector).first();
        const href=await native.getAttribute('href');
        assert.ok(href.startsWith(atlas),'native original must link GridAtlas');
        const normalTarget=await native.getAttribute('target');
        assert.equal(normalTarget,cfg.touch?'_self':'_blank','native target policy');
        if(cfg.touch){
          await Promise.all([page.waitForURL(u=>u.href===href,{timeout:15000}),native.click()]);
          assert.equal(page.url(),href,'normal MAP must navigate in same tab');
          await page.goBack({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===50,{timeout:90000});
        }else{
          const popupPromise=page.waitForEvent('popup',{timeout:15000});
          await native.click();
          const popup=await popupPromise;
          await popup.waitForURL(href,{timeout:15000});
          assert.equal(popup.url(),href,'normal desktop MAP opens real destination');
          await popup.close();
        }
        await page.locator('#pnLiquidLaunch').click();
        await page.waitForFunction(()=>document.querySelectorAll('#tbody tr[id^="repd-"]').length===100
          &&document.querySelector('#tbody .pn-expanded-map-launch'),{timeout:20000});
        const expanded=page.locator(expandedSelector).first();
        const currentNative=page.locator(nativeSelector).first();
        assert.equal(await expanded.getAttribute('href'),await currentNative.getAttribute('href'),
          'expanded must inherit live, enriched MAP target');
        assert.equal(await expanded.getAttribute('target'),await currentNative.getAttribute('target'),
          'expanded and normal target policy must match');
        // Simulate an asynchronously updated native URL after expansion. This was
        // missed by V9.69's click-only acceptance and permanently stale mirror.
        const changed=await page.evaluate(()=>{
          const row=document.querySelector('#tbody tr[id^="repd-"]');
          const source=row?.querySelector('td:last-child .pn-journey-action.atlaslink[href]');
          if(!source)throw Error('Native source missing');
          const u=new URL(source.href);u.searchParams.set('v970_parity','source-updated');
          source.href=u.href;return u.href;
        });
        if(cfg.touch){
          await Promise.all([page.waitForURL(u=>u.href===changed,{timeout:15000}),expanded.click()]);
          assert.equal(page.url(),changed,'expanded touch MAP must navigate to newest native URL');
        }else{
          const popupPromise=page.waitForEvent('popup',{timeout:15000});
          await expanded.click();
          const popup=await popupPromise;
          await popup.waitForURL(changed,{timeout:15000});
          assert.equal(popup.url(),changed,'expanded desktop MAP must open newest native URL');
          await popup.close();
          // Expanded mode survives actual desktop MAP click.
          assert.equal(await page.locator('#pnExpandedHost').isVisible(),true);
          await page.locator('#pnExpandedClose').click();
          assert.equal(await page.locator('#repdScroll thead th').count(),13);
        }
        assert.deepEqual(errors,[],'No browser errors');
        console.log('PASS V9.70 native MAP parity',engineName,cfg.name);
      }finally{await ctx.close()}
    }
  }finally{await browser.close()}
}
