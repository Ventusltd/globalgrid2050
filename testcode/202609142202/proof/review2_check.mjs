// Adversarial review round 2 — headless probe (puppeteer-core by absolute path, GPU flags as instructed).
// Starts its own python http.server on PORT from the repository root, stops it with taskkill /T /F.
// Every non-127.0.0.1 request is LOGGED. In the forged-bucket test the bucket and raw.githubusercontent URLs are
// intercepted and answered LOCALLY (request.respond) so nothing leaves the machine; the log says which.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = '8871';
const ROOT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050';
const URL = `http://127.0.0.1:${PORT}/testcode/202609142202/index.html`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { url: URL, started_utc: new Date().toISOString() };
const server = spawn('python', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', fs.openSync(OUT + 'review2_server.log', 'w'), fs.openSync(OUT + 'review2_server.log', 'a')] });
await sleep(1500);
const browser = await puppeteer.launch({
  headless: 'new', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--no-sandbox', '--window-size=1440,1000', '--enable-precise-memory-info']
});
async function newPage(w, h, dpr, mobile) {
  const page = await browser.newPage(); const ext = [], errors = [];
  page.on('request', req => { const u = req.url(); if (!u.startsWith('http://127.0.0.1')) ext.push({ url: u, t: Date.now() }); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') errors.push(t + ': ' + m.text()); });
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  return { page, ext, errors };
}
const hud = page => page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
const hudFind = async (page, re) => (await hud(page)).find(t => re.test(t)) || null;
const st = page => page.evaluate(() => { const S = window.__qts.S; return { theta: S.theta, outcome: S.outcome, born: S.born || null, msg: S.msg, hold: !!S.hold, phi: S.phi, hist: Object.fromEntries(S.hist), measurements: S.measurements.length, lastQuery: S.lastQuery }; });
const metrics = async (cdp) => { try { await cdp.send('HeapProfiler.collectGarbage'); } catch (e) { } const m = await cdp.send('Performance.getMetrics'); const o = {}; for (const x of m.metrics) if (['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'JSEventListeners', 'ScriptDuration', 'TaskDuration', 'Timestamp'].includes(x.name)) o[x.name] = x.value; return o; };
try {
  const { page, ext, errors } = await newPage(1440, 1000, 1, false);
  const cdp = await page.target().createCDPSession(); await cdp.send('Performance.enable'); await cdp.send('HeapProfiler.enable');
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(5000);
  const d = R.desktop = {};
  d.hudAtLoad = await hud(page);
  d.externalDuringLoad = ext.map(e => e.url);
  // ---- T2: per-frame GPU traffic and draw shape over 3 s idle ----
  d.glTraffic = await page.evaluate(() => new Promise(res => {
    const gl = document.querySelector('#gl').getContext('webgl2'); const { S } = window.__qts;
    const c = { bufferData: 0, bufferSubData: 0, texImage2D: 0, texSubImage2D: 0, readPixels: 0, frames: 0, seaDraws: 0, seaDrawShapes: new Set(), otherInstanced: 0, drawArrays: 0 };
    const w = (n) => { const o = gl[n]; gl[n] = function (...a) { c[n]++; return o.apply(gl, a); }; return () => { gl[n] = o; }; };
    const restores = ['bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'readPixels', 'drawArrays'].map(w);
    const odi = gl.drawArraysInstanced; gl.drawArraysInstanced = function (m, f, n, i) { if (n === S.seaDrawn) { c.seaDraws++; c.seaDrawShapes.add([m, f, n, i].join(',')); } else c.otherInstanced++; return odi.call(gl, m, f, n, i); };
    let raf; const tick = () => { c.frames++; raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick);
    setTimeout(() => { cancelAnimationFrame(raf); restores.forEach(r => r()); gl.drawArraysInstanced = odi; c.seaDrawShapes = [...c.seaDrawShapes]; res(c); }, 3000);
  }));
  // ---- T2b: JS CPU share over 10 s idle (CDP ScriptDuration / wall) ----
  { const a = await metrics(cdp); await sleep(10000); const b = await metrics(cdp); d.idleCpu = { seconds: b.Timestamp - a.Timestamp, scriptSeconds: b.ScriptDuration - a.ScriptDuration, taskSeconds: b.TaskDuration - a.TaskDuration, scriptShare: (b.ScriptDuration - a.ScriptDuration) / (b.Timestamp - a.Timestamp) }; }
  // ---- T3: heap / DOM over time ----
  d.heap = { t0_afterLoad: await metrics(cdp) };
  await sleep(45000); d.heap.t1_after45sIdle = await metrics(cdp);
  for (let i = 0; i < 150; i++) { await page.click('#reprepare'); await sleep(15); await page.click('#measure'); await sleep(15); }
  await sleep(1000); d.heap.t2_after150measurements = await metrics(cdp); d.heap.measurementsRecorded = (await st(page)).measurements; d.heap.recordChips = await page.evaluate(() => document.querySelectorAll('#record button').length);
  await sleep(30000); d.heap.t3_after30sMoreIdle = await metrics(cdp);
  d.heap.fpsLine = await hudFind(page, /^fps/);
  d.externalAfterHeapTests = ext.length;
  // ---- T4: failed search then Enter ----
  await page.click('#reprepare'); await sleep(100);
  const before4 = await st(page);
  await page.evaluate(() => { document.querySelector('#search').value = ''; }); await page.click('#search'); await page.type('#search', '#999999999'); await page.keyboard.press('Enter'); await sleep(200);
  const mid4 = await st(page); await page.keyboard.press('Enter'); await sleep(300); const after4 = await st(page);
  d.failedSearchThenEnter = { firstEnterMsg: mid4.msg, lastQueryAfterFirstEnter: mid4.lastQuery, measuredOnSecondEnter: after4.outcome >= 0 && after4.measurements > before4.measurements, outcomeAfter: after4.outcome, bornAfter: after4.born, measurementsBefore: before4.measurements, measurementsAfter: after4.measurements };
  // ---- T5: Enter while a button has keyboard focus ----
  await page.click('#reprepare'); await sleep(100); const before5 = await st(page);
  await page.focus('#hold'); await page.keyboard.press('Enter'); await sleep(300); const after5 = await st(page);
  d.enterOnHoldButton = { measurementsBefore: before5.measurements, measurementsAfter: after5.measurements, measured: after5.measurements > before5.measurements, holdBefore: before5.hold, holdAfter: after5.hold };
  if (after5.hold) { await page.click('#hold'); await sleep(50); }
  // ---- T6: φ text after collapse ----
  await page.click('#reprepare'); await sleep(100); await page.click('#measure'); await sleep(300);
  { const p1 = (await st(page)).phi; await sleep(1000); const p2 = (await st(page)).phi; d.phiAfterCollapse = { phi_t0: p1, phi_t1s: p2, phiChanged: p1 !== p2, stateLine: await hudFind(page, /^state/) }; }
  // ---- T12: record chip re-steer: join line present? ----
  { await page.click('#record button'); await sleep(200); d.chipResteer = { joinLine: await hudFind(page, /^join/), famJoinNote: await page.evaluate(() => window.__qts.S.famJoinNote), msg: await page.evaluate(() => window.__qts.S.msg) }; }
  // ---- T11: atom with maker AND stars edges: #15 renderStats ----
  { await page.evaluate(() => { document.querySelector('#search').value = ''; }); await page.click('#search'); await page.type('#search', '#15'); await page.keyboard.press('Enter'); await sleep(300);
    d.atom15 = await page.evaluate(() => { const { S, D } = window.__qts; const eds = D.random.edges.filter(ed => /^#15\s/.test(ed.from) || /^#15\s/.test(ed.to)); return { focus: S.atom && S.atom.n + ' ' + S.atom.name, tier: S.twin.tier, tierLabel: S.twin.tierLabel, candidates: S.twin.all.length, edgesTouching15: eds.length, edgesWithP: eds.filter(e => e.p != null).length, edgesWithoutP: eds.filter(e => e.p == null).length }; });
    d.atom15.hudTwinLine = await hudFind(page, /^twin/); }
  d.externalBeforeForgedBucket = ext.length;
  // ---- T7: forged bucket (answered locally) — does the page show numbers / line text from a sha256-mismatched record? ----
  await page.evaluate(() => { document.querySelector('#search').value = ''; }); await page.click('#search'); await page.type('#search', 'Number'); await page.keyboard.press('Enter'); await sleep(300);
  const intercepted = [];
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://127.0.0.1')) return req.continue();
    if (/\/code\/f\/12\.json/.test(u)) { intercepted.push({ url: u, answered: 'locally with a forged bucket' }); return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ '6076': { n: 6076, names: ['Number'], lines: [1, 2, 3], repos: ['forged-a', 'forged-b', 'forged-c'], places: [{ repo: 'Ventusltd/globalgrid2050', commit: '1a382b71b99cdf3592f15024aabab244ba6fc31e', path: 'scripts/build_news_feed_v9_5_1.py', first: 97, last: 101 }] } }) }); }
    if (/raw\.githubusercontent\.com/.test(u)) { intercepted.push({ url: u, answered: 'locally with dummy text' }); return req.respond({ status: 200, contentType: 'text/plain', body: Array.from({ length: 120 }, (_, i) => `DUMMY LINE ${i + 1} (answered locally by the review probe, not GitHub)`).join('\n') }); }
    intercepted.push({ url: u, answered: 'ABORTED' }); return req.abort();
  });
  await page.click('#cable'); await sleep(100); await page.click('#reprepare'); await sleep(100); await page.click('#measure'); await sleep(2500);
  d.forgedBucket = { cableLine: await hudFind(page, /^cable/), liveRec: await page.evaluate(() => window.__qts.S.liveRec && { n: window.__qts.S.liveRec.n, lines: window.__qts.S.liveRec.rec.lines.length, repos: window.__qts.S.liveRec.rec.repos.length }) };
  const btn = await page.$('#lines button.u-chip'); if (btn) { await btn.click(); await sleep(2500); d.forgedBucket.lineText = { note: await page.evaluate(() => { const n = document.querySelector('#lines .u-code .u-muted'); return n ? n.textContent : null; }), linesShown: await page.evaluate(() => document.querySelectorAll('#lines .u-line').length), firstLine: await page.evaluate(() => { const l = document.querySelector('#lines .u-line'); return l ? l.textContent.slice(0, 120) : null; }) }; }
  d.forgedBucket.intercepted = intercepted;
  await page.click('#cable'); await sleep(50);
  // ---- T8: WebGL context loss ----
  { const r = await page.evaluate(async () => { const gl = document.querySelector('#gl').getContext('webgl2'); const ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return { error: 'no WEBGL_lose_context' }; ext.loseContext(); await new Promise(r => setTimeout(r, 1500)); const lost = gl.isContextLost(); const hudText = Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent); return { isContextLost: lost, hudOnGPU: hudText.find(t => t.startsWith('on GPU')), hudFps: hudText.find(t => t.startsWith('fps')), hudMentionsLoss: hudText.some(t => /lost|context/i.test(t)), glError: gl.getError() }; });
    d.contextLoss = r; d.contextLoss.errorsLogged = errors.slice(); const errCount = errors.length;
    await page.evaluate(async () => { const gl = document.querySelector('#gl').getContext('webgl2'); const ext = gl.getExtension('WEBGL_lose_context'); ext.restoreContext(); await new Promise(r => setTimeout(r, 1500)); });
    d.contextLoss.afterRestore = await page.evaluate(() => { const gl = document.querySelector('#gl').getContext('webgl2'); const { B } = window.__qts; gl.bindBuffer(gl.ARRAY_BUFFER, B.sea); return { isContextLost: gl.isContextLost(), seaBufferSizeNow: gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE), glError: gl.getError(), hudOnGPU: Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('on GPU')) }; });
    d.contextLoss.newErrorsAfterRestore = errors.length - errCount; d.contextLoss.errorsSample = errors.slice(-5); }
  d.externalHosts = [...new Set(ext.map(e => new globalThis.URL(e.url).host))]; d.externalRequestsTotal = ext.length; d.errorsTotal = errors.length; d.errorsFirst = errors.slice(0, 8);
  await page.close();
  // ---- T9: phone 430×900 then rotate to 900×430 ----
  { const P = await newPage(430, 900, 2, true); const pg = P.page; await pg.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(4000);
    const snap = () => pg.evaluate(() => { const { G } = window.__qts; const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; }; const cv = r('#gl'); const labels = Array.from(document.querySelectorAll('#labels .lb')).map(l => { const b = l.getBoundingClientRect(); return { text: l.textContent.slice(0, 30), outsideCanvas: b.left < cv.l - 2 || b.right > cv.l + cv.w + 2 || b.top < cv.t - 2 || b.bottom > cv.t + cv.h + 2 }; }); return { viewport: [innerWidth, innerHeight], phoneMedia: matchMedia('(max-width:430px)').matches, canvasCss: cv, canvasPx: [document.querySelector('#gl').width, document.querySelector('#gl').height], c0: G.c0, c1: G.c1, R: G.R, sphereR: G.sphereR, hudPosition: getComputedStyle(document.querySelector('#hud')).position, sphereHandle: r('#sphereHandle'), scrollWidth: document.documentElement.scrollWidth, labelsOutsideCanvas: labels.filter(l => l.outsideCanvas), twinCentreBelowCanvasBottom: (G.c1[1] / window.__qts.DPR) > cv.h }; });
    R.phone = { portrait: await snap() }; await pg.setViewport({ width: 900, height: 430, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(1000); R.phone.landscapeAfterRotate = await snap(); R.phone.externalRequests = P.ext.length; R.phone.errors = P.errors; await pg.close(); }
  // ---- T10: 375×667 DPR2 ----
  { const P = await newPage(375, 667, 2, true); const pg = P.page; await pg.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(4000);
    R.phone375 = await pg.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, controlsInWidth: Array.from(document.querySelectorAll('#bar button, #bar input, #legend button, #legend select')).every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= 375.5; }), hudPosition: getComputedStyle(document.querySelector('#hud')).position, seaDrawn: window.__qts.S.seaDrawn, seaBytes: window.__qts.S.seaBytes, fps: Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('fps')) }));
    R.phone375.externalRequests = P.ext.length; R.phone375.errors = P.errors; await pg.close(); }
} catch (e) { R.error = e.stack; }
await browser.close();
try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { R.serverKillError = e.message; }
await sleep(800);
try { const ns = execSync('netstat -ano', { encoding: 'utf8' }); R.portStillListening = ns.split('\n').some(l => l.includes(`127.0.0.1:${PORT}`) && l.includes('LISTENING')); } catch (e) { R.portCheckError = e.message; }
R.finished_utc = new Date().toISOString();
fs.writeFileSync(OUT + 'review2_report.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
