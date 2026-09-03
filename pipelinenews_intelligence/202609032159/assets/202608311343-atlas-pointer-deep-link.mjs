/**
 * PipelineNews -> GridAtlas deep-link cartridge.
 *
 * Generation 202608311343. Successor to 202608291447-atlas-pointer-deep-link.mjs.
 * DRAFT - deployment: not-authorised. Review before promoting.
 *
 * ---------------------------------------------------------------------------
 * WHAT CHANGED AND WHY
 * ---------------------------------------------------------------------------
 * The predecessor emitted   /gridatlas/<release_id>/?repd_ref=<n>
 * which fails twice:
 *
 *   FAULT 1 - wrong path. The release is served at
 *             /gridatlas/atlas/releases/<release_id>/ and GridAtlas'
 *             atlas/current.json declares the stable route as /gridatlas/atlas/.
 *             The "atlas/" segment was missing, so every link 404s.
 *
 *             Note the predecessor's own invariant ASSERTED the broken shape:
 *               receiverUrl.pathname === `/gridatlas/${release_id}/`
 *             so correcting base_url alone would have thrown. Both had to move
 *             together, which is why this is a new cartridge and not an edit.
 *
 *   FAULT 2 - stripped payload. The link carried the reference alone, so the
 *             atlas had to resolve it by booting a 35.7 MB query engine before
 *             it could move the map. The known-good legacy link carries
 *             repd_ref + project + technology + capacity_mw + latitude +
 *             longitude + zoom and flies straight there, resolving nothing.
 *
 *             Every one of those fields is ALREADY in the compact project index
 *             (fields: repd_ref, gg_project_id, name, technology, status,
 *             capacity_mw, county, region, operator, repd_record_updated,
 *             geometry_status, latitude, longitude) and is ALREADY passed to
 *             this function by app.mjs. The predecessor simply ignored them.
 *             No data change, no schema change, no GridAtlas change.
 *
 * The eligibility gate already requires geometry_status === "valid", which is
 * exactly the guarantee that latitude and longitude are present. The contract
 * that makes the full payload safe was there all along.
 *
 * ---------------------------------------------------------------------------
 * THE OPEN DECISION (priority item L-04)
 * ---------------------------------------------------------------------------
 * Two receivers accept the same parameters:
 *   "legacy" - globalgrid2050.com/repd_grid_atlasv8/  - proven, in use today
 *   "ported" - ventusltd.github.io/gridatlas/atlas/   - the migration target
 *
 * Change ACTIVE_TARGET below. That is the entire switch. Both are validated by
 * the same invariants, so neither can be selected in a broken state.
 */

const ATLAS_TARGETS = Object.freeze({
  ported: Object.freeze({
    id: "ported",
    schema: "pipelinenews.gridatlas-live-pointer-receipt.v4",
    classification: "VERIFIED_PROMOTION_ELIGIBLE_GRIDATLAS_V9",
    generation: "202608300453",
    release_id: "202608300453-atlas-v9",
    // The STABLE route. GridAtlas atlas/current.json -> "live_route".
    // Using the stable route rather than the pinned release means a GridAtlas
    // release promotion does not silently break every PipelineNews link.
    base_url: "https://ventusltd.github.io/gridatlas/atlas/",
    pinned_release_url:
      "https://ventusltd.github.io/gridatlas/atlas/releases/202608300453-atlas-v9/",
    hostname: "ventusltd.github.io",
    pathname: "/gridatlas/atlas/",
    state_url: "https://ventusltd.github.io/gridatlas/state/live-set.json",
    source_commit: "4f3e8fc5c7ea28edf83dbac9b231024723bcf231",
  }),
  legacy: Object.freeze({
    id: "legacy",
    schema: "pipelinenews.gridatlas-live-pointer-receipt.v4",
    classification: "VERIFIED_LEGACY_ATLAS_V8_IN_SERVICE",
    generation: "legacy",
    release_id: "repd_grid_atlasv8",
    base_url: "https://globalgrid2050.com/repd_grid_atlasv8/",
    pinned_release_url: "https://globalgrid2050.com/repd_grid_atlasv8/",
    hostname: "globalgrid2050.com",
    pathname: "/repd_grid_atlasv8/",
    state_url: null,
    source_commit: null,
  }),
});

