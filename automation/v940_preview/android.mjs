/** Named Android emulation proof. Local saved-data acceptance and live observations are separate. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');
const edition = 'uk_renewables_pipeline/202611171710';
const sourceCommit = 'e008a5e031912f52c8d65c60161fe70357cd5162';
const sourceEditionTree = 'b027ff05286bd998abdf8304cc12c9a72732d477';
const output = path.resolve(process.env.V940_ANDROID_OUT || path.join(root, '.qa-artifacts/v940-android'));
const {chromium, devices} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href : 'playwright');
const {latestHeadlines} = await import(pathToFileURL(path.join(root, edition, 'scripts/layers/model.mjs')).href);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const selected = (process.env.ANDROID_DEVICE || 'Pixel 7,Galaxy S9+').split(',').map(s => s.trim());
const pins = {
  [edition + '/index.html']: '97fe3ff68d2f2c21c639a7906c85a87a4dea780a68c1abeee85ff42de4852073',
  'automation/ticker_neon_ui/20261117-v940/ticker.mjs': 'f9ed407157cd54209b797497e71e6884bda4ea1a373f68b6934cf85d0faf9653',
  'automation/ticker_neon_ui/20261117-v940/header.mjs': '17fbbbf9488ceadfd46baeef8849a3f37862d30261916991fa56f85eb0a3b94d',
  'automation/ticker_neon_ui/20261117-v940/styles.css': '9ac64ca9859a73263a532ef65f121c7a7e87627400e5abce6d235d46f4ae0db4'
};
fs.mkdirSync(output, {recursive: true});
const receipt = {
  status: 'RUNNING', startedUTC: new Date().toISOString(), sourceCommit, sourceEditionTree,
  worktreeHead: git('rev-parse', 'HEAD'), observedEditionTree: git('rev-parse', 'HEAD:' + edition), edition,
  environment: 'Named Playwright Android device emulation using host Chromium; NOT physical Android/ADB acceptance',
  local: [], public: [], sourceHashes: {},
  limitations: [
    'External requests are blocked ONLY for local saved-data fallback. Optional public observations have no interception.',
    'Physical Android, mobile GPU, browser chrome, hardware keyboard and TalkBack acceptance remain unknown.'
  ]
};
const save = () => fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
save();
for (const [file, expected] of Object.entries(pins)) {
  const actual = sha(fs.readFileSync(path.join(root, file)));
  receipt.sourceHashes[file] = actual;
  assert.equal(actual, expected, file + ' differs from frozen UI source');
}
const saved = JSON.parse(fs.readFileSync(path.join(root, edition, 'news/pipeline_headlines.snapshot.json')));
const expectedRows = latestHeadlines(saved.items);
assert.equal(expectedRows.length, 71, 'Pinned saved-news population');
for (const name of selected) {
  assert.ok(devices[name] && devices[name + ' landscape'], 'Unknown portrait/landscape device: ' + name);
  assert.match(devices[name].userAgent, /Android/);
  assert.equal(devices[name].hasTouch, true);
}
const server = http.createServer((req, res) => {
  try {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
    assert.ok(file.startsWith(root + path.sep));
    res.setHeader('Content-Type', ({'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json'})[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const url = origin + '/' + edition + '/index.html?technology=all';
let browser;

async function rotate(page, session, name, landscape) {
  const cfg = devices[name + (landscape ? ' landscape' : '')], vp = cfg.viewport;
  await page.setViewportSize(vp);
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: vp.width, height: vp.height, deviceScaleFactor: cfg.deviceScaleFactor, mobile: true,
    screenWidth: cfg.screen?.width || vp.width, screenHeight: cfg.screen?.height || vp.height,
    screenOrientation: {type: landscape ? 'landscapePrimary' : 'portraitPrimary', angle: landscape ? 90 : 0}
  });
  await page.waitForTimeout(120);
  return page.evaluate(() => ({
    viewport: {width: innerWidth, height: innerHeight}, screen: {width: screen.width, height: screen.height},
    orientation: {type: screen.orientation.type, angle: screen.orientation.angle}, dpr: devicePixelRatio,
    touch: navigator.maxTouchPoints, ua: navigator.userAgent, platform: navigator.platform,
    hover: matchMedia('(hover:hover)').matches
  }));
}
async function tap(session, x, y) {
  await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 1, radiusX: 2, radiusY: 2, force: 1}]});
  await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}
async function swipe(session, x, y, dx) {
  await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 1, radiusX: 2, radiusY: 2, force: 1}]});
  for (let i = 1; i <= 12; i++) {
    await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x + dx * i / 12, y, id: 1, radiusX: 2, radiusY: 2, force: 1}]});
    await new Promise(resolve => setTimeout(resolve, 18));
  }
  await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}
async function originals(ticker) {
  const actual = await ticker.locator('ul li').evaluateAll(nodes => nodes.map(n => ({
    text: n.querySelector('a')?.textContent, href: n.querySelector('a')?.href,
    date: n.querySelector('time')?.dateTime, dateText: n.querySelector('time')?.textContent
  })));
  assert.deepEqual(actual, expectedRows.map(row => ({text: `${row.title} \u2014 ${row.source}`, href: row.link, date: row.date, dateText: `${row.dateKind} ${row.date}`})), 'Every literal publisher/date/link matches the saved-source selector');
}
async function fallback(context, blocked) {
  await context.route('**/*', route => {
    if (route.request().url().startsWith(origin + '/')) return route.continue();
    blocked.add(route.request().url());
    return route.abort();
  });
}
try {
  browser = await chromium.launch({headless: true});
  receipt.browserVersion = browser.version();
  for (const name of selected) {
    const context = await browser.newContext({...devices[name], reducedMotion: 'no-preference'}), blocked = new Set();
    await fallback(context, blocked);
    const page = await context.newPage(), session = await context.newCDPSession(page), errors = [], popups = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('popup', p => { popups.push(p.url()); p.close().catch(() => {}); });
    const result = {device: name, descriptor: devices[name], rotations: [], errors, popups};
    receipt.local.push(result); save();
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 20000});
    await page.waitForFunction(() => document.querySelector('#tbody')?.dataset.total === '7775' && document.querySelector('#headlineTicker')?.dataset.count === '71');
    await page.screenshot({path: path.join(output, name.replaceAll(' ', '-') + '-header.png')});
    const ticker = page.locator('#headlineTicker'), view = ticker.locator('.pn-ticker-viewport');
    const x = () => ticker.locator('ul').evaluate(n => n.getBoundingClientRect().x);
    for (const landscape of [false, true, false]) {
      const actual = await rotate(page, session, name, landscape);
      assert.match(actual.ua, /Android/); assert.ok(actual.touch > 0 && actual.dpr > 1); assert.equal(actual.hover, false);
      assert.equal(actual.orientation.angle, landscape ? 90 : 0);
      await ticker.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
      const a = await x(); await page.waitForTimeout(400); const b = await x();
      assert.ok(a - b > 5, 'Actual rendered Android ticker movement across frames');
      assert.equal(await ticker.locator('input,button').count(), 0);
      assert.equal(await page.locator('.masthead input[type=search]').count(), 1);
      assert.equal(await page.locator('#headlinesHeading').evaluate(n => getComputedStyle(n).color), 'rgb(255, 255, 255)');
      assert.equal(await ticker.locator('.pn-ticker-copy a,.pn-ticker-copy [tabindex]').count(), 0);
      assert.equal(await ticker.locator('.pn-ticker-copy').getAttribute('aria-hidden'), 'true');
      assert.notEqual(await ticker.locator('.pn-ticker-copy').getAttribute('inert'), null);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      assert.equal(await page.locator('#tbody').getAttribute('data-total'), '7775');
      result.rotations.push({landscape, actual, renderedDelta: a - b});
      await page.screenshot({path: path.join(output, name.replaceAll(' ', '-') + '-' + result.rotations.length + '.png')}); save();
    }
    const box = await view.boundingBox();
    await tap(session, box.x + box.width * .5, box.y + 3); await page.waitForTimeout(80);
    assert.equal(await ticker.getAttribute('data-reading'), 'true');
    let a = await x(); await page.waitForTimeout(300); assert.ok(Math.abs(await x() - a) < 1);
    const before = await view.evaluate(n => n.scrollLeft), beforeUrl = page.url();
    await swipe(session, box.x + box.width * .8, box.y + box.height / 2, -Math.min(180, box.width * .6));
    await page.waitForTimeout(150);
    const after = await view.evaluate(n => n.scrollLeft);
    assert.ok(after > before + 20, 'Native horizontal touch reading swipe');
    assert.equal(page.url(), beforeUrl); assert.equal(popups.length, 0);
    await tap(session, box.x + box.width * .5, box.y + 3); await page.waitForTimeout(80);
    assert.equal(await ticker.getAttribute('data-reading'), 'false');
    a = await x(); await page.waitForTimeout(400); assert.ok(a - await x() > 5);
    result.touch = {paused: true, readSwipePixels: after - before, resumed: true, noLinkActivation: true};
    const query = page.locator('.pn-news-header-search input'), target = saved.items.at(-1);
    await query.fill(target.title);
    assert.ok((await page.locator('#liveNews').textContent()).includes(target.title));
    await page.locator('.pn-news-quality').getByRole('button', {name: 'Clear news filters'}).tap();
    assert.equal(await page.locator('.pn-news-quality').getAttribute('data-filtered-count'), '71');
    result.headerSearch = {singular: true, lastOriginalArticleMatched: true};
    await originals(ticker);
    result.attributionDates = {literalSourceEquality: true, originalLinks: expectedRows.length, datedOriginals: expectedRows.length};
    assert.deepEqual(errors, []);
    result.expectedBlockedExternal = [...blocked];
    await context.close();

    const reduced = await browser.newContext({...devices[name], reducedMotion: 'reduce'}), reducedBlocked = new Set();
    await fallback(reduced, reducedBlocked);
    const r = await reduced.newPage(), reducedErrors = []; r.on('pageerror', e => reducedErrors.push(e.message));
    await r.goto(url, {waitUntil: 'domcontentloaded', timeout: 20000});
    await r.waitForFunction(() => document.querySelector('#headlineTicker')?.dataset.count === '71');
    const rt = r.locator('#headlineTicker'); await rt.scrollIntoViewIfNeeded();
    a = await rt.locator('ul').evaluate(n => n.getBoundingClientRect().x);
    await r.waitForTimeout(350);
    assert.ok(Math.abs(await rt.locator('ul').evaluate(n => n.getBoundingClientRect().x) - a) < 1);
    await rt.locator('ul a').last().focus();
    assert.ok(await rt.locator('ul a').last().evaluate(n => { const a = n.getBoundingClientRect(), v = n.closest('.pn-ticker-viewport').getBoundingClientRect(); return a.right > v.left && a.left < v.right; }));
    assert.ok(await r.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    await originals(rt); assert.deepEqual(reducedErrors, []);
    result.reducedMotion = {static: true, lastOriginalLinkReadable: true, literalSourceEquality: true, errors: reducedErrors};
    await r.screenshot({path: path.join(output, name.replaceAll(' ', '-') + '-reduced.png')});
    await reduced.close(); result.status = 'PASS'; save();
    console.log(JSON.stringify({device: name, status: result.status, touch: result.touch, reducedMotion: result.reducedMotion}));
  }
  // Opt-in observation only. Public transport/content cannot establish acceptance of this source candidate.
  if (process.env.V940_ANDROID_PUBLIC === '1') for (const target of ['https://globalgrid2050.com/uk_renewables_pipeline/202611171526/', 'https://globalgrid2050.com/']) {
    const context = await browser.newContext({...devices[selected[0]]}), page = await context.newPage(), errors = [];
    page.setDefaultTimeout(2500); page.on('pageerror', e => errors.push(e.message));
    const observation = {requestedUrl: target, utc: new Date().toISOString(), device: selected[0], interception: false, acceptedFixClaim: false};
    receipt.public.push(observation);
    try {
      const response = await page.goto(target, {waitUntil: 'domcontentloaded', timeout: 15000});
      await page.waitForTimeout(1200);
      observation.status = response?.status(); observation.finalUrl = page.url();
      if (response) observation.htmlSha256 = sha(await response.body());
      observation.dom = await page.evaluate(() => ({title: document.title, brand: document.querySelector('.release-brand small')?.textContent || null,
        tickerControls: [...document.querySelectorAll('#headlineTicker input,#headlineTicker button')].map(e => ({tag: e.tagName, text: e.textContent, placeholder: e.getAttribute('placeholder')})),
        tickerCount: document.querySelector('#headlineTicker')?.dataset.count || null,
        pipelineLinks: [...document.querySelectorAll('a[href*="uk_renewables_pipeline/"]')].map(a => ({text: a.textContent, href: a.href})).slice(0, 30)}));
      const track = page.locator('#headlineTicker .pn-ticker-track');
      if (await track.count()) { await track.scrollIntoViewIfNeeded(); const a = await track.evaluate(n => n.getBoundingClientRect().x); await page.waitForTimeout(500); observation.renderedDelta = a - await track.evaluate(n => n.getBoundingClientRect().x); }
      await page.screenshot({path: path.join(output, 'public-' + receipt.public.length + '.png'), timeout: 2500});
      observation.errors = errors;
    } catch (e) { observation.transportOrObservationError = e.message; }
    save(); await context.close();
  }
  receipt.status = 'PASS'; receipt.completedUTC = new Date().toISOString(); save();
} catch (e) {
  receipt.status = 'FAIL'; receipt.failure = {message: e.message, stack: e.stack}; save(); throw e;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
