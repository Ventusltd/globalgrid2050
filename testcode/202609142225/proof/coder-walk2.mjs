// Mobile-coder critic, round 1, pass 2: the same journey by touch, recovering the way a person would when the first
// pass got stuck (drag the panel handle down to see the table; scroll tiles and the recipe sheet with a finger).
// Also: a slow finger-scroll over tiles (does a press fire Measure?), and what the panel's ✕ does to the trail.
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/coder-walk2.mjs [port]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8890', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const ARGS = ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ARGS });
const report = { run_utc: new Date().toISOString(), base: BASE, viewport: '430x900 dpr2 isMobile hasTouch', steps: [], console: [] };
const targets = []; browser.on('targetcreated', t => targets.push({ url: t.url(), type: t.type() }));
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => report.console.push('pageerror: ' + e.message));
page.on('requestfailed', r => report.console.push('requestfailed: ' + r.url()));
let taps = 0, step = null;
function begin(name) { step = { name, taps: 0, drags: 0, notes: [] }; report.steps.push(step); console.log('\n== ' + name); }
function note(s) { step.notes.push(s); console.log('  ' + s); }
async function shot(name) { await page.screenshot({ path: OUT + `coder-${name}.png` }); }
async function probe(sel, text) {
  return page.evaluate((s, t) => { const es = [...document.querySelectorAll(s)]; const e = t ? es.find(x => x.textContent.trim() === t || x.textContent.trim().startsWith(t)) : es[0]; if (!e) return null; const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; const hit = document.elementFromPoint(cx, cy); const reach = !!hit && (hit === e || e.contains(hit) || hit.contains(e)); const hitDesc = hit ? (hit.id ? '#' + hit.id : hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ').join('.')) + ' "' + hit.textContent.trim().slice(0, 30) + '"' : 'nothing (off screen)'; return { x: cx, y: cy, w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom), inViewport: b.top >= 0 && b.bottom <= innerHeight, reach, hitDesc, text: e.textContent.trim().slice(0, 60) }; }, sel, text || null);
}
async function tapEl(sel, text, why) {
  const p = await probe(sel, text); if (!p) { note(`NO ELEMENT ${sel} ${text || ''} (${why})`); return null; }
  if (!p.inViewport || !p.reach) note(`target "${p.text}" at y ${p.top}-${p.bottom}: ${p.inViewport ? '' : 'OFF SCREEN; '}${p.reach ? '' : 'covered by ' + p.hitDesc}`);
  await page.touchscreen.tap(p.x, p.y); step.taps++; taps++;
  note(`tap ${step.taps}: ${why} → "${p.text.slice(0, 40)}" ${p.w}x${p.h} at (${Math.round(p.x)},${Math.round(p.y)})${p.reach && p.inViewport ? '' : ' [NOT REACHABLE]'}`);
  return p;
}
async function drag(x0, y0, x1, y1, steps = 8, dt = 20) { await page.touchscreen.touchStart(x0, y0); for (let s = 1; s <= steps; s++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps); await sleep(dt); } await page.touchscreen.touchEnd(); step.drags++; }
const facts = () => page.evaluate(() => { const r = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; }; return { innerH: innerHeight, scrollY: Math.round(scrollY), stage: r('stage'), panel: r('panel'), panelTall: document.getElementById('panel').classList.contains('tall'), sheet: r('sheet'), tray: document.getElementById('tray').textContent.trim(), url: location.search, head: (document.querySelector('#panel .u-h') || {}).textContent || null, trail: document.getElementById('trail').textContent, lens: (document.querySelector('#lensbar a.on') || {}).textContent, overlayTop: document.getElementById('overlay').scrollTop }; });
const vdInfo = () => page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => x.querySelector('b').textContent === 'Vd'); if (!t) return null; const r = t.getBoundingClientRect(); const st = document.getElementById('stage').getBoundingClientRect(); const pnl = document.getElementById('panel'); const pr = pnl.hidden ? null : pnl.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const h = document.elementFromPoint(cx, cy); return { x: cx, y: cy, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), inStage: r.top >= st.top && r.bottom <= st.bottom, underPanel: !!pr && r.bottom > pr.top && r.top < pr.bottom, reach: !!h && (h === t || t.contains(h)), hit: h ? (h.id ? '#' + h.id : h.className) : 'none', scrollTop: document.getElementById('overlay').scrollTop }; });

