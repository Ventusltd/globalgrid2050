#!/usr/bin/env node
// night-tests.mjs — overnight live-site tests for the GLOBALGRID2050 pages.
//
// Runs against the LIVE published site (default https://globalgrid2050.com).
// Nothing here is written back into the repository: the machine-readable
// result is written to report.json in the process working directory, which CI
// uploads as a build artifact.
//
// Browser: `puppeteer` (npm, installed by CI into a temp directory) is used
// when it resolves. For a local dry run, set PUPPETEER_MODULE to a
// puppeteer-core entry point and PUPPETEER_EXECUTABLE_PATH to a Chrome binary.
//
// Environment:
//   NIGHT_TESTS_BASE        origin under test        (default https://globalgrid2050.com)
//   PUPPETEER_MODULE        module specifier/URL to import instead of `puppeteer`
//   PUPPETEER_EXECUTABLE_PATH  Chrome binary (required with puppeteer-core)
//   NIGHT_TESTS_STAMP       prove one testcode/<stamp>/ folder instead of the
//                           nightly round (also accepted as the first argument)
//   NIGHT_TESTS_LOAD_MS     ms to wait for a page's marker line (default 240000)
//   REPORT_PATH             where to write report.json (default ./report.json)
//   NIGHT_TESTS_HEADFUL     set to 1 to watch a local dry run
//
// Exit code is 1 only on a genuine failure: a served-bytes mismatch, an
// uncaught page error, horizontal overflow, or a missing/forbidden word on a
// page that actually loaded. A page that is not published yet is SKIPped and a
// software-GL load timeout is a WARN.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.NIGHT_TESTS_BASE || 'https://globalgrid2050.com').replace(/\/+$/, '');
const LOAD_MS = Number(process.env.NIGHT_TESTS_LOAD_MS || 240000);
const REPORT_PATH = process.env.REPORT_PATH || path.join(process.cwd(), 'report.json');
const IN_CI = !!process.env.CI;

// Single-stamp mode: with NIGHT_TESTS_STAMP (or a stamp as the first argument)
// the script proves one testcode/<stamp>/ folder instead of the nightly round —
// served bytes, then the folder's index at both viewports, then the folder's own
// proof/ci-checks.json if it ships one. Used by the testcode-proof workflow so
// a freshly published folder is checked the moment Pages has deployed it.
const STAMP = (process.env.NIGHT_TESTS_STAMP || process.argv[2] || '').trim();

const QTS_DIR = '/testcode/202609142202/';
const GEN_DIR = '/testcode/202609142225/';
const LENSES = ['ring', 'particle', 'chord', 'river', 'table', 'column'];
const GEN_KEY = 'block:Cg';

