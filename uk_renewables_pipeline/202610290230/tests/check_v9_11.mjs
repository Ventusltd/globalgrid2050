/* check_v9_11.mjs - the V9.10 proofs, unchanged, plus the V9.11 change: the
 * chart library is one exact file checked by Subresource Integrity.
 * Derived from check_v9_10.mjs; the interconnector and REPD-spine proofs are
 * that file's, the parent is now 202609082224, and the identity assertions at
 * the end move to V9.11.
 *
 * Run: node tests/check_v9_11.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELEASE = join(HERE, "..");
const PARENT = join(RELEASE, "..", "202609082224");
const text = (p) => readFile(p, "utf8");
const json = async (p) => JSON.parse(await text(p));
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

const builder = await import(new URL("../scripts/build/interconnectors-v9-8.mjs", import.meta.url).href);
const link = await import(new URL("../scripts/core/atlas-interconnector-link-v9-8.js", import.meta.url).href);
const receiver = await import(new URL("../scripts/core/atlas-receiver-v9-7.js", import.meta.url).href);

const contract = await json(join(RELEASE, "contracts", "interconnectors.v9.8.json"));
const manifest = await json(join(RELEASE, "data", "v9.8", "interconnectors_manifest.json"));
const partitionText = await text(join(RELEASE, manifest.partition.path));
const partition = JSON.parse(partitionText);

// 1. the product is the build of the pinned fixtures
assert.equal(manifest.schema, builder.MANIFEST_SCHEMA);
assert.equal(partition.schema, builder.SCHEMA);
assert.equal(sha256(partitionText), manifest.partition.sha256, "partition sha256 must match its manifest");
for (const [key, source] of Object.entries(builder.SOURCES)) {
  const bytes = await readFile(join(RELEASE, source.path));
  assert.equal(sha256(bytes), source.sha256, `${key}: fixture bytes are not the pinned blob`);
}
const cables = builder.parseCsv(await text(join(RELEASE, builder.SOURCES.cables_csv.path)));
const endpoints = await json(join(RELEASE, builder.SOURCES.endpoints.path));
const geojson = await json(join(RELEASE, builder.SOURCES.geojson.path));
const rebuilt = builder.buildRecords({ cables, endpoints, geojson });
assert.deepEqual(partition.records, rebuilt, "data/v9.8/interconnectors.json is not what the fixtures build");

// the contract's expected figures
assert.equal(partition.records.length, contract.expected.record_count);
assert.equal(manifest.record_count, contract.expected.record_count);
assert.equal(manifest.capacity_mw, contract.expected.capacity_mw);
assert.equal(manifest.largest_mw, contract.expected.largest_mw);
for (const key of ["operational", "future", "geometry_valid", "geometry_gb_end_only", "geometry_missing"]) {
  assert.equal(manifest[key], contract.expected[key], `manifest ${key}`);
}
const refs = new Set(partition.records.map((r) => r.repd_ref));
assert.equal(refs.size, partition.records.length, "refs unique");
for (const record of partition.records) {
  assert.equal(record.technology, "interconnector");
  assert.match(record.repd_ref, /^IC-[A-Z0-9-]+$/);
  assert.equal(record.gg_project_id, `GG2050-${record.repd_ref}`);
  if (record.geometry_status === "valid") {
    assert.equal(record.anchor_kind, "MIDPOINT_LABEL_ANCHOR");
    assert.ok(record.span && record.span.straight_line_km > 0);
    assert.ok(record.gb_end && record.far_end);
  } else if (record.geometry_status === "gb_end_only") {
    assert.equal(record.anchor_kind, "GB_CONVERTER");
    assert.equal(record.longitude, record.gb_end.longitude);
    assert.equal(record.latitude, record.gb_end.latitude);
  } else {
    assert.equal(record.geometry_status, "missing");
    assert.equal(record.longitude, null);
    assert.equal(record.latitude, null);
  }
}
// the named spans, as measured
const britned = partition.records.find((r) => r.bmrs_code === "INTNED");
assert.equal(britned.span.straight_line_km, 234.9);
assert.equal(britned.geometry_status, "valid");
const eleclink = partition.records.find((r) => r.bmrs_code === "INTELEC");
assert.equal(eleclink.span.straight_line_km, 59.93);

// 2. every MAP link, with the page's own builder
const route = receiver.atlasReceiverV9_7();
assert.equal(route, contract.canonical_receiver, "the canonical receiver is the compiled contract's");
let linked = 0;
let unlinked = 0;
for (const record of partition.records) {
  const href = link.buildAtlasInterconnectorLinkV9_8(record);
  if (record.geometry_status === "missing") {
    assert.equal(href, "", `${record.name}: no coordinate held, so no link`);
    assert.match(link.interconnectorMapUnavailableReasonV9_8(record), /no converter coordinates/);
    unlinked += 1;
    continue;
  }
  linked += 1;
  const url = new URL(href);
  assert.equal(`${url.origin}${url.pathname}`, route.replace(/\/+$/u, "") + "/", `${record.name}: receiver`);
  assert.equal(url.searchParams.get("interconnector"), record.bmrs_code, `${record.name}: identity is the BMRS code`);
  assert.equal(url.searchParams.get("technology"), "interconnector");
  assert.equal(url.searchParams.get("project"), record.name);
  assert.equal(Number(url.searchParams.get("capacity_mw")), record.capacity_mw);
  assert.equal(Number(url.searchParams.get("latitude")), record.latitude, `${record.name}: THIS record's latitude`);
  assert.equal(Number(url.searchParams.get("longitude")), record.longitude);
  assert.equal(url.searchParams.get("anchor"), record.geometry_status === "valid" ? "midpoint" : "gb_converter");
  assert.equal(url.searchParams.get("zoom"), record.geometry_status === "valid" ? "7" : "10");
  assert.equal(url.searchParams.has("repd_ref"), false, `${record.name}: an interconnector must never claim a REPD reference`);
  assert.ok(link.interconnectorMapNoteV9_8(record).length > 20);
}
assert.equal(linked, contract.expected.geometry_valid + contract.expected.geometry_gb_end_only);
assert.equal(unlinked, contract.expected.geometry_missing);

// 3. the REPD spine is untouched
const spine = await json(join(RELEASE, "data", "v9.1", "build_manifest.json"));
const parentSpine = await json(join(PARENT, "data", "v9.1", "build_manifest.json"));
assert.deepEqual(spine, parentSpine, "the v9.1 spine manifest must be byte-identical to the parent's");
assert.equal(spine.project_count, 7680);
let spineRows = 0;
for (const part of spine.project_partitions) {
  const doc = JSON.parse(await text(join(RELEASE, part.path)));
  assert.equal(sha256(await text(join(RELEASE, part.path))), part.sha256, `${part.path} hash`);
  for (const project of doc.projects) {
    assert.notEqual(project.technology, "interconnector", `${project.repd_ref}: an interconnector inside the REPD spine`);
    assert.doesNotMatch(String(project.repd_ref), /^IC-/);
  }
  spineRows += doc.projects.length;
}
assert.equal(spineRows, 7680);

// the page itself carries the tab and loads the v9.8 app
const html = await text(join(RELEASE, "index.html"));
assert.match(html, /data-technology="interconnector"[^>]*>INTERCONNECTORS</);
assert.match(html, /scripts\/app-v9-8\.js/);
assert.match(html, /styles\/v9-10\.css/);
assert.match(html, /UK RENEWABLES PIPELINE 202610290230/);
assert.match(html, /V9\.11 CANDIDATE/);
assert.doesNotMatch(html, /UK RENEWABLES PIPELINE 202609082224|app-v9-9\.js|app-v9-7\.js/);

// 4. V9.11: every external script is pinned to an exact version and carries SRI
const CHART_URL = "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js";
const CHART_SRI = "sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ";
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
const external = scripts.filter((m) => /^(https?:)?\/\//.test(m[1]));
assert.equal(external.length, 1, "exactly one external script (Chart.js)");
const [tag, src] = external[0];
assert.equal(src, CHART_URL, "Chart.js is the exact pinned file");
assert.match(tag, new RegExp(`integrity="${CHART_SRI.replace(/[+/]/g, "\\$&")}"`), "Chart.js carries the pinned SRI hash");
assert.match(tag, /crossorigin="anonymous"/, "SRI on a cross-origin script needs CORS mode");
// Optional: prove the hash from the npm bytes. CHARTJS_PKG_DIR is the
// "package" directory of the extracted tarball (npm pack chart.js@4.5.1).
if (process.env.CHARTJS_PKG_DIR) {
  const bytes = await readFile(join(process.env.CHARTJS_PKG_DIR, "dist", "chart.umd.min.js"));
  const digest = "sha384-" + createHash("sha384").update(bytes).digest("base64");
  assert.equal(digest, CHART_SRI, "SRI hash is the SHA-384 of the npm file");
  console.log("check_v9_11: Chart.js SRI recomputed from the npm bytes");
}

console.log(`check_v9_11: ${partition.records.length} interconnectors (${manifest.operational} operational, ${manifest.future} future), `
  + `${linked} MAP links built, ${unlinked} honest NO MAP; REPD spine 7,680 untouched; Chart.js pinned with SRI`);
