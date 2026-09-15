// Star Generator GPU bench (owner decides offline from these measurements).
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/bench.mjs [port]
// Serve the repository root first: python -m http.server <port> --bind 127.0.0.1  (from globalgrid2050/).
// For each lens at 1440x900 (mouse) and 430x900 (touch emulation, devicePixelRatio 2 — the page caps dpr at 2, as a phone would hit):
//   WebGL renderer string, instances drawn per frame, time to first GL draw, fps mean + frame-time p95 over 4 s idle and 4 s
//   while panning/tapping, document scrollWidth, smallest tap target among the key hit areas, JS heap, console errors,
//   nvidia-smi utilisation + memory sampled every second (idle baseline before Chrome, then per phase).
// Then the coordination test (search #80299 in ring, switch lenses, screenshot proof/coord-<lens>-<width>.png) and the
// compose test at 430 by touch (add #80299 and block Vd, read the hand-off URL and the recipe JSON from the tray/sheet).
// Results: proof/bench.json, proof/bench-table.md, proof/bench-*.png, proof/coord-*.png, proof/compose-*.png.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8884', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const LENSES = ['ring', 'particle', 'chord', 'river', 'table', 'column'], WIDTHS = [1440, 430];
const KEYQ = '&key=family:80299&trail=block:Gc,family:80299';   // one state for every lens: a family focus with its block open and a journey
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ARGS = ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run', '--enable-precise-memory-info'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
const log = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(OUT + 'bench.log', s + '\n'); };
fs.writeFileSync(OUT + 'bench.log', '');

/* ---------- nvidia-smi sampler (1 Hz) ---------- */
const gpu = { samples: [], proc: null };
function startGpu() {
  const p = spawn('nvidia-smi', ['--query-gpu=timestamp,utilization.gpu,utilization.memory,memory.used,memory.total', '--format=csv,noheader,nounits', '-l', '1']);
  let buf = ''; p.stdout.on('data', d => { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); for (const l of lines) { const m = l.split(',').map(s => s.trim()); if (m.length >= 5 && /^\d/.test(m[1])) gpu.samples.push({ t: Date.now(), ts: m[0], util: +m[1], memUtil: +m[2], mem: +m[3], total: +m[4] }); } });
  p.stderr.on('data', d => log('nvidia-smi stderr:', String(d).trim())); gpu.proc = p;
}
function gpuWindow(t0, t1) {
  const s = gpu.samples.filter(x => x.t >= t0 && x.t <= t1); if (!s.length) return { n: 0 };
  const u = s.map(x => x.util), m = s.map(x => x.mem);
  return { n: s.length, utilMean: r1(mean(u)), utilMax: Math.max(...u), memMeanMiB: Math.round(mean(m)), memMaxMiB: Math.max(...m), totalMiB: s[0].total };
}

/* ---------- in-page instrumentation, installed before any script of the page runs ---------- */
const INSTRUMENT = () => {
  const B = window.__bench = { firstDraw: null, draws: 0, inst: 0, countAt: null, packAt: null, namesAt: null, frameMs: [] };
  const wrap = (proto, name, n) => { const orig = proto[name]; proto[name] = function (...a) { if (B.firstDraw == null) B.firstDraw = performance.now(); B.draws++; B.inst += n(a); return orig.apply(this, a); }; };
  wrap(WebGL2RenderingContext.prototype, 'drawArraysInstanced', a => a[3]);
  wrap(WebGL2RenderingContext.prototype, 'drawArrays', a => a[2]);
  const poll = setInterval(() => {
    const c = document.getElementById('count'); if (B.countAt == null && c && /blocks on the table/.test(c.textContent)) B.countAt = performance.now();
    const S = window.__star; if (S) { if (B.packAt == null && S.core.packLoaded && S.core.packLoaded()) B.packAt = performance.now(); if (B.namesAt == null && S.core.U.names) B.namesAt = performance.now(); }
    if (B.countAt != null && B.packAt != null && B.namesAt != null) clearInterval(poll);
  }, 4);
  window.__measure = ms => new Promise(res => {
    const dts = []; let last = null, t0 = null; const d0 = B.draws, i0 = B.inst, g0 = window.__star ? window.__star.G.frames : 0, f0 = B.frameMs.length;
    function f(t) { if (t0 == null) t0 = t; if (last != null) dts.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else { const el = t - t0, sorted = dts.slice().sort((a, b) => a - b), g1 = window.__star ? window.__star.G.frames : 0; const fm = B.frameMs.slice(f0).sort((a, b) => a - b); res({ frames: dts.length, elapsedMs: Math.round(el), fpsMean: Math.round(dts.length / (el / 1000) * 10) / 10, ftMeanMs: Math.round(el / dts.length * 100) / 100, ftP95Ms: Math.round(sorted[Math.floor(0.95 * (sorted.length - 1))] * 100) / 100, ftMaxMs: Math.round(sorted[sorted.length - 1] * 100) / 100, over24ms: dts.filter(x => x > 24).length, drawCallsPerFrame: g1 > g0 ? Math.round((B.draws - d0) / (g1 - g0) * 10) / 10 : null, instancesPerFrame: g1 > g0 ? Math.round((B.inst - i0) / (g1 - g0)) : null, appFrames: g1 - g0, glSubmitMeanMs: fm.length ? Math.round(fm.reduce((s, x) => s + x, 0) / fm.length * 100) / 100 : null, glSubmitP95Ms: fm.length ? Math.round(fm[Math.floor(0.95 * (fm.length - 1))] * 100) / 100 : null, glSubmitMaxMs: fm.length ? Math.round(fm[fm.length - 1] * 100) / 100 : null }); } }
    requestAnimationFrame(f);
  });
};

