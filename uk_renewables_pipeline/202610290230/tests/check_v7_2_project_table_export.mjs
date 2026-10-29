import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildCanonicalProjectModel } from "../scripts/data/canonical-projects.js";
import {
  commitCanonicalProjectModel,
  createCanonicalProjectState,
  failCanonicalProjectLoad,
  setCanonicalProjectFilter,
} from "../scripts/core/project-state.js";
import {
  buildCanonicalNewsSearchUrl,
  buildCanonicalProjectTableView,
} from "../scripts/plugins/canonical-project-table.js";
import {
  buildCanonicalProjectCsv,
  neutraliseSpreadsheetFormula,
  quoteCsvCell,
} from "../scripts/plugins/canonical-project-export.js";

const v7Url = new URL("../", import.meta.url);
const contract = JSON.parse(await readFile(new URL("contracts/projects-plugin.v7.2.json", v7Url), "utf8"));
const payload = JSON.parse(await readFile(new URL("data/v7.2/projects.json", v7Url), "utf8"));
const model = buildCanonicalProjectModel(payload, contract);

function readyState() {
  const state = createCanonicalProjectState();
  commitCanonicalProjectModel(state, model);
  return state;
}

function parseCsv(content) {
  const text = content.startsWith("\ufeff") ? content.slice(1) : content;
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && character === "\r" && text[index + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 1;
    } else {
      cell += character;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const state = readyState();
const table = buildCanonicalProjectTableView(state);
assert.equal(table.available, true);
assert.equal(table.rowCount, 766);
assert.equal(table.columns.length, 11);
assert.deepEqual(table.columns.map((column) => column.label), contract.interface.primary_table_columns);
assert.equal(table.rows[0].key, "GG2050-REPD-12453");
assert.equal(table.rows[0].primary.capacity.display, "1,450 MW");
assert.equal(table.rows[0].evidence.relationships.items.some((item) => (
  item.repdRef === "8470" && item.targetInCurrentUniverse === false
)), true);
assert.equal(table.rows.some((row) => row.key === "GG2050-REPD-8470"), false);
assert.equal(table.rows.filter((row) => ["GG2050-REPD-13599", "GG2050-REPD-13600"].includes(row.key)).length, 2);
assert.equal(Object.isFrozen(table), true);
assert.equal(Object.isFrozen(table.rows), true);
assert.equal(Object.isFrozen(table.rows[0]), true);
assert.equal(Object.isFrozen(table.rows[0].evidence), true);
assert.equal(Object.isFrozen(table.rows[0].evidence.officialPlanning.milestones), true);
assert.equal(Object.isFrozen(table.rows[0].evidence.relationships.items), true);
assert.equal(Object.isFrozen(table.rows[0].evidence.provenance), true);

const byId = new Map(table.rows.map((row) => [row.key, row]));
const hamsHall = byId.get("GG2050-REPD-9427");
assert.equal(hamsHall.primary.capacity.value, 400);
assert.equal(hamsHall.primary.capacity.unit, "MW");
assert.equal(hamsHall.evidence.officialPlanning.milestones.planning_permission_granted.value, "2022-03-04");
assert.equal(hamsHall.evidence.officialPlanning.milestones.operational.display, "not supplied by REPD");
assert.equal(byId.get("GG2050-REPD-16393").primary.planningReference, "not supplied by REPD");
assert.equal(byId.get("GG2050-REPD-20966").evidence.officialPlanning.repdRecordUpdated.display, "not supplied by REPD");
assert.equal(byId.get("GG2050-REPD-13599").evidence.identity.ggDevelopmentId, "GG2050-DEV-E13842D4D80DEC");
assert.equal(byId.get("GG2050-REPD-13599").evidence.provenance.projectsSha256, payload.projects_sha256);
assert.equal(byId.get("GG2050-REPD-13599").evidence.provenance.dataset, payload.source_provenance.dataset);
assert.equal(byId.get("GG2050-REPD-13599").primary.legacyNews.verified, false);
assert.equal(byId.get("GG2050-REPD-13599").primary.legacyNews.authority, "external legacy intelligence — unverified");
assert.equal(byId.get("GG2050-REPD-13599").primary.legacyNews.label, "not evaluated");

const withLegacySignal = buildCanonicalProjectTableView(state, {
  legacySignalResolver(project) {
    return project.repd_ref === "9427"
      ? { label: "350 MW article claim", note: "unverified inherited V5 match" }
      : null;
  },
});
assert.equal(withLegacySignal.rows.find((row) => row.key === "GG2050-REPD-9427").primary.capacity.value, 400);
assert.equal(withLegacySignal.rows.find((row) => row.key === "GG2050-REPD-9427").primary.legacyNews.label, "350 MW article claim");

const legacyFailure = buildCanonicalProjectTableView(state, {
  legacySignalResolver() { throw new Error("legacy feed offline"); },
});
assert.equal(legacyFailure.rowCount, 766);
assert.equal(legacyFailure.rows[0].primary.legacyNews.status, "legacy_news_unavailable");
assert.equal(legacyFailure.rows[0].primary.legacyNews.note, "Legacy news resolver failed");

const maliciousName = '  =HYPERLINK("https://evil.example"), Café\nsecond line';
const maliciousUrl = new URL(buildCanonicalNewsSearchUrl({
  name: maliciousName,
  technology_label: "Solar",
}));
assert.equal(maliciousUrl.origin, "https://www.google.com");
assert.equal(maliciousUrl.pathname, "/search");
assert.equal(maliciousUrl.searchParams.get("tbm"), "nws");
const forgedState = { ...state, filtered: [{ ...state.filtered[0], name: "FORGED PROJECT", capacity_mw: 999999 }] };
assert.throws(() => buildCanonicalProjectTableView(forgedState), /not exact canonical project objects/);
assert.throws(() => buildCanonicalProjectCsv(forgedState), /not exact canonical project objects/);
const duplicateState = { ...state, filtered: [state.filtered[0], state.filtered[0]] };
assert.throws(() => buildCanonicalProjectTableView(duplicateState), /duplicate canonical project/);
const toctouState = readyState();
let mutatedDuringResolve = false;
assert.throws(
  () => buildCanonicalProjectCsv(toctouState, {
    date: "2026-08-23",
    legacySignalResolver() {
      if (!mutatedDuringResolve) {
        mutatedDuringResolve = true;
        toctouState.filtered = toctouState.filtered.map((project) => ({ ...project, name: "FORGED AFTER VALIDATION" }));
        toctouState.metadata = { ...toctouState.metadata, projects_sha256: "FORGED" };
      }
      return null;
    },
  }),
  /canonical state changed while the table view was being built/,
);

const fullExport = buildCanonicalProjectCsv(state, { date: "2026-08-23" });
assert.equal(fullExport.filename, "globalgrid2050_uk_renewables_pipeline_v7_2_2026-08-23.csv");
assert.equal(fullExport.mimeType, "text/csv;charset=utf-8");
assert.equal(fullExport.rowCount, 766);
assert.equal(fullExport.columnCount, contract.interface.export.columns.length);
assert.deepEqual([...Buffer.from(fullExport.content).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
assert.equal(fullExport.content.includes("\r\n"), true);
const fullRows = parseCsv(fullExport.content);
assert.equal(fullRows.length, 767);
assert.deepEqual(fullRows[0], contract.interface.export.columns.map((column) => column.label));
const headerIndex = new Map(fullRows[0].map((label, index) => [label, index]));
assert.equal(fullRows[1][headerIndex.get("REPD Ref")], "12453");
assert.equal(fullRows[1][headerIndex.get("Official REPD Capacity")], "1450");
assert.equal(fullRows[1][headerIndex.get("Capacity Unit")], "MW");
assert.equal(fullRows[1][headerIndex.get("Projects Array SHA-256")], payload.projects_sha256);
assert.equal(fullRows.some((row) => row[headerIndex.get("Site Name")] === "Alaw Môn Solar Farm - Solar Farm & Energy Storage Facility"), true);

const beaconState = readyState();
setCanonicalProjectFilter(beaconState, "query", "13599");
const beaconExport = buildCanonicalProjectCsv(beaconState, { date: "2026-08-23" });
const beaconRows = parseCsv(beaconExport.content);
assert.equal(beaconExport.rowCount, 1);
assert.equal(beaconRows.length, 2);
assert.equal(beaconRows[1][headerIndex.get("REPD Ref")], "13599");
assert.equal(beaconRows[1][headerIndex.get("Technology")], "Solar");
assert.equal(beaconRows[1][headerIndex.get("Capacity Unit")], "MWp");

const zeroState = readyState();
setCanonicalProjectFilter(zeroState, "officialStatus", "No such official status");
assert.equal(zeroState.filtered.length, 0);
const zeroExport = buildCanonicalProjectCsv(zeroState, { date: "2026-08-23" });
assert.equal(zeroExport.rowCount, 0);
assert.equal(parseCsv(zeroExport.content).length, 1);
assert.equal(zeroExport.content.includes("\r\n"), false);

const emptyState = createCanonicalProjectState();
assert.equal(buildCanonicalProjectTableView(emptyState).available, false);
assert.throws(() => buildCanonicalProjectCsv(emptyState), /validated canonical project model is unavailable/);
const staleState = readyState();
failCanonicalProjectLoad(staleState, "refresh unavailable");
assert.equal(buildCanonicalProjectTableView(staleState).rowCount, 766);
assert.equal(buildCanonicalProjectCsv(staleState, { date: "2026-08-23" }).rowCount, 766);

assert.equal(neutraliseSpreadsheetFormula("=1+1"), "'=1+1");
assert.equal(neutraliseSpreadsheetFormula("  @SUM(A1:A2)"), "'  @SUM(A1:A2)");
assert.equal(neutraliseSpreadsheetFormula("\tformula"), "'\tformula");
assert.equal(neutraliseSpreadsheetFormula(-1.0850616), -1.0850616);
assert.equal(quoteCsvCell('comma, quote " and\nnewline'), '"comma, quote "" and\nnewline"');
assert.equal(quoteCsvCell("Café"), '"Café"');
assert.throws(() => buildCanonicalProjectCsv(state, { date: "23-08-2026" }), /YYYY-MM-DD/);
assert.throws(() => buildCanonicalProjectCsv(state, { date: "2026-99-99" }), /valid YYYY-MM-DD/);

const badMetadataState = readyState();
badMetadataState.metadata = { ...badMetadataState.metadata, projects_sha256: "0".repeat(64) };
assert.throws(() => buildCanonicalProjectTableView(badMetadataState), /projects_sha256/);
const badPayload = structuredClone(payload);
badPayload.source_identity_sha256 = "0".repeat(64);
assert.throws(() => buildCanonicalProjectModel(badPayload, contract), /source_identity_sha256/);

for (const livePath of [
  "index.html",
  "scripts/app.js",
  "scripts/plugins/project-table.js",
  "scripts/plugins/project-export.js",
  "scripts/plugins/projects.js",
]) {
  const source = await readFile(new URL(livePath, v7Url), "utf8");
  assert.equal(source.includes("canonical-project-table"), false, `${livePath} imports the isolated table`);
  assert.equal(source.includes("canonical-project-export"), false, `${livePath} imports the isolated export`);
}

console.log("V7.2 canonical table/evidence/export: PASS (766 rows, filtered-only CSV, isolated from live V7.1)");
