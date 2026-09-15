// Mobile-coder critic, round 1, pass 3: the full journey by touch, now knowing that a closed panel still sits at
// y 436-796 (see coder-diag-overlay.json). Swipes over the tiles start above that band, as a person would learn to do.
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/coder-walk3.mjs [port]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8890', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
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
function begin(name) { step = { name, taps: 0, drags: 0, notes: [] }; report.steps.push(step); console.log('\n== ' + name); }
function note(s) { step.notes.push(s); console.log('  ' + s); }
async function shot(name) { await page.screenshot({ path: OUT + `coder-${name}.png` }); step.shots = (step.shots || []).concat(`coder-${name}.png`); }
async function probe(sel, text) {
  return page.evaluate((s, t) => { const es = [...document.querySelectorAll(s)]; const e = t ? es.find(x => x.textContent.trim() === t || x.textContent.trim().startsWith(t)) : es[0]; if (!e) return null; const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; const hit = document.elementFromPoint(cx, cy); const reach = !!hit && (hit === e || e.contains(hit) || hit.contains(e)); const hitDesc = hit ? (hit.id ? '#' + hit.id : hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ').join('.')) + ' "' + hit.textContent.trim().slice(0, 30) + '"' : 'nothing (off screen)'; return { x: cx, y: cy, w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom), inViewport: b.top >= 0 && b.bottom <= innerHeight, reach, hitDesc, text: e.textContent.trim().slice(0, 60) }; }, sel, text || null);
}
async function tapEl(sel, text, why) {
  const p = await probe(sel, text); if (!p) { note(`NO ELEMENT ${sel} ${text || ''} (${why})`); return null; }
  if (!p.inViewport || !p.reach) note(`target "${p.text}" at y ${p.top}-${p.bottom}: ${p.inViewport ? '' : 'OFF SCREEN; '}${p.reach ? '' : 'covered by ' + p.hitDesc}`);
  await page.touchscreen.tap(p.x, p.y); step.taps++; taps++;
  note(`tap ${step.taps}: ${why} → "${p.text.slice(0, 40)}" ${p.w}x${p.h} at (${Math.round(p.x)},${Math.round(p.y)})${p.w < 44 || p.h < 44 ? ' [under 44 px]' : ''}${p.reach && p.inViewport ? '' : ' [NOT REACHABLE]'}`);
  return p;
}
async function drag(x0, y0, x1, y1, steps = 8, dt = 20) { await page.touchscreen.touchStart(x0, y0); for (let s = 1; s <= steps; s++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps); await sleep(dt); } await page.touchscreen.touchEnd(); step.drags++; drags++; }
const facts = () => page.evaluate(() => { const r = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; }; const P = document.getElementById('panel'); const pb = P.getBoundingClientRect(); return { innerH: innerHeight, scrollY: Math.round(scrollY), stage: r('stage'), panel: r('panel'), panelTall: P.classList.contains('tall'), panelHiddenAttr: P.hidden, panelDisplay: getComputedStyle(P).display, panelBox: [Math.round(pb.top), Math.round(pb.bottom)], sheet: r('sheet'), tray: document.getElementById('tray').textContent.trim(), url: location.search, head: (document.querySelector('#panel .u-h') || {}).textContent || null, trail: document.getElementById('trail').textContent, lens: (document.querySelector('#lensbar a.on') || {}).textContent, overlayTop: document.getElementById('overlay').scrollTop, hint: document.getElementById('hint').textContent }; });
const vdInfo = () => page.evaluate(() => { const t = [...document.querySelectorAll('.tile')].find(x => x.querySelector('b').textContent === 'Vd'); if (!t) return null; const r = t.getBoundingClientRect(); const st = document.getElementById('stage').getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const h = document.elementFromPoint(cx, cy); return { x: cx, y: cy, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), inStage: r.top >= st.top && r.bottom <= st.bottom, reach: !!h && (h === t || t.contains(h)), hit: h ? (h.id ? '#' + h.id : h.tagName + '.' + h.className) : 'none', scrollTop: document.getElementById('overlay').scrollTop }; });

