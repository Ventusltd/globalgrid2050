// Lens-grammar proof: measures each existing lens at phone width (430x900, touch) and desktop (1280x900).
// Reads only public pages. Writes JSON + PNG into this folder. Run: node lens-grammar-proof.mjs <port>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const port = process.argv[2] || '8861';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const LOCAL = `http://127.0.0.1:${port}/testcode/202609141522/`;
const pages = [
  { id: 'v08-ring-journey', url: LOCAL + 'v08-ring-journey/index.html', tap: 'svg#ring circle.b' },
  { id: 'v03-particle-universe', url: LOCAL + 'v03-particle-universe/index.html', tap: null },
  { id: 'v05-chord-dependencies', url: LOCAL + 'v05-chord-dependencies/index.html', tap: 'svg#ch path.arc' },
  { id: 'v07-flow-repos', url: LOCAL + 'v07-flow-repos/index.html', tap: 'svg#flow g.node' },
  { id: 'v10-ide-search', url: LOCAL + 'v10-ide-search/index.html', tap: null },
  { id: 'stars-table', url: 'https://ventusltd.github.io/stars/table.html', tap: '.tile' },
  { id: 'stars-code-511', url: 'https://ventusltd.github.io/stars/code.html?family=511', tap: null },
  { id: 'grid-engine-periodic', url: 'https://ventusltd.github.io/ventus-grid-engine/?graph=periodic-table', tap: null },
  { id: 'code-generator', url: 'https://ventusltd.github.io/code-generator/?blocks=Si,Vn', tap: null },
];
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'],
});
const out = { run_utc: new Date().toISOString(), port, results: [] };
for (const p of pages) for (const vp of [{ name: 'mobile', width: 430, height: 900, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, { name: 'desktop', width: 1280, height: 900, hasTouch: false, isMobile: false, deviceScaleFactor: 1 }]) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  const failed = []; const consoleErrors = [];
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  const rec = { id: p.id, viewport: vp.name, url: p.url };
  try {
    await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));
    rec.measure = await page.evaluate(() => ({
      innerWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
      title: document.title, h1: (document.querySelector('h1') || {}).textContent || null,
      count: (document.querySelector('#count,#status,.count') || {}).textContent || null,
      legend: [...document.querySelectorAll('.u-legend span, .legend span')].map(s => s.textContent.trim()),
      legendColours: [...document.querySelectorAll('.u-legend i')].map(i => i.style.background),
      svgText: document.querySelectorAll('svg text').length, svgPaths: document.querySelectorAll('svg path').length, svgCircles: document.querySelectorAll('svg circle').length,
      tiles: document.querySelectorAll('.tile').length, cards: document.querySelectorAll('.card').length,
      footer: (document.querySelector('footer.u-foot') || {}).textContent || null,
      fail: (document.querySelector('.u-fail') || {}).textContent || null,
      hash: location.hash, search: location.search,
    }));
    if (p.tap) {
      const t = await page.$(p.tap);
      if (t) {
        if (vp.hasTouch) await t.tap(); else await t.click();
        await new Promise(r => setTimeout(r, 3000));
        rec.afterTap = await page.evaluate(() => ({
          hash: location.hash, search: location.search,
          trail: (document.querySelector('#trail, .crumbs') || {}).textContent || null,
          panelShown: !!document.querySelector('#panel:not([hidden]), #block:not([hidden]), .panel:not([hidden])'),
          panelHead: (document.querySelector('#panel .u-h, #block .u-h, .panel h3') || {}).textContent || null,
          svgPaths: document.querySelectorAll('svg path').length, scrollWidth: document.documentElement.scrollWidth,
        }));
      } else rec.afterTap = 'tap target not found: ' + p.tap;
    }
    const shot = path.join(here, `${p.id}-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    rec.screenshot = path.basename(shot);
  } catch (e) { rec.error = String(e.message || e).slice(0, 300); }
  rec.failedRequests = failed.slice(0, 10); rec.consoleErrors = consoleErrors.slice(0, 5);
  out.results.push(rec); console.log(JSON.stringify(rec));
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(here, 'lens-grammar-proof.json'), JSON.stringify(out, null, 2));
console.log('written', path.join(here, 'lens-grammar-proof.json'));