const VIEWPORTS = {
  '430x900': { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  '1440x1000': { width: 1440, height: 1000, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

// ---------------------------------------------------------------- results ---

const results = [];
const started = Date.now();

/* FIVE STATES, BECAUSE FOUR OF THEM WERE BEING SPELT 'SUCCESS'.

   Two runs today were green and proved nothing. Testcode proof 34955380619 ran
   on a push that touched testcode/ci/ and no testcode/<stamp>/ folder, found no
   publication.json, skipped every step after the stamp scan and reported
   success. Night tests go idle the moment NIGHT-UNTIL.txt is in the past -
   2026-09-15T07:00:00Z, hours ago - print 'night window closed; nothing run'
   and report success. Both are honest in their logs and both are
   indistinguishable from health on the runs page, which is the only place
   anyone looks.

   A result vocabulary has to be able to say the difference between:

     pass            the check ran and what it asserts is true
     fail            the check ran and what it asserts is false
     skipped         the check could have run here and did not, for a reason
                     that may not hold next time - the page never painted under
                     software GL, the folder is published but not yet served.
                     Transient. A skip that repeats is a fail nobody has named.
     expired         the check is time-boxed and its window has closed. Nothing
                     was asked. Never a pass; and after EXPIRY_GRACE_DAYS with
                     nobody renewing or deleting the window it becomes a fail,
                     because a gate left running forever asking nothing is a
                     defect in its own right.
     not-applicable  there was nothing here for this check to look at, by
                     construction - this push carried no testcode folder, this
                     folder ships no proof/ci-checks.json. Legitimately silent.

   'warn' keeps the one job it always had: a real observation that is not a
   verdict (no WebGL2 on the runner). It does not move the run verdict.
   skipped, expired and not-applicable do.

   The run verdict and the exit code are derived from the counts at the foot of
   this file, and the workflows are told to read the verdict, not the colour. */
const STATES = ['pass', 'fail', 'skip', 'expired', 'na', 'warn'];
const TAG = { pass: 'PASS', fail: 'FAIL', warn: 'WARN', skip: 'SKIP', expired: 'EXPIRED', na: 'N/A' };

function record(status, name, detail, extra = {}) {
  results.push({ status, name, detail: String(detail ?? ''), ...extra });
  if (!STATES.includes(status)) throw new Error(`unknown result state: ${status}`);
  const tag = TAG[status];
  console.log(`  ${tag}  ${name}${detail ? ' — ' + detail : ''}`);
}
const pass = (n, d, e) => record('pass', n, d, e);
const fail = (n, d, e) => record('fail', n, d, e);
const warn = (n, d, e) => record('warn', n, d, e);
const skip = (n, d, e) => record('skip', n, d, e);
const expired = (n, d, e) => record('expired', n, d, e);
const na = (n, d, e) => record('na', n, d, e);

/* The night window is judged here, not by a shell step whose only outcome is
   'skip the rest of the job and finish green'. NIGHT_TESTS_UNTIL carries the
   contents of testcode/ci/NIGHT-UNTIL.txt. With no window declared the tests
   simply run, which is what a local dry run wants. */
const EXPIRY_GRACE_DAYS = Number(process.env.NIGHT_EXPIRY_GRACE_DAYS || 7);
function windowState() {
  const until = (process.env.NIGHT_TESTS_UNTIL || '').trim();
  if (!until) return { state: 'open', until: null, overdueDays: 0 };
  const closesAt = Date.parse(until);
  if (Number.isNaN(closesAt)) return { state: 'invalid', until, overdueDays: 0 };
  const overdueDays = (Date.now() - closesAt) / 86400000;
  if (overdueDays < 0) return { state: 'open', until, overdueDays };
  return { state: overdueDays > EXPIRY_GRACE_DAYS ? 'abandoned' : 'closed', until, overdueDays };
}

// ------------------------------------------------------------ served bytes ---

const sha256 = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');

async function getStatus(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', cache: 'no-store' });
    // Drain so the socket is released.
    await r.arrayBuffer();
    return r.status;
  } catch (e) {
    return `network error: ${e.message}`;
  }
}

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (r.status !== 200) return { status: r.status, json: null };
  const text = await r.text();
  try {
    return { status: 200, json: JSON.parse(text), text };
  } catch (e) {
    return { status: 200, json: null, parseError: e.message };
  }
}

async function getBuffer(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (r.status !== 200) return { status: r.status, buf: null };
  return { status: 200, buf: Buffer.from(await r.arrayBuffer()) };
}

// publication.json ships two shapes: QTS keys an object by path, the generator
// ships an array of {file, bytes, sha256}. Normalise both to one list.
function normalisePublicationFiles(pub) {
  const files = pub && pub.files;
  if (!files) return null;
  if (Array.isArray(files)) {
    return files.map((e) => ({ file: e.file, bytes: e.bytes, sha256: String(e.sha256 || '').toLowerCase() }));
  }
  if (typeof files === 'object') {
    return Object.entries(files).map(([file, e]) => ({
      file,
      bytes: e && e.bytes,
      sha256: String((e && e.sha256) || '').toLowerCase(),
    }));
  }
  return null;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const n = i++;
      if (n >= items.length) return;
      out[n] = await fn(items[n], n);
    }
  });
  await Promise.all(workers);
  return out;
}

