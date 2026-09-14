// Physics critic round 1: what does a second measurement inside the 8 s "collapsed" window do?
// Reads only; uses the page's own window.__qts lab handle.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = 8871;
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--window-size=1440,1000'] });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/testcode/202609142202/index.html`, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction(() => window.__qts && window.__qts.S.atom, { timeout: 30000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hud = async () => page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
const st = async () => page.evaluate(() => { const S = window.__qts.S; return { theta: S.theta, dataTheta: S.dataTheta, phi: S.phi, outcome: S.outcome, collapse: !!S.collapse, reprepareAt: S.reprepareAt, hist: Object.fromEntries(S.hist), twinChosen: S.twin && S.twin.chosen && S.twin.chosen.label }; });
const out = { before: await st() };
await page.click('#measure'); await sleep(300); out.after1 = await st(); out.hud1 = (await hud()).filter(l => /^state:|^Born|^twin tier|^re-prepare/.test(l));
// second, third ... measurements inside the window, without waiting for re-preparation
const seq = []; for (let i = 0; i < 12; i++) { await page.click('#measure'); await sleep(60); const s = await st(); seq.push({ outcome: s.outcome, theta: +s.theta.toFixed(4), collapse: s.collapse, twin: s.twinChosen }); }
out.insideWindow = seq; out.hudEnd = (await hud()).filter(l => /^state:|^Born|^histogram|^re-prepare/.test(l));
// the Bloch dot uniform after collapse: read the shader's target (u_theta comes from S.theta, not from the outcome)
out.blochUniformSource = 'BLOCH_VS mixes u_theta toward 0/PI by u_collapseT; S.theta itself is never set to 0/PI on collapse (quantum.js line 418, 591)';
out.errors = errors;
fs.writeFileSync('C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/critic/remeasure.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
