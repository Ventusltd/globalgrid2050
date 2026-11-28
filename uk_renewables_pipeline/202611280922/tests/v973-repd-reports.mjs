import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildRepdCapacityReport, NOT_REPORTED } from "../repd-reports-model.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(readFileSync(resolve(root, file), "utf8"));
const almost = (a, b) => assert.ok(Math.abs(a - b) < 0.011, "Capacity mismatch " + a + " != " + b);

test("source nulls, all statuses and technologies remain separate", () => {
  const rows = [
    { repd_ref: "1", technology: "solar", capacity_mw: 10.5, operator: "Alpha", region: "South West", status: "Operational" },
    { repd_ref: "2", technology: "bess", capacity_mw: 20, operator: "Alpha", region: "South West", status: "Application Submitted" },
    { repd_ref: "3", technology: "wind_onshore", capacity_mw: 1.5, operator: "", region: null, status: "Refused" },
    { repd_ref: "4", technology: "solar", capacity_mw: 4, operator: "Beta", region: "Scotland", status: "Withdrawn" },
    { repd_ref: "IC-1", technology: "interconnector", capacity_mw: 9000, operator: "Alpha", status: "Operational" }
  ];
  const operators = buildRepdCapacityReport(rows, "operator");
  const statuses = buildRepdCapacityReport(rows, "status");
  const regions = buildRepdCapacityReport(rows, "region");
  assert.equal(operators.total.count, 4);
  almost(operators.total.recordedCapacity, 36);
  almost(operators.total.solarMwp, 14.5);
  almost(operators.total.otherMw, 21.5);
  assert.equal(operators.groups.find(g => g.name === "Alpha").count, 2);
  assert.deepEqual(new Set(statuses.groups.map(g => g.name)), new Set(["Operational", "Application Submitted", "Refused", "Withdrawn"]));
  assert.equal(regions.groups.find(g => g.name === NOT_REPORTED).count, 1);
  assert.equal(operators.groups.find(g => g.name === NOT_REPORTED).count, 1);
  assert.throws(() => buildRepdCapacityReport([rows[0], rows[0]], "operator"), /Duplicate REPD/);
  assert.throws(() => buildRepdCapacityReport([{}], "region"), /Missing REPD/);
  assert.throws(() => buildRepdCapacityReport(rows, "country"), /Unsupported/);
});
test("actual frozen DESNZ REPD spine reconciles across all three reports", () => {
  const manifest = read("data/v9.1/build_manifest.json");
  const rows = manifest.project_partitions.flatMap(item => read(item.path).projects);
  assert.equal(rows.length, 7775);
  const operators = buildRepdCapacityReport(rows, "operator");
  const statuses = buildRepdCapacityReport(rows, "status");
  const regions = buildRepdCapacityReport(rows, "region");
  for (const report of [operators, statuses, regions]) {
    assert.equal(report.total.count, rows.length, "No silently dropped REPD projects");
    assert.equal(report.uniqueRefs, rows.length, "Unique REPD identities");
    almost(report.total.recordedCapacity, manifest.capacity_mw);
    almost(report.groups.reduce((acc, g) => acc + g.recordedCapacity, 0), report.total.recordedCapacity);
    assert.equal(report.groups.reduce((acc, g) => acc + g.count, 0), rows.length);
    for (const group of report.groups) {
      assert.equal(group.statuses.size, new Set(group.projects.map(p => p.status?.trim() || "Not reported")).size);
      assert.equal([...group.statuses.values()].reduce((s, x) => s + x.count, 0), group.count);
      almost([...group.statuses.values()].reduce((s, x) => s + x.recordedCapacity, 0), group.recordedCapacity);
      almost(group.solarMwp + group.otherMw, group.recordedCapacity);
    }
  }
  assert.deepEqual(new Set(statuses.groups.map(g => g.name)), new Set(rows.map(p => p.status?.trim() || "Not reported")));
  assert.deepEqual(new Set(regions.groups.map(g => g.name)), new Set(rows.map(p => p.region?.trim() || "Not reported")));
  assert.deepEqual(new Set(operators.groups.map(g => g.name)), new Set(rows.map(p => p.operator?.trim() || "Not reported")));
  console.log("PASS: 7,775 unique REPD projects, three full-dimensional reconciliations; status count", statuses.groups.length,
    "region count", regions.groups.length, "operator count", operators.groups.length);
});
