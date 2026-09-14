// Independent GPU runner, round 1 — verification of testcode/202609142202/index.html.
// Own script; nothing here trusts the builder's proof.mjs or report.json.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawn, execFile } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');

const ROOT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050';
const DIR = ROOT + '/testcode/202609142202';
const OUT = DIR + '/proof/';
const PORT = 8871;
const URL = `http://127.0.0.1:${PORT}/testcode/202609142202/index.html`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { url: URL, started: new Date().toISOString() };

// (3) lines.bin read by this script, not by the page
const bin = fs.readFileSync(DIR + '/data/lines.bin');
const keys = new Uint32Array(bin.buffer, bin.byteOffset, bin.byteLength >>> 2);
const keySet = new Set(keys);
R.linesBin = { bytes: bin.byteLength, entries: bin.byteLength / 4, distinct: keySet.size, remainderBytes: bin.byteLength % 4 };

// (9) nvidia-smi sampling
function smi() { return new Promise(res => execFile('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used,name', '--format=csv,noheader,nounits'], (e, so) => { if (e) return res({ err: e.message }); const [u, m, n] = so.trim().split(',').map(s => s.trim()); res({ t: Date.now(), util: +u, memMiB: +m, name: n }); })); }
const idle = []; for (let i = 0; i < 8; i++) { idle.push(await smi()); await sleep(1000); }
R.nvidiaIdle = idle;
const live = []; let sampling = true;
(async () => { while (sampling) { live.push(await smi()); await sleep(1000); } })();

// static server (own process; killed at the end)
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', d => serverLog += d); server.stderr.on('data', d => serverLog += d);
await sleep(1500);

const browser = await puppeteer.launch({
  headless: 'new', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--no-sandbox', '--window-size=1440,1000']
});
R.chrome = await browser.version();

const hudLines = p => p.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
const hudFind = async (p, re) => (await hudLines(p)).find(t => re.test(t)) || null;
const fps3s = p => p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const tick = t => { n++; if (t - t0 < 3000) requestAnimationFrame(tick); else res({ frames: n, ms: +(t - t0).toFixed(1), fps: +(n * 1000 / (t - t0)).toFixed(1) }); }; requestAnimationFrame(tick); }));
const rendererOwn = p => p.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return { webgl: false }; const d = gl.getExtension('WEBGL_debug_renderer_info'); return { webgl: true, unmaskedRenderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, unmaskedVendor: d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) : null, RENDERER: gl.getParameter(gl.RENDERER) }; });

async function openPage(width, height) {
  const page = await browser.newPage();
  const issues = [], logs = [];
  page.on('console', m => { const t = m.type(); (t === 'error' || t === 'warning' || t === 'warn') ? issues.push(t + ': ' + m.text()) : logs.push(t + ': ' + m.text()); });
  page.on('pageerror', e => issues.push('pageerror: ' + e.message));
  page.on('requestfailed', r => issues.push('requestfailed: ' + r.url() + ' ' + ((r.failure() || {}).errorText || '')));
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await sleep(8000); // (2) 8 s window
  return { page, issues, logs, loadMs: Date.now() - t0 };
}