// ---------------- 00 load + the ghost-panel probe
begin('00-load');
await page.goto(BASE + '?lens=ring', { waitUntil: 'networkidle0', timeout: 90000 });
await page.evaluate(() => { try { localStorage.removeItem('star-generator.recipe'); } catch (e) {} });
await page.goto(BASE + '?lens=ring', { waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 }); await sleep(1200);
let f = await facts();
note(`panel at load: hidden attr=${f.panelHiddenAttr}, computed display=${f.panelDisplay}, box y ${f.panelBox.join('-')}; stage ${JSON.stringify(f.stage)}`);
const ghost = await page.evaluate(() => [300, 450, 500, 600, 700, 780].map(y => { const e = document.elementFromPoint(215, y); return `${y}:${e ? (e.id ? '#' + e.id : e.tagName + '.' + e.className) : 'none'}`; }));
note(`what a finger meets at x=215, y=…: ${ghost.join('  ')}`);
await shot('00-load');

// ---------------- 01 search
begin('01-search');
await tapEl('.u-search', null, 'tap the search box'); await page.keyboard.type('distance', { delay: 30 }); note('typed "distance"'); await sleep(600);
const hits = await page.evaluate(() => [...document.querySelectorAll('.u-hits button')].map(b => ({ t: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height), bottom: Math.round(b.getBoundingClientRect().bottom) })));
note(`${hits.length} hit chips, ${hits[0].h} px tall, last one ends at y ${hits[hits.length - 1].bottom}: ${hits.map(h => h.t).join(' | ')}`);
const ghost2 = await page.evaluate(() => [...document.querySelectorAll('.u-hits button')].map(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return (e === b || b.contains(e)) ? null : `${b.textContent.trim()}@${Math.round(r.top)}→${e ? (e.id ? '#' + e.id : e.tagName + '.' + e.className) : 'none'}`; }).filter(Boolean));
note(`hit chips a finger cannot reach: ${ghost2.length ? ghost2.join(', ') : 'none'}`);
await shot('01-search');

// ---------------- 02 open family
begin('02-open-family');
await tapEl('.u-hits button', '#511 distanceKm', 'tap the first hit');
await page.waitForFunction(() => !document.getElementById('panel').hidden && !/Loading family/.test(document.getElementById('panel').textContent), { timeout: 30000 }); await sleep(600);
f = await facts(); note(`panel head "${f.head}", panel ${JSON.stringify(f.panel)} tall=${f.panelTall}; page scrolled to ${f.scrollY}; stage ${JSON.stringify(f.stage)}; url ${f.url}`);
const lb = await page.evaluate(() => { const B = document.getElementById('panel-body'); const pb = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; return { n: ls.length, vis: ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pb.top && r.bottom <= pb.bottom; }).length, keys: ls.map(l => l.querySelector('.u-key').textContent), first3: ls.slice(0, 3).map(l => l.textContent.trim()), bodyH: B.clientHeight, bodyScrollH: B.scrollHeight, linesTop: ls[0] ? Math.round(ls[0].getBoundingClientRect().top - pb.top) : null }; });
note(`${lb.n} numbered lines (keys ${lb.keys.join(', ')}); ${lb.vis} visible at peek height (body ${lb.bodyH} of ${lb.bodyScrollH} px; lines start ${lb.linesTop} px down); shown as: ${lb.first3.join(' || ')}`);
await shot('02-open-family');