// Fetch every file publication.json lists and compare sha256. This proves what
// is served is what was published; it needs no browser, so it still runs when
// the page itself times out under software GL.
async function checkServedBytes(label, dirPath, { requirePublication = false } = {}) {
  const pubUrl = `${BASE}${dirPath}publication.json`;
  const { status, json, parseError } = await getJson(pubUrl);
  if (status === 404) {
    if (requirePublication) {
      // In single-stamp mode the folder is known to carry a publication.json,
      // so a 404 means the deploy did not put it on the site.
      fail(`${label}: served bytes`, 'publication.json 404 — the folder is in the repository but is not served');
      return { ran: false, published: false, ok: 0, bad: 0, total: 0 };
    }
    skip(`${label}: served bytes`, 'publication.json 404 — not yet published');
    return { ran: false, published: false, ok: 0, bad: 0, total: 0 };
  }
  if (status !== 200) {
    fail(`${label}: served bytes`, `publication.json HTTP ${status}`);
    return { ran: false, published: true, ok: 0, bad: 1, total: 0 };
  }
  if (!json) {
    fail(`${label}: served bytes`, `publication.json is not JSON: ${parseError}`);
    return { ran: false, published: true, ok: 0, bad: 1, total: 0 };
  }
  const list = normalisePublicationFiles(json);
  if (!list || !list.length) {
    fail(`${label}: served bytes`, 'publication.json lists no files');
    return { ran: false, published: true, ok: 0, bad: 1, total: 0 };
  }

  const checked = await mapLimit(list, 6, async (entry) => {
    const url = `${BASE}${dirPath}${entry.file.split('/').map(encodeURIComponent).join('/')}`;
    try {
      const { status: s, buf } = await getBuffer(url);
      if (s !== 200) return { ...entry, ok: false, reason: `HTTP ${s}` };
      const got = sha256(buf);
      if (got !== entry.sha256) return { ...entry, ok: false, reason: `sha256 served ${got.slice(0, 16)}… published ${entry.sha256.slice(0, 16)}…` };
      if (typeof entry.bytes === 'number' && buf.length !== entry.bytes) {
        return { ...entry, ok: false, reason: `bytes served ${buf.length} published ${entry.bytes}` };
      }
      return { ...entry, ok: true };
    } catch (e) {
      return { ...entry, ok: false, reason: `network error: ${e.message}` };
    }
  });

  const bad = checked.filter((c) => !c.ok);
  if (bad.length) {
    fail(
      `${label}: served bytes`,
      `${bad.length} of ${checked.length} files differ from publication.json`,
      { files: bad.slice(0, 12).map((b) => `${b.file}: ${b.reason}`) },
    );
  } else {
    pass(`${label}: served bytes`, `${checked.length} files match publication.json sha256`);
  }
  return {
    ran: true, published: true, list, publication: json,
    ok: checked.length - bad.length, bad: bad.length, total: checked.length,
  };
}