const FACTS = () => {
  const S = window.__star, G = S.G, B = window.__bench, r1 = x => x == null ? null : Math.round(x * 10) / 10;
  if (!G.__timed) { const orig = G.frame; G.frame = function () { const t = performance.now(); const r = orig.apply(this, arguments); B.frameMs.push(performance.now() - t); return r; }; G.__timed = true; }   // CPU-side time of the page's own G.frame(): JS + GL command submission, not vsync-capped
  const gl = document.getElementById('gl').getContext('webgl2'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'no webgl2';
  const vendor = gl ? (ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)) : null;
  const sels = { search: '.u-search', crumb: '#trail a', legendChip: '#legend .lg', lensTab: '#lensbar a', panelButton: '#panel-foot button, #panel-foot .u-chip', trayGo: '#tray .go', trayRemove: '#tray .rc button', panelChip: '#panel-body .u-chip', tile: '.tile', card: '.card', columnSeg: '.col .seg button', repoChip: '.tb-repos .u-chip', catHeading: '.tb-cat h3', foldSummary: 'details summary', more: '.u-more' };
  const targets = {}; let smallest = null;
  for (const [name, sel] of Object.entries(sels)) { let mn = null; for (const e of document.querySelectorAll(sel)) { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; const m = Math.round(Math.min(r.width, r.height)); if (mn == null || m < mn.px) mn = { px: m, w: Math.round(r.width), h: Math.round(r.height), text: (e.textContent || e.placeholder || '').trim().slice(0, 30) }; } if (mn) { targets[name] = mn; if (!smallest || mn.px < smallest.px) smallest = { area: name, ...mn }; } }
  const pm = performance.memory ? { usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10, totalJSHeapMB: Math.round(performance.memory.totalJSHeapSize / 1048576 * 10) / 10 } : null;
  return { renderer, vendor, glVersion: gl ? gl.getParameter(gl.VERSION) : null, firstDrawMs: r1(B.firstDraw), countSentenceMs: r1(B.countAt), packLoadedMs: r1(B.packAt), namesLoadedMs: r1(B.namesAt), url: location.search, count: document.getElementById('count').textContent, countTitle: document.getElementById('count').title,
    N: G.N, edgeInstances: G.edgeCount, geometryInstances: G.geomCount, journeyInstances: G.journeyCount, lineInstances: G.linesCount, lineBytes: G.linesBytes, canvasPx: [document.getElementById('gl').width, document.getElementById('gl').height], dpr: devicePixelRatio, framesSoFar: G.frames, litOnly: G.litOnly,
    scrollWidth: document.documentElement.scrollWidth, innerWidth, targets, smallestTap: smallest, memory: pm, panelHead: (document.querySelector('#panel .u-h') || {}).textContent || null, packStats: S.core.packStats, footer: document.getElementById('footer').textContent };
};

