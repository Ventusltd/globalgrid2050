import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

// Real 7,775-record edition, not a fixture HTML model. Run from repo root
// after the immutable composer and python3 -m http.server 8765.
const origin = "http://127.0.0.1:8765/uk_renewables_pipeline/202611231400/";
const viewports = [
  {width:393,height:852, mobile:true},
  {width:852,height:393, mobile:true},
  {width:1280,height:800, mobile:false}
];
for (const [engineName, engine] of [["chromium",chromium],["webkit",webkit]]) {
  const browser = await engine.launch({headless:true});
  try {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport:{width:vp.width,height:vp.height},
        isMobile:vp.mobile, hasTouch:vp.mobile,reducedMotion:"reduce"
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e=>errors.push(e.message));
      page.on("console", m=>{if(m.type()==="error" && /cockpit|repd-reports/i.test(m.text()))errors.push(m.text());});
      await page.route("https://raw.githubusercontent.com/**", route=>route.abort());
      try {
        await page.goto(origin,{waitUntil:"domcontentloaded",timeout:90000});
        await page.waitForFunction(() =>
          document.querySelectorAll("#tbody tr[id^=repd-]").length >= 50 &&
          document.querySelector('[data-technology="solar"][aria-pressed="true"]'),
          {timeout:90000});
        const baseline = await page.evaluate(()=>({
          theme:Object.fromEntries(["--solar","--bess","--ok","--accent","--off"]
            .map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue(k).trim()])),
          charts:[...document.querySelectorAll("#repdPanel .hud-gauges canvas")].length,
          news:!!document.querySelector("#headlineTicker"),
          nativeMap:document.querySelector("#tbody .atlaslink[href]")?.getAttribute("href"),
        }));
        assert.deepEqual(baseline.theme,{
          "--solar":"#ffff00","--bess":"#ffae00","--ok":"#00ff88",
          "--accent":"#00ffff","--off":"#0066ff"
        });
        assert.equal(baseline.charts,3);
        assert.equal(baseline.news,true);
        // The ONLY existing OPERATOR MW button is reused.
        assert.equal(await page.locator('[data-repd-report="operator"]').count(),1);
        await page.locator('[data-repd-report="operator"]').click();
        await page.locator("#repdReportsPanel").waitFor({state:"visible"});
        await page.waitForFunction(() =>
          /SOLAR/.test(document.querySelector("#repdReportsSummary")?.textContent||"") &&
          Number((document.querySelector("#repdReportsSummary")?.textContent||"").match(/SELECTED ([0-9,]+)/)?.[1].replaceAll(",",""))>0);
        const solarSummary=await page.locator("#repdReportsSummary").textContent();
        assert.match(solarSummary,/SOLAR/);
        const solarMatches=Number(solarSummary.match(/SELECTED ([0-9,]+)/)[1].replaceAll(",",""));
        assert.ok(solarMatches<7775 && solarMatches>100);
        assert.equal(await page.locator("#repdReportsBody .repd-report-group").count()>2,true);
        const first=page.locator("#repdReportsBody .repd-report-group").first();
        assert.match(await first.locator(".repd-report-name").textContent(),/^#1 /);
        await first.locator("summary").click();
        await first.locator(".repd-report-project").first().waitFor({state:"visible"});
        const link=await first.locator(".repd-report-project a").first().getAttribute("href");
        assert.equal(new URL(link).searchParams.get("technology"),"solar");
        assert.ok(new URL(link).searchParams.get("q"));
        const map=first.locator(".repd-report-map").first();
        if(await map.count()){
          const mapLink=new URL(await map.getAttribute("href"));
          assert.equal(mapLink.origin+mapLink.pathname,"https://ventusltd.github.io/gridatlas/atlas/");
          assert.ok(mapLink.searchParams.get("repd_ref"));
        }
        await page.locator("#repdFacetStatus").selectOption("Operational");
        await page.waitForFunction(()=>document.querySelector("#repdReportsSummary")?.textContent?.includes("Operational"));
        const selectedOperator=await page.locator("#repdFacetOperator option").evaluateAll(
          opts=>opts.find(x=>x.value!=="All")?.value);
        assert.ok(selectedOperator);
        await page.locator("#repdFacetOperator").selectOption(selectedOperator);
        const selectedRegion=await page.locator("#repdFacetRegion option").evaluateAll(
          opts=>opts.find(x=>x.value!=="All")?.value);
        if(selectedRegion)await page.locator("#repdFacetRegion").selectOption(selectedRegion);
        for(const view of ["status","region","operator"]){
          await page.locator('[data-repd-report="'+view+'"]').click();
          assert.equal(await page.locator("#repdFacetOperator").inputValue(),selectedOperator);
          assert.equal(await page.locator("#repdFacetStatus").inputValue(),"Operational");
          if(selectedRegion)assert.equal(await page.locator("#repdFacetRegion").inputValue(),selectedRegion);
          assert.match(await page.locator("#repdReportsSummary").textContent(),/SOLAR/);
        }
        // Restore ALL report facets, then inspect top-level BESS tab and wind buttons.
        await page.locator("#repdFacetOperator").selectOption("All");
        await page.locator("#repdFacetRegion").selectOption("All");
        await page.locator("#repdFacetStatus").selectOption("FOLLOW");
        await page.locator("#bessTab").click();
        await page.waitForFunction(() => document.querySelector('#tech [data-technology="bess"]')?.getAttribute("aria-pressed")==="true"
          && /BESS/.test(document.querySelector("#repdReportsSummary")?.textContent||""));
        assert.match(await page.locator("#repdReportsSummary").textContent(),/BESS/);
        assert.ok(await page.locator("#repdReportsBody .repd-report-group").count()>1);
        const details=page.locator("details.compact-register-filters");
        await details.locator("summary").click();
        for (const category of ["wind_onshore","wind_offshore","solar"]) {
          await page.locator('#tech [data-technology="'+category+'"]').click();
          await page.waitForFunction(cat => {
            const selected=document.querySelector("#tech [data-technology][aria-pressed=true]");
            return selected?.dataset.technology===cat;
          },category);
          assert.match((await page.locator("#repdReportsSummary").textContent()).toUpperCase(),
            new RegExp(category.replace("_"," ").toUpperCase()));
        }
        // Facet must not rewrite the source palette nor the original MAP or A4.
        const after=await page.evaluate(()=>({
          theme:Object.fromEntries(["--solar","--bess","--ok","--accent","--off"]
            .map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue(k).trim()])),
          charts:[...document.querySelectorAll("#repdPanel .hud-gauges canvas")].length,
          news:!!document.querySelector("#headlineTicker"),
          a4:!!document.querySelector('script[src="report-a4.mjs"]')
        }));
        assert.deepEqual(after.theme,baseline.theme);
        assert.equal(after.charts,3);
        assert.ok(after.news && after.a4);
        assert.deepEqual(errors,[]);
        console.log("PASS V9.74",engineName,vp.width+"x"+vp.height,
          "solar operator ranking, status/operator/region facets, BESS, both winds, MAP, A4 and palette");
      } finally {await context.close();}
    }
  } finally {await browser.close();}
}
