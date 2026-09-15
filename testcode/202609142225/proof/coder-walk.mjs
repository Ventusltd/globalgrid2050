// Mobile-coder critic, round 1: a person on a 430 px phone composes a small tool by touch alone.
// Every action goes through page.touchscreen (tap / touchStart-Move-End); the keyboard is only used to type into the
// search box after it was tapped (the on-screen keyboard of a phone). Nothing is driven through window.__star or
// synthetic clicks. Results: proof/coder-walk.json; screenshots proof/coder-<step>.png.
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/coder-walk.mjs [port]
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
const targets = [];
browser.on('targetcreated', t => targets.push({ url: t.url(), type: t.type(), at: Date.now() }));
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => report.console.push('pageerror: ' + e.message));
page.on('requestfailed', r => report.console.push('requestfailed: ' + r.url()));

let taps = 0, step = null;
function begin(name) { step = { name, taps: 0, drags: 0, notes: [], byTouch: true }; report.steps.push(step); console.log('\n== ' + name); }
function note(s) { step.notes.push(s); console.log('  ' + s); }
async function shot(name) { await page.screenshot({ path: OUT + `coder-${name}.png` }); step.shot = `coder-${name}.png`; }

// geometry of one element, plus what a finger at its centre would actually hit (fixed bars, sheets, the panel)
async function probe(sel, text) {
  return page.evaluate((s, t) => {
    const es = [...document.querySelectorAll(s)]; const e = t ? es.find(x => x.textContent.trim() === t || x.textContent.trim().startsWith(t)) : es[0];
    if (!e) return null;
    const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const hit = document.elementFromPoint(cx, cy); const reach = hit && (hit === e || e.contains(hit) || hit.contains(e));
    const hitDesc = hit ? (hit.id ? '#' + hit.id : hit.tagName.toLowerCase() + (hit.className ? '.' + String(hit.className).split(' ').join('.') : '')) + ' "' + hit.textContent.trim().slice(0, 30) + '"' : 'nothing';
    return { x: cx, y: cy, w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), inViewport: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, reach, hitDesc, text: e.textContent.trim().slice(0, 80), clipped: e.scrollWidth > e.clientWidth + 1 };
  }, sel, text || null);
}
async function tapEl(sel, text, why) {
  const p = await probe(sel, text);
  if (!p) { note(`NO ELEMENT for ${sel} ${text || ''} (${why})`); step.byTouch = false; return null; }
  if (!p.inViewport) note(`target ${text || sel} is partly off screen (top ${p.top}, bottom ${p.bottom}) — a finger cannot reach it without scrolling`);
  if (!p.reach) { note(`target ${text || sel} at (${Math.round(p.x)},${Math.round(p.y)}) is covered by ${p.hitDesc}; a tap there would not reach it`); }
  if (p.w < 44 || p.h < 44) note(`target ${text || sel} is ${p.w}x${p.h} px (under 44 px)`);
  await page.touchscreen.tap(p.x, p.y); step.taps++; taps++;
  note(`tap ${step.taps}: ${why} → "${p.text.slice(0, 40)}" ${p.w}x${p.h} at (${Math.round(p.x)},${Math.round(p.y)})${p.reach ? '' : ' [BLOCKED by ' + p.hitDesc + ']'}`);
  return p;
}
async function drag(x0, y0, x1, y1, steps = 8, dt = 20) { await page.touchscreen.touchStart(x0, y0); for (let s = 1; s <= steps; s++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps); await sleep(dt); } await page.touchscreen.touchEnd(); step.drags++; }
async function layoutFacts() {
  return page.evaluate(() => {
    const r = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) }; };
    const R = { stage: r('stage'), panel: r('panel'), tray: r('tray'), lensbar: r('lensbar'), sheet: r('sheet'), search: r('search') };
    const ov = (a, b) => a && b ? Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
    const clipped = [...document.querySelectorAll('#tray .rc, #tray .cnt, #tray .go, #panel-foot .u-chip, .tile .t, #lensbar a')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className + ' "' + e.textContent.trim().slice(0, 40) + '"');
    const trayFull = document.getElementById('tray'); const trayHidden = [...trayFull.querySelectorAll('.rc')].filter(c => c.getBoundingClientRect().right > trayFull.getBoundingClientRect().right - 1 || c.getBoundingClientRect().right > (trayFull.querySelector('.cnt') || trayFull).getBoundingClientRect().left + 1).length;
    return { scrollWidth: document.documentElement.scrollWidth, scrollY: Math.round(scrollY), rects: R, panelOverStage: ov(R.panel, R.stage), sheetOverPanel: ov(R.sheet, R.panel), sheetOverTray: ov(R.sheet, R.tray), trayOverLensbar: ov(R.tray, R.lensbar), clipped, trayChipsHidden: trayHidden, tray: trayFull.textContent.trim(), url: location.search, focusHead: (document.querySelector('#panel .u-h') || {}).textContent || null, hint: document.getElementById('hint').textContent, lens: (document.querySelector('#lensbar a.on') || {}).textContent };
  });
}

