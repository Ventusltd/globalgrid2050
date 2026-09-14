// Repair-round proof for testcode/202609142202 (puppeteer-core by absolute path, GPU flags as instructed).
// Starts its own python http.server on PORT from the repository root, stops it with taskkill /T /F, checks the port is free.
// Every non-127.0.0.1 request is LOGGED (not blocked) so the count of external requests is measured, not claimed.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.env.PORT || '8863';
const ROOT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050';
const URL = `http://127.0.0.1:${PORT}/testcode/202609142202/index.html`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { url: URL, started_utc: new Date().toISOString() };

const server = spawn('python', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', fs.openSync(OUT + 'server2.log', 'w'), fs.openSync(OUT + 'server2.log', 'a')] });
await sleep(1500);
const browser = await puppeteer.launch({
  headless: 'new', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--no-sandbox', '--window-size=1440,1000']
});
async function newPage(w, h, dpr, mobile) {
  const page = await browser.newPage(); const ext = [], errors = [];
  page.on('request', req => { const u = req.url(); if (!u.startsWith('http://127.0.0.1')) ext.push({ url: u, t: Date.now() }); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') errors.push(t + ': ' + m.text()); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  return { page, ext, errors };
}
const hud = page => page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
const hudFind = async (page, re) => (await hud(page)).find(t => re.test(t)) || null;
const st = page => page.evaluate(() => { const S = window.__qts.S; return { theta: S.theta, dataTheta: S.dataTheta, outcome: S.outcome, measuredTheta: S.measuredTheta, litRepo: S.litRepo, chosen: S.twin && S.twin.chosen && S.twin.chosen.label, hand: S.hand, cableOn: !!S.cableOn }; });
// electron draw: hook drawArraysInstanced and record the first 512-vertex call's arguments and uniforms
const elecProbe = () => new Promise(res => {
  const gl = document.querySelector('#gl').getContext('webgl2'); const orig = gl.drawArraysInstanced; let done = false;
  gl.drawArraysInstanced = function (mode, first, count, inst) {
    if (!done && count === 512) { done = true; const prog = gl.getParameter(gl.CURRENT_PROGRAM); const counts = gl.getUniform(prog, gl.getUniformLocation(prog, 'u_counts')); const stride = gl.getUniform(prog, gl.getUniformLocation(prog, 'u_stride')); gl.drawArraysInstanced = orig; res({ draw: { mode, first, count, instanceCount: inst }, u_counts_KLM: Array.from(counts), u_stride: stride }); }
    return orig.call(gl, mode, first, count, inst);
  };
  setTimeout(() => { if (!done) { gl.drawArraysInstanced = orig; res({ error: 'no 512-vertex instanced draw seen in 2 s' }); } }, 2000);
});
// bright pixels in the K/L/M annuli around the sphere centre (drawing buffer preserved)
const annuli = () => {
  const { G } = window.__qts; const gl = document.querySelector('#gl').getContext('webgl2'); const r = G.sphereR; const cx = G.c0[0], cy = G.c0[1];
  const half = Math.ceil(r * 1.4); const x0 = Math.round(cx - half), y0 = Math.round(G.H - cy - half); const w = 2 * half, h = 2 * half;
  const px = new Uint8Array(w * h * 4); gl.readPixels(x0, y0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const bands = { K_0p50_0p60: [0.50, 0.60], L_0p80_0p90: [0.80, 0.90], M_1p20_1p30: [1.20, 1.30] }; const out = {};
  for (const [k, [a, b]] of Object.entries(bands)) { let n = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = (x0 + i) - cx, dy = (G.H - (y0 + j)) - cy; const d = Math.hypot(dx, dy) / r; if (d >= a && d < b) { const o = (j * w + i) * 4; if (Math.max(px[o], px[o + 1], px[o + 2]) > 70) n++; } } out[k] = n; }
  return { sphereR_px: r, bright: out };
};
const clickMeasure = async (page, n = 1, gap = 60) => { for (let i = 0; i < n; i++) { await page.click('#measure'); await sleep(gap); } };
const reprepareAndMeasure = async (page, n) => { const outs = []; for (let i = 0; i < n; i++) { await page.click('#reprepare'); await sleep(30); await page.click('#measure'); await sleep(30); outs.push(await page.evaluate(() => window.__qts.S.outcome)); } return outs; };

try {
  // ---------------- desktop 1440×1000 ----------------
  const { page, ext, errors } = await newPage(1440, 1000, 1, false);
  const t0 = Date.now(); await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(5000);
  const d = R.desktop = { loadMs: Date.now() - t0 };
  d.hud = await hud(page); d.renderer = d.hud.find(t => t.startsWith('renderer')); d.count = await page.evaluate(() => document.querySelector('#count').textContent);
  d.fps5s = d.hud.find(t => t.startsWith('fps')); d.onGPU = d.hud.find(t => t.startsWith('on GPU'));
  d.scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  d.externalRequestsDuringLoad = ext.map(e => e.url);
  d.gpu = await page.evaluate(() => ({ seaBytes: window.__qts.S.seaBytes, seaDrawn: window.__qts.S.seaDrawn, stride: window.__qts.S.seaStride, drawCalls: window.__qts.S.lastDrawCalls }));
  d.defaultFocus = await page.evaluate(() => window.__qts.S.msg);
  d.footer = await page.evaluate(() => document.querySelector('#foot').textContent);
  // electron shells: #2039 (K0 L40 M20) then band → #6554 (K0 L0 M60)
  d.elec_2039 = { atom: await page.evaluate(() => { const a = window.__qts.S.atom; return { n: a.n, name: a.name, shells: a.shells }; }), draw: await page.evaluate(elecProbe), annuli: await page.evaluate(annuli) };
  await page.click('body'); await page.keyboard.press('ArrowRight'); await sleep(600);
  d.elec_6554 = { atom: await page.evaluate(() => { const a = window.__qts.S.atom; return { n: a.n, name: a.name, shells: a.shells }; }), draw: await page.evaluate(elecProbe), annuli: await page.evaluate(annuli) };
  await page.keyboard.press('ArrowLeft'); await sleep(300);
  // no-atom baseline for the annuli: steer to family #80299 (haversine, no electron record)
  await page.click('#search'); await page.type('#search', '#80299'); await page.keyboard.press('Enter'); await sleep(500);
  d.search80299 = { msg: await page.evaluate(() => window.__qts.S.msg), state: await hudFind(page, /^state/) };
  d.annuli_noAtom = await page.evaluate(annuli);
  await page.keyboard.press('Enter'); await sleep(300); d.search80299.secondEnter = await page.evaluate(() => window.__qts.S.msg);
  // back to Number and measure with the cable OFF: external requests must stay at 0
  await page.evaluate(() => { document.querySelector('#search').value = ''; }); await page.click('#search'); await page.type('#search', 'Number'); await page.keyboard.press('Enter'); await sleep(300);
  const extBefore = ext.length; await page.keyboard.press('Enter'); await sleep(1500);
  d.measure1 = { born: await hudFind(page, /^Born/), state: await hudFind(page, /^state/), twin: await hudFind(page, /^twin/), cable: await hudFind(page, /^cable/), S: await st(page), externalRequests: ext.length - extBefore };
  // 12 repeat clicks inside the window: outcomes must all equal the first, histogram must not count them
  const first = d.measure1.S.outcome; const reps = []; for (let i = 0; i < 12; i++) { await page.click('#measure'); await sleep(40); reps.push(await page.evaluate(() => window.__qts.S.outcome)); }
  d.repeats = { first, outcomes: reps, allSame: reps.every(o => o === first), born: await hudFind(page, /^Born/), state: await hudFind(page, /^state/), hist: await page.evaluate(() => Object.fromEntries(window.__qts.S.hist)), externalRequests: ext.length - extBefore };
  // 25 × (re-prepare + measure): histogram on prepared states only
  const outs = await reprepareAndMeasure(page, 25); await sleep(600);
  d.histogram = { outcomes: outs, line: await hudFind(page, /^histogram/), hist: await page.evaluate(() => Object.fromEntries(window.__qts.S.hist)), externalRequests: ext.length - extBefore, recordChips: await page.evaluate(() => document.querySelectorAll('#record button').length) };
  // lit repo after a TUNNEL: Born line names it, and one repo dot in the atomDots buffer carries the lit colour (1, .45, .2)
  let tries = 0; while ((await page.evaluate(() => window.__qts.S.outcome)) !== 1 && tries++ < 40) { await page.click('#reprepare'); await sleep(20); await page.click('#measure'); await sleep(20); }
  d.litRepo = { S: await st(page), born: await hudFind(page, /^Born/), litDotsInBuffer: await page.evaluate(() => { const gl = document.querySelector('#gl').getContext('webgl2'); const { B } = window.__qts; gl.bindBuffer(gl.ARRAY_BUFFER, B.atomDots); const out = new Float32Array(64 * 8); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out); let n = 0; for (let i = 0; i < B.atomDotsN; i++) if (Math.abs(out[i * 8 + 2] - 1) < 1e-3 && Math.abs(out[i * 8 + 3] - .45) < 1e-3 && Math.abs(out[i * 8 + 4] - .2) < 1e-3) n++; return n; }) };
  // hand-prepared measurement: state line must agree with the Born line
  await page.click('#reprepare'); await sleep(100); await page.evaluate(() => { window.__qts.S.hand = { theta: 2.6, phi: 1.0 }; }); await page.click('#measure'); await sleep(300);
  d.handMeasure = { state: await hudFind(page, /^state/), born: await hudFind(page, /^Born/), S: await st(page) };
  // resize while collapsed keeps the chosen twin
  d.resizeAfterCollapse = { before: await st(page) }; await page.setViewport({ width: 1300, height: 900, deviceScaleFactor: 1 }); await sleep(500); d.resizeAfterCollapse.after = await st(page); await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 }); await sleep(500);
  // cable ON: exactly one external request for the first measurement of this bucket, none for the second; sha256 line printed
  await page.click('#reprepare'); await sleep(100); await page.click('#cable'); await sleep(100); const extC = ext.length;
  await page.click('#measure'); await sleep(4000);
  d.cableOn = { firstMeasurement: { cable: await hudFind(page, /^cable/), externalRequests: ext.slice(extC).map(e => e.url) } };
  await page.click('#reprepare'); await sleep(100); const extC2 = ext.length; await page.click('#measure'); await sleep(1500);
  d.cableOn.secondMeasurement = { cable: await hudFind(page, /^cable/), externalRequests: ext.slice(extC2).map(e => e.url) };
  await page.click('#cable'); await sleep(100); // off again
  // line text on demand (raw.githubusercontent at the pinned commit)
  const extL = ext.length; const btn = await page.$('#lines button.u-chip'); if (btn) { await btn.click(); await sleep(6000); d.lineText = { note: await page.evaluate(() => { const n = document.querySelector('#lines .u-code .u-muted'); return n ? n.textContent : null; }), lines: await page.evaluate(() => document.querySelectorAll('#lines .u-line').length), first: await page.evaluate(() => { const l = document.querySelector('#lines .u-line'); return l ? l.textContent.slice(0, 100) : null; }), externalRequests: ext.slice(extL).map(e => e.url) }; }
  // SOUL tier: #766 geometry (band index 3); 8 × re-prepare + measure, chosen twin per outcome
  await page.click('body'); await page.evaluate(() => { const { D, S } = window.__qts; S.bandPos = D.band.indexOf(766) - 1; }); await page.keyboard.press('ArrowRight'); await sleep(400);
  d.soul = { atom: await page.evaluate(() => { const a = window.__qts.S.atom; return { n: a.n, name: a.name, shells: a.shells }; }), tier: await hudFind(page, /^twin/), runs: [] };
  for (let i = 0; i < 8; i++) { await page.click('#reprepare'); await sleep(30); await page.evaluate(() => { window.__qts.S.hand = { theta: Math.PI / 2, phi: 0 }; }); await page.click('#measure'); await sleep(80); d.soul.runs.push({ outcome: await page.evaluate(() => window.__qts.S.outcome), chosen: await page.evaluate(() => window.__qts.S.twin.chosen && window.__qts.S.twin.chosen.label), note: await page.evaluate(() => window.__qts.S.twinNote) }); }
  // pick on the twin star at the mirrored focused-family position
  await page.click('#reprepare'); await sleep(200);
  await page.evaluate(() => { document.querySelector('#hud').style.pointerEvents = 'none'; }); // the HUD overlay must not swallow the proof's taps
  const pt = await page.evaluate(() => { const { S, G, familyPos, DPR } = window.__qts; const p = familyPos(S.famIdx); const c = document.querySelector('#gl').getBoundingClientRect(); return { x: c.left + (G.c1[0] - p[0] * G.R) / DPR, y: c.top + (G.c1[1] - p[1] * G.R) / DPR, famIdx: S.famIdx }; });
  await page.mouse.click(pt.x, pt.y); await sleep(400); d.twinPick = { point: pt, msg: await page.evaluate(() => window.__qts.S.msg) };
  const pp = await page.evaluate(() => { const { S, G, familyPos, DPR } = window.__qts; const p = familyPos(S.famIdx); const c = document.querySelector('#gl').getBoundingClientRect(); return { x: c.left + (G.c0[0] + p[0] * G.R) / DPR, y: c.top + (G.c0[1] + p[1] * G.R) / DPR }; });
  await page.mouse.click(pp.x, pp.y); await sleep(400); d.principalPick = { point: pp, msg: await page.evaluate(() => window.__qts.S.msg) };
  await page.evaluate(() => { document.querySelector('#hud').style.pointerEvents = ''; });
  // labels vs HUD overlap on desktop
  d.labelOverlap = await page.evaluate(() => { const h = document.querySelector('#hud').getBoundingClientRect(); return Array.from(document.querySelectorAll('#labels .lb')).map(l => { const b = l.getBoundingClientRect(); const ov = !(b.right < h.left || b.left > h.right || b.bottom < h.top || b.top > h.bottom); return { text: l.textContent.slice(0, 32), overlapsHUD: ov }; }).filter(x => x.overlapsHUD); });
  // prove it
  await page.click('#prove'); await sleep(1500); d.prove = await hudFind(page, /^prove it/);
  d.fpsEnd = await hudFind(page, /^fps/); d.externalHosts = [...new Set(ext.map(e => new globalThis.URL(e.url).host))]; d.externalRequestsTotal = ext.length;
  // back to the default focus for the screenshot
  await page.evaluate(() => { document.querySelector('#search').value = ''; }); await page.click('#search'); await page.type('#search', 'Number'); await page.keyboard.press('Enter'); await sleep(800);
  await page.screenshot({ path: OUT + 'build-1440.png' });
  d.errors = errors; await page.close();

  // ---------------- phone 430×900 DPR 1 (screenshot) and DPR 2 touch ----------------
  for (const [dpr, name] of [[1, 'build-430'], [2, 'build-430-dpr2']]) {
    const P = await newPage(430, 900, dpr, true); const pg = P.page;
    await pg.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(5000);
    const m = R[name] = {};
    m.scrollWidth = await pg.evaluate(() => document.documentElement.scrollWidth); m.bodyScrollWidth = await pg.evaluate(() => document.body.scrollWidth);
    m.hud = await hud(pg); m.fps = m.hud.find(t => t.startsWith('fps')); m.onGPU = m.hud.find(t => t.startsWith('on GPU'));
    m.gpu = await pg.evaluate(() => ({ seaBytes: window.__qts.S.seaBytes, seaDrawn: window.__qts.S.seaDrawn, stride: window.__qts.S.seaStride, drawCalls: window.__qts.S.lastDrawCalls, DPR: window.__qts.DPR, canvas: [document.querySelector('#gl').width, document.querySelector('#gl').height], phoneMode: window.__qts.S.phoneMode }));
    m.layout = await pg.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; }; return { stage: r('#stage'), canvas: r('#gl'), hud: r('#hud'), hudPosition: getComputedStyle(document.querySelector('#hud')).position, sphereHandle: r('#sphereHandle') }; });
    m.labelOverlap = await pg.evaluate(() => { const h = document.querySelector('#hud').getBoundingClientRect(); return Array.from(document.querySelectorAll('#labels .lb')).map(l => { const b = l.getBoundingClientRect(); return { text: l.textContent.slice(0, 32), overlapsHUD: !(b.right < h.left || b.left > h.right || b.bottom < h.top || b.top > h.bottom) }; }).filter(x => x.overlapsHUD); });
    m.controlsInViewportWidth = await pg.evaluate(() => Array.from(document.querySelectorAll('#bar button, #bar input')).every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= 430; }));
    try { const sh = m.layout.sphereHandle; await pg.touchscreen.tap(sh.l + sh.w / 2, sh.t + sh.h / 2); await sleep(400); m.touchTapSphere = { born: await hudFind(pg, /^Born/) }; } catch (e) { m.touchTapSphere = { error: e.message }; }
    await sleep(1500); m.fpsAfter = await hudFind(pg, /^fps/);
    await pg.screenshot({ path: OUT + name + '.png' });
    m.externalRequests = P.ext.map(e => e.url); m.errors = P.errors; await pg.close();
  }
} catch (e) { R.error = e.stack; }
await browser.close();
// stop the server and check the port
try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { R.serverKillError = e.message; }
await sleep(800);
try { const ns = execSync('netstat -ano', { encoding: 'utf8' }); R.portStillListening = ns.split('\n').some(l => l.includes(`127.0.0.1:${PORT}`) && l.includes('LISTENING')); } catch (e) { R.portCheckError = e.message; }
R.finished_utc = new Date().toISOString();
fs.writeFileSync(OUT + 'report2.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
