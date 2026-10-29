import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDirectory, "../../..");
const v8Root = path.resolve(testDirectory, "..");
const newsBody = fs.readFileSync(path.join(repoRoot, "dist/major_project_news_v5.json"));
const projectContract = JSON.parse(fs.readFileSync(
  path.join(v8Root, "contracts/projects-plugin.v7.2.json"),
  "utf8",
));
const expectedCsvHeader = projectContract.interface.export.columns
  .map(({ label }) => `"${label.replaceAll('"', '""')}"`)
  .join(",");
const baseUrl = process.env.V8_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v8/";

async function preparePage(browser, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.Chart = class ChartV81Stub {
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

async function serveFrozenNews(page) {
  await page.route("**/dist/major_project_news_v5.json*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: newsBody,
  }));
  await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: newsBody,
  }));
}

async function waitForMvp(page) {
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 766);
  await page.waitForFunction(() => document.querySelectorAll("#stories .story").length === 125);
}

async function assertGaugeValues(page, expected) {
  const actual = await Promise.all(["#v1", "#v2", "#v3", "#v4"].map(
    (selector) => page.locator(selector).textContent(),
  ));
  assert.deepEqual(actual, expected);
}

async function assertSearch(page, query, count, patterns = []) {
  await page.locator("#search").fill(query);
  assert.equal(await page.locator("#tbody tr").count(), count, `search ${query}`);
  const text = await page.locator("#tbody").textContent();
  patterns.forEach((pattern) => assert.match(text, pattern, `search ${query} contains ${pattern}`));
}

