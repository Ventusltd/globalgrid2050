/** Real Chrome proof, using actual exporter bytes and the external pinned renderer. */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {directory, figuresDirectory, raw, pins, sha} from './test-support.mjs';
assert.ok(process.env.CONTEXT_UI_ARTIFACTS, 'Explicit CONTEXT_UI_ARTIFACTS directory required');
const artifacts = resolve(process.env.CONTEXT_UI_ARTIFACTS);
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Context UI integration proof</title><link rel="stylesheet" href="/context.css"><link rel="stylesheet" href="/figures/figures.css">
<body><main><section id="news" aria-label="News" data-news-context-host><h1>News</h1><button id="sentinel">Existing news control</button></section></main>
<script type="module" src="/boot.mjs"></script></body></html>`;
const boot = `import {renderContext} from '/render.mjs';
import {buildViewModel} from '/figures/model.mjs'; import {renderFigures} from '/figures/render.mjs';
const host = document.querySelector('#news'); window.sentinel = document.querySelector('#sentinel');
window.clicks = 0; sentinel.addEventListener('click', () => window.clicks++);
window.original = new Uint8Array(await (await fetch('/fixture.json')).arrayBuffer());
window.hash = async b => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), x => x.toString(16).padStart(2,'0')).join('');
window.render = (b, pin) => renderContext(host, b, {expectedSha256: pin, figures: {buildViewModel,renderFigures}});
await window.render(window.original, '${pins.fixture_sha256}'); window.ready = true;`;
const resources = new Map([['/', ['text/html', html]], ['/boot.mjs', ['text/javascript', boot]],
  ['/fixture.json', ['application/json', raw]]]);
for (const name of ['adapter.mjs', 'render.mjs', 'context.css']) resources.set('/' + name,
  [name.endsWith('.css') ? 'text/css' : 'text/javascript', await readFile(resolve(directory, name))]);
for (const name of Object.keys(pins.figures_files)) resources.set('/figures/' + name,
  [name.endsWith('.css') ? 'text/css' : 'text/javascript', await readFile(resolve(figuresDirectory, name))]);
// Route-only loopback origin: no network sockets or production server required.
const origin = 'http://127.0.0.1:18329';
const results = []; let browser;
try {
  await mkdir(artifacts, {recursive: true});
  browser = await chromium.launch({headless: true, channel: 'chrome', args: ['--no-proxy-server']});
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({viewport: {width, height: 950}, serviceWorkers: 'block'});
    const external = [], errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      const resource = url.origin === origin && route.request().method() === 'GET' && resources.get(url.pathname + url.search);
      if (resource) return route.fulfill({status: 200, contentType: resource[0] + '; charset=utf-8',
        headers: {'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'"},
        body: typeof resource[1] === 'string' ? resource[1] : Buffer.from(resource[1])});
      external.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin); await page.waitForFunction(() => window.ready);
    assert.equal(await page.locator('[data-transition-context-root]').getAttribute('data-state'), 'available');
    assert.equal(await page.locator('#news > [data-transition-context-root]').count(), 1);
    assert.equal(await page.locator('[data-context-id]').count(), 14);
    assert.equal(await page.locator('[data-figure-claim]').count(), 3);
    assert.deepEqual(await page.evaluate(() => {
      const root = document.querySelector('[data-transition-context-root]');
      const figure = root.querySelector('[data-filings-figures-root]');
      const amount = figure.querySelector('[data-figure-value]');
      const host = getComputedStyle(document.querySelector('#news'));
      return {font: getComputedStyle(amount).fontSize === host.fontSize,
        color: getComputedStyle(figure).color === host.color,
        background: getComputedStyle(figure).backgroundColor,
        native: root.contextReport.records.length};
    }), {font: true, color: true, background: 'rgba(0, 0, 0, 0)', native: 14});
    await page.locator('[data-transition-context-root] > summary').click();
    // Keyboard access uses native disclosure semantics.
    const first = page.locator('[data-context-id]').first();
    await first.locator(':scope > summary').focus(); await page.keyboard.press('Enter');
    assert.equal(await first.getAttribute('open'), '');
    await page.evaluate(() => document.querySelectorAll('[data-context-id] > details.filings-figures, [data-context-figure] > details').forEach(x => x.open = true));
    const text = await page.locator('[data-transition-context-root]').textContent();
    for (const required of ['Rejected', 'Unknown', 'Reported progress', 'In progress', 'Upper bound (up to)',
      '2021-09-22', '2024', 'Published:', 'Reviewed:', 'Retrieved:', 'Not confirmed', 'Not assessed',
      'Original source files were not checked again', 'not a complete treaty history', 'Country: US', 'Country: GB']) assert.ok(text.includes(required), required);
    assert.equal(await page.locator('[data-figure-value]').allTextContents().then(v => v.join('|')), '480 MW|350 MW|280 MW');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const a of await page.locator('[data-transition-context-root] a').all()) {
      assert.ok((await a.getAttribute('href')).startsWith('https://'));
      assert.match(await a.getAttribute('rel'), /noopener/);
    }
    await page.locator('#sentinel').click(); assert.equal(await page.evaluate(() => clicks), 1);
    const screenshot = `context-${width}.png`; await page.screenshot({path: resolve(artifacts, screenshot), fullPage: true});
    // Hostile markup is plain text, including native history and background metadata.
    await page.evaluate(async () => {
      const r = JSON.parse(new TextDecoder().decode(original));
      const evil = '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>';
      r.records[0].title = evil; r.records[0].native_record.name = evil;
      r.records[0].native_record.research_action = evil;
      r.records[0].native_record.revision_history = [{state: 'REJECTED', superseded_by: null, text: evil}];
      const bytes = new TextEncoder().encode(JSON.stringify(r)); await render(bytes, await hash(bytes));
    });
    assert.equal(await page.locator('[data-transition-context-root] img, [data-transition-context-root] script').count(), 0);
    assert.equal(await page.evaluate(() => window.pwned), undefined);
    assert.ok((await page.locator('[data-transition-context-root]').textContent()).includes('Revision history'));
    // Failed refresh must clear every stale value and preserve neighboring controls.
    await page.evaluate(async () => render(original, '0'.repeat(64)));
    assert.equal(await page.locator('[data-transition-context-root]').getAttribute('data-state'), 'unavailable');
    assert.equal(await page.locator('[data-figure-claim], [data-context-id]').count(), 0);
    assert.equal(await page.evaluate(() => sentinel === document.querySelector('#sentinel')), true);
    await page.locator('#sentinel').click(); assert.equal(await page.evaluate(() => clicks), 2);
    // A later bad request wins even if an earlier digest is still pending.
    await page.evaluate(async pin => Promise.all([render(original, pin), render(original, 'bad')]), pins.fixture_sha256);
    assert.equal(await page.locator('[data-transition-context-root]').getAttribute('data-state'), 'unavailable');
    assert.equal(await page.locator('[data-transition-context-root]').count(), 1);
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    results.push({width, checks: ['actual exporter', '14 contexts', '3 exact figures', 'inherited typography and colors', 'complete native data retained', 'unknown and historical states',
      'distinct clocks', 'upper-bound qualifier', 'native keyboard disclosure', 'no horizontal overflow',
      'safe source links', 'text escaped', 'history retained', 'stale values cleared', 'neighbor control preserved', 'latest request wins', 'no external requests'],
      screenshot, screenshot_sha256: sha(await readFile(resolve(artifacts, screenshot)))});
    await context.close();
  }
  const proof = {browser: 'Chrome', version: browser.version(), actual_export_sha256: pins.fixture_sha256,
    renderer_commit: pins.figures_commit, transport: 'Playwright route fulfillment from whitelisted local bytes; no HTTP server',
    results, scope: 'Local isolated component; no live release, Android, or project integration acceptance'};
  await writeFile(resolve(artifacts, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
} finally {
  await browser?.close();
}
