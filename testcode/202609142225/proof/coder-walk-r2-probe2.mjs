// Round-2 side probe 2: how much of the tray's chips a person can see once two things are in the recipe, and whether the
// remove (×) of the second chip is reachable by touch.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8896', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'], protocolTimeout: 90000 });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const out = {};
const trayFacts = () => page.evaluate(() => { const T = document.getElementById('tray'), C = T.querySelector('.chips'); const cb = C.getBoundingClientRect(); return { chipsBox: [Math.round(cb.left), Math.round(cb.right)], chipsClientW: C.clientWidth, chipsScrollW: C.scrollWidth, chips: [...T.querySelectorAll('.rc')].map(c => { const r = c.getBoundingClientRect(); const x = c.querySelector('button').getBoundingClientRect(); const e = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); const eChip = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: c.textContent.replace('×', '').trim(), box: [Math.round(r.left), Math.round(r.right)], visiblePx: Math.max(0, Math.min(r.right, cb.right) - Math.max(r.left, cb.left)), removeReachable: e === c.querySelector('button'), chipReachable: !!eChip && (eChip === c || c.contains(eChip)) }; }), cnt: T.querySelector('.cnt').textContent, cntBox: (() => { const r = T.querySelector('.cnt').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; })(), go: (() => { const r = T.querySelector('.go').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; })() }; });
for (const [name, q] of [['two', 'recipe=family:511,block:Vd'], ['three', 'recipe=family:511,block:Vd,block:Gc'], ['oneBlock', 'recipe=block:Vd']]) {
  await page.goto(BASE + '?lens=river&' + q, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 }); await sleep(1000);
  out[name] = await trayFacts();
  await page.screenshot({ path: OUT + `coder-r2-tray-${name}.png`, clip: { x: 0, y: 790, width: 430, height: 60 } });
}
await browser.close();
fs.writeFileSync(OUT + 'coder-walk-r2-probe2.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
