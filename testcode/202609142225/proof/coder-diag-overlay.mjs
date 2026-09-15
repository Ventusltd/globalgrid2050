// Diagnosis: why does a finger drag over the table lens's tile overlay not scroll it at 430 px?
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/coder-diag-overlay.mjs [port]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8890', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'], protocolTimeout: 60000 });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const out = { run_utc: new Date().toISOString(), tests: [] };
const log = (k, v) => { out.tests.push({ [k]: v }); console.log(k, JSON.stringify(v)); };
await page.goto(BASE + '?lens=table&recipe=family:511', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 }); await sleep(1500);
await page.screenshot({ path: OUT + 'coder-diag-table-fresh.png' });
const env = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const e = document.elementFromPoint(215, st.top + st.height / 2); const ov = document.getElementById('overlay'); const cs = getComputedStyle(ov); return { innerW: innerWidth, innerH: innerHeight, scrollY, stage: [Math.round(st.top), Math.round(st.bottom)], hitMid: e ? e.tagName + '.' + e.className : null, hitChainTouchAction: (() => { const a = []; let n = e; while (n && n !== document.body) { a.push(n.tagName + (n.id ? '#' + n.id : '') + ':' + getComputedStyle(n).touchAction + '/' + getComputedStyle(n).overflowY); n = n.parentElement; } return a; })(), overlay: { scrollH: ov.scrollHeight, clientH: ov.clientHeight, overflowY: cs.overflowY, touchAction: cs.touchAction, pointerEvents: cs.pointerEvents, hidden: ov.hidden }, panelOpen: !document.getElementById('panel').hidden, tiles: document.querySelectorAll('.tile').length }; });
log('env', env);
// event counters
await page.evaluate(() => { window.__ev = {}; const c = n => e => { window.__ev[n] = (window.__ev[n] || 0) + 1; window.__ev[n + '_target'] = (e.target.className || e.target.id || e.target.tagName); }; const ov = document.getElementById('overlay'); for (const n of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'scroll']) ov.addEventListener(n, c('ov_' + n), { passive: true }); for (const n of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointercancel']) document.addEventListener(n, c('doc_' + n), { passive: true, capture: true }); });
const mid = env.stage[0] + (env.stage[1] - env.stage[0]) / 2;
async function drag(x0, y0, x1, y1, steps, dt) { await page.touchscreen.touchStart(x0, y0); for (let s = 1; s <= steps; s++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps); await sleep(dt); } await page.touchscreen.touchEnd(); }
const st = () => page.evaluate(() => ({ scrollTop: document.getElementById('overlay').scrollTop, ev: window.__ev, head: (document.querySelector('#panel .u-h') || {}).textContent || null, panelOpen: !document.getElementById('panel').hidden, url: location.search }));
// A: fast drag, 6 steps x 20 ms (as in the walk)
await page.evaluate(() => window.__ev = {});
await drag(215, env.stage[1] - 30, 215, env.stage[0] + 30, 6, 20); await sleep(500); log('A_fast_drag_6x20', await st());
// B: slow drag, 20 steps x 30 ms
await page.evaluate(() => window.__ev = {});
await drag(215, env.stage[1] - 30, 215, env.stage[0] + 30, 20, 30); await sleep(500); log('B_slow_drag_20x30', await st());
// C: drag starting in the gap between tiles / on a heading (x=20)
await page.evaluate(() => window.__ev = {});
const gap = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); for (let y = st.top + 20; y < st.bottom - 20; y += 4) { const e = document.elementFromPoint(20, y); if (e && !e.closest('.tile') && e.closest('#overlay')) return { y, el: e.tagName + '.' + e.className }; } return null; });
log('C_gap_point', gap);
if (gap) { await drag(20, Math.min(gap.y + 300, env.stage[1] - 20), 20, gap.y, 12, 25); await sleep(500); log('C_drag_off_tile', await st()); }
// D: native CDP scroll gesture (what a real finger fling produces)
await page.evaluate(() => window.__ev = {});
const cdp = await page.createCDPSession();
await cdp.send('Input.synthesizeScrollGesture', { x: 215, y: Math.round(mid), yDistance: -400, gestureSourceType: 'touch', speed: 800 }); await sleep(800); log('D_cdp_synthesizeScrollGesture_touch', await st());
// E: tap a visible tile (do taps reach tiles at all?)
const t = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < st.bottom - 10; }); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent }; });
if (t) { await page.evaluate(() => window.__ev = {}); await page.touchscreen.tap(t.x, t.y); await sleep(900); log('E_tap_tile_' + t.sym, await st()); }
// F: swipe right 90 px on that tile (documented compose gesture), fast
if (t) { await page.evaluate(() => window.__ev = {}); const pre = await st(); await drag(t.x - 30, t.y, t.x + 70, t.y, 6, 20); await sleep(700); const post = await st(); log('F_swipe_right_tile_' + t.sym, { before_url: pre.url, after_url: post.url, ev: post.ev, tray: await page.evaluate(() => document.getElementById('tray').textContent.trim()) }); }
// G: wheel (a mouse, for contrast — not touch)
await page.mouse.move(215, mid); await page.mouse.wheel({ deltaY: 400 }); await sleep(500); log('G_mouse_wheel', await st());
await page.screenshot({ path: OUT + 'coder-diag-table-after.png' });
await browser.close();
fs.writeFileSync(OUT + 'coder-diag-overlay.json', JSON.stringify(out, null, 1));
