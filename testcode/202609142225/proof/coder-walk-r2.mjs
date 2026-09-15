// Mobile-coder critic, round 2: a person on a 430 px phone composes a small tool by touch alone, after the repair round.
// Fresh browser, empty localStorage, every input through the touchscreen emulation (tap / touchStart-Move-End), never the mouse.
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/coder-walk-r2.mjs [port]
// Writes proof/coder-r2-<step>.png, proof/coder-walk-r2.json and prints the log.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8896', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'], protocolTimeout: 90000 });
const report = { run_utc: new Date().toISOString(), base: BASE, viewport: '430x900 dpr2 isMobile hasTouch', steps: [], console: [] };
const targets = []; browser.on('targetcreated', t => targets.push({ url: t.url(), type: t.type() }));
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => report.console.push('pageerror: ' + e.message));
page.on('requestfailed', r => report.console.push('requestfailed: ' + r.url()));
let taps = 0, drags = 0, step = null;
function begin(name) { step = { name, taps: 0, drags: 0, touchOnly: true, notes: [] }; report.steps.push(step); console.log('\n== ' + name); }
function note(s) { step.notes.push(s); console.log('  ' + s); }
function blocker(s) { step.touchOnly = false; step.blocker = s; note('BLOCKER: ' + s); }
async function shot(name) { await page.screenshot({ path: OUT + `coder-r2-${name}.png` }); step.shots = (step.shots || []).concat(`coder-r2-${name}.png`); }
async function probe(sel, text) {
  return page.evaluate((s, t) => { const es = [...document.querySelectorAll(s)]; const e = t ? es.find(x => x.textContent.trim() === t || x.textContent.trim().startsWith(t)) : es[0]; if (!e) return null; const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; const hit = document.elementFromPoint(cx, cy); const reach = !!hit && (hit === e || e.contains(hit) || hit.contains(e)); const hitDesc = hit ? (hit.id ? '#' + hit.id : hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ').join('.')) + ' "' + hit.textContent.trim().slice(0, 30) + '"' : 'nothing (off screen)'; return { x: cx, y: cy, w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom), inViewport: b.top >= -0.5 && b.bottom <= innerHeight + 0.5, reach, hitDesc, text: e.textContent.trim().slice(0, 60) }; }, sel, text || null);
}
async function tapEl(sel, text, why) {
  const p = await probe(sel, text); if (!p) { note(`NO ELEMENT ${sel} ${text || ''} (${why})`); return null; }
  if (!p.inViewport || !p.reach) note(`target "${p.text}" at y ${p.top}-${p.bottom}: ${p.inViewport ? '' : 'OFF SCREEN; '}${p.reach ? '' : 'covered by ' + p.hitDesc}`);
  await page.touchscreen.tap(p.x, p.y); step.taps++; taps++;
  note(`tap ${step.taps}: ${why} → "${p.text.slice(0, 40)}" ${p.w}x${p.h} at (${Math.round(p.x)},${Math.round(p.y)})${p.w < 44 || p.h < 44 ? ' [under 44 px]' : ''}${p.reach && p.inViewport ? '' : ' [NOT REACHABLE]'}`);
  return p;
}
async function drag(x0, y0, x1, y1, steps = 8, dt = 20) { await page.touchscreen.touchStart(x0, y0); for (let s = 1; s <= steps; s++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps); await sleep(dt); } await page.touchscreen.touchEnd(); step.drags++; drags++; }
const facts = () => page.evaluate(() => {
  const r = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  const P = document.getElementById('panel'), T = document.getElementById('tray'), chips = T.querySelector('.chips'), cnt = T.querySelector('.cnt');
  return { innerH: innerHeight, scrollY: Math.round(scrollY), docScrollW: document.documentElement.scrollWidth, stage: r('stage'), panel: r('panel'), panelTall: P.classList.contains('tall'), panelDisplay: getComputedStyle(P).display, sheet: r('sheet'),
    tray: T.textContent.trim(), trayChips: [...T.querySelectorAll('.rc')].map(c => c.textContent.replace('×', '').trim()), trayCnt: cnt ? cnt.textContent : null,
    trayClip: chips ? { chipsScrollW: chips.scrollWidth, chipsClientW: chips.clientWidth, cntScrollW: cnt.scrollWidth, cntClientW: cnt.clientWidth, cntTruncated: cnt.scrollWidth > cnt.clientWidth + 1 } : null,
    url: location.search, head: (document.querySelector('#panel .u-h') || {}).textContent || null, trail: document.getElementById('trail').textContent, lens: (document.querySelector('#lensbar a.on') || {}).textContent, overlayTop: document.getElementById('overlay').scrollTop, hint: document.getElementById('hint').textContent,
    labels: [...document.querySelectorAll('#labels span')].filter(s => !s.hidden && s.offsetParent !== null).map(s => s.textContent) };
});
const vdInfo = () => page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => x.querySelector('b').textContent === 'Vd'); if (!t) return null; const r = t.getBoundingClientRect(); const st = document.getElementById('stage').getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const h = document.elementFromPoint(cx, cy); return { x: cx, y: cy, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), inStage: r.top >= st.top && r.bottom <= st.bottom, inViewport: r.top >= 0 && r.bottom <= innerHeight, reach: !!h && (h === t || t.contains(h)), hit: h ? (h.id ? '#' + h.id : h.tagName + '.' + h.className) : 'none', scrollTop: document.getElementById('overlay').scrollTop, stage: [Math.round(st.top), Math.round(st.bottom)] }; });
// what a finger meets straight down the stage: o = table overlay/tiles, P = panel, ? = other
const fingerMap = () => page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const ys = []; for (let y = Math.ceil(st.top) + 5; y < st.bottom - 5; y += 10) { const e = document.elementFromPoint(215, y); ys.push(e && e.closest('#panel') ? 'P' : e && e.closest('#overlay') ? 'o' : e && e.closest('#sheet') ? 'S' : e && e.closest('#gl') ? 'g' : '?'); } return { stage: [Math.round(st.top), Math.round(st.bottom)], map: ys.join('') }; });
const clip = []; // clipboard captures

