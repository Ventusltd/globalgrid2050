import {
  resetCanonicalProjectFilters,
  setCanonicalProjectFilter,
} from "../core/project-state.js";

const SETTABLE_FILTERS = new Set([
  "technology",
  "lifecycleView",
  "officialStatus",
  "county",
  "region",
  "query",
]);

const SELECT_FILTER_OPTIONS = Object.freeze({
  officialStatus: "officialStatuses",
  county: "counties",
  region: "regions",
});

function invariant(condition, message) {
  if (!condition) throw new Error(`V7.2 canonical controls: ${message}`);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function hasValidatedModel(state) {
  return Boolean(state?.contract && Array.isArray(state.all) && state.all.length > 0);
}

function lifecycleViews(state) {
  const actualCounts = new Map([["ALL", state.all.length]]);
  for (const project of state.all) {
    actualCounts.set(project.lifecycle_view, (actualCounts.get(project.lifecycle_view) || 0) + 1);
  }
  return state.contract.lifecycle_views.map((view) => {
    const actual = actualCounts.get(view.id) || 0;
    invariant(actual === view.count, `${view.id} lifecycle count is ${actual}, expected ${view.count}`);
    return {
      id: view.id,
      label: view.label,
      count: actual,
      selected: state.filters.lifecycleView === view.id,
    };
  });
}

function technologyOptions(state) {
  const presentation = state.contract.interface.technology_labels_and_units;
  const counts = state.all.reduce((result, project) => {
    result[project.technology] = (result[project.technology] || 0) + 1;
    return result;
  }, { solar: 0, bess: 0 });
  return [
    { id: "all", label: "All", unit: null, count: state.all.length },
    { id: "solar", ...presentation.solar, count: counts.solar },
    { id: "bess", ...presentation.bess, count: counts.bess },
  ].map((option) => ({
    ...option,
    selected: state.filters.technology === option.id,
  }));
}

function gaugeView(state) {
  const { metrics } = state;
  return state.contract.interface.gauges.map((gauge) => {
    if (gauge.id === "solar_mwp") {
      return { ...gauge, value: metrics.solar_mwp, scope: "filtered_repd_records" };
    }
    if (gauge.id === "bess_mw") {
      return { ...gauge, value: metrics.bess_mw, scope: "filtered_repd_records" };
    }
    if (gauge.id === "project_count") {
      return { ...gauge, value: metrics.project_count, scope: "filtered_repd_records" };
    }
    invariant(gauge.id === "largest_project", `unknown gauge ${gauge.id}`);
    const largest = metrics.largest_project;
    return {
      ...gauge,
      value: largest?.capacity_mw ?? null,
      unit: largest?.capacity_unit ?? null,
      scope: "filtered_repd_records",
      project: largest ? {
        gg_project_id: largest.gg_project_id,
        name: largest.name,
        technology: largest.technology,
      } : null,
    };
  });
}

export function buildCanonicalProjectControlsView(state) {
  const available = hasValidatedModel(state);
  if (!available) {
    return deepFreeze({
      available: false,
      status: state?.status || "idle",
      error: state?.error || null,
      gauges: null,
      lifecycleViews: [],
      filters: state?.filters ? { ...state.filters } : null,
      filterOptions: null,
      search: null,
      resultCount: null,
      capacityBasis: "official_repd_record_capacity_not_development_deduplicated",
    });
  }

  invariant(state.contract.interface.combined_capacity_metric_forbidden === true, "combined capacity is not forbidden");
  invariant(state.contract.interface.gauges.length === 4, "four-gauge contract is absent");
  const exactIdentifiers = state.contract.interface.search_precedence.exact_identifier_fields;
  return deepFreeze({
    available: true,
    status: state.status,
    error: state.error,
    gauges: gaugeView(state),
    lifecycleViews: lifecycleViews(state),
    filters: { ...state.filters },
    filterOptions: {
      technology: technologyOptions(state),
      officialStatuses: ["All", ...state.filterOptions.officialStatuses],
      counties: ["All", ...state.filterOptions.counties],
      regions: ["All", ...state.filterOptions.regions],
    },
    search: {
      query: state.filters.query,
      fields: [...state.searchFields],
      exactIdentifierFields: [...exactIdentifiers],
      exactIdentifierPrecedence: true,
      placeholder: "Search project, REPD Ref, GlobalGrid ID, planning reference or authority",
    },
    resultCount: state.filtered.length,
    capacityBasis: "official_repd_record_capacity_not_development_deduplicated",
  });
}

function validateControlValue(state, key, value) {
  invariant(SETTABLE_FILTERS.has(key), `unknown filter ${key}`);
  const optionKey = SELECT_FILTER_OPTIONS[key];
  if (!optionKey) return;
  const allowed = value === "All" || state.filterOptions[optionKey].includes(value);
  invariant(allowed, `invalid ${key} ${value}`);
}

export function createCanonicalProjectControls(state) {
  invariant(state && typeof state === "object", "state is unavailable");
  return Object.freeze({
    snapshot() {
      return buildCanonicalProjectControlsView(state);
    },
    setFilter(key, value) {
      invariant(hasValidatedModel(state), "validated project model is unavailable");
      validateControlValue(state, key, value);
      setCanonicalProjectFilter(state, key, value);
      return buildCanonicalProjectControlsView(state);
    },
    reset() {
      invariant(hasValidatedModel(state), "validated project model is unavailable");
      resetCanonicalProjectFilters(state);
      return buildCanonicalProjectControlsView(state);
    },
  });
}