/** L-04. One line. Both branches are invariant-checked below. */
const ACTIVE_TARGET = "legacy";

const RECEIVER = ATLAS_TARGETS[ACTIVE_TARGET];

function invariant(condition, message) {
  if (!condition) throw new Error(`Atlas receiver contract: ${message}`);
}

invariant(Boolean(RECEIVER), `ACTIVE_TARGET "${ACTIVE_TARGET}" is not a known receiver`);

const receiverUrl = new URL(RECEIVER.base_url);
invariant(receiverUrl.protocol === "https:", "receiver is not HTTPS");
invariant(receiverUrl.hostname === RECEIVER.hostname, "receiver hostname changed");
// Validate against the receiver's OWN declared pathname. The predecessor
// hardcoded a template here, which is what pinned the broken shape in place.
invariant(receiverUrl.pathname === RECEIVER.pathname, "receiver route mismatch");
invariant(receiverUrl.pathname.endsWith("/"), "receiver route must end in a slash");

/** Emitted in this order, matching the known-good legacy link exactly. */
const QUERY_PARAMETER_ORDER = Object.freeze([
  "repd_ref", "project", "technology", "capacity_mw", "latitude", "longitude", "zoom",
]);

const DEFAULT_ZOOM = 12;

export const ATLAS_DEEP_LINK_CONTRACT = Object.freeze({
  schema: "pipelinenews.atlas-current-deep-link-cartridge.v2",
  generation: "202608311343",
  supersedes: "pipelinenews.atlas-current-deep-link-cartridge.v1",
  supersede_reason:
    "v1 emitted a 404 path and carried repd_ref alone, forcing a 35.7 MB engine boot to resolve it",
  deployment: "not-authorised",
  active_target: ACTIVE_TARGET,
  receiver: RECEIVER,
  available_targets: Object.freeze(Object.keys(ATLAS_TARGETS)),
  eligibility: Object.freeze({
    field: "geometry_status",
    equals: "valid",
    ineligible_result: "",
    presentation: "NO MAP",
  }),
  identity_anchor: "repd_ref",
  query_parameter_order: QUERY_PARAMETER_ORDER,
  inbound_match_semantics: "EXACT_PROJECT_REPD_REF",
  context_parameters_are_advisory: true,
  lifecycle:
    "timestamped PipelineNews release; receiver authenticated at build and public readback",
});

