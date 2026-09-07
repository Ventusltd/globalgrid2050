import {
  canonicalProjectMetrics,
  searchCanonicalProjects,
} from "../data/canonical-projects.js";

const EMPTY_PROJECTS = Object.freeze([]);
const FILTER_KEYS = new Set([
  "technology",
  "lifecycleView",
  "officialStatus",
  "county",
  "region",
  "query",
]);

function defaultFilters() {
  return {
    technology: "all",
    lifecycleView: "ALL",
    officialStatus: "All",
    county: "All",
    region: "All",
    query: "",
  };
}

function filterProjects(projects, filters, searchFields) {
  const searched = searchCanonicalProjects(projects, filters.query, searchFields);
  return searched.filter((project) => (
    (filters.technology === "all" || project.technology === filters.technology)
    && (filters.lifecycleView === "ALL" || project.lifecycle_view === filters.lifecycleView)
    && (filters.officialStatus === "All" || project.status === filters.officialStatus)
    && (filters.county === "All" || project.county === filters.county)
    && (filters.region === "All" || project.region === filters.region)
  ));
}

function optionsFor(projects) {
  const unique = (field) => [...new Set(projects.map((project) => project[field]).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en-GB"));
  return Object.freeze({
    officialStatuses: Object.freeze(unique("status")),
    counties: Object.freeze(unique("county")),
    regions: Object.freeze(unique("region")),
  });
}

export function createCanonicalProjectState() {
  return {
    release: "7.2",
    phase: "isolated-not-live",
    status: "idle",
    source: null,
    contract: null,
    metadata: null,
    all: EMPTY_PROJECTS,
    filtered: EMPTY_PROJECTS,
    filters: defaultFilters(),
    filterOptions: optionsFor(EMPTY_PROJECTS),
    metrics: canonicalProjectMetrics(EMPTY_PROJECTS),
    searchFields: EMPTY_PROJECTS,
    error: null,
  };
}

export function beginCanonicalProjectLoad(state) {
  state.status = state.all.length ? "refreshing" : "loading";
  state.error = null;
  return state;
}

export function commitCanonicalProjectModel(state, model) {
  const searchFields = Object.freeze([...model.contract.interface.search_fields]);
  const filters = defaultFilters();
  const filtered = Object.freeze(filterProjects(model.projects, filters, searchFields));
  Object.assign(state, {
    status: "ready",
    source: model.source,
    contract: model.contract,
    metadata: model.metadata,
    all: model.projects,
    filtered,
    filters,
    filterOptions: optionsFor(model.projects),
    metrics: canonicalProjectMetrics(filtered),
    searchFields,
    error: null,
  });
  return state;
}

export function failCanonicalProjectLoad(state, error) {
  state.status = state.all.length ? "stale" : "error";
  state.error = error instanceof Error ? error.message : String(error || "Unknown project-data error");
  return state;
}

export function setCanonicalProjectFilter(state, key, value) {
  if (!FILTER_KEYS.has(key)) throw new Error(`V7.2 project state: unknown filter ${key}`);
  if (key === "technology" && !["all", "solar", "bess"].includes(value)) {
    throw new Error(`V7.2 project state: invalid technology ${value}`);
  }
  if (key === "lifecycleView" && !["ALL", "CURRENT", "DISPUTED", "HISTORICAL", "REVIEW"].includes(value)) {
    throw new Error(`V7.2 project state: invalid lifecycle view ${value}`);
  }
  state.filters = { ...state.filters, [key]: key === "query" ? String(value || "").trim() : value };
  const filtered = filterProjects(state.all, state.filters, state.searchFields);
  state.filtered = Object.freeze(filtered);
  state.metrics = canonicalProjectMetrics(filtered);
  return state;
}

export function resetCanonicalProjectFilters(state) {
  state.filters = defaultFilters();
  const filtered = filterProjects(state.all, state.filters, state.searchFields);
  state.filtered = Object.freeze(filtered);
  state.metrics = canonicalProjectMetrics(filtered);
  return state;
}

export const canonicalProjectState = createCanonicalProjectState();
