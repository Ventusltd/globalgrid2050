import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const baseUrl = process.env.V9_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v9/";

async function preparePage(browser, { chartStub = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  if (chartStub) {
    await page.addInitScript(() => {
      window.Chart = class ChartStub {
        constructor(_canvas, config) { this.data = config.data; }
        update() {}
      };
    });
  }
  await page.route("https://cdn.jsdelivr.net/**", (route) => (
    chartStub
      ? route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
      : route.abort()
  ));
  return { context, page };
}

const browser = await chromium.launch({ headless: true });
try {
  const { context, page } = await preparePage(browser);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll("#stories .story").length > 0, null, { timeout: 30000 });

  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => page.locator(selector).textContent())), ["356,474.09", "7,680", "4,100"]);
  assert.equal(await page.locator("thead th").count(), 8);
  assert.equal(await page.locator("#resultsMeta").getAttribute("data-filtered-count"), "7680");
  assert.equal(await page.locator("#releaseMeta").textContent(), "V9.3 interface · V9.1 canonical data spine · all 7,680 qualifying records loaded");
  assert.equal(await page.locator(".gauges").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 3);

  await page.setViewportSize({ width: 900, height: 1000 });
  assert.equal(await page.locator(".gauges").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 3);
  assert.equal(await page.locator(".header").evaluate((element) => getComputedStyle(element).flexDirection), "row");

  for (const width of [390, 430, 440, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const mobile = await page.evaluate(() => {
      const selectors = [".main", ".header", ".status", ".newspaper", ".tablewrap"];
      const bounds = Object.fromEntries(selectors.map((selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return [selector, { left: rect.left, right: rect.right }];
      }));
      return {
        bodyDisplay: getComputedStyle(document.body).display,
        gaugeColumns: getComputedStyle(document.querySelector(".gauges")).gridTemplateColumns.split(" ").length,
        storyColumns: getComputedStyle(document.querySelector(".stories")).gridTemplateColumns.split(" ").length,
        headerDirection: getComputedStyle(document.querySelector(".header")).flexDirection,
        statusWhiteSpace: getComputedStyle(document.querySelector(".status")).whiteSpace,
        searchWidth: Math.round(document.querySelector("#search").getBoundingClientRect().width),
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bounds,
      };
    });
    assert.equal(mobile.bodyDisplay, "block", `${width}px body layout`);
    assert.equal(mobile.gaugeColumns, 1, `${width}px gauge columns`);
    assert.equal(mobile.storyColumns, 1, `${width}px story columns`);
    assert.equal(mobile.headerDirection, "column", `${width}px header direction`);
    assert.equal(mobile.statusWhiteSpace, "normal", `${width}px status wrapping`);
    assert.ok(mobile.searchWidth >= width - 50, `${width}px search width`);
    assert.ok(mobile.scrollWidth <= mobile.clientWidth, `${width}px document overflow: ${mobile.scrollWidth}px > ${mobile.clientWidth}px`);
    for (const [selector, bounds] of Object.entries(mobile.bounds)) {
      assert.ok(bounds.left >= -0.5, `${width}px ${selector} crosses left edge`);
      assert.ok(bounds.right <= width + 0.5, `${width}px ${selector} crosses right edge`);
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-technology="wind_offshore"]').click();
  assert.equal(await page.locator("#tbody tr").count(), 109);
  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => page.locator(selector).textContent())), ["80,535.3", "109", "4,100"]);

  await page.locator("#clearFilters").click();
  await page.locator("#search").fill("GG2050-REPD-9873 Berwick");
  assert.equal(await page.locator("#tbody tr").count(), 1);
  const atlas = new URL(await page.locator("#tbody .atlaslink").getAttribute("href"));
  assert.equal(atlas.searchParams.get("repd_ref"), "9873");
  assert.equal(atlas.searchParams.get("technology"), "wind_offshore");

  await page.locator("#tbody .project-record summary").click();
  assert.equal(await page.locator("#tbody .project-record").getAttribute("open"), "");
  assert.match(await page.locator("#tbody .record-grid").textContent(), /PLANNING AUTHORITY/);

  await page.locator("#tbody .copy-id").click();
  assert.equal(await page.locator("#tbody .copy-id").textContent(), "COPIED");

  const missingRef = await page.evaluate(async () => {
    const manifest = await fetch("data/v9.1/build_manifest.json").then((response) => response.json());
    for (const partition of manifest.project_partitions) {
      const payload = await fetch(partition.path).then((response) => response.json());
      const missing = payload.projects.find((project) => project.geometry_status !== "valid");
      if (missing) return missing.repd_ref;
    }
    return "";
  });
  assert.ok(missingRef);
  await page.locator("#search").fill(missingRef);
  assert.equal(await page.locator("#tbody tr").count(), 1);
  assert.equal(await page.locator("#tbody .action-disabled").textContent(), "NO MAP");
  assert.equal(await page.locator("#tbody .atlaslink").count(), 0);

  await page.locator('[data-news="RELEVANT"]').click();
  const relevantCount = await page.locator("#stories .story").count();
  assert.ok(relevantCount > 0 && relevantCount < 125);
  await page.locator('[data-news="ALL"]').click();

  await page.locator("#search").fill("definitely-no-such-repd-project-v9-3");
  assert.equal(await page.locator("#tbody tr").count(), 0);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportInline").click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^globalgrid2050_uk_renewables_pipeline_v9_3_\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await download.path(), "utf8");
  assert.equal(csv.trimEnd().split(/\r?\n/).length, 1);
  assert.match(csv, /Site Name/);

  assert.deepEqual(errors, []);
  await context.close();

  const newsFailure = await preparePage(browser);
  await newsFailure.page.route("**/dist/major_project_news_v5.json*", (route) => route.abort());
  await newsFailure.page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await newsFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await newsFailure.page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 60000 });
  await newsFailure.page.waitForFunction(() => document.querySelector("#newsMeta").textContent === "feed unavailable");
  await newsFailure.context.close();

  const projectFailure = await preparePage(browser);
  await projectFailure.page.route("**/contracts/release.v9.3.json*", (route) => route.abort());
  await projectFailure.page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await projectFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await projectFailure.page.waitForFunction(() => document.querySelectorAll("#stories .story").length > 0, null, { timeout: 30000 });
  await projectFailure.page.waitForFunction(() => document.querySelector("#tbody").textContent.includes("V9.3 has failed closed."));
  await projectFailure.context.close();

  const chartFailure = await preparePage(browser, { chartStub: false });
  await chartFailure.page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await chartFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await chartFailure.page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 60000 });
  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => chartFailure.page.locator(selector).textContent())), ["356,474.09", "7,680", "4,100"]);
  await chartFailure.context.close();

  console.log("V9.3 browser smoke: PASS (V5/V7.1 mobile, full pipeline, filters, CSV, news isolation and exact wind Atlas URL)");
} finally {
  await browser.close();
}
