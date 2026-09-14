// Adversarial review round 1 — independent headless-Chrome measurements for testcode/202609142202.
// Runs against a local server on PORT (default 8877). All non-127.0.0.1 requests are intercepted,
// logged and ABORTED so the list of external hosts the page tries to reach is measured, not claimed.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.env.PORT || '8877';
const URL = `http://127.0.0.1:${PORT}/testcode/202609142202/index.html`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  headless: 'new', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--no-sandbox', '--window-size=1440,1000']
});
const R = { url: URL, puppeteer: require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core/package.json').version };
async function newPage(w, h, dpr, mobile) {
  const page = await browser.newPage(); const ext = [], errors = [];
  await page.setRequestInterception(true);
  page.on('request', req => { const u = req.url(); if (u.startsWith('http://127.0.0.1')) req.continue(); else { ext.push({ url: u, t: Date.now() }); req.abort(); } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') errors.push(t + ': ' + m.text()); });
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  return { page, ext, errors };
}
const hud = page => page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
const hudFind = async (page, re) => (await hud(page)).find(t => re.test(t)) || null;
const hudAll = async (page, re) => (await hud(page)).filter(t => re.test(t));

// electron-shell VBO: read the a_shell attribute buffer the moment the 512-vertex draw happens
const elecProbe = () => new Promise(res => {
  const gl = document.querySelector('#gl').getContext('webgl2'); const orig = gl.drawArrays; let done = false;
  gl.drawArrays = function (mode, first, count) {
    if (!done && count === 512) {
      done = true; const prog = gl.getParameter(gl.CURRENT_PROGRAM);
      const ls = gl.getAttribLocation(prog, 'a_shell'), li = gl.getAttribLocation(prog, 'a_i');
      const buf = gl.getVertexAttrib(ls, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING); const prev = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); const out = new Float32Array(512 * 2); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out); gl.bindBuffer(gl.ARRAY_BUFFER, prev);
      const shells = {}; for (let i = 0; i < 512; i++) { const s = out[i * 2 + 1]; shells[s] = (shells[s] || 0) + 1; }
      const counts = gl.getUniform(prog, gl.getUniformLocation(prog, 'u_counts')); const stride = gl.getUniform(prog, gl.getUniformLocation(prog, 'u_stride'));
      gl.drawArrays = orig;
      res({ a_i_loc: li, a_shell_loc: ls, a_shell_value_histogram: shells, u_counts_KLM: Array.from(counts), u_stride: stride, draw: { mode, first, count } });
    }
    return orig.call(gl, mode, first, count);
  };
  setTimeout(() => { if (!done) { gl.drawArrays = orig; res({ error: 'no 512-vertex draw seen in 2 s' }); } }, 2000);
});
// pixels in annuli around the sphere centre (drawing buffer is preserved): counts of "bright" pixels
const annuli = () => {
  const { G } = window.__qts; const gl = document.querySelector('#gl').getContext('webgl2'); const r = G.sphereR; const cx = G.c0[0], cy = G.c0[1];
  const half = Math.ceil(r * 1.4); const x0 = Math.round(cx - half), y0 = Math.round(G.H - cy - half); const w = 2 * half, h = 2 * half;
  const px = new Uint8Array(w * h * 4); gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const bands = { K_0p50_0p60: [0.50, 0.60], L_0p80_0p90: [0.80, 0.90], M_1p20_1p30: [1.20, 1.30] }; const out = {};
  for (const [k, [a, b]] of Object.entries(bands)) { let n = 0, tot = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = (x0 + i) - cx, dy = (G.H - (y0 + j)) - cy; const d = Math.hypot(dx, dy) / r; if (d >= a && d < b) { tot++; const o = (j * w + i) * 4; if (Math.max(px[o], px[o + 1], px[o + 2]) > 70) n++; } } out[k] = { bright: n, pixels: tot }; }
  return { sphereR_px: r, ...out };
};

