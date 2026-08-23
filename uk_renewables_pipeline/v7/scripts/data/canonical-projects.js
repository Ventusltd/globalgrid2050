export const PROJECTS_CONTRACT_URL = "contracts/projects-plugin.v7.2.json";

const CONTRACT_SCHEMA = "globalgrid2050.v7.projects-plugin-contract.v1";
const PAYLOAD_SCHEMA = "globalgrid2050.v7.projects.v7.2";
const CONTRACT_STATUSES = new Set([
  "SPECIFICATION_ONLY_UI_NOT_LIVE",
  "LIVE_CANDIDATE",
  "LIVE_VALIDATED",
]);
const PAYLOAD_STATUSES = new Set([
  "VALIDATED_DATA_ONLY_NOT_LIVE",
  "LIVE_CANDIDATE",
  "LIVE_VALIDATED",
]);
const GEOMETRY_STATUSES = new Set(["valid", "missing", "invalid"]);
const FORBIDDEN_NEWS_FIELDS = new Set([
  "headline",
  "news_signal",
  "article_capacity_mw",
  "primary_match",
]);

export class CanonicalProjectError extends Error {
  constructor(code, message, options = {}) {
    super(`V7.2 canonical projects: ${message}`, options);
    this.name = "CanonicalProjectError";
    this.code = code;
  }
}

