/* Loads the interconnector data product, and refuses anything but the pinned one.
 *
 * Same discipline as canonical-projects: the manifest names the partition and
 * its sha256; the partition is read, hashed and counted; a mismatch fails
 * closed. Nothing cross-origin, nothing derived at read time. */
const MANIFEST_URL = "data/v9.8/interconnectors_manifest.json";
const MANIFEST_SCHEMA = "globalgrid2050.v9.interconnector-build.v9.8";
const PARTITION_SCHEMA = "globalgrid2050.v9.interconnector-partition.v9.8";
const TECHNOLOGY = "interconnector";

function invariant(condition, message) {
  if (!condition) throw new Error(`V9.8 interconnectors: ${message}`);
}

async function fetchText(path) {
  const response = await fetch(path, { cache: "default" });
  invariant(response.ok, `${path} returned HTTP ${response.status}`);
  invariant(new URL(response.url).origin === window.location.origin, `${path} redirected cross-origin`);
  return response.text();
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadInterconnectorsV9_8() {
  const manifest = JSON.parse(await fetchText(MANIFEST_URL));
  invariant(manifest.schema === MANIFEST_SCHEMA, "manifest schema mismatch");
  invariant(manifest.technology === TECHNOLOGY, "manifest technology mismatch");
  const partitionText = await fetchText(manifest.partition.path);
  const digest = await sha256Hex(partitionText);
  invariant(digest === manifest.partition.sha256, `${manifest.partition.path} sha256 mismatch`);
  const partition = JSON.parse(partitionText);
  invariant(partition.schema === PARTITION_SCHEMA, "partition schema mismatch");
  invariant(Array.isArray(partition.records) && partition.records.length === manifest.record_count, "record count mismatch");
  invariant(partition.record_count === partition.records.length, "partition count mismatch");
  const refs = new Set();
  for (const record of partition.records) {
    invariant(record.technology === TECHNOLOGY, `${record.name}: technology is not ${TECHNOLOGY}`);
    invariant(typeof record.repd_ref === "string" && record.repd_ref.startsWith("IC-"), `${record.name}: ref must be IC-…`);
    invariant(!refs.has(record.repd_ref), `${record.repd_ref}: duplicate ref`);
    refs.add(record.repd_ref);
    invariant(Number.isFinite(record.capacity_mw) && record.capacity_mw > 0, `${record.name}: capacity`);
    if (record.geometry_status === "valid" || record.geometry_status === "gb_end_only") {
      invariant(Number.isFinite(record.longitude) && Number.isFinite(record.latitude), `${record.name}: located but no anchor`);
    } else {
      invariant(record.longitude === null && record.latitude === null, `${record.name}: unlocated but carries an anchor`);
    }
  }
  return { records: partition.records, manifest, partition };
}
