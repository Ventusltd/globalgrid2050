/* Agent 7 actual Chromium STAGING preflight (not public served-byte or engine QA).
 * Real local 390px phone and 1440px desktop page, search/table, CSV and MAP
 * hit-target checks. Does NOT treat a syntactically valid MAP link as a
 * successful GridAtlas receiver/engine calculation. No fake remote engine.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ORIGIN = process.env.V9_BASE_URL ||
  'http://127.0.0.1:8765/uk_renewables_pipeline/202611151300/';
const OUT = process.env.AGENT7_SCREENSHOT_DIR || '/tmp/agent7-staging';
const manifest = JSON.parse(await readFile(join(ROOT, 'data/v9.1/build_manifest.json'), 'utf8'));
assert.equal(manifest.project_count, 7775);

const expectedRefs = new Set();
for (const part of manifest.project_partitions) {
  const data = JSON.parse(await readFile(join(ROOT, part.path), 'utf8'));
  for (const project of data.projects) {
    const ref = String(project.repd_ref);
    assert.ok(!expectedRefs.has(ref), 'duplicate canonical REPD Ref ' + ref);
    expectedRefs.add(ref);
  }
}
assert.equal(expectedRefs.size, 7775);

/* RFC4180-style CSV rows, tolerating quoted commas, escaped quotes and CRLF. */
function parseCsv(value) {
  value = value.replace(/^\uFEFF/, '');
  let rows = [], row = [], cell = '', quoted = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') {
      if (quoted && value[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === ',') {
      row.push(cell); cell = '';
    } else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && value[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  assert.equal(quoted, false, 'CSV ends inside quoted cell');
  if (row.length || cell) { row.push(cell); rows.push(row); }
  return rows;
}

const feed = {
  schema: 'globalgrid2050.news.pipeline-headlines.v1', status: 'ok',
  generated_at: '2026-11-15T12:00:00Z',
  items: [], counts: { feeds_ok: 50, feeds_failed: 0 },
  scope: 'Headlines only. No confirmed REPD project associations.',
};
const browser = await chromium.launch({ headless: true });
await mkdir(OUT, { recursive: true });
let passed = 0;
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 }, acceptDownloads: true,
      isMobile: width === 390, hasTouch: width === 390,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://cdn.jsdelivr.net/**', route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.route('https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-news-data/**',
      route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feed),
        headers: { 'access-control-allow-origin': '*' } }));
    // Exercise the compiled receiver fallback without inventing remote engine execution.
    await page.route('https://ventusltd.github.io/ventus-grid-engine/deeplink/receivers.json',
      route => route.abort('failed'));
    await page.goto(ORIGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => (
      document.getElementById('tbody')?.dataset.total === '7775'
      && document.getElementById('newsStatus')?.dataset.state === 'live'
      && document.getElementById('liveNews')?.textContent
        .includes('No headlines currently meet the feed criteria.')
    ), null, { timeout: 90000 });
    const totals = await page.evaluate(() => ({
      total: document.getElementById('tbody').dataset.total,
      rows: document.querySelectorAll('#tbody tr').length,
      news: document.getElementById('liveNews').textContent,
      status: document.getElementById('newsStatus').textContent,
      pageScroll: document.documentElement.scrollWidth,
      pageWidth: document.documentElement.clientWidth,
    }));
    assert.equal(totals.total, '7775');
    assert.ok(totals.rows > 0 && totals.rows <= 20);
    assert.match(totals.news, /No headlines currently meet/);
    assert.ok(totals.pageScroll <= totals.pageWidth + 1,
      width + 'px page overflows horizontally by ' + (totals.pageScroll - totals.pageWidth));
    const mapAnchor = page.locator('#tbody tr .atlaslink').first();
    await mapAnchor.waitFor({ state: 'visible' });
    await mapAnchor.scrollIntoViewIfNeeded();
    const map = await mapAnchor.evaluate((a) => {
      const r = a.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { url: a.href, rect: { left: r.left, right: r.right,
        width: r.width, height: r.height },
        hit: hit === a || a.contains(hit),
        viewport: document.documentElement.clientWidth,
      };
    });
    assert.ok(map.url.startsWith('https://ventusltd.github.io/gridatlas/atlas/?'), map.url);
    assert.ok(new URL(map.url).searchParams.get('repd_ref'), 'missing MAP REPD identity');
    assert.ok(map.rect.left >= 0 && map.rect.right <= map.viewport + 1,
      width + 'px MAP is off viewport: ' + JSON.stringify(map.rect));
    assert.ok(map.hit, width + 'px MAP centre is obscured');
    assert.ok(map.rect.width >= 44 && map.rect.height >= 44,
      width + 'px MAP hit target <44px');
    await page.screenshot({ path: join(OUT, 'v922-' + width + '.png'), fullPage: false });
    assert.deepEqual(errors, [], width + 'px application JS errors');
    if (width === 1440) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.locator('#exportInline').click(),
      ]);
      const csv = await readFile(await download.path(), 'utf8');
      const records = parseCsv(csv);
      assert.equal(records.length, 7776, 'CSV header + 7775 REPD rows expected');
      const ix = records[0].indexOf('REPD Ref');
      assert.ok(ix >= 0, 'CSV missing canonical REPD Ref column: ' + records[0].join('|'));
      const refs = records.slice(1).map(row => {
        assert.equal(row.length, records[0].length, 'CSV row width inconsistent');
        return row[ix];
      });
      const exportedRefs = new Set(refs);
      assert.equal(exportedRefs.size, 7775, 'CSV duplicate REPD identity');
      assert.deepEqual([...exportedRefs].sort(), [...expectedRefs].sort(),
        'CSV REPD identity set not equal to source partitions');
      console.log('CSV verified 7,775/7,775 unique exact REPD refs against Q3 partitions');
    }
    passed++;
    console.log(width + 'px actual Chromium staging: PASS; MAP href + hit target checked, '
      + 'Grid Engine execution NOT checked');
    await context.close();
  }
} finally {
  await browser.close();
}
assert.equal(passed, 2);
console.log('Agent7 Chromium STAGING PASS at 390 and 1440, NOT public served-byte/engine acceptance');
