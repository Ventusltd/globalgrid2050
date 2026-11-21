// V9.58: real Chromium/WebKit interactive news maximise tests; no external news dependency.
import assert from 'node:assert/strict';
import {chromium, webkit} from 'playwright';
import {mkdir} from 'node:fs/promises';

const url='http://127.0.0.1:8765/uk_renewables_pipeline/202611212308/';
const folder='/tmp/pn-v958';
await mkdir(folder,{recursive:true});
const failures=[];
const views=[[393,852],[667,375],[768,1024],[1440,900]];

for (const [engine, launcher] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await launcher.launch({headless:true});
  try {
    for (const [width,height] of views) {
      const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
      const errors=[];
      page.on('pageerror', e => errors.push(e.message));
      const label=engine+'-'+width;
      try {
        // Test against the committed local news snapshot; third-party connectivity
        // must not influence this purely presentational feature.
        await page.route('https://raw.githubusercontent.com/**', route => route.abort());
        await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForSelector('#pnNewsMaximise',{state:'visible',timeout:30000});
        await page.waitForSelector('#liveNews .ln-item',{timeout:30000});
        assert.match(await page.title(), /V9\.58.*202611212308/);
        await page.waitForFunction(()=>document.querySelector('#v2')?.textContent.replaceAll(',','')==='3604',null,{timeout:90000});
        const normal=await page.evaluate(()=>{
          const root=document.querySelector('.main>.newspaper');
          return {rect:root.getBoundingClientRect().toJSON(),
            position:getComputedStyle(root).position, bodyPosition:document.body.style.position,
            heading:document.getElementById('pipelineHeading').textContent,
            gauge:document.getElementById('v2').textContent};
        });
        assert.notEqual(normal.position,'fixed');
        assert.equal(normal.bodyPosition,'');
        assert.match(normal.heading, /REPD PIPELINE/);
        assert.match(normal.gauge,/3,604/);
        await page.evaluate(()=>{
          window.scrollTo(0,Math.min(180,document.documentElement.scrollHeight-window.innerHeight));
          document.getElementById('liveNews').scrollTop=120;
        });
        const expected=await page.evaluate(()=>({
          y:scrollY, headlines:document.querySelectorAll('#liveNews .ln-item').length,
          scrollTop:document.getElementById('liveNews').scrollTop,
          ticker:!!document.getElementById('headlineTicker'),
          rows:document.querySelectorAll('#tbody tr').length
        }));
        await page.locator('#pnNewsMaximise').click();
        const full=await page.evaluate(()=>{
          const e=document.querySelector('.main>.newspaper'), b=e.getBoundingClientRect();
          const l=document.getElementById('liveNews');
          return {class:e.classList.contains('pn-news-maximised'),x:b.x,y:b.y,w:b.width,h:b.height,
            innerWidth:innerWidth,innerHeight:innerHeight,position:getComputedStyle(e).position,
            role:e.getAttribute('role'),ariaModal:e.getAttribute('aria-modal'),
            inert:document.getElementById('officialRegister').inert,
            label:document.getElementById('pnNewsMaximise').getAttribute('aria-label'),
            scrollTop:l.scrollTop,ticker:document.getElementById('headlineTicker').getBoundingClientRect().height};
        });
        assert.equal(full.class,true);
        assert.equal(full.position,'fixed');
        assert.equal(full.role,'dialog');
        assert.equal(full.ariaModal,'true');
        assert.equal(full.inert,true);
        assert.equal(full.label,'Restore news window');
        assert.ok(Math.abs(full.x)<2 && Math.abs(full.y)<2,JSON.stringify(full));
        assert.ok(Math.abs(full.w-full.innerWidth)<3,JSON.stringify(full));
        assert.ok(Math.abs(full.h-full.innerHeight)<3,JSON.stringify(full));
        assert.ok(full.ticker>0,'ticker remains visible');
        assert.ok(full.scrollTop>=0 && full.scrollTop<=expected.scrollTop,'expanded viewport may have less overflow');
        assert.equal(expected.ticker,true);
        await page.screenshot({path:folder+'/'+label+'-max.png'});
        await page.locator('#pnNewsMaximise').click();
        await page.waitForFunction(target => {
          return !document.querySelector('.main>.newspaper').classList.contains('pn-news-maximised')
            && Math.abs(window.scrollY-target.y)<3
            && document.getElementById('liveNews').scrollTop===target.newsTop;
        }, {y:expected.y,newsTop:expected.scrollTop}, {timeout:10000});
        const restored=await page.evaluate(()=>({
          isFull:document.querySelector('.main>.newspaper').classList.contains('pn-news-maximised'),
          bodyPos:document.body.style.position, y:scrollY,
          gauge:document.getElementById('v2').textContent,
          newsCount:document.querySelectorAll('#liveNews .ln-item').length,
          scrollTop:document.getElementById('liveNews').scrollTop,
          role:document.querySelector('.main>.newspaper').getAttribute('role'),
          inert:document.getElementById('officialRegister').inert,
          horizontal:document.documentElement.scrollWidth-document.documentElement.clientWidth
        }));
        assert.equal(restored.isFull,false);
        assert.equal(restored.bodyPos,'');
        assert.ok(Math.abs(restored.y-expected.y)<3,JSON.stringify({expected,restored}));
        assert.equal(restored.gauge,normal.gauge);
        assert.equal(restored.newsCount,expected.headlines);
        assert.equal(restored.scrollTop,expected.scrollTop);
        assert.equal(restored.inert,false);
        assert.equal(restored.role,null);
        assert.ok(restored.horizontal<=3,'no sideways overflow');
        // Keyboard users can close with Escape and return to the same view.
        await page.locator('#pnNewsMaximise').click();
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>!document.querySelector('.main>.newspaper').classList.contains('pn-news-maximised'));
        assert.equal(await page.locator('#pnNewsMaximise').getAttribute('aria-label'),'Maximise news window');
        assert.deepEqual(errors,[],'Uncaught browser errors');
        console.log('PASS '+label+' fixed overlay, safe restoration, original REPD/ticker/links');
      } catch(e) {
        failures.push(label+': '+(e?.stack||e));
        await page.screenshot({path:folder+'/'+label+'-failure.png'}).catch(()=>{});
      } finally {await page.close();}
    }
  } finally {await browser.close();}
}
if(failures.length)throw Error(failures.join('\n'));
console.log('PASS: 8 independent browser and viewport combinations');
