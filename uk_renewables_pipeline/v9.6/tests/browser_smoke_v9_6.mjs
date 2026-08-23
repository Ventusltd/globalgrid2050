import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const baseUrl = process.env.V9_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v9.6/";
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.Chart = class ChartStub {
      constructor(_canvas, config) { this.data = config.data; }
      update() {}
    };
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll("#stories .story").length === 133, null, { timeout: 30000 });

  assert.equal(await page.locator("#tbody tr").count(), 7680);
  assert.equal(await page.locator("#stories .story").count(), 133);
  assert.equal(await page.locator("#resultsMeta").textContent(), "7,680 of 7,680 records · 356,474 MW · largest 4,100 MW");
  assert.match(await page.locator("#newsMeta").textContent(), /45 relevant \/ 133 headlines/);

  for (const width of [390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => {
      const wrap = document.querySelector(".tablewrap");
      const table = wrap.querySelector("table");
      return {
        gaugeColumns: getComputedStyle(document.querySelector(".gauges")).gridTemplateColumns.split(" ").length,
        storyColumns: getComputedStyle(document.querySelector(".stories")).gridTemplateColumns.split(" ").length,
        rowDisplay: getComputedStyle(document.querySelector("#tbody tr")).display,
        headDisplay: getComputedStyle(table.tHead).display,
        hiddenColumn: getComputedStyle(document.querySelector("th.hide-mobile")).display,
        overflowX: getComputedStyle(wrap).overflowX,
        tableWidth: table.scrollWidth,
        wrapWidth: wrap.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    assert.equal(layout.gaugeColumns, 1, `${width}px inherited gauges`);
    assert.equal(layout.storyColumns, 1, `${width}px inherited newspaper`);
    assert.equal(layout.rowDisplay, "table-row", `${width}px normal rows`);
    assert.equal(layout.headDisplay, "table-header-group", `${width}px visible header`);
    assert.equal(layout.hiddenColumn, "table-cell", `${width}px complete columns`);
    assert.equal(layout.overflowX, "auto", `${width}px table scroll`);
    assert.ok(layout.tableWidth > layout.wrapWidth, `${width}px table is horizontally swipeable`);
    assert.ok(layout.pageWidth <= layout.viewportWidth, `${width}px page itself is not truncated`);
  }

  await page.locator("#minCapacity").fill("100");
  await page.locator("#maxCapacity").fill("500");
  await page.waitForFunction(() => document.querySelector("#resultsMeta")?.dataset.filteredCount === "476");
  assert.equal(await page.locator("#tbody tr").count(), 476);
  assert.equal(await page.locator("#capacityMeta").textContent(), "100–500 MW inclusive");

  await page.locator("#clearFilters").click();
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680);
  await page.locator("#sortUpdated").click();
  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "descending");
  await page.locator("#sortUpdated").click();
  assert.equal(await page.locator("#repdUpdatedHeader").getAttribute("aria-sort"), "ascending");

  await page.locator('[data-news="RELEVANT"]').click();
  assert.equal(await page.locator("#stories .story").count(), 45);
  await page.locator("#newsSearch").fill("Beacon Fen");
  assert.equal(await page.locator("#stories .story").count(), 1);
  assert.match(await page.locator("#stories .story").textContent(), /LOW CARBON LIMITED.*REPD 13599/s);

  console.log("V9.6 clean browser: PASS (untruncated V9.5.1 UI, horizontal projects, capacity range)");
} finally {
  await browser.close();
}
