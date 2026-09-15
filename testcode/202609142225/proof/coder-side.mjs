// Side tests for the mobile-coder critic: (A) a slow finger-scroll that starts on a tile — does the 450 ms press
// fire Measure / does a short one fire Navigate? (B) what the panel's ✕ does to the journey trail. (C) the
// "Open in ▾" menu by touch. Touch only.  node …/coder-side.mjs [port]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8890', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'], protocolTimeout: 90000 });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const out = { run_utc: new Date().toISOString(), tests: [] }; const log = (k, v) => { out.tests.push({ [k]: v }); console.log(k, JSON.stringify(v)); };
async function drag(x0, y0, x1, y1, steps = 8, dt = 20) { await page.touchscreen.touchStart(x0, y0); for (let s = 1; s <= steps; s++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps); await sleep(dt); } await page.touchscreen.touchEnd(); }
const facts = () => page.evaluate(() => { const P = document.getElementById('panel'); return { panelOpen: !P.hidden, head: (P.querySelector('.u-h') || {}).textContent || null, url: location.search, trail: document.getElementById('trail').textContent, overlayTop: document.getElementById('overlay').scrollTop, scrollY: Math.round(scrollY), tray: document.getElementById('tray').textContent.trim(), stage: (() => { const b = document.getElementById('stage').getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; })(), panelBox: (() => { const b = P.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; })() }; });
const tileInBand = () => page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < Math.min(st.bottom, P.top) - 10 && !e.closest('details'); }); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent, top: Math.round(r.top) }; });
async function closePanelByHandle() { for (let k = 0; k < 2; k++) { const f = await facts(); if (!f.panelOpen) break; const h = await page.evaluate(() => { const b = document.getElementById('panel-handle').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(400); } }
await page.goto(BASE + '?lens=table&key=family:511&trail=family:511&recipe=family:511,block:Vd', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 }); await sleep(1500);
await closePanelByHandle();
let f = await facts(); log('start', f);
// bring tiles into the live band (swipe within y stage.top..436)
let t = await tileInBand();
for (let k = 0; k < 3 && !t; k++) { await drag(215, Math.min(f.panelBox[0], f.stage[1]) - 16, 215, f.stage[0] + 16, 6, 20); await sleep(450); t = await tileInBand(); }
log('tile_in_band', t);
// A1: slow scroll starting on the tile (12 steps x 60 ms ≈ 750 ms, 100 px up)
let before = await facts(); await drag(t.x, t.y, t.x, t.y - 100, 12, 60); await sleep(900); let after = await facts();
log('A1_slow_scroll_on_tile_' + t.sym, { overlay: [before.overlayTop, after.overlayTop], panel: [before.panelOpen, after.panelOpen], head: after.head, url: after.url, measureInUrl: /&m=/.test(after.url) });
await page.screenshot({ path: OUT + 'coder-10-slow-scroll.png' });
// A2: quick short scroll starting on a tile (6 x 20 ms, 40 px) — is it read as a tap?
await closePanelByHandle(); t = await tileInBand(); if (!t) { await drag(215, 420, 215, 100, 6, 20); await sleep(450); t = await tileInBand(); }
before = await facts(); await drag(t.x, t.y, t.x, t.y - 40, 6, 20); await sleep(900); after = await facts();
log('A2_quick_short_scroll_on_tile_' + t.sym, { overlay: [before.overlayTop, after.overlayTop], panel: [before.panelOpen, after.panelOpen], head: after.head, url: after.url });
// A3: long press (hold 700 ms, no move) on a tile — the documented Measure gesture
await closePanelByHandle(); t = await tileInBand(); if (!t) { await drag(215, 420, 215, 100, 6, 20); await sleep(450); t = await tileInBand(); }
before = await facts(); await page.touchscreen.touchStart(t.x, t.y); await sleep(700); await page.touchscreen.touchEnd(); await sleep(900); after = await facts();
log('A3_long_press_tile_' + t.sym, { panel: [before.panelOpen, after.panelOpen], head: after.head, url: after.url, measureInUrl: /&m=/.test(after.url) });
await page.screenshot({ path: OUT + 'coder-10b-long-press.png' });
// B: the ✕ in the panel foot
if (!(await facts()).panelOpen) { t = await tileInBand(); await page.touchscreen.tap(t.x, t.y); await sleep(800); }
before = await facts();
const xb = await page.evaluate(() => { const b = document.querySelector('#panel-foot button.x').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: Math.round(b.width), h: Math.round(b.height), title: document.querySelector('#panel-foot button.x').title }; });
await page.touchscreen.tap(xb.x, xb.y); await sleep(700); after = await facts();
log('B_panel_x', { button: xb, trailBefore: before.trail, trailAfter: after.trail, urlBefore: before.url, urlAfter: after.url, panelAfter: after.panelOpen, trayAfter: after.tray });
await page.screenshot({ path: OUT + 'coder-11-after-x.png' });
// C: "Open in ▾" by touch: tap a tile, tap Open in, read the menu, tap "river"
t = await tileInBand(); if (!t) { await drag(215, 420, 215, 100, 6, 20); await sleep(450); t = await tileInBand(); }
await page.touchscreen.tap(t.x, t.y); await sleep(800);
const oi = await page.evaluate(() => { const b = [...document.querySelectorAll('#panel-foot .u-chip')].find(x => /Open in/.test(x.textContent)).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: Math.round(b.width), h: Math.round(b.height) }; });
await page.touchscreen.tap(oi.x, oi.y); await sleep(400);
const menu = await page.evaluate(() => { const m = document.querySelector('#panel-foot .open-in .menu'); const r = m.getBoundingClientRect(); return { hidden: m.hidden, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), items: [...m.querySelectorAll('a')].map(a => { const b = a.getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return `${a.textContent}(${Math.round(b.width)}x${Math.round(b.height)}@y${Math.round(b.top)} reach=${e === a || a.contains(e)})`; }) }; });
log('C_open_in_menu', { button: oi, menu });
const riverItem = await page.evaluate(() => { const a = [...document.querySelectorAll('#panel-foot .open-in .menu a')].find(x => x.textContent === 'river'); const b = a.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
await page.screenshot({ path: OUT + 'coder-12-open-in-menu.png' });
await page.touchscreen.tap(riverItem.x, riverItem.y); await sleep(1200); after = await facts();
log('C_open_in_river', { url: after.url, head: after.head, panelOpen: after.panelOpen, lens: await page.evaluate(() => (document.querySelector('#lensbar a.on') || {}).textContent) });
// D: swipe between lenses with two fingers? (GRAMMAR says pinch-scale ~1 and dx>60 switches lens) — not attempted: two-finger gestures are not part of this task.
await browser.close();
fs.writeFileSync(OUT + 'coder-side.json', JSON.stringify(out, null, 1));
