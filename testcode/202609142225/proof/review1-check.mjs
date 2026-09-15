// Adversarial review round 1 — refutation checks against the served page (read-only on the page; writes only review1-report.json here).
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/review1-check.mjs <port>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8893', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const LENSES = ['ring', 'particle', 'chord', 'river', 'table', 'column'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'] });
const report = { run_utc: new Date().toISOString(), base: BASE, checks: {} };

// count GL uploads per frame while idle: refutes "no per-instance CPU work per frame" if > 0
const INSTRUMENT = () => {
  const B = window.__rv = { bufferData: 0, bufferSubData: 0, texSubImage2D: 0, texImage2D: 0, draws: 0, requests: [] };
  for (const n of ['bufferData', 'bufferSubData', 'texSubImage2D', 'texImage2D']) { const o = WebGL2RenderingContext.prototype[n]; WebGL2RenderingContext.prototype[n] = function (...a) { B[n]++; return o.apply(this, a); }; }
  for (const n of ['drawArrays', 'drawArraysInstanced']) { const o = WebGL2RenderingContext.prototype[n]; WebGL2RenderingContext.prototype[n] = function (...a) { B.draws++; return o.apply(this, a); }; }
};
async function open(url, width, opts = {}) {
  const page = await browser.newPage(); const mobile = width <= 600;
  await page.setViewport({ width, height: 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await page.evaluateOnNewDocument(INSTRUMENT);
  const errors = [], responses = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  page.on('response', r => { const u = r.url(); if (/202609142202\/data|ventusltd\.github\.io|raw\.githubusercontent/.test(u)) responses.push([r.status(), u.replace(/^https?:\/\/[^/]+/, '')]); });
  await page.goto(BASE + url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__star && window.__star.core.packLoaded() && window.__star.core.U.names, { timeout: 90000 }).catch(() => errors.push('pack or names never loaded'));
  await sleep(opts.wait || 1800);
  page.__errors = errors; page.__responses = responses; return page;
}
const state = () => ({ url: location.search, focus: window.__star.state.focus >= 0 ? window.__star.core.keyStr[window.__star.state.focus] : null, trail: window.__star.state.trail.map(i => window.__star.core.keyStr[i]), recipe: window.__star.state.recipe.slice(), lens: window.__star.state.lens, hist: history.length, panel: !document.getElementById('panel').hidden, panelHead: (document.querySelector('#panel .u-h') || {}).textContent || null });
const legend = () => [...document.querySelectorAll('#legend .lg:not(.cat)')].map(b => ({ word: b.textContent.trim(), off: b.classList.contains('off'), title: b.title }));

try {
  // A. idle frame loop: uploads per frame must be 0; draws per frame small and constant. Data path must resolve (200 on ../202609142202/data/*).
  for (const width of [1440, 430]) {
    const p = await open('?lens=ring&key=family:80299&trail=block:Gc,family:80299', width);
    const a = await p.evaluate(async () => { const B = window.__rv, S = window.__star; const f0 = S.G.frames, u0 = { bd: B.bufferData, bsd: B.bufferSubData, tsi: B.texSubImage2D, d: B.draws }; await new Promise(r => setTimeout(r, 2000)); const f1 = S.G.frames; return { frames: f1 - f0, bufferDataPerFrame: (B.bufferData - u0.bd) / (f1 - f0), bufferSubDataPerFrame: (B.bufferSubData - u0.bsd) / (f1 - f0), texSubImagePerFrame: (B.texSubImage2D - u0.tsi) / (f1 - f0), drawsPerFrame: (B.draws - u0.d) / (f1 - f0), linesCount: S.G.linesCount, linesBytes: S.G.linesBytes, N: S.G.N, packStats: S.core.packStats, indexLines: S.core.U.index.lines, count: document.getElementById('count').textContent, countTitle: document.getElementById('count').title, scrollWidth: document.documentElement.scrollWidth, innerWidth, families17: (S.core.familiesOfLine(17) || []).length, resolveLine17: S.core.keyStr[S.core.resolve('line:17')] }; });
    a.errors = p.__errors; a.dataResponses = p.__responses.filter(x => /202609142202/.test(x[1]));
    report.checks[`idle-${width}`] = a; console.log(`idle-${width}`, JSON.stringify(a));
    await p.close();
  }
  // B. legend words + dim state after tab switches (one page), key/trail/recipe survival, Measure text after switch
  for (const width of [1440, 430]) {
    const p = await open('?lens=ring&key=family:80299&trail=block:Gc,family:80299&recipe=block:Si,family:80299', width);
    const tap = async sel => { const r = await p.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel); if (width <= 600) await p.touchscreen.tap(r.x, r.y); else await p.mouse.click(r.x, r.y); };
    // Measure the focus first, so the code text is in the panel
    await tap('#panel-foot button:nth-child(2)'); await sleep(2500);
    const before = await p.evaluate(() => ({ ...(() => ({ url: location.search }))(), code: (document.querySelector('#panel .u-code') || {}).textContent || '', legend: [...document.querySelectorAll('#legend .lg:not(.cat)')].map(b => ({ word: b.textContent.trim(), off: b.classList.contains('off'), title: b.title })), draws: window.__star.lens.draws }));
    const steps = [{ lens: 'ring', measuredTextPresent: !/text on Measure/.test(before.code) && before.code.length > 50, legend: before.legend, draws: before.draws, url: before.url }];
    for (const lens of LENSES.slice(1)) {
      await tap(`#lensbar a:nth-child(${LENSES.indexOf(lens) + 1})`); await sleep(1500);
      const s = await p.evaluate(() => { const S = window.__star; return { lens: S.state.lens, url: location.search, focus: S.core.keyStr[S.state.focus], trail: S.state.trail.map(i => S.core.keyStr[i]), recipe: S.state.recipe.slice(), draws: S.lens.draws, legend: [...document.querySelectorAll('#legend .lg:not(.cat)')].map(b => ({ word: b.textContent.trim(), off: b.classList.contains('off'), title: b.title })), code: ((document.querySelector('#panel .u-code') || {}).textContent || '').slice(0, 80), scrollWidth: document.documentElement.scrollWidth, bounds: S.lens._bounds, blocks: S.core.range.block[1] - S.core.range.block[0] }; });
      s.measuredTextPresent = !/text on Measure/.test(s.code) && s.code.length > 50;
      s.legendStale = s.legend.filter(c => c.off !== !s.draws.includes(c.word)).map(c => `${c.word}: off=${c.off} but draws=${s.draws.includes(c.word)} (title "${c.title}")`);
      steps.push(s); console.log(width, lens, s.url, 'legendStale', s.legendStale.length, 'measuredText', s.measuredTextPresent, 'bounds', s.bounds);
    }
    report.checks[`switch-${width}`] = { words: steps.map(s => s.legend.map(c => c.word).join('|')), steps, errors: p.__errors };
    await p.close();
  }
  // C. column lens: segment control with no focus; table lens: "show 40 more" with and without focus
  {
    const p = await open('?lens=column', 1440);
    const s0 = await p.evaluate(state);
    await p.click('.col .seg button:nth-child(2)'); await sleep(1200);
    const s1 = await p.evaluate(state);
    report.checks['column-seg-no-focus'] = { before: s0, afterClickingShowDependsOn: s1, errors: p.__errors };
    console.log('column seg', JSON.stringify({ before: s0.focus, after: s1.focus, trail: s1.trail, url: s1.url, hist: [s0.hist, s1.hist], panel: s1.panel }));
    await p.close();
  }
  {
    const p = await open('?lens=table', 1440);
    const s0 = await p.evaluate(state);
    await p.evaluate(() => { const m = document.querySelector('#overlay .u-more'); m.scrollIntoView(); }); await p.click('#overlay .u-more'); await sleep(1200);
    const s1 = await p.evaluate(state);
    report.checks['table-more-no-focus'] = { before: s0, after: s1, errors: p.__errors };
    console.log('table more (no focus)', JSON.stringify({ before: s0.focus, after: s1.focus, trail: s1.trail, url: s1.url, hist: [s0.hist, s1.hist], panel: s1.panel }));
    await p.close();
    const q = await open('?lens=table&key=block:Cg', 1440);
    const t0 = await q.evaluate(state);
    await q.evaluate(() => { const m = document.querySelector('#overlay .u-more'); m.scrollIntoView(); }); await q.click('#overlay .u-more'); await sleep(1200);
    const t1 = await q.evaluate(state);
    report.checks['table-more-with-focus'] = { before: t0, after: t1, errors: q.__errors };
    console.log('table more (focus Cg)', JSON.stringify({ before: t0.focus, after: t1.focus, trail: t1.trail, hist: [t0.hist, t1.hist] }));
    await q.close();
  }
  // D. table lens at 430 with a family focus: does the overlay scroll to the family's block tile?
  {
    const p = await open('?lens=table&key=family:80299', 430, { wait: 2500 });
    const s = await p.evaluate(() => { const ov = document.getElementById('overlay'), st = document.getElementById('stage').getBoundingClientRect(), t = document.querySelector('#overlay .tile.focus'); const r = t && t.getBoundingClientRect(); return { overlayScrollTop: ov.scrollTop, overlayScrollHeight: ov.scrollHeight, stageH: st.height, focusTile: t && t.textContent.trim().slice(0, 30), focusTileTopInStage: r && Math.round(r.top - st.top), inside: r && r.bottom > st.top && r.top < st.bottom }; });
    report.checks['table-430-family'] = { ...s, errors: p.__errors }; console.log('table-430-family', JSON.stringify(s));
    await p.close();
  }
  // E. compose with line:17: the hand-off attributes the line to one family of many
  {
    const p = await open('?lens=ring&recipe=line:17', 1440);
    const s = await p.evaluate(async () => { const S = window.__star; const j = await S.recipeJSON(); return { families17: (S.core.familiesOfLine(17) || []).length, resolved: S.core.keyStr[S.core.resolve('line:17')], handOff: S.handOffURL(), lines: j.lines, blocks: j.blocks.map(b => b.symbol), tray: document.getElementById('tray').textContent }; });
    report.checks['line17'] = { ...s, errors: p.__errors }; console.log('line17', JSON.stringify(s));
    await p.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(OUT + 'review1-report.json', JSON.stringify(report, null, 1));
console.log('written', OUT + 'review1-report.json');
