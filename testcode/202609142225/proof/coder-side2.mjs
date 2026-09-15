// Long-press on a table tile by touch, with the overlay's fling settled first (the earlier attempt landed on a repo chip).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8890', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'], protocolTimeout: 90000 });
const page = await browser.newPage(); await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const out = { run_utc: new Date().toISOString(), tests: [] }; const log = (k, v) => { out.tests.push({ [k]: v }); console.log(k, JSON.stringify(v)); };
async function drag(x0, y0, x1, y1, steps = 8, dt = 20) { await page.touchscreen.touchStart(x0, y0); for (let s = 1; s <= steps; s++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps); await sleep(dt); } await page.touchscreen.touchEnd(); }
const facts = () => page.evaluate(() => { const P = document.getElementById('panel'); return { panelOpen: !P.hidden, tall: P.classList.contains('tall'), head: (P.querySelector('.u-h') || {}).textContent || null, url: location.search, overlayTop: document.getElementById('overlay').scrollTop, code: (P.querySelector('.u-code') || {}).textContent || null }; });
await page.goto(BASE + '?lens=table&recipe=family:511,block:Vd', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 }); await sleep(1500);
let st = await page.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), panelBox: [Math.round(P.top), Math.round(P.bottom)], live: Math.round(Math.min(P.top, b.bottom, innerHeight)), scrollY: Math.round(scrollY) }; });
log('fresh_table_bands', { ...st, stageCoveredEntirely: st.top >= st.panelBox[0] });
// Q1: does a swipe up that starts on the closed panel's box scroll the page?
await drag(215, 700, 215, 300, 10, 30); await sleep(1200);
let q = await page.evaluate(() => ({ scrollY: Math.round(scrollY), overlayTop: document.getElementById('overlay').scrollTop, stageTop: Math.round(document.getElementById('stage').getBoundingClientRect().top) }));
log('Q1_swipe_on_dead_box_700to300', q);
// Q2: a swipe up that starts on the legend (above the box)
await drag(215, 400, 215, 100, 10, 30); await sleep(1200);
q = await page.evaluate(() => ({ scrollY: Math.round(scrollY), overlayTop: document.getElementById('overlay').scrollTop, stageTop: Math.round(document.getElementById('stage').getBoundingClientRect().top) }));
log('Q2_swipe_on_legend_400to100', q);
st = await page.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), panelBox: [Math.round(P.top), Math.round(P.bottom)], live: Math.round(Math.min(P.top, b.bottom, innerHeight)), scrollY: Math.round(scrollY) }; });
log('bands_after_page_swipes', st);
if (st.live - st.top > 60) { await drag(215, st.live - 16, 215, st.top + 16, 10, 30); await sleep(1500); }   // let any fling settle
const t = await page.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > s.top + 10 && r.bottom < Math.min(s.bottom, P.top) - 10 && !e.closest('details'); }); if (!x) return null; const r = x.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent, hit: h ? h.tagName + '.' + h.className : 'none', reach: h === x || x.contains(h) }; });
log('tile', t);
const before = await facts();
await page.touchscreen.touchStart(t.x, t.y); await sleep(700); await page.touchscreen.touchEnd(); await sleep(1500);
let after = await facts();
log('A3_long_press_' + t.sym, { before: { panel: before.panelOpen, overlay: before.overlayTop }, after: { panel: after.panelOpen, tall: after.tall, head: after.head, url: after.url, measureInUrl: /&m=/.test(after.url), codeFetched: after.code ? after.code.slice(0, 80) : null } });
await page.screenshot({ path: OUT + 'coder-10b-long-press.png' });
// and a plain tap on the same tile for contrast (after closing the panel via handle)
for (let k = 0; k < 2; k++) { const f = await facts(); if (!f.panelOpen) break; const h = await page.evaluate(() => { const b = document.getElementById('panel-handle').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(400); }
const t2 = await page.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > s.top + 10 && r.bottom < Math.min(s.bottom, P.top) - 10 && !e.closest('details'); }); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent }; });
await page.touchscreen.tap(t2.x, t2.y); await sleep(1000); after = await facts();
log('tap_' + t2.sym, { panel: after.panelOpen, tall: after.tall, head: after.head, url: after.url, measureInUrl: /&m=/.test(after.url) });
await browser.close(); fs.writeFileSync(OUT + 'coder-side2.json', JSON.stringify(out, null, 1));
