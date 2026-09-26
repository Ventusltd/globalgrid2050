/* INTERCONNECTORS AS A TECHNOLOGY TAB - the data product behind it.
 *
 * The REPD is a register of generation and storage planning applications. An
 * interconnector is in it nowhere: it is not a generator, it has two ends, and
 * its connection is already known - the thing at the other end of its own
 * cable. So the sixteen GB interconnectors are NOT added to the REPD spine
 * (7,680 records, pinned by contract and by every gate in this release). They
 * are a separate, pinned data product that the INTERCONNECTORS tab reads, with
 * the same row shape the table already renders, and a MAP link that carries the
 * link's own identity (`interconnector=INTNED`) rather than a REPD reference.
 *
 * INPUTS, ALL PINNED IN fixtures/v9.8 AS GIT BLOB BYTES (LF), NEVER FETCHED:
 *   interconnector_cables.csv     Ventusltd/data-interconnectors, the reference
 *                                 list: BMRS code, country, name, capacity GW,
 *                                 status, target year. 10 operational, 6 future.
 *   interconnector-endpoints.json Ventusltd/gridatlas atlas/data: GB converter
 *                                 from our own substation payload for all 10
 *                                 operational links; far-end converter from
 *                                 OpenStreetMap power=converter for 2 of them.
 *   interconnectors.geojson       the two drawable straight lines and their
 *                                 midpoints, as the Atlas draws them.
 *
 * WHAT A COORDINATE MEANS HERE. A link with both converters known gets the
 * great-circle midpoint as its latitude/longitude. That point is a LABEL
 * ANCHOR - a place to hang the name on a map - and not a location of anything;
 * a BritNed midpoint is in the North Sea. The record says so in
 * `anchor_kind`, and the Atlas is told the link's identity so it can fire its
 * span model at both converters instead of measuring from the sea. A link with
 * only the GB converter known carries that converter's position and says so.
 * A link with no converter coordinates held carries none, and its row says
 * NO MAP with the reason, the same discipline the 28 REPD rows without a
 * coordinate already follow.
 *
 * DETERMINISTIC. No timestamps in the output; the same fixtures produce the
 * same bytes, so `git diff --exit-code -- data` in the runner can prove the
 * committed product is what this script builds.
 *
 * Run: node scripts/build/interconnectors-v9-8.mjs
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RELEASE = join(HERE, "..", "..");
const FIXTURES = join(RELEASE, "fixtures", "v9.8");
const OUT_DIR = join(RELEASE, "data", "v9.8");

export const SCHEMA = "globalgrid2050.v9.interconnector-partition.v9.8";
export const MANIFEST_SCHEMA = "globalgrid2050.v9.interconnector-build.v9.8";
export const TECHNOLOGY = "interconnector";

/* Where each fixture came from, by commit and blob, so a reader can verify the
   pinned bytes against the owning repository without trusting this file. */
