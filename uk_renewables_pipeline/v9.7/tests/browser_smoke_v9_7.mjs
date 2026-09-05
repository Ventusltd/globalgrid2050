import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const baseUrl = process.env.V9_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v9.7/";

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
  await page.waitForFunction(() => (
    document.querySelectorAll("#tbody tr").length === 7680
    && document.querySelectorAll("#stories .story").length === 133
    && document.querySelector("#newsMeta")?.textContent.includes("audited snapshot")
  ));
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
  assert.doesNotMatch(international, /Wilton International, Greystones Road/);
  assert.doesNotMatch(international, /Longhedge Solar Farm/);
  assert.match(international, /published decision ledger/);
  assert.doesNotMatch(international, /REPD \d/);

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
    /* THIS ASSERTION USED TO READ:
         assert.ok(layout.wrapScrollWidth > layout.wrapClientWidth, ...)
       — the table MUST be wider than its wrapper, at every phone width. It was
       the same mistake as the eleven-column one below, stated as a width: it
       required the overflow that put the MAP button off the screen, so no fix
       to that overflow could ever pass. With the five desktop-only columns
       hidden the table is 588 px, which still overflows at 390-440 px and now
       fits at 768 px, and fitting is the better outcome, not a regression.

       What the page actually owes the reader is that any overflow is absorbed
       by the table's own wrapper and never by the document — a page that
       scrolls sideways as a whole is the failure this was groping at — and
       that where the wrapper does overflow, it can be swiped. */
    assert.ok(layout.wrapScrollWidth >= layout.wrapClientWidth, `${width}px wrapper geometry`);
    if (layout.wrapScrollWidth > layout.wrapClientWidth) {
      const swiped = await mobile.page.locator(".tablewrap").evaluate((wrap) => {
        wrap.scrollLeft = wrap.scrollWidth;
        const reached = wrap.scrollLeft;
        wrap.scrollLeft = 0;
        return reached;
      });
      assert.ok(swiped > 0, `${width}px overflowing table does not accept a horizontal swipe`);
    }
    assert.equal(layout.tableDisplay, "table");
    assert.equal(layout.columns, 11);
    /* THIS ASSERTION USED TO READ:
         assert.ok(layout.displays.every((display) => display === "table-cell"));
       — every one of the eleven columns displayed on a phone. It was green on
       every run, and it was pinning the defect. With all eleven columns shown
       and the 1280 px table minimum applying at every width, the ACTIONS
       column's MAP anchor was drawn with its left edge 763 px past the right
       edge of a 393 px viewport, and document.elementFromPoint() at its centre
       returned null: the primary control of this page was unreachable on the
       device most readers use, and this check certified that state as correct.
       Reported by the architect 2026-09-05 on a real iPhone in portrait.

       What replaces it is the contract v7.css has always had below 769 px and
       that v9.6.1 overrode: the five .hide-mobile columns are hidden, the six
       that carry the facts a phone reader needs are shown, and the row's own
       .project-meta and .mobile-extra lines carry what the hidden columns held.
       Where the MAP control actually lands, and whether a thumb can hit it, is
       measured in tests/browser_map_reachability_v9_7.mjs — because a display
       value is not a position, and it was the position that was wrong. */
    const hidden = layout.displays.filter((display) => display === "none").length;
    assert.equal(hidden, 5, `${width}px: the five desktop-only columns must stay hidden on a phone`);
    assert.equal(layout.displays.length - hidden, 6, `${width}px: six columns remain`);
    assert.equal(await clickCount(mobile.page, "INTERNATIONAL"), 19);
    await mobile.context.close();
  }
} finally {
  await browser.close();
}

console.log("V9.7 browser smoke: PASS (committed regional ledger, frozen UK and mobile table)");