// -------- steps 1–5 (as pass 1; brief)
begin('01-05-replay');
await page.goto(BASE + '?lens=ring', { waitUntil: 'networkidle0', timeout: 90000 });
await page.evaluate(() => { try { localStorage.removeItem('star-generator.recipe'); } catch (e) {} });
await page.goto(BASE + '?lens=ring', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 }); await sleep(1000);
await tapEl('.u-search', null, 'search box'); await page.keyboard.type('distance', { delay: 30 }); await sleep(600);
await tapEl('.u-hits button', '#511 distanceKm', 'first hit');
await page.waitForFunction(() => !document.getElementById('panel').hidden && !/Loading family/.test(document.getElementById('panel').textContent), { timeout: 30000 }); await sleep(500);
await tapEl('#panel-foot .u-chip', 'Measure', 'Measure');
await page.waitForFunction(() => { const c = document.querySelector('#panel .u-code'); return c && !/Fetching/.test(c.textContent); }, { timeout: 40000 }); await sleep(400);
{ const pb = await page.evaluate(() => { const b = document.getElementById('panel-body').getBoundingClientRect(); return { x: b.left + b.width / 2, top: b.top, bottom: b.bottom }; }); await drag(pb.x, pb.bottom - 30, pb.x, pb.top + 30, 10, 16); await sleep(400); }
const codeBox = await page.evaluate(() => { const c = document.querySelector('#panel .u-code'); const ls = [...c.querySelectorAll('.u-line')]; return { scrollW: c.scrollWidth, clientW: c.clientWidth, longest: ls.map(l => ({ k: l.querySelector('.u-key').textContent, w: Math.round(l.getBoundingClientRect().width), sw: l.scrollWidth })).sort((a, b) => b.sw - a.sw)[0], keys: ls.map(l => l.querySelector('.u-key').textContent) }; });
note(`code box: scrollWidth ${codeBox.scrollW} vs clientWidth ${codeBox.clientW}; keys in order: ${codeBox.keys.join(', ')}; widest line key ${codeBox.longest.k} (${codeBox.longest.sw} px)`);
await tapEl('#panel-foot .u-chip', 'Add to recipe', 'Add to recipe (family)'); await sleep(400);
await tapEl('#lensbar a', 'table', 'table tab'); await sleep(1200);
let f = await facts(); note(`after table tab: panel tall=${f.panelTall} ${JSON.stringify(f.panel)} over stage ${JSON.stringify(f.stage)}; tray "${f.tray}"`);
note(`taps so far: ${taps}`);

// -------- step 6: see the table (the panel hides it), find Vd, add it
begin('06-shrink-panel');
const handle = await probe('#panel-handle');
note(`panel handle: ${handle.w}x${handle.h} at y ${handle.top}-${handle.bottom}, reach=${handle.reach} (${handle.hitDesc})`);
await drag(handle.x, handle.y, handle.x, handle.y + 120, 8, 20); await sleep(500);
f = await facts(); note(`drag ${step.drags} handle down 120 px: panel tall=${f.panelTall} ${JSON.stringify(f.panel)}; panel hidden=${f.panel === null}`);
await shot('06a-after-handle-drag-1');
if (f.panel) { const h2 = await probe('#panel-handle'); await drag(h2.x, h2.y, h2.x, h2.y + 120, 8, 20); await sleep(500); f = await facts(); note(`drag ${step.drags} handle down again: panel ${f.panel ? 'still open ' + JSON.stringify(f.panel) : 'closed'}; trail "${f.trail}"; url ${f.url}`); }
await shot('06b-after-handle-drag-2');
const vis = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const pnl = document.getElementById('panel'); const pr = pnl.hidden ? null : pnl.getBoundingClientRect(); const tiles = [...document.querySelectorAll('.tile')]; const v = tiles.filter(t => { const r = t.getBoundingClientRect(); return r.top >= st.top && r.bottom <= st.bottom && (!pr || r.bottom <= pr.top); }); return { visible: v.length, first: v.slice(0, 8).map(t => t.querySelector('b').textContent), stageTop: Math.round(st.top), stageBottom: Math.round(st.bottom), scrollY: Math.round(scrollY) }; });
note(`tiles now visible and uncovered: ${vis.visible} (${vis.first.join(', ')}); stage y ${vis.stageTop}-${vis.stageBottom}, page scrollY ${vis.scrollY}`);