async function readDownload(download) {
  const downloadPath = await download.path();
  assert.ok(downloadPath, "download path is available");
  return fs.readFileSync(downloadPath);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context, page } = await preparePage(browser);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await serveFrozenNews(page);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await waitForMvp(page);

    assert.equal(await page.locator("#tbody tr").count(), 766);
    assert.equal(await page.locator("#stories .story").count(), 125);
    assert.match(await page.locator("#newsMeta").textContent(), /^125 headlines · 559 eligible projects/);
    assert.match(await page.locator(".strap").textContent(), /Legacy V5 newspaper · project bindings unverified/i);
    await assertGaugeValues(page, ["34,073.49", "106,338.18", "766", "1,450"]);

    assert.equal(await page.locator('[data-technology="wind"]').count(), 0);
    assert.deepEqual(
      await page.locator("#tech [data-technology]").evaluateAll((buttons) => (
        buttons.map((button) => button.dataset.technology)
      )),
      ["all", "solar", "bess"],
    );
    assert.equal(await page.locator("#tbody .badge").filter({ hasText: /wind/i }).count(), 0);

    await page.locator('[data-technology="solar"]').click();
    assert.equal(await page.locator("#tbody tr").count(), 384);
    await assertGaugeValues(page, ["34,073.49", "0", "384", "840"]);

    await page.locator('[data-technology="bess"]').click();
    assert.equal(await page.locator("#tbody tr").count(), 382);
    await assertGaugeValues(page, ["0", "106,338.18", "382", "1,450"]);

    await page.locator('[data-technology="all"]').click();
    await assertSearch(page, "Beacon Fen", 2, [/Beacon Fen Energy Park/, /13599/, /13600/]);
    await assertSearch(page, "13599", 1, [
      /Beacon Fen Energy Park/,
      /GG2050-REPD-13599/,
      /EN010151/,
    ]);
    await assertSearch(page, "GG2050-REPD-13600", 1, [
      /Beacon Fen Energy Park/,
      /13600/,
      /EN010151/,
    ]);
    await assertSearch(page, "GG2050-DEV-E13842D4D80DEC", 2, [/13599/, /13600/]);
    await assertSearch(page, "EN010151", 2, [/13599/, /13600/]);
    await page.locator("#search").fill("");
    assert.equal(await page.locator("#tbody tr").count(), 766);

    const fullDownloadPromise = page.waitForEvent("download");
    await page.locator("#export").click();
    const fullDownload = await fullDownloadPromise;
    assert.match(
      fullDownload.suggestedFilename(),
      /^globalgrid2050_uk_renewables_pipeline_v8_1_\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const fullBytes = await readDownload(fullDownload);
    assert.deepEqual([...fullBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    const fullCsv = fullBytes.toString("utf8", 3);
    const fullLines = fullCsv.split("\r\n");
    assert.equal(fullLines[0], expectedCsvHeader);
    assert.equal(fullLines.length, 767, "CSV has one header and 766 canonical records");

    await page.locator("#search").fill("NO SUCH CANONICAL PROJECT 8C66E56A");
    assert.equal(await page.locator("#tbody tr").count(), 0);
    await assertGaugeValues(page, ["0", "0", "0", "0"]);
    const emptyDownloadPromise = page.waitForEvent("download");
    await page.locator("#export").click();
    const emptyDownload = await emptyDownloadPromise;
    assert.match(
      emptyDownload.suggestedFilename(),
      /^globalgrid2050_uk_renewables_pipeline_v8_1_\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const emptyBytes = await readDownload(emptyDownload);
    assert.deepEqual([...emptyBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(emptyBytes.toString("utf8", 3), expectedCsvHeader);
    await page.locator("#search").fill("");
    assert.equal(await page.locator("#tbody tr").count(), 766);

    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const mobile = await page.evaluate(() => {
        const selectors = [".main", ".header", ".status", ".newspaper", ".gauges", ".tablewrap"];
        const bounds = Object.fromEntries(selectors.map((selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return [selector, { left: rect.left, right: rect.right }];
        }));
        const tableWrap = document.querySelector(".tablewrap");
        return {
          bodyDisplay: getComputedStyle(document.body).display,
          storyColumns: getComputedStyle(document.querySelector(".stories")).gridTemplateColumns.split(" ").length,
          gaugeColumns: getComputedStyle(document.querySelector(".gauges")).gridTemplateColumns.split(" ").length,
          searchWidth: Math.round(document.querySelector("#search").getBoundingClientRect().width),
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          internalTableOverflow: tableWrap.scrollWidth > tableWrap.clientWidth,
          bounds,
        };
      });
      assert.equal(mobile.bodyDisplay, "block", `${width}px body layout`);
      assert.equal(mobile.storyColumns, 1, `${width}px story columns`);
      assert.equal(mobile.gaugeColumns, 1, `${width}px gauge columns`);
      assert.ok(mobile.searchWidth >= width - 24, `${width}px search width`);
      assert.ok(mobile.internalTableOverflow, `${width}px wide table is contained by its own scroller`);
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
    await newsFailure.page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 766);
    await newsFailure.page.waitForFunction(() => document.querySelector("#newsMeta").textContent === "feed unavailable");
    assert.equal(await newsFailure.page.locator("#stories .story").count(), 0);
    assert.match(
      await newsFailure.page.locator("#stories").textContent(),
      /Daily newspaper feed unavailable\. REPD analytics below remain live\./,
    );
    await assertGaugeValues(newsFailure.page, ["34,073.49", "106,338.18", "766", "1,450"]);
    await newsFailure.context.close();

    const projectFailure = await preparePage(browser);
    await serveFrozenNews(projectFailure.page);
    await projectFailure.page.route("**/data/v7.2/projects.json*", (route) => route.abort());
    await projectFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await projectFailure.page.waitForFunction(() => document.querySelectorAll("#stories .story").length === 125);
    await projectFailure.page.waitForFunction(() => (
      document.querySelector("#tbody").textContent.includes("Canonical REPD project data is unavailable.")
    ));
    assert.equal(await projectFailure.page.locator("#stories .story").count(), 125);
    assert.equal(await projectFailure.page.locator("#tbody tr").count(), 1);
    await assertGaugeValues(projectFailure.page, ["0", "0", "0", "0"]);
    await projectFailure.context.close();

    console.log("V8.1 browser smoke: PASS (canonical projects, legacy news, mobile, CSV, independent failures)");
  } finally {
    await browser.close();
  }
}

await main();
