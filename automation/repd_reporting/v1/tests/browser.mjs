import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = createServer(async (req, res) => {
  try {
    const route = decodeURIComponent((req.url ?? "").split("?")[0]);
    const path = resolve(root, "." + route);
    if (!path.startsWith(root + "/")) throw new Error("Bad path");
    const bytes = await readFile(path);
    res.writeHead(200, { "Content-Type": extname(path) === ".html" ? "text/html" : extname(path) === ".css" ? "text/css" : "text/javascript" });
    res.end(bytes);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const port = server.address().port;
let checked = 0;
try {
  for (const [engine, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
    const browser = await type.launch();
    try {
      for (const viewport of [{ width: 393, height: 852 }, { width: 852, height: 393 }, { width: 1280, height: 800 }]) {
        const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width < 1000, acceptDownloads: true });
        const page = await ctx.newPage();
        const faults = [];
        page.on("pageerror", err => faults.push(err.message));
        await page.goto("http://127.0.0.1:" + port + "/tests/harness.html");
        await page.waitForFunction(() => window.reportingReady === true);
        const rootSelector = ".repd-periodic-reports";
        assert.equal(await page.locator(rootSelector).count(), 1);
        assert.equal(await page.locator(".repd-report-primary button").count(), 5);
        assert.equal(await page.locator(".repd-report-periods button").count(), 3);
        assert.ok(await page.locator("text=78 MW").count() === 0); // No false merged MW/MWp total
        // Status report includes non-operational applications, with the same canonical records.
        await page.locator(".repd-report-primary button", { hasText: "STATUS MW" }).click();
        assert.ok(await page.locator(".repd-report-table").innerText().then(s => s.includes("Application Submitted")));
        // Operator drilldown uses source identities (not guessed asset refs).
        await page.locator(".repd-report-primary button", { hasText: "OPERATOR MW" }).click();
        await page.locator(".repd-report-link", { hasText: "Alpha" }).first().click();
        const refs = await page.evaluate(() => window.openedRefs);
        assert.deepEqual(refs, ["1", "3"]);
        // True reporting periods: 2024-01 vs 2024-Q1, and 2024 yearly.
        await page.locator(".repd-report-primary button", { hasText: "OPERATIONAL BY YEAR" }).click();
        await page.locator(".repd-report-periods button", { hasText: /^MONTH$/ }).click();
        assert.ok((await page.locator(".repd-report-table").innerText()).includes("2024-01"));
        await page.locator(".repd-report-periods button", { hasText: /^QUARTER$/ }).click();
        assert.ok((await page.locator(".repd-report-table").innerText()).includes("2024-Q1"));
        assert.ok((await page.locator(".repd-report-table").innerText()).includes("UNKNOWN-DATE"));
        await page.locator(".repd-report-periods button", { hasText: /^YEAR$/ }).click();
        assert.ok((await page.locator(".repd-report-table").innerText()).includes("2024"));
        // No metered energy/implicit capacity factor: scenario requires user input.
        await page.locator(".repd-report-primary button", { hasText: "ENERGY SCENARIO" }).click();
        assert.ok((await page.locator(".repd-report-note").first().innerText()).includes("NOT METERED"));
        assert.ok((await page.locator(".repd-report-table").innerText()).includes("Not available"));
        await page.locator(".repd-report-select select[aria-label=TECHNOLOGY]").selectOption("Solar Photovoltaics");
        await page.locator(".repd-report-periods button", { hasText: /^MONTH$/ }).click();
        await page.locator(".repd-report-actions button", { hasText: "ASSUMPTIONS" }).click();
        const cf = page.locator('input[aria-label="Solar Photovoltaics capacity factor percentage"]');
        await cf.fill("10");
        await cf.dispatchEvent("change");
        assert.ok((await page.locator(".repd-report-table").innerText()).includes("408 MWh"));
        // Sorting is executable; report is exportable; touch/portrait fits the document.
        await page.locator(".repd-report-table .repd-report-sort").first().click();
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          page.locator(".repd-report-actions button", { hasText: "EXPORT CSV" }).click(),
        ]);
        assert.ok(download.suggestedFilename().endsWith(".csv"));
        const noHorizontalPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2);
        assert.equal(noHorizontalPageOverflow, true, engine + " " + viewport.width + " horizontal document overflow");
        const active = await page.locator(".repd-report-primary button[aria-pressed=true]").first().evaluate(el => getComputedStyle(el).color);
        assert.equal(active, "rgb(0, 255, 255)");
        assert.deepEqual(faults, [], engine + " " + viewport.width + " console errors");
        await ctx.close();
        checked += 1;
      }
    } finally {
      await browser.close();
    }
  }
  assert.equal(checked, 6);
  process.stdout.write("REPD Analytics isolated browser UI: " + checked + "/6 responsive Chromium/WebKit viewports PASS\n");
} finally {
  server.close();
}