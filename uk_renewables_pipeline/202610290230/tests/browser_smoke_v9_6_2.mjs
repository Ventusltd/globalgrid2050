import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const baseUrl = process.env.V9_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v9.6.2/";

async function pageAt(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.Chart = class ChartStub {
      constructor(_canvas, config) { this.data = config.data; }
      update() {}
    };
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({
    status: 200, contentType: "application/javascript", body: "",
  }));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680);
  return { context, page };
}

async function clickCount(page, mode) {
  await page.locator(`button[data-news="${mode}"]`).click();
  await page.waitForFunction(() => !document.querySelector("#stories .news-empty"));
  return page.locator("#stories .story").count();
}

const browser = await chromium.launch({ headless: true });
try {
  const { context, page } = await pageAt(browser, 1440);
  assert.equal(await page.locator("#tbody tr").count(), 7680);
  assert.equal(await page.locator("#v1").innerText(), "356,474");
  assert.equal(await page.locator("#v2").innerText(), "7,680");
  assert.equal(await page.locator("#v3").innerText(), "4,100");
  assert.equal(await page.locator("#stories .story").count(), 133);

  assert.equal(await clickCount(page, "UK"), 45);
  assert.ok(await page.locator("#stories").innerText().then((text) => text.includes("Beacon Fen Energy Park development consent decision announced")));
  assert.ok(await page.locator("#stories").innerText().then((text) => !text.includes("New Jersey")));

  assert.equal(await clickCount(page, "INTERNATIONAL"), 19);
  const international = await page.locator("#stories").innerText();
  assert.match(international, /New Jersey/);
  assert.match(international, /County Kerry, Ireland/);
  assert.match(international, /Australia/);
  assert.doesNotMatch(international, /Kintore/);
  assert.doesNotMatch(international, /Canadian Solar says patent dispute/);

  assert.equal(await clickCount(page, "US"), 4);
  const us = await page.locator("#stories").innerText();
  assert.match(us, /New Jersey/);
  assert.doesNotMatch(us, /County Kerry/);

  assert.equal(await clickCount(page, "EUROPE"), 9);
  const europe = await page.locator("#stories").innerText();
  assert.match(europe, /County Kerry, Ireland/);
  assert.match(europe, /Germany BESS/);
  assert.doesNotMatch(europe, /New Jersey/);
  await context.close();

  for (const width of [390, 430, 440, 768]) {
    const mobile = await pageAt(browser, width);
    const layout = await mobile.page.evaluate(() => {
      const wrap = document.querySelector(".tablewrap");
      const table = wrap.querySelector("table");
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        wrapClientWidth: wrap.clientWidth,
        wrapScrollWidth: wrap.scrollWidth,
        overflowX: getComputedStyle(wrap).overflowX,
        tableDisplay: getComputedStyle(table).display,
        columns: table.tHead.rows[0].cells.length,
        displays: [...table.tHead.rows[0].cells].map((cell) => getComputedStyle(cell).display),
      };
    });
    assert.ok(layout.scrollWidth <= layout.clientWidth, `${width}px document overflow`);
    assert.equal(layout.overflowX, "auto");
    assert.ok(layout.wrapScrollWidth > layout.wrapClientWidth, `${width}px table is not horizontally scrollable`);
    assert.equal(layout.tableDisplay, "table");
    assert.equal(layout.columns, 11);
    assert.ok(layout.displays.every((display) => display === "table-cell"));
    assert.equal(await clickCount(mobile.page, "INTERNATIONAL"), 19);
    await mobile.context.close();
  }
} finally {
  await browser.close();
}

console.log("V9.6.2 browser smoke: PASS (UK, INTERNATIONAL, US, EUROPE and mobile table)");
