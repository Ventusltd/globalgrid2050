/* Source-host integration. PREVIEW=1 composes the additive module into V9.42
 * only in a local HTTP response; this is not public/edition acceptance. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const edition=process.env.PN_JOURNEY_EDITION||'202611172355',preview=process.env.PN_JOURNEY_HOST_PREVIEW==='1';
assert.match(edition,/^\d{12}$/);const output=process.env.PN_JOURNEY_OUT||resolve(root,'work/journey-entry');mkdirSync(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'D:/githubfiles/.qa-tools/node/node_modules/playwright/index.mjs').href);
const entryPath='/uk_renewables_pipeline/'+edition+'/';
for(const file of ['view.mjs','model.mjs','styles.css'])assert.ok(existsSync(new URL('./'+file,import.meta.url)),'materialize Journey module in sparse checkout: '+file);
const server=createServer((req,res)=>{try{const url=new URL(req.url,'http://local');let p=resolve(root,'.'+decodeURIComponent(url.pathname));assert.ok(p.startsWith(root+sep));if(url.pathname.endsWith('/'))p=resolve(p,'index.html');let bytes=readFileSync(p);if(url.pathname===entryPath||url.pathname===entryPath+'index.html'){
 const html=bytes.toString();if(preview)bytes=Buffer.from(html.replace('</body>','<link rel="stylesheet" href="/automation/journey_entry_ui/20261118/styles.css"><script type="module" src="/automation/journey_entry_ui/20261118/view.mjs"></script></body>'));else assert.ok(html.includes('journey_entry_ui/20261118/view.mjs'),'actual candidate must load Journey entry itself');
 }res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[extname(p)]||'application/octet-stream');res.end(bytes)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),report={scope:preview?'controlled local host composition; not a published edition':'actual local candidate entry integration',edition,results:[]};
try{for(const width of [393,1440]){
 const context=await browser.newContext({viewport:{width,height:852},isMobile:width<500,hasTouch:width<500}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result={width,started:new Date().toISOString(),errors,consoleErrors:[],httpErrors:[]};report.results.push(result);page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text())});page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()})});
 const inspect=async link=>{
  await link.scrollIntoViewIfNeeded();return link.evaluate(a=>{const r=a.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{href:a.href,width:r.width,height:r.height,reachable:h===a||a.contains(h)}});
 };
 try{
 await page.goto(base+entryPath+'?technology=all',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)>0);
 await page.locator('#clearFilters').click();await page.locator('#search').fill('2470');const repd=page.locator('#tbody .pn-journey-link').first();await repd.waitFor();result.repd=await inspect(repd);assert.equal(new URL(result.repd.href).searchParams.get('origin_id'),'repd:2470');assert.ok(result.repd.reachable&&result.repd.width>=62&&result.repd.height>=44);await page.screenshot({path:resolve(output,'repd-'+width+'.png')});
 await page.locator('.pipeline-tabs [data-view="grid"]').click();const sub=page.locator('#gridLayerHost tr[data-source-id] .pn-journey-link').first();await sub.waitFor({timeout:60000});result.substation=await inspect(sub);assert.equal(new URL(result.substation.href).searchParams.get('origin_type'),'substation');assert.ok(result.substation.reachable&&result.substation.width>=62&&result.substation.height>=44);await page.screenshot({path:resolve(output,'substation-'+width+'.png')});
 await page.locator('.pipeline-tabs [data-view="datacentre"]').click();await page.waitForFunction(()=>document.getElementById('datacentreHost')?.dataset.locationsState==='available',null,{timeout:60000});const dc=page.locator('#datacentreHost .ggdc-location-actions .pn-journey-link').first();await dc.waitFor();result.datacentre=await inspect(dc);assert.equal(new URL(result.datacentre.href).searchParams.get('origin_type'),'datacentre');assert.ok(result.datacentre.reachable&&result.datacentre.width>=62&&result.datacentre.height>=44);await page.screenshot({path:resolve(output,'datacentre-'+width+'.png')});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);assert.deepEqual(result.httpErrors.filter(r=>r.url.startsWith(base)),[],'same-origin source assets must load');result.pass=true;
 }catch(e){result.pass=false;result.error=String(e);result.debug=await page.evaluate(()=>({api:!!window.pipelineJourneyEntry,total:document.querySelector('#tbody')?.dataset.total,query:document.querySelector('#search')?.value,maps:[...document.querySelectorAll('#tbody a.atlaslink')].slice(0,3).map(a=>a.outerHTML),journeyCount:document.querySelectorAll('.pn-journey-link').length}));throw e}
 finally{result.finished=new Date().toISOString();writeFileSync(resolve(output,'receipt.json'),JSON.stringify(report,null,2)+'\n');await context.close()}
}}finally{await browser.close();await new Promise(r=>server.close(r))}
console.log(JSON.stringify(report));