/* ---------- interaction while measuring: drags (pan / rotate / scroll the overlay) and taps on the stage ---------- */
async function interact(page, mobile, rect, ms) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, end = Date.now() + ms; let k = 0; const acts = [];
  const drag = async (x0, y0, x1, y1) => { if (mobile) { await page.touchscreen.touchStart(x0, y0); for (let s = 1; s <= 10; s++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * s / 10, y0 + (y1 - y0) * s / 10); await sleep(16); } await page.touchscreen.touchEnd(); } else { await page.mouse.move(x0, y0); await page.mouse.down(); for (let s = 1; s <= 10; s++) { await page.mouse.move(x0 + (x1 - x0) * s / 10, y0 + (y1 - y0) * s / 10); await sleep(16); } await page.mouse.up(); } acts.push('drag'); };
  const tap = async (x, y) => { if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); acts.push('tap'); };
  while (Date.now() < end) {
    const d = k % 2 ? -1 : 1;
    await drag(cx - 90 * d, cy - 20 * d, cx + 90 * d, cy + 60 * d); await sleep(120);
    if (!mobile) { await page.mouse.move(cx, cy); await page.mouse.wheel({ deltaY: 240 * d }); acts.push('wheel'); await sleep(120); }
    await tap(cx + 50 * d, cy - 40 * d); await sleep(420);   // > 300 ms apart so two taps never read as a double-tap (home)
    k++;
  }
  return acts;
}