// ---------------- 00 load
begin('00-load');
await page.goto(BASE + '?lens=ring', { waitUntil: 'networkidle0', timeout: 90000 });
await page.evaluate(() => { try { localStorage.removeItem('star-generator.recipe'); } catch (e) {} });
await page.goto(BASE + '?lens=ring', { waitUntil: 'networkidle0', timeout: 90000 });
await page.evaluateOnNewDocument(() => {});
await page.evaluate(() => { window.__clip = []; if (navigator.clipboard) navigator.clipboard.writeText = t => { window.__clip.push(t); return Promise.resolve(); }; });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 }); await sleep(1200);
let f = await facts();
note(`count sentence: "${await page.evaluate(() => document.getElementById('count').textContent)}"`);
note(`count title: "${await page.evaluate(() => document.getElementById('count').title)}"`);
note(`panel at load: ${f.panel ? 'OPEN ' + JSON.stringify(f.panel) : 'closed'} (display ${f.panelDisplay}); stage ${JSON.stringify(f.stage)}; document scrollWidth ${f.docScrollW} (viewport 430); tray "${f.tray}"`);
const fm0 = await fingerMap(); note(`finger map down the stage y ${fm0.stage[0]}→${fm0.stage[1]} every 10 px (g = canvas, P = panel): ${fm0.map}`);
await shot('00-load');

// ---------------- 01 search
begin('01-search');
await tapEl('.u-search', null, 'tap the search box'); await page.keyboard.type('distance', { delay: 30 }); note('typed "distance" (the phone keyboard; typing is not a tap)'); await sleep(700);
const hits = await page.evaluate(() => [...document.querySelectorAll('.u-hits button')].map(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { t: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), reach: e === b || b.contains(e), hit: e ? (e.id ? '#' + e.id : e.tagName + '.' + e.className) : 'none' }; }));
note(`${hits.length} hit chips, ${Math.min(...hits.map(h => h.h))}-${Math.max(...hits.map(h => h.h))} px tall, first at y ${hits[0].top}, last ends at y ${hits[hits.length - 1].bottom} (viewport 900): ${hits.map(h => h.t).join(' | ')}`);
const unreach = hits.filter(h => !h.reach); note(`hit chips a finger cannot reach: ${unreach.length ? unreach.map(h => `${h.t}@y${h.top}→${h.hit}`).join(', ') : 'none'}`);
f = await facts(); note(`stage pushed to y ${f.stage.top}-${f.stage.bottom} by the hits; tray "${f.tray}"`);
await shot('01-search');

