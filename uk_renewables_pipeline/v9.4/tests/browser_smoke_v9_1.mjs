import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire("/workspace/scratch/c4bced7b19ae/globalgrid2050-audit/uk_renewables_pipeline/v7/package.json");
const { chromium } = require("playwright");
const baseUrl = process.env.V9_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v9/";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.Chart = class ChartStub {
      constructor(_canvas, config) { this.data = config.data; }
      update() {}
    };
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 30000 });
  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => page.locator(selector).textContent())), ["356,474", "7,680", "4,100"]);
  assert.deepEqual(await page.locator("#tech [data-technology]").evaluateAll((buttons) => buttons.map((button) => button.dataset.technology)), ["all", "solar", "bess", "wind_onshore", "wind_offshore"]);

  await page.locator('[data-technology="wind_offshore"]').click();
  assert.equal(await page.locator("#tbody tr").count(), 109);
  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => page.locator(selector).textContent())), ["80,535", "109", "4,100"]);

  await page.locator('[data-technology="all"]').click();
  await page.locator("#search").fill("12453");
  assert.equal(await page.locator("#tbody tr").count(), 1);
  assert.match(await page.locator("#tbody").textContent(), /GG2050-REPD-12453/);
  const atlas = new URL(await page.locator("#tbody .atlaslink").getAttribute("href"));
  assert.equal(atlas.searchParams.get("repd_ref"), "12453");
  assert.equal(atlas.searchParams.get("technology"), "bess");
  assert.deepEqual(errors, []);
  console.log("V9.1 browser smoke: PASS (three gauges, 7,680 rows, wind filters, canonical search and Atlas link)");
} finally {
  await browser.close();
}
