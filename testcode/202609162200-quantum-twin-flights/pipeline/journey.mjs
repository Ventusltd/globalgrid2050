// JOURNEY: space → earth → space, four times, in a full-screen Chrome a person can watch. usage: node pipeline/journey.mjs [url]
import puppeteer from 'puppeteer-core';
const URL = process.argv[2] || 'http://127.0.0.1:8791/wafer/'; const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const STOPS = [['land gridatlas', 'gridatlas'], ['land pipelinenews', 'pipelinenews'], ['land spider sandbox', 'spider sandbox'], ['land periodic table', 'periodic table']];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, defaultViewport: null, args: ['--start-maximized', '--ignore-gpu-blocklist'] });
let pass = 0, n = 0;
try {
  const page = await browser.newPage(); await page.goto(URL, { waitUntil: 'networkidle0', timeout: 90000 }); await page.waitForSelector('#pin'); await new Promise(r => setTimeout(r, 2500));
  const type = async s => { await page.click('#pin'); await page.evaluate(() => { document.getElementById('pin').value = ''; }); await page.type('#pin', s, { delay: 35 }); await page.keyboard.press('Enter'); };
  for (const [cmd, name] of STOPS) {
    await type(cmd); await new Promise(r => setTimeout(r, 6000)); const e = await page.evaluate(() => window.__earth()); n++;
    const ok1 = e.open && e.name.includes(name) && e.src.startsWith('http'); if (ok1) pass++; console.log(`${ok1 ? 'PASS' : 'FAIL'} ${cmd} → earth open=${e.open} ${e.name}`);
    await type('space'); await new Promise(r => setTimeout(r, 2500)); const e2 = await page.evaluate(() => window.__earth()); n++;
    const ok2 = !e2.open; if (ok2) pass++; console.log(`${ok2 ? 'PASS' : 'FAIL'} back to space → earth open=${e2.open}`);
  }
} finally { await browser.close(); }
console.log(`journey: ${pass}/${n} · ${URL}`); if (pass !== n) process.exitCode = 1;
