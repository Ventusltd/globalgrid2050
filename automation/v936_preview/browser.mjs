import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {latestHeadlines} from '../../uk_renewables_pipeline/202611171507/scripts/layers/model.mjs';
const root=resolve(import.meta.dirname,'../..'),edition='uk_renewables_pipeline/202611171507';
const out=resolve(process.env.V936_OUT||'D:/githubfiles/.qa-artifacts/v936-ticker-worker');mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const raw=readFileSync(resolve(root,edition,'news/pipeline_headlines.snapshot.json')),saved=JSON.parse(raw);
const observedRaw=process.env.V936_OBSERVED_LIVE_FILE?readFileSync(process.env.V936_OBSERVED_LIVE_FILE):null,observed=observedRaw?JSON.parse(observedRaw):null;
const fixture=count=>({schema:saved.schema,status:'ok',generated_at:'2026-11-17T14:00:00Z',scope:'Synthetic browser test; not collected publication evidence',items:Array.from({length:count},(_,i)=>({title:i===0?'<img src=x onerror=alert(1)> literal source title':'Synthetic attributed headline '+i,source:'Fixture publisher',link:'https://publisher.example/article/'+i,date:new Date(Date.parse('2026-11-01T00:00:00Z')+i*60000).toISOString(),first_seen:'2026-11-17T00:00:00Z'}))});
const server=createServer((req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));assert.ok(file.startsWith(root+sep));const bytes=readFileSync(file);res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'})[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const proof={status:'RUNNING',edition,utc:new Date().toISOString(),checks:[],saved_source:{sha256:createHash('sha256').update(raw).digest('hex'),generated_at:saved.generated_at,input:saved.items.length,eligible:latestHeadlines(saved.items).length},limitations:['Local Chromium desktop/touch emulation; physical handset and public served-byte acceptance are not claimed.','External network is blocked to exercise the production saved snapshot fallback. Boundary datasets are explicitly synthetic test fixtures.']};
async function touchDrag(session,{x,y,dx}){
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:2,radiusY:2,force:1}]});
 for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/10,y,id:1,radiusX:2,radiusY:2,force:1}]});await new Promise(r=>setTimeout(r,16));}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const [width,reducedMotion] of [[1440,'no-preference'],[393,'no-preference'],[390,'reduce']]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500,reducedMotion});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/'+edition+'/index.html?technology=all');await page.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)===7775&&document.querySelector('#headlineTicker')?.dataset.count==='71');
  const host=page.locator('#headlineTicker'),search=host.getByRole('searchbox'),previous=host.getByRole('button',{name:'Previous headlines',exact:true}),next=host.getByRole('button',{name:'Next headlines',exact:true});
  assert.equal(await page.locator('#newsStatus').getAttribute('data-state'),'snapshot');assert.match(await host.locator('.pn-ticker-label').innerText(),/saved snapshot collected.*articles may be older/i);assert.equal(await host.locator('.pn-ticker-label').isVisible(),true);
  assert.equal(await page.locator('#liveNews .ln-item').count(),12);await page.locator('#liveNews .ln-more').click();assert.equal(await page.locator('#liveNews .ln-item').count(),24);
  assert.equal(await host.getAttribute('data-count'),'71');assert.equal(await host.locator('a').count(),20);for(const href of await host.locator('a').evaluateAll(nodes=>nodes.map(node=>node.href)))assert.ok(saved.items.some(item=>item.link===href));
  const savedLinks=[];for(let batch=0;batch<4;batch++){savedLinks.push(...await host.locator('a').evaluateAll(nodes=>nodes.map(node=>node.href)));assert.ok(await host.locator('a').count()<=20);if(await next.isDisabled())break;await next.click();}assert.deepEqual(savedLinks,latestHeadlines(saved.items).map(row=>row.link));assert.equal(await page.locator('#liveNews .ln-item').count(),24);
  proof.checks.push({width,reducedMotion,saved_source71:true,all_saved71_pages_reachable:true,main_list12_then24:true,bounded20links:true,status:'PASS'});
  await page.screenshot({path:resolve(out,'ticker-saved71-'+width+'.png')});
  if(observed){
   const eligible=latestHeadlines(observed.items);await page.evaluate(doc=>window.pipelineHeadlines.render(doc,'live'),observed);assert.equal(await host.getAttribute('data-count'),String(eligible.length));assert.deepEqual(await host.locator('a').evaluateAll(nodes=>nodes.map(node=>node.href)),eligible.slice(0,20).map(row=>row.link));assert.equal(await page.locator('#liveNews .ln-item').count(),12);await page.locator('#liveNews .ln-more').click();assert.equal(await page.locator('#liveNews .ln-item').count(),24);
   proof.checks.push({width,observed_live_replay:true,input:observed.items.length,eligible:eligible.length,generated_at:observed.generated_at,sha256:createHash('sha256').update(observedRaw).digest('hex'),main_list12_then24:true,status:'PASS'});
  }
  for(const count of [0,1,10,71,100]){
   const doc=fixture(count);await page.evaluate(doc=>window.pipelineHeadlines.render(doc,'live'),doc);const expected=latestHeadlines(doc.items);
   assert.equal(await host.getAttribute('data-count'),String(count));assert.equal(await host.getAttribute('data-filtered-count'),String(count));assert.match(await host.locator('.pn-ticker-count').innerText(),new RegExp(count+' of '+count+' headlines'));
   assert.equal(await host.getByRole('button',{name:/pause|play|resume/i}).count(),0);assert.equal(await host.locator('[aria-hidden]').count(),0);assert.equal(await host.locator('img').count(),0);assert.equal(await host.locator('ul').count(),1);
   const seen=[];let batch=0;
   do{
    const shown=expected.slice(batch*20,batch*20+20);assert.equal(await host.locator('a').count(),shown.length);assert.ok(shown.length<=20);
    assert.deepEqual(await host.locator('a').allTextContents(),shown.map(row=>row.title+' \u2014 '+row.source));assert.deepEqual(await host.locator('time').evaluateAll(nodes=>nodes.map(node=>node.dateTime)),shown.map(row=>row.date));
    seen.push(...await host.locator('a').evaluateAll(nodes=>nodes.map(node=>node.href)));assert.equal(await host.locator('.pn-ticker-track').evaluate(node=>getComputedStyle(node).animationName),'none');assert.equal(await host.locator('a[tabindex="-1"]').count(),0);
    if(await next.isDisabled())break;await next.click();batch++;
   }while(batch<6);
   assert.deepEqual(seen,expected.map(row=>row.link));assert.equal(await page.locator('#liveNews .ln-item').count(),Math.min(count,12));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));proof.checks.push({width,count,all_source_items_reachable:true,bounded20links:true,one_list_no_clones_pause_animation:true,attribution_dates_title_literal:true,status:'PASS'});
  }
  const originalMain=await page.locator('#liveNews .ln-title').evaluateAll(nodes=>nodes.map(node=>node.href));await search.fill('literal source title');assert.equal(await host.getAttribute('data-filtered-count'),'1');assert.equal(await host.locator('a').count(),1);assert.equal(await host.locator('a').first().getAttribute('href'),'https://publisher.example/article/0');assert.equal(await host.getAttribute('data-page'),'1');assert.match(await host.locator('.pn-ticker-count').innerText(),/1 of 100 headlines/);assert.deepEqual(await page.locator('#liveNews .ln-title').evaluateAll(nodes=>nodes.map(node=>node.href)),originalMain);
  await search.fill('no such fixture headline');assert.equal(await host.getAttribute('data-filtered-count'),'0');assert.equal(await host.locator('a').count(),0);assert.match(await host.innerText(),/No matching headlines/);await search.fill('FIXTURE PUBLISHER');assert.equal(await host.getAttribute('data-filtered-count'),'100');await next.click();assert.equal(await host.getAttribute('data-page'),'2');
  await search.focus();await page.evaluate(()=>{window.savedTickerSearch=document.querySelector('#headlineTicker input');window.savedTickerFirst=document.querySelector('#headlineTicker a');document.querySelector('#headlineTicker .pn-ticker-viewport').scrollLeft=100;});
  const same=fixture(100);same.generated_at='2026-11-17T14:01:00Z';await page.evaluate(doc=>window.pipelineHeadlines.render(doc,'live'),same);assert.equal(await search.inputValue(),'FIXTURE PUBLISHER');assert.equal(await host.getAttribute('data-page'),'2');assert.equal(await page.evaluate(()=>document.querySelector('#headlineTicker input')===window.savedTickerSearch&&document.querySelector('#headlineTicker a')===window.savedTickerFirst&&document.activeElement===window.savedTickerSearch),true);assert.equal(await host.locator('.pn-ticker-viewport').evaluate(node=>node.scrollLeft),100);
  await page.evaluate(doc=>window.pipelineHeadlines.render(doc,'live'),fixture(71));assert.equal(await search.inputValue(),'FIXTURE PUBLISHER');assert.equal(await host.getAttribute('data-page'),'1');assert.equal(await host.getAttribute('data-filtered-count'),'71');
  await page.evaluate(doc=>window.pipelineHeadlines.render(doc,'live'),fixture(100));const viewport=host.locator('.pn-ticker-viewport'),keyboardLinks=[];
  for(let batch=0;batch<5;batch++){
   await viewport.scrollIntoViewIfNeeded();await viewport.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#headlineTicker .pn-ticker-viewport').scrollLeft>0);
   for(const anchor of await host.locator('a').all()){
    await page.keyboard.press('Tab');assert.equal(await anchor.evaluate(node=>node===document.activeElement),true);assert.ok(await anchor.evaluate(node=>{const a=node.getBoundingClientRect(),v=node.closest('.pn-ticker-viewport').getBoundingClientRect();return a.right>v.left&&a.left<v.right;}));keyboardLinks.push(await anchor.getAttribute('href'));
   }
   if(batch<4)await next.click();
  }
  assert.equal(new Set(keyboardLinks).size,100);assert.equal(await next.isDisabled(),true);await previous.click();assert.equal(await host.getAttribute('data-page'),'4');
  if(width<500){await viewport.evaluate(node=>{node.scrollLeft=0;});await viewport.scrollIntoViewIfNeeded();const box=await viewport.boundingBox(),session=await context.newCDPSession(page);await touchDrag(session,{x:box.x+box.width*.8,y:box.y+box.height*.5,dx:-Math.min(180,box.width*.6)});await page.waitForFunction(()=>document.querySelector('#headlineTicker .pn-ticker-viewport').scrollLeft>0);await session.detach();}
  await search.fill('');const mixed=fixture(1);mixed.items.push({...mixed.items[0]},{...mixed.items[0],link:'javascript:alert(1)'},{...mixed.items[0],link:'https://publisher.example/future',date:'2050-01-01'},{...mixed.items[0],link:'https://publisher.example/impossible',date:'2026-02-30'});await page.evaluate(doc=>window.pipelineHeadlines.render(doc,'live'),mixed);assert.equal(await host.locator('a').count(),1);assert.equal(await host.getAttribute('data-count'),'1');
  const fallback=fixture(1);fallback.items[0].date=null;fallback.items[0].source='';await page.evaluate(doc=>window.pipelineHeadlines.render(doc,'live'),fallback);assert.match(await page.locator('#headlineTicker time').innerText(),/^First collected 2026-11-17T00:00:00Z$/);assert.match(await page.locator('#headlineTicker a').innerText(),/Publisher not supplied/);
  await page.screenshot({path:resolve(out,'ticker-'+width+'.png')});assert.deepEqual(errors,[]);proof.checks.push({width,native_keyboard_all100_reachable_in5boundedpages:true,native_touch_scroll:width<500,title_publisher_search_beyondfirstpage:true,samefeed_preserves_nodes_focus_query_range_scroll:true,changedfeed_preserves_query_resets_range:true,main_list_independent:true,duplicate_future_unsafe_malformed_withheld:true,first_collected_not_publisher:true,status:'PASS'});await context.close();
 }
 proof.status='PASS';
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));writeFileSync(resolve(out,'receipt.json'),JSON.stringify(proof,null,2)+'\n');}
console.log(JSON.stringify(proof));