begin('06-scroll-to-Vd');
let vd = await vdInfo(); note(`Vd tile before scrolling: y ${vd.top}-${vd.bottom}, overlay scrollTop ${vd.scrollTop}`);
const headBefore = (await facts()).head;
for (let k = 0; k < 12 && !(vd.inStage && !vd.underPanel && vd.reach); k++) {
  const st = await page.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); const pnl = document.getElementById('panel'); const pr = pnl.hidden ? null : pnl.getBoundingClientRect(); return { x: b.left + b.width / 2, top: Math.max(0, b.top), bottom: Math.min(pr ? pr.top : 1e9, b.bottom, innerHeight) }; });
  await drag(st.x, st.bottom - 24, st.x, st.top + 24, 6, 20); await sleep(450);
  vd = await vdInfo(); const ff = await facts();
  note(`drag ${step.drags} (${Math.round(st.bottom - 24)}→${Math.round(st.top + 24)}): overlay scrollTop ${vd.scrollTop}; Vd y ${vd.top}-${vd.bottom} inStage=${vd.inStage} reach=${vd.reach}${ff.head !== headBefore ? ' · STRAY panel change → ' + ff.head : ''}`);
}
await shot('06c-Vd-in-view');
note(`Vd centre (${Math.round(vd.x)},${Math.round(vd.y)}) hit-test: ${vd.hit}`);

begin('06-swipe-Vd');
const x0 = vd.left + 18;
await drag(x0, vd.y, x0 + 90, vd.y, 6, 20); await sleep(700);
f = await facts(); const swiped = /Vd/.test(f.tray);
note(`swipe-right 90 px across the Vd tile: tray "${f.tray}" → ${swiped ? 'ADDED by swipe' : 'not added by swipe'}; panel head "${f.head}"; overlay scrollTop ${f.overlayTop}`);
await shot('06d-after-swipe');

begin('06-tap-Vd');
if (!swiped) {
  vd = await vdInfo();
  await page.touchscreen.tap(vd.x, vd.y); step.taps++; taps++; note(`tap ${step.taps}: Vd tile at (${Math.round(vd.x)},${Math.round(vd.y)}) reach=${vd.reach}`);
  await sleep(900); f = await facts(); note(`panel head "${f.head}" tall=${f.panelTall} ${JSON.stringify(f.panel)}; url ${f.url}; scrollY ${f.scrollY}`);
  await shot('06e-Vd-panel');
  const vdVisible = await vdInfo(); note(`Vd tile with its panel open: y ${vdVisible.top}-${vdVisible.bottom}, underPanel=${vdVisible.underPanel}`);
  await tapEl('#panel-foot .u-chip', 'Add to recipe', 'Add to recipe (Vd)'); await sleep(500);
  f = await facts();
}
note(`tray "${f.tray}" · recipe=${decodeURIComponent((f.url.match(/recipe=([^&]*)/) || [])[1] || '')}`);
const marks = await page.evaluate(() => ({ recipeTiles: [...document.querySelectorAll('.tile.recipe')].map(t => t.querySelector('b').textContent), trayChips: [...document.querySelectorAll('#tray .rc')].map(c => ({ t: c.textContent.replace('×', '').trim(), w: Math.round(c.getBoundingClientRect().width), right: Math.round(c.getBoundingClientRect().right), border: c.style.borderColor })), cnt: (document.querySelector('#tray .cnt') || {}).textContent, cntLeft: Math.round((document.querySelector('#tray .cnt') || document.body).getBoundingClientRect().left) }));
note(`tiles outlined as recipe: ${marks.recipeTiles.join(', ') || 'none'} · tray chips ${JSON.stringify(marks.trayChips)} · count "${marks.cnt}" at x ${marks.cntLeft}`);
await shot('06-Vd-added');