// ---------------------------------------------------------------- step 0: load
begin('00-load');
await page.goto(BASE + '?lens=ring', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent), { timeout: 60000 });
await page.evaluate(() => { try { localStorage.removeItem('star-generator.recipe'); } catch (e) {} });
await page.goto(BASE + '?lens=ring', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent), { timeout: 60000 });
await page.waitForFunction(() => document.getElementById('count').title && document.getElementById('count').title.length > 0, { timeout: 60000 }).catch(() => note('pack title never appeared'));
await sleep(1500);
step.facts = await layoutFacts(); note(`count: ${await page.evaluate(() => document.getElementById('count').textContent)}`); note(`tray says: "${step.facts.tray}"`);
await shot('00-load');

// ---------------------------------------------------------------- step 1: search "distance"
begin('01-search');
await tapEl('.u-search', null, 'tap the search box');
await page.keyboard.type('distance', { delay: 40 }); note('typed "distance" on the keyboard');
await sleep(700);
const hits = await page.evaluate(() => [...document.querySelectorAll('.u-hits > *')].map(e => ({ tag: e.tagName, text: e.textContent.trim(), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height), bottom: Math.round(e.getBoundingClientRect().bottom) })));
step.hits = hits; note(`${hits.length} hits: ${hits.map(h => h.text).join(' | ')}`);
note(`hit chip heights: ${[...new Set(hits.map(h => h.h))].join(',')} px; last hit bottom ${hits.length ? hits[hits.length - 1].bottom : '-'} px of 900`);
step.facts = await layoutFacts();
await shot('01-search');

// ---------------------------------------------------------------- step 2: open the family
begin('02-open-family');
const first = hits.find(h => h.tag === 'BUTTON');
await tapEl('.u-hits button', first ? first.text : null, 'tap the first hit');
await page.waitForFunction(() => { const p = document.getElementById('panel'); return p && !p.hidden && !/Loading family/.test(p.textContent); }, { timeout: 30000 }).catch(() => note('panel never finished loading'));
await sleep(600);
step.facts = await layoutFacts();
note(`panel head: "${step.facts.focusHead}" · url ${step.facts.url}`);
note(`panel rect ${JSON.stringify(step.facts.rects.panel)} · stage ${JSON.stringify(step.facts.rects.stage)} · panel covers ${step.facts.panelOverStage} px of the stage · scrollY ${step.facts.scrollY}`);
const linesBefore = await page.evaluate(() => { const B = document.getElementById('panel-body'); const pb = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; const sub = [...B.querySelectorAll('.u-sub')].map(s => s.textContent.trim()); return { n: ls.length, visible: ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pb.top && r.bottom <= pb.bottom; }).length, first3: ls.slice(0, 3).map(l => l.textContent.trim()), subs: sub, meta: (B.querySelector('.u-muted') || {}).textContent, bodyScrollH: B.scrollHeight, bodyClientH: B.clientHeight }; });
step.linesBefore = linesBefore; note(`family has ${linesBefore.n} numbered lines listed; ${linesBefore.visible} of them visible in the panel at peek height (body ${linesBefore.bodyClientH} of ${linesBefore.bodyScrollH} px); sections: ${linesBefore.subs.join(' / ')}`);
note(`first three as shown before Measure: ${linesBefore.first3.join(' || ')}`);
await shot('02-open-family');

