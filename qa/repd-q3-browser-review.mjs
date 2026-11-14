/**
 * Read-only local-browser check for the October 2026 REPD candidate.
 * Runs against a localhost HTTP server from the QA branch, never production.
 * Complements the complete 7,775-row static MAP identity contract.
 */
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(new URL("../uk_renewables_pipeline/202611132345/package.json", import.meta.url));
const { chromium } = require("playwright");
const URL_BASE = process.env.REPD_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/202611132345/";
const reportDir = process.env.REPD_QA_ARTIFACTS || "/tmp/repd-browser-qa";
await mkdir(reportDir, { recursive: true });
const results = [];
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [1440, 430, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 950 }, acceptDownloads: true
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await page.addInitScript(() => {
      window.Chart = class ChartStub {
        constructor(_canvas, config) { this.data = config?.data; }
        update() {}
        destroy() {}
      };
    });
    // Render chart-less offline; do not fake the app's project or news API responses.
    await page.route("https://cdn.jsdelivr.net/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));

    const response = await page.goto(URL_BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert.equal(response?.status(), 200, `HTTP at ${width}px`);
    await page.waitForFunction(() => {
      const body = document.querySelector("#tbody");
      return body?.dataset.total === "7775" && body.querySelectorAll("tr").length === 20;
    }, null, { timeout: 45000 });
    assert.equal(await page.locator("#tbody").getAttribute("data-total"), "7775");
    assert.equal(await page.locator("#tbody tr").count(), 20);
    assert.match(await page.locator("body").innerText(), /REPD OCTOBER 2026/);

    const mapLinks = await page.locator('#tbody a[href*="gridatlas"]').evaluateAll(
      (anchors) => anchors.map((a) => a.href).filter((href) => href.includes("repd_ref="))
    );
    assert.ok(mapLinks.length > 0, `No REPD MAP links at ${width}px`);
    for (const href of mapLinks) {
      const u = new URL(href);
      assert.match(u.searchParams.get("repd_ref") || "", /^\d+$/, "Map link must have numeric Ref ID");
      assert.ok(u.searchParams.get("technology"), "Map link must carry technology");
      assert.equal(u.searchParams.has("latitude"), u.searchParams.has("longitude"),
        "Map link must include both coordinate dimensions or neither");
    }

    // Page-window navigation must not discard projects from the 7,775-record spine.
    await page.locator('[data-page-step="1"]').click();
    await page.waitForFunction(() => document.querySelector("#tbody")?.dataset.page === "2", null, { timeout: 20000 });
    assert.equal(await page.locator("#tbody").getAttribute("data-total"), "7775");
    assert.equal(await page.locator("#tbody tr").count(), 20);
    await page.locator('[data-page-step="-1"]').click();
    await page.waitForFunction(() => document.querySelector("#tbody")?.dataset.page === "1", null, { timeout: 20000 });

    if (width === 1440) {
      const ref = new URL(mapLinks[0]).searchParams.get("repd_ref");
      await page.locator("#search").fill(ref);
      await page.waitForFunction((value) => {
        const rows = [...document.querySelectorAll("#tbody tr")];
        return rows.length > 0 && rows.some((r) => r.textContent.includes(value));
      }, ref, { timeout: 20000 });
      const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
      await page.locator("#exportInline").click();
      const download = await downloadPromise;
      const path = await download.path();
      assert.ok(path, "No downloaded CSV file");
      const csv = await readFile(path, "utf8");
      assert.ok(csv.includes(ref), "Filtered export is missing selected REPD reference");
      assert.ok(csv.split(/\r?\n/).length >= 2, "Downloaded CSV has no data");
      await page.locator("#search").fill("");
      await page.waitForFunction(() => document.querySelector("#tbody")?.dataset.total === "7775",
        null, { timeout: 20000 });
    }
    await page.screenshot({ path: join(reportDir, `q3-${width}.png`), fullPage: true });
    assert.deepEqual(pageErrors, [], `Uncaught JavaScript errors at ${width}px`);
    results.push({ width, status: "PASS", records: 7775, map_links_sampled: mapLinks.length,
      paging: "PASS", export: width === 1440 ? "PASS" : "not repeated", js_errors: 0 });
    await context.close();
  }
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(reportDir, "summary.json"), JSON.stringify({
    candidate: "uk_renewables_pipeline/202611132345", tested_source: URL_BASE,
    note: "localhost-only smoke; no live Atlas receiver checked",
    results
  }, null, 2) + "\n");
  console.log(JSON.stringify({ result: "PASS", results }, null, 2));
} finally {
  await browser.close();
}
