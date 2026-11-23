import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";
const root="http://127.0.0.1:8765/uk_renewables_pipeline/202611231600/";
const viewports=[{width:393,height:852},{width:852,height:393},{width:1280,height:800}];
for(const [engineName,engine] of [["chromium",chromium],["webkit",webkit]]) {
 const browser=await engine.launch({headless:true});
 try {
  for(const viewport of viewports) {
   const page=await browser.newPage({viewport});
   const errors=[];
   page.on("pageerror",err=>errors.push(String(err)));
   page.on("response",r=>{if(r.status()>=400 && /repd-reports|operator-aliases|projects-v9-8/.test(r.url()))errors.push("HTTP "+r.status()+" "+r.url());});
   try {
    await page.goto(root,{waitUntil:"domcontentloaded",timeout:60000});
    await page.waitForFunction(()=>{
      const v=Number((document.getElementById("v2")?.textContent||"0").replaceAll(",",""));
      return v===3604;
    },null,{timeout:60000});
    assert.equal(await page.locator("#status").count(),1);
    assert.equal(await page.locator("#repdNativeStatus").count(),1);
    assert.equal(await page.locator("#repdNativeOperator").count(),1);
    assert.equal(await page.locator("#repdNativeRegion").count(),1);
    assert.ok(await page.locator("#repdNativeStatus option").count()>5);
    assert.ok(await page.locator("#repdNativeOperator option").count()>20);
    assert.equal(await page.locator("#repdReportScope").count(),0);
    assert.equal(await page.getByText(/COCKPIT/i).count(),0);
    assert.equal(await page.locator('[data-repd-report="operator"]').count(),1);
    await page.locator('[data-repd-report="operator"]').click();
    await page.locator("#repdReportsPanel").waitFor({state:"visible"});
    await page.locator("#repdReportsBody table").waitFor({state:"visible"});
    assert.ok(await page.locator("#repdReportsBody tbody tr").count()>10);
    const first=await page.evaluate(()=>({
      report:getComputedStyle(document.querySelector("#repdReportsBody th")).color,
      original:getComputedStyle(document.querySelector("#repdScroll th")).color
    }));
    assert.equal(first.report,first.original,"Native REPD header colour");
    let summary=await page.locator("#repdReportsSummary").textContent();
    assert.match(summary,/SELECTED 3,604/);
    await page.locator("#repdNativeStatus").selectOption("Operational");
    await page.waitForFunction(()=>{
      const v=Number((document.getElementById("v2")?.textContent||"0").replaceAll(",",""));
      const r=document.querySelector("#repdReportsSummary")?.textContent||"";
      const t=Number(document.querySelector("#tbody")?.dataset.total||0);
      return v>0&&v<3604&&t===v&&r.includes("SELECTED "+v.toLocaleString("en-GB"));
    },null,{timeout:15000});
    assert.equal(await page.locator("#repdNativeStatus").inputValue(),"Operational");
    await page.locator("#repdNativeStatus").selectOption("All");
    assert.ok((await page.locator("#repdNativeOperator option").allTextContents()).includes("Low Carbon"));
    await page.locator("#repdNativeOperator").selectOption("Low Carbon");
    await page.waitForFunction(()=>{
      const n=Number((document.getElementById("v2")?.textContent||"0").replaceAll(",",""));
      return n>0&&n<3604&&Number(document.querySelector("#tbody")?.dataset.total||0)===n;
    },null,{timeout:15000});
    const aliasRows=await page.locator("#tbody tr").count();
    assert.ok(aliasRows>0,"Alias selection returns original REPD project rows");
    await page.locator("#repdNativeOperator").selectOption("All");
    await page.locator('[data-repd-report="region"]').click();
    assert.equal(await page.locator("#repdReportsBody th").count(),5);
    const region=await page.locator("#repdNativeRegion option").nth(1).getAttribute("value");
    if(region) {
      await page.locator("#repdNativeRegion").selectOption(region);
      await page.waitForFunction(()=>document.querySelector("#repdNativeRegion").value!=="All");
      const n=Number((await page.locator("#v2").textContent()).replaceAll(",",""));
      assert.equal(Number(await page.locator("#tbody").getAttribute("data-total")),n);
    }
    await page.locator("#repdNativeRegion").selectOption("All");
    await page.locator('details.compact-register-filters > summary').click();
    await page.locator('#tech [data-technology="bess"]').click();
    await page.waitForFunction(()=>document.querySelector('#tech [data-technology="bess"]')?.getAttribute("aria-pressed")==="true");
    const bessCount=Number((await page.locator("#v2").textContent()).replaceAll(",",""));
    assert.ok(bessCount>0&&bessCount!==3604);
    assert.match((await page.locator("#repdReportsSummary").textContent()).toUpperCase(),/BESS/);
    assert.ok(await page.locator('script[src="report-a4.mjs"]').count()===1);
    assert.ok(await page.locator('script[src="map-entry.mjs"]').count()===1);
    assert.equal(errors.length,0,errors.join("\n"));
    console.log("PASS",engineName,viewport.width+"x"+viewport.height,
      "V9.75 3604 solar, unified status/operator/region, original table colours, BESS, MAP/A4");
   } finally {await page.close();}
  }
 } finally {await browser.close();}
}