try {
  // ===== 1440 x 900 =====
  const A = await openPage(1440, 900); const p = A.page; const a = { width: 1440, height: 900, loadMs: A.loadMs };
  a.consoleIssues8s = A.issues.slice(); a.consoleOther = A.logs.slice(0, 10);
  a.rendererOwnCanvas = await rendererOwn(p);                                   // (1)
  a.rendererHudLine = await hudFind(p, /^renderer:/);
  a.hudOnGpuLine = await hudFind(p, /^on GPU:/);                                // (3)
  a.hudPointCount = a.hudOnGpuLine ? +(/on GPU: ([\d,]+) line entries/.exec(a.hudOnGpuLine) || [, 'NaN'])[1].replace(/,/g, '') : null;
  a.hudDistinct = a.hudOnGpuLine ? +(/([\d,]+) distinct/.exec(a.hudOnGpuLine) || [, 'NaN'])[1].replace(/,/g, '') : null;
  a.pageState = await p.evaluate(() => { const q = window.__qts; return q ? { seaDrawn: q.S.seaDrawn, seaBytes: q.S.seaBytes, seaStride: q.S.seaStride, N: q.D.N, keysLen: q.D.keys.length, distinct: q.D.distinct, renderer: q.S.renderer, DPR: q.DPR, phoneMode: q.S.phoneMode } : null; });
  a.pointCountMatchesLinesBin = a.hudPointCount === R.linesBin.entries;
  a.scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);  // (5)
  a.fps = await fps3s(p);                                                         // (4)
  a.hudFpsLine = await hudFind(p, /^fps/);

  // (6) click a visible point: click at a drawn family's screen position (from the page's own layout), spiral out a few px until the 1-px pick hits
  const bornBefore = await hudFind(p, /^Born audit:/);
  await p.evaluate(() => { document.querySelector('#hud').style.pointerEvents = 'none'; });
  const fam = await p.evaluate(() => { const { S, G, D, familyPos, DPR } = window.__qts; let fi = Math.floor(D.families.length * 0.37); const c = document.querySelector('#gl').getBoundingClientRect(); const pos = familyPos(fi); return { fi, n: D.families[fi].n, name: D.families[fi].name, x: c.left + (G.c0[0] + pos[0] * G.R + S.view.x) / DPR, y: c.top + (G.c0[1] + pos[1] * G.R + S.view.y) / DPR, canvas: { l: c.left, t: c.top, w: c.width, h: c.height } }; });
  const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [3, 0], [-3, 0], [0, 3], [0, -3], [3, 3], [-3, 3], [3, -3], [-3, -3], [4, 0], [-4, 0], [0, 4], [0, -4]];
  let pickMsg = null, attempts = 0, pickPt = null;
  for (const [dx, dy] of offsets) { attempts++; pickPt = { x: Math.round(fam.x + dx), y: Math.round(fam.y + dy) }; await p.mouse.click(pickPt.x, pickPt.y); await sleep(350); pickMsg = await hudFind(p, /^#\d+ · family #\d+|^tap hit no entry|^pick framebuffer/); if (pickMsg && /^#\d+ · family/.test(pickMsg)) break; }
  a.pick = { targetFamily: fam, attempts, clickedAt: pickPt, hudMsg: pickMsg };
  const pm = /^#(\d+) · family #(\d+)/.exec(pickMsg || ''); a.pick.hit = !!pm;
  if (pm) { a.pick.key = +pm[1]; a.pick.familyN = +pm[2]; a.pick.keyInLinesBin = keySet.has(+pm[1]); }
  await sleep(1000);
  const panel = await p.evaluate(() => { const el = document.querySelector('#lines'); return { hidden: el.hidden, header: (el.querySelector('.u-h') || {}).textContent || null, keys: Array.from(el.querySelectorAll('.u-line .u-key')).map(s => +s.textContent), totalLines: el.querySelectorAll('.u-line').length }; });
  a.pick.linesPanel = { hidden: panel.hidden, header: panel.header, shownKeys: panel.keys.length, firstKeys: panel.keys.slice(0, 8), allShownKeysExistInLinesBin: panel.keys.length > 0 && panel.keys.every(k => keySet.has(k)), missing: panel.keys.filter(k => !keySet.has(k)).slice(0, 5) };
  a.pick.bornAuditBeforeClick = bornBefore; a.pick.bornAuditAfterClick = await hudFind(p, /^Born audit:/);
  a.pick.stateAfterClick = await hudFind(p, /^state:|^shells not shipped|^no focus/);
  // does clicking measure? press the measure button once on the picked focus and record what the page says
  await p.click('#measure'); await sleep(1500);
  a.pick.bornAuditAfterMeasureButton = await hudFind(p, /^Born audit:/);
  a.pick.msgAfterMeasureButton = await hudFind(p, /^nothing to measure|^measured|^no electrons/);
  a.pick.bornChangedAfterMeasureButton = a.pick.bornAuditAfterMeasureButton !== bornBefore;

  // (7) search #80299
  await p.evaluate(() => { document.querySelector('#search').value = ''; }); await p.click('#search'); await p.keyboard.type('#80299'); await p.keyboard.press('Enter'); await sleep(700);
  const s = {}; s.steerMsg = await hudFind(p, /^family #80299|^line #80299|^soul #80299|^#80299/); s.steerHasHaversine = /haversine/.test(s.steerMsg || '');
  s.joinLine = await hudFind(p, /^join:/); s.stateAfterSteer = await hudFind(p, /^state:|^shells not shipped|^no focus/);
  s.familyKeysInLinesBin = await p.evaluate(() => { const { S, D } = window.__qts; if (S.famIdx < 0) return null; const f = D.families[S.famIdx]; return { n: f.n, name: f.name, lineCount: f.lineCount, keys: Array.from(D.keys.subarray(f.lineOffset, f.lineOffset + f.lineCount)) }; });
  if (s.familyKeysInLinesBin) s.familyKeysInLinesBin.allExist = s.familyKeysInLinesBin.keys.every(k => keySet.has(k));
  const born80299Before = await hudFind(p, /^Born audit:/);
  await p.keyboard.press('Enter'); await sleep(1500); // second Enter = measure per the page's own rule
  s.secondEnterMsg = await hudFind(p, /^nothing to measure|^measured|^no electrons/);
  s.bornAuditAfterSecondEnter = await hudFind(p, /^Born audit:/); s.measured = s.bornAuditAfterSecondEnter !== born80299Before && /measured #/.test(s.bornAuditAfterSecondEnter || '');
  s.bornMentionsHaversine = /haversine/.test(s.bornAuditAfterSecondEnter || '');
  a.search80299 = s;

  // (8) Bloch drag — needs an atom in focus; ArrowRight walks the conduction band which always focuses an atom
  await p.evaluate(() => document.querySelector('#search').blur()); await p.keyboard.press('ArrowRight'); await sleep(500);
  const b = {}; b.focus = await hudFind(p, /^conduction band/); b.stateBefore = await hudFind(p, /^state:/);
  const parseState = t => { const m = /θ=([\d.]+)° φ=([\d.]+)°.*\|α\|²\+\|β\|²=([\d.]+)/.exec(t || ''); return m ? { theta: +m[1], phi: +m[2], norm: +m[3] } : null; };
  b.before = parseState(b.stateBefore);
  const sh = await p.evaluate(() => { const r = document.querySelector('#sphereHandle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
  b.handle = sh;
  await p.mouse.move(sh.x, sh.y); await p.mouse.down(); await p.mouse.move(sh.x + 40, sh.y - 30, { steps: 10 }); await sleep(400);
  b.stateDuringDrag = await hudFind(p, /^state:/); b.during = parseState(b.stateDuringDrag);
  b.samples = [b.during];
  await p.mouse.move(sh.x + 80, sh.y + 20, { steps: 10 }); await sleep(400); b.stateDuringDrag2 = await hudFind(p, /^state:/); b.during2 = parseState(b.stateDuringDrag2); b.samples.push(b.during2);
  await p.mouse.up(); await sleep(300); b.stateAfterRelease = await hudFind(p, /^state:/); b.after = parseState(b.stateAfterRelease);
  b.thetaChanged = !!(b.before && b.during && Math.abs(b.during.theta - b.before.theta) > 0.05);
  b.phiChanged = !!(b.before && b.during && Math.abs(b.during.phi - b.before.phi) > 0.05);
  b.preparedByHand = /prepared by hand/.test(b.stateDuringDrag || '');
  b.normAlwaysOne = [b.before, b.during, b.during2, b.after].every(x => x && Math.abs(x.norm - 1) < 0.0005);
  a.bloch = b;

  a.consoleIssuesWholeRun = A.issues.slice();
  await p.screenshot({ path: OUT + 'verify-1-1440.png', fullPage: false });   // (10)
  R.run1440 = a; await p.close();

  // ===== 430 x 900 =====
  const B = await openPage(430, 900); const q = B.page; const c = { width: 430, height: 900, loadMs: B.loadMs };
  c.consoleIssues8s = B.issues.slice();
  c.rendererOwnCanvas = await rendererOwn(q); c.rendererHudLine = await hudFind(q, /^renderer:/);
  c.hudOnGpuLine = await hudFind(q, /^on GPU:/);
  c.hudPointCount = c.hudOnGpuLine ? +(/on GPU: ([\d,]+) line entries/.exec(c.hudOnGpuLine) || [, 'NaN'])[1].replace(/,/g, '') : null;
  c.pointCountMatchesLinesBin = c.hudPointCount === R.linesBin.entries;
  c.pageState = await q.evaluate(() => { const s = window.__qts; return s ? { seaDrawn: s.S.seaDrawn, seaStride: s.S.seaStride, phoneMode: s.S.phoneMode, DPR: s.DPR } : null; });
  c.scrollWidth = await q.evaluate(() => document.documentElement.scrollWidth);
  c.bodyScrollWidth = await q.evaluate(() => document.body.scrollWidth);
  c.innerWidth = await q.evaluate(() => innerWidth);
  c.fps = await fps3s(q);
  c.consoleIssuesWholeRun = B.issues.slice();
  await q.screenshot({ path: OUT + 'verify-1-430.png', fullPage: false });
  R.run430 = c; await q.close();
} catch (e) { R.error = e.stack; }

sampling = false; await sleep(1100);
R.nvidiaLive = live;
const stat = arr => { const u = arr.filter(x => x.util != null).map(x => x.util), m = arr.filter(x => x.memMiB != null).map(x => x.memMiB); const f = v => v.length ? { min: Math.min(...v), max: Math.max(...v), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), n: v.length } : null; return { util: f(u), memMiB: f(m) }; };
R.nvidiaSummary = { idle: stat(idle), live: stat(live), gpuName: (idle[0] || {}).name };
await browser.close();
server.kill(); await sleep(500);
R.serverKilled = server.killed; R.serverLogTail = serverLog.slice(-600);
R.finished = new Date().toISOString();
fs.writeFileSync(OUT + 'verify-1.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
