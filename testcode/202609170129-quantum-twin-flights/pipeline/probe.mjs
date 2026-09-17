// Step PROBE: open the supernova in a real, visible Chrome on this machine's GPU, run a pilot command,
// read the pixels back, and FAIL unless GridAtlas particles were actually drawn.
// usage: node pipeline/probe.mjs "light atlas"
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const command = process.argv[2] || 'light atlas';
const CHROME = process.env.CHROME || '<chrome.exe>';
const URL = process.env.CONSOLE || 'http://127.0.0.1:8791';
const outDir = path.join(HERE, 'probe'); fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, args: ['--window-size=1200,900', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1200, height: 850 });
  const gpu = await (await browser.newPage()).goto('chrome://gpu').then(async p => { const t = await p.evaluate(() => document.body.innerText); return /WebGL2?:\s*(\S+)/.exec(t)?.[1] || 'unknown'; }).catch(() => 'unknown');
  await page.goto(`${URL}/supernova.html`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__probe === 'function');
  const r = await page.evaluate(c => window.__probe(c), command);
  const shot = path.join(outDir, `${stamp}-${command.replace(/\W+/g, '_')}.png`);
  await page.screenshot({ path: shot });
  const result = { step: 'probe', command, webgl: gpu, ...r, screenshot: shot, pass: r.amber_pixels > 500 && r.lit_keys > 0 };
  fs.writeFileSync(path.join(outDir, `${stamp}-result.json`), JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result));
  if (!result.pass) { console.error('FAIL: nothing lit — the picture is blank or the route is empty'); process.exitCode = 1; }
} finally { await browser.close(); }