// ---------------------------------------------------------------- step 3: read three numbered lines (Measure fetches the text)
begin('03-read-lines');
await tapEl('#panel-foot .u-chip', 'Measure', 'tap Measure to fetch the line text');
await page.waitForFunction(() => { const c = document.querySelector('#panel .u-code'); return c && !/Fetching/.test(c.textContent); }, { timeout: 40000 }).catch(() => note('line text never arrived'));
await sleep(500);
let lines = await page.evaluate(() => { const B = document.getElementById('panel-body'); const pb = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; const vis = ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pb.top && r.bottom <= pb.bottom; }); const code = B.querySelector('.u-code'); return { n: ls.length, visible: vis.length, first3: ls.slice(0, 3).map(l => l.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)), tall: document.getElementById('panel').classList.contains('tall'), panelH: Math.round(document.getElementById('panel').getBoundingClientRect().height), codeTop: code ? Math.round(code.getBoundingClientRect().top) : null, bodyBottom: Math.round(pb.bottom), codeScrollW: code ? code.scrollWidth : 0, codeClientW: code ? code.clientWidth : 0, bodyScrollTop: B.scrollTop, bodyScrollH: B.scrollHeight, bodyClientH: B.clientHeight }; });
note(`after Measure: panel tall=${lines.tall} (${lines.panelH} px); ${lines.visible} of ${lines.n} lines visible; code box top ${lines.codeTop}, panel body bottom ${lines.bodyBottom}; code box scrollWidth ${lines.codeScrollW} vs clientWidth ${lines.codeClientW}`);
if (lines.visible < 3) {
  // scroll the panel body by touch until the code box is in view
  const pb = await page.evaluate(() => { const b = document.getElementById('panel-body').getBoundingClientRect(); return { x: b.left + b.width / 2, top: b.top, bottom: b.bottom }; });
  for (let k = 0; k < 6 && lines.visible < 3; k++) {
    await drag(pb.x, pb.bottom - 30, pb.x, pb.top + 30, 10, 16); await sleep(400);
    lines = await page.evaluate(() => { const B = document.getElementById('panel-body'); const pbx = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; const vis = ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pbx.top && r.bottom <= pbx.bottom; }); return { n: ls.length, visible: vis.length, first3: ls.slice(0, 3).map(l => l.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)), bodyScrollTop: B.scrollTop, bodyScrollH: B.scrollHeight, bodyClientH: B.clientHeight, firstVisible: vis[0] ? vis[0].textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : null }; });
    note(`drag ${step.drags} up the panel: body scrollTop ${lines.bodyScrollTop} of ${lines.bodyScrollH - lines.bodyClientH}; ${lines.visible} lines visible`);
  }
}
step.lines = lines; note(`three numbered lines read: ${lines.first3.join(' || ')}`);
step.facts = await layoutFacts();
await shot('03-read-lines');

// ---------------------------------------------------------------- step 4: add the family to the recipe
begin('04-add-family');
const addBtn = await probe('#panel-foot .u-chip', 'Add to recipe');
note(`"Add to recipe" button rect: ${addBtn ? JSON.stringify({ top: addBtn.top, bottom: addBtn.bottom, w: addBtn.w, h: addBtn.h, reach: addBtn.reach, hit: addBtn.hitDesc }) : 'missing'}`);
await tapEl('#panel-foot .u-chip', 'Add to recipe', 'tap Add to recipe in the panel foot');
await sleep(500);
step.facts = await layoutFacts(); note(`tray now: "${step.facts.tray}" · url ${step.facts.url}`);
note(`tray chips clipped/hidden: ${step.facts.trayChipsHidden}; clipped texts: ${step.facts.clipped.join(' ; ') || 'none'}`);
await shot('04-add-family');