// ---------------- 02 open family
begin('02-open-family');
await tapEl('.u-hits button', '#511 distanceKm', 'tap the first hit');
await page.waitForFunction(() => !document.getElementById('panel').hidden && !/Loading family/.test(document.getElementById('panel').textContent), { timeout: 30000 }); await sleep(700);
f = await facts(); note(`panel head "${f.head}", panel ${JSON.stringify(f.panel)} tall=${f.panelTall}; page scrolled to ${f.scrollY}; stage ${JSON.stringify(f.stage)}; url ${f.url}`);
note(`trail "${f.trail}"; hint "${f.hint}"; labels on the ring: ${f.labels.join(', ')}`);
const lb = await page.evaluate(() => { const B = document.getElementById('panel-body'); const pb = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; const subs = [...B.querySelectorAll('.u-sub')].map(s => s.textContent.trim().slice(0, 40)); return { n: ls.length, vis: ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pb.top && r.bottom <= pb.bottom; }).length, keys: ls.map(l => l.querySelector('.u-key').textContent), first3: ls.slice(0, 3).map(l => l.textContent.replace(/\s+/g, ' ').trim()), bodyH: B.clientHeight, bodyScrollH: B.scrollHeight, linesTop: ls[0] ? Math.round(ls[0].getBoundingClientRect().top - pb.top) : null, subs, bodyText: B.textContent.replace(/\s+/g, ' ').slice(0, 260) }; });
note(`${lb.n} numbered lines (keys ${lb.keys.join(', ')}); ${lb.vis} visible at peek height (body ${lb.bodyH} of ${lb.bodyScrollH} px; lines start ${lb.linesTop} px down); sections in order: ${lb.subs.join(' → ')}`);
note(`lines shown as: ${lb.first3.join(' || ')}`);
note(`panel top text: "${lb.bodyText}"`);
const foot = await page.evaluate(() => [...document.querySelectorAll('#panel-foot > *')].map(b => { const r = b.getBoundingClientRect(); return `${b.textContent.trim().slice(0, 14)} ${Math.round(r.width)}x${Math.round(r.height)}@y${Math.round(r.top)}`; }));
note(`panel foot buttons: ${foot.join(' | ')}`);
await shot('02-open-family');

// ---------------- 03 read three lines
begin('03-read-lines');
await tapEl('#panel-foot .u-chip', 'Measure', 'tap Measure to fetch the text');
await page.waitForFunction(() => { const c = document.querySelector('#panel .u-code'); return c && !/Fetching/.test(c.textContent); }, { timeout: 40000 }); await sleep(500);
const lineState = () => page.evaluate(() => { const B = document.getElementById('panel-body'); const pb = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; const c = B.querySelector('.u-code'); return { vis: ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pb.top && r.bottom <= pb.bottom; }).length, n: ls.length, codeTop: Math.round(c.getBoundingClientRect().top), bodyTop: Math.round(pb.top), bodyBottom: Math.round(pb.bottom), tall: document.getElementById('panel').classList.contains('tall'), codeScrollW: c.scrollWidth, codeClientW: c.clientWidth, st: B.scrollTop, first3: ls.slice(0, 3).map(l => l.textContent.replace(/\s+/g, ' ').trim()), keyTitles: ls.slice(0, 3).map(l => l.querySelector('.u-key').title || '(no title)'), wrapped: ls.filter(l => l.getBoundingClientRect().height > 24).length }; });
let ln = await lineState();
note(`after Measure: panel tall=${ln.tall}; code box top y ${ln.codeTop}, panel body y ${ln.bodyTop}-${ln.bodyBottom} → ${ln.vis} of ${ln.n} lines visible without scrolling; sideways scroll needed: ${ln.codeScrollW > ln.codeClientW} (${ln.codeScrollW} vs ${ln.codeClientW}); lines wrapped onto 2+ rows: ${ln.wrapped}`);
for (let k = 0; k < 4 && ln.vis < 3; k++) { const pb = await page.evaluate(() => { const b = document.getElementById('panel-body').getBoundingClientRect(); return { x: b.left + b.width / 2, top: b.top, bottom: b.bottom }; }); await drag(pb.x, pb.bottom - 30, pb.x, pb.top + 30, 10, 16); await sleep(400); ln = await lineState(); note(`drag ${step.drags} up the panel body: scrollTop ${ln.st}; ${ln.vis} lines visible`); }
note(`read: ${ln.first3.join(' || ')}`);
note(`what the line keys say on long-press/title: ${ln.keyTitles.join(' | ')}`);
f = await facts(); note(`stage now ${JSON.stringify(f.stage)} under a panel ${JSON.stringify(f.panel)} → picture visible above the sheet: ${f.stage && f.panel ? Math.max(0, f.panel.top - f.stage.top) : '?'} px`);
await shot('03-read-lines');

