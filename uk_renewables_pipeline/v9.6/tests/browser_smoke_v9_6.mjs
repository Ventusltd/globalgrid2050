import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const baseUrl = process.env.V9_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v9.6/";

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

async function layoutSnapshot(page) {
  return page.evaluate(() => {
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
      tableDisplay: getComputedStyle(document.querySelector(".tablewrap table")).display,
      rowDisplay: getComputedStyle(document.querySelector("#tbody tr")).display,
      theadDisplay: getComputedStyle(document.querySelector(".tablewrap thead")).display,
      tableScrollWidth: document.querySelector(".tablewrap table").scrollWidth,
      tableClientWidth: document.querySelector(".tablewrap").clientWidth,
      bounds,
    };
  });
}

function assertContained(layout, width, label) {
  assert.ok(layout.scrollWidth <= layout.clientWidth, `${label} document overflow: ${layout.scrollWidth}px > ${layout.clientWidth}px`);
  for (const [selector, bounds] of Object.entries(layout.bounds)) {
    assert.ok(bounds.left >= -0.5, `${label} ${selector} crosses left edge`);
    assert.ok(bounds.right <= width + 0.5, `${label} ${selector} crosses right edge`);
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const { context, page } = await preparePage(browser);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll("#stories .story").length === 133, null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector("#v1")?.textContent === "356,474");

  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => page.locator(selector).textContent())), ["356,474", "7,680", "4,100"]);
  assert.equal(await page.locator("#resultsMeta").textContent(), "7,680 of 7,680 records · 356,474 MW · largest 4,100 MW");
  assert.equal(await page.locator("thead th").count(), 11);
  assert.deepEqual(await page.locator("thead th").evaluateAll((headers) => headers.map((header) => header.textContent.trim().replace(/\s+/g, " "))), [
    "SITE NAME", "COUNTY", "OPERATOR", "TECHNOLOGY", "OFFICIAL REPD STATUS", "OFFICIAL CAPACITY",
    "REPD REF", "GLOBALGRID REF", "REPD UPDATED ↕", "NEWS SIGNAL", "ACTIONS",
  ]);
  assert.equal(await page.locator("#resultsMeta").getAttribute("data-filtered-count"), "7680");
  assert.equal(await page.locator("#releaseMeta").textContent(), "V9.6 interface · V9.1 canonical data spine · all 7,680 qualifying records loaded");
  assert.match(await page.locator("#newsMeta").textContent(), /45 relevant \/ 133 headlines · 125 V9\.4 baseline retained/);

  const firstIdentity = await page.locator("#tbody tr").first().evaluate((row) => ({
    repd: row.querySelector(".repd-ref")?.textContent,
    globalgrid: row.querySelector(".globalgrid-ref")?.textContent,
    updated: row.querySelector(".repd-updated")?.textContent,
  }));
  assert.ok(/^\d+$/.test(firstIdentity.repd));
  assert.equal(firstIdentity.globalgrid, `GG2050-REPD-${firstIdentity.repd}`);
  assert.match(firstIdentity.updated, /^(?:\d{2}\/\d{2}\/\d{4}|not supplied by REPD)$/);

  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "none");
  assert.equal(await page.locator("#updatedSortIndicator").textContent(), "↕");
  assert.equal(await page.locator("#sortProjects").inputValue(), "capacity_desc");

  await page.locator("#sortUpdated").click();
  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "descending");
  assert.equal(await page.locator("#updatedSortIndicator").textContent(), "▼");
  assert.equal(await page.locator("#sortProjects").inputValue(), "updated_desc");
  const newestDates = await page.locator("#tbody tr").evaluateAll((rows) => rows.slice(0, 50).map((row) => row.dataset.repdUpdated));
  assert.ok(newestDates.every((value, index) => index === 0 || value <= newestDates[index - 1]));
  assert.match(page.url(), /[?&]sort=updated_desc(?:&|$)/);

  await page.locator("#sortUpdated").click();
  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "ascending");
  assert.equal(await page.locator("#updatedSortIndicator").textContent(), "▲");
  assert.equal(await page.locator("#sortProjects").inputValue(), "updated_asc");
  const oldestDates = await page.locator("#tbody tr").evaluateAll((rows) => rows.slice(0, 50).map((row) => row.dataset.repdUpdated));
  assert.ok(oldestDates.every((value, index) => index === 0 || value >= oldestDates[index - 1]));
  assert.match(page.url(), /[?&]sort=updated_asc(?:&|$)/);

  await page.locator("#sortUpdated").click();
  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "descending");
  assert.equal(await page.locator("#sortProjects").inputValue(), "updated_desc");

  await page.locator("#clearFilters").click();
  assert.equal(await page.locator("#sortProjects").inputValue(), "capacity_desc");
  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "none");
  assert.equal(await page.locator("#updatedSortIndicator").textContent(), "↕");
  assert.equal(await page.locator("#minCapacity").inputValue(), "");
  assert.equal(await page.locator("#maxCapacity").inputValue(), "");
  assert.equal(await page.locator("#capacityMeta").textContent(), "All official capacities");

  await page.locator("#minCapacity").fill("100");
  await page.locator("#maxCapacity").fill("500");
  await page.waitForFunction(() => document.querySelector("#resultsMeta")?.dataset.filteredCount === "476");
  assert.equal(await page.locator("#tbody tr").count(), 476);
  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => page.locator(selector).textContent())), ["106,715", "476", "500"]);
  assert.equal(await page.locator("#capacityMeta").textContent(), "100–500 MW inclusive");
  assert.match(page.url(), /[?&]min_mw=100(?:&|$)/);
  assert.match(page.url(), /[?&]max_mw=500(?:&|$)/);

  await page.locator("#minCapacity").fill("500");
  await page.locator("#maxCapacity").fill("100");
  await page.waitForFunction(() => document.querySelector("#resultsMeta")?.dataset.filteredCount === "0");
  assert.equal(await page.locator("#capacityMeta").textContent(), "Minimum MW must not exceed maximum MW");
  assert.equal(await page.locator("#minCapacity").getAttribute("aria-invalid"), "true");

  await page.locator("#clearFilters").click();
  await page.waitForFunction(() => document.querySelector("#resultsMeta")?.dataset.filteredCount === "7680");

  for (const width of [1440, 1241]) {
    await page.setViewportSize({ width, height: 1000 });
    const desktop = await layoutSnapshot(page);
    assert.equal(desktop.bodyDisplay, "flex", `${width}px desktop body layout`);
    assert.equal(desktop.gaugeColumns, 3, `${width}px desktop gauge columns`);
    assert.equal(desktop.headerDirection, "row", `${width}px desktop header direction`);
    assert.equal(desktop.statusWhiteSpace, "nowrap", `${width}px desktop status wrapping`);
    assertContained(desktop, width, `${width}px desktop`);
  }

  for (const width of [769, 800, 900, 920, 921, 1000, 1100, 1200, 1240]) {
    await page.setViewportSize({ width, height: 900 });
    const intermediate = await layoutSnapshot(page);
    assert.equal(intermediate.bodyDisplay, "flex", `${width}px intermediate body layout`);
    assert.equal(intermediate.gaugeColumns, 3, `${width}px intermediate gauge columns`);
    assert.equal(intermediate.headerDirection, "column", `${width}px intermediate header direction`);
    assert.equal(intermediate.statusWhiteSpace, "normal", `${width}px intermediate status wrapping`);
    assertContained(intermediate, width, `${width}px intermediate`);
  }

  for (const width of [390, 430, 440, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 50);
    await page.waitForFunction(() => document.querySelectorAll("#stories .story").length === 20);
    const mobile = await layoutSnapshot(page);
    assert.equal(mobile.bodyDisplay, "block", `${width}px mobile body layout`);
    assert.equal(mobile.gaugeColumns, 3, `${width}px mobile gauge columns`);
    assert.equal(mobile.storyColumns, 1, `${width}px mobile story columns`);
    assert.equal(mobile.headerDirection, "column", `${width}px mobile header direction`);
    assert.equal(mobile.statusWhiteSpace, "normal", `${width}px mobile status wrapping`);
    assert.ok(mobile.searchWidth >= width - 50, `${width}px mobile search width`);
    assert.equal(mobile.tableDisplay, "block", `${width}px mobile table display`);
    assert.equal(mobile.rowDisplay, "grid", `${width}px mobile project cards`);
    assert.equal(mobile.theadDisplay, "none", `${width}px mobile table header`);
    assert.ok(mobile.tableScrollWidth <= mobile.tableClientWidth + 1, `${width}px mobile internal table overflow`);
    assertContained(mobile, width, `${width}px mobile`);
  }

  assert.equal(await page.locator("#projectRenderMeta").textContent(), "50 shown · 7,680 matching · all 7,680 loaded");
  assert.equal(await page.locator("#newsRenderMeta").textContent(), "20 shown · 133 matching · all 133 loaded");
  await page.locator("#loadMoreProjects").click();
  assert.equal(await page.locator("#tbody tr").count(), 100);
  await page.locator("#loadMoreNews").click();
  assert.equal(await page.locator("#stories .story").count(), 40);

  await page.locator("#minCapacity").fill("100");
  await page.locator("#maxCapacity").fill("500");
  await page.waitForFunction(() => document.querySelector("#resultsMeta")?.dataset.filteredCount === "476");
  assert.equal(await page.locator("#tbody tr").count(), 50);
  assert.equal(await page.locator("#projectRenderMeta").textContent(), "50 shown · 476 matching · all 7,680 loaded");
  await page.locator("#loadMoreProjects").click();
  assert.equal(await page.locator("#tbody tr").count(), 100);

  await page.locator("#mobileSortUpdated").click();
  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "descending");
  assert.equal(await page.locator("#mobileSortUpdated").textContent(), "REPD UPDATED: NEWEST ▼");
  await page.locator("#mobileSortUpdated").click();
  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "ascending");
  assert.equal(await page.locator("#mobileSortUpdated").textContent(), "REPD UPDATED: OLDEST ▲");

  const touchTargets = await page.locator([
    ".mobile-nav summary", ".news-tools button", "#tech .btn", "#status .btn",
    "#minCapacity", "#maxCapacity", "#sortProjects", "#mobileSortUpdated",
    "#loadMoreProjects", "#loadMoreNews", "#tbody .action-link", "#tbody .copy-id",
  ].join(",")).evaluateAll((nodes) => nodes.filter((node) => {
    const style = getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && node.getBoundingClientRect().height > 0;
  }).map((node) => ({ tag: node.tagName, text: node.textContent.trim(), height: node.getBoundingClientRect().height })));
  assert.ok(touchTargets.length > 20);
  assert.ok(touchTargets.every((target) => target.height >= 43.5), JSON.stringify(touchTargets.filter((target) => target.height < 43.5)));

  await page.locator("#clearFilters").click();
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 50);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-technology="wind_offshore"]').click();
  await page.waitForFunction(() => document.querySelector("#v1")?.textContent === "80,535");
  assert.equal(await page.locator("#tbody tr").count(), 109);
  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => page.locator(selector).textContent())), ["80,535", "109", "4,100"]);
  assert.equal(await page.locator("#resultsMeta").textContent(), "109 of 7,680 records · 80,535 MW · largest 4,100 MW");

  await page.locator("#clearFilters").click();
  await page.locator("#search").fill("GG2050-REPD-10087 Brecks");
  assert.equal(await page.locator("#tbody tr").count(), 1);
  assert.notEqual(await page.locator("#tbody .signal").textContent(), "—");
  assert.match(await page.locator("#tbody .signal-note").textContent(), /canonical PRIMARY_MATCH/);

  await page.locator("#search").fill("");
  await page.locator("#search").fill("GG2050-REPD-9873 Berwick");
  assert.equal(await page.locator("#tbody tr").count(), 1);
  const atlas = new URL(await page.locator("#tbody .atlaslink").getAttribute("href"));
  assert.equal(atlas.searchParams.get("repd_ref"), "9873");
  assert.equal(atlas.searchParams.get("technology"), "wind_offshore");

  await page.locator("#tbody .project-record summary").click();
  assert.equal(await page.locator("#tbody .project-record").getAttribute("open"), "");
  assert.match(await page.locator("#tbody .record-grid").textContent(), /PLANNING AUTHORITY/);

  await page.locator("#tbody .copy-id").click();
  await page.waitForFunction(() => document.querySelector("#tbody .copy-id")?.textContent === "COPIED");
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
  assert.equal(relevantCount, 45);
  await page.locator("#newsSearch").fill("Beacon Fen");
  assert.equal(await page.locator("#stories .story").count(), 1);
  assert.match(await page.locator("#stories .story").textContent(), /Beacon Fen Energy Park development consent decision announced/);
  assert.match(await page.locator("#stories .story").textContent(), /400 MW/);
  assert.match(await page.locator("#stories .story").textContent(), /REPD 13599/);
  await page.locator("#newsSearch").fill("");
  await page.locator('[data-news="ALL"]').click();
  assert.equal(await page.locator("#stories .story").count(), 133);

  await page.locator("#search").fill("GG2050-REPD-13599 Beacon Fen");
  assert.equal(await page.locator("#tbody tr").count(), 1);
  assert.notEqual(await page.locator("#tbody .signal").textContent(), "—");
  assert.match(await page.locator("#tbody .signal-note").textContent(), /canonical PRIMARY_MATCH 91%/);
  await page.locator("#search").fill("GG2050-REPD-13600 Beacon Fen");
  assert.equal(await page.locator("#tbody tr").count(), 1);
  assert.equal(await page.locator("#tbody .signal").textContent(), "—");

  await page.locator("#search").fill("definitely-no-such-repd-project-v9-6");
  assert.equal(await page.locator("#tbody tr").count(), 0);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportInline").click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^globalgrid2050_uk_renewables_pipeline_v9_6_\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await download.path(), "utf8");
  assert.equal(csv.trimEnd().split(/\r?\n/).length, 1);
  assert.match(csv, /Site Name/);

  assert.deepEqual(errors, []);
  await context.close();

  const newsFailure = await preparePage(browser);
  await newsFailure.page.route("**/dist/major_project_news_v9_5_1.json*", (route) => route.abort());
  await newsFailure.page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await newsFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await newsFailure.page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 60000 });
  await newsFailure.page.waitForFunction(() => document.querySelector("#newsMeta").textContent === "newspaper unavailable");
  await newsFailure.page.waitForFunction(() => document.querySelector("#v1")?.textContent === "356,474");
  await newsFailure.context.close();

  const projectFailure = await preparePage(browser);
  await projectFailure.page.route("**/contracts/release.v9.6.json*", (route) => route.abort());
  await projectFailure.page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await projectFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await projectFailure.page.waitForFunction(() => document.querySelectorAll("#stories .story").length > 0, null, { timeout: 30000 });
  await projectFailure.page.waitForFunction(() => document.querySelector("#tbody").textContent.includes("V9.6 has failed closed."));
  await projectFailure.context.close();

  const chartFailure = await preparePage(browser, { chartStub: false });
  await chartFailure.page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await chartFailure.page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await chartFailure.page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 60000 });
  await chartFailure.page.waitForFunction(() => document.querySelector("#v1")?.textContent === "356,474");
  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => chartFailure.page.locator(selector).textContent())), ["356,474", "7,680", "4,100"]);
  await chartFailure.context.close();

  console.log("V9.6 browser smoke: PASS (mobile 50/20 batches, 100–500 MW range, 133/45 news, Beacon Fen REPD 13599)");
} finally {
  await browser.close();
}