// ---------------- 03 read three lines
begin('03-read-lines');
await tapEl('#panel-foot .u-chip', 'Measure', 'tap Measure to fetch the text');
await page.waitForFunction(() => { const c = document.querySelector('#panel .u-code'); return c && !/Fetching/.test(c.textContent); }, { timeout: 40000 }); await sleep(400);
let ln = await page.evaluate(() => { const B = document.getElementById('panel-body'); const pb = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; const c = B.querySelector('.u-code'); return { vis: ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pb.top && r.bottom <= pb.bottom; }).length, codeTop: Math.round(c.getBoundingClientRect().top), bodyBottom: Math.round(pb.bottom), tall: document.getElementById('panel').classList.contains('tall'), codeScrollW: c.scrollWidth, codeClientW: c.clientWidth, first3: ls.slice(0, 3).map(l => l.textContent.replace(/\s+/g, ' ').trim()) }; });
note(`after Measure: panel tall=${ln.tall}; code box top y ${ln.codeTop} vs panel body bottom ${ln.bodyBottom} → ${ln.vis} lines visible; code box needs sideways scroll: ${ln.codeScrollW} > ${ln.codeClientW}`);
for (let k = 0; k < 4 && ln.vis < 3; k++) { const pb = await page.evaluate(() => { const b = document.getElementById('panel-body').getBoundingClientRect(); return { x: b.left + b.width / 2, top: b.top, bottom: b.bottom }; }); await drag(pb.x, pb.bottom - 30, pb.x, pb.top + 30, 10, 16); await sleep(400); ln = await page.evaluate(() => { const B = document.getElementById('panel-body'); const pb = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; return { vis: ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pb.top && r.bottom <= pb.bottom; }).length, st: B.scrollTop, first3: ls.slice(0, 3).map(l => l.textContent.replace(/\s+/g, ' ').trim()) }; }); note(`drag ${step.drags} up the panel body: scrollTop ${ln.st}; ${ln.vis} lines visible`); }
note(`read: ${ln.first3.join(' || ')}`);
await shot('03-read-lines');

// ---------------- 04 add family
begin('04-add-family');
await tapEl('#panel-foot .u-chip', 'Add to recipe', 'tap Add to recipe'); await sleep(500);
f = await facts(); note(`tray "${f.tray}" · url recipe=${decodeURIComponent((f.url.match(/recipe=([^&]*)/) || [])[1] || '')}`);
await shot('04-add-family');

// ---------------- 05 table lens
begin('05-table-lens');
await tapEl('#lensbar a', 'table', 'tap the table tab'); await sleep(1200);
f = await facts(); note(`lens ${f.lens}; tray "${f.tray}"; panel still open tall=${f.panelTall} ${JSON.stringify(f.panel)} over stage ${JSON.stringify(f.stage)}; hint "${f.hint}"`);
const uncovered = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); return [...document.querySelectorAll('.tile')].filter(t => { const r = t.getBoundingClientRect(); return r.top >= st.top && r.bottom <= Math.min(st.bottom, P.top); }).length; });
note(`tiles visible and not under the panel: ${uncovered}`);
await shot('05-table-lens');

// ---------------- 06 shrink the panel (handle), then scroll to Vd in the live band, then add Vd
begin('06-shrink-panel');
let h = await probe('#panel-handle'); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(500); f = await facts(); note(`drag ${step.drags}: handle down 120 px → panel tall=${f.panelTall} ${JSON.stringify(f.panel)}`);
h = await probe('#panel-handle'); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(500); f = await facts(); note(`drag ${step.drags}: handle down again → panel ${f.panel ? 'open' : 'closed (hidden attr)'}; computed display ${f.panelDisplay}; its box still at y ${f.panelBox.join('-')}; trail "${f.trail}"`);
const dead = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); const ys = []; for (let y = Math.ceil(st.top) + 5; y < st.bottom - 5; y += 10) { const e = document.elementFromPoint(215, y); ys.push(e && e.closest('#panel') ? 'P' : e && e.closest('#overlay') ? 'o' : '?'); } return { stage: [Math.round(st.top), Math.round(st.bottom)], map: ys.join(''), liveTop: Math.round(st.top), liveBottom: Math.round(Math.min(st.bottom, P.top)) }; });
note(`finger map down the stage (o = tiles, P = closed panel's box), y ${dead.stage[0]}→${dead.stage[1]} every 10 px: ${dead.map}`);
step.liveBand = [dead.liveTop, dead.liveBottom];
await shot('06a-panel-closed');