/** Finite, in-range coordinate. Anything else means we do not emit one. */
function finiteInRange(value, limit) {
  // Number(null) and Number("") are both 0, which is finite and in range. Without
  // this guard a project with a missing longitude is emitted at longitude 0 - the
  // Greenwich meridian - instead of having its coordinates dropped. Caught by
  // selfTest case "drops both coordinates when only one is present".
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/**
 * Build the atlas deep link for a project.
 *
 * Identity (repd_ref) is REQUIRED and remains the only field the receiver
 * matches on - EXACT_PROJECT_REPD_REF is unchanged. Everything else is
 * advisory context that lets the map position itself without a lookup, and any
 * field that is missing or malformed is simply omitted rather than guessed.
 *
 * @param {object} project compact project index row
 * @returns {string} absolute URL, or "" when the project has no valid geometry
 */
export function buildAtlasV9DeepLink(project) {
  if (project?.[ATLAS_DEEP_LINK_CONTRACT.eligibility.field]
      !== ATLAS_DEEP_LINK_CONTRACT.eligibility.equals) return "";

  const repdRef = String(project?.repd_ref ?? "").trim();
  if (!/^\d+$/u.test(repdRef)) return "";

  const url = new URL(RECEIVER.base_url);
  url.searchParams.set("repd_ref", repdRef);

  const name = String(project?.name ?? "").trim();
  if (name) url.searchParams.set("project", name);

  const technology = String(project?.technology ?? "").trim();
  if (technology) url.searchParams.set("technology", technology);

  const capacity = Number(project?.capacity_mw);
  if (Number.isFinite(capacity) && capacity > 0) {
    url.searchParams.set("capacity_mw", String(capacity));
  }

  // Emitted as a pair or not at all. Half a coordinate is worse than none.
  const latitude = finiteInRange(project?.latitude, 90);
  const longitude = finiteInRange(project?.longitude, 180);
  if (latitude !== null && longitude !== null) {
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("zoom", String(DEFAULT_ZOOM));
  }

  return url.href;
}

/**
 * Self-test. Pure, no IO, no network. Callable from a build step or a verifier.
 * Returns {ok, checks:[{name, ok, detail}]}.
 */
export function selfTest() {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail: detail ?? null });

  const cleveHill = {
    repd_ref: "6502", name: "Cleve Hill Solar Project", technology: "solar",
    capacity_mw: 373, latitude: 51.338767, longitude: 0.913885,
    geometry_status: "valid",
  };
  const href = buildAtlasV9DeepLink(cleveHill);
  const u = href ? new URL(href) : null;

  add("emits a link for a valid-geometry project", Boolean(href), href);
  add("path ends in a slash and is the declared route",
      u && u.pathname === RECEIVER.pathname, u && u.pathname);
  add("carries repd_ref", u && u.searchParams.get("repd_ref") === "6502");
  add("carries project name", u && u.searchParams.get("project") === "Cleve Hill Solar Project");
  add("carries technology", u && u.searchParams.get("technology") === "solar");
  add("carries capacity_mw", u && u.searchParams.get("capacity_mw") === "373");
  add("carries latitude", u && u.searchParams.get("latitude") === "51.338767");
  add("carries longitude", u && u.searchParams.get("longitude") === "0.913885");
  add("carries zoom", u && u.searchParams.get("zoom") === String(DEFAULT_ZOOM));

  // The regression that started this: a ref-only link is no longer produced
  // for a project that has coordinates.
  add("does NOT emit a ref-only link when coordinates exist",
      u && [...u.searchParams.keys()].length > 1,
      u && [...u.searchParams.keys()].join(","));

  // Eligibility gate still closes.
  add("no link when geometry is not valid",
      buildAtlasV9DeepLink({ ...cleveHill, geometry_status: "missing" }) === "");
  add("no link when repd_ref is not numeric",
      buildAtlasV9DeepLink({ ...cleveHill, repd_ref: "B0850" }) === "");

  // Partial coordinates must be dropped as a pair, not emitted half.
  const half = new URL(buildAtlasV9DeepLink({ ...cleveHill, longitude: null }));
  add("drops both coordinates when only one is present",
      !half.searchParams.has("latitude") && !half.searchParams.has("longitude"),
      half.search);
  add("still carries identity when coordinates are dropped",
      half.searchParams.get("repd_ref") === "6502");

  // Out-of-range coordinates are treated as absent, not clamped.
  const bad = new URL(buildAtlasV9DeepLink({ ...cleveHill, latitude: 999 }));
  add("rejects out-of-range latitude rather than clamping it",
      !bad.searchParams.has("latitude"));

  // Golden ref from the predecessor contract must still resolve.
  const golden = buildAtlasV9DeepLink({
    repd_ref: "13599", name: "Golden", technology: "solar",
    capacity_mw: 1, latitude: 52, longitude: -1, geometry_status: "valid",
  });
  add("golden repd_ref 13599 still emits", golden.includes("repd_ref=13599"));

  return { ok: checks.every((c) => c.ok), target: ACTIVE_TARGET, checks };
}
