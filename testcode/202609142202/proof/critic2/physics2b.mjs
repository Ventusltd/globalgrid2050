// Physics critic round 2b: SOUL tier via the conduction band, ENTANGLED_MAYBE effective probability, noble-atom TUNNEL wording.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const URL = 'http://127.0.0.1:8873/testcode/202609142202/index.html';
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/critic2/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = {};
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--window-size=1440,1000'] });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__qts && window.__qts.S.atom, { timeout: 30000 }); await sleep(1000);
const hud = () => page.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
const line = async p => (await hud()).find(t => t.startsWith(p));
const focusSoul = async n => { await page.click('body'); await page.evaluate(n => { const { D, S } = window.__qts; S.bandPos = D.band.indexOf(n) - 1; }, n); await page.keyboard.press('ArrowRight'); await sleep(300); };

// SOUL tier: #766 geometry (K0 L0 M9 → θ=180°, pure |1>), and the HOME branch by hand-prepared θ=90° (drag path emulated through the DOM handle)
await focusSoul(766); R.soul = { tier: await line('twin tier'), state: await line('state:') };
const handle = await page.$('#sphereHandle'); const bb = await handle.boundingBox();
const dragMeasure = async dy => { // drag on the handle (pointer events), release → relaxation; then measure during relaxation is "not counted"; so measure by hand: press, move, release then immediately click measure
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 + dy, { steps: 5 }); await page.mouse.up(); await page.click('#measure'); await sleep(50); };
R.soul.draws = [];
for (let i = 0; i < 8; i++) { await page.click('#reprepare'); await sleep(30); await dragMeasure(75); R.soul.draws.push({ born: (await line('Born audit')).slice(0, 110), twin: (await line('twin tier')).split(' · ').filter(s => /twin fixed|twin drew/.test(s)).join(' · ') }); }

// ENTANGLED_MAYBE: find a shipped atom with a maker ENTANGLED_MAYBE edge
const em = await page.evaluate(() => { const { D } = window.__qts; const sn = k => { const m = /^#(\d+)\s/.exec(k); return m ? +m[1] : null; };
  const c = D.random.edges.filter(e => e.kind === 'ENTANGLED_MAYBE' && e.p != null).map(e => [sn(e.from), sn(e.to), e.p]).filter(([a, b]) => D.atomByN.has(a) || D.atomByN.has(b)); return c.slice(0, 5); });
R.em = { candidates: em };
if (em.length) { const n = em[0][0] && await page.evaluate(n => window.__qts.D.atomByN.has(n), em[0][0]) ? em[0][0] : em[0][1];
  await page.evaluate(n => { const { D, S } = window.__qts; S.bandPos = 0; D.band[0] = n; }, n); await page.click('body'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight'); await sleep(300);
  R.em.tier = await line('twin tier'); R.em.state = await line('state:');
  R.em.draws = []; for (let i = 0; i < 6; i++) { await page.click('#reprepare'); await page.click('#measure'); await sleep(40); R.em.draws.push((await line('twin tier')).split(' · ').filter(s => /twin fixed|twin drew|effective/.test(s)).join(' · ')); }
}
// noble atom with tunnelling:false: what the TUNNEL outcome prints (atom #1) and how many such atoms are reachable by name from a family
R.noble = await page.evaluate(() => { const { D } = window.__qts; const A = D.electron.atoms.filter(a => a.tunnelling === false); return { tunnelling_false: A.length, of_which_name_matched_to_a_family: A.filter(a => D.famByName.has(a.name)).length, classes: A.reduce((m, a) => (m[a.class] = (m[a.class] || 0) + 1, m), {}) }; });
R.errors = errors; fs.writeFileSync(OUT + 'physics2b.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1)); await browser.close();
