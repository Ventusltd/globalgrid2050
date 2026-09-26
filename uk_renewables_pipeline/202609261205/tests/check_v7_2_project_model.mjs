import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCanonicalProjectModel,
  CanonicalProjectError,
  canonicalProjectMetrics,
  isSameOriginRelativePath,
  loadCanonicalProjectModel,
  searchCanonicalProjects,
} from "../scripts/data/canonical-projects.js";
import {
  beginCanonicalProjectLoad,
  commitCanonicalProjectModel,
  createCanonicalProjectState,
  failCanonicalProjectLoad,
  resetCanonicalProjectFilters,
  setCanonicalProjectFilter,
} from "../scripts/core/project-state.js";

const v7Url = new URL("../", import.meta.url);
const contract = JSON.parse(await readFile(new URL("contracts/projects-plugin.v7.2.json", v7Url), "utf8"));
const payload = JSON.parse(await readFile(new URL("data/v7.2/projects.json", v7Url), "utf8"));
const model = buildCanonicalProjectModel(payload, contract);

assert.equal(model.version, "7.2");
assert.equal(model.source, "data/v7.2/projects.json");
assert.equal(model.projects.length, 766);
assert.equal(new Set(model.projects.map((project) => project.gg_development_id)).size, 718);
assert.deepEqual(model.metrics, {
  solar_mwp: 34073.49,
  bess_mw: 106338.18,
  project_count: 766,
  largest_project: {
    gg_project_id: "GG2050-REPD-12453",
    name: "Thorpe Marsh Power Station - Battery Energy Storage",
    technology: "bess",
    capacity_mw: 1450,
    capacity_unit: "MW",
  },
});
assert.equal(model.projects[0].gg_project_id, "GG2050-REPD-12453");
assert.equal(Object.isFrozen(model.projects), true);
assert.equal(Object.isFrozen(model.projects[0]), true);
assert.equal(Object.isFrozen(model.projects[0].relationships), true);

const byRef = new Map(model.projects.map((project) => [project.repd_ref, project]));
assert.equal(byRef.get("13599").technology_label, "Solar");
assert.equal(byRef.get("13599").capacity_unit, "MWp");
assert.equal(byRef.get("13600").technology_label, "Battery Storage");
assert.equal(byRef.get("13600").capacity_unit, "MW");
assert.equal(byRef.get("11034").lifecycle_view, "CURRENT");
assert.equal(byRef.get("6502").lifecycle_view, "CURRENT");
assert.equal(byRef.get("12453").lifecycle_view, "REVIEW");
assert.equal(byRef.get("20966").technology, "bess");

const searchFields = contract.interface.search_fields;
assert.deepEqual(searchCanonicalProjects(model.projects, "13599", searchFields).map((project) => project.repd_ref), ["13599"]);
assert.deepEqual(searchCanonicalProjects(model.projects, "GG2050-REPD-13599", searchFields).map((project) => project.repd_ref), ["13599"]);
assert.deepEqual(searchCanonicalProjects(model.projects, "GG2050-DEV-E13842D4D80DEC", searchFields).map((project) => project.repd_ref).sort(), ["13599", "13600"]);
assert.deepEqual(searchCanonicalProjects(model.projects, "EN010151", searchFields).map((project) => project.repd_ref).sort(), ["13599", "13600"]);
assert.deepEqual(searchCanonicalProjects(model.projects, "Beacon Fen", searchFields).map((project) => project.repd_ref).sort(), ["13599", "13600"]);

assert.equal(isSameOriginRelativePath("data/v7.2/projects.json"), true);
assert.equal(isSameOriginRelativePath("../dist/projects.json"), false);
assert.equal(isSameOriginRelativePath("https://example.com/projects.json"), false);
assert.equal(isSameOriginRelativePath("//example.com/projects.json"), false);