/* ---------- one lens at one width ---------- */
async function benchLens(browser, lens, width) {
  const mobile = width <= 600; const name = `${lens}-${width}`; const rec = { lens, width, mobile, errors: [], warnings: [], pageErrors: [], failedRequests: [] };
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await page.evaluateOnNewDocument(INSTRUMENT);
  page.on('console', m => { if (m.type() === 'error') rec.errors.push(m.text()); else if (m.type() === 'warning') rec.warnings.push(m.text()); });
  page.on('pageerror', e => rec.pageErrors.push(String(e.message))); page.on('requestfailed', r => rec.failedRequests.push(r.url()));
  const tLoad0 = Date.now();
  await page.goto(BASE + `?lens=${lens}${KEYQ}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__star && window.__star.core.packLoaded(), { timeout: 90000 }).catch(() => rec.errors.push('pack never loaded'));
  await page.waitForFunction(() => window.__star.core.U.names, { timeout: 60000 }).catch(() => rec.warnings.push('names never loaded'));
  await page.waitForFunction(() => !document.getElementById('panel').hidden && document.querySelector('#panel-foot button'), { timeout: 60000 }).catch(() => rec.warnings.push('panel foot never rendered'));
  await sleep(1500);   // tween (600 ms) and the panel's family bucket
  const tLoad1 = Date.now();
  Object.assign(rec, await page.evaluate(FACTS));
  rec.metricsAfterLoad = await page.metrics().then(m => ({ JSHeapUsedMB: r1(m.JSHeapUsedSize / 1048576), JSHeapTotalMB: r1(m.JSHeapTotalSize / 1048576), Nodes: m.Nodes })).catch(() => null);
  await page.screenshot({ path: OUT + `bench-${name}.png` });
  const tIdle0 = Date.now(); rec.idle = await page.evaluate(() => window.__measure(4000)); const tIdle1 = Date.now();
  const rect = await page.evaluate(() => { const r = document.getElementById('gl').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const tAct0 = Date.now(); const pm = page.evaluate(() => window.__measure(4000)); await sleep(60); rec.actions = await interact(page, mobile, rect, 3800); rec.active = await pm; const tAct1 = Date.now();
  rec.afterInteraction = await page.evaluate(() => { const S = window.__star, G = S.G; return { url: location.search, focus: S.state.focus >= 0 ? S.core.keyStr[S.state.focus] : null, litOnly: G.litOnly, view: { pan: G.view.pan.map(Math.round), zoom: Math.round(G.view.zoom * 100) / 100, rotate: Math.round(G.view.rotate * 100) / 100 }, scrollWidth: document.documentElement.scrollWidth, memory: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null }; });
  await page.screenshot({ path: OUT + `bench-${name}-after.png` });
  await page.close(); await sleep(1200);
  rec.gpu = { load: gpuWindow(tLoad0, tLoad1), idle: gpuWindow(tIdle0, tIdle1), active: gpuWindow(tAct0, tAct1) };
  log(name, { renderer: rec.renderer, firstDraw: rec.firstDrawMs, pack: rec.packLoadedMs, inst: rec.idle.instancesPerFrame, idle: [rec.idle.fpsMean, rec.idle.ftP95Ms], active: [rec.active.fpsMean, rec.active.ftP95Ms], scrollWidth: rec.scrollWidth, tap: rec.smallestTap, mem: rec.memory, errors: rec.errors.length, gpu: rec.gpu });
  return rec;
}

/* ---------- coordination test: #80299 in ring, then every other lens keeps the key selected and visible ---------- */
const VISIBLE = () => {
  const S = window.__star, G = S.G, i = S.state.focus, st = document.getElementById('stage').getBoundingClientRect();
  const p = i >= 0 ? G.curPos(i) : null; let onCanvas = null; if (p) { const [x, y] = G.toScreen(p[0], p[1]); onCanvas = { x: Math.round(x), y: Math.round(y), inside: x >= 0 && x <= G.w && y >= 0 && y <= G.h }; }
  const ov = document.querySelector('#overlay .tile.focus, #overlay .card.focus'); let overlay = null; if (ov) { const r = ov.getBoundingClientRect(); overlay = { text: ov.textContent.trim().slice(0, 40), inside: r.bottom > st.top && r.top < st.bottom && r.right > st.left && r.left < st.right }; }
  const lab = [...document.querySelectorAll('#labels span')].find(s => !s.hidden && s.textContent === '#80299');
  const ovEl = document.getElementById('overlay');
  return { lens: S.state.lens, focusKey: i >= 0 ? S.core.keyStr[i] : null, url: location.search, panelHead: (document.querySelector('#panel .u-h') || {}).textContent || null, onCanvas, overlayFocus: overlay, labelShown: !!lab, edges: G.edgeCount, scrollWidth: document.documentElement.scrollWidth, pageScrollY: Math.round(scrollY), stageTop: Math.round(st.top), stageH: Math.round(st.height), overlayScrollTop: ovEl.hidden ? null : Math.round(ovEl.scrollTop), overlayScrollHeight: ovEl.hidden ? null : ovEl.scrollHeight, focusTileTopInStage: ov ? Math.round(ov.getBoundingClientRect().top - st.top) : null, viewPan: G.view.pan.map(Math.round) };
};
async function coordination(browser, width) {
  const mobile = width <= 600; const out = { width, steps: [], errors: [] };
  const page = await browser.newPage(); await page.setViewport({ width, height: 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  page.on('console', m => { if (m.type() === 'error') out.errors.push(m.text()); }); page.on('pageerror', e => out.errors.push('pageerror: ' + e.message));
  await page.goto(BASE + '?lens=ring', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__star && window.__star.core.packLoaded() && window.__star.core.U.names, { timeout: 90000 });
  const tapEl = async sel => { const r = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel); if (!r) throw new Error('no element ' + sel); if (mobile) await page.touchscreen.tap(r.x, r.y); else await page.mouse.click(r.x, r.y); };
  await tapEl('.u-search'); await page.keyboard.type('#80299'); await sleep(300);
  out.hits = await page.evaluate(() => [...document.querySelectorAll('.u-hits .u-chip, .u-hits .u-muted')].map(e => e.textContent));
  await tapEl('.u-hits .u-chip');   // the first hit: family:80299
  await page.waitForFunction(() => document.querySelector('#panel-foot button'), { timeout: 60000 }).catch(() => out.errors.push('panel foot never rendered in ring'));
  await sleep(1400);
  const ring = await page.evaluate(VISIBLE); ring.haversineSelected = /haversine/.test(ring.panelHead || '') && ring.focusKey === 'family:80299'; out.steps.push(ring);
  await page.screenshot({ path: OUT + `coord-ring-${width}.png` });
  for (const lens of LENSES.slice(1)) {
    await tapEl(`#lensbar a:nth-child(${LENSES.indexOf(lens) + 1})`); await sleep(1600);   // 600 ms tween + smooth scrollTo in the overlay lenses
    const s = await page.evaluate(VISIBLE); s.sameKey = s.focusKey === 'family:80299' && /key=family%3A80299|key=family:80299/.test(s.url); s.visible = !!((s.onCanvas && s.onCanvas.inside) || (s.overlayFocus && s.overlayFocus.inside)); out.steps.push(s);
    await page.screenshot({ path: OUT + `coord-${lens}-${width}.png` });
  }
  await page.close();
  log(`coordination ${width}`, out.steps.map(s => `${s.lens}: key=${s.focusKey} canvas=${s.onCanvas ? s.onCanvas.inside : '-'} overlay=${s.overlayFocus ? s.overlayFocus.inside : '-'} label=${s.labelShown}`));
  return out;
}

