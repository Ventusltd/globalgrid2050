#!/usr/bin/env node
/* browser_check.mjs - load Pipeline News version pages in headless Chrome and
 * record what a reader's browser sees. No dependencies: Node 22 (built-in
 * WebSocket and fetch) and a Chrome binary, driven over the DevTools protocol.
 *
 * Usage: node browser_check.mjs <base url ending in /uk_renewables_pipeline/> <out.json> <id> [<id> ...]
 * For each version and each viewport (desktop 1440x900, phone 390x844) it records:
 * the results line and record count, rows drawn, uncaught page errors, console
 * errors, failed requests (same-origin and external apart), horizontal overflow
 * on the phone, and the MAP links of the first rows.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base, outPath, ...ids] = process.argv.slice(2);
if (!base || !outPath || !ids.length) { console.error("usage: browser_check.mjs <base> <out.json> <id>..."); process.exit(2); }
const CHROME = process.env.CHROME_BIN || ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Start Chrome and wait for its DevTools port; a slow start gets a second attempt.
let profile = "", chrome = null, wsUrl = "";
for (let attempt = 1; attempt <= 3 && !wsUrl; attempt += 1) {
  profile = mkdtempSync(join(tmpdir(), "pn-chrome-"));
  chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 300 && !wsUrl; i += 1) {
    await sleep(100);
    const f = join(profile, "DevToolsActivePort");
    if (existsSync(f)) { const [port, path] = readFileSync(f, "utf8").trim().split("\n"); if (path) wsUrl = `ws://127.0.0.1:${port}${path}`; }
  }
  if (!wsUrl) { console.error(`Chrome did not open its DevTools port in 30 s (attempt ${attempt})`); chrome.kill("SIGKILL"); }
}
if (!wsUrl) { console.error("Chrome did not start"); process.exit(2); }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const waiting = new Map();
const listeners = new Set();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && waiting.has(msg.id)) { const { res, rej } = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
  else for (const l of listeners) l(msg);
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; waiting.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId }));
});

async function visit(id, vp) {
  const url = `${base}${id}/`;
  const origin = new URL(url).origin;
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const rec = { viewport: vp.name, url, page_errors: [], console_errors: [], failed_same_origin: [], failed_external: [] };
  const requests = new Map();
  const listen = (msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params || {};
    if (msg.method === "Runtime.exceptionThrown") rec.page_errors.push(String(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text).slice(0, 300));
    if (msg.method === "Runtime.consoleAPICalled" && p.type === "error") rec.console_errors.push(p.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300));
    if (msg.method === "Network.requestWillBeSent") requests.set(p.requestId, p.request.url);
    const fail = (u, why) => (u.startsWith(origin) ? rec.failed_same_origin : rec.failed_external).push(`${why} ${u}`.slice(0, 300));
    if (msg.method === "Network.loadingFailed" && !p.canceled) fail(requests.get(p.requestId) || "?", p.errorText || "failed");
    if (msg.method === "Network.responseReceived" && p.response.status >= 400) fail(p.response.url, String(p.response.status));
  };
  listeners.add(listen);
  await send("Runtime.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  await send("Page.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile }, sessionId);
  await send("Page.navigate", { url }, sessionId);
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId)).result?.value;
  let complete = false;
  for (let i = 0; i < 240 && !complete; i += 1) {
    await sleep(250);
    complete = await evaluate("document.querySelector('#tbody')?.dataset.complete === 'true'").catch(() => false);
  }
  await sleep(Number(process.env.SETTLE_MS || 2500));
  const state = await evaluate(`(() => {
    const q = (s) => document.querySelector(s);
    const meta = q('#resultsMeta')?.textContent || '';
    const rows = [...document.querySelectorAll('#tbody tr')];
    const links = (sel) => rows.map((r) => r.querySelector(sel)?.href || '').filter(Boolean);
    return {
      results_meta: meta,
      record_count: Number((meta.match(/of ([\\d,]+) records/) || [])[1]?.replace(/,/g, '') || NaN),
      rows_drawn: rows.length,
      map_links: links('a.map-link, a[href*="gridatlas/atlas/"]').length,
      first_map_link: links('a.map-link, a[href*="gridatlas/atlas/"]')[0] || '',
      title: document.title,
      h1: q('h1')?.textContent || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      features: {
        newspaper: !!q('section.newspaper'),
        datacentre_news_panel: !!q('#dcNews'),
        nearest_datacentres: document.querySelectorAll('[data-feature="nearest-datacentres"]').length,
        register_changes_in_rows: document.querySelectorAll('[data-feature="register-change"]').length,
        gridatlas_state_file: !!document.querySelector('script[src*="gridatlas-state.js"]'),
        gridatlas_state_notes: document.querySelectorAll('.ga-state').length,
        register_changes_section: !!q('#regChanges'),
      },
    };
  })()`).catch((e) => ({ error: String(e) }));
  Object.assign(rec, { complete }, state);
  if (!vp.mobile) {
    // CSV export of the unfiltered table: row count, header and a hash of the body.
    const dir = mkdtempSync(join(tmpdir(), "pn-csv-"));
    try {
      await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
      await evaluate("document.querySelector('#exportInline')?.click()");
      let file = "";
      for (let i = 0; i < 60 && !file; i += 1) { await sleep(250); file = readdirSync(dir).find((f) => f.endsWith(".csv")) || ""; }
      if (file) {
        const lines = readFileSync(join(dir, file), "utf8").replace(/^\uFEFF/, "").split("\r\n").filter((l) => l.length);
        rec.csv = { rows: lines.length - 1, header: lines[0], header_sha256: createHash("sha256").update(lines[0]).digest("hex"), body_sha256: createHash("sha256").update(lines.slice(1).join("\n")).digest("hex") };
      } else rec.csv = { error: "no CSV file was downloaded" };
    } catch (e) { rec.csv = { error: String(e) }; }
    rmSync(dir, { recursive: true, force: true });
  }
  if (process.env.PROBE_SEARCH) {
    // Optional probe: type a search and report the first row, to look at one named project.
    await evaluate(`(() => { const i = document.querySelector('#search'); i.value = ${JSON.stringify(process.env.PROBE_SEARCH)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(1500);
    rec.probe = await evaluate(`(() => { const tr = document.querySelector('#tbody tr'); return { rows: document.querySelectorAll('#tbody tr').length, register_change: tr?.querySelector('[data-feature="register-change"]')?.textContent || '', changes_listed: document.querySelectorAll('#regChanges .rc-item').length, notes: document.querySelectorAll('.ga-state').length, nearest_datacentre: tr?.querySelector('[data-feature="nearest-datacentres"]')?.textContent || '', nearest_datacentre_link: tr?.querySelector('a.dc-site-link')?.href || '', register_change: tr?.querySelector('[data-feature="register-change"]')?.textContent || '', summary: document.querySelector('#gaStateSummary')?.textContent || '', actions: tr?.lastElementChild?.innerHTML || '', overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }; })()`);
  }
  if (process.env.SHOT_DIR) {
    const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId).catch(() => null);
    if (shot) writeFileSync(join(process.env.SHOT_DIR, `${id}-${vp.name}.png`), Buffer.from(shot.data, "base64"));
  }
  listeners.delete(listen);
  await send("Target.closeTarget", { targetId });
  return rec;
}

const out = {};
for (const id of ids) {
  out[id] = [];
  for (const vp of VIEWPORTS) {
    const rec = await visit(id, vp).catch((e) => ({ viewport: vp.name, error: String(e) }));
    out[id].push(rec);
    console.log(`${id} ${vp.name}: complete=${rec.complete} records=${rec.record_count} rows=${rec.rows_drawn} page_errors=${rec.page_errors?.length} same_origin_failed=${rec.failed_same_origin?.length} external_failed=${rec.failed_external?.length}`);
  }
}
writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
