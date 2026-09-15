// Review round 2 (post-repair) self-test: one check per finding, plus the measurements DECISION.md Table B needs after the repair.
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/final-check.mjs [port]
// Writes proof/final-check.json and proof/final-*.png. Every number below is read from the live page; nothing is typed in.
//   F1 category chip -> computeLit -> the dim bit (32) reaches the GPU and is cleared on un-click
//   F2 legend kind chip -> relayout -> lens geometry follows the chip (chord's idle chords)
//   F3 .tb-cat summary folds are >= 44 px at 430 (the repositories fold included)
//   F4 the newest recipe chip's remove button is hit-testable at 430
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8911', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const LENSES = ['ring', 'particle', 'chord', 'river', 'table', 'column'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'], protocolTimeout: 120000 });
const report = { run_utc: new Date().toISOString(), base: BASE, checks: [], measurements: {} };
let pass = 0, fail = 0;
const errs = [];
function check(id, ok, detail) { report.checks.push({ id, ok: !!ok, detail }); if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); }
async function open(url, width) {
  const page = await browser.newPage(); const mobile = width <= 600;
  await page.setViewport({ width, height: 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.evaluate(() => { try { localStorage.removeItem('star-generator.recipe'); } catch (e) {} });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => /blocks on the table/.test(document.getElementById('count').textContent) && document.getElementById('count').title.length > 0, { timeout: 60000 });
  await sleep(900); return page;
}
const DIMMED = () => { const G = window.__star.G; let n = 0; for (let i = 0; i < G.N; i++) if (G.meta[4 * i + 2] & 32) n++; return n; };

// ---- F1: the category chip's dim bit reaches the GPU, and leaves it again
{
  const page = await open(BASE + '?lens=ring&key=block:Gc', 1440);
  const before = await page.evaluate(DIMMED);
  const chip = await page.evaluate(() => { const c = document.querySelector('#legend .lg.cat'); c.click(); return c.textContent; });
  await sleep(700);
  const on = await page.evaluate(() => ({ dim: (() => { const G = window.__star.G; let n = 0; for (let i = 0; i < G.N; i++) if (G.meta[4 * i + 2] & 32) n++; return n; })(), cat: window.__star.state.cat, url: location.search }));
  await page.screenshot({ path: OUT + 'final-f1-cat-on-1440.png' });
  await page.evaluate(() => document.querySelector('#legend .lg.cat').click()); await sleep(700);
  const off = await page.evaluate(() => ({ dim: (() => { const G = window.__star.G; let n = 0; for (let i = 0; i < G.N; i++) if (G.meta[4 * i + 2] & 32) n++; return n; })(), cat: window.__star.state.cat, url: location.search }));
  check('F1 category chip sets the dim bit on the GPU and clears it again', before === 0 && on.dim > 0 && on.cat >= 0 && off.dim === 0 && off.cat === -1, { chip, before, on, off });
  report.measurements.f1 = { chip, dimmed_before: before, dimmed_on: on.dim, dimmed_off: off.dim };
  await page.close();
}
// ---- F2: the legend kind chip refreshes the lens geometry, not only the edges
{
  const page = await open(BASE + '?lens=chord&key=block:Gc', 1440);
  const before = await page.evaluate(() => ({ geom: window.__star.G.geomCount, edges: window.__star.G.edgeCount, kindsOn: window.__star.state.kindsOn, viewKinds: window.__star.view.kindsOn }));
  const word = await page.evaluate(() => { const c = [...document.querySelectorAll('#legend .lg')].find(b => b.textContent.trim() === 'depends on'); c.click(); return c.textContent.trim(); });
  await sleep(800);
  const after = await page.evaluate(() => ({ geom: window.__star.G.geomCount, edges: window.__star.G.edgeCount, kindsOn: window.__star.state.kindsOn, viewKinds: window.__star.view.kindsOn }));
  await page.screenshot({ path: OUT + 'final-f2-chord-off-1440.png' });
  const back = await page.evaluate(() => { const c = [...document.querySelectorAll('#legend .lg')].find(b => b.textContent.trim() === 'depends on'); c.click(); return true; });
  await sleep(800);
  const again = await page.evaluate(() => ({ geom: window.__star.G.geomCount, viewKinds: window.__star.view.kindsOn }));
  check('F2 depends on chip off: chord geometry drops below 400 and the view follows', word === 'depends on' && after.geom < 400 && after.geom < before.geom && ((after.viewKinds >> 1) & 1) === 0 && again.geom === before.geom, { before, after, again, back });
  report.measurements.f2 = { geom_on: before.geom, geom_off: after.geom, geom_on_again: again.geom, arcs_only: after.geom, idle_chords: before.geom - after.geom };
  await page.close();
}
// ---- F3: every category fold summary is at least 44 px tall at 430 (the repositories fold is itself a .tb-cat)
{
  const page = await open(BASE + '?lens=table', 430);
  const s = await page.evaluate(() => {
    const sums = [...document.querySelectorAll('.tb-cat summary')].map(e => ({ text: e.textContent.slice(0, 30), h: Math.round(e.getBoundingClientRect().height) }));
    const h3 = [...document.querySelectorAll('.tb-cat h3')].map(e => Math.round(e.getBoundingClientRect().height));
    const tiles = [...document.querySelectorAll('.tile')].slice(0, 3).map(e => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); });
    const tabs = [...document.querySelectorAll('#lensbar a')].map(e => Math.round(e.getBoundingClientRect().height));
    const crumb = Math.round((document.querySelector('#trail a') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height);
    const search = Math.round(document.querySelector('.u-search').getBoundingClientRect().height);
    return { sums, h3, tiles, tabs, crumb, search, scrollWidth: document.documentElement.scrollWidth, repoFold: sums.find(x => /repositories/.test(x.text)) || null };
  });
  await page.screenshot({ path: OUT + 'final-f3-table-430.png' });
  check('F3 .tb-cat summary folds are >= 44 px at 430 (repositories fold included)', s.sums.length > 0 && s.sums.every(x => x.h >= 44) && !!s.repoFold && s.repoFold.h >= 44 && s.scrollWidth === 430, { count: s.sums.length, min: Math.min(...s.sums.map(x => x.h)), repoFold: s.repoFold, scrollWidth: s.scrollWidth });
  report.measurements.f3 = s;
  await page.close();
}
// ---- F4: the newest recipe chip's remove button is reachable at 430
{
  const page = await open(BASE + '?lens=table&recipe=block:Si', 430);
  const one = await page.evaluate(() => ({ chips: document.querySelectorAll('#tray .rc').length, cnt: document.querySelector('#tray .cnt').textContent, title: document.querySelector('#tray .cnt').title }));
  const t = await page.evaluate(() => { const st = document.getElementById('stage').getBoundingClientRect(); const x = [...document.querySelectorAll('.tile')].find(e => { const r = e.getBoundingClientRect(); return r.top > st.top + 10 && r.bottom < st.bottom - 10 && !e.closest('details'); }); const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sym: x.querySelector('b').textContent }; });
  await page.touchscreen.tap(t.x, t.y); await sleep(900);
  await page.evaluate(() => [...document.querySelectorAll('#panel-foot .u-chip, #panel-foot button')].find(b => b.textContent === 'Add to recipe').click()); await sleep(700);
  await page.evaluate(() => { const x = document.querySelector('#panel-foot button.x'); if (x) x.click(); }); await sleep(500);
  const r = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#tray .rc')];
    const last = chips[chips.length - 1], b = last.querySelector('button'), br = b.getBoundingClientRect();
    const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const box = document.querySelector('#tray .chips').getBoundingClientRect();
    return { chips: chips.length, keys: window.__star.state.recipe.slice(), lastText: last.textContent, x: Math.round(br.width), y: Math.round(br.height), cx: Math.round(cx), cy: Math.round(cy), reach: hit === b || b.contains(hit), hitTag: hit ? hit.tagName + '.' + hit.className : null, visible: br.left >= box.left - 0.5 && br.right <= box.right + 0.5, scrollLeft: Math.round(document.querySelector('#tray .chips').scrollLeft), cnt: document.querySelector('#tray .cnt').textContent, cntTitle: document.querySelector('#tray .cnt').title, scrollWidth: document.documentElement.scrollWidth };
  });
  await page.screenshot({ path: OUT + 'final-f4-tray-430.png' });
  await page.evaluate(() => { const chips = [...document.querySelectorAll('#tray .rc')]; chips[chips.length - 1].querySelector('button').click(); }); await sleep(600);
  const gone = await page.evaluate(() => ({ chips: document.querySelectorAll('#tray .rc').length, keys: window.__star.state.recipe.slice() }));
  check('F4 the newest recipe chip is on screen and its remove button is hit-testable at 430', one.chips === 1 && r.chips === 2 && r.reach && r.visible && r.x >= 44 && r.y >= 44 && gone.chips === 1 && r.scrollWidth === 430, { added: t.sym, one, two: r, afterRemove: gone });
  check('F4 the tray count is in numerals with the full words on the title', /^\d+ block/.test(r.cnt) && !/will travel/.test(r.cnt) && /will travel/.test(r.cntTitle), { cnt: r.cnt, title: r.cntTitle });
  report.measurements.f4 = { one, two: r, afterRemove: gone };
  await page.close();
}
// ---- Table B after the repair: smallest tap targets at 430, and the six lens segments on screen
{
  const heights = {};
  for (const id of LENSES) {
    const page = await open(BASE + `?lens=${id}&key=block:Gc`, 430);
    const m = await page.evaluate(() => {
      const pick = sel => [...document.querySelectorAll(sel)].map(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? Math.round(Math.min(r.width, r.height)) : null; }).filter(v => v !== null);
      const all = { search: pick('.u-search'), crumb: pick('#trail a'), legend: pick('#legend .lg'), tab: pick('#lensbar a'), panelBtn: pick('#panel-foot button, #panel-foot .u-chip'), panelChip: pick('#panel-body .u-chip'), tile: pick('.tile'), card: pick('.card'), summary: pick('.tb-cat summary'), h3: pick('.tb-cat h3'), seg: pick('.col .seg button'), trayGo: pick('#tray .go') };
      let min = Infinity, who = null;
      for (const [k, v] of Object.entries(all)) for (const h of v) if (h < min) { min = h; who = k; }
      return { min, who, all: Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.length ? Math.min(...v) : null])), scrollWidth: document.documentElement.scrollWidth, geom: window.__star.G.geomCount, edges: window.__star.G.edgeCount, hint: document.getElementById('hint').textContent, key: window.__star.state.focus >= 0 ? window.__star.core.keyStr[window.__star.state.focus] : null };
    });
    heights[id] = m;
    await page.screenshot({ path: OUT + `final-tapsize-${id}-430.png` });
    await page.close();
  }
  report.measurements.tap_430 = heights;
  const worst = Object.entries(heights).map(([k, v]) => [k, v.min, v.who]);
  check('Table B post-repair: every measured tap target at 430 is >= 32 px and no lens scrolls sideways', worst.every(w => w[1] >= 32) && Object.values(heights).every(v => v.scrollWidth === 430), worst);
  check('Table B post-repair: the smallest tap target is no longer the 21/22 px fold or heading', worst.every(w => w[1] > 22), worst);
  const segs = Object.entries(heights).map(([k, v]) => ({ lens: k, key: v.key, geometry_segments: v.geom, edge_segments: v.edges }));
  report.measurements.lens_segments_430 = segs;
  check('Table B post-repair: all six lenses draw on screen at 430 with the same key', segs.length === 6 && segs.every(s => s.key === 'block:Gc'), segs);
}
report.console_errors = errs; report.pass = pass; report.fail = fail;
check('console: no errors across the checks', errs.length === 0, errs);
await browser.close();
fs.writeFileSync(OUT + 'final-check.json', JSON.stringify(report, null, 1));
console.log(`\n${pass} pass · ${fail} fail · written final-check.json`);
process.exitCode = fail ? 1 : 0;