// -------- step 7: river
begin('07-river');
await tapEl('#lensbar a', 'river', 'river tab'); await sleep(1500);
f = await facts(); note(`lens ${f.lens}; tray "${f.tray}"; url ${f.url}; panel head "${f.head}" tall=${f.panelTall} ${JSON.stringify(f.panel)}`);
const rv = await page.evaluate(() => ({ labels: [...document.querySelectorAll('#labels span')].filter(s => !s.hidden).map(s => s.textContent), trayChips: [...document.querySelectorAll('#tray .rc')].map(c => c.textContent.replace('×', '').trim()), hint: document.getElementById('hint').textContent }));
note(`both in recipe: ${rv.trayChips.includes('#511') && rv.trayChips.includes('Vd')} (${rv.trayChips.join(' | ')}); labels on river: ${rv.labels.join(', ')}`);
await shot('07-river');

// -------- step 8: recipe sheet, scroll to the hand-off row
begin('08-sheet');
await tapEl('#tray .cnt', null, 'recipe count in the tray'); await sleep(600);
let sh = await page.evaluate(() => { const S = document.getElementById('sheet'); const b = S.getBoundingClientRect(); const row = [...S.querySelectorAll('.ch')].map(r => ({ text: r.textContent.trim(), parts: [...r.children].map(c => ({ t: c.textContent.trim().slice(0, 20), w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) })) })); const ho = [...S.querySelectorAll('.row .u-chip')].map(c => ({ t: c.textContent.trim(), top: Math.round(c.getBoundingClientRect().top) })); return { top: Math.round(b.top), bottom: Math.round(b.bottom), scrollH: S.scrollHeight, clientH: S.clientHeight, head: (S.querySelector('.u-h') || {}).textContent, rows: row, buttons: ho, handoff: (S.querySelector('span[style*="overflow-wrap"]') || {}).textContent, needs: (S.querySelector('.u-need') || {}).textContent, pinned: [...S.querySelectorAll('.pin div')].length }; });
note(`sheet y ${sh.top}-${sh.bottom}, content ${sh.scrollH} in ${sh.clientH}; head "${sh.head}"`);
for (const r of sh.rows) note(`row: "${r.text}" parts ${r.parts.map(p => `${p.t}(${p.w}x${p.h})`).join(' ')}`);
note(`hand-off buttons at y ${sh.buttons.map(b => `${b.t}@${b.top}`).join(', ')} (viewport 900) · needs "${(sh.needs || '').slice(0, 80)}" · pinned files ${sh.pinned}`);
note(`hand-off url shown: ${sh.handoff}`);
await shot('08a-sheet-top');
for (let k = 0; k < 4; k++) { const b = await probe('#sheet .row .u-chip', 'Hand off'); if (b && b.inViewport && b.reach) break; const s = await page.evaluate(() => { const r = document.getElementById('sheet').getBoundingClientRect(); return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom }; }); await drag(s.x, s.bottom - 40, s.x, s.top + 40, 8, 16); await sleep(400); const st = await page.evaluate(() => document.getElementById('sheet').scrollTop); note(`drag ${step.drags} up the sheet: sheet scrollTop ${st}`); }
await shot('08b-sheet-scrolled');

