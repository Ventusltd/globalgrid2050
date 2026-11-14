import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const baseUrl = process.env.V9_BASE_URL || "http://127.0.0.1:8765/uk_renewables_pipeline/v9/";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.Chart = class ChartStub {
      constructor(_canvas, config) { this.data = config.data; }
      update() {}
    };
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("#tbody tr").length === 7680, null, { timeout: 60000 });

  assert.deepEqual(await Promise.all(["#v1", "#v2", "#v3"].map((selector) => page.locator(selector).textContent())), ["356,474.09", "7,680", "4,100"]);
  assert.equal(await page.locator("thead th").count(), 8);
  assert.equal(await page.locator("#resultsMeta").getAttribute("data-filtered-count"), "7680");
  assert.equal((await page.locator(".gauges").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)), 3);

  await page.setViewportSize({ width: 900, height: 1000 });
  assert.equal((await page.locator(".gauges").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal((await page.locator(".gauges").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)), 1);
  assert.equal(await page.locator(".header").evaluate((element) => getComputedStyle(element).flexDirection), "row");
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

  await page.locator("#search").fill("definitely-no-such-repd-project-v9-2");
  assert.equal(await page.locator("#tbody tr").count(), 0);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportInline").click();
  const download = await downloadPromise;
  const path = await download.path();
  const csv = await readFile(path, "utf8");
  assert.equal(csv.trimEnd().split(/\r?\n/).length, 1);
  assert.match(csv, /Site Name/);

  assert.deepEqual(errors, []);
  console.log("V9.2 browser smoke: PASS (V5 breakpoints, full default universe, wind, missing geometry and zero-result CSV)");
} finally {
  await browser.close();
}
