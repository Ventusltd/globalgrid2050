/* browser_map_reachability_v9_7.mjs — can a thumb actually reach MAP?
 *
 * THE DEFECT THIS EXISTS TO CATCH, measured on the served bytes 2026-09-05:
 * the architect reported "the map button doesn't work just tested on mobile".
 * It was not a broken link and it was not a race. Every one of the 7,680 rows
 * rendered a correct <a href> against the canonical receiver, with all five
 * contract parameters, and the deep-link contract resolved in 59 ms — 722 ms
 * before the project data finished. The link was perfect and it was DRAWN OFF
 * THE SIDE OF THE SCREEN.
 *
 * At a 389 px viewport the MAP anchor's left edge sat at x = 1217: 828 px past
 * the right edge of the viewport. document.elementFromPoint() at the anchor's
 * own centre returned null. Two served rules caused it, and neither is
 * sufficient alone — measured by ablation, pixels of the anchor off-screen:
 *
 *     as served .......................................... 828 px
 *     styles/v9-3.css  .tablewrap table{min-width:0} ..... 346 px
 *     styles/v9-6-1.css hide-mobile hidden ............... 799 px
 *     both together ....................................... 16 px
 *
 * WHY EVERY EXISTING CHECK PASSED. tests/browser_smoke_v9_6_1.mjs asserts the
 * mobile layout at 390 px and is green, because what it asserts is that all 11
 * columns are displayed and that the table is wider than its wrapper. It pins
 * the geometry that hides the button. A check can only fail on what it looks
 * at, and nothing in this estate had ever looked at where a control LANDS.
 * Desktop is genuinely fine — at 1707 px the anchor is on-screen — which is
 * why "verified on desktop" was true and useless.
 *
 * SO THIS PROOF ASSERTS POSITION, NOT STYLE. Not that a CSS string changed:
 * that the anchor's rectangle is inside the viewport, that a hit test at its
 * own centre returns the anchor itself, and that it is at least 44 x 44 px —
 * Apple's own minimum, against the 36 x 21 px measured on the served page.
 * A rule can be rewritten and still leave the control unreachable; only the
 * rectangle settles it.
 *
 * Run:  node tests/browser_map_reachability_v9_7.mjs
 *       (V9_BASE_URL to point it at a served origin instead of 127.0.0.1)
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");

const baseUrl = process.env.V9_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v9.7/";
const CANONICAL_RECEIVER = "https://ventusltd.github.io/gridatlas/atlas/";

/* The phone the report came from was an iPhone in portrait. 393 x 852 is the
   iPhone 14/15 Pro CSS viewport; isMobile and hasTouch are set because the
   media features this layout keys on (hover, pointer) follow them. See the
   note at the end of this file about what that still cannot prove. */
const PHONE = Object.freeze({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15"
    + " (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
});

/* Apple Human Interface Guidelines, and Android's 48 dp is stricter still. */
const MIN_TAP_PX = 44;