begin('06-scroll-to-Vd');
let vd = await vdInfo(); note(`Vd tile at y ${vd.top}-${vd.bottom} (overlay scrollTop ${vd.scrollTop}); live band for swipes y ${dead.liveTop}-${dead.liveBottom}`);
const head0 = (await facts()).head;
for (let k = 0; k < 12 && !(vd.inStage && vd.reach); k++) {
  await drag(215, dead.liveBottom - 16, 215, dead.liveTop + 16, 6, 20); await sleep(450);
  vd = await vdInfo(); const ff = await facts();
  note(`swipe ${step.drags} (y ${dead.liveBottom - 16}→${dead.liveTop + 16}): overlay scrollTop ${vd.scrollTop}; Vd y ${vd.top}-${vd.bottom} inStage=${vd.inStage} reachable=${vd.reach} (${vd.hit})${ff.head !== head0 ? ' · STRAY: panel changed to "' + ff.head + '"' : ''}${ff.panel ? ' · panel reopened' : ''}`);
}
if (vd.inStage && !vd.reach) { // Vd is in the stage but under the closed panel's box: nudge it up
  for (let k = 0; k < 4 && !vd.reach; k++) { await drag(215, dead.liveBottom - 16, 215, dead.liveBottom - 16 - 120, 6, 20); await sleep(450); vd = await vdInfo(); note(`nudge ${step.drags}: overlay scrollTop ${vd.scrollTop}; Vd y ${vd.top}-${vd.bottom} reachable=${vd.reach} (${vd.hit})`); }
}
await shot('06b-Vd-in-view');

begin('06-swipe-Vd');
const x0 = vd.left + 18; await drag(x0, vd.y, x0 + 90, vd.y, 6, 20); await sleep(700);
f = await facts(); const swiped = /Vd/.test(f.tray);
note(`swipe-right 90 px across Vd: tray "${f.tray}" → ${swiped ? 'ADDED by swipe' : 'NOT added by swipe'}; panel ${f.panel ? 'opened "' + f.head + '"' : 'closed'}; overlay scrollTop ${f.overlayTop}`);
await shot('06c-after-swipe');

begin('06-tap-Vd');
if (!swiped) {
  vd = await vdInfo(); await page.touchscreen.tap(vd.x, vd.y); step.taps++; taps++; note(`tap ${step.taps}: Vd tile ${vd.w}x${vd.h} at (${Math.round(vd.x)},${Math.round(vd.y)}) reachable=${vd.reach}`); await sleep(900);
  f = await facts(); note(`panel "${f.head}" ${JSON.stringify(f.panel)} tall=${f.panelTall}; url ${f.url}; page scrollY ${f.scrollY}`);
  const vd2 = await vdInfo(); note(`Vd tile now at y ${vd2.top}-${vd2.bottom}, ${vd2.reach ? 'still visible' : 'under the panel'}`);
  await shot('06d-Vd-panel');
  await tapEl('#panel-foot .u-chip', 'Add to recipe', 'tap Add to recipe for Vd'); await sleep(500); f = await facts();
}
const marks = await page.evaluate(() => ({ recipeTiles: [...document.querySelectorAll('.tile.recipe')].map(t => t.querySelector('b').textContent), chips: [...document.querySelectorAll('#tray .rc')].map(c => ({ t: c.textContent.replace('×', '').trim(), w: Math.round(c.getBoundingClientRect().width), right: Math.round(c.getBoundingClientRect().right), border: c.style.borderColor })), cnt: (document.querySelector('#tray .cnt') || {}).textContent, cntLeft: Math.round((document.querySelector('#tray .cnt') || document.body).getBoundingClientRect().left), goLeft: Math.round((document.querySelector('#tray .go') || document.body).getBoundingClientRect().left) }));
note(`tray "${f.tray}" · recipe=${decodeURIComponent((f.url.match(/recipe=([^&]*)/) || [])[1] || '')} · tiles outlined as recipe: ${marks.recipeTiles.join(', ') || 'none'} · chips ${JSON.stringify(marks.chips)} · count "${marks.cnt}" at x ${marks.cntLeft}, Hand off at x ${marks.goLeft}`);
await shot('06-Vd-added');