/* ---------- compose test at 430 by touch ---------- */
async function compose(browser) {
  const ctx = await browser.createBrowserContext();   // fresh localStorage: no recipe carried over
  const page = await ctx.newPage(); await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const out = { errors: [], steps: [] }; page.on('console', m => { if (m.type() === 'error') out.errors.push(m.text()); }); page.on('pageerror', e => out.errors.push('pageerror: ' + e.message));
  await page.goto(BASE + '?lens=ring', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__star && window.__star.core.packLoaded() && window.__star.core.U.names, { timeout: 90000 });
  await page.evaluate(() => { window.__clip = null; Object.defineProperty(navigator.clipboard, 'writeText', { value: t => { window.__clip = t; return Promise.resolve(); }, configurable: true }); });
  // a person scrolls the target into view before tapping: after a key opens, the page scrolls the stage to the top and the search box sits above the fold (measured: scrollBeforeTap)
  const tapEl = async (sel, text) => { const r = await page.evaluate((s, t) => { const es = [...document.querySelectorAll(s)]; const e = t ? es.find(x => x.textContent.trim() === t) : es[0]; if (!e) return null; const before = e.getBoundingClientRect().top; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height, topBeforeScroll: Math.round(before) }; }, sel, text || null); if (!r) throw new Error('no element ' + sel + ' ' + (text || '')); await page.touchscreen.tap(r.x, r.y); return r; };
  const add = async q => {
    const sr = await tapEl('.u-search'); out.steps.push({ note: `search box top before scrolling for "${q}"`, topBeforeScroll: sr.topBeforeScroll }); await page.keyboard.type(q); await sleep(300);
    const hit = await page.evaluate(() => (document.querySelector('.u-hits .u-chip') || {}).textContent || null); await tapEl('.u-hits .u-chip');
    await page.waitForFunction(() => [...document.querySelectorAll('#panel-foot button')].some(b => b.textContent === 'Add to recipe'), { timeout: 60000 });
    await sleep(300); const btn = await tapEl('#panel-foot button', 'Add to recipe'); await sleep(400);
    const st = await page.evaluate(() => ({ recipe: window.__star.state.recipe.slice(), tray: document.getElementById('tray').textContent, url: location.search, panelHead: (document.querySelector('#panel .u-h') || {}).textContent }));
    out.steps.push({ query: q, hit, addButtonPx: [Math.round(btn.w), Math.round(btn.h)], ...st }); log('compose add', q, st);
  };
  await add('#80299'); await add('Vd');
  await page.screenshot({ path: OUT + 'compose-430.png' });
  await tapEl('#tray .cnt'); await sleep(500);
  out.sheetText = await page.evaluate(() => document.getElementById('sheet').innerText);
  out.handOffFromSheet = (out.sheetText.match(/https:\/\/ventusltd\.github\.io\/code-generator\/\S+/) || [null])[0];
  out.handOffFromApi = await page.evaluate(() => window.__star.handOffURL());
  await tapEl('#sheet button', 'Copy recipe'); await sleep(2500);
  out.clip = await page.evaluate(() => window.__clip);
  out.copyButtonText = await page.evaluate(() => [...document.querySelectorAll('#sheet button')].map(b => b.textContent).filter(t => /cop/i.test(t)));
  await page.screenshot({ path: OUT + 'compose-sheet-430.png' });
  try { out.recipe = JSON.parse(out.clip); } catch (e) { out.recipe = null; out.errors.push('recipe JSON from the sheet did not parse: ' + e.message); }
  const j = out.recipe;
  out.checks = j ? { keysHave80299: j.keys.includes('family:80299'), keysHaveVd: j.keys.includes('block:Vd'), blocks: j.blocks.map(b => `${b.symbol}@${(b.files[0] || {}).commit ? b.files[0].commit.slice(0, 7) : 'no pinned place'}`), families: j.families.map(f => `${f.n} ${f.name || ''} → ${f.place ? `${f.place.repo}@${f.place.commit.slice(0, 7)} ${f.place.path}#L${f.place.first}-L${f.place.last}` : f.note}`), everyBlockPinned: j.blocks.every(b => b.files.length && b.files.every(f => /^[0-9a-f]{7,40}$/.test(String(f.commit)))), familyPinned: j.families.every(f => f.place && /^[0-9a-f]{7,40}$/.test(f.place.commit)), urlHasVd: /blocks=[^&]*\bVd\b/.test(out.handOffFromSheet || ''), urlHas80299: /families=[^&]*\b80299\b/.test(out.handOffFromSheet || ''), data: j.data, needs: j.needs.length } : null;
  await page.close(); await ctx.close();
  log('compose', { handOff: out.handOffFromSheet, checks: out.checks, errors: out.errors });
  return out;
}

/* ---------- main ---------- */
const report = { run_utc: new Date().toISOString(), base: BASE, chromeArgs: ARGS, note: 'mobile = 430x900, hasTouch, isMobile, deviceScaleFactor 2 (the page caps dpr at 2); desktop = 1440x900 dpr 1, mouse' };
startGpu(); log('sampling idle GPU for 10 s before Chrome…'); const tIdle0 = Date.now(); await sleep(10500); report.gpuIdleBeforeChrome = gpuWindow(tIdle0, Date.now());
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ARGS });
report.chrome = await browser.version();
{ const tb0 = Date.now(); await sleep(5500); report.gpuChromeBlank = gpuWindow(tb0, Date.now()); }
log('idle GPU before Chrome', report.gpuIdleBeforeChrome, 'Chrome open, blank', report.gpuChromeBlank, report.chrome);
const save = () => { report.gpuSamples = gpu.samples.length; fs.writeFileSync(OUT + 'bench.json', JSON.stringify(report, null, 1)); };
try {
  report.lenses = [];
  for (const width of WIDTHS) for (const lens of LENSES) { report.lenses.push(await benchLens(browser, lens, width)); save(); }
  report.coordination = []; for (const width of WIDTHS) { report.coordination.push(await coordination(browser, width)); save(); }
  try { report.compose = await compose(browser); } catch (e) { report.compose = { failed: String(e.message) }; log('compose failed', e.message); }
  save();
} finally { await browser.close(); gpu.proc && gpu.proc.kill(); }
save();