// The generator's lens modules are meant to be pure drawing code: no network,
// no colour literals (colours come from the shared palette), no history writes,
// no unseeded randomness.
async function checkLensSources(list) {
  const lensFiles = (list || []).filter((e) => /^lenses\/.*\.js$/i.test(e.file));
  if (!lensFiles.length) {
    warn('generator: lens sources', 'publication.json lists no lenses/*.js');
    return;
  }
  const forbidden = [
    ['fetch(', (s) => s.includes('fetch(')],
    ['hex colour literal', (s) => /#[0-9a-f]{6}/i.test(s)],
    ['history.', (s) => s.includes('history.')],
    ['Math.random', (s) => s.includes('Math.random')],
  ];
  const problems = [];
  await mapLimit(lensFiles, 6, async (entry) => {
    const url = `${BASE}${GEN_DIR}${entry.file}`;
    const { status, buf } = await getBuffer(url);
    if (status !== 200) { problems.push(`${entry.file}: HTTP ${status}`); return; }
    const src = buf.toString('utf8');
    for (const [name, test] of forbidden) {
      if (test(src)) problems.push(`${entry.file}: contains ${name}`);
    }
  });
  if (problems.length) fail('generator: lens sources', problems.join('; '), { problems });
  else pass('generator: lens sources', `${lensFiles.length} lens modules free of fetch(, hex colours, history., Math.random`);
}

// ------------------------------------------------------------------ browser ---

async function loadPuppeteer() {
  const tried = [];
  // PUPPETEER_MODULE may be a bare specifier, a file URL, or a path on disk —
  // CI points it at an install in the runner's temp directory, and a local dry
  // run points it at a puppeteer-core checkout. Paths become file URLs so the
  // same line works on Linux and Windows.
  // A scheme needs two or more characters, so a lone "C:" stays a drive letter.
  const isUrl = (s) => /^[a-z][a-z0-9+.-]+:/i.test(s);
  const asSpecifier = (s) => (isUrl(s) || !/[\\/]/.test(s) ? s : pathToFileURL(path.resolve(s)).href);
  const candidates = [process.env.PUPPETEER_MODULE, 'puppeteer', 'puppeteer-core'].filter(Boolean);
  for (const raw of candidates) {
    const spec = asSpecifier(raw);
    try {
      const mod = await import(spec);
      return { puppeteer: mod.default || mod, via: raw };
    } catch (e) {
      tried.push(`${raw}: ${e.message.split('\n')[0]}`);
    }
  }
  throw new Error(`no puppeteer available (${tried.join(' | ')})`);
}

function launchArgs() {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'];
  if (IN_CI) args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  return args;
}

// Console noise that is not a defect: a missing favicon, and the page's own
// honest report that the runner has no WebGL2.
const IGNORED_CONSOLE = [/favicon/i, /WebGL2 path failed/i, /WebGL2 unavailable/i];

/**
 * Open one page, wait for its marker line, and gather everything the text
 * checks need. Never throws for a slow page: a marker that never arrives is a
 * warning, because on GitHub's runners Chrome draws WebGL with SwiftShader on
 * the CPU and the heavy pages can take minutes.
 */
async function visit(browser, { url, viewport, markers, minDwellMs = 0 }) {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // A failed-resource console error carries no URL in its text, so judge the
    // reporting location too — that is where "favicon.ico" shows up.
    const where = (m.location && m.location() && m.location().url) || '';
    if (IGNORED_CONSOLE.some((re) => re.test(t) || re.test(where))) return;
    consoleErrors.push(where ? `${t} (${where})` : t);
  });

  await page.setViewport(VIEWPORTS[viewport]);
  const t0 = Date.now();
  let status = null;
  let navError = null;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    status = resp ? resp.status() : null;
  } catch (e) {
    navError = e.message;
  }

  // Poll the visible text for the page's marker rather than waiting for
  // networkidle: under software GL the page paints long after the network
  // settles, and networkidle does not arrive at all on the busiest page.
  let loaded = false;
  let text = '';
  const deadline = t0 + LOAD_MS;
  while (Date.now() < deadline) {
    try {
      text = await page.evaluate(() => (document.body ? document.body.innerText : ''));
    } catch { /* navigation in flight */ }
    if (markers.some((re) => re.test(text))) { loaded = true; break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  // A generic marker can match the static HTML before a single script has run.
  // Stay on the page a little longer so late errors have somewhere to land.
  const dwellLeft = minDwellMs - (Date.now() - t0);
  if (loaded && dwellLeft > 0) await new Promise((r) => setTimeout(r, dwellLeft));
  const elapsedMs = Date.now() - t0;

  let metrics = { scrollWidth: null, innerWidth: null, webgl2: null, hud: '', count: '', domText: '' };
  try {
    metrics = await page.evaluate(() => {
      let webgl2 = false;
      try {
        const c = document.createElement('canvas');
        webgl2 = !!c.getContext('webgl2');
      } catch { webgl2 = false; }
      const txt = (sel) => { const el = document.querySelector(sel); return el ? el.textContent : ''; };
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        webgl2,
        hud: txt('#hud'),
        count: txt('#count'),
        // Document text, which unlike innerText also carries the labels inside
        // a nest the reader has not opened yet.
        domText: document.body ? document.body.textContent : '',
      };
    });
  } catch { /* leave nulls */ }

  await page.close().catch(() => {});
  return { url, viewport, status, navError, loaded, elapsedMs, text, pageErrors, consoleErrors, ...metrics };
}

// The page reports its own WebGL2 verdict two ways: the HUD says "WebGL2
// unavailable" and it logs "WebGL2 path failed". Trust either.
function webgl2Missing(v) {
  if (v.webgl2 === false) return true;
  if (/WebGL2 unavailable|WebGL2 path failed|the sea needs WebGL2/i.test(v.hud || '')) return true;
  if (/WebGL2 path failed/i.test(v.text || '')) return true;
  return false;
}

function baseChecks(label, v, { expectOverflowFree }) {
  if (v.navError) {
    warn(`${label}: navigation`, v.navError);
  } else if (v.status === 200) {
    pass(`${label}: HTTP 200`, `status ${v.status}`);
  } else {
    fail(`${label}: HTTP 200`, `status ${v.status}`);
  }

  if (!v.loaded) {
    warn(`${label}: load`, `timeout under software GL after ${(v.elapsedMs / 1000).toFixed(1)} s — text checks skipped`);
  } else {
    pass(`${label}: load`, `marker text present after ${(v.elapsedMs / 1000).toFixed(1)} s`);
  }

  if (v.pageErrors.length) fail(`${label}: page errors`, v.pageErrors.slice(0, 5).join(' | '), { pageErrors: v.pageErrors });
  else pass(`${label}: page errors`, 'none');

  if (v.consoleErrors.length) fail(`${label}: console errors`, v.consoleErrors.slice(0, 5).join(' | '), { consoleErrors: v.consoleErrors });
  else pass(`${label}: console errors`, 'none (favicon 404 and the WebGL2 notice are ignored)');

  if (expectOverflowFree) {
    if (v.scrollWidth == null) {
      warn(`${label}: no horizontal overflow`, 'could not read layout');
    } else if (v.scrollWidth === v.innerWidth) {
      pass(`${label}: no horizontal overflow`, `scrollWidth ${v.scrollWidth} == innerWidth ${v.innerWidth}`);
    } else {
      fail(`${label}: no horizontal overflow`, `scrollWidth ${v.scrollWidth} != innerWidth ${v.innerWidth}`);
    }
  }
}