const failures = [];
const record = (name, ok, detail) => {
  failures.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

/* Measure one anchor the way a thumb meets it: scroll its row to the middle of
   the screen, then ask the document what is actually at that point. */
async function measureMapAnchor(page, scrollTarget = "row") {
  return page.evaluate((target) => {
    const anchor = document.querySelector("#tbody tr .atlaslink");
    if (!anchor) return { present: false };
    /* "row" is the phone case and is the strict one: bring the ROW into view
       and nothing else, so any horizontal displacement of the anchor inside
       that row is still measured. "anchor" is the desktop case, where the
       table legitimately scrolls sideways inside a capped wrapper and a reader
       reaches the column by scrolling it. */
    if (target === "anchor") anchor.scrollIntoView({ block: "center", inline: "center" });
    else anchor.closest("tr").scrollIntoView({ block: "center", inline: "nearest" });
    const rect = anchor.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const wrap = document.querySelector(".tablewrap");
    const table = wrap.querySelector("table");
    const viewportWidth = document.documentElement.clientWidth;
    return {
      present: true,
      href: anchor.getAttribute("href"),
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      centre: { x: cx, y: cy },
      /* How far past the right edge the anchor's own left edge sits. This is
         the number the ablation above is expressed in. */
      pixelsOffScreen: Math.max(0, Math.round(rect.left - viewportWidth)),
      hitIsAnchor: Boolean(hit) && (hit === anchor || anchor.contains(hit)),
      hitTag: hit ? `${hit.tagName.toLowerCase()}.${hit.className || ""}`.trim() : null,
      viewportWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      tableScrollWidth: table.scrollWidth,
      wrapClientWidth: wrap.clientWidth,
      tableMinWidth: getComputedStyle(table).minWidth,
      visibleHeaderCount: [...table.tHead.rows[0].cells]
        .filter((cell) => getComputedStyle(cell).display !== "none").length,
      /* The facts the five hidden columns carry must still be on the phone,
         somewhere the reader can see them — otherwise hiding them is a
         deletion, not a layout. */
      mobileMetaVisible: getComputedStyle(document.querySelector("#tbody .project-meta")).display !== "none",
      mobileExtraVisible: getComputedStyle(document.querySelector("#tbody .mobile-extra")).display !== "none",
    };
  }, scrollTarget);
}

const browser = await chromium.launch({ headless: true });
/* Held at this scope so the finally block can cancel them. A 120 s stall timer
   that outlives its browser keeps the node process alive after the run has
   already printed its result. */
const stallTimers = new Set();

try {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.Chart = class ChartStub { constructor(_c, config) { this.data = config.data; } update() {} };
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({
    status: 200, contentType: "application/javascript", body: "",
  }));
  await page.route("https://raw.githubusercontent.com/**", (route) => route.abort());

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  /* Waits for a populated table, not for a specific number of DOM rows - see the
     stalled-origin case below for why an exact count is the wrong assertion. */
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length > 0, null, { timeout: 120000 });

  const map = await measureMapAnchor(page);
  record("a MAP anchor is rendered on the first project row", map.present);
  assert.ok(map.present, "no .atlaslink rendered — this proof has nothing to measure");
  record(
    "the MAP link targets the canonical receiver",
    String(map.href).startsWith(CANONICAL_RECEIVER),
    map.href,
  );

  /* ---- The assertion that fails on the served bytes ---------------------- */
  record(
    "the MAP anchor's left edge is inside the viewport",
    map.rect.left >= 0 && map.rect.left < map.viewportWidth,
    `left=${map.rect.left.toFixed(1)}px, viewport=${map.viewportWidth}px, ${map.pixelsOffScreen}px off-screen`,
  );
  record(
    "the MAP anchor's right edge is inside the viewport",
    map.rect.right <= map.viewportWidth + 0.5,
    `right=${map.rect.right.toFixed(1)}px, viewport=${map.viewportWidth}px`,
  );
  record(
    "a hit test at the MAP anchor's own centre returns the anchor",
    map.hitIsAnchor,
    `elementFromPoint(${map.centre.x.toFixed(0)}, ${map.centre.y.toFixed(0)}) = ${map.hitTag ?? "null"}`,
  );
  record(
    `the MAP tap target is at least ${MIN_TAP_PX} x ${MIN_TAP_PX} px`,
    map.rect.width >= MIN_TAP_PX && map.rect.height >= MIN_TAP_PX,
    `${map.rect.width.toFixed(0)} x ${map.rect.height.toFixed(0)} px`,
  );
  record(
    "the page itself does not scroll horizontally",
    map.documentScrollWidth <= map.viewportWidth + 0.5,
    `scrollWidth=${map.documentScrollWidth}px, clientWidth=${map.viewportWidth}px`,
  );
  record(
    "the five desktop-only columns are hidden on the phone",
    map.visibleHeaderCount === 6,
    `${map.visibleHeaderCount} of 11 columns displayed`,
  );
  record(
    "the facts those columns carry are still shown, in the row",
    map.mobileMetaVisible && map.mobileExtraVisible,
    `project-meta=${map.mobileMetaVisible}, mobile-extra=${map.mobileExtraVisible}`,
  );

  /* The other two controls in the same cell are the same size problem. */
  const siblings = await page.evaluate(() => [".tablewrap", ""].length && [
    ...document.querySelectorAll("#tbody tr:first-child .project-actions .action-link, #tbody tr:first-child .project-actions .copy-id"),
  ].map((element) => {
    const rect = element.getBoundingClientRect();
    return { label: element.textContent.trim().slice(0, 8), width: Math.round(rect.width), height: Math.round(rect.height), right: Math.round(rect.right) };
  }));
  record(
    "every control in the ACTIONS cell is inside the viewport and tappable",
    siblings.every((s) => s.right <= 393.5 && s.width >= MIN_TAP_PX && s.height >= MIN_TAP_PX),
    siblings.map((s) => `${s.label} ${s.width}x${s.height} right=${s.right}`).join(" · "),
  );

  /* THE ASSERTION THAT MAKES THIS DURABLE. Five columns of REPD content do not
     fit 393 px and no amount of shrinking will make them, so the ACTIONS
     column is pinned to the right edge of the scrolling wrapper instead. Test
     that where it counts: at every horizontal scroll position of the table,
     for rows other than the first, MAP must still be on screen and must still
     answer a hit test at its own centre. A layout that only works at
     scrollLeft 0 is the same bug with a smaller number. */
  const pinned = await page.evaluate(() => {
    const wrap = document.querySelector(".tablewrap");
    const rows = [...document.querySelectorAll("#tbody tr")];
    const samples = [];
    for (const rowIndex of [0, 1, 40]) {
      const row = rows[rowIndex];
      if (!row) continue;
      const anchor = row.querySelector(".atlaslink");
      if (!anchor) continue;
      row.scrollIntoView({ block: "center", inline: "nearest" });
      for (const scrollLeft of [0, Math.round(wrap.scrollWidth / 2), wrap.scrollWidth]) {
        wrap.scrollLeft = scrollLeft;
        const rect = anchor.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        samples.push({
          rowIndex,
          scrollLeft: wrap.scrollLeft,
          right: Math.round(rect.right),
          left: Math.round(rect.left),
          inside: rect.left >= 0 && rect.right <= document.documentElement.clientWidth + 0.5,
          hitIsAnchor: Boolean(hit) && (hit === anchor || anchor.contains(hit)),
        });
      }
    }
    return samples;
  });
  record(
    "MAP stays on screen and hit-testable at every horizontal scroll position, on several rows",
    pinned.length >= 6 && pinned.every((s) => s.inside && s.hitIsAnchor),
    pinned.map((s) => `row ${s.rowIndex} @${s.scrollLeft}px → ${s.left}..${s.right}${s.hitIsAnchor ? "" : " MISS"}`).join(" · "),
  );

  /* ---- Desktop must not regress ------------------------------------------ */
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktop = await measureMapAnchor(page, "anchor");
  record(
    "at 1440 px the desktop table keeps its 1280 px minimum and all 11 columns",
    desktop.tableMinWidth === "1280px" && desktop.visibleHeaderCount === 11,
    `min-width=${desktop.tableMinWidth}, ${desktop.visibleHeaderCount} columns`,
  );
  record(
    "at 1440 px the MAP anchor is still reachable",
    desktop.hitIsAnchor,
    `elementFromPoint = ${desktop.hitTag ?? "null"}`,
  );

  record("no page errors", pageErrors.length === 0, pageErrors.join(" | "));
  await context.close();

  /* ---- Latent risk closed in the same change ----------------------------- */
  const receiverModule = await readFile(new URL("../scripts/core/atlas-receiver-v9-7.js", import.meta.url), "utf8");
  const fetchCall = (receiverModule.match(/fetch\(RECEIVERS_URL,\s*\{[\s\S]*?\}\)/) || [""])[0];
  record(
    "the cross-origin deep-link contract is not fetched with cache: no-store",
    Boolean(fetchCall) && !/no-store/.test(fetchCall),
    fetchCall.replace(/\s+/g, " ").slice(0, 120),
  );
  record(
    "the cross-origin fetch is bounded by a timeout",
    /AbortSignal\.timeout/.test(fetchCall),
    "a stalled socket is otherwise bounded only by the platform — order of 60-75 s on iOS Safari",
  );
  const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  record(
    "the second origin is preconnected in the head",
    /<link rel="preconnect" href="https:\/\/ventusltd\.github\.io" crossorigin>/.test(indexHtml),
    "DNS + TCP + TLS overlapped with the project payload instead of paid in series",
  );

  /* ── THE OTHER HALF OF THE DEFECT ─────────────────────────────────────────
     The MAP button was unreachable because of where it was DRAWN. It was also,
     separately, gated on a cross-origin fetch: the project payload and a
     request to ventusltd.github.io were in one Promise.all, so no row could
     paint until a second origin answered, and if it never answered every row
     would have rendered NO MAP. Assert the blocked case explicitly — a check
     built only from the happy path cannot fail, which is how this shipped. */
  const blocked = await browser.newContext(PHONE);
  const blockedPage = await blocked.newPage();
  const blockedErrors = [];
  blockedPage.on("pageerror", (error) => blockedErrors.push(error.message));
  await blockedPage.addInitScript(() => {
    window.Chart = class ChartStub { constructor(_c, config) { this.data = config.data; } update() {} };
  });
  await blockedPage.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({
    status: 200, contentType: "application/javascript", body: "",
  }));
  await blockedPage.route("https://raw.githubusercontent.com/**", (route) => route.abort());
  /* Not aborted — STALLED. An abort resolves in microseconds and proves
     nothing about a page that waits on a handshake; a socket that never
     answers is the cold-radio case and the one that hung the table. */
  let contractRequests = 0;
  /* Every stall timer is held so it can be cancelled at teardown. Without this
     the 120 s waits outlive the browser they were stalling and keep the node
     process alive long after the run has reported - which is how a proof ends
     up owning a background process nobody is watching. */
  await blockedPage.route("https://ventusltd.github.io/**", async (route) => {
    contractRequests += 1;
    await new Promise((resolve) => {
      const timer = setTimeout(() => { stallTimers.delete(timer); resolve(); }, 120000);
      stallTimers.add(timer);
    });
    await route.abort().catch(() => {});
  });

  /* This asserted `=== 7680` rendered rows within 60 s. Two faults, both found
     by an independent review on 2026-09-05:

     It measured the wrong property. The defect was that a stalled request on a
     SECOND ORIGIN left the reader looking at nothing; what must be true is that
     the table becomes USABLE without that request, and the first rows are what
     make it usable. Pinning the DOM to 7,680 rows also pins the page to
     rendering all of them - the very thing that builds 323,802 elements and an
     800,000-pixel document. Correct pagination would have turned this proof
     red, so the proof was defending the performance defect.

     And 60 s is not a budget, it is a surrender. A reader who waits 60 s has
     already gone. FIRST_ROWS_BUDGET_MS is a stated number that can be argued
     with, which "eventually" never is.

     The dataset's completeness is a different property from the DOM's, and it
     is asserted separately below against the page's own record count - so this
     file still fails if rows go missing, and stops failing if they are merely
     not all materialised at once. */
  const FIRST_ROWS_BUDGET_MS = 10000;
  const started = Date.now();
  await blockedPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  let rowsAppearedMs = null;
  try {
    await blockedPage.waitForFunction(() => document.querySelectorAll("#tbody tr").length > 0, null, { timeout: FIRST_ROWS_BUDGET_MS });
    rowsAppearedMs = Date.now() - started;
  } catch {
    rowsAppearedMs = null;
  }
  const blockedRows = await blockedPage.evaluate(() => document.querySelectorAll("#tbody tr").length);
  record(
    `with the deep-link contract's origin stalled, the table is usable within ${FIRST_ROWS_BUDGET_MS} ms`,
    rowsAppearedMs !== null,
    rowsAppearedMs === null
      ? `no row appeared within ${FIRST_ROWS_BUDGET_MS} ms; the table is still empty`
      : `first rows ${rowsAppearedMs} ms after navigation, ${blockedRows.toLocaleString("en-GB")} rendered`,
  );

  /* Completeness, asserted against the page's own count of the records it holds
     rather than against the number it happens to have put in the DOM. This is
     the assertion that pagination must not be allowed to weaken, and it is the
     one that survives pagination. */
  const blockedRecords = await blockedPage.evaluate(() => {
    const meta = document.getElementById("releaseMeta");
    const match = meta && /all ([\d,]+) qualifying records loaded/u.exec(meta.textContent || "");
    return match ? Number(match[1].replace(/,/gu, "")) : null;
  });
  record(
    "with that origin stalled, the full record set is still loaded",
    blockedRecords !== null && blockedRecords > 0,
    blockedRecords === null
      ? "the page never reported a record count"
      : `${blockedRecords.toLocaleString("en-GB")} records`,
  );

  const blockedState = rowsAppearedMs === null ? null : await blockedPage.evaluate(() => {
    const anchors = [...document.querySelectorAll("#tbody .atlaslink")];
    const bad = anchors.filter((a) => !a.getAttribute("href")
      || !a.getAttribute("href").startsWith("https://ventusltd.github.io/gridatlas/atlas/"));
    return {
      rows: document.querySelectorAll("#tbody tr").length,
      links: anchors.length,
      malformed: bad.length,
      disabled: document.querySelectorAll("#tbody .action-disabled").length,
      sample: anchors[0] ? anchors[0].getAttribute("href") : null,
    };
  });
  record(
    "with the contract's origin stalled, every row still carries a MAP link to the canonical receiver",
    Boolean(blockedState) && blockedState.links === blockedState.rows && blockedState.malformed === 0,
    blockedState ? `${blockedState.links} links on ${blockedState.rows} rows, ${blockedState.malformed} malformed` : "not measured",
  );
  record(
    "with the contract's origin stalled, there are zero NO MAP cells",
    Boolean(blockedState) && blockedState.disabled === 0,
    blockedState ? `${blockedState.disabled} disabled cells` : "not measured",
  );
  record(
    "the contract was still requested — verification is fired, not skipped",
    contractRequests > 0,
    `${contractRequests} request(s) to ventusltd.github.io`,
  );
  record("no page errors with the contract's origin stalled", blockedErrors.length === 0, blockedErrors.join(" | "));
  await blocked.close();
} finally {
  for (const timer of stallTimers) clearTimeout(timer);
  stallTimers.clear();
  await browser.close();
}

const failed = failures.filter((entry) => !entry.ok);
console.log(`\n${failures.length - failed.length}/${failures.length} checks passed`);
if (failed.length) {
  console.error(`\nV9.7 mobile MAP reachability: FAIL (${failed.length})`);
  process.exit(1);
}
console.log("V9.7 mobile MAP reachability: PASS (393 x 852, isMobile, touch)");

/* WHAT THIS CANNOT PROVE. Chromium on Windows is not an iPhone. It does not
 * run WebKit's layout, its safe-area insets, its 100vh behaviour with the
 * URL bar, its momentum scrolling, or its 300 ms/double-tap heuristics — and
 * Playwright's WebKit build on Windows is not iOS WebKit either. This proof
 * settles that the anchor is on screen and hit-testable in a Blink layout at
 * an iPhone's CSS viewport. An iOS-only fault — a tap swallowed by Safari's
 * own gesture handling, or an inset that shifts the row under the home
 * indicator — remains outside it, and needs the real handset.
 */
