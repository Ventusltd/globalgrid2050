/**
 * One fail-closed Pipeline News -> GridAtlas transport contract.
 *
 * Every clickable MAP action carries an exact REPD identity, one canonical
 * GridAtlas technology token, and a complete WGS84 coordinate pair.  Display
 * context remains advisory at the receiver; dropping identity is never a
 * fallback for a receiver defect.
 */

const RECEIVER = Object.freeze({
  base_url: "https://ventusltd.github.io/gridatlas/atlas/",
  hostname: "ventusltd.github.io",
  pathname: "/gridatlas/atlas/",
});

export const CANONICAL_PROJECT_TECHNOLOGIES = Object.freeze([
  "act", "bess", "biomass", "caes", "flywheel", "geothermal",
  "hydro", "hydrogen", "other", "solar", "solar_roof", "tidal",
  "wind_offshore", "wind_onshore",
]);

const TECHNOLOGIES = new Set(CANONICAL_PROJECT_TECHNOLOGIES);
const QUERY_PARAMETER_ORDER = Object.freeze([
  "repd_ref", "project", "technology", "capacity_mw",
  "latitude", "longitude", "zoom",
]);
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
const DEFAULT_ZOOM = 12;

export const ATLAS_DEEP_LINK_CONTRACT = Object.freeze({
  schema: "pipelinenews.atlas-map-corpus-contract.v1",
  generation: "202609040044",
  active_target: "ported",
  receiver: RECEIVER,
  identity_anchor: "repd_ref",
  query_parameter_order: QUERY_PARAMETER_ORDER,
  canonical_project_technologies: CANONICAL_PROJECT_TECHNOLOGIES,
  context_parameters_are_advisory: true,
  clickable_requires: Object.freeze([
    "canonical repd_ref", "canonical technology", "finite latitude",
    "finite longitude", "non-negative capacity_mw",
  ]),
  receiver_candidate: Object.freeze({
    commit: "b73247803377233069acfeff415ecad4e8391cb2",
    module: "atlas/codex/20260904-finding-loop-30x/finding-loop.mjs",
    module_sha256: "fdaf16829275c904ef190ba96925415151c9ac6f409eac39d81440dbdd0c3d20",
    module_bytes: 60148,
    contract: "PROJECT_TECHNOLOGIES + parseProjectDeepLink",
  }),
});

function numberInRange(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number : null;
}

function projectFields(project) {
  const coordinates = Array.isArray(project?.ll) ? project.ll : null;
  return {
    repdRef: String(project?.repd_ref ?? project?.ref ?? "").trim(),
    // REPD 13263 contains an embedded line break in its official display
    // name. Whitespace canonicalisation preserves the words without putting a
    // control character into a query string or discarding the exact identity.
    name: String(project?.name ?? project?.n ?? "").replace(/\s+/gu, " ").trim(),
    technology: String(project?.technology ?? project?.t ?? "").trim(),
    capacity: numberInRange(project?.capacity_mw ?? project?.c, 0, Number.MAX_VALUE),
    latitude: numberInRange(project?.latitude ?? coordinates?.[1], -90, 90),
    longitude: numberInRange(project?.longitude ?? coordinates?.[0], -180, 180),
    geometryStatus: project?.geometry_status,
  };
}

/** Return a canonical absolute URL, or an empty string for a non-clickable row. */
export function buildAtlasV9DeepLink(project) {
  const fields = projectFields(project);
  if (fields.geometryStatus !== undefined && fields.geometryStatus !== "valid") return "";
  if (!/^[1-9]\d*$/u.test(fields.repdRef)) return "";
  if (!TECHNOLOGIES.has(fields.technology)) return "";
  if (CONTROL_CHARACTER.test(fields.name)) return "";
  if (fields.capacity === null || fields.latitude === null || fields.longitude === null) return "";

  const url = new URL(RECEIVER.base_url);
  url.searchParams.set("repd_ref", fields.repdRef);
  // An official blank stays blank. The parameter is still present, and no
  // replacement name is invented merely to make a URL look complete.
  url.searchParams.set("project", fields.name);
  url.searchParams.set("technology", fields.technology);
  url.searchParams.set("capacity_mw", String(fields.capacity));
  url.searchParams.set("latitude", String(fields.latitude));
  url.searchParams.set("longitude", String(fields.longitude));
  url.searchParams.set("zoom", String(DEFAULT_ZOOM));
  return url.href;
}

export function selfTest() {
  const checks = [];
  const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });
  const fixture = {
    repd_ref: "155", name: "Markinch Biomass CHP Plant", technology: "biomass",
    capacity_mw: 65, latitude: 56.20118, longitude: -3.162255,
    geometry_status: "valid",
  };
  const href = buildAtlasV9DeepLink(fixture);
  const url = new URL(href);
  check("valid row emits", Boolean(href));
  check("stable receiver", url.hostname === RECEIVER.hostname && url.pathname === RECEIVER.pathname);
  check("exact ordered parameters",
    [...url.searchParams.keys()].join(",") === QUERY_PARAMETER_ORDER.join(","));
  check("identity retained", url.searchParams.get("repd_ref") === "155");
  check("canonical technology retained", url.searchParams.get("technology") === "biomass");
  check("coordinates retained",
    url.searchParams.get("latitude") === "56.20118"
      && url.searchParams.get("longitude") === "-3.162255");
  check("zero capacity remains explicit",
    new URL(buildAtlasV9DeepLink({ ...fixture, capacity_mw: 0 }))
      .searchParams.get("capacity_mw") === "0");
  check("missing identity is not worked around",
    buildAtlasV9DeepLink({ ...fixture, repd_ref: "" }) === "");
  check("unknown technology fails closed",
    buildAtlasV9DeepLink({ ...fixture, technology: "Biomass (dedicated)" }) === "");
  check("half coordinate fails closed",
    buildAtlasV9DeepLink({ ...fixture, longitude: null }) === "");
  check("invalid geometry fails closed",
    buildAtlasV9DeepLink({ ...fixture, geometry_status: "missing" }) === "");
  return Object.freeze({ ok: checks.every(({ ok }) => ok), checks: Object.freeze(checks) });
}
