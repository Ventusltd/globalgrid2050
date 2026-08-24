import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildCanonicalProjectModel } from "../scripts/data/canonical-projects.js";
import {
  beginCanonicalProjectLoad,
  commitCanonicalProjectModel,
  createCanonicalProjectState,
  failCanonicalProjectLoad,
} from "../scripts/core/project-state.js";
import {
  buildCanonicalProjectControlsView,
  createCanonicalProjectControls,
} from "../scripts/plugins/canonical-project-controls.js";

const v7Url = new URL("../", import.meta.url);
const contract = JSON.parse(await readFile(new URL("contracts/projects-plugin.v7.2.json", v7Url), "utf8"));
const payload = JSON.parse(await readFile(new URL("data/v7.2/projects.json", v7Url), "utf8"));
const model = buildCanonicalProjectModel(payload, contract);

const gaugeMap = (view) => Object.fromEntries(view.gauges.map((gauge) => [gauge.id, gauge]));
const resultRefs = (state) => state.filtered.map((project) => project.repd_ref);

const unavailableState = createCanonicalProjectState();
beginCanonicalProjectLoad(unavailableState);
failCanonicalProjectLoad(unavailableState, "first load unavailable");
const unavailable = buildCanonicalProjectControlsView(unavailableState);
assert.equal(unavailable.available, false);
assert.equal(unavailable.status, "error");
assert.equal(unavailable.gauges, null);
assert.equal(unavailable.resultCount, null);
assert.equal(unavailable.error, "first load unavailable");

const state = createCanonicalProjectState();
commitCanonicalProjectModel(state, model);
const controls = createCanonicalProjectControls(state);
let view = controls.snapshot();
let gauges = gaugeMap(view);

assert.equal(view.available, true);
assert.equal(view.status, "ready");
assert.equal(view.resultCount, 766);
assert.equal(view.gauges.length, 4);
assert.equal("combined_capacity" in gauges, false);
assert.equal(gauges.solar_mwp.value, 34073.49);
assert.equal(gauges.solar_mwp.unit, "MWp");
assert.equal(gauges.bess_mw.value, 106338.18);
assert.equal(gauges.bess_mw.unit, "MW");
assert.equal(gauges.project_count.value, 766);
assert.equal(gauges.largest_project.value, 1450);
assert.equal(gauges.largest_project.unit, "MW");
assert.equal(gauges.largest_project.project.gg_project_id, "GG2050-REPD-12453");
assert.equal(view.capacityBasis, "official_repd_record_capacity_not_development_deduplicated");
assert.deepEqual(view.lifecycleViews.map(({ id, count }) => [id, count]), [
  ["ALL", 766],
  ["CURRENT", 670],
  ["DISPUTED", 3],
  ["HISTORICAL", 63],
  ["REVIEW", 30],
]);
assert.deepEqual(view.filterOptions.technology.map(({ id, count }) => [id, count]), [
  ["all", 766],
  ["solar", 384],
  ["bess", 382],
]);
assert.deepEqual(view.search.exactIdentifierFields, ["repd_ref", "gg_project_id"]);
assert.equal(view.search.exactIdentifierPrecedence, true);
assert.equal(Object.isFrozen(view), true);
assert.equal(Object.isFrozen(view.gauges), true);
assert.equal(Object.isFrozen(view.lifecycleViews), true);

view = controls.setFilter("technology", "solar");
gauges = gaugeMap(view);
assert.equal(view.resultCount, 384);
assert.equal(gauges.solar_mwp.value, 34073.49);
assert.equal(gauges.bess_mw.value, 0);
assert.equal(gauges.largest_project.value, 840);
assert.equal(gauges.largest_project.unit, "MWp");
assert.equal(gauges.largest_project.project.gg_project_id, "GG2050-REPD-12588");

view = controls.setFilter("technology", "bess");
gauges = gaugeMap(view);
assert.equal(view.resultCount, 382);
assert.equal(gauges.solar_mwp.value, 0);
assert.equal(gauges.bess_mw.value, 106338.18);
assert.equal(gauges.largest_project.value, 1450);
assert.equal(gauges.largest_project.unit, "MW");

controls.reset();
for (const [lifecycleView, count, solarMwp, bessMw, largest, unit] of [
  ["CURRENT", 670, 31453.53, 96540.88, 1450, "MW"],
  ["DISPUTED", 3, 200, 99.9, 125, "MWp"],
  ["HISTORICAL", 63, 1509.07, 6648.7, 1000, "MW"],
  ["REVIEW", 30, 910.89, 3048.7, 1450, "MW"],
]) {
  view = controls.setFilter("lifecycleView", lifecycleView);
  gauges = gaugeMap(view);
  assert.equal(view.resultCount, count);
  assert.equal(gauges.solar_mwp.value, solarMwp);
  assert.equal(gauges.bess_mw.value, bessMw);
  assert.equal(gauges.largest_project.value, largest);
  assert.equal(gauges.largest_project.unit, unit);
  controls.reset();
}

for (const [query, expected] of [
  ["13599", ["13599"]],
  ["GG2050-REPD-13599", ["13599"]],
  ["GG2050-DEV-E13842D4D80DEC", ["13600", "13599"]],
  ["EN010151", ["13600", "13599"]],
  ["Beacon Fen", ["13600", "13599"]],
]) {
  controls.setFilter("query", query);
  assert.deepEqual(resultRefs(state), expected);
  controls.reset();
}

controls.setFilter("technology", "bess");
view = controls.setFilter("query", "13599");
gauges = gaugeMap(view);
assert.equal(view.resultCount, 0);
assert.equal(gauges.solar_mwp.value, 0);
assert.equal(gauges.bess_mw.value, 0);
assert.equal(gauges.project_count.value, 0);
assert.equal(gauges.largest_project.value, null);
assert.equal(gauges.largest_project.unit, null);
assert.equal(gauges.largest_project.project, null);

view = controls.reset();
assert.equal(view.resultCount, 766);
const filtersBeforeInvalid = state.filters;
assert.throws(() => controls.setFilter("county", "Not a canonical county"), /invalid county/);
assert.equal(state.filters, filtersBeforeInvalid);
assert.throws(() => controls.setFilter("unknown", "value"), /unknown filter/);
assert.equal(state.filters, filtersBeforeInvalid);

const retainedMetrics = state.metrics;
beginCanonicalProjectLoad(state);
view = controls.snapshot();
assert.equal(view.available, true);
assert.equal(view.status, "refreshing");
failCanonicalProjectLoad(state, new Error("refresh unavailable"));
view = controls.snapshot();
assert.equal(view.available, true);
assert.equal(view.status, "stale");
assert.equal(state.metrics, retainedMetrics);
assert.equal(gaugeMap(view).project_count.value, 766);

for (const liveFile of [
  "index.html",
  "scripts/app.js",
  "scripts/plugins/gauges.js",
  "scripts/plugins/project-filters.js",
  "scripts/plugins/projects.js",
]) {
  const text = await readFile(new URL(liveFile, v7Url), "utf8");
  assert.equal(text.includes("canonical-project-controls"), false, `${liveFile} imports isolated controls`);
}

console.log("V7.2 canonical project controls: PASS (gauges, lifecycle filters and search remain isolated)");