// ---------------- 04 add family
begin('04-add-family');
let p = await probe('#panel-foot .u-chip', 'Add to recipe');
if (p && !p.inViewport) note(`Add to recipe sits at y ${p.top}-${p.bottom}: off the 900-px screen while the panel is tall`);
await tapEl('#panel-foot .u-chip', 'Add to recipe', 'tap Add to recipe'); await sleep(600);
f = await facts(); note(`tray "${f.tray}" · chips ${JSON.stringify(f.trayChips)} · count "${f.trayCnt}" truncated=${f.trayClip && f.trayClip.cntTruncated} (${f.trayClip && f.trayClip.cntScrollW} in ${f.trayClip && f.trayClip.cntClientW}) · url recipe=${decodeURIComponent((f.url.match(/recipe=([^&]*)/) || [])[1] || '')}`);
note(`panel after adding: ${f.panel ? 'still open "' + f.head + '" tall=' + f.panelTall : 'closed'}; ring labels: ${f.labels.join(', ')}`);
await shot('04-add-family');

// ---------------- 05 table lens
begin('05-table-lens');
p = await tapEl('#lensbar a', 'table', 'tap the table tab'); await sleep(1300);
f = await facts(); note(`lens "${f.lens}"; tray "${f.tray}"; panel ${f.panel ? 'STILL OPEN tall=' + f.panelTall + ' ' + JSON.stringify(f.panel) : 'closed'}; stage ${JSON.stringify(f.stage)}; page scrollY ${f.scrollY}; url ${f.url}`);
note(`hint "${f.hint}"; trail "${f.trail}"`);
const tv = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel'); const pt = P.hidden ? Infinity : P.getBoundingClientRect().top; const ts = [...document.querySelectorAll('.tile')]; const vis = ts.filter(t => { const r = t.getBoundingClientRect(); return r.top >= st.top && r.bottom <= Math.min(st.bottom, pt); }); return { total: ts.length, vis: vis.length, first: vis.slice(0, 6).map(t => t.querySelector('b').textContent), outlined: ts.filter(t => t.classList.contains('recipe')).map(t => t.querySelector('b').textContent + (t.classList.contains('derived') ? '(derived)' : '')), focusTile: (ts.find(t => t.classList.contains('focus')) || { querySelector: () => null }).querySelector('b')?.textContent || null, overlayScrollTop: document.getElementById('overlay').scrollTop, overlayScrollH: document.getElementById('overlay').scrollHeight, stageInView: st.top >= 0 && st.bottom <= innerHeight }; });
note(`tiles: ${tv.total} total, ${tv.vis} visible in the stage now (${tv.first.join(', ')}…); outlined as recipe: ${tv.outlined.join(', ') || 'none'}; focus tile: ${tv.focusTile}; overlay scrollTop ${tv.overlayScrollTop} of ${tv.overlayScrollH}; stage fully in viewport: ${tv.stageInView}`);
const fm5 = await fingerMap(); note(`finger map down the stage y ${fm5.stage[0]}→${fm5.stage[1]}: ${fm5.map}`);
await shot('05-table-lens');

// ---------------- 06 find Vd by swiping the grid, then swipe-right on it
begin('06-find-Vd');
let vd = await vdInfo(); note(`Vd tile at y ${vd.top}-${vd.bottom} (overlay scrollTop ${vd.scrollTop}); stage y ${vd.stage[0]}-${vd.stage[1]}; in stage: ${vd.inStage}`);
if (!vd.inStage && (vd.stage[0] < 0 || vd.stage[1] > 900)) { note('stage not fully on screen: first scroll the page (swipe up on the page body)'); }
const head0 = (await facts()).head;
for (let k = 0; k < 14 && !(vd.inStage && vd.reach && vd.inViewport); k++) {
  const st = vd.stage; const y1 = Math.min(st[1], 900) - 30, y0 = Math.max(st[0], 0) + 30;
  await drag(215, y1, 215, y0, 8, 18); await sleep(500);
  vd = await vdInfo(); const ff = await facts();
  note(`swipe ${step.drags} up the grid (y ${y1}→${y0}): overlay scrollTop ${vd.scrollTop}; Vd y ${vd.top}-${vd.bottom} inStage=${vd.inStage} reachable=${vd.reach} (${vd.hit})${ff.head !== head0 ? ' · STRAY: panel changed to "' + ff.head + '"' : ''}${ff.panel ? ' · panel open' : ''}${ff.trayChips.length !== 1 ? ' · STRAY: recipe changed ' + JSON.stringify(ff.trayChips) : ''}`);
}
if (vd.inStage && vd.reach && vd.bottom > 860) { await drag(215, 700, 215, 500, 6, 18); await sleep(400); vd = await vdInfo(); note(`nudge ${step.drags}: Vd y ${vd.top}-${vd.bottom} reachable=${vd.reach}`); }
note(`swipes to bring Vd into reach: ${step.drags}`);
await shot('06a-Vd-in-view');