// ---------------- 07 river
begin('07-river');
await tapEl('#lensbar a', 'river', 'tap the river tab'); await sleep(1500);
f = await facts(); const chips = await page.evaluate(() => [...document.querySelectorAll('#tray .rc')].map(c => c.textContent.replace('×', '').trim()));
note(`lens ${f.lens}; tray chips ${JSON.stringify(chips)} → both still there: ${chips.includes('#511') && chips.includes('Vd')}; url ${f.url}; panel ${f.panel ? 'open "' + f.head + '" tall=' + f.panelTall : 'closed'}; hint "${f.hint}"`);
const labels = await page.evaluate(() => [...document.querySelectorAll('#labels span')].filter(s => !s.hidden).map(s => s.textContent));
note(`river labels on screen: ${labels.join(', ')} → Vd labelled: ${labels.includes('Vd')}, #511 labelled: ${labels.includes('#511')}`);
await shot('07-river');
if (f.panel) { h = await probe('#panel-handle'); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(400); f = await facts(); if (f.panel) { h = await probe('#panel-handle'); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(400); f = await facts(); } note(`closed the panel with ${step.drags} handle drags to see the river`); await shot('07b-river-no-panel'); }

// ---------------- 08 recipe sheet
begin('08-sheet');
await tapEl('#tray .cnt', null, 'tap the count in the tray'); await sleep(600);
let sh = await page.evaluate(() => { const S = document.getElementById('sheet'); const b = S.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), scrollH: S.scrollHeight, clientH: S.clientHeight, head: (S.querySelector('.u-h') || {}).textContent, rows: [...S.querySelectorAll('.ch')].map(r => ({ text: r.textContent.trim(), parts: [...r.children].map(c => `${c.textContent.trim().slice(0, 18)}(${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)})`) })), buttons: [...S.querySelectorAll('.row .u-chip')].map(c => `${c.textContent.trim()}@y${Math.round(c.getBoundingClientRect().top)}`), handoff: (S.querySelector('span[style*="overflow-wrap"]') || {}).textContent, needs: (S.querySelector('.u-need') || {}).textContent, pinned: [...S.querySelectorAll('.pin div')].map(d => d.textContent) }; });
note(`sheet y ${sh.top}-${sh.bottom}, content ${sh.scrollH} in ${sh.clientH}; head "${sh.head}"`);
for (const r of sh.rows) note(`row "${r.text}": ${r.parts.join(' ')}`);
note(`buttons ${sh.buttons.join(', ')} (viewport 900)`); note(`needs: ${(sh.needs || '').slice(0, 160)}`); note(`pinned files (${sh.pinned.length}): ${sh.pinned.slice(0, 3).join(' ; ')}${sh.pinned.length > 3 ? ' …' : ''}`); note(`hand-off url: ${sh.handoff}`);
await shot('08a-sheet');
for (let k = 0; k < 4; k++) { const b = await probe('#sheet .row .u-chip', 'Hand off'); if (b && b.inViewport && b.reach) break; const s = await page.evaluate(() => { const r = document.getElementById('sheet').getBoundingClientRect(); return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom }; }); await drag(s.x, s.bottom - 40, s.x, s.top + 40, 8, 16); await sleep(400); note(`drag ${step.drags} up the sheet: scrollTop ${await page.evaluate(() => document.getElementById('sheet').scrollTop)}`); }
await shot('08b-sheet-scrolled');

