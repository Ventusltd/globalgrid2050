// Round-2 side probe: is the lens bar really 1 px below the screen, and is the sheet's "✕ close" reachable under the sticky action row?
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
await page.goto(BASE + '?lens=river&key=family:511&trail=family:511&recipe=family:511,block:Vd', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 }); await sleep(1200);
out.lensbar = await page.evaluate(() => { const L = document.getElementById('lensbar').getBoundingClientRect(); const a = document.querySelector('#lensbar a').getBoundingClientRect(); return { innerHeight, visualViewportH: visualViewport.height, visualOffsetTop: visualViewport.offsetTop, lensbar: [L.top, L.bottom], tab: [a.top, a.bottom], docClientH: document.documentElement.clientHeight, hitAt873: (document.elementFromPoint(322, 873) || {}).textContent, hitAt899: (document.elementFromPoint(322, 899) || {}).textContent }; });
// open the sheet by tapping the tray
const tr = await page.evaluate(() => { const r = document.getElementById('tray').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.touchscreen.tap(tr.x, tr.y); await sleep(700);
out.sheet = await page.evaluate(() => { const S = document.getElementById('sheet'); const c = [...S.querySelectorAll('button')].find(b => /close/.test(b.textContent)); const r = c.getBoundingClientRect(); const row = S.querySelector('.row.act').getBoundingClientRect(); const pts = [[r.left + r.width / 2, r.top + 3], [r.left + r.width / 2, r.top + r.height / 2], [r.left + r.width / 2, r.bottom - 3]].map(([x, y]) => { const e = document.elementFromPoint(x, y); return `(${Math.round(x)},${Math.round(y)})→${e === c || c.contains(e) ? 'close' : e ? e.tagName + '.' + e.className + ' "' + e.textContent.trim().slice(0, 12) + '"' : 'none'}`; }); return { hidden: S.hidden, close: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], actRow: [Math.round(row.left), Math.round(row.top), Math.round(row.right), Math.round(row.bottom)], overlapY: Math.max(0, Math.min(r.bottom, row.bottom) - Math.max(r.top, row.top)), pts, cntText: document.querySelector('#tray .cnt').textContent }; });
await page.screenshot({ path: OUT + 'coder-r2-08c-sheet-close.png', clip: { x: 0, y: 160, width: 430, height: 120 } });
// tap the close and see whether it closes
const c = await page.evaluate(() => { const S = document.getElementById('sheet'); const c = [...S.querySelectorAll('button')].find(b => /close/.test(b.textContent)); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.touchscreen.tap(c.x, c.y); await sleep(500);
out.afterCloseTap = await page.evaluate(() => ({ sheetHidden: document.getElementById('sheet').hidden, panelHidden: document.getElementById('panel').hidden, url: location.search }));
// the tray at the moment: which words does a person actually see (ellipsis)?
out.tray = await page.evaluate(() => { const c = document.querySelector('#tray .cnt'); const r = c.getBoundingClientRect(); const range = document.createRange(); const t = c.firstChild; let visible = ''; for (let i = 1; i <= t.length; i++) { range.setStart(t, 0); range.setEnd(t, i); if (range.getBoundingClientRect().right <= r.right - 12) visible = t.data.slice(0, i); else break; } return { full: c.textContent, visibleApprox: visible + '…', box: [Math.round(r.left), Math.round(r.right)] }; });
await page.screenshot({ path: OUT + 'coder-r2-tray-crop.png', clip: { x: 0, y: 790, width: 430, height: 110 } });
// long-press on a line key inside the measured panel: does the shared-line count show as a tip?
await page.evaluate(() => { const S = document.getElementById('sheet'); S.hidden = true; });
await browser.close();
fs.writeFileSync(OUT + 'coder-walk-r2-probe.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