function textMust(label, v, needles) {
  if (!v.loaded) { skip(`${label}`, 'page did not finish loading; text not judged'); return; }
  const missing = needles.filter((n) => !v.text.includes(n));
  if (missing.length) fail(label, `missing: ${missing.map((m) => JSON.stringify(m)).join(', ')}`, { missing });
  else pass(label, `${needles.length} substrings present`);
}

function textMustNot(label, v, needles) {
  if (!v.loaded) { skip(`${label}`, 'page did not finish loading; text not judged'); return; }
  const present = needles.filter((n) => v.text.includes(n));
  if (present.length) fail(label, `forbidden text present: ${present.map((m) => JSON.stringify(m)).join(', ')}`, { present });
  else pass(label, `${needles.length} retired words absent`);
}

function textInOrder(label, v, words) {
  if (!v.loaded) { skip(`${label}`, 'page did not finish loading; text not judged'); return; }
  let cursor = 0;
  for (const w of words) {
    const at = v.text.indexOf(w, cursor);
    if (at === -1) { fail(label, `"${w}" not found after the previous legend word`); return; }
    cursor = at + w.length;
  }
  pass(label, `${words.length} legend words in order`);
}

// ------------------------------------------------------------------- suites ---

async function runQts(browser) {
  console.log('\n== Quantum Twin Star ==');
  const served = await checkServedBytes('qts', QTS_DIR);
  const url = `${BASE}${QTS_DIR}`;
  const markers = [/on GPU: [\d,]+ unique numbered lines/, /WebGL2 unavailable/i, /the sea needs WebGL2/i];
  const visits = {};

  for (const vp of ['430x900', '1440x1000']) {
    const label = `qts ${vp}`;
    const v = await visit(browser, { url, viewport: vp, markers });
    visits[vp] = v;
    baseChecks(label, v, { expectOverflowFree: vp === '430x900' });

    const noGl = webgl2Missing(v);
    record(noGl ? 'warn' : 'pass', `${label}: WebGL2`, noGl ? 'no WebGL2 on runner' : 'WebGL2 context available', { webgl2: !noGl });

    const gpuLine = 'on GPU: 250,174 unique numbered lines';
    if (!v.loaded) {
      skip(`${label}: HUD count line`, 'page did not finish loading; served-bytes checks still ran');
    } else if (noGl) {
      skip(`${label}: HUD count line`, 'skipped: no WebGL2 on runner');
    } else {
      textMust(`${label}: HUD count line`, v, [gpuLine]);
    }
  }
  return { served, visits };
}

async function runGenerator(browser) {
  console.log('\n== Star Generator ==');
  const indexStatus = await getStatus(`${BASE}${GEN_DIR}`);
  if (indexStatus === 404) {
    skip('generator: published', 'HTTP 404 — not yet published; every generator check skipped');
    return { published: false, visits: {} };
  }
  if (indexStatus !== 200) {
    fail('generator: published', `HTTP ${indexStatus}`);
    return { published: false, visits: {} };
  }
  pass('generator: published', 'HTTP 200');

  const served = await checkServedBytes('generator', GEN_DIR);
  await checkLensSources(served.list);

  const markers = [/blocks on the table/, /not yet known/];
  const visits = {};

  for (const vp of ['430x900', '1440x1000']) {
    const label = `generator ${vp}`;
    const url = `${BASE}${GEN_DIR}?lens=ring&key=${encodeURIComponent(GEN_KEY)}`;
    const v = await visit(browser, { url, viewport: vp, markers });
    visits[vp] = v;
    baseChecks(label, v, { expectOverflowFree: vp === '430x900' });
    textMust(`${label}: count sentence`, v, [
      'blocks on the table', 'groups off the table', 'function families',
      'unique numbered lines', 'repositories',
    ]);
    textInOrder(`${label}: legend order`, v, [
      'contains', 'depends on', 'uses', 'used by', 'shared line', 'random link', 'entangled',
    ]);
    textMustNot(`${label}: retired words`, v, [
      'dependents', 'depended on by', 'BLOCK 22', '360°', 'Spider', 'universe',
    ]);
  }

  // Every lens must at least open and count. One viewport, shorter patience.
  for (const lens of LENSES.filter((l) => l !== 'ring')) {
    const label = `generator lens=${lens}`;
    const url = `${BASE}${GEN_DIR}?lens=${lens}&key=${encodeURIComponent(GEN_KEY)}`;
    const v = await visit(browser, { url, viewport: '1440x1000', markers });
    if (v.pageErrors.length) fail(`${label}: page errors`, v.pageErrors.slice(0, 3).join(' | '));
    else if (!v.loaded) warn(`${label}: load`, `timeout under software GL after ${(v.elapsedMs / 1000).toFixed(1)} s`);
    else textMust(`${label}: count sentence`, v, ['blocks on the table']);
  }

  return { published: true, visits, served };
}

