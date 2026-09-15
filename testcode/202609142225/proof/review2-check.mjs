// Adversarial review round 2 — refutation checks against the served page. Read-only on the page; writes only review2-report.json here.
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/review2-check.mjs <port>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8866', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const LENSES = ['ring', 'particle', 'chord', 'river', 'table', 'column'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'], protocolTimeout: 120000 });
const report = { run_utc: new Date().toISOString(), base: BASE, checks: {} };
const ONLY = (process.argv[3] || 'ABCDEFG'); const want = c => ONLY.includes(c);
const say = (k, v) => { report.checks[k] = v; console.log(k, JSON.stringify(v)); };

const INSTRUMENT = () => {
  const B = window.__rv = { bufferData: 0, bufferSubData: 0, texSubImage2D: 0, texImage2D: 0, draws: 0, drawInst: 0 };
  for (const n of ['bufferData', 'bufferSubData', 'texSubImage2D', 'texImage2D']) { const o = WebGL2RenderingContext.prototype[n]; WebGL2RenderingContext.prototype[n] = function (...a) { B[n]++; return o.apply(this, a); }; }
  { const o = WebGL2RenderingContext.prototype.drawArrays; WebGL2RenderingContext.prototype.drawArrays = function (...a) { B.draws++; B.drawInst += a[2]; return o.apply(this, a); }; }
  { const o = WebGL2RenderingContext.prototype.drawArraysInstanced; WebGL2RenderingContext.prototype.drawArraysInstanced = function (...a) { B.draws++; B.drawInst += a[3]; return o.apply(this, a); }; }
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
  if (opts.clearRecipe) { await page.evaluate(() => { try { localStorage.removeItem('star-generator.recipe'); } catch (e) {} }); await page.goto(BASE + url, { waitUntil: 'load', timeout: 90000 }); }
  await page.waitForFunction(() => window.__star && window.__star.core.packLoaded() && window.__star.core.U.names, { timeout: 90000 }).catch(() => errors.push('pack or names never loaded'));
  await sleep(opts.wait || 1800);
  page.__errors = errors; page.__responses = responses; return page;
}
const STATE = () => { const S = window.__star; return { lens: S.state.lens, url: location.search, focus: S.state.focus >= 0 ? S.core.keyStr[S.state.focus] : null, focusKey: S.state.focusKey, measure: S.state.measure >= 0 ? S.core.keyStr[S.state.measure] : null, trail: S.state.trail.map(i => S.core.keyStr[i]), recipe: S.state.recipe.slice(), kindsOn: S.state.kindsOn, cat: S.state.cat, panelHead: (document.querySelector('#panel .u-h') || {}).textContent || null, panelHidden: document.getElementById('panel').hidden, legendWords: [...document.querySelectorAll('#legend .lg:not(.cat)')].map(b => b.textContent.trim()), legendTitles: [...document.querySelectorAll('#legend .lg:not(.cat)')].map(b => b.title) }; };
const tapper = (page, width) => async sel => { const r = await page.evaluate(s => { const e = typeof s === 'string' ? document.querySelector(s) : s; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel); if (width <= 600) await page.touchscreen.tap(r.x, r.y); else await page.mouse.click(r.x, r.y); };

try {
  if (want('A')) // A. per-frame GPU work in every lens, idle 2 s: uploads must be 0; draws per frame constant; lines resident once
  for (const [lens, width] of [...LENSES.map(l => [l, 1440]), ['ring', 430], ['table', 430], ['river', 430]]) {
    const p = await open(`?lens=${lens}&key=family:80299&trail=block:Gc,family:80299`, width);
    const a = await p.evaluate(async () => { const B = window.__rv, S = window.__star; const f0 = S.G.frames, u0 = { ...B }; await new Promise(r => setTimeout(r, 2000)); const f1 = S.G.frames; const n = f1 - f0; return { frames: n, bufferDataPerFrame: (B.bufferData - u0.bufferData) / n, bufferSubDataPerFrame: (B.bufferSubData - u0.bufferSubData) / n, texSubImagePerFrame: (B.texSubImage2D - u0.texSubImage2D) / n, texImagePerFrame: (B.texImage2D - u0.texImage2D) / n, drawsPerFrame: (B.draws - u0.draws) / n, instancesPerFrame: Math.round((B.drawInst - u0.drawInst) / n), linesCount: S.G.linesCount, linesBytes: S.G.linesBytes, packBinBytes: S.core.U.packBytes.byteLength, N: S.G.N, litOnly: S.G.litOnly, edges: S.G.edgeCount, geom: S.G.geomCount, journey: S.G.journeyCount }; });
    a.errors = p.__errors; a.dataResponses = p.__responses.filter(x => /202609142202/.test(x[1]));
    say(`A-idle-${lens}-${width}`, a); await p.close();
  }
  if (want('B')) // B. lens switch keeps key / trail / recipe / measure / edges mask / cat; legend words identical in six lenses; via tab, keyboard and Open-in
  for (const width of [1440, 430]) {
    const p = await open('?lens=ring&key=family:80299&trail=block:Gc,family:80299&recipe=block:Si,family:80299&m=block:Gc&edges=cdub&cat=geodesy', width, { clearRecipe: true });
    const tap = tapper(p, width);
    const steps = [await p.evaluate(STATE)];
    for (const lens of LENSES.slice(1)) { await tap(`#lensbar a:nth-child(${LENSES.indexOf(lens) + 1})`); await sleep(1200); steps.push(await p.evaluate(STATE)); }
    await p.keyboard.press('1'); await sleep(800); steps.push({ via: 'key 1', ...(await p.evaluate(STATE)) });
    await p.keyboard.press(']'); await sleep(800); steps.push({ via: 'key ]', ...(await p.evaluate(STATE)) });
    const s0 = steps[0]; const same = steps.map(s => ({ lens: s.lens, via: s.via, key: s.focus === s0.focus, trail: JSON.stringify(s.trail) === JSON.stringify(s0.trail), recipe: JSON.stringify(s.recipe) === JSON.stringify(s0.recipe), measure: s.measure === s0.measure, kindsOn: s.kindsOn === s0.kindsOn, cat: s.cat === s0.cat, urlHasKey: /key=family:80299/.test(s.url), urlHasTrail: /trail=block:Gc,family:80299/.test(s.url), urlHasRecipe: /recipe=block:Si,family:80299/.test(s.url), urlHasM: /m=block:Gc/.test(s.url), urlHasEdges: /edges=cdub/.test(s.url), urlHasCat: /cat=geodesy/.test(s.url), legendWords: s.legendWords.join('|'), panelHidden: s.panelHidden }));
    say(`B-switch-${width}`, { same, wordsIdentical: new Set(steps.map(s => s.legendWords.join('|'))).size === 1, errors: p.__errors });
    await p.close();
  }
  if (want('C')) // C. count sentence: unique lines from index.json, never lines.bin length; chip titles for random/entangled
  {
    const p = await open('?lens=ring', 1440);
    const c = await p.evaluate(async () => { const S = window.__star; const idx = await fetch('https://ventusltd.github.io/stars/code/index.json').then(r => r.json()); const bin = S.core.U.packBytes.byteLength / 4; return { count: document.getElementById('count').textContent, title: document.getElementById('count').title, indexLines: idx.lines, indexFamilies: idx.families, binEntries: bin, distinct: S.core.packStats.distinct, entities: S.G.N, blocks: S.core.range.block[1] - S.core.range.block[0], groups: S.core.range.group[1] - S.core.range.group[0], families: S.core.range.family[1] - S.core.range.family[0], repos: S.core.range.repo[1] - S.core.range.repo[0], randomStats: S.core.randomStats, entangledStats: S.core.entangledStats, dependsOn: S.core.dependsOnCount, legendTitles: [...document.querySelectorAll('#legend .lg:not(.cat)')].map(b => b.title), footer: document.getElementById('footer').textContent }; });
    c.countSaysIndexLines = c.count.includes(Number(c.indexLines).toLocaleString('en-GB') + ' unique numbered lines'); c.countSaysBinLength = c.count.includes(Number(c.binEntries).toLocaleString('en-GB'));
    say('C-counts', c); await p.close();
  }
  if (want('D')) // D. compose hand-off: keys permanent, commits from blocks.json and the family bucket, none invented
  {
    const p = await open('?lens=ring&recipe=block:Si,family:80299,group:x100,line:17', 1440, { clearRecipe: true });
    const d = await p.evaluate(async () => { const S = window.__star; const j = await S.recipeJSON(); const live = await fetch('https://ventusltd.github.io/stars/blocks/blocks.json').then(r => r.json()); const bucket = await fetch('https://ventusltd.github.io/stars/code/f/160.json').then(r => r.json()); const bySym = new Map(live.blocks.map(b => [b.symbol, b]));
      const blocksOk = j.blocks.map(b => { const lb = bySym.get(b.symbol); return { symbol: b.symbol, number: b.number, files: b.files.length, inLive: !!lb, commitsMatchLive: !!lb && JSON.stringify(b.files.map(f => f.commit)) === JSON.stringify((lb.files || []).map(f => f.commit)), all40hex: b.files.every(f => /^[0-9a-f]{40}$/.test(f.commit)) }; });
      const fam = j.families[0]; const rec = bucket['80299']; const famOk = fam && rec && rec.places && rec.places[0] && fam.place && fam.place.commit === rec.places[0].commit && fam.place.path === rec.places[0].path && fam.place.repo === rec.places[0].repo;
      return { handOff: S.handOffURL(), keys: j.keys, blocks: blocksOk, family: fam, famCommitMatchesBucket: !!famOk, lines: j.lines, needs: j.needs.length, trail: j.trail, data: j.data, tray: document.getElementById('tray').textContent, sheetFiles: null }; });
    await p.click('#tray .cnt'); await sleep(400);
    d.sheet = await p.evaluate(() => ({ pinned: [...document.querySelectorAll('#sheet .pin div')].map(e => e.textContent), url: (document.getElementById('sheet').innerText.match(/https:\/\/ventusltd\.github\.io\/code-generator\/\S+/) || [null])[0], head: document.querySelector('#sheet .u-h').textContent }));
    say('D-handoff', { ...d, errors: p.__errors }); await p.close();
  }
  if (want('E')) // E. category dim chip: does clicking it change the lit bytes on the GPU (bit 32) without a navigate?
  {
    const p = await open('?lens=ring&key=block:Gc', 1440);
    const litCount = () => p.evaluate(() => { const S = window.__star; let n = 0; for (let i = 0; i < S.G.N; i++) if (S.G.meta[4 * i + 2] & 32) n++; return { dim32: n, cat: S.state.cat, url: location.search, tilesDim: document.querySelectorAll('.tile.dim').length }; });
    const before = await litCount();
    await p.evaluate(() => document.querySelectorAll('#legend .lg.cat')[2].click()); await sleep(600);
    const afterClick = await litCount();
    await p.evaluate(() => document.querySelector('#panel-foot button').click()); await sleep(600);   // Navigate here → computeLit
    const afterNavigate = await litCount();
    await p.evaluate(() => document.querySelector('#legend .lg.cat.on').click()); await sleep(600);
    const afterUnclick = await litCount();
    say('E-cat-dim', { before, afterClick, afterNavigate, afterUnclick, errors: p.__errors }); await p.close();
  }
  if (want('F')) // F. DECISION.md Table B claims against the current code: h3 height, smallest tap target, tiles at 430 family focus
  for (const width of [1440, 430]) {
    const p = await open('?lens=table&key=family:80299', width, { wait: 2500 });
    const f = await p.evaluate(() => { const sels = { search: '.u-search', crumb: '#trail a', legendChip: '#legend .lg', lensTab: '#lensbar a', panelButton: '#panel-foot button, #panel-foot .u-chip', panelChip: '#panel-body .u-chip', tile: '.tile', repoChip: '.tb-repos .u-chip', catHeading: '.tb-cat h3', foldSummary: 'details summary', more: '.u-more' }; const t = {}; let smallest = null; for (const [n, s] of Object.entries(sels)) { let mn = null; for (const e of document.querySelectorAll(s)) { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; const m = Math.round(Math.min(r.width, r.height)); if (!mn || m < mn.px) mn = { px: m, w: Math.round(r.width), h: Math.round(r.height) }; } if (mn) { t[n] = mn; if (!smallest || mn.px < smallest.px) smallest = { area: n, ...mn }; } }
      const ov = document.getElementById('overlay'), st = document.getElementById('stage').getBoundingClientRect(), tile = document.querySelector('#overlay .tile.focus'), P = document.getElementById('panel').getBoundingClientRect(); const tr = tile && tile.getBoundingClientRect();
      const lab = [...document.querySelectorAll('#labels span')].filter(s => !s.hidden).map(s => s.textContent);
      return { targets: t, smallest, overlayScrollTop: ov.scrollTop, tileTopInStage: tr ? Math.round(tr.top - st.top) : null, inBand: tr ? tr.top >= st.top && tr.bottom <= Math.min(st.bottom, P.top) : null, labels: lab.slice(0, 10), scrollWidth: document.documentElement.scrollWidth, innerWidth }; });
    say(`F-table-${width}`, f); await p.close();
  }
  if (want('G')) // G. the picker: which query parameters the public page reads (from its own source)
  {
    const p = await browser.newPage(); await p.goto('https://ventusltd.github.io/code-generator/', { waitUntil: 'load', timeout: 60000 });
    const g = await p.evaluate(() => { const src = [...document.scripts].map(s => s.textContent).join('\n'); return { params: [...new Set((src.match(/\.get\(['"][a-z_]+['"]\)/g) || []))], workflow: (src.match(/gh workflow run[^`\n]*/g) || []).slice(0, 2), extScripts: [...document.scripts].map(s => s.src).filter(Boolean) }; });
    say('G-picker', g); await p.close();
  }

  if (want('H')) // H. legend kind toggle vs chord geometry; which <summary> is 21 px at 430; Open-in menu switch keeps state
  {
    const p = await open('?lens=chord&key=block:Gc', 1440);
    const g0 = await p.evaluate(() => ({ geom: window.__star.G.geomCount, kindsOn: window.__star.state.kindsOn, viewKinds: window.__star.view.kindsOn }));
    await p.evaluate(() => [...document.querySelectorAll('#legend .lg')].find(b => b.textContent.trim() === 'depends on').click()); await sleep(500);
    const g1 = await p.evaluate(() => ({ geom: window.__star.G.geomCount, kindsOn: window.__star.state.kindsOn, viewKinds: window.__star.view.kindsOn, url: location.search }));
    await p.evaluate(() => document.querySelector('#panel-foot button').click()); await sleep(600);
    const g2 = await p.evaluate(() => ({ geom: window.__star.G.geomCount, kindsOn: window.__star.state.kindsOn, viewKinds: window.__star.view.kindsOn }));
    say('H-chord-kind-toggle', { beforeToggle: g0, afterToggle: g1, afterNavigate: g2, errors: p.__errors });
    await p.close();
    const q = await open('?lens=table', 430);
    const sums = await q.evaluate(() => [...document.querySelectorAll('#overlay summary')].map(s => ({ text: s.textContent, h: Math.round(s.getBoundingClientRect().height), parentClass: s.parentElement.className, matchedRule: s.matches('.tb-cat details summary') })));
    say('H-summaries-430', sums);
    await q.close();
    const r = await open('?lens=ring&key=family:80299&trail=block:Gc,family:80299&recipe=block:Si', 1440, { clearRecipe: true });
    await r.evaluate(() => [...document.querySelectorAll('#panel-foot .u-chip')].find(b => b.textContent.startsWith('Open in')).click()); await sleep(200);
    await r.evaluate(() => [...document.querySelectorAll('#panel-foot .open-in .menu a')].find(a => a.textContent === 'column').click()); await sleep(1200);
    say('H-open-in-column', await r.evaluate(STATE));
    await r.close();
  }
} finally { await browser.close(); }
const prev = fs.existsSync(OUT + 'review2-report.json') ? JSON.parse(fs.readFileSync(OUT + 'review2-report.json', 'utf8')) : { checks: {} };
report.checks = { ...prev.checks, ...report.checks };
fs.writeFileSync(OUT + 'review2-report.json', JSON.stringify(report, null, 1));
console.log('written', OUT + 'review2-report.json');