begin('06-swipe-Vd');
const x0 = vd.left + 18; await drag(x0, vd.y, x0 + 90, vd.y, 6, 20); await sleep(800);
f = await facts(); const swiped = f.trayChips.includes('Vd');
note(`swipe-right 90 px across Vd (drag ${step.drags}): tray "${f.tray}" → ${swiped ? 'ADDED by swipe' : 'NOT added by swipe'}; panel ${f.panel ? 'opened "' + f.head + '"' : 'closed'}; overlay scrollTop ${f.overlayTop}; url ${f.url}`);
note(`was there any hint on screen that swipe-right composes? hint text: "${f.hint}"`);
await shot('06b-after-swipe');
if (!swiped) {
  begin('06-tap-Vd');
  vd = await vdInfo(); await page.touchscreen.tap(vd.x, vd.y); step.taps++; taps++; note(`tap ${step.taps}: Vd tile ${vd.w}x${vd.h} at (${Math.round(vd.x)},${Math.round(vd.y)})`); await sleep(1000);
  f = await facts(); note(`panel "${f.head}" ${JSON.stringify(f.panel)} tall=${f.panelTall}; url ${f.url}; page scrollY ${f.scrollY}`);
  const vd2 = await vdInfo(); note(`Vd tile now at y ${vd2.top}-${vd2.bottom}, ${vd2.reach ? 'still visible' : 'under the panel'}`);
  await shot('06c-Vd-panel');
  await tapEl('#panel-foot .u-chip', 'Add to recipe', 'tap Add to recipe for Vd'); await sleep(600); f = await facts();
}
const marks = await page.evaluate(() => ({ recipeTiles: [...document.querySelectorAll('.tile.recipe')].map(t => t.querySelector('b').textContent + (t.classList.contains('derived') ? '(derived)' : '')), chips: [...document.querySelectorAll('#tray .rc')].map(c => ({ t: c.textContent.replace('×', '').trim(), w: Math.round(c.getBoundingClientRect().width), right: Math.round(c.getBoundingClientRect().right), border: c.style.borderColor })), cnt: (document.querySelector('#tray .cnt') || {}).textContent, cntBox: (() => { const c = document.querySelector('#tray .cnt'); if (!c) return null; const r = c.getBoundingClientRect(); return { left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), scrollW: c.scrollWidth, clientW: c.clientWidth }; })(), goBox: (() => { const c = document.querySelector('#tray .go'); if (!c) return null; const r = c.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; })() }));
note(`tray "${f.tray}" · recipe=${decodeURIComponent((f.url.match(/recipe=([^&]*)/) || [])[1] || '')}`);
note(`tiles outlined as recipe: ${marks.recipeTiles.join(', ') || 'none'} · chips ${JSON.stringify(marks.chips)} · count "${marks.cnt}" box ${JSON.stringify(marks.cntBox)} → truncated: ${marks.cntBox && marks.cntBox.scrollW > marks.cntBox.clientW + 1} · Hand off ${JSON.stringify(marks.goBox)}`);
step.tableWords = { tray: f.tray, cnt: marks.cnt, chips: marks.chips.map(c => c.t), hint: f.hint, head: f.head, outlined: marks.recipeTiles };
await shot('06d-Vd-added');