// ---------------------------------------------------------------- step 5: switch to the table lens
begin('05-table-lens');
const lb = await probe('#lensbar a', 'table');
note(`lens tab "table": ${lb ? `${lb.w}x${lb.h} at y ${lb.top}-${lb.bottom}, reach=${lb.reach} (${lb.hitDesc})` : 'missing'}`);
await tapEl('#lensbar a', 'table', 'tap the table tab');
await sleep(1200);
step.facts = await layoutFacts(); note(`lens=${step.facts.lens} · url ${step.facts.url} · tray "${step.facts.tray}" · panel head "${step.facts.focusHead}"`);
note(`hint: "${step.facts.hint}"`);
note(`panel still open covering ${step.facts.panelOverStage} px of the stage; stage ${JSON.stringify(step.facts.rects.stage)}, panel ${JSON.stringify(step.facts.rects.panel)}`);
const tblTop = await page.evaluate(() => { const ov = document.getElementById('overlay'); const st = document.getElementById('stage').getBoundingClientRect(); const tiles = [...ov.querySelectorAll('.tile')]; const pnl = document.getElementById('panel'); const pr = pnl.hidden ? null : pnl.getBoundingClientRect(); const vis = tiles.filter(t => { const r = t.getBoundingClientRect(); return r.top >= st.top && r.bottom <= st.bottom && (!pr || r.bottom <= pr.top); }); return { tiles: tiles.length, visibleUncovered: vis.length, overlayScrollH: ov.scrollHeight, overlayClientH: ov.clientHeight, firstTiles: vis.slice(0, 6).map(t => t.querySelector('b').textContent) }; });
step.table = tblTop; note(`${tblTop.tiles} tiles in the overlay (${tblTop.overlayScrollH} px tall, ${tblTop.overlayClientH} px window); ${tblTop.visibleUncovered} tiles visible and not under the panel: ${tblTop.firstTiles.join(', ')}`);
await shot('05-table-lens');

