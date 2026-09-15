// Physics critic round 2: measure what the page prints and does (headless Chrome, reads only).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const URL = 'http://127.0.0.1:8873/testcode/202609142202/index.html';
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/critic2/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = {};
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--window-size=1440,1000']
});
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__qts && window.__qts.S.atom, { timeout: 30000 }); await sleep(1500);
const hud = () => page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
const stateLine = async () => (await hud()).find(t => t.startsWith('state:'));
const bornLine = async () => (await hud()).find(t => t.startsWith('Born audit:'));
const search = async q => { await page.evaluate(() => document.querySelector('#search').value = ''); await page.type('#search', q); await page.keyboard.press('Enter'); await sleep(300); };

// 1. default focus
R.default = { state: await stateLine(), labels: await page.evaluate(() => Array.from(document.querySelectorAll('#labels .lb')).map(l => l.textContent)) };

// 2. census facts as the page reads them: M-shell vs valence/tunnelling
R.census = await page.evaluate(() => {
  const { D } = window.__qts; const A = D.electron.atoms;
  const pT = a => a.shells.M / (a.shells.K + a.shells.L + a.shells.M);
  return {
    shipped: A.length,
    tunnelling_true: A.filter(a => a.tunnelling === true).length,
    tunnelling_false: A.filter(a => a.tunnelling === false).length,
    valence0: A.filter(a => a.valence === 0).length,
    M_gt_0: A.filter(a => a.shells.M > 0).length,
    tunnelling_false_but_page_P_tunnel_gt_0: A.filter(a => a.tunnelling === false && pT(a) > 0).length,
    valence_equals_M: A.filter(a => a.valence === a.shells.M).length,
    valence_lt_M: A.filter(a => a.valence < a.shells.M).length,
    electron_json_note: D.electron.note,
    hud_caveat: Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent).find(t => t.startsWith('data caveats')),
    example_1: (() => { const a = D.atomByN.get(1); return { n: a.n, name: a.name, class: a.class, shells: a.shells, valence: a.valence, tunnelling: a.tunnelling, homes: a.homes, page_P_tunnel: pT(a) }; })(),
    identical_shell_triples: (() => { const m = new Map(); A.forEach(a => { const k = a.shells.K + '/' + a.shells.L + '/' + a.shells.M; m.set(k, (m.get(k) || 0) + 1); }); return Array.from(m.entries()).sort((x, y) => y[1] - x[1]).slice(0, 5); })()
  };
});

// 3. steer to #1 clampInteger (tunnelling:false, valence 0) and read what the page prints
await search('#1'); R.atom1 = { state: await stateLine(), labels: await page.evaluate(() => Array.from(document.querySelectorAll('#labels .lb')).map(l => l.textContent)), twinTier: (await hud()).find(t => t.startsWith('twin tier')) };
// measure it a few times until a TUNNEL appears (P=0.409): what does the Born line say?
R.atom1.measurements = [];
for (let i = 0; i < 12; i++) { await page.click('#reprepare'); await page.click('#measure'); await sleep(60); const b = await bornLine(); R.atom1.measurements.push(b); if (/TUNNEL/.test(b)) break; }
R.atom1.stateAfter = await stateLine();

// 4. Born rule on the prepared data state: #2039 Number, P(tunnel)=20/60
await search('#2039'); await sleep(200);
const N = 600; for (let i = 0; i < N; i++) { await page.click('#reprepare'); await page.click('#measure'); }
await sleep(300);
R.born2039 = await page.evaluate(() => { const { S, D } = window.__qts; const a = D.atomByN.get(2039); const h = S.hist.get(2039); return { shells: a.shells, dataTheta_deg: S.dataTheta * 180 / Math.PI, expected_P_tunnel: Math.sin(S.dataTheta / 2) ** 2, hist: h, observed_P_tunnel: h.tunnel / h.n }; });
R.born2039.histLine = (await hud()).find(t => t.startsWith('histogram'));
// binomial sigma
{ const p = R.born2039.expected_P_tunnel, n = R.born2039.hist.n; R.born2039.sigma = Math.sqrt(p * (1 - p) / n); R.born2039.z = (R.born2039.observed_P_tunnel - p) / R.born2039.sigma; }

// 5. collapse: the state is the pole; repeats reproduce
R.collapse = await page.evaluate(() => { const { S } = window.__qts; return { theta_after_measure: S.theta, outcome: S.outcome, phi: S.phi, P_tunnel_now: Math.sin(S.theta / 2) ** 2 }; });
R.collapse.stateLine = await stateLine();
R.collapse.repeats = []; for (let i = 0; i < 5; i++) { await page.click('#measure'); await sleep(40); R.collapse.repeats.push((await bornLine()).slice(0, 120)); }
R.collapse.allSameOutcome = R.collapse.repeats.every(t => /TUNNEL again/.test(t)) || R.collapse.repeats.every(t => /HOME again/.test(t));
R.collapse.histUnchangedByRepeats = await page.evaluate(() => window.__qts.S.hist.get(2039).n);

// 6. normalisation as printed: P(home)+P(tunnel) from the HUD for a hand-prepared state
await page.evaluate(() => { const { S } = window.__qts; S.hand = { theta: 2.1, phi: 0.7 }; }); await sleep(300);
{ const s = await stateLine(); const m = /P\(home\)=([\d.]+) P\(tunnel\)=([\d.]+)/.exec(s); R.hand = { state: s, sum: m ? (+m[1] + +m[2]) : null, expected_P_tunnel_theta_2p1: Math.sin(2.1 / 2) ** 2 }; }
await page.click('#measure'); await sleep(60); R.hand.born = await bornLine(); R.hand.state_after = await stateLine();
R.hand.hist_n_unchanged = await page.evaluate(() => window.__qts.S.hist.get(2039).n);

// 7. SOUL tier wording (#6666 failed is entangled; is it shipped as an atom?)
R.soul = await page.evaluate(() => { const { D } = window.__qts; return { ent6666_shipped_atom: D.atomByN.has(6666), ent766_shipped_atom: D.atomByN.has(766), entangled_and_shipped: D.entangled.entanglements.filter(e => D.atomByN.has(e.n)).map(e => e.n) }; });
await search('#766'); await sleep(200); await page.evaluate(() => { const { S } = window.__qts; S.dataTheta = Math.PI / 2; S.theta = Math.PI / 2; });
R.soul.tierLine = (await hud()).find(t => t.startsWith('twin tier'));
R.soul.outcomes = []; for (let i = 0; i < 6; i++) { await page.click('#reprepare'); await page.evaluate(() => { const { S } = window.__qts; S.dataTheta = Math.PI / 2; S.theta = Math.PI / 2; }); await page.click('#measure'); await sleep(40); R.soul.outcomes.push((await hud()).find(t => t.startsWith('twin tier')).split('·').slice(-3).join('·').trim()); }

// 8. idle line & precession claim
R.phiAtPole = await page.evaluate(() => { const { S } = window.__qts; return { theta: S.theta, phi: S.phi, outcome: S.outcome }; });
await page.screenshot({ path: OUT + 'physics2-1440.png' });
R.errors = errors;
fs.writeFileSync(OUT + 'physics2.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
await browser.close();
