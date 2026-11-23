/**
 * PipelineNews REPD cockpit cross-filter contract (candidate v2).
 * Pure data module: no DOM, no networking, no source mutation, no publication.
 * Canonical REPD and interconnectors remain separate datasets.
 */
export const REPD_TECHNOLOGIES = Object.freeze([
  "all", "solar", "bess", "wind_onshore", "wind_offshore"
]);
export const COCKPIT_TECHNOLOGIES = Object.freeze([
  ...REPD_TECHNOLOGIES, "interconnector", "grid"
]);
export const REPORT_DIMENSIONS = Object.freeze([
  "operator", "status", "region", "technology"
]);
export const SOURCE_UNAVAILABLE = "SOURCE_NOT_AVAILABLE";
export const UNKNOWN = "Not reported";
const DECIMAL_SCALE = 1_000_000;

function label(value) {
  const string = value === null || value === undefined ? "" : String(value).trim();
  return string || UNKNOWN;
}
function selected(value) {
  return value === null || value === undefined || value === "" || value === "All" ? "All" : String(value);
}
export function cockpitSelection(filters = {}) {
  const technology = filters.technology ?? "all";
  if (!COCKPIT_TECHNOLOGIES.includes(technology)) {
    throw new TypeError("Unsupported technology selection: " + technology);
  }
  return {
    technology,
    status: selected(filters.status),
    operator: selected(filters.operator),
    region: selected(filters.region),
  };
}
function identity(row, source) {
  const ref = source === "repd"
    ? row?.repd_ref
    : row?.asset_id ?? row?.gg_project_id ?? row?.bmrs_code;
  const id = ref === undefined || ref === null ? "" : String(ref).trim();
  if (!id || (source === "repd" && !/^\d+$/.test(id))) {
    throw new Error("Missing or invalid " + source + " project identity");
  }
  return id;
}
export function verifyInventory(rows, source = "repd") {
  if (!Array.isArray(rows)) throw new TypeError(source + " inventory must be an array");
  const refs = new Set();
  for (const row of rows) {
    const id = identity(row, source);
    if (refs.has(id)) throw new Error("Duplicate " + source + " identity: " + id);
    refs.add(id);
    if (source === "repd" && row?.technology === "interconnector") {
      throw new Error("Interconnector record inside REPD inventory: " + id);
    }
  }
  return refs.size;
}
function technologyMatches(row, selection, source) {
  return source === "interconnector" || selection.technology === "all" ||
    row?.technology === selection.technology;
}
function matches(row, selection, source, except = "") {
  if (except !== "technology" && !technologyMatches(row, selection, source)) return false;
  for (const name of ["status", "operator", "region"]) {
    if (name !== except && selection[name] !== "All" &&
      label(row?.[name]) !== selection[name]) return false;
  }
  return true;
}
function mwScaled(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * DECIMAL_SCALE) : null;
}
function unit(row, source) {
  const unitValue = typeof row?.capacity_unit === "string" && row.capacity_unit.trim();
  if (unitValue) return unitValue;
  if (source === "repd" && row?.technology === "solar") return "MWp";
  return "MW";
}
function emptyTotals() {
  return {
    projects: 0,
    missingCapacity: 0,
    recordedByUnit: {},
    solarMwp: 0,
    otherMw: 0,
    recordedMixed: 0,
  };
}
function accumulate(totals, row, source) {
  totals.projects++;
  const mw = mwScaled(row?.capacity_mw);
  if (mw === null) {
    totals.missingCapacity++;
    return;
  }
  const sourceUnit = unit(row, source);
  totals.recordedByUnit[sourceUnit] = (totals.recordedByUnit[sourceUnit] ?? 0) + mw;
  if (source === "repd" && row?.technology === "solar") totals.solarMwp += mw;
  else totals.otherMw += mw;
  totals.recordedMixed += mw; // Legacy comparison only: not comparable across MW/MWp.
}
function displayTotals(totals) {
  const convert = value => Number((value / DECIMAL_SCALE).toFixed(6));
  return {
    projects: totals.projects,
    missingCapacity: totals.missingCapacity,
    recordedByUnit: Object.fromEntries(Object.entries(totals.recordedByUnit)
      .map(([k, value]) => [k, convert(value)]).sort((a, b) => a[0].localeCompare(b[0], "en-GB"))),
    solarMwp: convert(totals.solarMwp),
    otherMw: convert(totals.otherMw),
    recordedMixed: convert(totals.recordedMixed),
    mixedUnitWarning: "Combined recorded MW/MWp is a database sum, not a physically comparable capacity or generation measure.",
  };
}
function grouped(rows, dimension, source) {
  const groups = new Map();
  for (const project of rows) {
    const key = dimension === "technology" && source === "interconnector"
      ? "Interconnector" : label(project?.[dimension]);
    if (!groups.has(key)) groups.set(key, { label: key, totals: emptyTotals(), ids: [] });
    const group = groups.get(key);
    group.ids.push(identity(project, source));
    accumulate(group.totals, project, source);
  }
  return [...groups.values()].map(group => ({
    label: group.label,
    ...displayTotals(group.totals),
    ids: group.ids,
  })).sort((a, b) => b.recordedMixed - a.recordedMixed ||
    b.projects - a.projects || a.label.localeCompare(b.label, "en-GB"));
}
function facets(rows, selection, source) {
  const result = {};
  for (const dimension of ["technology", "status", "operator", "region"]) {
    const counts = new Map();
    for (const row of rows) {
      if (!matches(row, selection, source, dimension)) continue;
      const option = dimension === "technology" && source === "interconnector"
        ? "interconnector" : label(row?.[dimension]);
      counts.set(option, (counts.get(option) ?? 0) + 1);
    }
    result[dimension] = [...counts].map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, "en-GB"));
  }
  return result;
}
/**
 * Return a single consistent selection for Operator/Status/Region/Technology reports.
 * All filters intersect, no report button resets a prior cockpit selection.
 * Interconnectors have their own namespace and never enter the 7,775 REPD total.
 * Grid is reserved for a future verified source; it is NOT silently shown as zero.
 */
export function buildCockpitReport(repdRecords, {
  dimension = "operator", filters = {}, interconnectors = null
} = {}) {
  if (!REPORT_DIMENSIONS.includes(dimension)) {
    throw new TypeError("Unsupported report dimension: " + dimension);
  }
  const selection = cockpitSelection(filters);
  verifyInventory(repdRecords, "repd");
  const source = selection.technology === "interconnector" ? "interconnector" :
    selection.technology === "grid" ? "grid" : "repd";
  if (source === "grid" || (source === "interconnector" && !Array.isArray(interconnectors))) {
    return {
      source, availability: SOURCE_UNAVAILABLE, selection, dimension,
      sourceProjects: null, matchingProjects: null, groups: [], facets: {},
      message: source === "grid"
        ? "Grid reporting requires a verified, separately identified asset inventory."
        : "Interconnector inventory not supplied; never mixed into REPD.",
    };
  }
  const universe = source === "interconnector" ? interconnectors : repdRecords;
  if (source === "interconnector") verifyInventory(universe, source);
  const rows = universe.filter(row => matches(row, selection, source));
  const overall = emptyTotals();
  for (const row of rows) accumulate(overall, row, source);
  return {
    source, availability: "AVAILABLE", dimension, selection,
    sourceProjects: universe.length,
    matchingProjects: rows.length,
    totals: displayTotals(overall),
    groups: grouped(rows, dimension, source),
    facets: facets(universe, selection, source),
    ids: rows.map(row => identity(row, source)),
    rows, // Original references: retained for native REPD MAP/A4/project drillback.
  };
}