function invariant(condition, message, code = "INTEGRITY") {
  if (!condition) throw new CanonicalProjectError(code, message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function freezeArray(values) {
  return Object.freeze(values.map((value) => (
    isObject(value) ? Object.freeze({ ...value }) : value
  )));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function isSameOriginRelativePath(path) {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.startsWith("//")) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) return false;
  return !path.split("/").includes("..");
}

export function lifecycleViewFor(project) {
  if (["LIVE_PRE_CONSTRUCTION", "UNDER_CONSTRUCTION", "OPERATIONAL"].includes(project.lifecycle)) {
    return "CURRENT";
  }
  if (project.lifecycle === "INACTIVE") return "HISTORICAL";
  if (project.lifecycle === "UNKNOWN" && project.status === "Appeal Lodged") return "DISPUTED";
  if (project.lifecycle === "UNKNOWN" && project.status === "Revised") return "REVIEW";
  throw new CanonicalProjectError("SCHEMA", `unmapped lifecycle/status for REPD ${project.repd_ref || "unknown"}`);
}

export function validateProjectsContract(contract) {
  invariant(isObject(contract), "contract is not an object", "SCHEMA");
  invariant(contract.schema === CONTRACT_SCHEMA, "unexpected contract schema", "SCHEMA");
  invariant(contract.target_release === "7.2", "unexpected target release", "SCHEMA");
  invariant(CONTRACT_STATUSES.has(contract.status), "unapproved contract status", "SCHEMA");
  invariant(contract.release_state?.target_sources_are_same_origin === true, "same-origin rule is absent", "SOURCE_ORIGIN");
  invariant(
    isSameOriginRelativePath(contract.release_state?.target_project_source),
    "project source is not a safe same-origin relative path",
    "SOURCE_ORIGIN",
  );
  invariant(contract.interface?.combined_capacity_metric_forbidden === true, "combined-capacity prohibition is absent");
  return contract;
}

export function adaptCanonicalProject(record, contract) {
  invariant(isObject(record), "project record is not an object");
  const recordContract = contract.project_record;
  for (const field of recordContract.required_non_null_strings) {
    invariant(typeof record[field] === "string" && record[field].length > 0, `REPD ${record.repd_ref || "unknown"} lacks ${field}`);
  }
  for (const field of recordContract.required_finite_numbers) {
    invariant(isFiniteNumber(record[field]), `REPD ${record.repd_ref} has invalid ${field}`);
  }
  for (const field of recordContract.required_integers) {
    invariant(Number.isInteger(record[field]), `REPD ${record.repd_ref} has invalid ${field}`);
  }
  for (const field of recordContract.required_true_booleans) {
    invariant(record[field] === true, `REPD ${record.repd_ref} has invalid ${field}`);
  }
  for (const field of recordContract.required_arrays) {
    invariant(Array.isArray(record[field]), `REPD ${record.repd_ref} lacks array ${field}`);
  }
  invariant(["solar", "bess"].includes(record.technology), `REPD ${record.repd_ref} has out-of-scope technology`);
  invariant(record.gg_project_id === `GG2050-REPD-${record.repd_ref}`, `REPD ${record.repd_ref} has invalid project ID`);
  invariant(record.identity_status === "REPD_BOUND", `REPD ${record.repd_ref} is not REPD-bound`);
  invariant(record.identity_confidence === "authoritative", `REPD ${record.repd_ref} is not authoritative`);
  invariant(record.development_repd_refs.includes(record.repd_ref), `REPD ${record.repd_ref} development omits itself`);
  invariant(GEOMETRY_STATUSES.has(record.geometry_status), `REPD ${record.repd_ref} has invalid geometry status`);
  invariant(
    !Object.keys(record).some((field) => FORBIDDEN_NEWS_FIELDS.has(field)),
    `REPD ${record.repd_ref} contains a news-derived fact`,
  );

  const technology = contract.interface.technology_labels_and_units[record.technology];
  invariant(isObject(technology), `REPD ${record.repd_ref} has no technology presentation contract`);
  const thresholdKey = record.technology === "solar" ? "solar_mwp_exclusive" : "bess_mw_exclusive";
  invariant(
    record.capacity_mw > contract.canonical_universe.thresholds[thresholdKey],
    `REPD ${record.repd_ref} fails the exclusive capacity threshold`,
  );

  const relationships = freezeArray(record.relationships);
  const directRelated = freezeArray(record.direct_related_repd_refs);
  const planningSiblings = freezeArray(record.planning_sibling_repd_refs);
  const developmentRefs = freezeArray(record.development_repd_refs);
  return Object.freeze({
    ...record,
    relationships,
    direct_related_repd_refs: directRelated,
    planning_sibling_repd_refs: planningSiblings,
    development_repd_refs: developmentRefs,
    technology_label: technology.label,
    capacity_unit: technology.unit,
    lifecycle_view: lifecycleViewFor(record),
  });
}

export function sortCanonicalProjects(projects) {
  return [...projects].sort((left, right) => (
    right.capacity_mw - left.capacity_mw
    || left.gg_project_id.localeCompare(right.gg_project_id)
  ));
}

export function canonicalProjectMetrics(projects) {
  let solarMwp = 0;
  let bessMw = 0;
  let largest = null;
  for (const project of projects) {
    if (project.technology === "solar") solarMwp += project.capacity_mw;
    if (project.technology === "bess") bessMw += project.capacity_mw;
    if (!largest || project.capacity_mw > largest.capacity_mw) largest = project;
  }
  return Object.freeze({
    solar_mwp: round2(solarMwp),
    bess_mw: round2(bessMw),
    project_count: projects.length,
    largest_project: largest ? Object.freeze({
      gg_project_id: largest.gg_project_id,
      name: largest.name,
      technology: largest.technology,
      capacity_mw: largest.capacity_mw,
      capacity_unit: largest.capacity_unit,
    }) : null,
  });
}

export function searchCanonicalProjects(projects, query, fields) {
  const needle = String(query || "").trim().toLocaleLowerCase("en-GB");
  if (!needle) return [...projects];
  const direct = projects.filter((project) => (
    project.repd_ref.toLocaleLowerCase("en-GB") === needle
    || project.gg_project_id.toLocaleLowerCase("en-GB") === needle
  ));
  if (direct.length) return direct;
  return projects.filter((project) => fields.some((field) => {
    const value = project[field];
    const values = Array.isArray(value) ? value : [value];
    return values.some((item) => String(item ?? "").toLocaleLowerCase("en-GB").includes(needle));
  }));
}

export function buildCanonicalProjectModel(payload, rawContract) {
  const contract = validateProjectsContract(rawContract);
  invariant(isObject(payload), "payload is not an object", "SCHEMA");
  invariant(payload.schema === PAYLOAD_SCHEMA, "unexpected payload schema", "SCHEMA");
  invariant(payload.version === "7.2", "unexpected payload version", "SCHEMA");
  invariant(PAYLOAD_STATUSES.has(payload.status), "payload is not validated", "SCHEMA");
  invariant(Array.isArray(payload.projects), "payload projects are absent", "SCHEMA");

  const projects = sortCanonicalProjects(payload.projects.map((record) => adaptCanonicalProject(record, contract)));
  const projectIds = new Set(projects.map((project) => project.gg_project_id));
  const repdRefs = new Set(projects.map((project) => project.repd_ref));
  const developments = new Set(projects.map((project) => project.gg_development_id));
  const solar = projects.filter((project) => project.technology === "solar");
  const bess = projects.filter((project) => project.technology === "bess");
  const metrics = canonicalProjectMetrics(projects);
  const expected = contract.canonical_universe;

  invariant(projects.length === payload.project_count && projects.length === expected.project_count, "project count mismatch");
  invariant(projectIds.size === projects.length, "duplicate GlobalGrid project ID");
  invariant(repdRefs.size === projects.length, "duplicate REPD Ref");
  invariant(developments.size === payload.development_count && developments.size === expected.development_count, "development count mismatch");
  invariant(solar.length === payload.solar_count && solar.length === expected.solar_count, "solar count mismatch");
  invariant(bess.length === payload.bess_count && bess.length === expected.bess_count, "BESS count mismatch");
  invariant(metrics.solar_mwp === payload.solar_mwp && metrics.solar_mwp === expected.solar_mwp, "solar MWp mismatch");
  invariant(metrics.bess_mw === payload.bess_mw && metrics.bess_mw === expected.bess_mw, "BESS MW mismatch");

  return Object.freeze({
    version: "7.2",
    source: contract.release_state.target_project_source,
    contract: deepFreeze(structuredClone(contract)),
    metadata: Object.freeze({
      schema: payload.schema,
      status: payload.status,
      projects_sha256: payload.projects_sha256,
      source_provenance: deepFreeze(structuredClone(payload.source_provenance)),
    }),
    projects: Object.freeze(projects),
    metrics,
  });
}

async function fetchJson(fetchImpl, path, label, baseUrl) {
  let response;
  try {
    response = await fetchImpl(path, { cache: "no-store", credentials: "same-origin" });
  } catch (cause) {
    throw new CanonicalProjectError("NETWORK", `${label} request failed`, { cause });
  }
  invariant(response?.ok === true, `${label} request failed (${response?.status ?? "no response"})`, "HTTP");
  if (response.url && baseUrl) {
    let configured;
    let resolved;
    try {
      configured = new URL(path, baseUrl);
      resolved = new URL(response.url, baseUrl);
    } catch (cause) {
      throw new CanonicalProjectError("SOURCE_ORIGIN", `${label} response URL is invalid`, { cause });
    }
    invariant(resolved.origin === configured.origin, `${label} redirected across origins`, "SOURCE_ORIGIN");
  }
  try {
    return await response.json();
  } catch (cause) {
    throw new CanonicalProjectError("JSON", `${label} is not valid JSON`, { cause });
  }
}

export async function loadCanonicalProjectModel({
  fetchImpl = globalThis.fetch,
  contractUrl = PROJECTS_CONTRACT_URL,
  baseUrl = globalThis.document?.baseURI || globalThis.location?.href || null,
} = {}) {
  invariant(typeof fetchImpl === "function", "fetch implementation is unavailable");
  invariant(isSameOriginRelativePath(contractUrl), "contract URL is not a safe same-origin relative path", "SOURCE_ORIGIN");
  const contract = validateProjectsContract(await fetchJson(fetchImpl, contractUrl, "contract", baseUrl));
  const payload = await fetchJson(fetchImpl, contract.release_state.target_project_source, "project payload", baseUrl);
  return buildCanonicalProjectModel(payload, contract);
}