const requested = [];
const fetchImpl = async (path, options) => {
  requested.push({ path, options });
  const value = path === "contracts/projects-plugin.v7.2.json" ? contract : payload;
  return { ok: true, status: 200, async json() { return structuredClone(value); } };
};
const loaded = await loadCanonicalProjectModel({ fetchImpl });
assert.equal(loaded.projects.length, 766);
assert.deepEqual(requested.map((request) => request.path), [
  "contracts/projects-plugin.v7.2.json",
  "data/v7.2/projects.json",
]);
assert.equal(requested.every((request) => request.options.credentials === "same-origin"), true);
assert.equal(requested.every((request) => request.options.cache === "no-store"), true);

const browserBase = "https://globalgrid2050.com/uk_renewables_pipeline/v7/";
let redirectFetches = 0;
await assert.rejects(
  loadCanonicalProjectModel({
    baseUrl: browserBase,
    fetchImpl: async (path) => {
      redirectFetches += 1;
      if (redirectFetches === 1) {
        return {
          ok: true,
          status: 200,
          url: `${browserBase}${path}`,
          async json() { return structuredClone(contract); },
        };
      }
      return {
        ok: true,
        status: 200,
        url: "https://assets.publishing.service.gov.uk/projects.json",
        async json() { return structuredClone(payload); },
      };
    },
  }),
  (error) => error instanceof CanonicalProjectError && error.code === "SOURCE_ORIGIN",
);
assert.equal(redirectFetches, 2);

const externalContract = structuredClone(contract);
externalContract.release_state.target_project_source = "https://assets.publishing.service.gov.uk/projects.json";
let externalFetches = 0;
await assert.rejects(
  loadCanonicalProjectModel({
    fetchImpl: async () => {
      externalFetches += 1;
      return { ok: true, status: 200, async json() { return externalContract; } };
    },
  }),
  /not a safe same-origin relative path/,
);
assert.equal(externalFetches, 1);

await assert.rejects(
  loadCanonicalProjectModel({ fetchImpl: async () => { throw new Error("offline"); } }),
  (error) => error instanceof CanonicalProjectError && error.code === "NETWORK",
);
await assert.rejects(
  loadCanonicalProjectModel({ fetchImpl: async () => ({ ok: false, status: 503 }) }),
  (error) => error instanceof CanonicalProjectError && error.code === "HTTP",
);
await assert.rejects(
  loadCanonicalProjectModel({ fetchImpl: async () => ({ ok: true, status: 200, async json() { throw new SyntaxError("bad JSON"); } }) }),
  (error) => error instanceof CanonicalProjectError && error.code === "JSON",
);

const duplicatePayload = structuredClone(payload);
duplicatePayload.projects[1].gg_project_id = duplicatePayload.projects[0].gg_project_id;
await assert.rejects(async () => buildCanonicalProjectModel(duplicatePayload, contract), /invalid project ID|duplicate GlobalGrid/);
const windPayload = structuredClone(payload);
windPayload.projects[0].technology = "wind";
await assert.rejects(async () => buildCanonicalProjectModel(windPayload, contract), /out-of-scope technology/);
const newsPollutedPayload = structuredClone(payload);
newsPollutedPayload.projects[0].headline = "Unverified headline";
await assert.rejects(async () => buildCanonicalProjectModel(newsPollutedPayload, contract), /news-derived fact/);
const shortPayload = structuredClone(payload);
shortPayload.projects.pop();
await assert.rejects(async () => buildCanonicalProjectModel(shortPayload, contract), /project count mismatch|solar count mismatch|BESS count mismatch/);
const wrongSchemaPayload = structuredClone(payload);
wrongSchemaPayload.schema = "wrong.schema";
await assert.rejects(
  async () => buildCanonicalProjectModel(wrongSchemaPayload, contract),
  (error) => error instanceof CanonicalProjectError && error.code === "SCHEMA",
);
const thresholdPayload = structuredClone(payload);
thresholdPayload.projects.find((project) => project.technology === "solar").capacity_mw = 49;
await assert.rejects(async () => buildCanonicalProjectModel(thresholdPayload, contract), /exclusive capacity threshold/);
const duplicateRefPayload = structuredClone(payload);
duplicateRefPayload.projects[1].repd_ref = duplicateRefPayload.projects[0].repd_ref;
duplicateRefPayload.projects[1].gg_project_id = duplicateRefPayload.projects[0].gg_project_id;
duplicateRefPayload.projects[1].development_repd_refs.push(duplicateRefPayload.projects[0].repd_ref);
await assert.rejects(async () => buildCanonicalProjectModel(duplicateRefPayload, contract), /duplicate GlobalGrid project ID|duplicate REPD Ref/);