// ---------------- 09 hand off
begin('09-handoff');
const nT = targets.length;
await tapEl('#sheet .row .u-chip', 'Hand off', 'tap Hand off in the sheet'); await sleep(2500);
let opened = targets.slice(nT); note(`new tab: ${opened.map(t => t.url).join(' ; ') || 'none'}`);
step.handoffURL = opened.length ? opened[0].url : null;
const hp = (await browser.pages()).find(p => p !== page && /code-generator/.test(p.url()));
if (hp) { await hp.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true }).catch(() => {}); await hp.waitForNetworkIdle({ timeout: 30000 }).catch(() => {}); await sleep(1500); const pk = await hp.evaluate(() => { const T = document.body.innerText; const m = s => (T.match(new RegExp('.{0,60}' + s + '.{0,60}')) || [''])[0].replace(/\s+/g, ' '); return { title: document.title, scrollWidth: document.documentElement.scrollWidth, Vd: m('\\bVd\\b'), Ss: m('\\bSs\\b'), fam: m('511'), checked: [...document.querySelectorAll('input:checked')].map(i => i.value || i.id || i.name).slice(0, 10), text: T.replace(/\s+/g, ' ').slice(0, 400) }; }); step.picker = pk; note(`picker "${pk.title}" scrollWidth ${pk.scrollWidth}; Vd: "${pk.Vd}"; Ss: "${pk.Ss}"; 511: "${pk.fam}"; checked inputs: ${JSON.stringify(pk.checked)}`); await hp.screenshot({ path: OUT + 'coder-09b-picker.png' }); await hp.screenshot({ path: OUT + 'coder-09c-picker-full.png', fullPage: true }); await hp.close(); }
await shot('09-handoff');

// ---------------- 10 side tests: slow finger-scroll over a tile; the ✕
begin('10-slow-scroll-on-tiles');
await page.evaluate(() => document.getElementById('sheet').hidden = true);
await tapEl('#lensbar a', 'table', 'tap the table tab'); await sleep(1200);
f = await facts(); if (f.panel) { h = await probe('#panel-handle'); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(400); f = await facts(); if (f.panel) { h = await probe('#panel-handle'); await drag(h.x, h.y, h.x, h.y + 120, 8, 20); await sleep(400); f = await facts(); } }
note(`panel ${f.panel ? 'open' : 'closed'}; page scrollY ${f.scrollY}; stage ${JSON.stringify(f.stage)}`);
const t0 = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < Math.min(st.bottom, P.top) - 10; }); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent }; });
if (t0) { const before = await facts(); await drag(t0.x, t0.y, t0.x, t0.y - 100, 12, 60); await sleep(900); const after = await facts(); note(`slow finger-scroll (~750 ms, 100 px) starting on tile ${t0.sym}: overlay ${before.overlayTop}→${after.overlayTop}; panel ${before.panel ? 'open' : 'closed'}→${after.panel ? 'OPENED "' + after.head + '"' : 'closed'}; url ${after.url}`); await shot('10-slow-scroll'); }
begin('11-panel-x');
f = await facts(); if (!f.panel) { const t = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < Math.min(st.bottom, P.top) - 10 && !e.closest('details'); }); const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent }; }); await page.touchscreen.tap(t.x, t.y); step.taps++; taps++; await sleep(800); note(`tap ${step.taps}: tile ${t.sym} → panel "${(await facts()).head}"`); }
f = await facts(); note(`before ✕: trail "${f.trail}"; url ${f.url}`);
await tapEl('#panel-foot button.x', null, 'tap the ✕ in the panel foot'); await sleep(700);
f = await facts(); note(`after ✕: panel ${f.panel ? 'open' : 'closed'}; trail "${f.trail}"; url ${f.url}; tray "${f.tray}" → the ✕ ${/trail=/.test(f.url) ? 'kept' : 'THREW AWAY'} the journey trail`);
await shot('11-after-x');
report.totalTaps = taps; report.totalDrags = drags;
await browser.close();
fs.writeFileSync(OUT + 'coder-walk3.json', JSON.stringify(report, null, 1));
console.log('\nwritten coder-walk3.json · taps', taps, '· drags', drags, '· console', report.console.length ? report.console : 'clean');
