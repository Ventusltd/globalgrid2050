import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDirectory, "../../..");
const newsBody = fs.readFileSync(path.join(repoRoot, "dist/major_project_news_v5.json"));
const baseUrl = process.env.V7_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v7/";

async function preparePage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.Chart = class ChartParityStub {
      constructor(_canvas, config) {
        this.data = config.data;
      }
      update() {}
    };
  });
  await page.route("https://cdn.jsdelivr.net/npm/chart.js", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "",
  }));
  return { context, page };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context, page } = await preparePage(browser);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: newsBody,
    }));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 5210);
    await page.waitForFunction(() => document.querySelectorAll("#stories .story").length === 125);
    assert.equal(await page.locator("#v1").textContent(), "262,397");
    assert.equal(await page.locator("#v2").textContent(), "5,210");
    assert.equal(await page.locator("#v3").textContent(), "4,100");
    assert.match(await page.locator("#newsMeta").textContent(), /^125 headlines · 559 eligible projects/);

    await page.locator('[data-tech="Solar"]').click();
    assert.equal(await page.locator("#tbody tr").count(), 2667);
    assert.equal(await page.locator("#v1").textContent(), "52,866");
    assert.equal(await page.locator("#v2").textContent(), "2,667");
    assert.equal(await page.locator("#v3").textContent(), "840");

    await page.locator('[data-tech="All"]').click();
    await page.locator("#search").fill("BERWICK BANK");
    assert.equal(await page.locator("#tbody tr").count(), 1);
    assert.match(await page.locator("#tbody tr").first().textContent(), /Berwick Bank Offshore Wind Farm/);
    await page.locator("#search").fill("");

    await page.locator('[data-news="BESS"]').click();
    assert.equal(await page.locator("#stories .story").count(), 56);
    await page.locator('[data-news="FINANCE"]').click();
    assert.equal(await page.locator("#stories .story").count(), 34);
    await page.locator('[data-news="ALL"]').click();

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export").click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^globalgrid2050_uk_renewables_pipeline_v7_1_\d{4}-\d{2}-\d{2}\.csv$/);
    const bytes = fs.readFileSync(await download.path());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.match(bytes.toString("utf8", 3, 110), /^Site Name,County,Operator,Technology,REPD Status,Capacity MW,News Signal,News Signal Note/);

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
          storyColumns: getComputedStyle(document.querySelector(".stories")).gridTemplateColumns.split(" ").length,
          searchWidth: Math.round(document.querySelector("#search").getBoundingClientRect().width),
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bounds,
        };
      });
      assert.equal(mobile.bodyDisplay, "block", `${width}px body layout`);
      assert.equal(mobile.storyColumns, 1, `${width}px story columns`);
      assert.ok(mobile.searchWidth >= width - 50, `${width}px search width`);
      assert.ok(
        mobile.scrollWidth <= mobile.clientWidth,
        `${width}px document overflow: ${mobile.scrollWidth}px > ${mobile.clientWidth}px`,
      );
      for (const [selector, bounds] of Object.entries(mobile.bounds)) {
        assert.ok(bounds.left >= -0.5, `${width}px ${selector} crosses left edge`);
        assert.ok(bounds.right <= width + 0.5, `${width}px ${selector} crosses right edge`);
      }
    }
    assert.deepEqual(pageErrors, []);
    await context.close();

    const newsFailure = await preparePage(browser);
    await newsFailure.page.route("**/dist/major_project_news_v5.json*", (route) => route.abort());
    await newsFailure.page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
    await newsFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await newsFailure.page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 5210);
    await newsFailure.page.waitForFunction(() => document.querySelector("#newsMeta").textContent === "feed unavailable");
    await newsFailure.context.close();

    const projectFailure = await preparePage(browser);
    await projectFailure.page.route("**/dist/repd_master.json*", (route) => route.abort());
    await projectFailure.page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: newsBody,
    }));
    await projectFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await projectFailure.page.waitForFunction(() => document.querySelectorAll("#stories .story").length === 125);
    await projectFailure.page.waitForFunction(() => document.querySelector("#tbody").textContent.includes("Error loading REPD data."));
    await projectFailure.context.close();

    console.log("V7.1 browser smoke: PASS (desktop, mobile, filters, CSV, independent failures)");
  } finally {
    await browser.close();
  }
}

await main();
