import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCockpitReport, cockpitSelection, verifyInventory,
  SOURCE_UNAVAILABLE
} from "../cockpit-facets.mjs";

const p = (repd_ref, technology, status, operator, region, capacity_mw, capacity_unit) =>
  ({ repd_ref: String(repd_ref), technology, status, operator, region, capacity_mw, capacity_unit });
const rows = [
  p(1, "solar", "Operational", "A Solar", "South East", 30, "MWp"),
  p(2, "solar", "Application Refused", "A Solar", "Wales", 20, "MWp"),
  p(3, "solar", "Application Submitted", "B Solar", "Wales", 5, "MWp"),
  p(4, "bess", "Operational", "B Storage", "Wales", 60, "MW"),
  p(5, "bess", "Withdrawn", "A Solar", "South East", 15, "MW"),
  p(6, "wind_onshore", "Operational", "Wind Co", "Scotland", 85, "MW"),
  p(7, "wind_offshore", "Under Construction", "Wind Co", "Offshore", 250, "MW"),
  p(8, "solar", "", "", "", null, "MWp"),
];
const opts = (dimension, filters = {}) => buildCockpitReport(rows, { dimension, filters });

test("all REPD records remain present by default; statuses never silently excluded", () => {
  const report = opts("status");
  assert.equal(report.sourceProjects, 8);
  assert.equal(report.matchingProjects, 8);
  assert.deepEqual(report.groups.map(g => g.label).sort(), [
    "Application Refused", "Application Submitted", "Not reported",
    "Operational", "Under Construction", "Withdrawn"
  ].sort());
  assert.equal(report.totals.missingCapacity, 1);
  assert.equal(report.groups.reduce((n, g) => n + g.projects, 0), 8);
});
test("solar cockpit filters operators; changing status further intersects without reset", () => {
  const solar = opts("operator", { technology: "solar" });
  assert.equal(solar.matchingProjects, 4);
  assert.deepEqual(solar.groups.map(g => g.label).sort(), ["A Solar", "B Solar", "Not reported"].sort());
  assert.equal(solar.totals.solarMwp, 55);
  assert.equal(solar.totals.otherMw, 0);
  const refused = opts("operator", { technology: "solar", status: "Application Refused" });
  assert.deepEqual(refused.ids, ["2"]);
  assert.equal(refused.groups[0].label, "A Solar");
  const byRegion = opts("region", refused.selection);
  assert.deepEqual(byRegion.ids, ["2"]);
  assert.equal(byRegion.groups[0].label, "Wales");
});
test("BESS, onshore and offshore never mix, and official refused/withdrawn status survives", () => {
  assert.deepEqual(opts("status", { technology: "bess" }).groups.map(g => g.label).sort(),
    ["Operational", "Withdrawn"]);
  assert.equal(opts("operator", { technology: "wind_onshore" }).totals.otherMw, 85);
  assert.equal(opts("operator", { technology: "wind_offshore" }).totals.otherMw, 250);
  assert.equal(opts("operator", { technology: "wind_offshore" }).totals.solarMwp, 0);
});
test("all three main report dimensions reconcile to same precise selected denominator", () => {
  const filters = { technology: "bess", status: "Withdrawn" };
  for (const dimension of ["operator", "status", "region", "technology"]) {
    const report = opts(dimension, filters);
    assert.equal(report.matchingProjects, 1);
    assert.equal(report.totals.recordedMixed, 15);
    assert.deepEqual(report.ids, ["5"]);
    assert.deepEqual(report.groups[0].ids, ["5"]);
  }
});
test("facet choices remain independently discoverable while retaining applied filters", () => {
  const report = opts("operator", { technology: "solar", status: "Operational" });
  assert.equal(report.matchingProjects, 1);
  assert.ok(report.facets.status.some(x => x.value === "Application Refused"));
  assert.ok(report.facets.operator.some(x => x.value === "A Solar"));
  assert.deepEqual(report.selection, {
    technology: "solar", status: "Operational", operator: "All", region: "All"
  });
});
test("interconnectors are separately sourced, never treated as REPD or returned as fake zero", () => {
  const unavailable = opts("operator", { technology: "interconnector" });
  assert.equal(unavailable.availability, SOURCE_UNAVAILABLE);
  assert.equal(unavailable.sourceProjects, null);
  const interconnectors = [
    { asset_id: "IC-A", technology: "interconnector", status: "Operational",
      operator: "Cable Co", region: "East", capacity_mw: 750, capacity_unit: "MW" }
  ];
  const report = buildCockpitReport(rows, {
    dimension: "operator", filters: { technology: "interconnector" }, interconnectors
  });
  assert.equal(report.sourceProjects, 1);
  assert.equal(report.matchingProjects, 1);
  assert.deepEqual(report.ids, ["IC-A"]);
  assert.equal(report.totals.recordedByUnit.MW, 750);
  assert.equal(report.source, "interconnector");
});
test("grid is a reserved distinct inventory until its source contract is verified", () => {
  const report = opts("operator", { technology: "grid" });
  assert.equal(report.availability, SOURCE_UNAVAILABLE);
  assert.equal(report.matchingProjects, null);
});
test("missing/duplicate REPD identity and accidental interconnector contamination fail closed", () => {
  assert.throws(() => verifyInventory([rows[0], { ...rows[0] }]), /Duplicate repd identity/);
  assert.throws(() => verifyInventory([p("", "solar", "Operational", "X", "Y", 1)]), /Missing or invalid/);
  assert.throws(() => verifyInventory([p(90, "interconnector", "Operational", "X", "Y", 1)]), /inside REPD/);
});
test("same underlying REPD rows; no mutation or invented capacity for missing inputs", () => {
  const original = JSON.stringify(rows);
  const report = opts("technology");
  assert.equal(JSON.stringify(rows), original);
  assert.equal(report.totals.recordedByUnit.MWp, 55);
  assert.equal(report.totals.recordedByUnit.MW, 410);
  assert.equal(report.totals.recordedMixed, 465);
  assert.match(report.totals.mixedUnitWarning, /not a physically comparable capacity/);
  assert.equal(cockpitSelection({ technology: "solar", status: "Withdrawn" }).status, "Withdrawn");
});
