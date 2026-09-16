// USERS: a real Chrome on this machine opens the live page and types fifty lines, one after another,
// as a person would (into the box, Enter). After each line the card or log must show what a person
// would expect. One line per test; a screenshot every ten. Fails if any expectation is not met.
// usage: node pipeline/users.mjs [url]     default: https://ventusltd.github.io/star-electron-star/
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URL = process.argv[2] || 'https://ventusltd.github.io/star-electron-star/';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out = path.join(HERE, 'probe'); fs.mkdirSync(out, { recursive: true }); const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const T = [ // [what a user types, what must appear (regex) in the card or the log]
  ['help', /commands/i], ['block 39885', /beam is on line 39885/], ["twin 39885", /line 3672/], ['state 39885', /HOME P = /], ['measure 39885', /result: <?b?>?(HOME|AWAY)/],
  ['measure 39885', /Draw 2/], ['connect 39885 1217', /connect 39885 → 1217/], ['apps', /19 apps/], ['app gridatlas', /app gridatlas/], ['app globalgrid2050', /app globalgrid2050/],
  ['entangle', /128,369 of 128,369/], ['run voltage-drop.voltageDropVolts {"currentA":120,"lengthM":250,"resistanceOhmPerKm":0.32,"powerFactor":0.95,"phases":"three"}', /15\.796/],
  ['run voltage-drop.voltageDropVolts {"currentA":120,"lengthM":250,"resistanceOhmPerKm":0.32}', /refused/], ['run diversified-demand.diversifiedDemandKw {"unitCount":900,"perUnitKw":3,"coincidenceFactor":0.4}', /1080/],
  ['run diversified-demand.diversifiedDemandKw {"unitCount":900,"perUnitKw":3,"coincidenceFactor":0.4}', /chartered electrical engineer/], ['run current-from-power.currentA {"apparentPowerVa":100000,"voltageV":400,"phases":"three"}', /144\.3/],
  ['run firm-capacity.apparentPowerMva {"mw":10,"powerFactor":0.9}', /11\.11/], ['run voltage-drop.nope {}', /refused/], ['engine', /voltage-drop:/],
  ['what is the voltage drop for 120 amps over 250 metres at 0.32 ohm per km, power factor 0.95, three phase', /15\.796/],
  ['voltage drop for 120 A over 250 m at 0.32 Ω per km pf 1 three phase', /"powerFactor":1/], ['voltage drop for 120 amps over 250 metres at 0.32 ohm', /needs:/],
  ['diversified demand for 900 houses at 3 kw each coincidence 0.4', /1080/], ['show me gridatlas', /app gridatlas/], ['fly to 39885', /beam is on line 39885/],
  ['read 39885', /line 3672/], ["twin 2", /cable-trench-or-drill/], ['state 2', /HOME P = /], ['measure 2', /result:/], ['block 999999999', /block 999999999/],
  ['state 999999999', /no family record/], ['purple monkey dishwasher', /no command matched/], ['reset', /reset/], ['block 1217', /beam is on line 1217/], ["twin 1217", /line [0-9]+/],
  ['apps', /working index/], ['app testcode', /app testcode/], ['app elements', /app elements/], ['app stars', /app stars/], ['app cvaa', /no app|app cvaa/],
  ['state 39885', /K 1 same directory/], ['measure 39885 alpha', /seed "alpha"/], ['measure 39885', /Draw/], ['connect 2 39885', /connect 2 → 39885/], ['help', /block/],
  ['run voltage-drop.voltageDropVolts {"currentA":-5,"lengthM":250,"resistanceOhmPerKm":0.32,"powerFactor":0.9}', /refused/], ['run voltage-drop.dropPercent {"dropVolts":15.796,"nominalVolts":400}', /3\.9/],
  ['show me the versions', /no command matched|versions/], ['block 39885', /beam/], ['reset', /reset/],
];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] });
const lines = []; let pass = 0;
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 90000 }); await page.waitForSelector('#pin', { timeout: 60000 }); await new Promise(r => setTimeout(r, 2500));
  for (let i = 0; i < T.length; i++) {
    const [typed, expect] = T[i]; const t0 = Date.now();
    await page.click('#pin'); await page.evaluate(() => { document.getElementById('pin').value = ''; }); await page.type('#pin', typed, { delay: 4 }); await page.keyboard.press('Enter');
    let ok = false, seen = ''; for (let w = 0; w < 30 && !ok; w++) { await new Promise(r => setTimeout(r, 200)); seen = await page.evaluate(() => (document.getElementById('say')?.innerHTML || '') + '\n' + (document.getElementById('plog')?.innerText || '')); ok = expect.test(seen); }
    if (ok) pass++; const line = `${String(i + 1).padStart(2)} ${ok ? 'PASS' : 'FAIL'} ${String(Date.now() - t0).padStart(5)}ms · ${typed.slice(0, 70)}${ok ? '' : ' · saw: ' + seen.replace(/\s+/g, ' ').slice(0, 120)}`;
    lines.push(line); console.log(line);
    if ((i + 1) % 10 === 0) await page.screenshot({ path: path.join(out, `USERS-${stamp}-${i + 1}.png`) });
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, `USERS-${stamp}.txt`), lines.join('\n') + `\n${pass}/${T.length} pass · ${URL}\n`);
console.log(`\nusers: ${pass}/${T.length} pass · ${URL}`); if (pass !== T.length) process.exitCode = 1;
