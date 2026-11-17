// Deterministic actual saved-feed replay against the inherited Pipeline page.
// This is integration evidence, not public served acceptance or live collection proof.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_IMPORT||'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),edition=process.env.PN_CONTEXT_EDITION||'202611171940',out=resolve(process.env.PN_CONTEXT_OUTPUT||'work/energy-context');mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));assert.ok(path.startsWith(root+sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(),receipts=[];
try{for(const width of [1440,393,390]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,reducedMotion:width===390?'reduce':'no-preference'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await page.goto(`${origin}/uk_renewables_pipeline/${edition}/`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.pipelineHeadlineDocument?.items?.length>0&&document.querySelector('.pn-news-quality'),null,{timeout:20000});
 await page.addStyleTag({url:origin+'/automation/energy_context_ui/20261118/styles.css'});
 await page.addScriptTag({type:'module',url:origin+'/automation/energy_context_ui/20261118/view.mjs'});
 await page.waitForFunction(()=>['withheld','source-qualified'].includes(document.getElementById('energyPolicyContext')?.dataset.state));
 const state=await page.locator('#energyPolicyContext').getAttribute('data-state');
 await page.locator('#energyPolicyContext>summary').click();
 assert.equal(await page.locator('#energyPolicyContext a[href*="data-centre-covenant"]').count()>0,true);
 const before=await page.evaluate(()=>JSON.stringify(window.pipelineHeadlineDocument));
 await page.locator('#energyPolicyContext button[data-news-topic="grid"]').click();
 assert.equal(await page.evaluate(()=>document.querySelector('.pn-news-filter-tools select[aria-label="News topic"]').value==='grid'||document.querySelector('.pn-news-header-search input').value==='grid'),true);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pipeline-journey-origin',{detail:{origin_type:'datacentre',origin_id:'dc:synthetic-origin'}})));
 await page.locator('#gridTab').click();await page.locator('#journeyNewsContext>summary').click();
 assert.match(await page.locator('#journeyNewsContext').innerText(),/DATACENTRE dc:synthetic-origin: topic context only/);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.pipelineHeadlineDocument)),before);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.equal(await page.locator('.pn-energy-context input').count(),0,'existing sole news search retained');
 await page.screenshot({path:resolve(out,`context-${width}.png`)});
 assert.deepEqual(errors,[]);receipts.push({width,reduced_motion:width===390,source:'actual_saved_feed_replay',policy_state:state,synthetic_origin:true,original_feed_unchanged:true,errors});await context.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));writeFileSync(resolve(out,'receipt.json'),JSON.stringify({edition,public_acceptance:false,receipts},null,2)+'\n');}
console.log(JSON.stringify(receipts));
