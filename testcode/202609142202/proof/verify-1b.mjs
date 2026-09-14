// Independent GPU runner, round 1 — supplement to verify-1.mjs.
// Round-1 main run clicked a point whose family has no electron record, so the page refused to measure.
// Here: click a point of a family that HAS a name-matched atom, then measure; and drag the Bloch handle downward so theta moves.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const ROOT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050';
const DIR = ROOT + '/testcode/202609142202';
const OUT = DIR + '/proof/';
const PORT = 8871;
const URL = `http://127.0.0.1:${PORT}/testcode/202609142202/index.html`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = { url: URL, started: new Date().toISOString() };
const bin = fs.readFileSync(DIR + '/data/lines.bin');
const keys = new Uint32Array(bin.buffer, bin.byteOffset, bin.byteLength >>> 2); const keySet = new Set(keys);
R.linesBin = { bytes: bin.byteLength, entries: keys.length };

const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await sleep(1500);
const browser = await puppeteer.launch({ headless: 'new', executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--no-sandbox', '--window-size=1440,1000'] });
const hudLines = p => p.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
const hudFind = async (p, re) => (await hudLines(p)).find(t => re.test(t)) || null;
const parseState = t => { const m = /θ=([\d.]+)° φ=([\d.]+)°.*\|α\|²\+\|β\|²=([\d.]+)/.exec(t || ''); return m ? { theta: +m[1], phi: +m[2], norm: +m[3] } : null; };
try {
  const p = await browser.newPage(); const issues = [];
  p.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning' || t === 'warn') issues.push(t + ': ' + m.text()); });
  p.on('pageerror', e => issues.push('pageerror: ' + e.message)); p.on('requestfailed', r => issues.push('requestfailed: ' + r.url()));
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto(URL, { waitUntil: 'load', timeout: 120000 }); await sleep(6000);
  R.renderer = await hudFind(p, /^renderer:/);
  await p.evaluate(() => { document.querySelector('#hud').style.pointerEvents = 'none'; });
  // choose families whose name matches a shipped atom with K+L+M > 0, spread across the list; click each until a pick hits
  const cands = await p.evaluate(() => { const { D } = window.__qts; const out = []; for (let fi = 0; fi < D.families.length; fi += 97) { const f = D.families[fi]; const at = D.atomByName.get(f.name); if (at && at[0] && (at[0].shells.K + at[0].shells.L + at[0].shells.M) > 0) out.push({ fi, n: f.n, name: f.name, atomN: at[0].n }); } return out.slice(0, 12); });
  R.candidates = cands;
  const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  let hit = null; R.clickLog = [];
  for (const cnd of cands) {
    const pt = await p.evaluate(fi => { const { S, G, familyPos, DPR } = window.__qts; const c = document.querySelector('#gl').getBoundingClientRect(); const pos = familyPos(fi); return { x: c.left + (G.c0[0] + pos[0] * G.R + S.view.x) / DPR, y: c.top + (G.c0[1] + pos[1] * G.R + S.view.y) / DPR }; }, cnd.fi);
    for (const [dx, dy] of offsets) { const x = Math.round(pt.x + dx), y = Math.round(pt.y + dy); await p.mouse.click(x, y); await sleep(300); const msg = await hudFind(p, /^#\d+ · family #\d+|^tap hit no entry/); R.clickLog.push({ target: cnd.n, x, y, msg }); const m = /^#(\d+) · family #(\d+)/.exec(msg || ''); if (m) { hit = { target: cnd, clickedAt: { x, y }, msg, key: +m[1], familyN: +m[2] }; break; } }
    if (hit) { const st = await hudFind(p, /^state:|^shells not shipped/); hit.stateAfterClick = st; if (/^state:/.test(st || '')) break; hit = null; } // keep going if the hit family has no atom
  }
  R.pick = hit;
  if (hit) {
    hit.keyInLinesBin = keySet.has(hit.key);
    await sleep(800);
    const panel = await p.evaluate(() => { const el = document.querySelector('#lines'); return { hidden: el.hidden, header: (el.querySelector('.u-h') || {}).textContent || null, keys: Array.from(el.querySelectorAll('.u-line .u-key')).map(s => +s.textContent) }; });
    hit.linesPanel = { hidden: panel.hidden, header: panel.header, shownKeys: panel.keys.length, firstKeys: panel.keys.slice(0, 8), allShownKeysExistInLinesBin: panel.keys.length > 0 && panel.keys.every(k => keySet.has(k)) };
    hit.joinLine = await hudFind(p, /^join:/);
    hit.bornBefore = await hudFind(p, /^Born audit:/);
    // the page's rule: a tap on the sphere / the measure button / a second Enter measures. Use the measure button.
    await p.click('#measure'); await sleep(1500);
    hit.bornAfterMeasure = await hudFind(p, /^Born audit:/); hit.stateAfterMeasure = await hudFind(p, /^state:/); hit.twinLine = await hudFind(p, /^twin tier:/);
    hit.measured = hit.bornAfterMeasure !== hit.bornBefore && /measured #/.test(hit.bornAfterMeasure || '');
    hit.record = await p.evaluate(() => document.querySelector('#record').textContent);
    // also: does a tap on the sphere itself measure? (second measurement)
    const sh = await p.evaluate(() => { const r = document.querySelector('#sphereHandle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(sh.x, sh.y); await sleep(1500); hit.bornAfterSphereTap = await hudFind(p, /^Born audit:/); hit.sphereTapMeasured = hit.bornAfterSphereTap !== hit.bornAfterMeasure && /measured #/.test(hit.bornAfterSphereTap || '');
    await sleep(2500); hit.cableLine = await hudFind(p, /^cable:/);
    // Bloch drag, downward this time (dy > 0 lowers theta) — state is post-collapse; the drag re-prepares by hand
    const b = {}; b.stateBefore = await hudFind(p, /^state:/); b.before = parseState(b.stateBefore);
    await p.mouse.move(sh.x, sh.y); await p.mouse.down(); await p.mouse.move(sh.x + 35, sh.y + 45, { steps: 10 }); await sleep(400);
    b.stateDuring = await hudFind(p, /^state:/); b.during = parseState(b.stateDuring);
    await p.mouse.move(sh.x - 20, sh.y + 90, { steps: 10 }); await sleep(400); b.stateDuring2 = await hudFind(p, /^state:/); b.during2 = parseState(b.stateDuring2);
    await p.mouse.up(); await sleep(300); b.stateAfter = await hudFind(p, /^state:/); b.after = parseState(b.stateAfter);
    b.thetaChanged = !!(b.before && b.during && Math.abs(b.during.theta - b.before.theta) > 0.05); b.phiChanged = !!(b.before && b.during && Math.abs(b.during.phi - b.before.phi) > 0.05);
    b.normAlwaysOne = [b.before, b.during, b.during2, b.after].every(x => x && Math.abs(x.norm - 1) < 0.0005); b.preparedByHand = /prepared by hand/.test(b.stateDuring || '');
    R.bloch = b;
  }
  R.consoleIssues = issues;
  await p.screenshot({ path: OUT + 'verify-1b-1440.png' });
  await p.close();
} catch (e) { R.error = e.stack; }
await browser.close();
try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F']); R.serverKill = 'taskkill ok pid ' + server.pid; } catch (e) { R.serverKill = 'taskkill failed: ' + e.message; }
R.finished = new Date().toISOString();
fs.writeFileSync(OUT + 'verify-1b.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