// ---------------------------------------------------------------- step 6: find and add block Vd
begin('06-add-Vd');
// close the panel first? A real person would try scrolling the tiles first. Try dragging the overlay where it is uncovered.
let vd = await page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => x.querySelector('b').textContent === 'Vd'); if (!t) return null; const r = t.getBoundingClientRect(); const st = document.getElementById('stage').getBoundingClientRect(); const pnl = document.getElementById('panel'); const pr = pnl.hidden ? null : pnl.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), inStage: r.top >= st.top && r.bottom <= st.bottom, underPanel: !!pr && r.bottom > pr.top && r.top < pr.bottom, folded: !!t.closest('details') && !t.closest('details').open, title: t.querySelector('.t').textContent, text: t.textContent.trim() }; });
note(`Vd tile before scrolling: ${JSON.stringify(vd)}`);
const stageR = await page.evaluate(() => { const b = document.getElementById('stage').getBoundingClientRect(); const pnl = document.getElementById('panel'); const pr = pnl.hidden ? null : pnl.getBoundingClientRect(); return { x: b.left + b.width / 2, top: b.top, bottom: pr ? Math.min(b.bottom, pr.top) : b.bottom }; });
let strayFocus = null; const headBefore = (await layoutFacts()).focusHead;
for (let k = 0; k < 14 && !(vd && vd.inStage && !vd.underPanel); k++) {
  await drag(stageR.x, stageR.bottom - 20, stageR.x, stageR.top + 20, 6, 20); await sleep(450);
  const f = await layoutFacts(); if (f.focusHead !== headBefore) { strayFocus = f.focusHead; note(`STRAY: dragging over the tiles changed the panel to "${f.focusHead}" (a drag was read as a tap or press)`); }
  vd = await page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => x.querySelector('b').textContent === 'Vd'); if (!t) return null; const r = t.getBoundingClientRect(); const st = document.getElementById('stage').getBoundingClientRect(); const pnl = document.getElementById('panel'); const pr = pnl.hidden ? null : pnl.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), inStage: r.top >= st.top && r.bottom <= st.bottom, underPanel: !!pr && r.bottom > pr.top && r.top < pr.bottom, scrollTop: document.getElementById('overlay').scrollTop }; });
  note(`drag ${step.drags} up the tiles: overlay scrollTop ${vd && vd.scrollTop}; Vd at y ${vd && vd.top}-${vd && vd.bottom} inStage=${vd && vd.inStage} underPanel=${vd && vd.underPanel}`);
}
step.vdBeforeTap = vd;
await shot('06a-Vd-in-view');
if (!vd || !vd.inStage || vd.underPanel) note('could not bring the Vd tile into an uncovered part of the stage by dragging');
// try the documented swipe-right on the tile first (compose without opening the panel)
const vdC = await page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => x.querySelector('b').textContent === 'Vd'); const r = t.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2, hit: (document.elementFromPoint(r.left + 20, r.top + r.height / 2) || {}).className || 'none' }; });
note(`swipe-right start point on Vd: (${Math.round(vdC.x)},${Math.round(vdC.y)}) hits "${vdC.hit}"`);
await drag(vdC.x, vdC.y, vdC.x + 90, vdC.y, 6, 20); await sleep(700);
let f6 = await layoutFacts(); const swipeWorked = /Vd/.test(f6.tray);
note(`after swipe-right 90 px on the tile: tray "${f6.tray}" → ${swipeWorked ? 'Vd added by swipe' : 'swipe did NOT add Vd'}; panel head now "${f6.focusHead}"; overlay scrollTop ${await page.evaluate(() => document.getElementById('overlay').scrollTop)}`);
step.swipe = { worked: swipeWorked, tray: f6.tray, head: f6.focusHead };
if (!swipeWorked) {
  // the other touch route: tap the tile → panel → Add to recipe
  vd = await page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => x.querySelector('b').textContent === 'Vd'); const r = t.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height), reach: !!h && (h === t || t.contains(h)), hit: h ? (h.id ? '#' + h.id : h.className) : 'none' }; });
  if (!vd.reach) note(`Vd tile centre (${Math.round(vd.x)},${Math.round(vd.y)}) is covered by ${vd.hit}`);
  await page.touchscreen.tap(vd.x, vd.y); step.taps++; note(`tap ${step.taps}: the Vd tile ${vd.w}x${vd.h} at (${Math.round(vd.x)},${Math.round(vd.y)})${vd.reach ? '' : ' [BLOCKED]'}`);
  await sleep(900);
  f6 = await layoutFacts(); note(`panel head now "${f6.focusHead}" · url ${f6.url}`);
  await shot('06b-Vd-panel');
  await tapEl('#panel-foot .u-chip', 'Add to recipe', 'tap Add to recipe for Vd');
  await sleep(500);
  f6 = await layoutFacts();
}
step.facts = f6; note(`tray now: "${f6.tray}" · recipe in url: ${decodeURIComponent((f6.url.match(/recipe=([^&]*)/) || [])[1] || '')}`);
note(`tray chips hidden/clipped: ${f6.trayChipsHidden}; clipped: ${f6.clipped.join(' ; ') || 'none'}`);
const tileMarks = await page.evaluate(() => [...document.querySelectorAll('.tile.recipe')].map(t => t.querySelector('b').textContent));
note(`tiles marked as in the recipe on the table: ${tileMarks.join(', ') || 'none'}`);
await shot('06-Vd-added');

// ---------------------------------------------------------------- step 7: switch to river; both still in the recipe?
begin('07-river-lens');
await tapEl('#lensbar a', 'river', 'tap the river tab');
await sleep(1500);
step.facts = await layoutFacts(); note(`lens=${step.facts.lens} · tray "${step.facts.tray}" · url ${step.facts.url}`);
note(`hint: "${step.facts.hint}"`);
const both = /distance|#\d+/.test(step.facts.tray) && /Vd/.test(step.facts.tray);
note(`both keys still in the recipe (tray text): ${both}`);
const trayChips = await page.evaluate(() => [...document.querySelectorAll('#tray .rc')].map(c => ({ text: c.textContent.replace('×', '').trim(), w: Math.round(c.getBoundingClientRect().width), right: Math.round(c.getBoundingClientRect().right), border: c.style.borderColor })));
step.trayChips = trayChips; note(`tray chips: ${JSON.stringify(trayChips)}`);
const lblRiver = await page.evaluate(() => [...document.querySelectorAll('#labels span')].filter(s => !s.hidden).map(s => s.textContent).slice(0, 30));
note(`river labels on screen (${lblRiver.length}): ${lblRiver.join(', ')}`);
await shot('07-river-lens');