/* ---------- the table ---------- */
const rows = [['lens', 'width', 'renderer', 'first GL draw ms', 'pack loaded ms', 'instances / frame', 'draw calls / frame', 'idle fps', 'idle p95 ms', 'active fps', 'active p95 ms', 'frames >24 ms idle / active', 'G.frame() CPU ms mean / p95 idle', 'G.frame() CPU ms mean / p95 active', 'scrollWidth / innerWidth', 'smallest tap target px (area)', 'JS heap MB', 'console errors', 'GPU util % mean/max idle', 'GPU util % mean/max active', 'GPU mem MiB max (run)']];
for (const r of report.lenses) rows.push([r.lens, r.width, r.renderer, r.firstDrawMs, r.packLoadedMs, r.idle.instancesPerFrame, r.idle.drawCallsPerFrame, r.idle.fpsMean, r.idle.ftP95Ms, r.active.fpsMean, r.active.ftP95Ms, `${r.idle.over24ms} / ${r.active.over24ms}`, `${r.idle.glSubmitMeanMs} / ${r.idle.glSubmitP95Ms}`, `${r.active.glSubmitMeanMs} / ${r.active.glSubmitP95Ms}`, `${r.scrollWidth} / ${r.innerWidth}`, r.smallestTap ? `${r.smallestTap.px} (${r.smallestTap.area}: ${r.smallestTap.w}×${r.smallestTap.h})` : 'n/a', r.memory ? r.memory.usedJSHeapMB : (r.metricsAfterLoad || {}).JSHeapUsedMB, r.errors.length + r.pageErrors.length, r.gpu.idle.n ? `${r.gpu.idle.utilMean} / ${r.gpu.idle.utilMax}` : 'no sample', r.gpu.active.n ? `${r.gpu.active.utilMean} / ${r.gpu.active.utilMax}` : 'no sample', Math.max(r.gpu.load.memMaxMiB || 0, r.gpu.idle.memMaxMiB || 0, r.gpu.active.memMaxMiB || 0)]);
const md = rows.map((r, i) => '| ' + r.join(' | ') + ' |' + (i === 0 ? '\n|' + r.map(() => '---').join('|') + '|' : '')).join('\n');
fs.writeFileSync(OUT + 'bench-table.md', md + '\n');
log('\n' + md);
log('written', OUT + 'bench.json');