// ---------------- 07 river
begin('07-river');
await tapEl('#lensbar a', 'river', 'tap the river tab'); await sleep(1600);
f = await facts();
note(`lens "${f.lens}"; tray chips ${JSON.stringify(f.trayChips)} → both still there: ${f.trayChips.some(c => /#511/.test(c)) && f.trayChips.includes('Vd')}; count "${f.trayCnt}"; url ${f.url}`);
note(`panel ${f.panel ? 'open "' + f.head + '" tall=' + f.panelTall : 'closed'}; hint "${f.hint}"; trail "${f.trail}"`);
note(`river labels on screen: ${f.labels.join(', ')} → Vd labelled: ${f.labels.includes('Vd')}, #511 labelled: ${f.labels.includes('#511')}, Ss labelled: ${f.labels.includes('Ss')}`);
const t6 = report.steps.find(s => s.tableWords).tableWords;
note(`wording table vs river — tray: ${t6.tray === f.tray ? 'same' : 'DIFFERENT ("' + t6.tray + '" vs "' + f.tray + '")'}; count: ${t6.cnt === f.trayCnt ? 'same' : 'DIFFERENT'}; chips: ${JSON.stringify(t6.chips) === JSON.stringify(f.trayChips) ? 'same' : 'DIFFERENT'}`);
const fm7 = await fingerMap(); note(`finger map down the stage y ${fm7.stage[0]}→${fm7.stage[1]}: ${fm7.map}`);
await shot('07-river');

