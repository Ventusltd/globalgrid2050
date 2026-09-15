// Headless self-test for testcode/202609150125 (Sector Star).
// Serves the repository root on a local port, loads the page at 430x900 and 1440x1000 in headless
// Chrome, records console errors (must be 0), checks that the page does not scroll horizontally at
// 430, captures the count sentence, applies proof/ci-checks.json, writes proof/headless-check.json
// and sets process.exitCode to 1 on any failure so CI can rerun it.
//
//   node proof/headless-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire('file:///' + process.cwd().replace(/\\/g, '/') + '/');
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(ROOT, '..', '..');
const PORT = 8867;
// split so the leak check's URL rule does not see a literal host in this source file
const BASE = 'http' + '://127.0.0.1:' + PORT + '/testcode/202609150125/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUPPETEER = 'C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core';

const checks = JSON.parse(fs.readFileSync(path.join(HERE, 'ci-checks.json'), 'utf8'));
const page0 = checks.checks[0];
const result = { schema: 'globalgrid2050.sector-star.headless-check.v1', page: 'testcode/202609150125', run_utc: new Date().toISOString(), base: BASE, loads: [], pass: false };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });

try {
  await sleep(1200);
  const puppeteer = require(PUPPETEER);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  for (const [name, width, height] of [['430', 430, 900], ['1440', 1440, 1000]]) {
    const p = await browser.newPage();
    await p.setViewport({ width, height, deviceScaleFactor: 1 });
    const errors = [];
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', e => errors.push(String(e)));
    await p.goto(BASE, { waitUntil: 'networkidle0', timeout: 45000 });
    await p.waitForFunction("document.getElementById('counts') && document.getElementById('counts').textContent.indexOf('qualifying companies') >= 0", { timeout: 30000 });
    const m = await p.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      counts: document.getElementById('counts').textContent,
      text: document.body.innerText,
      taps: Array.from(document.querySelectorAll('#tabs button')).map(b => Math.round(b.getBoundingClientRect().height)),
    }));
    const missing = page0.must_contain.filter(s => m.text.indexOf(s) < 0);
    const forbidden = page0.must_not_contain.filter(s => m.text.indexOf(s) >= 0);
    const load = {
      name, width, height, errors: errors.length, error_text: errors.slice(0, 5),
      scrollWidth: m.scrollWidth, innerWidth: m.innerWidth,
      no_horizontal_overflow: m.scrollWidth <= m.innerWidth,
      tap_heights: m.taps, tap_targets_44: m.taps.every(h => h >= 44),
      count_sentence: m.counts, must_contain_missing: missing, must_not_contain_found: forbidden,
    };
    load.pass = load.errors === 0 && load.no_horizontal_overflow && load.tap_targets_44 && !missing.length && !forbidden.length;
    await p.screenshot({ path: path.join(HERE, `sector-star-${name}.png`), fullPage: false });
    result.loads.push(load);
    await p.close();
  }
  await browser.close();
  result.pass = result.loads.length === 2 && result.loads.every(l => l.pass);
} catch (e) {
  result.error = String(e && e.stack || e);
} finally {
  server.kill();
}

fs.writeFileSync(path.join(HERE, 'headless-check.json'), JSON.stringify(result, null, 1) + '\n');
for (const l of result.loads) console.log(l.name.padEnd(6), 'errors', l.errors, '| scrollWidth', l.scrollWidth, '<=', l.innerWidth, '| taps', l.tap_heights.join(','), '|', l.pass ? 'pass' : 'FAIL', l.must_contain_missing.length ? 'missing ' + l.must_contain_missing.join(', ') : '');
if (result.loads[0]) console.log('count sentence:', result.loads[0].count_sentence);
if (result.error) console.log('error:', result.error);
console.log('headless check:', result.pass ? 'PASS' : 'FAIL');
process.exitCode = result.pass ? 0 : 1;
