import { createRequire } from 'node:module';
import fs from 'node:fs';
const puppeteer = createRequire(import.meta.url)(process.env.PUPPETEER_MODULE);
const out = process.env.REPRO_OUT;
if (!out || fs.existsSync(out)) throw new Error('REPRO_OUT must name a new output file');
const browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH, headless: true, args: ['--enable-gpu','--use-gl=angle','--use-angle=d3d11','--ignore-gpu-blocklist']});
const report = {utc: new Date().toISOString(), physicalPhoneTest: false};
try {
  const page = await browser.newPage();
  await page.setViewport({width:430,height:900,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  report.homepageErrors=[];
  page.on('pageerror', e => report.homepageErrors.push(e.message));
  await page.goto('https://globalgrid2050.com/', {waitUntil:'domcontentloaded'});
  report.before = await page.evaluate(() => document.body.innerText);
  await new Promise(r => setTimeout(r,5000));
  report.after = await page.evaluate(() => document.body.innerText);
  report.industryBefore=report.before.includes('Industry Analysis');
  report.industryAfter=report.after.includes('Industry Analysis');
  await page.close();
  const fallback=await browser.newPage();
  report.fallbackErrors=[];
  fallback.on('pageerror',e=>report.fallbackErrors.push(e.message));
  await fallback.evaluateOnNewDocument(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};});
  await fallback.goto('http://127.0.0.1:8891/testcode/202609142225/',{waitUntil:'networkidle0'});
  report.fallbackText=await fallback.evaluate(()=>document.body.innerText);
  await fallback.close();
} finally { await browser.close(); fs.writeFileSync(out,JSON.stringify(report,null,2)); }
console.log(JSON.stringify({industryBefore:report.industryBefore,industryAfter:report.industryAfter,homepageErrors:report.homepageErrors,fallbackErrors:report.fallbackErrors}));