// ---------------------------------------------------------------- step 8: open the recipe sheet (wording check across lenses)
begin('08-recipe-sheet');
await tapEl('#tray .cnt', null, 'tap the recipe count in the tray to open the sheet');
await sleep(600);
const sheet = await page.evaluate(() => { const S = document.getElementById('sheet'); if (S.hidden) return null; const b = S.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), scrollH: S.scrollHeight, clientH: S.clientHeight, head: (S.querySelector('.u-h') || {}).textContent, rows: [...S.querySelectorAll('.ch')].map(r => r.textContent.trim()), buttons: [...S.querySelectorAll('button, a.u-chip')].map(b => ({ t: b.textContent.trim(), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), top: Math.round(b.getBoundingClientRect().top) })), text: S.textContent.replace(/\s+/g, ' ').slice(0, 900), handoffText: (S.querySelector('span[style*="overflow-wrap"]') || {}).textContent }; });
step.sheet = sheet; note(sheet ? `sheet open ${sheet.top}-${sheet.bottom} (${sheet.h} px, content ${sheet.scrollH}); head "${sheet.head}"; rows: ${sheet.rows.join(' | ')}` : 'sheet did not open');
if (sheet) { note(`sheet buttons: ${sheet.buttons.map(b => `${b.t}(${b.w}x${b.h}@${b.top})`).join(', ')}`); note(`hand-off url shown: ${sheet.handoffText}`); }
step.facts = await layoutFacts(); note(`sheet overlaps panel ${step.facts.sheetOverPanel} px, tray ${step.facts.sheetOverTray} px`);
await shot('08-recipe-sheet');

// ---------------------------------------------------------------- step 9: hand off
begin('09-hand-off');
const nT = targets.length;
await tapEl('#sheet .row .u-chip', 'Hand off →', 'tap Hand off in the sheet');
await sleep(2500);
const opened = targets.slice(nT);
note(`new browser targets after the tap: ${opened.length} → ${opened.map(t => t.url).join(' ; ') || 'none'}`);
let handoffURL = opened.length ? opened[0].url : null;
if (!handoffURL) { note('no new tab observed; trying the tray Hand off button'); await tapEl('#tray .go', null, 'tap Hand off in the tray'); await sleep(2500); const o2 = targets.slice(nT); note(`targets now: ${o2.map(t => t.url).join(' ; ') || 'none'}`); handoffURL = o2.length ? o2[0].url : null; }
step.handoffURL = handoffURL;
if (handoffURL) {
  const pages = await browser.pages(); const hp = pages.find(p => p !== page && /code-generator/.test(p.url()));
  if (hp) { await hp.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true }).catch(() => {}); await hp.waitForNetworkIdle({ timeout: 30000 }).catch(() => {}); await sleep(1500); const pk = await hp.evaluate(() => ({ url: location.href, title: document.title, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500), scrollWidth: document.documentElement.scrollWidth, hasVd: document.body.innerText.includes('Vd'), hasFam: /famil/i.test(document.body.innerText) })); step.picker = pk; note(`picker page: title "${pk.title}" scrollWidth ${pk.scrollWidth}; mentions Vd=${pk.hasVd}, families=${pk.hasFam}; text: ${pk.text.slice(0, 300)}`); await hp.screenshot({ path: OUT + 'coder-09b-picker.png' }); }
}
await shot('09-hand-off');
report.totalTaps = taps; report.targets = targets;
await browser.close();
fs.writeFileSync(OUT + 'coder-walk.json', JSON.stringify(report, null, 1));
console.log('\nwritten', OUT + 'coder-walk.json', 'total taps', taps);
