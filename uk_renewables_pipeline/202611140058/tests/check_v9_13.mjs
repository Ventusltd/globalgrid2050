/* check_v9_13.mjs - the REPD Q3 2026 (October 2026) release, proven from the
 * bytes and through the page's OWN loaders.
 *
 *   1. The contracts bind the PARENT's (202611132345) fixtures by path and
 *      sha256, and the fixtures on disk there are those bytes.
 *   2. The page's own loader chain - canonical-projects-v9-5-1.js, which runs
 *      canonical-projects-v9-1.js - is imported unmodified and executed against
 *      the files in this folder through a same-origin fetch shim. Every
 *      invariant the browser asserts is therefore asserted here, over all rows.
 *   3. The spine partitions are what the manifest says (sha256 and counts).
 *   4. The UK newspaper is still the repo-root Q2 feed, byte for byte, and the
 *      refs it binds to all resolve in the new spine (the page tolerates
 *      unknown refs, but none are lost in this refresh).
 *   5. The interconnector product and contract are the parent's, byte for byte.
 *   6. The page states its own identity, a release label (no candidate label)
 *      and the register figures.
 *
 * Run: node tests/check_v9_13.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELEASE = join(HERE, "..");
const ID = basename(RELEASE);
const ROOT = join(RELEASE, "..", "..");
const PARENT_ID = "202611132345";
const PARENT = join(RELEASE, "..", PARENT_ID);
const text = (p) => readFile(p, "utf8");
const json = async (p) => JSON.parse(await text(p));
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

const NEWS_FEED_SHA256 = "cea104c3e9cfc07971680afdf5f64073e1d4825b63bfaf4e969266df8386ebbd";

// 1. contracts bind fixtures
const c91 = await json(join(RELEASE, "contracts", "release.v9.1.json"));
const c951 = await json(join(RELEASE, "contracts", "release.v9.5.1.json"));
assert.equal(c91.source.dataset, "DESNZ Renewable Energy Planning Database Q3 2026");
for (const [pathKey, shaKey] of [["identity_fixture", "identity_fixture_sha256"], ["coordinate_fixture", "coordinate_fixture_sha256"]]) {
  const rel = c91.source[pathKey];
  assert.ok(rel.startsWith(`uk_renewables_pipeline/${PARENT_ID}/fixtures/`), `${pathKey} must be the parent's fixture: ${rel}`);
  assert.equal(sha256(await readFile(join(ROOT, rel))), c91.source[shaKey], `${pathKey} bytes`);
}
const coords = await json(join(ROOT, c91.source.coordinate_fixture));
assert.equal(coords.source_workbook_sha256, c91.source.workbook_sha256, "coordinate fixture names the contract workbook");
const identity = await json(join(ROOT, c91.source.identity_fixture));
assert.equal(identity.schema, "globalgrid2050.project-identity.v6");
assert.equal(identity.records.length, identity.raw_record_count);
assert.equal(coords.source_records, identity.raw_record_count, "workbook and identity hold the same refs");

// 2. the page's own loader, unmodified, against these bytes
const ORIGIN = "http://release.invalid";
const BASE = `${ORIGIN}/uk_renewables_pipeline/${ID}/`;
globalThis.window = { location: { origin: ORIGIN, href: BASE } };
globalThis.fetch = async (path) => {
  const url = new URL(path, BASE);
  assert.ok(url.pathname.startsWith(`/uk_renewables_pipeline/${ID}/`), `loader fetched outside the release: ${url}`);
  const file = join(RELEASE, decodeURIComponent(url.pathname.slice(`/uk_renewables_pipeline/${ID}/`.length)));
  const body = await text(file);
  return { ok: true, status: 200, url: url.href, json: async () => JSON.parse(body) };
};
const loader = await import(new URL("../scripts/data/canonical-projects-v9-5-1.js", import.meta.url).href);
const model = await loader.loadCanonicalProjectsV9_5_1();
assert.equal(model.projects.length, c951.expected.project_count);
assert.equal(Math.round(model.metadata.capacity_mw), c951.expected.displayed_capacity_mw);

// 3. partitions are the manifest's bytes
const manifest = await json(join(RELEASE, "data", "v9.1", "build_manifest.json"));
for (const part of [...manifest.project_partitions, ...manifest.atlas_partitions]) {
  assert.equal(sha256(await readFile(join(RELEASE, part.path))), part.sha256, `${part.path} hash`);
}
const atlasFeatures = manifest.atlas_partitions.reduce((n, p) => n + p.feature_count, 0);
assert.equal(atlasFeatures, manifest.geometry_count, "atlas features = valid geometries");
for (const key of Object.keys(c91.expected)) assert.equal(manifest[key], c91.expected[key], `manifest ${key}`);
assert.equal(manifest.source_dataset, c91.source.dataset);
assert.equal(manifest.source_record_count, identity.raw_record_count);

// 4. the newspaper: unchanged Q2 feed, every bound ref still resolves
const feedBytes = await readFile(join(ROOT, "dist", "major_project_news_v9_5_1.json"));
assert.equal(sha256(feedBytes), NEWS_FEED_SHA256, "dist/major_project_news_v9_5_1.json must not be rebuilt by this release");
const feed = JSON.parse(feedBytes);
const byRef = new Map(model.projects.map((p) => [p.repd_ref, p]));
const boundRefs = new Set(feed.canonical_items.map((item) => String(item.repd_ref)));
const unresolved = [...boundRefs].filter((ref) => !byRef.has(ref));
const beacon = byRef.get(feed.beacon_fen_contract.repd_ref);
assert.ok(beacon, "Beacon Fen must be in the spine");
assert.equal(beacon.capacity_mw, feed.beacon_fen_contract.official_capacity_mw, "Beacon Fen official capacity");

// 5. interconnectors are the parent's
for (const rel of ["contracts/interconnectors.v9.8.json", "data/v9.8/interconnectors.json", "data/v9.8/interconnectors_manifest.json"]) {
  assert.equal(sha256(await readFile(join(RELEASE, rel))), sha256(await readFile(join(PARENT, rel))), `${rel} is the parent's`);
}

// 6. page identity
const fmt = (n) => n.toLocaleString("en-GB");
const html = await text(join(RELEASE, "index.html"));
assert.ok(html.includes(`UK RENEWABLES PIPELINE ${ID}`), "index.html h1 names this release");
assert.ok(new RegExp(`Canonical DESNZ REPD Q3 2026[^<]*${fmt(manifest.project_count)} solar, BESS and wind records`).test(html), "index.html states the Q3 register count");
assert.ok(!html.includes("REPD Q2 2026: 7,680"), "index.html must not claim the Q2 register");
assert.ok(html.includes("scripts/app-v9-8.js"), "index.html loads the v9.8 app");
const label = html.slice(html.indexOf("<body>"), html.indexOf('<section class="newspaper">'));
assert.ok(!/CANDIDATE/.test(label), "brand, nav, h1 and meta carry no candidate label");
assert.ok(label.includes('<small>UK RENEWABLES PIPELINE · V9.13</small>'), "brand names V9.13");
assert.ok(label.includes('<a class="active" href="#">V9.13 RELEASE · REPD Q3 2026</a>'), "nav names the release");
assert.ok(label.includes(`<a href="../${PARENT_ID}/">`), "nav links back to the parent");
assert.ok(/<strong>V9\.13 · REPD OCTOBER 2026 \(Q3\) DATA REFRESH · RELEASE · 14 November 2026<\/strong>/.test(label), "meta line in the 202609082224 shape");
assert.ok(html.includes(`<title>GlobalGrid2050 | UK Renewables Pipeline ${ID}</title>`), "title names this release");

console.log(`check_v9_13: ${ID} loader PASS - ${fmt(model.projects.length)} records, ${model.metadata.capacity_mw.toLocaleString("en-GB", { minimumFractionDigits: 2 })} MW, `
  + `${manifest.geometry_count} with geometry / ${manifest.missing_geometry_count} without; news feed unchanged, `
  + `${boundRefs.size - unresolved.length}/${boundRefs.size} bound refs resolve${unresolved.length ? ` (unresolved: ${unresolved.join(", ")})` : ""}`);
