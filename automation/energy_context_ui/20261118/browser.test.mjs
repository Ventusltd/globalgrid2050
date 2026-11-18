// Deterministic actual saved-feed replay against the inherited Pipeline page.
// This is integration evidence, not public served acceptance or live collection proof.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_IMPORT||'playwright');
const root=resolve(process.env.PN_CONTEXT_ROOT||resolve(dirname(fileURLToPath(import.meta.url)),'../../..')),edition=process.env.PN_CONTEXT_EDITION||'202611171940',out=resolve(process.env.PN_CONTEXT_OUTPUT||'work/energy-context');mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));assert.ok(path.startsWith(root+sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,canonicalReplay=process.env.PN_CONTEXT_CANONICAL_REPLAY==='true',start=canonicalReplay?'https://globalgrid2050.com':origin,browser=await chromium.launch(),receipts=[];
try{for(const width of [1440,393,390]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,reducedMotion:width===390?'reduce':'no-preference'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{if(route.request().url().startsWith(origin))return route.continue();const u=new URL(route.request().url());if(canonicalReplay&&u.origin===start){try{const pathname=decodeURIComponent(u.pathname),path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));assert.ok(path.startsWith(root+sep));return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream',body:readFileSync(path)});}catch{return route.fulfill({status:404,body:'Fixture path unavailable'});}}return route.abort();});
 await page.goto(`${start}/uk_renewables_pipeline/${edition}/?news_topic=grid&news_origin_type=repd&news_origin_id=2470`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.pipelineHeadlineDocument?.items?.length>0&&document.querySelector('.pn-news-quality'),null,{timeout:20000});
 if(process.env.PN_CONTEXT_INTEGRATED!=='true'){
  await page.addStyleTag({url:start+'/automation/energy_context_ui/20261118/styles.css'});
  await page.addScriptTag({type:'module',url:start+'/automation/energy_context_ui/20261118/view.mjs'});
 }
 await page.waitForFunction(()=>['withheld','source-qualified'].includes(document.getElementById('energyPolicyContext')?.dataset.state));
 const state=await page.locator('#energyPolicyContext').getAttribute('data-state');
 const hasTopicHook=await page.evaluate(()=>typeof window.pipelineHeadlines?.getViewAdapter==='function');
 assert.equal(state,'source-qualified','actual two independent policy receipts required');
 await page.waitForFunction(()=>['withheld','source-qualified'].includes(document.getElementById('energyPolicyContext')?.dataset.gridContext));
 assert.equal(await page.locator('#energyPolicyContext').getAttribute('data-grid-context'),'source-qualified');
 await page.waitForFunction(()=>window.pipelineEnergyContext.topic()==='grid'||document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]').value==='grid'||document.querySelector('.pn-news-header-search input').value==='grid');
 await page.locator('#energyPolicyContext>summary').click();
 assert.equal(await page.locator('#energyPolicyContext a[href*="data-centre-covenant"]').count()>0,true);
 assert.match(await page.locator('#energyPolicyContext').innerText(),/PUE 1\.3 or better/);assert.match(await page.locator('#energyPolicyContext').innerText(),/no project compliance assessment/);
 await page.locator('[data-official-context="planning:EN020026"]>summary').click();assert.match(await page.locator('[data-official-context]').innerText(),/proposed transmission up to 2 GW/);
 assert.equal(await page.locator('[data-official-context] a').count(),2);
 await page.locator('#energyPolicyContext').screenshot({path:resolve(out,`policy-${width}.png`)});
 await page.getByRole('button',{name:'Read exact grid-document facts',exact:true}).click();
 assert.equal(await page.locator('.pn-document-facts').evaluate(e=>e.open),true);
 const before=await page.evaluate(()=>JSON.stringify(window.pipelineHeadlineDocument));
 await page.locator('#energyPolicyContext button[data-news-topic="grid"]').click();
 assert.equal(await page.evaluate(()=>window.pipelineEnergyContext.topic()==='grid'||document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]').value==='grid'||document.querySelector('.pn-news-header-search input').value==='grid'),true);
 await page.locator('#energyPolicyContext button[data-news-topic="datacentre"]').click();
 const selection=await page.evaluate(()=>[document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]').value,document.querySelector('.pn-news-filter-tools select[aria-label="News category"]').value,document.querySelector('.pn-news-header-search input').value]);
 if(hasTopicHook){assert.equal(await page.evaluate(()=>window.pipelineEnergyContext.topic()),'datacentre');assert.equal(await page.locator('#liveNews .ln-title').evaluateAll(as=>as.some(a=>/Nvidia Earnings|Markets Wrap|Anthropic.*IPO|India Stock Market/.test(a.textContent))),false);}
 await page.evaluate(()=>window.pipelineHeadlines.render(window.pipelineHeadlineDocument,'snapshot'));
 await page.waitForTimeout(50);
 assert.deepEqual(await page.evaluate(()=>[document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]').value,document.querySelector('.pn-news-filter-tools select[aria-label="News category"]').value,document.querySelector('.pn-news-header-search input').value]),selection,'feed redraw must preserve user filter after return context applied');
 if(process.env.PN_CONTEXT_RETURN_REPLAY==='true'||process.env.PN_CONTEXT_ASYNC_ENTRY==='true'){
  assert.ok(canonicalReplay,'async opt-in requires an explicitly labelled canonical-origin fixture');
  await page.locator('.pipeline-tabs [data-view="solar"]').click();await page.locator('#clearFilters').click();
  await page.waitForFunction(()=>document.querySelector('#tbody')?.dataset.total==='7775');
  const locationBefore=page.url(),mapsBefore=await page.locator('#tbody a.atlaslink:not(.pn-journey-link)').evaluateAll(items=>items.map(a=>a.href));
  if(!await page.evaluate(()=>!!window.pipelineJourneyEntry)){
   assert.notEqual(process.env.PN_CONTEXT_INTEGRATED,'true','integrated source must own its entry runtime');
   await page.addStyleTag({url:start+'/automation/journey_entry_ui/20261118/styles.css'});
   await page.addScriptTag({type:'module',url:start+'/automation/journey_entry_ui/20261118/view.mjs'});
  }else assert.equal(await page.locator('script[src*="journey_entry_ui/20261118/view.mjs"]').count(),1,'actual integrated entry is not injected twice');
  await page.waitForFunction(()=>window.pipelineJourneyEntry&&document.querySelector('#tbody .pn-journey-link')?.href.includes('news_context_url='));
  assert.equal(page.url(),locationBefore,'late entry readiness cannot auto-navigate');
  assert.deepEqual(await page.locator('#tbody a.atlaslink:not(.pn-journey-link)').evaluateAll(items=>items.map(a=>a.href)),mapsBefore);
  const newsState=expected=>{if(!window.pipelineEnergyContext||!document.querySelector('.pn-news-header-search input'))return false;const state={query:document.querySelector('.pn-news-header-search input').value,...Object.fromEntries(['publisher','topic','category','ranking source type'].map(kind=>[kind,document.querySelector('.pn-news-filter-tools select[aria-label="News '+kind+'"]').value])),context:window.pipelineEnergyContext.topic()};return expected?JSON.stringify(state)===JSON.stringify(expected):state;};
  for(const kind of ['publisher','ranking source type']){const select=page.locator('.pn-news-filter-tools select[aria-label="News '+kind+'"]'),value=await select.evaluate(node=>[...node.options].find(o=>o.value)?.value);if(value)await select.selectOption(value);}
  await page.locator('.pn-news-header-search input').fill('data');const wanted=await page.evaluate(newsState);
  const target=page.locator('#tbody .pn-journey-link').first(),url=new URL(await target.getAttribute('href'));assert.equal(url.searchParams.get('news_context_url'),`${start}/uk_renewables_pipeline/${edition}/`);
  // Suppress only fixture outbound navigation; actual source handlers store state.
  await page.evaluate(()=>document.addEventListener('click',event=>event.preventDefault(),{once:true}));await target.click();
  assert.equal(await page.evaluate(()=>history.state.pipelineEnergyNewsReturn.origin?.origin_type),'repd');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(newsState,wanted);
  assert.deepEqual(await page.evaluate(newsState),wanted,'typed cold reload retains every News filter and explicit context');
  await page.evaluate(()=>window.pipelineEnergyContext.selectOrigin({origin_type:'unknown',origin_id:'none'}));
  await page.locator('.pn-news-header-search input').fill('battery');const manualWanted=await page.evaluate(newsState),manual=page.locator('#journeyAtlasNav');await manual.waitFor();
  assert.equal(new URL(await manual.getAttribute('href')).searchParams.get('news_context_url'),`${start}/uk_renewables_pipeline/${edition}/`);
  await page.evaluate(()=>document.addEventListener('click',event=>event.preventDefault(),{once:true}));await manual.click();
  assert.equal(await page.evaluate(()=>history.state.pipelineEnergyNewsReturn.origin),null,'manual entry creates no asset association');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(newsState,manualWanted);
  assert.deepEqual(await page.evaluate(newsState),manualWanted,'manual cold reload retains every News filter and explicit context');
  if(hasTopicHook){await page.locator('#headlineContextStatus button').click();assert.equal(await page.evaluate(()=>window.pipelineEnergyContext.topic()),null);while(await page.locator('#liveNews .ln-more').count())await page.locator('#liveNews .ln-more').click();const all=await page.locator('#liveNews .ln-title').evaluateAll(as=>as.map(a=>a.href).sort());const original=await page.evaluate(()=>window.pipelineHeadlineDocument.items.map(item=>new URL(item.link).href).sort());assert.deepEqual(all,original,'reset exposes every original eligible article');}
  // Synthetic late-ranking-option lifecycle; original article/feed data is unchanged.
  await page.evaluate(()=>{const topic=document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]');if(![...topic.options].some(o=>o.value==='storage'))topic.add(new Option('Storage','storage'));topic.value='storage';topic.dispatchEvent(new Event('change'));window.dispatchEvent(new CustomEvent('pipeline-journey-origin',{detail:{origin_type:'repd',origin_id:'repd:2470',technology:'battery'}}));});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.pipelineEnergyContext&&window.pipelineHeadlineDocument?.items?.length>0);
  await page.evaluate(()=>{const topic=document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]');if(![...topic.options].some(o=>o.value==='storage'))topic.add(new Option('Storage','storage'));window.dispatchEvent(new CustomEvent('pipeline-feed-loaded',{detail:window.pipelineHeadlineDocument}));});
  await page.waitForFunction(()=>document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]')?.value==='storage',null,{timeout:3000});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pipeline-journey-origin',{detail:{origin_type:'repd',origin_id:'repd:2470',technology:'battery'}})));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.pipelineEnergyContext&&window.pipelineHeadlineDocument?.items?.length>0);
  await page.locator('.pn-news-header-search input').fill('solar');
  await page.evaluate(()=>{const topic=document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]');if(![...topic.options].some(o=>o.value==='storage'))topic.add(new Option('Storage','storage'));window.dispatchEvent(new CustomEvent('pipeline-feed-loaded',{detail:window.pipelineHeadlineDocument}));});
  await page.waitForTimeout(50);assert.equal(await page.locator('.pn-news-header-search input').inputValue(),'solar','genuine user input cancels a pending metadata restore');
 }
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pipeline-journey-origin',{detail:{origin_type:'datacentre',origin_id:'dc:synthetic-origin'}})));
 await page.locator('#gridTab').click();await page.locator('#journeyNewsContext>summary').click();
 assert.match(await page.locator('#journeyNewsContext').innerText(),/DATACENTRE dc:synthetic-origin: topic context only/);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.pipelineHeadlineDocument)),before);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pipeline-feed-loaded',{detail:null})));assert.match(await page.locator('#journeyNewsContext').innerText(),/No matching topic headlines/);
 assert.equal(await page.evaluate(()=>window.pipelineEnergyContext.selectOrigin({origin_type:'unknown',origin_id:'2470'})),false);assert.match(await page.locator('#journeyNewsContext').innerText(),/Choose a REPD project/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.equal(await page.locator('.pn-energy-context input').count(),0,'existing sole news search retained');
 await page.screenshot({path:resolve(out,`context-${width}.png`)});
 if(hasTopicHook){
  await page.goto(`${start}/uk_renewables_pipeline/${edition}/`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.pipelineHeadlineDocument?.items?.length>0&&window.pipelineEnergyContext);
  assert.equal(await page.evaluate(()=>window.pipelineEnergyContext.topic()),null);assert.equal(await page.locator('#headlineContextStatus').isHidden(),true,'default view remains complete and uncluttered');
  const original=await page.evaluate(()=>JSON.stringify(window.pipelineHeadlineDocument)),query=await page.locator('.pn-news-header-search input').elementHandle();
  await page.locator('#energyPolicyContext>summary').click();await page.locator('#energyPolicyContext button[data-news-topic="datacentre"]').click();
  await page.locator('#headlineContextStatus button').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.pipelineEnergyContext.topic()),null);
  await page.locator('#liveNews .ln-more').click();assert.equal(await page.locator('#liveNews .ln-title').count(),24);
  await page.evaluate(()=>window.pipelineHeadlines.render(window.pipelineHeadlineDocument,'snapshot'));assert.equal(await page.locator('#liveNews .ln-title').count(),24,'same-input feed redraw retains expanded original view');
  assert.equal(await query.evaluate(node=>node===document.querySelector('.pn-news-header-search input')),true,'existing sole search node retained');assert.equal(await page.evaluate(()=>JSON.stringify(window.pipelineHeadlineDocument)),original);
 }
 assert.deepEqual(errors,[]);receipts.push({width,reduced_motion:width===390,source:'actual_saved_feed_replay',canonical_origin_fixture:canonicalReplay,async_entry:process.env.PN_CONTEXT_ASYNC_ENTRY==='true',return_replay:process.env.PN_CONTEXT_RETURN_REPLAY==='true',main_context_hook:hasTopicHook,policy_state:state,synthetic_origin:true,original_feed_unchanged:true,errors});await context.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));writeFileSync(resolve(out,'receipt.json'),JSON.stringify({edition,public_acceptance:false,receipts},null,2)+'\n');}
console.log(JSON.stringify(receipts));
