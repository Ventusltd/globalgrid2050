/* Live GridAtlas deep-link proof. Unlike URL-only tests, physically clicks a
 * Pipeline News MAP anchor, opens its actual external page, and demands a
 * composed receiver, a terminal no-error technology layer and visible nearest
 * substation result. Real network and engine; no destination mocks or fake flags.
 * Reports each attempt including failures; a retry never erases initial red.
 * This is a DIAGNOSTIC SUBSET, never evidence of all 7,775 executions or
 * independent reviewer acceptance. 15 November 2026.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUTPUT = process.env.AGENT7_ENGINE_REPORT_DIR || '/tmp/agent7-engine';
const CANDIDATE = process.env.AGENT7_PIPELINE_SOURCE
  || 'http://127.0.0.1:8765/uk_renewables_pipeline/202611151300/';
const MODE = process.env.AGENT7_ENGINE_MODE || 'local';
const WIDTH = Number(process.env.AGENT7_ENGINE_WIDTH || 1440);
const SAMPLE_LIMIT = Number(process.env.AGENT7_ENGINE_SAMPLE_LIMIT || 2);
const MAX_MS = Number(process.env.AGENT7_ENGINE_WAIT_MS || 85000);
assert.ok([390, 1440].includes(WIDTH), 'unknown test viewport');
assert.ok(SAMPLE_LIMIT >= 1 && SAMPLE_LIMIT <= 6, 'limited honest runtime matrix');

const manifest = JSON.parse(await readFile(join(ROOT, 'data/v9.1/build_manifest.json'), 'utf8'));
const rows = [];
for (const part of manifest.project_partitions) {
  const d = JSON.parse(await readFile(join(ROOT, part.path), 'utf8'));
  rows.push(...d.projects);
}
assert.equal(rows.length, 7775);

function located(row) {
  return Number.isFinite(Number(row.latitude))
    && Number.isFinite(Number(row.longitude))
    && Number(row.latitude) >= 50 && Number(row.latitude) <= 59
    && Number(row.longitude) >= -6 && Number(row.longitude) <= 1;
}
const classes = ['solar', 'bess', 'wind_onshore'];
const chosen = classes.map(tech => rows.find(row => row.technology === tech && located(row)
  && String(row.repd_ref).match(/^\d+$/))).filter(Boolean).slice(0, SAMPLE_LIMIT);
assert.equal(chosen.length, SAMPLE_LIMIT,
  'not enough distinct solar/battery/onshore samples to claim this matrix');
await mkdir(OUTPUT, { recursive: true });
const receipts = [];
const browser = await chromium.launch({ headless: true });
let fatal = false;

try {
  for (const record of chosen) {
    const receipt = {
      source: CANDIDATE, mode: MODE, width: WIDTH,
      repd_ref: String(record.repd_ref), technology: record.technology,
      expected_coordinates: { latitude: Number(record.latitude), longitude: Number(record.longitude) },
      source_head: process.env.GITHUB_SHA || 'UNKNOWN',
      status: 'FAIL',
      start_utc: new Date().toISOString(),
      phases: {},
      page_errors: [], console_errors: [], request_failures: []
    };
    receipts.push(receipt);
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: 900 }, isMobile: WIDTH === 390,
      hasTouch: WIDTH === 390, acceptDownloads: true
    });
    const page = await context.newPage();
    let arrival;
    try {
      // Stub only optional library on SOURCE; never mock receiver, cartridges,
      // basemap, data, computation or network on the destination page.
      await page.addInitScript(() => {
        window.Chart = class ChartStub { constructor(_c, c) { this.data = c.data; } update() {} };
      });
      await page.route('https://cdn.jsdelivr.net/**',
        route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
      if (MODE === 'local') {
        // Allows an honest no-headlines state without relying on a live RSS file
        // for a separate MAP test. Does NOT affect the destination GridAtlas.
        await page.route('https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-news-data/**',
          route => route.fulfill({
            status: 200, contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' },
            body: JSON.stringify({ schema: 'globalgrid2050.news.pipeline-headlines.v1',
              generated_at: new Date().toISOString(), status: 'ok',
              items: [], counts: { feeds_ok: 0, feeds_failed: 0 } })
          }));
      }
      await page.goto(CANDIDATE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('tbody')?.dataset.total === '7775',
        null, { timeout: 70000 });
      const search = page.locator('#search');
      await search.fill(String(record.repd_ref));
      const target = page.locator('#tbody a.atlaslink[href*="repd_ref=' + record.repd_ref + '"]').first();
      await target.waitFor({ state: 'visible', timeout: 35000 });
      await target.scrollIntoViewIfNeeded();
      const hit = await target.evaluate(a => {
        const b = a.getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { width: b.width, height: b.height, left: b.left, right: b.right,
          viewport: document.documentElement.clientWidth, reachable: el === a || a.contains(el),
          href: a.href };
      });
      receipt.phases.map_hit = hit;
      assert.ok(hit.reachable && hit.left >= 0 && hit.right <= hit.viewport + 1
        && hit.width >= 44 && hit.height >= 44, 'MAP not physically clickable');
      const href = new URL(hit.href);
      assert.equal(href.origin + href.pathname, 'https://ventusltd.github.io/gridatlas/atlas/');
      assert.equal(href.searchParams.get('repd_ref'), receipt.repd_ref);
      assert.equal(href.searchParams.get('technology'), record.technology);
      assert.equal(Number(href.searchParams.get('latitude')), Number(record.latitude));
      assert.equal(Number(href.searchParams.get('longitude')), Number(record.longitude));
      const popup = context.waitForEvent('page', { timeout: 20000 });
      await target.click({ timeout: 20000 });
      arrival = await popup;
      const arrived = new URL(arrival.url());
      receipt.phases.actual_clicked_url = arrived.href;
      assert.equal(arrived.origin + arrived.pathname, href.origin + href.pathname);
      assert.equal(arrived.searchParams.get('repd_ref'), receipt.repd_ref);
      receipt.phases.popup_created = true;
      arrival.on('pageerror', e => receipt.page_errors.push(String(e.message || e).slice(0,240)));
      arrival.on('console', m => {
        if (m.type() === 'error') receipt.console_errors.push(m.text().slice(0,240));
      });
      arrival.on('requestfailed', req => {
        receipt.request_failures.push({ url: req.url().slice(0,200),
          why: req.failure()?.errorText || 'request failed' });
      });
      await arrival.waitForLoadState('domcontentloaded', { timeout: 60000 });
      // Real engine state first. A phone intentionally collapses the project
      // card on arrival; looking only at document.body.innerText before the
      // user expands it would falsely report a failed calculation.
      await arrival.waitForFunction(() => {
        const runtime = window.__GRIDATLAS_NEON_LINKS__;
        const atlas = window.__GRIDATLAS_ATLAS__;
        return !!atlas && !!runtime
          && Array.isArray(runtime.failures) && runtime.failures.length === 0
          && !!document.documentElement.dataset.gridatlasGeneration
          && runtime.technology_layer?.enabled === true
          && !!runtime.project_layer_enabled;
      }, null, { timeout: MAX_MS });
      const initialCard = await arrival.evaluate(() => {
        const popup = document.querySelector('.maplibregl-popup');
        const hidden = document.body?.textContent || '';
        const visible = document.body?.innerText || '';
        const button = popup?.querySelector('.gridatlas-card-bar button.min');
        return {
          popup_found: !!popup,
          minimized: popup?.classList.contains('gridatlas-min') || false,
          control_exists: !!button,
          control_text: button?.textContent?.trim() || null,
          nearest_in_hidden_dom: /Nearest\s+\d+\s*kV\s+substation\s*:/i.test(hidden),
          nearest_visible: /Nearest\s+\d+\s*kV\s+substation\s*:/i.test(visible),
          viewport_visibility: document.visibilityState
        };
      });
      receipt.phases.card_on_arrival = initialCard;
      if (initialCard.minimized) {
        // Simulate the reader explicitly restoring the mobile measurement card.
        // This is NOT a fake engine result: only an actual user-operable click
        // may expose the real computed nearest and source-identity evidence.
        assert.ok(initialCard.control_exists, 'mobile project card minimised with no restore button');
        const restore = arrival.locator('.maplibregl-popup.gridatlas-min .gridatlas-card-bar button.min').first();
        await restore.click({ timeout: 15000 });
        receipt.phases.card_restored_by_real_click = true;
      }
      try {
        await arrival.waitForFunction(() =>
          /Nearest\s+\d+\s*kV\s+substation\s*:/i.test(document.body?.innerText || ''),
        null, { timeout: 35000 });
      } catch (e) {
        receipt.phases.visible_nearest_timeout = String(e.message).slice(0,180);
      }
      // Recheck at 1.7 s, 5.7 s (past the known 5.3 s reset) and 10.1 s.
      // A computed-but-hidden result or a card that re-minimises is a FAIL.
      const visibilityStability = [];
      let elapsedMs = 0;
      for (const deltaMs of [1700, 4000, 4400]) {
        await arrival.waitForTimeout(deltaMs);
        elapsedMs += deltaMs;
        const sample = await arrival.evaluate(() => {
          const body = document.body?.innerText || '';
          return {
            nearest_visible: /Nearest\\s+\\d+\\s*kV\\s+substation\\s*:/i.test(body),
            minimised: !!document.querySelector('.maplibregl-popup.gridatlas-min')
          };
        });
        visibilityStability.push({ elapsed_ms: elapsedMs, ...sample });
      }
      receipt.phases.visibility_stability = visibilityStability;
      const state = await arrival.evaluate(() => {
        const a = window.__GRIDATLAS_ATLAS__ || null;
        const x = window.__GRIDATLAS_NEON_LINKS__ || null;
        const body = document.body?.innerText || '';
        return {
          router_state: document.body?.dataset.gridatlasRouter || null,
          generation: document.documentElement.dataset.gridatlasGeneration || null,
          atlas_schema: a?.schema || null, composition_generation: a?.generation || null,
          cartridge_count: a?.loaded_cartridges?.length ?? null,
          technology_layer: x?.technology_layer || null,
          project_layer_enabled: x?.project_layer_enabled ?? null,
          failures: x?.failures || null,
          nearest_excerpt: (body.match(/Nearest\s+\d+\s*kV\s+substation\s*:[^\n]{0,150}/i) || [])[0] || null,
          still_minimised: !!document.querySelector('.maplibregl-popup.gridatlas-min'),
          nearest_in_dom_even_if_hidden: /Nearest\s+\d+\s*kV\s+substation\s*:/i.test(document.body?.textContent || ''),
          has_loading_spinner: /GRIDATLAS COMPOSITION FAILED|verifying immutable shell and cartridges/i.test(body),
          headline: body.slice(0, 360)
        };
      });
      receipt.phases.runtime = state;
      await arrival.screenshot({
        path: join(OUTPUT, 'engine-' + WIDTH + '-' + record.repd_ref + '.png'),
        fullPage: false, timeout: 18000
      }).catch(e => { receipt.phases.screenshot_error = e.message.slice(0,160); });
      assert.ok(state.generation && state.generation === state.composition_generation,
        'composed generation mismatch/absent');
      assert.ok(state.cartridge_count >= 4, 'no verified cartridge composition receipt');
      assert.ok(state.router_state !== 'failed', 'GridAtlas composer failed');
      assert.deepEqual(state.failures, [], 'GridAtlas runtime failures not empty');
      assert.equal(state.technology_layer?.enabled, true, 'technology layer not enabled');
      assert.ok(state.project_layer_enabled, 'project layer not enabled');
      assert.ok(state.nearest_excerpt, 'NO real nearest-substation output observed');
      assert.ok(visibilityStability.length === 3
        && visibilityStability.every(s => s.nearest_visible && !s.minimised),
        'Mobile nearest result not continuously user-visible after manual restore at 1.7/5.7/10.1 s');
      assert.equal(receipt.page_errors.length, 0, 'destination page exceptions');
      receipt.status = 'PASS';
    } catch (error) {
      receipt.why = String(error?.message || error).slice(0,800);
      fatal = true;
    } finally {
      receipt.ended_utc = new Date().toISOString();
      console.log(JSON.stringify({ repd_ref: receipt.repd_ref, tech: receipt.technology,
        width: receipt.width, mode: receipt.mode, status: receipt.status,
        why: receipt.why || null, output: receipt.phases.runtime?.nearest_excerpt || null }));
      await context.close().catch(() => {});
    }
  }
} finally {
  await browser.close();
  const path = join(OUTPUT, 'real-map-engine-receipts-' + MODE + '-' + WIDTH + '.json');
  await writeFile(path, JSON.stringify({
    schema: 'globalgrid2050.agent7.real-map-engine-receipts.v1',
    generated_at: new Date().toISOString(),
    sampled_rows: chosen.length,
    full_population: rows.length,
    coverage: 'PARTIAL_SAMPLE_ONLY',
    note: 'Real browser click and external engine. This does not certify all onshore/nearshore or legal rights.',
    receipts
  }, null, 2) + '\n');
}
if (fatal) {
  console.error('Real MAP→GridAtlas→Engine subset FAILED / partial. See per-REPD receipts.');
  process.exitCode = 1;
} else {
  console.log('Real MAP→GridAtlas→Engine diagnostic subset passed; global coverage PARTIAL ONLY');
}
