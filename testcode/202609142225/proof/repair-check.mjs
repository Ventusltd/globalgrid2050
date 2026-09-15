// Repair round self-test: one check per finding of the review (blockers, majors, and the minors that were fixed).
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/repair-check.mjs [port]
// Writes proof/repair-check.json and proof/repair-*.png. Every number below is read from the live page.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8877', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'], protocolTimeout: 120000 });
const report = { run_utc: new Date().toISOString(), base: BASE, checks: [] };
let pass = 0, fail = 0;
function check(id, ok, detail) { report.checks.push({ id, ok: !!ok, detail }); if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); }
async function open(url, width, errs) {
  const page = await browser.newPage(); const mobile = width <= 600;
  await page.setViewport({ width, height: 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.evaluate(() => { try { localStorage.removeItem('star-generator.recipe'); } catch (e) {} });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 });
  await sleep(800); return page;
}
const errs = [];

// ---- major 1: a line carried by many families never picks fs[0] for compose / hand-off
{
  const page = await open(BASE + '?lens=table&recipe=block:Si,line:17', 1440, errs);
  const r = await page.evaluate(async () => { const S = window.__star; const j = await S.recipeJSON(); const rl = S.core.resolveLine(17); return { carried: rl.fams ? rl.fams.length : null, composeEntity: S.core.composeEntity('line:17'), handOff: S.handOffURL(), line: j.lines[0], tray: document.getElementById('tray').textContent, trayTitle: (document.querySelector('#tray .cnt') || {}).title || '', trayCount: (document.querySelector('#tray .cnt') || {}).textContent || '' }; });
  check('M1 line:17 not attributed to a family', r.composeEntity === -1 && r.line.family === null && r.line.families_carrying === r.carried && /blocks=Si&/.test(r.handOff) && !/Cg/.test(r.handOff), r);
  check('M1 tray says pick one', /carried by [\d,]+ families · pick one/.test(r.trayTitle) && /\d+ to pick/.test(r.trayCount) && /pick one/.test(r.tray), { tray: r.tray, count: r.trayCount, title: r.trayTitle });   // review round 2: the count in the tray is numerals, the full words are on its title
  await page.click('#tray .cnt'); await sleep(300);
  const sheet = await page.evaluate(() => ({ text: document.getElementById('sheet').textContent, pick: !!document.querySelector('#sheet .ch .u-chip[title]') }));
  check('M1 sheet row says pick one with a chooser', /line 17 · carried by [\d,]+ families · pick one/.test(sheet.text) && sheet.pick, sheet.text.slice(0, 200));
  await page.click('#sheet .ch .u-chip[title]'); await sleep(300);
  const chooser = await page.evaluate(() => ({ head: document.querySelector('#sheet .u-h').textContent, rows: document.querySelectorAll('#sheet .ch').length, more: (document.querySelector('#sheet .u-more') || {}).textContent }));
  check('M1 chooser lists the families paged 40', /carried by/.test(chooser.head) && chooser.rows === 40 && /more|families/.test(chooser.more || ''), chooser);
  await page.screenshot({ path: OUT + 'repair-line-chooser.png' });
  await page.click('#sheet .ch button'); await sleep(400);
  const after = await page.evaluate(async () => { const S = window.__star; const j = await S.recipeJSON(); return { handOff: S.handOffURL(), line: j.lines[0], tray: document.getElementById('tray').textContent, trayTitle: (document.querySelector('#tray .cnt') || {}).title || '', trayCount: (document.querySelector('#tray .cnt') || {}).textContent || '' }; });
  check('M1 after a pick the chosen family and its block travel', after.line.family !== null && after.line.chosen === true && after.line.families_carrying > 1 && /pinned as a note/.test(after.trayTitle), after);   // review round 2: the full words moved to the title of the count and of the chips
  await page.close();
}
// ---- major 2: column show / spider are not navigations
{
  const page = await open(BASE + '?lens=column', 1440, errs);
  const before = await page.evaluate(() => ({ focus: window.__star.state.focus, trail: window.__star.state.trail.length, url: location.search, hist: history.length, panel: document.getElementById('panel').hidden }));
  await page.click('.col .seg button:nth-child(2)'); await sleep(500);
  const mid = await page.evaluate(() => ({ focus: window.__star.state.focus, trail: window.__star.state.trail.length, url: location.search, hist: history.length, panel: document.getElementById('panel').hidden, on: document.querySelector('.col .seg button.on').textContent }));
  await page.click('.col .seg button:nth-child(4)'); await sleep(700);
  const after = await page.evaluate(() => ({ focus: window.__star.state.focus, trail: window.__star.state.trail.length, url: location.search, hist: history.length, panel: document.getElementById('panel').hidden, spider: document.querySelector('.col .seg button:nth-child(4)').textContent }));
  check('M2 column segment/spider keep focus, trail, URL, history', before.focus === -1 && mid.focus === -1 && after.focus === -1 && mid.trail === 0 && after.trail === 0 && before.url === mid.url && mid.url === after.url && before.hist === after.hist && mid.panel && after.panel && mid.on === 'show: depends on' && after.spider === 'column', { before, mid, after });
  await page.close();
}
// ---- major 3: table show 40 more is paging, not a hop
{
  const page = await open(BASE + '?lens=table&key=block:Cg', 1440, errs);
  const before = await page.evaluate(() => ({ focus: window.__star.state.focus, trail: window.__star.state.trail.length, url: location.search, hist: history.length, groups: document.querySelectorAll('.tb-cat:last-of-type .tile').length, head: document.querySelector('#panel .u-h').textContent }));
  await page.evaluate(() => document.querySelector('.tb-cat .u-more').scrollIntoView());
  await page.click('.tb-cat .u-more'); await sleep(600);
  const after = await page.evaluate(() => ({ focus: window.__star.state.focus, trail: window.__star.state.trail.length, url: location.search, hist: history.length, groups: document.querySelectorAll('.tb-cat:last-of-type .tile').length, head: document.querySelector('#panel .u-h').textContent }));
  check('M3 show 40 more: +40 tiles, same focus/trail/URL/history', after.groups === before.groups + 40 && after.focus === before.focus && after.trail === before.trail && after.url === before.url && after.hist === before.hist && after.head === before.head, { before, after });
  await page.close();
  const p2 = await open(BASE + '?lens=table', 1440, errs);
  const b2 = await p2.evaluate(() => ({ focus: window.__star.state.focus, hist: history.length, panel: document.getElementById('panel').hidden }));
  await p2.evaluate(() => document.querySelector('.tb-cat .u-more').scrollIntoView()); await p2.click('.tb-cat .u-more'); await sleep(600);
  const a2 = await p2.evaluate(() => ({ focus: window.__star.state.focus, hist: history.length, panel: document.getElementById('panel').hidden, groups: document.querySelectorAll('.tb-cat:last-of-type .tile').length }));
  check('M3 show 40 more with no focus: no navigation, panel stays closed', b2.focus === -1 && a2.focus === -1 && a2.hist === b2.hist && a2.panel && a2.groups === 80, { b2, a2 });
  await p2.close();
}
// ---- major 4: a family focus scrolls the table to its block tile (430)
{
  const page = await open(BASE + '?lens=table&key=family:80299', 430, errs);
  const r = await page.evaluate(() => { const ov = document.getElementById('overlay'); const t = document.querySelector('.tile.focus'); const st = document.getElementById('stage').getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); const tr = t ? t.getBoundingClientRect() : null; return { scrollTop: ov.scrollTop, scrollH: ov.scrollHeight, tile: t ? t.querySelector('b').textContent : null, tileTop: tr ? Math.round(tr.top - st.top) : null, visibleBand: Math.round(Math.min(st.bottom, P.top) - st.top), inBand: tr ? tr.top >= st.top && tr.bottom <= Math.min(st.bottom, P.top) : false, head: document.querySelector('#panel .u-h').textContent }; });
  check('M4 family focus scrolls the overlay to its block tile, inside the visible band', r.scrollTop > 0 && r.inBand, r);
  await page.screenshot({ path: OUT + 'repair-table-family-430.png' });
  await page.close();
}
// ---- major 5: legend dim state follows the lens after every tab switch
{
  const page = await open(BASE + '?lens=ring&key=block:Cg', 1440, errs);
  const LENSES = ['ring', 'particle', 'chord', 'river', 'table', 'column']; const wrong = {};
  for (const id of LENSES.slice(1)) { await page.click(`#lensbar a:nth-child(${LENSES.indexOf(id) + 1})`); await sleep(400); wrong[id] = await page.evaluate(() => { const L = window.__star.lens; const U = window.__star.core.U; return [...document.querySelectorAll('#legend .lg:not(.cat)')].map((b, k) => { const w = b.textContent.trim(); const loaded = k < 5 || !!U.pack; const shouldDim = !loaded || !L.draws.includes(w); return shouldDim !== b.classList.contains('off') ? w : null; }).filter(Boolean); }); }
  check('M5 legend dim state matches lens.draws after each switch', Object.values(wrong).every(w => w.length === 0), wrong);
  await page.close();
}
// ---- blocker 6: a closed panel is gone (430)
{
  const page = await open(BASE + '?lens=table', 430, errs);
  const r = await page.evaluate(() => { const P = document.getElementById('panel'); const st = document.getElementById('stage').getBoundingClientRect(); const map = []; for (let y = Math.ceil(st.top) + 5; y < st.bottom - 5; y += 10) { const e = document.elementFromPoint(215, y); map.push(e && e.closest('#panel') ? 'P' : e && e.closest('#overlay') ? 'o' : '?'); } const tiles = [...document.querySelectorAll('.tile')].filter(t => { const r = t.getBoundingClientRect(); return r.top >= st.top && r.bottom <= st.bottom; }).length; return { hidden: P.hidden, display: getComputedStyle(P).display, map: map.join(''), tilesVisible: tiles, panelHits: [450, 500, 600, 700, 780].map(y => { const e = document.elementFromPoint(215, y); return e ? (e.id ? '#' + e.id : e.tagName + '.' + e.className) : 'none'; }) }; });
  check('B6 closed panel has display none and swallows no touch', r.hidden && r.display === 'none' && !r.map.includes('P') && r.tilesVisible > 0, r);
  await page.screenshot({ path: OUT + 'repair-table-fresh-430.png' });
  await page.close();
}
// ---- blocker 7: swipe-right on a tile composes by touch (430)
{
  const page = await open(BASE + '?lens=table', 430, errs);
  const t = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < st.bottom - 10 && !e.closest('details'); }); const r = x.getBoundingClientRect(); return { x: r.left + 18, y: r.top + r.height / 2, sym: x.querySelector('b').textContent }; });
  await page.touchscreen.touchStart(t.x, t.y); for (let s = 1; s <= 6; s++) { await page.touchscreen.touchMove(t.x + 90 * s / 6, t.y); await sleep(20); } await page.touchscreen.touchEnd(); await sleep(600);
  const r = await page.evaluate(() => ({ tray: document.getElementById('tray').textContent, recipe: window.__star.state.recipe.slice(), focus: window.__star.state.focus, panel: document.getElementById('panel').hidden }));
  check('B7 swipe-right 90 px on a tile adds it to the recipe by touch', r.recipe.includes('block:' + t.sym) && r.focus === -1, { tile: t.sym, ...r });
  // and a vertical finger scroll over the tiles still scrolls, never composes or navigates
  const before = await page.evaluate(() => document.getElementById('overlay').scrollTop);
  await page.touchscreen.touchStart(215, t.y + 40); for (let s = 1; s <= 8; s++) { await page.touchscreen.touchMove(215, t.y + 40 - 120 * s / 8); await sleep(20); } await page.touchscreen.touchEnd(); await sleep(500);
  const v = await page.evaluate(() => ({ scrollTop: document.getElementById('overlay').scrollTop, recipe: window.__star.state.recipe.length, focus: window.__star.state.focus }));
  check('B7 vertical finger scroll over tiles scrolls the grid only', v.scrollTop > before && v.recipe === 1 && v.focus === -1, { before, ...v });
  await page.close();
}
// ---- major 8 + minor: Measure makes the panel tall; a lens tab drops/closes it; measured text survives a keyboard switch
{
  const page = await open(BASE + '?lens=ring&key=family:511', 430, errs);
  await page.waitForFunction(() => document.querySelector('#panel-foot .u-chip'), { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('#panel-foot .u-chip')].find(b => b.textContent === 'Measure').click());
  await page.waitForFunction(() => { const c = document.querySelector('#panel .u-code'); return c && !/Fetching/.test(c.textContent) && !/text on Measure/.test(c.textContent); }, { timeout: 40000 }); await sleep(300);
  const m = await page.evaluate(() => { const B = document.getElementById('panel-body'); const pb = B.getBoundingClientRect(); const ls = [...B.querySelectorAll('.u-line')]; const c = B.querySelector('.u-code'); return { tall: document.getElementById('panel').classList.contains('tall'), vis: ls.filter(l => { const r = l.getBoundingClientRect(); return r.top >= pb.top && r.bottom <= pb.bottom; }).length, n: ls.length, codeTop: Math.round(c.getBoundingClientRect().top), bodyTop: Math.round(pb.top), bodyBottom: Math.round(pb.bottom), sideways: c.scrollWidth > c.clientWidth, sharedKeys: [...c.querySelectorAll('.u-key[title]')].map(k => k.textContent + ' ' + k.title), order: [...B.querySelectorAll('.u-sub')].map(s => s.textContent.slice(0, 22)) }; });
  check('M11 after Measure the code box is in view and lines are readable', m.tall && m.vis >= 3 && m.codeTop >= m.bodyTop && m.codeTop < m.bodyBottom && !m.sideways, m);
  check('m shared-line key coloured with a title', m.sharedKeys.length > 0, m.sharedKeys);
  check('m numbered lines before uses/used by on a phone', m.order.findIndex(s => /Numbered lines/.test(s)) < Math.max(m.order.findIndex(s => /uses/.test(s)), m.order.findIndex(s => /used by/.test(s))) || !m.order.some(s => /used by|uses/.test(s)), m.order);
  await page.screenshot({ path: OUT + 'repair-measure-430.png' });
  await page.keyboard.press(']'); await sleep(600);   // keyboard switch keeps the panel (at peek), measured text kept
  const k = await page.evaluate(() => ({ tall: document.getElementById('panel').classList.contains('tall'), hidden: document.getElementById('panel').hidden, lens: document.querySelector('#lensbar a.on').textContent, text: (document.querySelector('#panel .u-code') || {}).textContent || '' }));
  check('M8 keyboard lens switch drops the panel to peek and (minor) keeps the measured text', !k.tall && !k.hidden && k.lens === 'particle' && !/text on Measure/.test(k.text) && k.text.length > 50, { tall: k.tall, hidden: k.hidden, lens: k.lens, textHead: k.text.slice(0, 60) });
  await page.evaluate(() => [...document.querySelectorAll('#lensbar a')].find(a => a.textContent === 'table').click()); await sleep(900);
  const t = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); return { hidden: document.getElementById('panel').hidden, lens: document.querySelector('#lensbar a.on').textContent, tiles: [...document.querySelectorAll('.tile')].filter(t => { const r = t.getBoundingClientRect(); return r.top >= st.top && r.bottom <= st.bottom; }).length, url: location.search }; });
  check('M8 lens tab tap on a phone closes the panel and shows the tiles', t.hidden && t.lens === 'table' && t.tiles > 0 && /key=family:511/.test(t.url), t);
  await page.screenshot({ path: OUT + 'repair-table-after-tab-430.png' });
  await page.close();
}
// ---- majors 9, 10, 12 and minor needs: the sheet and the count words (430)
{
  const page = await open(BASE + '?lens=table&recipe=family:511,block:Vd', 430, errs);
  const w = await page.evaluate(() => ({ tray: document.getElementById('tray').textContent, cnt: document.querySelector('#tray .cnt').textContent, cntTitle: document.querySelector('#tray .cnt').title, chipTitle: (document.querySelector('#tray .rc') || {}).title || '', chips: [...document.querySelectorAll('#tray .rc')].map(c => c.textContent.replace('×', '').trim()), outlined: [...document.querySelectorAll('.tile.recipe')].map(t => t.querySelector('b').textContent + (t.classList.contains('derived') ? '(derived)' : '')), handOff: window.__star.handOffURL() }));
  check('M12 count words say which blocks travel and what is a note', /2 blocks will travel \(Ss, Vd\)/.test(w.cntTitle) && /#511 pinned as a note/.test(w.cntTitle) && w.chipTitle === w.cntTitle && /^2 blocks · 1 note$/.test(w.cnt), { cnt: w.cnt, title: w.cntTitle });   // review round 2: numerals in the tray, the full words on the title of the count and of every chip
  check('M12 family chip shows its derived block; Ss and Vd outlined on the table', w.chips.includes('#511 → Ss') && w.outlined.includes('Ss(derived)') && w.outlined.includes('Vd'), { chips: w.chips, outlined: w.outlined });
  await page.evaluate(() => document.querySelector('#tray .cnt').click()); await sleep(400);
  const sh = await page.evaluate(() => { const S = document.getElementById('sheet'); const b = S.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), rows: [...S.querySelectorAll('.ch')].map(r => ({ h: Math.round(r.getBoundingClientRect().height), parts: [...r.children].map(c => `${c.textContent.trim().slice(0, 16)}(${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)})`) })), buttons: [...S.querySelectorAll('.row.act .u-chip')].map(c => ({ t: c.textContent.trim(), y: Math.round(c.getBoundingClientRect().top), h: Math.round(c.getBoundingClientRect().height) })), needs: (S.querySelector('.u-need') || {}).textContent, showAll: !!([...S.querySelectorAll('.u-chip')].find(c => /show all/.test(c.textContent))) }; });
  check('M9 sheet rows: name button wide, ▲▼× chips 44 px, one line each', sh.rows.every(r => r.h <= 48) && sh.rows.every(r => { const ws = r.parts.map(p => +p.match(/\((\d+)x/)[1]); return ws[0] > 150 && ws.slice(1).every(x => x >= 44 && x <= 60); }), sh.rows);
  check('M10 Hand off / Copy recipe / Copy command visible at the top of the sheet', sh.buttons.length === 3 && sh.buttons.every(b => b.y >= sh.top && b.y + b.h <= 900 && b.h >= 44), sh.buttons);
  check('m needs shown as a count first, one-letter names behind show all', /^needs: \d+ from outside/.test(sh.needs) && !/, [a-z],/.test(sh.needs) && sh.showAll, sh.needs);
  await page.screenshot({ path: OUT + 'repair-sheet-430.png' });
  await page.close();
}
// ---- major 13: ✕ closes the panel and keeps the journey
{
  const page = await open(BASE + '?lens=ring&key=block:Cg&trail=block:At,block:Cg', 1440, errs);
  await page.waitForFunction(() => document.querySelector('#panel-foot button.x'), { timeout: 30000 });
  const before = await page.evaluate(() => ({ trail: document.getElementById('trail').textContent, url: location.search }));
  await page.click('#panel-foot button.x'); await sleep(300);
  const after = await page.evaluate(() => ({ trail: document.getElementById('trail').textContent, url: location.search, hidden: document.getElementById('panel').hidden, focus: window.__star.state.focus, rootTitle: document.querySelector('#trail a.root').title }));
  check('M13 ✕ closes the panel; trail, key and URL stay; home is the root crumb', after.hidden && after.trail === before.trail && after.url === before.url && after.focus >= 0 && after.rootTitle === 'home', { before, after });
  await page.close();
}
// ---- minors: tray after pack for a line key; h3 and search chip heights; river labels the recipe; BUILT stamp; orphans
{
  const page = await open(BASE + '?lens=river&recipe=line:17,family:511,block:Vd&key=block:Vd', 430, errs);
  const r = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#tray .rc')].map(c => c.textContent.replace('×', '').trim()), labels: [...document.querySelectorAll('#labels span')].filter(s => !s.hidden).map(s => s.textContent), footer: document.getElementById('footer').textContent, orphans: window.__star.core.packStats.orphans }));
  check('m tray shows the line in words after the pack (no raw key)', r.chips.some(c => /^line 17 · [\d,]+ families · pick one$/.test(c)) && !r.chips.includes('line:17'), r.chips);
  check('m river labels every recipe member', r.labels.includes('#511') && r.labels.includes('Vd'), r.labels);
  check('m footer build stamp comes from publish.mjs (ISO minute), pack orphans 0', /built \d{4}-\d\d-\d\d \d\d:\d\d UTC/.test(r.footer) && r.orphans === 0, { built: (r.footer.match(/built [^·]*/) || [])[0], orphans: r.orphans });
  await page.close();
  const p2 = await open(BASE + '?lens=table', 430, errs);
  await p2.type('.u-search', 'distance'); await sleep(500);
  const s = await p2.evaluate(() => ({ h3: [...document.querySelectorAll('.tb-cat h3')].map(h => Math.round(h.getBoundingClientRect().height)), hits: [...document.querySelectorAll('.u-hits .u-chip')].map(b => Math.round(b.getBoundingClientRect().height)), scrollWidth: document.documentElement.scrollWidth }));
  check('m category headings and search hit chips are ≥ 44 px tall; page 430 wide', s.h3.every(h => h >= 44) && s.hits.length > 0 && s.hits.every(h => h >= 44) && s.scrollWidth === 430, { h3: s.h3.slice(0, 3), hits: s.hits.slice(0, 3), scrollWidth: s.scrollWidth });
  await p2.close();
}
// ---- the tapped tile stays in view (minor)
{
  const page = await open(BASE + '?lens=table', 430, errs);
  const t = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < st.bottom - 10 && !e.closest('details'); }); const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent, scrollY: scrollY }; });
  await page.touchscreen.tap(t.x, t.y); await sleep(900);
  const a = await page.evaluate((sym) => { const x = [...document.querySelectorAll('.tile')].find(e => e.querySelector('b').textContent === sym); const r = x.getBoundingClientRect(); const P = document.getElementById('panel').getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: Math.round(r.top), bottom: Math.round(r.bottom), panelTop: Math.round(P.top), reach: !!h && (h === x || x.contains(h)), scrollY: scrollY, head: document.querySelector('#panel .u-h').textContent }; }, t.sym);
  check('m a tapped tile stays visible above the sheet', a.reach && a.bottom <= a.panelTop, { tile: t.sym, before: t, after: a });
  await page.close();
}
report.console_errors = errs; report.pass = pass; report.fail = fail;
check('console: no errors across the checks', errs.length === 0, errs);
await browser.close();
fs.writeFileSync(OUT + 'repair-check.json', JSON.stringify(report, null, 1));
console.log(`\n${pass} pass · ${fail} fail · written repair-check.json`);