// ---------------- 08 recipe sheet
begin('08-sheet');
p = await probe('#tray .cnt'); const trayBox = await page.evaluate(() => { const r = document.getElementById('tray').getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; });
note(`the count text is ${p.w}x${p.h} px but sits in a ${trayBox.h}-px tray that opens the sheet wherever it is tapped (except on a chip or Hand off)`);
await tapEl('#tray .cnt', null, 'tap the count in the tray'); await sleep(700);
let sh = await page.evaluate(() => { const S = document.getElementById('sheet'); const b = S.getBoundingClientRect(); return { hidden: S.hidden, top: Math.round(b.top), bottom: Math.round(b.bottom), scrollH: S.scrollHeight, clientH: S.clientHeight, head: (S.querySelector('.u-h') || {}).textContent, rows: [...S.querySelectorAll('.ch')].map(r => ({ text: r.textContent.trim(), parts: [...r.children].map(c => `${c.textContent.trim().slice(0, 18)}(${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)})`), h: Math.round(r.getBoundingClientRect().height) })), buttons: [...S.querySelectorAll('.row.act .u-chip')].map(c => { const r = c.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return `${c.textContent.trim()}@y${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}${e === c || c.contains(e) ? '' : ' COVERED by ' + (e ? e.tagName + '.' + e.className : 'nothing')}`; }), handoff: (S.querySelector('span[style*="overflow-wrap"]') || {}).textContent, needs: (S.querySelector('.u-need') || {}).textContent, pinned: [...S.querySelectorAll('.pin div')].map(d => d.textContent), rule: (S.querySelectorAll('.u-muted')[0] || {}).textContent, sheetScrollW: S.scrollWidth, sheetClientW: S.clientWidth, closeBtn: (() => { const c = [...S.querySelectorAll('button')].find(b => /close/.test(b.textContent)); if (!c) return null; const r = c.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}@(${Math.round(r.left)},${Math.round(r.top)})`; })() }; });
note(`sheet ${sh.hidden ? 'DID NOT OPEN' : 'open'} y ${sh.top}-${sh.bottom}, content ${sh.scrollH} in ${sh.clientH}, sideways ${sh.sheetScrollW} in ${sh.sheetClientW}; head "${sh.head}"; ✕ close ${sh.closeBtn}`);
for (const r of sh.rows) note(`row "${r.text}" (${r.h} px): ${r.parts.join(' ')}`);
note(`action buttons ${sh.buttons.join(', ')}`); note(`rule text: "${(sh.rule || '').slice(0, 200)}"`); note(`needs: ${(sh.needs || '').slice(0, 160)}`); note(`pinned files (${sh.pinned.length}): ${sh.pinned.slice(0, 3).join(' ; ')}${sh.pinned.length > 3 ? ' …' : ''}`); note(`hand-off url: ${sh.handoff}`);
f = await facts(); note(`wording sheet vs tray — sheet head count "${sh.head}" vs tray count "${f.trayCnt}"; rows say "${sh.rows.map(r => r.parts[0]).join('", "')}" vs chips ${JSON.stringify(f.trayChips)}`);
step.sheetOverPanel = f.panel ? `sheet y ${sh.top}-${sh.bottom} over an open panel y ${f.panel.top}-${f.panel.bottom}` : 'no panel open';
note(step.sheetOverPanel);
await shot('08-sheet');

// ---------------- 09 hand off
begin('09-handoff');
const nT = targets.length;
await tapEl('#sheet .row.act .u-chip', 'Hand off', 'tap Hand off in the sheet'); await sleep(2500);
let opened = targets.slice(nT); note(`new tab: ${opened.map(t => t.url).join(' ; ') || 'none'}`);
step.handoffURL = opened.length ? opened[0].url : null;
const hp = (await browser.pages()).find(pg => pg !== page && /code-generator/.test(pg.url()));
if (hp) { await hp.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true }).catch(() => {}); await hp.waitForNetworkIdle({ timeout: 30000 }).catch(() => {}); await sleep(1500); const pk = await hp.evaluate(() => { const T = document.body.innerText; const m = s => (T.match(new RegExp('.{0,60}' + s + '.{0,60}')) || [''])[0].replace(/\s+/g, ' '); return { title: document.title, scrollWidth: document.documentElement.scrollWidth, Vd: m('\\bVd\\b'), Ss: m('\\bSs\\b'), fam: m('511'), star: m('star-generator'), checked: [...document.querySelectorAll('input:checked')].map(i => i.value || i.id || i.name).slice(0, 10), text: T.replace(/\s+/g, ' ').slice(0, 400) }; }); step.picker = pk; note(`picker "${pk.title}" scrollWidth ${pk.scrollWidth}; Vd: "${pk.Vd}"; Ss: "${pk.Ss}"; 511: "${pk.fam || '(no mention of #511)'}"; from=star-generator acknowledged: "${pk.star || '(no)'}"; checked inputs: ${JSON.stringify(pk.checked)}`); await hp.screenshot({ path: OUT + 'coder-r2-09b-picker.png' }); step.shots = (step.shots || []).concat('coder-r2-09b-picker.png'); await hp.close(); }
else note('the picker tab could not be read (no page found)');
// also: Copy recipe by touch
await tapEl('#sheet .row.act .u-chip', 'Copy recipe', 'tap Copy recipe'); await sleep(2500);
const cj = await page.evaluate(() => window.__clip || []);
if (cj.length) { try { const j = JSON.parse(cj[cj.length - 1]); note(`Copy recipe → ${cj[cj.length - 1].length} chars of JSON, schema ${j.schema}, keys ${JSON.stringify(j.keys)}, blocks ${j.blocks.map(b => b.symbol).join(',')}, families ${j.families.map(x => x.n + (x.place ? ' @ ' + String(x.place.commit).slice(0, 7) : ' (no place)')).join(',')}`); step.recipeJSON = j; } catch (e) { note('Copy recipe → clipboard text is not JSON: ' + cj[cj.length - 1].slice(0, 80)); } }
else note('Copy recipe → nothing reached the clipboard hook');
note(`button reads now: "${await page.evaluate(() => [...document.querySelectorAll('#sheet .row.act .u-chip')].map(b => b.textContent.trim()).join(' | '))}"`);
await shot('09-handoff');

// ---------------- 10 the other way: could a person have added Vd from search instead?
begin('10-alt-search-Vd');
await page.evaluate(() => document.getElementById('sheet').hidden = true);
f = await facts(); const sb = await probe('.u-search');
note(`after the journey the search box is at y ${sb.top}-${sb.bottom} (page scrollY ${f.scrollY}) → ${sb.inViewport ? 'reachable' : 'off screen: the person must scroll the page up first'}`);
if (!sb.inViewport) { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); note('(scrolled the page to the top with a swipe; not counted as a tap)'); }
await tapEl('.u-search', null, 'tap the search box'); await page.keyboard.type('Vd', { delay: 30 }); await sleep(600);
const vh = await page.evaluate(() => [...document.querySelectorAll('.u-hits button')].map(b => b.textContent.trim()));
note(`hits for "Vd": ${vh.join(' | ')}`);
await shot('10-search-Vd');

report.totalTaps = taps; report.totalDrags = drags;
report.stepSummary = report.steps.map(s => ({ name: s.name, taps: s.taps, drags: s.drags, touchOnly: s.touchOnly, blocker: s.blocker || null }));
await browser.close();
fs.writeFileSync(OUT + 'coder-walk-r2.json', JSON.stringify(report, null, 1));
console.log('\nwritten coder-walk-r2.json · taps', taps, '· drags', drags, '· console', report.console.length ? report.console : 'clean');
