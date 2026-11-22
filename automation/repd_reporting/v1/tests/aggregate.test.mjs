import assert from "node:assert/strict";
import { test } from "node:test";
import { periodKey, validateIdentity, snapshotReport, operationalReport, estimatedGeneration } from "../aggregate.mjs";

const base = [
  { repd_ref: "1", repd_technology: "Solar Photovoltaics", capacity_mw: 10, capacity_unit: "MWp", status: "Operational", operational: "2024-01-15", operator: "Alpha", region: "South East" },
  { repd_ref: "2", repd_technology: "Wind Onshore", capacity_mw: 20, capacity_unit: "MW", status: "Operational", operational: "2024-03-31", operator: "Beta", region: "Scotland" },
  { repd_ref: "3", repd_technology: "Battery", capacity_mw: 50, capacity_unit: "MW", status: "Operational", operational: "2024-04-01", operator: "Alpha", region: "South East" },
  { repd_ref: "4", repd_technology: "Solar Photovoltaics", capacity_mw: 10, capacity_unit: "MWp", status: "Application Submitted", operational: "2024-02-01", operator: "Gamma", region: "Wales" },
  { repd_ref: "5", repd_technology: "Solar Photovoltaics", capacity_mw: null, capacity_unit: "MWp", status: "Operational", operational: null, operator: null, region: null },
  { repd_ref: "6", repd_technology: "Solar Photovoltaics", capacity_mw: 8, capacity_unit: "MWp", status: "Operational", operational: "2027-01-01", operator: "Delta", region: "Wales" },
];

test("validates dates, leap years, and exact month/quarter/year boundaries", () => {
  assert.equal(periodKey("2024-02-29", "month"), "2024-02");
  assert.equal(periodKey("2024-03-31", "quarter"), "2024-Q1");
  assert.equal(periodKey("2024-04-01", "quarter"), "2024-Q2");
  assert.equal(periodKey("2024-12-31", "year"), "2024");
  assert.equal(periodKey("2023-02-29", "month"), null);
  assert.equal(periodKey("2024-13-02", "month"), null);
});
test("never silently deduplicates or accepts missing REPD identity", () => {
  assert.equal(validateIdentity(base), 6);
  assert.throws(() => validateIdentity([...base, { ...base[0] }]), /duplicate/i);
  assert.throws(() => validateIdentity([{}]), /missing/i);
});
test("snapshot status retains all official statuses, including submitted", () => {
  const r = snapshotReport(base, { dimension: "status" }).rows;
  assert.equal(r.find(x => x.group === "Operational").projects, 5);
  assert.equal(r.find(x => x.group === "Application Submitted").projects, 1);
});
test("snapshot operator retains missing operator as explicit bucket", () => {
  const r = snapshotReport(base, { dimension: "operator" }).rows;
  assert.equal(r.find(x => x.group === "Not supplied").projects, 1);
  assert.equal(r.find(x => x.group === "Alpha").projects, 2);
});
test("monthly/quarterly operational report excludes applicants with a date", () => {
  const m = operationalReport(base, { period: "month", asOf: "2026-11-22" }).rows;
  assert.equal(m.some(x => x.period === "2024-02"), false);
  assert.equal(m.find(x => x.period === "2024-01").projects, 1);
  assert.equal(m.find(x => x.period === "2024-03").projects, 1);
  const q = operationalReport(base, { period: "quarter" }).rows;
  assert.equal(q.filter(x => x.period === "2024-Q1").reduce((a, x) => a + x.projects, 0), 2);
  assert.equal(q.filter(x => x.period === "2024-Q2").reduce((a, x) => a + x.projects, 0), 1);
});
test("unknown date and contradictory future dates are not called energised", () => {
  const r = operationalReport(base).rows;
  assert.equal(r.find(x => x.period === "UNKNOWN-DATE").projects, 1);
  assert.equal(r.find(x => x.period === "FUTURE-DATE-CONFLICT").projects, 1);
});
test("capacity units never silently combine MW with MWp", () => {
  const r = snapshotReport(base, { dimension: "all" }).rows[0];
  assert.equal(r.capacityByUnit.MWp, 28);
  assert.equal(r.capacityByUnit.MW, 70);
  assert.equal(r.missingCapacity, 1);
});
test("filters apply source fields without modifying records", () => {
  const before = JSON.stringify(base);
  const r = snapshotReport(base, { dimension: "region", filters: { technology: "Solar Photovoltaics", status: "Operational" } }).rows;
  assert.equal(r.reduce((s, x) => s + x.projects, 0), 3);
  assert.equal(JSON.stringify(base), before);
});
test("generation scenario has no invented default CF or actual meter claim", () => {
  const r = estimatedGeneration(base, { year: 2024, period: "quarter", asOf: "2024-12-31" });
  assert.equal(r.kind, "scenario-estimated-generation-not-metered");
  assert.equal(r.rows[0].mwh, null);
  assert.equal(r.excludedStorageRefs.includes("3"), true);
  assert.equal(r.excludedUnknownOperationalDateRefs.includes("5"), true);
});
test("explicit scenario factors estimate partial commissioning month only", () => {
  const solarOnly = [base[0]];
  const r = estimatedGeneration(solarOnly, { year: 2024, asOf: "2024-01-31", factors: { "Solar Photovoltaics": 0.1 } });
  // 17 active days (15th through 31st) * 24 h * 10 MWp * user CF 0.1
  assert.equal(r.rows[0].mwh, 408);
  assert.equal(r.rows[1].mwh, null);
  assert.equal(r.rows[0].availability, "SCENARIO_ONLY");
});
test("storage excluded even if user supplies a factor", () => {
  const r = estimatedGeneration([base[2]], { year: 2024, asOf: "2024-04-30", factors: { Battery: 0.8 } });
  assert.equal(r.rows[3].mwh, 0);
  assert.equal(r.excludedStorageRefs.join(","), "3");
});
test("invalid seasonality profile fails closed", () => {
  assert.throws(() => estimatedGeneration([base[0]], { year: 2024, asOf: "2024-01-31", factors: { "Solar Photovoltaics": 0.1 }, seasonality: { "Solar Photovoltaics": [1,2] } }), /twelve-month/);
});
