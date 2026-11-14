import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const require = createRequire(new URL("../../202611132345/package.json", import.meta.url));
const { chromium } = require("playwright");
const base = process.env.ENERGY24_BASE || "http://127.0.0.1:8765/uk_renewables_pipeline/energy24/";
const output = process.env.ENERGY24_ARTIFACTS || "/tmp/energy24-browser";
await mkdir(output, { recursive: true });

const now = new Date().toISOString();
const template = {
  schema:"globalgrid2050.energy24.news.v1",release:"2026q3",generated_utc:now,
  sources:[{id:"desnz",status:"OK"},{id:"dcd",status:"OK"}],
  articles:[
    {id:"a".repeat(64),headline:"REPD 9873: 4,100MW wind development advances through the planning process",
      url:"https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero",
      source:"DESNZ",published_utc:now,category:"uk-repd",repd_ref:"9873",capacity_mw:4100,
      capex_usd:null,evidence_tier:"official",priority:130},
    {id:"b".repeat(64),headline:"UK data centre announces US$50 million investment",
      url:"https://www.datacenterdynamics.com/rss/",
      source:"Data Center Dynamics",published_utc:now,category:"data-centres",
      repd_ref:null,capacity_mw:null,capex_usd:50000000,evidence_tier:"attributed",priority:90},
    {id:"c".repeat(64),headline:"Cloud cybersecurity incident prompts infrastructure review",
      url:"https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero",
      source:"DESNZ",published_utc:now,category:"cybersecurity",
      repd_ref:null,capacity_mw:null,capex_usd:null,evidence_tier:"official",strategic_context:true,priority:25},
    {id:"d".repeat(64),headline:"Unverified solar 5MW item",
      url:"https://www.pv-magazine.com/feed/",
      source:"pv magazine",published_utc:now,category:"global-projects",
      repd_ref:null,capacity_mw:5,capex_usd:null,evidence_tier:"attributed",priority:100},
    {id:"e".repeat(64),headline:"REPD 9999999 unrelated 100MW project",
      url:"https://www.gov.uk/government/organisations/department-for-energy-security-and-net-zero",
      source:"DESNZ",published_utc:now,category:"uk-repd",
      repd_ref:"9999999",capacity_mw:100,capex_usd:null,evidence_tier:"official",priority:150},
  ],
};

const browser = await chromium.launch({headless:true});
const reports=[];
try {
 for(const width of [1440,430,390]){
   const ctx = await browser.newContext({viewport:{width,height:930}});
   const page = await ctx.newPage();
   const errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   await page.route("**/uk_renewables_pipeline/energy24/data/news.latest.json",r=>
     r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(template)}));
   const res=await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
   assert.equal(res?.status(),200);
   await page.waitForFunction(()=>document.querySelectorAll("#projects-table tr").length===12 &&
     document.getElementById("feed-state")?.textContent==="NEWS SCAN VERIFIED",null,{timeout:45000});
   assert.equal((await page.locator("#repd-rows").innerText()).trim(),"14,967");
   assert.equal(await page.locator(".market time").count(),6);
   for(const time of await page.locator(".market time").allInnerTexts())
     assert.match(time,/\d{2}:\d{2}/);
   assert.match(await page.locator("#lead-story").innerText(),/REPD 9873/);
   assert.match(await page.locator("#stories").innerText(),/US\$50 million/);
   assert.doesNotMatch(await page.locator("#stories").innerText(),/Unverified solar 5MW|REPD 9999999/);
   await page.locator('[data-filter="data-centres"]').click();
   assert.equal(await page.locator("#stories .story-card").count(),1);
   assert.match(await page.locator("#stories").innerText(),/data centre/i);
   await page.locator('[data-filter="cybersecurity"]').click();
   assert.equal(await page.locator("#stories .story-card").count(),1);
   await page.locator('[data-filter="all"]').click();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=3,"Page has horizontal body overflow: "+overflow+"px at "+width);
   assert.deepEqual(errors,[],"JavaScript errors at "+width+"px");
   await page.screenshot({path:join(output,"energy24-"+width+".png"),fullPage:true});
   reports.push({width,result:"PASS",projects:12,news:3,timezone_clocks:6,js_errors:0});
   await ctx.close();
 }
 const ctx=await browser.newContext();
 const page=await ctx.newPage();
 await page.goto(base,{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.getElementById("feed-state")?.textContent==="NEWS FEED UNAVAILABLE",null,{timeout:45000});
 assert.equal(await page.locator("#stories .story-card").count(),0);
 await ctx.close();
 console.log(JSON.stringify({result:"PASS",reports},null,2));
}finally{await browser.close();}
