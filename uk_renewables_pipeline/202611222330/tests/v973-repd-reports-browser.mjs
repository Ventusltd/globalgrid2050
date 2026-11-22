import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const origin = "http://127.0.0.1:8765/uk_renewables_pipeline/202611222330/";
for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const viewport of [{width:393,height:852},{width:852,height:393}]) {
      const context = await browser.newContext({ viewport, isMobile:true, hasTouch:true, reducedMotion:"reduce" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://raw.githubusercontent.com/**", route => route.abort());
      try {
        await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForFunction(() =>
          document.querySelectorAll("#tbody tr[id^=repd-]").length === 50 &&
          !!document.querySelector("#tbody .pn-journey-link.atlaslink[href]"),
          { timeout: 90000 });
        const initialMap = await page.locator("#tbody .pn-journey-link.atlaslink[href]").first().getAttribute("href");
        assert.equal(new URL(initialMap).pathname, "/gridatlas/atlas/");
        for (const dimension of ["operator","status","region"]) {
          const button = page.locator('[data-repd-report="' + dimension + '"]');
          await button.click();
          assert.equal(await button.getAttribute("aria-pressed"), "true");
          const panel = page.locator("#repdReportsPanel");
          await panel.waitFor({state:"visible"});
          await page.waitForFunction(() => document.querySelector("#repdReportsSummary")?.textContent?.includes("7,775 projects"));
          const groups = await page.locator("#repdReportsBody .repd-report-group").count();
          assert.ok(groups >= 2, dimension + " must show full REPD grouping");
          const first = page.locator("#repdReportsBody .repd-report-group").first();
          await first.locator("summary").click();
          await first.locator(".repd-report-project").first().waitFor();
          const refLink = await first.locator(".repd-report-project a").first().getAttribute("href");
          assert.ok(new URL(refLink).searchParams.get("q"), dimension + " links into original REPD register");
          const mapLink = first.locator(".repd-report-map").first();
          if (await mapLink.count()) {
            const href = new URL(await mapLink.getAttribute("href"));
            assert.equal(href.origin + href.pathname,"https://ventusltd.github.io/gridatlas/atlas/");
            assert.ok(href.searchParams.get("repd_ref"));
          }
          await page.locator("#repdReportsClose").click();
          assert.equal(await panel.isVisible(), false);
          assert.equal(await button.getAttribute("aria-pressed"), "false");
        }
        // Live filters stay in the canonical register, and the filtered report reconciles.
        await page.locator('[data-repd-report="region"]').click();
        await page.locator("#repdReportScope").selectOption("filtered");
        await page.locator("#minMW").fill("1000");
        await page.locator("#applyMW").click();
        await page.waitForFunction(() => {
          const text = document.querySelector("#repdReportsSummary")?.textContent || "";
          const number = text.match(/([0-9,]+) projects/);
          return number && Number(number[1].replaceAll(",","")) < 7775;
        });
        const filtered = await page.locator("#repdReportsSummary").textContent();
        assert.ok(filtered.includes("Current REPD table filters"));
        await page.locator("#repdReportsClose").click();
        assert.ok(await page.locator("#tbody .pn-journey-link.atlaslink[href]").count() > 0);
        assert.deepEqual(errors, [], "No uncaught errors in REPD/report integration");
        console.log("PASS V9.73",name,viewport.width+"x"+viewport.height,"operator,status,region,drilldown,filtered,MAP");
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
