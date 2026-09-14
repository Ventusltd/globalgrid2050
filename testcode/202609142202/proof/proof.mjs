// Headless-Chrome proof for testcode/202609142202 (puppeteer-core by absolute path, GPU flags as instructed).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.env.PORT || '8862';
const URL = `http://127.0.0.1:${PORT}/testcode/202609142202/index.html`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/';
const browser = await puppeteer.launch({
  headless: 'new', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--no-sandbox', '--window-size=1440,1000']
});
const report = { url: URL, runs: [] };
async function run(width, height, name, interact) {
  const page = await browser.newPage();
  const errors = [], logs = [];
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') errors.push(t + ': ' + m.text()); else logs.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText));
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 });
  await new Promise(r => setTimeout(r, 5000));
  const r = {};
  r.name = name; r.width = width; r.height = height; r.loadMs = Date.now() - t0;
  r.scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  r.bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  r.hud = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
  r.count = await page.evaluate(() => document.querySelector('#count').textContent);
  r.fail = await page.evaluate(() => Array.from(document.querySelectorAll('.u-fail')).map(d => d.textContent));
  r.labels = await page.evaluate(() => document.querySelectorAll('#labels .lb').length);
  if (interact) {
    // prove it
    await page.click('#prove'); await new Promise(r => setTimeout(r, 1500));
    r.prove = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('prove it')));
    // search steers, then measures
    await page.type('#search', '#80299'); await page.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 600));
    r.searchSteer = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).filter(t => /^family|^line|^join|^state/.test(t)));
    // steer to the conductor "Number" by name (family #6076 joined to soul #2039), then Enter again measures
    await page.evaluate(() => { document.querySelector('#search').value = ''; }); await page.click('#search'); await page.type('#search', 'Number'); await page.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 300));
    r.steerName = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).filter(t => /^\d+ famil|^join|^state/.test(t)));
    await page.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 2500));
    r.afterMeasure = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).filter(t => /^Born|^twin|^state|^re-prepare|^cable|^join|^earlier/.test(t)));
    r.record = await page.evaluate(() => document.querySelector('#record').textContent);
    r.stateDotAfterCollapse = await page.evaluate(() => { const S = window.__qts.S; return { outcome: S.outcome, collapseT: S.collapseT, theta: S.theta, litRepo: S.litRepo, twinChosen: S.twin.chosen && S.twin.chosen.label }; });
    // 25 measurements for the histogram
    for (let i = 0; i < 25; i++) { await page.click('#measure'); await new Promise(r => setTimeout(r, 40)); }
    await new Promise(r => setTimeout(r, 1200));
    r.histogram = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('histogram')));
    r.journeyVertices = await page.evaluate(() => window.__qts.S.measurements.length);
    // pick: click the sea at the focused family's own position (computed from the page's layout, not guessed)
    const pt = await page.evaluate(() => { const { S, G, familyPos, DPR } = window.__qts; const p = familyPos(S.famIdx); const c = document.querySelector('#gl').getBoundingClientRect(); return { x: c.left + (G.c0[0] + p[0] * G.R) / DPR, y: c.top + (G.c0[1] + p[1] * G.R) / DPR }; });
    await page.evaluate(() => { document.querySelector('#hud').style.pointerEvents = 'none'; }); // the HUD overlay must not swallow the proof's tap
    await page.mouse.click(pt.x, pt.y); await new Promise(r => setTimeout(r, 500));
    r.pickPoint = pt;
    r.pick =await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => /^#\d+ · family|tap hit no entry|pick framebuffer/.test(t)));
    // drag on the sphere: theta/phi by hand, normalisation stays 1
    const sh = await page.evaluate(() => { const r = document.querySelector('#sphereHandle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(sh.x, sh.y); await page.mouse.down(); await page.mouse.move(sh.x + 30, sh.y - 25, { steps: 8 }); await new Promise(r => setTimeout(r, 300));
    r.handState = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('state')));
    await page.mouse.up(); await new Promise(r => setTimeout(r, 2300));
    r.relaxedState = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('state')));
    // arrow key walks the conduction band
    await page.keyboard.press('ArrowRight'); await new Promise(r => setTimeout(r, 300));
    r.band = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('conduction band')));
    r.gpuBuffer = await page.evaluate(() => ({ seaBytes: window.__qts.S.seaBytes, seaDrawn: window.__qts.S.seaDrawn, stride: window.__qts.S.seaStride }));
    r.fpsAfter = await page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('fps')));
    // line text fetch (classical)
    const btn = await page.$('#lines button.u-chip'); if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 6000)); r.lineText = await page.evaluate(() => { const n = document.querySelector('#lines .u-code .u-muted'); const l = document.querySelectorAll('#lines .u-line'); return { note: n ? n.textContent : null, lines: l.length, first: l[0] ? l[0].textContent.slice(0, 120) : null }; }); }
  }
  await page.screenshot({ path: OUT + name + '.png', fullPage: false });
  r.errors = errors; r.logs = logs.slice(0, 20);
  report.runs.push(r); await page.close();
}
try {
  await run(1440, 1000, 'build-1440', true);
  await run(430, 900, 'build-430', false);
} catch (e) { report.error = e.stack; }
await browser.close();
fs.writeFileSync(OUT + 'report.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