// Prove one published folder. The folder may be anything the estate publishes,
// so there is no vocabulary to assume: readiness is "the page has put real text
// on screen", or the first phrase its own ci-checks.json asks for.
async function runStamp(browser, stamp) {
  console.log(`\n== testcode/${stamp} ==`);
  const dir = `/testcode/${stamp}/`;
  const served = await checkServedBytes(stamp, dir, { requirePublication: true });

  const indexStatus = await getStatus(`${BASE}${dir}`);
  if (indexStatus !== 200) {
    fail(`${stamp}: index served`, `HTTP ${indexStatus}`);
    return { served, visits: {} };
  }
  pass(`${stamp}: index served`, 'HTTP 200');

  // The folder may ship its own checks: [{name, must_contain[], must_not_contain[]}].
  let folderChecks = [];
  const ck = await getJson(`${BASE}${dir}proof/ci-checks.json`);
  if (ck.status === 200 && Array.isArray(ck.json)) {
    folderChecks = ck.json;
    pass(`${stamp}: proof/ci-checks.json`, `${folderChecks.length} checks shipped with the folder`);
  } else if (ck.status === 404) {
    na(`${stamp}: proof/ci-checks.json`, 'the folder ships none');
  } else {
    warn(`${stamp}: proof/ci-checks.json`, `HTTP ${ck.status}${ck.parseError ? ` — ${ck.parseError}` : ''}`);
  }

  const firstPhrase = folderChecks.flatMap((c) => c.must_contain || [])[0];
  const markers = firstPhrase
    ? [new RegExp(firstPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))]
    : [/[^\s][\s\S]{200,}/]; // real text on screen, not an empty shell

  const visits = {};
  for (const vp of ['430x900', '1440x1000']) {
    const label = `${stamp} ${vp}`;
    const v = await visit(browser, { url: `${BASE}${dir}`, viewport: vp, markers, minDwellMs: 10000 });
    visits[vp] = v;
    baseChecks(label, v, { expectOverflowFree: true });

    for (const c of folderChecks) {
      const cl = `${label} check: ${c.name || 'unnamed'}`;
      if (!v.loaded) { skip(cl, 'page did not finish loading; text not judged'); continue; }
      const missing = (c.must_contain || []).filter((n) => !v.text.includes(n));
      const present = (c.must_not_contain || []).filter((n) => v.text.includes(n));
      if (missing.length || present.length) {
        const bits = [];
        if (missing.length) bits.push(`missing ${missing.map((m) => JSON.stringify(m)).join(', ')}`);
        if (present.length) bits.push(`forbidden ${present.map((m) => JSON.stringify(m)).join(', ')}`);
        fail(cl, bits.join('; '), { source: 'folder' });
      } else {
        pass(cl, `${(c.must_contain || []).length} required, ${(c.must_not_contain || []).length} forbidden`, { source: 'folder' });
      }
    }
  }
  return { served, visits };
}

async function runHomepage(browser) {
  console.log('\n== Homepage ==');
  const markers = [/Integrated Development Environments/];
  const v = await visit(browser, { url: `${BASE}/`, viewport: '430x900', markers });
  baseChecks('homepage 430x900', v, { expectOverflowFree: true });
  textMust('homepage 430x900: text', v, ['Integrated Development Environments']);
  // "Stars" is a sub-nest label: it is in the document from first paint but only
  // becomes visible text once the reader opens the nest, so judge document text.
  if (!v.loaded) {
    skip('homepage 430x900: Stars sub-nest', 'page did not finish loading; text not judged');
  } else if ((v.domText || '').includes('Stars')) {
    pass('homepage 430x900: Stars sub-nest', 'present in the document (inside the nest, not yet opened)');
  } else {
    fail('homepage 430x900: Stars sub-nest', '"Stars" is not in the document text');
  }
  return { '430x900': v };
}