try {
  // ---------------- desktop ----------------
  const { page, ext, errors } = await newPage(1440, 1000, 1, false);
  const cdp = await page.createCDPSession(); await cdp.send('HeapProfiler.enable');
  const gc = () => cdp.send('HeapProfiler.collectGarbage');
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(5000);
  const d = R.desktop = {};
  d.hud0 = await hud(page); d.count = await page.evaluate(() => document.querySelector('#count').textContent);
  d.externalRequestsDuringLoad = ext.slice();
  d.gpu = await page.evaluate(() => ({ seaBytes: window.__qts.S.seaBytes, seaDrawn: window.__qts.S.seaDrawn, stride: window.__qts.S.seaStride, drawCalls: window.__qts.S.lastDrawCalls, DPR: window.__qts.DPR }));
  // electron shells: buffer contents + pixels, for the default atom (#2039 K0 L40 M20)
  d.elec_2039 = { atom: await page.evaluate(() => { const a = window.__qts.S.atom; return { n: a.n, name: a.name, shells: a.shells }; }), buffer: await page.evaluate(elecProbe), annuli: await page.evaluate(annuli) };
  // walk to an atom with K>0 and repeat
  await page.click('body'); await page.keyboard.press('ArrowRight'); await sleep(600);
  d.elec_next = { atom: await page.evaluate(() => { const a = window.__qts.S.atom; return { n: a.n, name: a.name, shells: a.shells }; }), buffer: await page.evaluate(elecProbe), annuli: await page.evaluate(annuli) };
  await page.keyboard.press('ArrowLeft'); await sleep(300);
  // per-frame CPU (idle, 15 s): TaskDuration/ScriptDuration deltas and rAF gaps
  await gc(); const m0 = await page.metrics(); const t0 = Date.now();
  const raf = await page.evaluate(() => new Promise(res => { const g = []; let last = performance.now(); let n = 0; const f = t => { g.push(t - last); last = t; if (++n < 600) requestAnimationFrame(f); else res(g); }; requestAnimationFrame(f); }));
  await sleep(4000); await gc(); const m1 = await page.metrics(); const secs = (Date.now() - t0) / 1000;
  const sorted = raf.slice().sort((a, b) => a - b);
  d.idle = { seconds: +secs.toFixed(1), frames_sampled: raf.length, raf_gap_ms: { mean: +(raf.reduce((a, b) => a + b, 0) / raf.length).toFixed(2), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2), max: +sorted[sorted.length - 1].toFixed(2) },
    taskDuration_s: +(m1.TaskDuration - m0.TaskDuration).toFixed(3), scriptDuration_s: +(m1.ScriptDuration - m0.ScriptDuration).toFixed(3), cpu_ms_per_frame_est: +((m1.TaskDuration - m0.TaskDuration) * 1000 / (secs * 60)).toFixed(2),
    heap_before: m0.JSHeapUsedSize, heap_after: m1.JSHeapUsedSize, nodes_before: m0.Nodes, nodes_after: m1.Nodes, listeners_before: m0.JSEventListeners, listeners_after: m1.JSEventListeners };
  // measure 'Number' → external requests fired automatically
  const extBefore = ext.length;
  await page.click('#search'); await page.type('#search', 'Number'); await page.keyboard.press('Enter'); await sleep(300); await page.keyboard.press('Enter'); await sleep(1500);
  d.afterMeasure = { born: await hudFind(page, /^Born/), twin: await hudFind(page, /^twin/), cable: await hudFind(page, /^cable/), state: await hudFind(page, /^state/) };
  d.externalRequestsAfterOneMeasurement = ext.slice(extBefore).map(e => e.url);
  // 25 more via the button
  const extBefore2 = ext.length; for (let i = 0; i < 25; i++) { await page.click('#measure'); await sleep(40); } await sleep(1500);
  d.externalRequestsAfter25More = ext.slice(extBefore2).length; d.externalHosts = [...new Set(ext.map(e => new globalThis.URL(e.url).host))];
  d.histogram = await hudFind(page, /^histogram/);
  // heap growth under 300 rapid measurements (external aborted so this is loop + DOM cost only)
  await gc(); const h0 = await page.metrics();
  for (let i = 0; i < 300; i++) { await page.click('#measure'); }
  await sleep(2000); await gc(); const h1 = await page.metrics();
  d.measure300 = { heap_before: h0.JSHeapUsedSize, heap_after: h1.JSHeapUsedSize, nodes_before: h0.Nodes, nodes_after: h1.Nodes, listeners_before: h0.JSEventListeners, listeners_after: h1.JSEventListeners,
    measurements: await page.evaluate(() => window.__qts.S.measurements.length), recordChips: await page.evaluate(() => document.querySelectorAll('#record button').length), extRequestsTotal: ext.length };
  // hand-prepared measurement: state line vs Born line
  await page.evaluate(() => { window.__qts.S.hand = { theta: 2.6, phi: 1.0 }; }); await page.click('#measure'); await sleep(300);
  d.handMeasure = { state: await hudFind(page, /^state/), born: await hudFind(page, /^Born/), S: await page.evaluate(() => ({ theta: window.__qts.S.theta, dataTheta: window.__qts.S.dataTheta, hand: window.__qts.S.hand, outcome: window.__qts.S.outcome })) };
  // resize while collapsed: does the chosen twin survive?
  d.resizeAfterCollapse = { before: await page.evaluate(() => ({ outcome: window.__qts.S.outcome, chosen: window.__qts.S.twin.chosen && window.__qts.S.twin.chosen.label, tetherDissolved: window.__qts.S.tetherDissolved })) };
  await page.setViewport({ width: 1300, height: 900, deviceScaleFactor: 1 }); await sleep(500);
  d.resizeAfterCollapse.after = await page.evaluate(() => ({ outcome: window.__qts.S.outcome, chosen: window.__qts.S.twin.chosen && window.__qts.S.twin.chosen.label, collapseT: window.__qts.S.collapseT, twinNote: window.__qts.S.twinNote }));
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 }); await sleep(9000); // let re-prepare pass
  // SOUL tier (#766 geometry via the band: index 3) — record twin note per outcome
  await page.click('body'); for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await sleep(150); }
  d.soul = { atom: await page.evaluate(() => { const a = window.__qts.S.atom; return { n: a.n, name: a.name, shells: a.shells, valence_repos: a.valence_repos }; }), tierBefore: await hudFind(page, /^twin/), runs: [] };
  for (let i = 0; i < 6; i++) { await page.click('#measure'); await sleep(120); d.soul.runs.push({ born: (await hudFind(page, /^Born/) || '').slice(0, 60), twin: await hudFind(page, /^twin/), litRepo: await page.evaluate(() => window.__qts.S.litRepo), chosen: await page.evaluate(() => window.__qts.S.twin.chosen) }); }
  // pick on the twin star (instance 1) at the mirrored focused-family position
  const pt = await page.evaluate(() => { const { S, G, familyPos, DPR } = window.__qts; const p = familyPos(S.famIdx); const c = document.querySelector('#gl').getBoundingClientRect(); return { x: c.left + (G.c1[0] - p[0] * G.R) / DPR, y: c.top + (G.c1[1] - p[1] * G.R) / DPR, famIdx: S.famIdx }; });
  await page.evaluate(() => { document.querySelector('#hud').style.pointerEvents = 'none'; }); await page.mouse.click(pt.x, pt.y); await sleep(400);
  d.twinPick = { point: pt, msg: await page.evaluate(() => window.__qts.S.msg) };
  await page.screenshot({ path: OUT + 'review1-desktop.png' });
  d.errors = errors; await page.close();

  // ---------------- phone: 430×900, DPR 2, touch ----------------
  const P = await newPage(430, 900, 2, true); const pg = P.page;
  await pg.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(5000);
  const m = R.mobile = {};
  m.hud = await hud(pg); m.count = await pg.evaluate(() => document.querySelector('#count').textContent);
  m.scrollWidth = await pg.evaluate(() => document.documentElement.scrollWidth);
  m.gpu = await pg.evaluate(() => ({ seaBytes: window.__qts.S.seaBytes, seaDrawn: window.__qts.S.seaDrawn, stride: window.__qts.S.seaStride, drawCalls: window.__qts.S.lastDrawCalls, DPR: window.__qts.DPR, canvas: [document.querySelector('#gl').width, document.querySelector('#gl').height], phoneMode: window.__qts.S.phoneMode }));
  m.layout = await pg.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; }; const { G, DPR } = window.__qts; return { stage: r('#stage'), hud: r('#hud'), hudCollapsed: document.querySelector('#hud').classList.contains('collapsed'), sphereHandle: r('#sphereHandle'), c0_css: G.c0.map(v => v / DPR), c1_css: G.c1.map(v => v / DPR), R_css: G.R / DPR, sphereR_css: G.sphereR / DPR, labels: Array.from(document.querySelectorAll('#labels .lb')).map(l => { const b = l.getBoundingClientRect(); return { text: l.textContent.slice(0, 40), l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), w: Math.round(b.width) }; }) }; });
  const fps0 = await hudFind(pg, /^fps/); await sleep(2000); m.fpsLine = await hudFind(pg, /^fps/); m.fpsLine0 = fps0;
  // touch: tap the sphere handle → measure; horizontal swipe on the canvas → walk band
  m.touch = {};
  try {
    const sh = m.layout.sphereHandle; await pg.touchscreen.tap(sh.l + sh.w / 2, sh.t + sh.h / 2); await sleep(400);
    m.touch.tapSphere = { born: await hudFind(pg, /^Born/) };
    const st = m.layout.stage; const y = st.t + st.h * 0.62, x0 = st.l + 300, x1 = st.l + 120; // in the lower (twin) half, away from the handle
    await pg.touchscreen.touchStart(x0, y); for (let i = 1; i <= 6; i++) await pg.touchscreen.touchMove(x0 + (x1 - x0) * i / 6, y); await pg.touchscreen.touchEnd(); await sleep(400);
    m.touch.swipe = { msg: await pg.evaluate(() => window.__qts.S.msg), bandPos: await pg.evaluate(() => window.__qts.S.bandPos) };
  } catch (e) { m.touch.error = e.message; }
  m.hudAfter = await hud(pg);
  await pg.screenshot({ path: OUT + 'review1-mobile-dpr2.png' });
  m.externalHosts = [...new Set(P.ext.map(e => new globalThis.URL(e.url).host))]; m.errors = P.errors; await pg.close();
} catch (e) { R.error = e.stack; }
await browser.close();
fs.writeFileSync(OUT + 'review1_report.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
