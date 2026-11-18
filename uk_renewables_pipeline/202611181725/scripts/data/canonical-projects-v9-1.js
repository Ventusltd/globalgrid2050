const CONTRACT_URL = "contracts/release.v9.1.json";
const MANIFEST_URL = "data/v9.1/build_manifest.json";
const ALLOWED_TECHNOLOGIES = new Set(["solar", "bess", "wind_onshore", "wind_offshore"]);

function invariant(condition, message) {
  if (!condition) throw new Error(`V9.1 canonical projects: ${message}`);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* WHY THIS IS NO LONGER cache: "no-store".
 *
 * Every file this module reads lives inside a published release directory,
 * and a published release directory never changes - that is the whole point
 * of the timestamp in the path. Asking the browser not to store them meant
 * re-downloading the entire 1.15 MB spine on every visit and every deep link,
 * ignoring the server's own max-age.
 *
 * Measured on the live 202609061004 build, same file, same session:
 *
 *     cache: "no-store"   454 ms, 533 ms   (every single time)
 *     cache: "default"      4 ms,   3 ms   (after the first)
 *
 * Roughly 150x, across sixteen parts. No REPD record is dropped, filtered or
 * summarised to get it: the bytes are identical, they are simply allowed to
 * be reused. Integrity does not rest on re-fetching - it rests on the sha256
 * and record-count invariants asserted below, which run on every load whether
 * the bytes came from the network or the cache.
 */
async function fetchJson(path) {
  const response = await fetch(path, { cache: "default" });
  invariant(response.ok, `${path} returned HTTP ${response.status}`);
  invariant(new URL(response.url).origin === window.location.origin, `${path} redirected cross-origin`);
  return response.json();
}

export async function loadCanonicalProjectsV9_1({ onPartition } = {}) {
  const [contract, payload] = await Promise.all([fetchJson(CONTRACT_URL), fetchJson(MANIFEST_URL)]);
  invariant(contract.release === "9.1", "release contract mismatch");
  invariant(payload.schema === "globalgrid2050.v9.project-spine-build.v9.1", "project manifest schema mismatch");
  invariant(payload.release === "9.1", "project release mismatch");
  invariant(Array.isArray(payload.project_partitions) && payload.project_partitions.length > 0, "project partitions missing");
  invariant(payload.source_identity_sha256 === contract.source.identity_fixture_sha256, "identity hash mismatch");
  invariant(payload.source_coordinate_fixture_sha256 === contract.source.coordinate_fixture_sha256, "coordinate hash mismatch");
  invariant(payload.source_workbook_sha256 === contract.source.workbook_sha256, "workbook hash mismatch");

  /* The sixteen partitions are still fetched together and still ALL have to
   * arrive: onPartition is a progress signal, not a licence to render a
   * partial pipeline. Every invariant below still runs over the complete set,
   * and the total is still asserted against the manifest's own count, so a
   * short read fails loudly instead of quietly publishing fewer projects. */
  const partitions = await Promise.all(payload.project_partitions.map(async (partition, index) => {
    const part = await fetchJson(partition.path);
    invariant(part.schema === "globalgrid2050.v9.project-partition.v9.1", `${partition.path} schema mismatch`);
    invariant(part.record_count === partition.record_count && part.projects.length === partition.record_count, `${partition.path} count mismatch`);
    if (typeof onPartition === "function") {
      onPartition({ index, of: payload.project_partitions.length, records: part.projects.length });
    }
    return part.projects;
  }));
  const sourceProjects = partitions.flat();
  invariant(sourceProjects.length === payload.project_count, "partition total mismatch");

  const refs = new Set();
  const projectIds = new Set();
  let capacity = 0;
  let largest = 0;
  const counts = { solar: 0, bess: 0, wind_onshore: 0, wind_offshore: 0 };
  const projects = sourceProjects.map((project) => {
    invariant(typeof project.repd_ref === "string" && project.repd_ref, "missing REPD Ref");
    invariant(project.gg_project_id === `GG2050-REPD-${project.repd_ref}`, `invalid ID for ${project.repd_ref}`);
    invariant(project.identity_status === "REPD_BOUND" && project.identity_confidence === "authoritative", `unbound identity for ${project.repd_ref}`);
    invariant(ALLOWED_TECHNOLOGIES.has(project.technology), `out-of-scope technology for ${project.repd_ref}`);
    invariant(Number.isFinite(project.capacity_mw) && project.capacity_mw >= 1, `capacity below 1 MW for ${project.repd_ref}`);
    invariant(!refs.has(project.repd_ref), `duplicate REPD Ref ${project.repd_ref}`);
    invariant(!projectIds.has(project.gg_project_id), `duplicate project ID ${project.gg_project_id}`);
    refs.add(project.repd_ref);
    projectIds.add(project.gg_project_id);
    counts[project.technology] += 1;
    capacity += project.capacity_mw;
    largest = Math.max(largest, project.capacity_mw);
    return Object.freeze({ ...project });
  });

  const actual = {
    project_count: projects.length,
    capacity_mw: round2(capacity),
    largest_mw: largest,
    solar_count: counts.solar,
    bess_count: counts.bess,
    wind_onshore_count: counts.wind_onshore,
    wind_offshore_count: counts.wind_offshore,
  };
  Object.entries(contract.expected).forEach(([key, value]) => invariant(actual[key] === value, `${key} is ${actual[key]}, expected ${value}`));
  return Object.freeze({
    contract: Object.freeze(contract),
    metadata: Object.freeze({ ...payload, projects: undefined }),
    projects: Object.freeze(projects),
  });
}