// Data-driven checks. checks.json is an array of
// {name, page, viewport, must_contain[], must_not_contain[], source}.
// "source" records who proposed the check: a local reviewer model or Claude.
async function runDataChecks(visitsByPage) {
  console.log('\n== checks.json ==');
  const file = path.join(HERE, 'checks.json');
  if (!existsSync(file)) { warn('checks.json', 'not present'); return; }
  let checks;
  try {
    checks = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    fail('checks.json', `unreadable: ${e.message}`);
    return;
  }
  if (!Array.isArray(checks) || !checks.length) { warn('checks.json', 'no checks defined'); return; }

  for (const c of checks) {
    const label = `check: ${c.name} [${c.source || 'unknown'}]`;
    const pageVisits = visitsByPage[c.page];
    if (!pageVisits) { skip(label, `page "${c.page}" was not visited (not published, or unknown page)`); continue; }
    const v = pageVisits[c.viewport] || pageVisits['1440x1000'] || pageVisits['430x900'];
    if (!v) { skip(label, `viewport ${c.viewport} not visited`); continue; }
    if (!v.loaded) { skip(label, 'page did not finish loading; text not judged'); continue; }

    const missing = (c.must_contain || []).filter((n) => !v.text.includes(n));
    const present = (c.must_not_contain || []).filter((n) => v.text.includes(n));
    if (missing.length || present.length) {
      const bits = [];
      if (missing.length) bits.push(`missing ${missing.map((m) => JSON.stringify(m)).join(', ')}`);
      if (present.length) bits.push(`forbidden ${present.map((m) => JSON.stringify(m)).join(', ')}`);
      fail(label, bits.join('; '), { page: c.page, viewport: c.viewport, source: c.source });
    } else {
      pass(label, `${(c.must_contain || []).length} required, ${(c.must_not_contain || []).length} forbidden`, { page: c.page, viewport: c.viewport, source: c.source });
    }
  }
}

// -------------------------------------------------------------------- main ---

function summaryTable() {
  const width = Math.min(96, Math.max(40, ...results.map((r) => r.name.length + 8)));
  const line = '-'.repeat(width + 40);
  console.log('\n' + line);
  console.log('NIGHT TESTS SUMMARY'.padEnd(width + 8) + 'STATUS  DETAIL');
  console.log(line);
  for (const r of results) {
    const tag = TAG[r.status];
    const detail = r.detail.length > 90 ? r.detail.slice(0, 87) + '...' : r.detail;
    console.log(r.name.padEnd(width + 8) + tag.padEnd(8) + detail);
  }
  console.log(line);
}

