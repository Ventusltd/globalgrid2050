/* Measure a candidate Atlas arrival against the ORACLE and refuse a regression.
 *
 * WHY AN ORACLE
 * -------------------------------------------------------------------------
 * "Smooth" is not a property anyone can review. testcode/202609051531 is the
 * arrival that measurably works, so it is pinned in oracle.json and every
 * candidate is compared against it on the axes where a candidate could be
 * worse. The oracle is a set of numbers, not an opinion about design.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * -------------------------------------------------------------------------
 * It does not check that a project name appears. An earlier harness did, and
 * reported 94 of 94 arrivals "firing" while the map was still being complained
 * about - because a rendered card proves the card was built and nothing else.
 * The engine has run when, and only when, the page states
 * "Nearest <n> kV substation:".
 *
 * It does not compare style-layer counts. The oracle and the live Atlas both
 * carry 194, and one renders 180 features while the other renders 62-74. A
 * count of what is DECLARED says nothing about what is DRAWN.
 *
 * It measures each lane several times and compares medians, because a single
 * sample over a real network is a number rather than a measurement.
 *
 *   node scripts/oracle/compare.mjs <candidate-url> [runs]
 *   node scripts/oracle/compare.mjs --remeasure-oracle [runs]
 *
 * Exit 1 on any rule broken, 0 when the candidate is no worse than the oracle.
 */
import { chromium, devices } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT = JSON.parse(readFileSync(join(HERE, "oracle.json"), "utf8"));
const ENGINE_RE = "Nearest\\s+\\d+\\s*kV substation:";

const args = process.argv.slice(2);
const remeasure = args.includes("--remeasure-oracle");
const candidateUrl = remeasure ? CONTRACT.oracle.url : args.find((a) => !a.startsWith("-"));
const RUNS = Number(args.find((a) => /^\d+$/.test(a)) || 3);

if (!candidateUrl) {
  console.error("usage: node scripts/oracle/compare.mjs <candidate-url> [runs]");
  process.exit(2);
}

/* A REPD lookup is "sharded" when the arrival reads a small per-ref file, and
   "bulk" when it pulls a whole DATASET.
   The first version of this rule matched /duckdb/ and called the ORACLE bulk -
   the oracle loads duckdb-wasm from the CDN too. Loading a query LIBRARY is not
   the same act as fetching a dataset through it, and a rule that cannot tell
   them apart fails the very build it was written from. So this matches the
   data: parquet files, partitioned masters, and whole-register payloads. */
function classifyRepdLookup(paths) {
  const bulk = paths.filter((p) =>
    /\.parquet(\?|$)|\/partitions?\/|repd_projects_|repd_master/i.test(p));
  const sharded = paths.filter((p) => /repd-identit\w*\/\d+\.json/i.test(p));
  if (bulk.length) return { kind: "bulk", evidence: bulk.slice(0, 3) };
  if (sharded.length) return { kind: "sharded", evidence: sharded.slice(0, 3) };
  return { kind: "unknown", evidence: paths.slice(0, 4) };
}

async function measure(url, runs) {
  const browser = await chromium.launch({ headless: true });
  const samples = [];
  try {
    for (const lane of ["mobile", "desktop"]) {
      for (let i = 0; i < runs; i += 1) {
        const ctx = await browser.newContext(lane === "mobile"
          ? { ...devices["iPhone 14 Pro"] }
          : { viewport: { width: 1440, height: 900 } });
        const page = await ctx.newPage();
        let bytes = 0, requests = 0;
        const paths = new Set();
        page.on("response", (r) => {
          requests += 1;
          bytes += Number(r.headers()["content-length"] || 0);
          try { paths.add(new URL(r.url()).pathname); } catch { /* opaque */ }
        });
        const started = Date.now();
        const s = { lane };
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
          try {
            await page.waitForFunction(
              (re) => new RegExp(re).test(document.body.innerText), ENGINE_RE, { timeout: 45000 });
            s.engine = "FIRED";
            s.engineMs = Date.now() - started;
          } catch {
            s.engine = "DID_NOT_FIRE";
          }
          await page.waitForTimeout(2500);
          Object.assign(s, await page.evaluate(() => {
            let m = null;
            for (const k of Object.keys(window)) {
              const v = window[k];
              if (v && typeof v === "object" && typeof v.getStyle === "function"
                  && typeof v.queryRenderedFeatures === "function") { m = v; break; }
            }
            const style = m ? m.getStyle() : null;
            const subs = style ? style.layers.find((l) => l.id === "l-subs") : null;
            return {
              styleLayers: style ? style.layers.length : null,
              renderedFeatures: m ? m.queryRenderedFeatures().length : null,
              subsVisible: subs ? ((subs.layout && subs.layout.visibility) || "visible") === "visible" : false,
            };
          }));
          s.requests = requests;
          s.declaredKB = Math.round(bytes / 1024);
          s.paths = [...paths];
        } catch (error) {
          s.engine = "ERROR";
          s.error = String(error).split("\n")[0].slice(0, 140);
        } finally { await ctx.close(); }
        samples.push(s);
      }
    }
  } finally { await browser.close(); }

  const median = (xs) => {
    const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const lanes = {};
  for (const lane of ["mobile", "desktop"]) {
    const l = samples.filter((s) => s.lane === lane);
    const fired = l.filter((s) => s.engine === "FIRED");
    lanes[lane] = {
      runs: l.length,
      engine_fired: fired.length,
      engine_ms: median(fired.map((s) => s.engineMs)),
      requests: median(l.map((s) => s.requests)),
      declared_kb: median(l.map((s) => s.declaredKB)),
    };
  }
  const withMap = samples.find((s) => s.styleLayers != null) || {};
  const allPaths = [...new Set(samples.flatMap((s) => s.paths || []))];
  return {
    url,
    lanes,
    style_layers: withMap.styleLayers ?? null,
    rendered_features: withMap.renderedFeatures ?? null,
    l_subs_visible_on_arrival: withMap.subsVisible ?? false,
    repd_lookup: classifyRepdLookup(allPaths),
  };
}