// -------- step 9: hand off from the sheet
begin('09-handoff');
const nT = targets.length;
await tapEl('#sheet .row .u-chip', 'Hand off', 'Hand off in the sheet'); await sleep(2500);
let opened = targets.slice(nT); note(`new tabs: ${opened.map(t => t.url).join(' ; ') || 'none'}`);
if (!opened.length) { await tapEl('#tray .go', null, 'Hand off in the tray'); await sleep(2500); opened = targets.slice(nT); note(`new tabs: ${opened.map(t => t.url).join(' ; ') || 'none'}`); }
step.handoffURL = opened.length ? opened[0].url : null;
const hp = (await browser.pages()).find(p => p !== page && /code-generator/.test(p.url()));
if (hp) { await hp.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true }).catch(() => {}); await hp.waitForNetworkIdle({ timeout: 30000 }).catch(() => {}); await sleep(1500); const pk = await hp.evaluate(() => { const T = document.body.innerText; return { title: document.title, scrollWidth: document.documentElement.scrollWidth, hasVd: /\bVd\b/.test(T), hasSs: /\bSs\b/.test(T), hasFamily: /famil|511/i.test(T), hasFrom: /star-generator/i.test(T), sel: [...document.querySelectorAll('input:checked, [aria-pressed="true"], .selected, .on')].map(e => e.textContent.trim() || e.value).slice(0, 10), text: T.replace(/\s+/g, ' ').slice(0, 700) }; }); step.picker = pk; note(`picker: title "${pk.title}", scrollWidth ${pk.scrollWidth}, mentions Vd=${pk.hasVd} Ss=${pk.hasSs} family/511=${pk.hasFamily}; selected-looking: ${JSON.stringify(pk.sel)}`); note(`picker text: ${pk.text}`); await hp.screenshot({ path: OUT + 'coder-09b-picker.png' }); await hp.screenshot({ path: OUT + 'coder-09c-picker-full.png', fullPage: true }); }
await shot('09-handoff');

// -------- side tests
begin('10-slow-scroll-on-tiles');
await page.evaluate(() => document.getElementById('sheet').hidden = true);
await tapEl('#lensbar a', 'table', 'table tab'); await sleep(1200);
f = await facts(); note(`panel on return to table: ${f.panel ? 'open tall=' + f.panelTall : 'closed'}; head "${f.head}"`);
if (f.panel) { const h = await probe('#panel-handle'); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(400); f = await facts(); if (f.panel) { const h2 = await probe('#panel-handle'); await drag(h2.x, h2.y, h2.x, h2.y + 120, 8, 20); await sleep(400); f = await facts(); } note(`after handle drags: panel ${f.panel ? 'open' : 'closed'}`); }
const tile0 = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const t = [...document.querySelectorAll('.tile')].find(x => { const r = x.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < st.bottom - 10; }); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: t.querySelector('b').textContent }; });
if (tile0) { const before = await facts(); await drag(tile0.x, tile0.y, tile0.x, tile0.y - 120, 12, 60); await sleep(900); const after = await facts(); note(`slow finger-scroll (~750 ms) starting on tile ${tile0.sym}: overlay scrollTop ${before.overlayTop}→${after.overlayTop}; panel ${before.panel ? 'open' : 'closed'}→${after.panel ? 'open head "' + after.head + '"' : 'closed'}; measure in url: ${/&m=/.test(after.url)} (${after.url})`); await shot('10-slow-scroll'); }
begin('11-panel-x');
if (!(await facts()).panel) { const t = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < st.bottom - 10 && !e.closest('details'); }); const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent }; }); await page.touchscreen.tap(t.x, t.y); step.taps++; taps++; await sleep(800); note(`tap a tile (${t.sym}) to open a panel: head "${(await facts()).head}"`); }
f = await facts(); note(`before ✕: trail "${f.trail}", url ${f.url}`);
await tapEl('#panel-foot button.x', null, 'the ✕ in the panel foot'); await sleep(700);
f = await facts(); note(`after ✕: panel ${f.panel ? 'open' : 'closed'}; trail "${f.trail}"; url ${f.url}; tray "${f.tray}"`);
await shot('11-after-x');
report.totalTaps = taps;
await browser.close();
fs.writeFileSync(OUT + 'coder-walk2.json', JSON.stringify(report, null, 1));
console.log('\nwritten coder-walk2.json · total taps', taps, '· console', report.console.length ? report.console : 'clean');
