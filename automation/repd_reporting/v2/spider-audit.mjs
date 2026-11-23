/**
 * Spider-style input closure / fail-closed audit for isolated REPD cockpit v2.
 * No network access, no external dependencies, no mutation of production.
 * See Ventusltd/spiders/AGENTS.md + Ventusltd/testcode/README.md.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "../../..");
const inputs = JSON.parse(readFileSync(join(here, "SPIDER-INPUTS.json"), "utf8"));
const problems = [];
const facts = [];
function gitBlob(bytes) {
  return createHash("sha1")
    .update("blob " + bytes.length + "\0")
    .update(bytes)
    .digest("hex");
}
function assert(condition, message) {
  if (!condition) problems.push(message);
}
function checkSource(source) {
  const full = join(root, source.path);
  if (!existsSync(full)) {
    problems.push("MISSING REQUIRED INPUT " + source.path);
    return;
  }
  const content = readFileSync(full);
  const sha = gitBlob(content);
  assert(sha === source.gitBlob,
    "SOURCE DRIFT " + source.path + " (expected " + source.gitBlob + ", observed " + sha + ")");
  facts.push({ path: source.path, gitBlob: sha, bytes: content.length });
}
for (const source of inputs.sources) checkSource(source);
for (const candidate of inputs.candidate) {
  assert(existsSync(join(root, candidate.path)), "MISSING CANDIDATE " + candidate.path);
}
function fileText(path) {
  const full = join(root, path);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
}
const index = fileText("uk_renewables_pipeline/202611222330/index.html");
const liveReports = fileText("uk_renewables_pipeline/202611222330/repd-reports.mjs");
const projectControls = fileText("uk_renewables_pipeline/202611222330/scripts/plugins/projects-v9-8.js");
const facets = fileText("automation/repd_reporting/v2/cockpit-facets.mjs");
function hasAll(text, markers) {
  return markers.every(marker => text.includes(marker));
}
const indexes = [
  'data-technology="all"', 'data-technology="solar"',
  'data-technology="bess"', 'data-technology="wind_onshore"',
  'data-technology="wind_offshore"', 'data-technology="interconnector"',
  'data-repd-report="operator"', 'data-repd-report="status"',
  'data-repd-report="region"', 'id="repdReportsPanel"',
  'src="repd-reports.mjs"', 'src="report-a4.mjs"'
];
assert(hasAll(index, indexes), "MISSING NATIVE V9.73 TECHNOLOGY/REPORT/MAP-A4 DOM CONTRACT");
assert(hasAll(liveReports, ['import { state }', 'buildRepdCapacityReport',
  'atlasUrlV9_5_1', 'state.filtered', 'state.all']), "MISSING NATIVE REPORT DATA/MAP CONTRACT");
assert(hasAll(projectControls, ['state.filtered = filtered', 'updateGaugesV9_2(filtered)',
  'pipeline-projects-rendered', 'data.technology']), "MISSING NATIVE FILTER/GAUGE/RENDER HOOK");
assert(hasAll(facets, ['buildCockpitReport', 'cockpitSelection', 'sourceProjects',
  'interconnector', 'SOURCE_UNAVAILABLE', 'verifyInventory']),
  "MISSING ISOLATED CROSS-FILTER EXPORT OR SOURCE SEPARATION");
assert(!/\b(?:window|document|fetch|XMLHttpRequest)\s*(?:\.|\(|\[)/.test(facets),
  "CANDIDATE PURE AGGREGATION HAS DOM OR NETWORK SIDE EFFECT");
assert(!index.includes("automation/repd_reporting/v2/cockpit-facets.mjs"),
  "BASELINE HAS BEEN SILENTLY MOUNTED; INTEGRATION MUST BE A NEW IMMUTABLE EDITION");
assert(inputs.integrationStatus === "ISOLATED_ONLY" && inputs.proofStage === "OFFLINE",
  "AUDIT CANNOT CLAIM PRODUCTION OR NETWORK ACCEPTANCE");
// Test that the proof can detect two manufactured failures, without writing files.
const damagedDOM = index.replace('data-repd-report="operator"', 'data-repd-report="missing"');
assert(!hasAll(damagedDOM, indexes), "MUTATION TEST FAILED: missing report action not detected");
const source = inputs.sources[0];
if (index) {
  assert(gitBlob(Buffer.from(index + "\nSPIDER-MUTATION")) !== source.gitBlob,
    "MUTATION TEST FAILED: changed source not detected");
}
const summary = {
  schema: "ventus.pipeline.cockpit-spider-audit.v1",
  success: problems.length === 0,
  stage: "OFFLINE_ONLY",
  status: "ISOLATED_NOT_PUBLISHED",
  baseline: inputs.releaseBaseline,
  inputsChecked: facts.length,
  inputFacts: facts,
  mutationGuards: 2,
  problems,
  caveat: "Source pin and code-shape checks, not real-data 7,775-row or browser acceptance."
};
console.log(JSON.stringify(summary, null, 2));
if (problems.length) process.exitCode = 1;