const state = createCanonicalProjectState();
assert.equal(state.status, "idle");
beginCanonicalProjectLoad(state);
assert.equal(state.status, "loading");
commitCanonicalProjectModel(state, model);
assert.equal(state.status, "ready");
assert.equal(state.all.length, 766);
assert.equal(state.filtered.length, 766);
assert.equal(state.metrics.project_count, 766);
assert.equal(state.filterOptions.officialStatuses.includes("Appeal Lodged"), true);

setCanonicalProjectFilter(state, "technology", "solar");
assert.equal(state.filtered.length, 384);
assert.deepEqual(state.metrics, {
  solar_mwp: 34073.49,
  bess_mw: 0,
  project_count: 384,
  largest_project: {
    gg_project_id: "GG2050-REPD-12588",
    name: "Botley West, Botley - Botley West Solar Project",
    technology: "solar",
    capacity_mw: 840,
    capacity_unit: "MWp",
  },
});
setCanonicalProjectFilter(state, "technology", "bess");
setCanonicalProjectFilter(state, "query", "13599");
assert.equal(state.filtered.length, 0);
resetCanonicalProjectFilters(state);
setCanonicalProjectFilter(state, "technology", "all");
setCanonicalProjectFilter(state, "lifecycleView", "DISPUTED");
assert.equal(state.filtered.length, 3);
setCanonicalProjectFilter(state, "lifecycleView", "HISTORICAL");
assert.equal(state.filtered.length, 63);
setCanonicalProjectFilter(state, "lifecycleView", "REVIEW");
assert.equal(state.filtered.length, 30);
resetCanonicalProjectFilters(state);
setCanonicalProjectFilter(state, "query", "13599");
assert.deepEqual(state.filtered.map((project) => project.repd_ref), ["13599"]);
setCanonicalProjectFilter(state, "officialStatus", "No such status");
assert.equal(state.filtered.length, 0);
assert.deepEqual(canonicalProjectMetrics(state.filtered), {
  solar_mwp: 0,
  bess_mw: 0,
  project_count: 0,
  largest_project: null,
});

resetCanonicalProjectFilters(state);
const retainedProjects = state.all;
const retainedMetrics = state.metrics;
beginCanonicalProjectLoad(state);
assert.equal(state.status, "refreshing");
failCanonicalProjectLoad(state, new Error("refresh unavailable"));
assert.equal(state.status, "stale");
assert.equal(state.error, "refresh unavailable");
assert.equal(state.all, retainedProjects);
assert.equal(state.metrics, retainedMetrics);

const emptyState = createCanonicalProjectState();
beginCanonicalProjectLoad(emptyState);
failCanonicalProjectLoad(emptyState, "first load failed");
assert.equal(emptyState.status, "error");
assert.equal(emptyState.all.length, 0);
assert.throws(() => setCanonicalProjectFilter(state, "unknown", "x"), /unknown filter/);
const filtersBeforeInvalid = state.filters;
assert.throws(() => setCanonicalProjectFilter(state, "lifecycleView", "NOT_A_VIEW"), /invalid lifecycle view/);
assert.equal(state.filters, filtersBeforeInvalid);

console.log("V7.2 canonical project adapter/state: PASS (766 projects, isolated from live V7.1)");