export const SOURCES = Object.freeze({
  cables_csv: Object.freeze({
    path: "fixtures/v9.8/interconnector_cables.csv",
    repository: "Ventusltd/data-interconnectors",
    repository_path: "reference/interconnector_cables.csv",
    commit: "1e00d0e4d7bf3ddbc86224b3b6be5c2f3eaabf86",
    blob: "f9581dec21e4db558d3befd79eb897b680448af4",
    sha256: "0ea612d869624e23cd97e391c47e790f2488e6c0d14233d234b19d3324bfa36d",
  }),
  endpoints: Object.freeze({
    path: "fixtures/v9.8/interconnector-endpoints.json",
    repository: "Ventusltd/gridatlas",
    repository_path: "atlas/data/interconnector-endpoints.json",
    commit: "7910d92d0f44c5248695e8eaf02aa3c7db961eee",
    blob: "70d650e54ca3e08698337e659d899b33ea82eec2",
    sha256: "df7d38ec7b8ec27fdc0f59b5f34e64d5d53165918321d8324db31b3c32e97271",
  }),
  geojson: Object.freeze({
    path: "fixtures/v9.8/interconnectors.geojson",
    repository: "Ventusltd/gridatlas",
    repository_path: "atlas/data/interconnectors.geojson",
    commit: "7910d92d0f44c5248695e8eaf02aa3c7db961eee",
    blob: "5047f6f04d9e2647f981912f77bd7cea1d93bcf3",
    sha256: "50fb06803d458ca18f3ebc4ce525562db0eec350054b68d35539cc985929a641",
  }),
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (value, places) => Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places;

function invariant(condition, message) {
  if (!condition) throw new Error(`V9.8 interconnectors: ${message}`);
}

/* A quote-aware CSV reader. split(",") is how an 87% figure got published once
   in this estate; the reference file has no quoted fields today, and this
   still refuses to depend on that staying true. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

/* Great-circle midpoint on the estate's sphere (6371.0088 km), the same
   arithmetic the Atlas uses for the span, so the two never disagree. */
const EARTH_KM = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
export function haversineKm(lon1, lat1, lon2, lat2) {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dp = rad(lat2 - lat1);
  const dl = rad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}
export function midpoint(lon1, lat1, lon2, lat2) {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const l1 = rad(lon1);
  const dl = rad(lon2 - lon1);
  const bx = Math.cos(p2) * Math.cos(dl);
  const by = Math.cos(p2) * Math.sin(dl);
  const lat = Math.atan2(Math.sin(p1) + Math.sin(p2), Math.sqrt((Math.cos(p1) + bx) ** 2 + by ** 2));
  const lon = l1 + Math.atan2(by, Math.cos(p1) + bx);
  return { longitude: round(deg(lon), 5), latitude: round(deg(lat), 5) };
}

export function slugOf(name) {
  return String(name).normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function endOf(name, lon, lat, source) {
  if (!name && !(Number.isFinite(lon) && Number.isFinite(lat))) return null;
  return { name: name || null, longitude: Number.isFinite(lon) ? lon : null, latitude: Number.isFinite(lat) ? lat : null, source: source || null };
}

export function buildRecords({ cables, endpoints, geojson }) {
  const byBmrs = new Map(endpoints.endpoints.map((e) => [e.bmrs, e]));
  const lines = new Map(geojson.features
    .filter((f) => f.properties && f.properties.feature_role === "link-line")
    .map((f) => [f.properties.bmrs_code, f]));
  const mids = new Map(geojson.features
    .filter((f) => f.properties && f.properties.feature_role === "midpoint")
    .map((f) => [f.properties.bmrs_code, f]));

  const records = cables.map((row, index) => {
    const bmrs = row.bmrsCode.trim() || null;
    const name = row.interconnectorName.trim();
    invariant(name, `row ${index + 1} has no interconnector name`);
    const capacityGw = Number(row.capacityGW);
    invariant(Number.isFinite(capacityGw) && capacityGw > 0, `${name}: capacity GW unusable "${row.capacityGW}"`);
    const status = row.status.trim();
    invariant(status === "operational" || status === "future", `${name}: status "${status}" is neither operational nor future`);
    const target = row.targetOperational.trim() ? Number(row.targetOperational) : null;
    const ref = bmrs ? `IC-${bmrs}` : `IC-${slugOf(name)}`;
    const end = bmrs ? byBmrs.get(bmrs) : null;
    const gbEnd = end ? endOf(end.gb_name, end.gb_lon, end.gb_lat, end.gb_source) : null;
    const farEnd = end ? endOf(end.far_name, end.far_lon, end.far_lat, end.far_source) : null;
    const gbLocated = Boolean(gbEnd && Number.isFinite(gbEnd.longitude) && Number.isFinite(gbEnd.latitude));
    const farLocated = Boolean(farEnd && Number.isFinite(farEnd.longitude) && Number.isFinite(farEnd.latitude));

    let geometryStatus = "missing";
    let anchor = { longitude: null, latitude: null, anchor_kind: "NONE" };
    let span = null;
    if (gbLocated && farLocated) {
      geometryStatus = "valid";
      const line = lines.get(bmrs);
      const drawnMid = mids.get(bmrs);
      invariant(line, `${name}: both converters located but the Atlas geojson carries no line for ${bmrs}`);
      invariant(drawnMid, `${name}: no midpoint feature in the Atlas geojson for ${bmrs}`);
      /* The anchor is the node the Atlas actually draws, so the MAP link and
         the map agree. Measured: that node is the planar mean of the two
         converter coordinates, and on BritNed it sits 1.4 km from the
         great-circle midpoint. Neither is a location of anything; the drawn
         one is the one a reader will see, and the geodesic one is kept beside
         it so the difference is stated rather than discovered. */
      const [dLon, dLat] = drawnMid.geometry.coordinates;
      const geodesic = midpoint(gbEnd.longitude, gbEnd.latitude, farEnd.longitude, farEnd.latitude);
      const drift = haversineKm(dLon, dLat, geodesic.longitude, geodesic.latitude);
      invariant(drift < 5, `${name}: the Atlas midpoint is ${drift.toFixed(1)} km from the great-circle midpoint; not a midpoint`);
      anchor = { longitude: dLon, latitude: dLat, anchor_kind: "MIDPOINT_LABEL_ANCHOR" };
      const p = line.properties;
      span = {
        straight_line_km: p.straight_line_km,
        geometry_kind: p.geometry_kind,
        route_factor: p.route_factor ?? null,
        known_submarine_cable_km: p.known_submarine_cable_km ?? null,
        drawn_midpoint_is: "planar mean of the converter coordinates, as the Atlas draws it",
        great_circle_midpoint: geodesic,
        midpoints_differ_km: round(drift, 2),
      };
      const recomputed = round(haversineKm(gbEnd.longitude, gbEnd.latitude, farEnd.longitude, farEnd.latitude), 2);
      invariant(Math.abs(recomputed - p.straight_line_km) < 0.1,
        `${name}: span ${recomputed} km recomputed here differs from the Atlas ${p.straight_line_km} km`);
    } else if (gbLocated) {
      geometryStatus = "gb_end_only";
      anchor = { longitude: gbEnd.longitude, latitude: gbEnd.latitude, anchor_kind: "GB_CONVERTER" };
    }

    const flow = end && Number.isFinite(end.net_mwh) ? {
      years: end.flow_years, import_mwh: end.import_mwh, export_mwh: end.export_mwh,
      net_mwh: end.net_mwh, net_direction: end.net_direction,
    } : null;

    return {
      repd_ref: ref,
      ref_kind: bmrs ? "BMRS_CODE" : "NAME_SLUG",
      bmrs_code: bmrs,
      gg_project_id: `GG2050-${ref}`,
      gg_development_id: null,
      name,
      operator: null,
      country: row.country.trim(),
      county: "Interconnector",
      region: `GB - ${row.country.trim()}`,
      technology: TECHNOLOGY,
      repd_technology: "Interconnector (not a REPD record)",
      status: status === "operational" ? "Operational" : `Future${target ? ` - target ${target}` : ""}`,
      lifecycle: status === "operational" ? "OPERATIONAL" : "FUTURE",
      target_operational: target,
      capacity_mw: round(capacityGw * 1000, 2),
      capacity_known: true,
      identity_status: bmrs ? "BMRS_CODE_BOUND" : "NAMED_NO_BMRS_CODE",
      identity_confidence: bmrs ? "authoritative" : "reference",
      flow_data_status: row.flowDataStatus.trim(),
      project_link: row.projectLink.trim() || null,
      notes: row.notes.trim() || null,
      gb_end: gbEnd,
      far_end: farEnd,
      geometry_status: geometryStatus,
      longitude: anchor.longitude,
      latitude: anchor.latitude,
      anchor_kind: anchor.anchor_kind,
      span,
      flow,
      repd_record_updated: null,
      planning_authority: null,
      planning_application_reference: null,
      development_repd_refs: [],
      direct_related_repd_refs: [],
      planning_sibling_repd_refs: [],
      relationships: [],
    };
  });

  records.sort((a, b) => (b.capacity_mw - a.capacity_mw) || a.name.localeCompare(b.name, "en-GB"));
  const refs = new Set(records.map((r) => r.repd_ref));
  invariant(refs.size === records.length, "interconnector refs are not unique");
  return records;
}

export async function buildInterconnectorsV9_8() {
  const inputs = {};
  for (const [key, source] of Object.entries(SOURCES)) {
    const bytes = await readFile(join(RELEASE, source.path));
    const digest = sha256(bytes);
    invariant(digest === source.sha256, `${source.path} sha256 ${digest} is not the pinned ${source.sha256}`);
    inputs[key] = bytes.toString("utf8");
  }
  const cables = parseCsv(inputs.cables_csv);
  const endpoints = JSON.parse(inputs.endpoints);
  const geojson = JSON.parse(inputs.geojson);
  invariant(endpoints.schema === "gridatlas.interconnector-endpoints.v1", "endpoints schema");
  const records = buildRecords({ cables, endpoints, geojson });

  const partition = {
    schema: SCHEMA,
    release: "9.8",
    technology: TECHNOLOGY,
    statement: "GB interconnectors from the data-interconnectors reference list, located by our own GB converter positions and, where OpenStreetMap holds one, the far converter. Not REPD records; kept apart from the 7,680-record REPD spine. A midpoint is a label anchor, never a location.",
    record_count: records.length,
    records,
  };
  const partitionText = `${JSON.stringify(partition, null, 1)}\n`;
  const counts = {
    operational: records.filter((r) => r.lifecycle === "OPERATIONAL").length,
    future: records.filter((r) => r.lifecycle === "FUTURE").length,
    geometry_valid: records.filter((r) => r.geometry_status === "valid").length,
    geometry_gb_end_only: records.filter((r) => r.geometry_status === "gb_end_only").length,
    geometry_missing: records.filter((r) => r.geometry_status === "missing").length,
  };
  const manifest = {
    schema: MANIFEST_SCHEMA,
    release: "9.8",
    technology: TECHNOLOGY,
    partition: { path: "data/v9.8/interconnectors.json", record_count: records.length, sha256: sha256(partitionText) },
    sources: SOURCES,
    record_count: records.length,
    capacity_mw: round(records.reduce((sum, r) => sum + r.capacity_mw, 0), 2),
    largest_mw: Math.max(...records.map((r) => r.capacity_mw)),
    ...counts,
  };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, "interconnectors.json"), partitionText);
  await writeFile(join(OUT_DIR, "interconnectors_manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifest = await buildInterconnectorsV9_8();
  console.log(`interconnectors v9.8: ${manifest.record_count} records, ${manifest.capacity_mw} MW, `
    + `${manifest.operational} operational, ${manifest.future} future; geometry valid ${manifest.geometry_valid}, `
    + `GB end only ${manifest.geometry_gb_end_only}, missing ${manifest.geometry_missing}`);
}
