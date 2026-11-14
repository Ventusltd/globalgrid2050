import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
const require=createRequire(new URL("../uk_renewables_pipeline/202611132345/package.json",import.meta.url));
const {chromium}=require("playwright");
const OUT="/tmp/repd-q3-final-homepage";
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const width of [1440,390]){
  const ctx=await browser.newContext({viewport:{width,height:950}});
  const page=await ctx.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));
  const r=await page.goto("https://globalgrid2050.com/",{waitUntil:"domcontentloaded",timeout:45000});
  assert.equal(r?.status(),200);
  const link=page.locator('#pipeline-news a.launch');
  await link.waitFor({state:"attached",timeout:30000});
  const href=await link.getAttribute("href");
  assert.equal(href,"https://globalgrid2050.com/uk_renewables_pipeline/202611132345/");
  await page.screenshot({path:join(OUT,`homepage-${width}.png`),fullPage:true});
  await page.addInitScript(()=>{window.Chart=class{constructor(_c,config){this.data=config?.data;}update(){}destroy(){}};});
  await page.route("https://cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:""}));
  await page.locator("#pipeline-news > summary").click();
  await link.click();
  await page.waitForURL(href,{timeout:45000});
  await page.waitForFunction(()=>document.querySelector("#tbody")?.dataset.total==="7775",null,{timeout:45000});
  assert.equal(await page.locator("#tbody tr").count(),20);
  assert.deepEqual(errors,[],"homepage has uncaught JS errors");
  await page.screenshot({path:join(OUT,`pipeline-${width}.png`),fullPage:true});
  console.log(JSON.stringify({status:"PASS",width,operative:href,records:7775}));
  await ctx.close();
 }
}finally{await browser.close();}