async function main() {
  console.log(`night tests against ${BASE}`);
  console.log(`started ${new Date(started).toISOString()} · CI=${IN_CI ? 'yes' : 'no'} · load patience ${LOAD_MS / 1000} s`);

  /* An expired window ends the run here, with a verdict, before a browser is
     launched. The old shape put this in a workflow step that set run=no and let
     every later step be skipped, which GitHub renders as a wholly green job. */
  const window_ = windowState();
  if (window_.state === 'invalid') {
    fail('night window', `NIGHT_TESTS_UNTIL is not a date: ${window_.until}`);
    return finish(null, null, window_);
  }
  if (window_.state === 'closed' || window_.state === 'abandoned') {
    const overdue = window_.overdueDays.toFixed(1);
    const detail = `window closed ${overdue} day(s) ago at ${window_.until}; nothing was checked`;
    if (window_.state === 'abandoned') {
      fail('night window', `${detail} - past the ${EXPIRY_GRACE_DAYS}-day grace. `
        + 'Put a later time in testcode/ci/NIGHT-UNTIL.txt, or delete the schedule. '
        + 'A gate that has asked nothing for a week is not idle, it is abandoned.');
    } else {
      expired('night window', detail);
    }
    return finish(null, null, window_);
  }

  const { puppeteer, via } = await loadPuppeteer();
  console.log(`browser driver: ${via}`);
  const launchOpts = {
    headless: process.env.NIGHT_TESTS_HEADFUL === '1' ? false : true,
    args: launchArgs(),
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch(launchOpts);

  const visitsByPage = {};
  let servedSummary = null;
  try {
    if (STAMP) {
      const one = await runStamp(browser, STAMP);
      servedSummary = { ok: one.served.ok || 0, bad: one.served.bad || 0, total: one.served.total || 0 };
    } else {
      const qts = await runQts(browser);
      visitsByPage.qts = qts.visits;
      servedSummary = { ok: qts.served.ok || 0, bad: qts.served.bad || 0, total: qts.served.total || 0 };
      const gen = await runGenerator(browser);
      if (gen.published) visitsByPage.generator = gen.visits;
      visitsByPage.homepage = await runHomepage(browser);
      await runDataChecks(visitsByPage);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return finish(servedSummary, via, window_);
}

/* THE VERDICT, AND THE EXIT CODE THAT CARRIES IT.

   Derived, never asserted by hand, and ordered so the worst honest thing about
   the run is what the run is called:

     FAIL            1   something ran and was wrong
     EXPIRED         3   the window is shut; nothing was asked
     NOT_APPLICABLE  4   there was nothing here to check
     INCOMPLETE      2   something that should have run did not
     PASS            0   every check that could run, ran, and was right

   PASS requires at least one actual pass: a run of nothing but warnings is not
   a clean bill of health, it is a run of nothing.

   GitHub Actions gives a job two conclusions, success and failure, so only FAIL
   can be red. That is exactly why the verdict is written into report.json and
   printed as the last line: the workflows annotate the run with it, and no
   consumer is entitled to read a green tick as proof that anything was checked.
   Exit codes 2, 3 and 4 are distinguishable to any caller that is not GitHub. */
function verdictOf(counts) {
  if (counts.fail) return { verdict: 'FAIL', exit: 1 };
  if (counts.expired) return { verdict: 'EXPIRED', exit: 3 };
  if (!counts.pass && !counts.skip) return { verdict: 'NOT_APPLICABLE', exit: 4 };
  if (counts.skip) return { verdict: 'INCOMPLETE', exit: 2 };
  return { verdict: 'PASS', exit: 0 };
}

async function finish(servedSummary, via, window_) {
  summaryTable();

  const counts = { pass: 0, fail: 0, warn: 0, skip: 0, expired: 0, na: 0 };
  for (const r of results) counts[r.status]++;
  const failed = results.filter((r) => r.status === 'fail').map((r) => r.name);
  const skipped = results.filter((r) => r.status === 'skip').map((r) => r.name);
  const notApplicable = results.filter((r) => r.status === 'na').map((r) => r.name);
  const { verdict, exit } = verdictOf(counts);

  const report = {
    schema: 'globalgrid2050.night-tests.v2',
    verdict,
    exit_code: exit,
    base: BASE,
    stamp: STAMP || null,
    mode: STAMP ? 'single-stamp' : 'nightly',
    night_window: window_ || { state: 'open', until: null },
    served: servedSummary,
    started_utc: new Date(started).toISOString(),
    finished_utc: new Date().toISOString(),
    duration_s: Number(((Date.now() - started) / 1000).toFixed(1)),
    ci: IN_CI,
    driver: via || null,
    counts,
    failed,
    skipped,
    not_applicable: notApplicable,
    results,
  };
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 1));
  const line = [
    `${counts.pass} passed`, `${counts.fail} failed`, `${counts.warn} warnings`,
    `${counts.skip} skipped`, `${counts.expired} expired`, `${counts.na} not-applicable`,
  ].join(' / ');
  console.log(`\n${line}`);
  console.log(`report written to ${REPORT_PATH}`);
  if (failed.length) console.log(`failing checks: ${failed.join(', ')}`);
  if (skipped.length) console.log(`skipped checks: ${skipped.join(', ')}`);
  if (notApplicable.length) console.log(`not applicable here: ${notApplicable.join(', ')}`);
  // Last line, one token, greppable. The workflows read this and report.json;
  // they are not entitled to read the job's colour as proof of anything.
  console.log(`NIGHT_TESTS_VERDICT=${verdict}`);
  process.exitCode = exit;
  return exit;
}

main().catch(async (e) => {
  console.error('night tests could not run:', e && e.stack ? e.stack : e);
  try {
    await writeFile(REPORT_PATH, JSON.stringify({
      base: BASE, started_utc: new Date(started).toISOString(), finished_utc: new Date().toISOString(),
      schema: 'globalgrid2050.night-tests.v2', verdict: 'FAIL', exit_code: 1,
      harness_error: String(e && e.message ? e.message : e),
      counts: { pass: 0, fail: 1, warn: 0, skip: 0, expired: 0, na: 0 },
      failed: ['harness'], skipped: [], not_applicable: [], results,
    }, null, 1));
  } catch { /* nothing more to do */ }
  console.log('NIGHT_TESTS_VERDICT=FAIL');
  process.exitCode = 1;
});
