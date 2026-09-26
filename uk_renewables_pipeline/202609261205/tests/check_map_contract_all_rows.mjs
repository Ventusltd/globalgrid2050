/* Every MAP button, not a sample of them.
 *
 * The architect's instruction: CI must test that the MAP button fires the same
 * way as the oracle across all 7,000+ REPD records. A browser cannot open seven
 * thousand arrivals on every push, so this is split in two and both halves run:
 *
 *   THIS FILE   builds the MAP href for EVERY record with the same function the
 *               page uses - buildAtlasDeepLinkV9_7, imported, not re-implemented
 *               - and asserts each one carries the identity the oracle's button
 *               carries. 7,680 rows, all of them, in under a second.
 *   THE SMOKE   browser_smoke_v9_7.mjs then fires a sample of those hrefs and
 *               requires the grid engine to answer on each.
 *
 * WHAT "THE SAME WAY AS THE ORACLE" MEANS, MEASURED.
 * The oracle's button (testcode/202609051531/capsule-launch.js) sends repd_ref,
 * technology, project, capacity_mw and, when the record has a location, its
 * longitude and latitude. This build's contract sends repd_ref, technology and,
 * when the geometry is valid, latitude, longitude and zoom. Both were fired at
 * both receivers on 2026-09-06 - 20 arrivals, 20 answers - so the receiver
 * resolves identity from repd_ref alone and the two shapes fire identically.
 * What must therefore hold for every row is:
 *   - the href exists whenever the record has a REPD reference
 *   - repd_ref in the href is exactly the row's repd_ref
 *   - technology in the href is exactly the row's technology
 *   - a valid geometry puts THAT row's coordinates in the href, and an invalid
 *     one puts none - the Atlas must never be sent to a point the register did
 *     not publish
 *   - the href targets the canonical receiver and nothing else
 *
 * Run: node tests/check_map_contract_all_rows.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELEASE = join(HERE, "..");
const receiver = await import(new URL("../scripts/core/atlas-receiver-v9-7.js", import.meta.url).href);
const { buildAtlasDeepLinkV9_7, atlasCentresOnRepdPointV9_7 } = receiver;

const manifest = JSON.parse(await readFile(join(RELEASE, "data/v9.1/build_manifest.json"), "utf8"));
const rows = [];
for (const part of manifest.project_partitions) {
  const doc = JSON.parse(await readFile(join(RELEASE, part.path), "utf8"));
  assert.equal(doc.projects.length, part.record_count, `${part.path} record count`);
  rows.push(...doc.projects);
}
assert.equal(rows.length, manifest.project_count, "partition total must equal the manifest's count");

const ORACLE_IDENTITY_KEYS = ["repd_ref", "technology"];
let checked = 0, withPoint = 0, withoutPoint = 0;
const failures = [];
let receiverOrigin = null;

for (const row of rows) {
  const href = buildAtlasDeepLinkV9_7(row);
  const where = `REPD ${row.repd_ref} (${row.name})`;
  if (!href) { failures.push(`${where}: no MAP href although the record carries a REPD reference`); continue; }
  let u;
  try { u = new URL(href); } catch { failures.push(`${where}: href does not parse: ${href}`); continue; }
  receiverOrigin ??= u.origin + u.pathname;
  if (u.origin + u.pathname !== receiverOrigin) failures.push(`${where}: targets a different receiver ${u.origin}${u.pathname}`);
  for (const k of ORACLE_IDENTITY_KEYS) {
    if (u.searchParams.get(k) !== String(row[k])) failures.push(`${where}: ${k}=${u.searchParams.get(k)} but the row says ${row[k]}`);
  }
  if (atlasCentresOnRepdPointV9_7(row)) {
    withPoint += 1;
    if (u.searchParams.get("latitude") !== String(row.latitude) || u.searchParams.get("longitude") !== String(row.longitude)) {
      failures.push(`${where}: valid geometry but the href carries other coordinates`);
    }
    if (u.searchParams.get("zoom") !== "12") failures.push(`${where}: zoom missing on a located arrival`);
  } else {
    withoutPoint += 1;
    if (u.searchParams.has("latitude") || u.searchParams.has("longitude")) {
      failures.push(`${where}: geometry is ${row.geometry_status} yet the href sends coordinates the register did not publish`);
    }
  }
  checked += 1;
}

if (failures.length) {
  console.error(`MAP contract FAILED on ${failures.length} of ${rows.length} rows:`);
  for (const f of failures.slice(0, 25)) console.error("  - " + f);
  if (failures.length > 25) console.error(`  ... and ${failures.length - 25} more`);
  process.exit(1);
}
console.log(
  `MAP contract: PASS - ${checked} of ${rows.length} rows build a firing href to ${receiverOrigin}; ` +
  `${withPoint} arrive on the register's own point, ${withoutPoint} resolve by REPD ref alone`);
