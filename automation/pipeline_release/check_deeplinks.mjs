#!/usr/bin/env node
/* check_deeplinks.mjs - every row of one version, against two contracts.
 *
 *   MAP contract          the href the page builds for the MAP button carries the
 *                         row's own REPD reference and technology, the row's own
 *                         coordinates when the geometry is valid and none otherwise.
 *   Grid Engine contract  the same href obeys the Ventus Grid Engine deep-link
 *                         contract (grid_engine_contract.json): canonical receiver,
 *                         no retired receiver, only contract parameters, a numeric
 *                         REPD reference, a technology from the contract's buckets.
 *                         The Grid Engine is the engine behind the MAP link: its
 *                         contract names GridAtlas as the receiver that carries
 *                         it. There is no second link.
 *
 * Usage: node check_deeplinks.mjs <version folder> [<hrefs.json>]
 * Prints one JSON object. With a second argument it also writes every row's MAP
 * href keyed by REPD reference, so a version can be compared with its parent row
 * by row (verify.py requires the hrefs to be identical).
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const release = resolve(process.argv[2]);
const contract = JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)), "grid_engine_contract.json"), "utf8"));
const strip = (u) => String(u).split("?")[0].split("#")[0].replace(/\/+$/, "");
const { buildAtlasDeepLinkV9_7, atlasCentresOnRepdPointV9_7 } = await import(pathToFileURL(join(release, "scripts/core/atlas-receiver-v9-7.js")).href);

const manifest = JSON.parse(await readFile(join(release, "data/v9.1/build_manifest.json"), "utf8"));
const rows = [];
for (const part of manifest.project_partitions) rows.push(...JSON.parse(await readFile(join(release, part.path), "utf8")).projects);

function contractFaults(href, row) {
  const faults = [];
  let u;
  try { u = new URL(href); } catch { return ["href does not parse"]; }
  if (strip(u.origin + u.pathname) !== strip(contract.canonical_receiver)) faults.push("not the canonical receiver");
  if (contract.retired_receivers.some((r) => strip(r) === strip(u.origin + u.pathname))) faults.push("retired receiver");
  for (const key of u.searchParams.keys()) if (!contract.params.includes(key)) faults.push(`parameter outside the contract: ${key}`);
  const ref = u.searchParams.get(contract.identity_param);
  if (!/^\d+$/.test(ref || "")) faults.push("REPD reference missing or not numeric");
  if (ref !== String(row.repd_ref)) faults.push("REPD reference is not the row's");
  const tech = u.searchParams.get("technology");
  if (!contract.buckets.includes(tech)) faults.push(`technology outside the contract buckets: ${tech}`);
  if (tech !== String(row.technology)) faults.push("technology is not the row's");
  const located = atlasCentresOnRepdPointV9_7(row);
  const hasPoint = u.searchParams.has("latitude") && u.searchParams.has("longitude");
  if (located && (u.searchParams.get("latitude") !== String(row.latitude) || u.searchParams.get("longitude") !== String(row.longitude))) faults.push("valid geometry but not the row's coordinates");
  if (!located && (u.searchParams.has("latitude") || u.searchParams.has("longitude"))) faults.push("coordinates sent for a row without valid geometry");
  if (hasPoint && !u.searchParams.has("zoom")) faults.push("located link without zoom");
  return faults;
}

const result = { rows: rows.length, map: { ok: 0, failed: 0 }, grid_engine: { link: "the MAP link (the contract's canonical receiver carries the engine)", ok: 0, failed: 0 }, with_point: 0, without_point: 0, examples: [] };
const hrefs = {};
for (const row of rows) {
  if (atlasCentresOnRepdPointV9_7(row)) result.with_point += 1; else result.without_point += 1;
  const href = buildAtlasDeepLinkV9_7(row);
  hrefs[row.repd_ref] = href || "";
  const faults = href ? contractFaults(href, row) : ["no MAP href"];
  // MAP contract: identity, technology and coordinates are the row's own.
  const mapFaults = faults.filter((f) => /row's|coordinates|zoom|no MAP href|parse/.test(f));
  // Grid Engine contract: receiver, parameter names, vocabulary.
  const engineFaults = faults.filter((f) => !mapFaults.includes(f) || /no MAP href|parse/.test(f));
  if (mapFaults.length) { result.map.failed += 1; if (result.examples.length < 10) result.examples.push(`MAP REPD ${row.repd_ref}: ${mapFaults.join("; ")}`); } else result.map.ok += 1;
  if (engineFaults.length) { result.grid_engine.failed += 1; if (result.examples.length < 10) result.examples.push(`GRID ENGINE REPD ${row.repd_ref}: ${engineFaults.join("; ")}`); } else result.grid_engine.ok += 1;
}
result.unique_refs = Object.keys(hrefs).length;
result.hrefs_sha256 = createHash("sha256").update(Object.keys(hrefs).sort((a, b) => a - b).map((k) => `${k} ${hrefs[k]}`).join("\n")).digest("hex");
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(hrefs));
result.pass = result.rows === manifest.project_count && result.unique_refs === result.rows && result.map.failed === 0 && result.grid_engine.failed === 0;
console.log(JSON.stringify(result));
process.exit(result.pass ? 0 : 1);
