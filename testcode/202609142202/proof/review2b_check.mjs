// Adversarial review round 2, part b: forged bucket (answered locally WITH a CORS header), context loss/restore, phone rotation, 375 px.
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
const server = spawn('python', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', fs.openSync(OUT + 'review2b_server.log', 'w'), fs.openSync(OUT + 'review2b_server.log', 'a')] });
await sleep(1500);
const browser = await puppeteer.launch({ headless: 'new', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--no-sandbox', '--window-size=1440,1000'] });
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
try {
  const { page, ext, errors } = await newPage(1440, 1000, 1, false);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(4000);
  const d = R.desktop = {};
  // ---- forged bucket, answered locally with ACAO so the browser accepts it; nothing goes to the network ----
  const intercepted = [];
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://127.0.0.1')) return req.continue();
    if (/\/code\/f\/12\.json/.test(u)) { intercepted.push({ url: u, answered: 'locally with a forged bucket (3 lines, 3 repos)' }); return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify({ '6076': { n: 6076, names: ['Number'], lines: [1, 2, 3], repos: ['forged-a', 'forged-b', 'forged-c'], places: [{ repo: 'Ventusltd/globalgrid2050', commit: '1a382b71b99cdf3592f15024aabab244ba6fc31e', path: 'scripts/build_news_feed_v9_5_1.py', first: 97, last: 101 }] } }) }); }
    if (/raw\.githubusercontent\.com/.test(u)) { intercepted.push({ url: u, answered: 'locally with dummy text' }); return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'text/plain', body: Array.from({ length: 120 }, (_, i) => `DUMMY LINE ${i + 1} (answered locally by the review probe, not GitHub)`).join('\n') }); }
    intercepted.push({ url: u, answered: 'ABORTED' }); return req.abort();
  });
  await page.click('#cable'); await sleep(100); await page.click('#measure'); await sleep(2500);
  d.forgedBucket = { cableLine: await hudFind(page, /^cable/), liveRec: await page.evaluate(() => window.__qts.S.liveRec && { n: window.__qts.S.liveRec.n, lines: window.__qts.S.liveRec.rec.lines.length, repos: window.__qts.S.liveRec.rec.repos.length }) };
  const btn = await page.$('#lines button.u-chip'); if (btn) { await btn.click(); await sleep(2500); d.forgedBucket.lineText = { note: await page.evaluate(() => { const n = document.querySelector('#lines .u-code .u-muted'); return n ? n.textContent : null; }), linesShown: await page.evaluate(() => document.querySelectorAll('#lines .u-line').length), lines: await page.evaluate(() => Array.from(document.querySelectorAll('#lines .u-line')).map(l => l.textContent.slice(0, 90))) }; }
  d.forgedBucket.intercepted = intercepted;
  await page.click('#cable'); await sleep(50);
  // ---- context loss, then restore with no handler in the page ----
  const e0 = errors.length;
  d.contextLoss = await page.evaluate(async () => { const gl = document.querySelector('#gl').getContext('webgl2'); const ext = gl.getExtension('WEBGL_lose_context'); window.__loseExt = ext; ext.loseContext(); await new Promise(r => setTimeout(r, 1500)); const t = Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent); return { isContextLost: gl.isContextLost(), hudOnGPU: t.find(x => x.startsWith('on GPU')), hudFps: t.find(x => x.startsWith('fps')), hudMentionsLoss: t.some(x => /lost|context/i.test(x)) }; });
  d.contextLoss.errorsDuringLoss = errors.length - e0; const e1 = errors.length;
  d.contextLoss.afterRestore = await page.evaluate(async () => { window.__loseExt.restoreContext(); await new Promise(r => setTimeout(r, 2000)); const gl = document.querySelector('#gl').getContext('webgl2'); const { B, S } = window.__qts; gl.bindBuffer(gl.ARRAY_BUFFER, B.sea); const sz = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE); const t = Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent); const px = new Uint8Array(4 * 64 * 64); gl.readPixels(Math.round(window.__qts.G.c0[0]) - 32, Math.round(window.__qts.G.H - window.__qts.G.c0[1]) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px); let lit = 0; for (let i = 0; i < px.length; i += 4) if (Math.max(px[i], px[i + 1], px[i + 2]) > 40) lit++; return { isContextLost: gl.isContextLost(), seaBufferSizeAfterRestore: sz, hudOnGPU: t.find(x => x.startsWith('on GPU')), hudFps: t.find(x => x.startsWith('fps')), litPixelsAroundSphere64x64: lit, lastDrawCalls: S.lastDrawCalls }; });
  d.contextLoss.errorsAfterRestore2s = errors.length - e1; d.contextLoss.errorSample = errors.slice(e1, e1 + 4);
  d.externalRequestsTotal = ext.length; d.externalHosts = [...new Set(ext.map(e => new globalThis.URL(e.url).host))]; d.interceptedCount = intercepted.length;
  await page.close();
  // ---- phone 430×900 then rotate to 900×430 ----
  { const P = await newPage(430, 900, 2, true); const pg = P.page; await pg.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(4000);
    const snap = () => pg.evaluate(() => { const { G, DPR } = window.__qts; const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; }; const cv = r('#gl'); const labels = Array.from(document.querySelectorAll('#labels .lb')).map(l => { const b = l.getBoundingClientRect(); return { text: l.textContent.slice(0, 30), outsideCanvas: b.left < cv.l - 2 || b.right > cv.l + cv.w + 2 || b.top < cv.t - 2 || b.bottom > cv.t + cv.h + 2 }; }); return { viewport: [innerWidth, innerHeight], phoneMediaNow: matchMedia('(max-width:430px)').matches, canvasCss: cv, c0css: G.c0.map(v => Math.round(v / DPR)), c1css: G.c1.map(v => Math.round(v / DPR)), Rcss: Math.round(G.R / DPR), hudPosition: getComputedStyle(document.querySelector('#hud')).position, sphereHandle: r('#sphereHandle'), scrollWidth: document.documentElement.scrollWidth, labelsOutsideCanvas: labels.filter(l => l.outsideCanvas).map(l => l.text), twinCentreBeyondCanvasBottom: (G.c1[1] / DPR) > cv.h, twinBottomEdgeBeyondCanvas: (G.c1[1] + G.R) / DPR > cv.h }; });
    R.phone = { portrait: await snap() }; await pg.setViewport({ width: 900, height: 430, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(1200); R.phone.landscapeAfterRotate = await snap(); await pg.screenshot({ path: OUT + 'review2-rotated-900x430.png' }); R.phone.externalRequests = P.ext.length; R.phone.errors = P.errors.slice(0, 5); await pg.close(); }
  // ---- 375×667 DPR2 ----
  { const P = await newPage(375, 667, 2, true); const pg = P.page; await pg.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 }); await sleep(4000);
    R.phone375 = await pg.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, controlsInWidth: Array.from(document.querySelectorAll('#bar button, #bar input, #legend button, #legend select')).every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= 375.5; }), widest: Array.from(document.querySelectorAll('#bar button, #bar input, #legend button, #legend select')).map(b => ({ id: b.id || b.tagName, right: Math.round(b.getBoundingClientRect().right) })).filter(x => x.right > 375), hudPosition: getComputedStyle(document.querySelector('#hud')).position, seaDrawn: window.__qts.S.seaDrawn, seaBytes: window.__qts.S.seaBytes, fps: Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('fps')) }));
    R.phone375.externalRequests = P.ext.length; R.phone375.errors = P.errors.slice(0, 5); await pg.close(); }
} catch (e) { R.error = e.stack; }
await browser.close();
try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { R.serverKillError = e.message; }
await sleep(800);
try { const ns = execSync('netstat -ano', { encoding: 'utf8' }); R.portStillListening = ns.split('\n').some(l => l.includes(`127.0.0.1:${PORT}`) && l.includes('LISTENING')); } catch (e) { R.portCheckError = e.message; }
R.finished_utc = new Date().toISOString();
fs.writeFileSync(OUT + 'review2b_report.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
