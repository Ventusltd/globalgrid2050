import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

const ownRoot=resolve(import.meta.dirname,'../..');
const root=resolve(process.env.REPD_EXPAND_ROOT||ownRoot);
const edition=process.env.REPD_EXPAND_EDITION||'uk_renewables_pipeline/202611170512';
const out=resolve(process.env.REPD_EXPAND_OUT||'D:/githubfiles/.qa-artifacts/repd-expand-agent-b');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
mkdirSync(out,{recursive:true});
const css='/automation/repd_expand_ui/expand.css',js='/automation/repd_expand_ui/expand.mjs';
const server=createServer((req,res)=>{
  try{
    let path=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(path.endsWith('/'))path+='index.html';
    const sourceRoot=[css,js].includes(path)?ownRoot:root;
    const file=resolve(sourceRoot,'.'+path);
    assert.ok(file.startsWith(sourceRoot+sep));
    let bytes=readFileSync(file);
    if(path==='/'+edition+'/index.html'){
      let html=bytes.toString();
      if(!html.includes('repd_expand_ui/expand.css'))html=html.replace('</head>',`<link rel="stylesheet" href="${css}"></head>`);
      if(!html.includes('repd_expand_ui/expand.mjs'))html=html.replace('</body>',`<script type="module" src="${js}"></script></body>`);
      bytes=Buffer.from(html);
    }
    res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'})[extname(file)]||'application/octet-stream');
    res.end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const proof={status:'RUNNING',edition,checks:[],limitations:['Local Chromium/touch emulation; physical handset and public deployment unverified.','External requests blocked; existing source data and local scripts used.']};
let browser;
try{
  browser=await chromium.launch({headless:true});
  for(const width of [390,393,1440]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(origin+'/'+edition+'/index.html?technology=all');
    await page.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)===7775);
    const trigger=page.locator('[data-repd-expand]'),modal=page.locator('.repd-expand-dialog');
    await page.locator('#search').fill('15149');
    await page.locator('#repd-15149').waitFor();
    await page.evaluate(()=>{window.originalRegister=document.querySelector('#officialRegister');window.originalRow=document.querySelector('#repd-15149');window.originalParent=originalRegister.parentElement;});
    const mapBefore=await page.locator('#repd-15149 .map-action, #repd-15149 a').first().getAttribute('href');
    await trigger.scrollIntoViewIfNeeded();
    const scrollBefore=await page.evaluate(()=>scrollY);
    await trigger.click();
    await modal.waitFor({state:'visible'});
    assert.equal(await trigger.getAttribute('aria-expanded'),'true');
    assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('repd-expand-close')),true);
    assert.equal(await page.evaluate(()=>document.querySelector('dialog #officialRegister')===originalRegister&&document.querySelector('#repd-15149')===originalRow),true);
    const bounds=await modal.boundingBox();
    assert.ok(Math.abs(bounds.x)<2&&Math.abs(bounds.y)<2&&Math.abs(bounds.width-width)<2&&Math.abs(bounds.height-844)<2,JSON.stringify(bounds));
    assert.equal(await page.locator('#search').inputValue(),'15149');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.closest('.repd-expand-dialog')!==null),true);
    const downloaded=page.waitForEvent('download');
    await page.locator('#exportInline').click();
    const download=await downloaded;assert.match(readFileSync(await download.path(),'utf8'),/15149/);
    // A second modal (for example a source note) closes before analytics does.
    await page.evaluate(()=>{const note=document.createElement('dialog');note.id='testNote';note.textContent='Nested note';document.body.append(note);note.showModal();});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#testNote').open);
    assert.equal(await modal.evaluate(n=>n.open),true);
    await page.evaluate(()=>document.querySelector('#testNote').remove());
    await page.locator('.repd-expand-close').click();
    await page.waitForFunction(()=>!document.querySelector('.repd-expand-dialog').open&&document.querySelector('#officialRegister')?.parentElement===originalParent);
    assert.equal(await page.evaluate(()=>document.querySelector('#officialRegister')===originalRegister&&originalRegister.parentElement===originalParent),true);
    assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    assert.equal(await trigger.evaluate(n=>document.activeElement===n),true);
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scrollBefore)<3);
    assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
    assert.equal(await page.locator('#search').inputValue(),'15149');
    assert.equal(await page.locator('#repd-15149 .map-action, #repd-15149 a').first().getAttribute('href'),mapBefore);
    // Repeat, pan the live table, rotate, then close with Escape.
    await trigger.click();
    await page.locator('.repd-expand-dialog .tablewrap').evaluate(n=>n.scrollLeft=200);
    const pan=await page.locator('.repd-expand-dialog .tablewrap').evaluate(n=>n.scrollLeft);
    if(width<500){
      await page.setViewportSize({width:915,height:412});
      const landscape=await modal.boundingBox();assert.ok(Math.abs(landscape.width-915)<2&&Math.abs(landscape.height-412)<2);
      await page.locator('.repd-expand-close').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('.repd-expand-close').isVisible());
      await page.setViewportSize({width,height:844});
    }
    await page.screenshot({path:resolve(out,`expanded-${width}.png`)});
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('.repd-expand-dialog').open&&document.querySelector('#officialRegister')?.parentElement===originalParent);
    assert.equal(await page.locator('#officialRegister .tablewrap').evaluate(n=>n.scrollLeft),pan);
    assert.equal(await page.evaluate(()=>document.querySelectorAll('#officialRegister').length),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    proof.checks.push({width,status:'PASS',checks:['viewport coverage','same live nodes','search/CSV/MAP preserved','focus containment/return','close and Escape','nested modal Escape','scroll restoration','repeat open/close','table pan retained',...(width<500?['portrait-landscape-return']:[])]});
    await context.close();
  }
  const fallback=await browser.newContext({viewport:{width:390,height:844}});
  await fallback.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await fallback.addInitScript(()=>{HTMLDialogElement.prototype.showModal=undefined;});
  const fallbackPage=await fallback.newPage();
  await fallbackPage.goto(origin+'/'+edition+'/index.html?technology=all');
  await fallbackPage.waitForFunction(()=>Number(document.querySelector('#tbody')?.dataset.total)===7775);
  assert.equal(await fallbackPage.locator('[data-repd-expand]').count(),0);
  assert.equal(await fallbackPage.locator('#officialRegister').isVisible(),true);
  proof.checks.push({status:'PASS',checks:['unsupported modal API retains ordinary dashboard']});
  await fallback.close();
  proof.status='PASS';
}catch(error){proof.status='FAIL';proof.error=String(error.stack||error);throw error;}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));writeFileSync(resolve(out,'receipt.json'),JSON.stringify(proof,null,2));}
console.log(JSON.stringify(proof,null,2));