const oracle = CONTRACT.baseline;
const R = CONTRACT.rules;
console.error(`measuring ${RUNS} run(s) per lane: ${candidateUrl}`);
const got = await measure(candidateUrl, RUNS);

const findings = [];
const note = [];

for (const lane of ["mobile", "desktop"]) {
  const c = got.lanes[lane];
  if (c.engine_fired !== c.runs) {
    findings.push(`${lane}: the grid engine fired on ${c.engine_fired} of ${c.runs} runs; the oracle fires on every one`);
  }
}

const kbLimit = Math.round(oracle.mobile.declared_kb * R.mobile_declared_kb.max_ratio_to_oracle);
if (got.lanes.mobile.declared_kb > kbLimit) {
  findings.push(
    `mobile payload ${got.lanes.mobile.declared_kb} KB exceeds ${kbLimit} KB `
    + `(oracle ${oracle.mobile.declared_kb} KB x ${R.mobile_declared_kb.max_ratio_to_oracle})`);
} else {
  note.push(`mobile payload ${got.lanes.mobile.declared_kb} KB within ${kbLimit} KB`);
}

for (const lane of ["mobile", "desktop"]) {
  const limit = Math.round(oracle[lane].engine_ms * R.engine_ms.max_ratio_to_oracle);
  const ms = got.lanes[lane].engine_ms;
  if (ms != null && ms > limit) {
    findings.push(`${lane}: engine answered in ${ms} ms, over the ${limit} ms allowed (oracle ${oracle[lane].engine_ms} ms)`);
  } else if (ms != null) {
    note.push(`${lane} engine ${ms} ms within ${limit} ms`);
  }
}

const featureFloor = Math.round(oracle.rendered_features * R.rendered_features.min_ratio_to_oracle);
if (got.rendered_features != null && got.rendered_features < featureFloor) {
  findings.push(
    `only ${got.rendered_features} features are drawn on arrival, under the floor of ${featureFloor} `
    + `(oracle draws ${oracle.rendered_features}). Both builds declare ${got.style_layers} style layers, `
    + `so a layer count would not have caught this.`);
} else if (got.rendered_features != null) {
  note.push(`${got.rendered_features} features drawn, at or above the floor of ${featureFloor}`);
}

if (R.l_subs_visible_on_arrival.required && !got.l_subs_visible_on_arrival) {
  findings.push("the substation layer is not visible on arrival, so the card measures to a network the map does not show");
} else {
  note.push("substations visible on arrival");
}

if (R.repd_lookup_is_sharded.required && got.repd_lookup.kind !== "sharded") {
  findings.push(
    `the REPD lookup is ${got.repd_lookup.kind}, not sharded: ${got.repd_lookup.evidence.join(", ")}. `
    + `The oracle reads one per-ref shard.`);
} else {
  note.push(`REPD lookup is ${got.repd_lookup.kind}`);
}

console.log(JSON.stringify({
  oracle: CONTRACT.oracle.release,
  candidate: got,
  passed: findings.length === 0,
  findings,
  within: note,
}, null, 2));

if (findings.length) {
  console.error(`\nORACLE COMPARISON FAILED - ${findings.length} finding(s):`);
  for (const f of findings) console.error("  - " + f);
  process.exit(1);
}
console.error("\nORACLE COMPARISON PASS - the candidate is no worse than " + CONTRACT.oracle.release);
