// Star Generator build proof: loads each lens headless at 1440 and 430, records console errors, scrollWidth,
// counts from the live page, and screenshots to proof/build-<lens>-<width>.png. Run from anywhere:
//   node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/build-proof.mjs [port]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const PORT = process.argv[2] || '8873', BASE = `http://127.0.0.1:${PORT}/testcode/202609142225/`;
const OUT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225/proof/';
const LENSES = ['ring', 'particle', 'chord', 'river', 'table', 'column'];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run'] });
const report = { run_utc: new Date().toISOString(), base: BASE, loads: [] };
async function load(url, width, name, opts = {}) {
  const page = await browser.newPage();
  const mobile = width <= 600;
  await page.setViewport({ width, height: mobile ? 900 : 900, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const errors = [], logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); else logs.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => document.getElementById('count') && /blocks on the table/.test(document.getElementById('count').textContent), { timeout: 60000 }).catch(() => errors.push('count sentence never appeared'));
  await new Promise(r => setTimeout(r, opts.wait || 2500));
  const facts = await page.evaluate(() => ({
    title: document.title, url: location.search, count: document.getElementById('count').textContent, countTitle: document.getElementById('count').title,
    scrollWidth: document.documentElement.scrollWidth, innerWidth: innerWidth, hint: document.getElementById('hint').textContent, trail: document.getElementById('trail').textContent,
    legend: [...document.querySelectorAll('#legend .lg:not(.cat)')].map(b => ({ word: b.textContent.trim(), colour: b.querySelector('i').style.backgroundColor, off: b.classList.contains('off'), title: b.title })),
    lensbar: [...document.querySelectorAll('#lensbar a')].map(a => a.textContent + (a.classList.contains('on') ? '*' : '')),
    footer: document.getElementById('footer').textContent, tray: document.getElementById('tray').textContent, labels: [...document.querySelectorAll('#labels span')].filter(s => !s.hidden).length,
    panelOpen: !document.getElementById('panel').hidden, panelHead: (document.querySelector('#panel .u-h') || {}).textContent || null,
    webgl2: !!document.createElement('canvas').getContext('webgl2'), touch: navigator.maxTouchPoints,
    tapTargets: [...document.querySelectorAll('#lensbar a, #panel-foot button, #tray .go, .u-search')].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
  }));
  await page.screenshot({ path: OUT + name + '.png', fullPage: false });
  const rec = { name, url, width, ms: Date.now() - t0, errors, ...facts };
  report.loads.push(rec); console.log(name, rec.scrollWidth, rec.errors.length ? rec.errors : 'no console errors', rec.panelHead || '');
  return page;
}
for (const width of [1440, 430]) {
  // home ring, then a journey through the six lenses with the same key, trail and recipe in the URL
  let page = await load(BASE + '?lens=ring', width, `build-ring-${width}-home`);
  // tap the first block by clicking its position through the page's own grid: use the search box instead (deterministic)
  await page.type('.u-search', 'At'); await page.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 1200));
  const afterTap = await page.evaluate(() => ({ url: location.search, trail: document.getElementById('trail').textContent }));
  report.loads.push({ name: `tap-first-block-${width}`, ...afterTap }); console.log('after search At:', afterTap);
  await page.goBack(); await new Promise(r => setTimeout(r, 800));
  const afterBack = await page.evaluate(() => ({ url: location.search, trail: document.getElementById('trail').textContent, panelOpen: !document.getElementById('panel').hidden }));
  report.loads.push({ name: `back-${width}`, ...afterBack }); console.log('after Back:', afterBack);
  await page.close();
  const q = '&key=family:8285&trail=block:Ce,block:Pn,family:8285&recipe=block:Si,block:Vn,block:Ug,block:Ps,block:Dt,family:8285&data=202609141956';
  for (const lens of LENSES) { const p = await load(BASE + `?lens=${lens}${q}`, width, `build-${lens}-${width}`, { wait: 3500 }); await p.close(); }
  // lens switch keeps key, trail, recipe (click each tab in one page)
  page = await load(BASE + `?lens=ring${q}`, width, `build-switch-${width}`, { wait: 2000 });
  const switches = [];
  for (const lens of LENSES.slice(1)) { await page.click(`#lensbar a:nth-child(${LENSES.indexOf(lens) + 1})`); await new Promise(r => setTimeout(r, 900)); switches.push(await page.evaluate(() => ({ url: location.search, scrollWidth: document.documentElement.scrollWidth, hint: document.getElementById('hint').textContent, edges: undefined }))); }
  report.loads.push({ name: `switch-${width}`, switches }); console.log('switches', switches.map(s => s.url));
  await page.screenshot({ path: OUT + `build-switch-${width}.png` });
  await page.close();
}
// inbound grammars
for (const [name, q] of [['inbound-table', '?block=Cg'], ['inbound-code', '?family=2'], ['inbound-dashboard', '?graph=periodic-table&focus=Cg%20%C2%B7%20Cable%20trench%20geometry'], ['inbound-picker', '?blocks=Si,Vn'], ['inbound-hash', '#family=2'], ['inbound-unknown', '?lens=ring&key=block:Zz']]) { const p = await load(BASE + q, 1440, `build-${name}`, { wait: 1500 }); await p.close(); }
// compose: the tray, the recipe sheet, the hand-off URL, the recipe JSON (acceptance d, §10.4)
{
  const page = await load(BASE + '?lens=table&recipe=block:Si,block:Vn,block:Ug,block:Ps,block:Dt,family:8285,line:17', 1440, 'build-compose-1440', { wait: 3500 });
  const c = await page.evaluate(async () => { const S = window.__star; const j = await S.recipeJSON(); return { tray: document.getElementById('tray').textContent, handOff: S.handOffURL(), needs: S.needsOutside().length, keys: j.keys, blocks: j.blocks.map(b => `${b.symbol}@${(b.files[0] || {}).commit ? b.files[0].commit.slice(0, 7) : 'no pinned place'}`), families: j.families.map(f => `${f.n}:${f.place ? f.place.repo + '@' + f.place.commit.slice(0, 7) : f.note}`), lines: j.lines.map(l => `${l.key}:${l.repo ? l.repo + '@' + l.commit.slice(0, 7) : l.note}`), data: j.data }; });
  await page.click('#tray .cnt'); await new Promise(r => setTimeout(r, 400));
  c.sheet = await page.evaluate(() => document.getElementById('sheet').textContent.slice(0, 600));
  await page.screenshot({ path: OUT + 'build-compose-sheet-1440.png' });
  report.loads.push({ name: 'compose-1440', ...c }); console.log('compose', c);
  // a category is not composable
  await page.evaluate(() => window.__star.state.recipe.length);
  await page.close();
  // the picker renders the hand-off (public page, measured)
  const pk = await browser.newPage(); await pk.setViewport({ width: 1440, height: 900 });
  await pk.goto(c.handOff, { waitUntil: 'networkidle0', timeout: 60000 }); await new Promise(r => setTimeout(r, 2500));
  const picker = await pk.evaluate(() => ({ url: location.href, title: document.title, text: document.body.innerText.slice(0, 400).replace(/\s+/g, ' '), symbols: ['Si', 'Vn', 'Ug', 'Ps', 'Dt'].map(s => document.body.innerText.includes(s)) }));
  await pk.screenshot({ path: OUT + 'build-picker-handoff.png' }); await pk.close();
  report.loads.push({ name: 'picker-handoff', ...picker }); console.log('picker', picker);
}
// GPU facts: all line instances resident once
{
  const page = await load(BASE + '?lens=ring&key=block:Cg', 1440, 'build-gpu-facts', { wait: 4000 });
  const g = await page.evaluate(() => { const S = window.__star; return { linesCount: S.G.linesCount, linesBytes: S.G.linesBytes, N: S.G.N, edgeCount: S.G.edgeCount, geomCount: S.G.geomCount, layoutMs: S.lens._layoutMs, packStats: S.core.packStats, randomStats: S.core.randomStats, entangledStats: S.core.entangledStats, dependsOn: S.core.dependsOnCount, countTitle: document.getElementById('count').title, litOnly: S.G.litOnly, frames: S.G.frames }; });
  report.loads.push({ name: 'gpu-facts', ...g }); console.log('gpu', g); await page.close();
}
await browser.close();
fs.writeFileSync(OUT + 'build-proof.json', JSON.stringify(report, null, 1));
console.log('written', OUT + 'build-proof.json');
