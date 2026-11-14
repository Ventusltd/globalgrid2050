#!/usr/bin/env node
/**
 * Agent 3 P2 actual-browser acceptance, read-only and fail-closed.
 * Usage: node automation/pipeline_release/agent3_browser_csv_map.mjs \
 *   --release-dir uk_renewables_pipeline/NEW_ID \
 *   --url https://globalgrid2050.com/uk_renewables_pipeline/NEW_ID/ \
 *   --out /tmp/agent3-browser.json
 * Requires 'npm ci' and Playwright Chromium installation in --release-dir.
 * Tests 1440x900 and 390x844, actual CSV download, real MAP click, REPD IDs.
 * This never merges, deploys, promotes, publishes, or writes to the release.
 */
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
function argument(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const url = argument("--url");
const releaseDir = argument("--release-dir");
const output = argument("--out");
const count = Number(argument("--expected-rows") || "7775");
if (!url || !releaseDir || !output || !Number.isInteger(count) || count < 1) {
  console.error("Need --url, --release-dir, --out and optional --expected-rows");
  process.exit(2);
}
if (!/^https:\/\/[^/]+\/uk_renewables_pipeline\/20\d{10}\/$/.test(url)) {
  console.error("A real HTTPS immutable candidate release URL is required");
  process.exit(2);
}
let chromium;
try {
  // Resolve the pinned Playwright installation of the version under test.
  const require = createRequire(join(resolve(releaseDir), "package.json"));
  ({ chromium } = require("playwright"));
} catch (error) {
  console.error("Playwright missing: run npm ci in the candidate version directory", error);
  process.exit(2);
}
const RECEIVER = "https://ventusltd.github.io/gridatlas/atlas/";
const viewports = [{label:"desktop",width:1440,height:900}, {label:"mobile",width:390,height:844}];

function parseCsv(raw) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i+1] === '"') {cell += '"';i++;}
      else {quoted = !quoted;}
    } else if (c === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && raw[i+1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(x => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (quoted) throw Error("Unterminated CSV quote");
  if (cell.length || row.length) {row.push(cell); rows.push(row);}
  return rows;
}

function inspectCsv(raw) {
  if (/(?:dcuk-\d+|"technology"\s*:\s*"data[_-]?centre")/i.test(raw))
    throw Error("Unlicensed DC record in downloaded CSV");
  const rows = parseCsv(raw.replace(/^\uFEFF/, ""));
  if (!rows.length) throw Error("CSV empty");
  const head = rows[0].map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const refcol = head.findIndex(x => ["repdref","repdreference","repdrefid","repdreferenceid"].includes(x));
  if (refcol < 0) throw Error("Missing explicit REPD Ref column: " + head.join(","));
  if (rows.length - 1 !== count) throw Error("Expected " + count + " CSV rows, got " + (rows.length - 1));
  const seen = new Set();
  for (const row of rows.slice(1)) {
    if (row.length !== head.length) throw Error("Malformed CSV width");
    const id = row[refcol]?.trim();
    if (!/^\d+$/.test(id) || seen.has(id)) throw Error("Invalid or duplicate CSV REPD Ref: " + id);
    seen.add(id);
  }
  if (seen.size !== count) throw Error("CSV unique REPD count mismatch");
  return {downloaded: true, records: seen.size, ref_column: rows[0][refcol]};
}

let browser;
const results = [];
try {
  browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
  for (const vp of viewports) {
    const evidence = {
      viewport:vp.label, width:vp.width, height:vp.height,
      browser:"Chromium/Playwright", url, js_errors:[], failed_same_origin:[],
      csv:null, map:null, no_dc_visible:null, pass:false
    };
    const ctx = await browser.newContext({viewport:{width:vp.width,height:vp.height},
                                         acceptDownloads:true});
    const page = await ctx.newPage();
    page.on("pageerror", e => evidence.js_errors.push(String(e).slice(0,300)));
    page.on("console", m => {if(m.type()==="error") evidence.js_errors.push(m.text().slice(0,300));});
    page.on("requestfailed", req => {
      try {if (new URL(req.url()).origin === new URL(url).origin)
        evidence.failed_same_origin.push(req.url()+" "+(req.failure()?.errorText||"failed"));}catch{}
    });
    try {
      const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
      if (!response || response.status()!==200) throw Error("Browser candidate GET not HTTP 200");
      await page.locator('#tbody[data-complete="true"]').waitFor({state:"attached",timeout:90000});
      const text=await page.locator("#resultsMeta").innerText();
      const reported=Number((text.match(/of\s+([\d,]+)\s+records/i)||[])[1]?.replaceAll(",",""));
      if (reported!==count) throw Error("Browser loaded "+reported+" rows, expected "+count);
      const scroll=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
      if (scroll) throw Error("Horizontal overflow");
      const currentText=await page.locator("body").innerText();
      evidence.no_dc_visible=!/\bdcuk-\d+\b/i.test(currentText);
      if (!evidence.no_dc_visible) throw Error("Unverified DC site ID visible in page");
      const link=page.locator('#tbody tr[id^="repd-"] a.atlaslink').first();
      await link.waitFor({state:"visible",timeout:30000});
      const href=await link.getAttribute("href");
      const rowId=await link.locator("xpath=ancestor::tr[1]").getAttribute("id");
      const ref=rowId?.replace(/^repd-/,"");
      const dest=new URL(href,url);
      if (dest.origin+dest.pathname!==RECEIVER || !/^\d+$/.test(ref||"") ||
          dest.searchParams.get("repd_ref")!==ref) throw Error("MAP receiver/ref mismatch");
      // A link inspection alone is not a click: explicitly click and capture
      // the browser's new page. Network/browser errors are recorded, not masked.
      const newTab=page.waitForEvent("popup",{timeout:20000});
      await link.click();
      const popup=await newTab;
      const opened=new URL(popup.url());
      if (opened.origin+opened.pathname!==RECEIVER ||
          opened.searchParams.get("repd_ref")!==ref) throw Error("Clicked MAP receiver/ref mismatch");
      evidence.map={clicked:true,repd_ref:ref,href:dest.href,opened:popup.url()};
      await popup.close();
      const downloadPromise=page.waitForEvent("download",{timeout:60000});
      await page.locator("#exportInline").click({timeout:20000});
      const download=await downloadPromise;
      const pathname=await download.path();
      const csv=await readFile(pathname,"utf8");
      evidence.csv=inspectCsv(csv);
      evidence.csv.filename=download.suggestedFilename();
      if(evidence.js_errors.length || evidence.failed_same_origin.length)
        throw Error("Browser JS error or same-origin request failure");
      evidence.record_count=reported;
      evidence.pass=true;
    } catch(error) {
      evidence.error=String(error?.stack||error).slice(0,900);
    } finally {
      results.push(evidence);
      await ctx.close();
    }
  }
} catch(error) {
  results.push({pass:false,fatal:String(error)});
} finally {
  if(browser) await browser.close();
}
const report={
  schema:"ventus.agent3.p2.real-browser-csv-map.v1",
  served_url:url, expected_rows:count,
  pass:results.length===2 && results.every(x=>x.pass===true),
  note:"Real Chromium at both widths, actual filtered CSV download and MAP popup; NOT a publisher-rights or owner-release authorisation.",
  results
};
await mkdir(dirname(resolve(output)),{recursive:true});
await writeFile(resolve(output),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({pass:report.pass,out:output,
  viewport_results:results.map(r=>({viewport:r.viewport,pass:r.pass,error:r.error||r.fatal||null}))}));
process.exit(report.pass?0:2);
