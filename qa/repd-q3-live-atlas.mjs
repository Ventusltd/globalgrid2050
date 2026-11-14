import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
const require = createRequire(new URL("../uk_renewables_pipeline/202611132345/package.json", import.meta.url));
const { chromium } = require("playwright");
const BASE = process.env.REPD_BASE_URL || "https://globalgrid2050.com/uk_renewables_pipeline/202611132345/";
const OUT = process.env.REPD_QA_ARTIFACTS || "/tmp/repd-served-byte-qa";
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const source = await ctx.newPage();
  await source.addInitScript(() => { window.Chart = class { constructor(_c, config) { this.data = config?.data; } update() {} destroy() {} }; });
  await source.route("https://cdn.jsdelivr.net/**", route => route.fulfill({status:200,contentType:"application/javascript",body:""}));
  const r = await source.goto(BASE, { waitUntil:"domcontentloaded",timeout:45000 });
  assert.equal(r?.status(), 200);
  await source.waitForFunction(() => document.querySelector("#tbody")?.dataset.total === "7775",null,{timeout:45000});
  const hrefs = await source.locator('#tbody a[href*="gridatlas"]').evaluateAll(a => a.map(x=>x.href).filter(h=>h.includes("repd_ref=") && h.includes("latitude=")));
  assert.ok(hrefs.length >= 2, "Need two rendered located MAP links");
  await source.close();
  await ctx.close();
  const receiverCtx = await browser.newContext({ viewport: {width:1440,height:900} });
  for (const href of hrefs.slice(0,2)) {
    const target = new URL(href);
    assert.equal(target.hostname,"ventusltd.github.io","Unexpected MAP receiver host");
    assert.ok(target.pathname.startsWith("/gridatlas/atlas/"),"Unexpected MAP receiver path");
    const ref = target.searchParams.get("repd_ref");
    const page = await receiverCtx.newPage();
    const rr = await page.goto(href,{waitUntil:"domcontentloaded",timeout:45000});
    assert.equal(rr?.status(),200,"Atlas receiver must serve");
    await page.waitForFunction(() => /Nearest\s+\d+\s*kV substation:/.test(document.body.innerText),null,{timeout:60000});
    const body = await page.locator("body").innerText();
    assert.ok(body.includes(`REPD ${ref}`),`Atlas returned wrong REPD identity for ${ref}`);
    await page.screenshot({path:join(OUT,`atlas-repd-${ref}.png`),fullPage:false});
    console.log(JSON.stringify({result:"PASS",ref,receiver:target.origin+target.pathname}));
    await page.close();
  }
  await receiverCtx.close();
} finally { await browser.close(); }
