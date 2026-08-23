import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildCanonicalProjectModel } from "../scripts/data/canonical-projects.js";
import {
  commitCanonicalProjectModel,
  createCanonicalProjectState,
  resetCanonicalProjectFilters,
  setCanonicalProjectFilter,
} from "../scripts/core/project-state.js";
import { buildCanonicalProjectCsv } from "../scripts/plugins/canonical-project-export.js";
import { buildCanonicalProjectTableView } from "../scripts/plugins/canonical-project-table.js";

const v9Url = new URL("../", import.meta.url);
const repoUrl = new URL("../../../", import.meta.url);
const readText = (path) => readFile(new URL(path, v9Url), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

const release = await readJson("contracts/release.v9.0.json");
const contract = await readJson("contracts/projects-plugin.v7.2.json");
const payload = await readJson("data/v7.2/projects.json");
const news = await readJson("fixtures/v5/major_project_news_v5.json");
const model = buildCanonicalProjectModel(payload, contract);

assert.equal(release.release, "9.0");
assert.equal(release.canonical_projects.project_count, 766);
assert.equal(model.projects.length, 766);
assert.equal(model.projects.filter((project) => project.technology === "solar").length, 384);
assert.equal(model.projects.filter((project) => project.technology === "bess").length, 382);
assert.equal(model.projects.filter((project) => !["solar", "bess"].includes(project.technology)).length, 0);
assert.equal(news.items.length, 125);

const state = createCanonicalProjectState();
commitCanonicalProjectModel(state, model);
const table = buildCanonicalProjectTableView(state);
assert.equal(table.rowCount, 766);
assert.equal(table.columns.length, 13);

const thorpeMarsh = table.rows.find((row) => row.primary.repdRef === "12453");
assert.ok(thorpeMarsh);
assert.equal(thorpeMarsh.primary.repdRecordUpdated.value, "2025-11-04");
assert.equal(thorpeMarsh.primary.repdRecordUpdated.display, "04/11/2025");
assert.equal(thorpeMarsh.primary.atlas.exactFocusSupported, true);
const atlas = new URL(thorpeMarsh.primary.atlas.url);
assert.equal(atlas.origin, "https://globalgrid2050.com");
assert.equal(atlas.pathname, "/repd_grid_atlasv8/");
assert.equal(atlas.searchParams.get("repd_ref"), "12453");
assert.equal(atlas.searchParams.get("technology"), "bess");
assert.equal(atlas.searchParams.get("capacity_mw"), "1450");
assert.equal(atlas.searchParams.get("latitude"), "53.5802575");
assert.equal(atlas.searchParams.get("longitude"), "-1.0850616");

const missingDate = table.rows.find((row) => row.primary.repdRecordUpdated.value === null);
assert.ok(missingDate);
assert.equal(missingDate.primary.repdRecordUpdated.display, "not supplied by REPD");

setCanonicalProjectFilter(state, "technology", "solar");
const solarCsv = buildCanonicalProjectCsv(state, { date: "2026-08-23" });
assert.equal(solarCsv.rowCount, 384);
assert.equal(solarCsv.filename, "globalgrid2050_uk_renewables_pipeline_v9_0_2026-08-23.csv");
assert.equal(solarCsv.content.split("\r\n").length, 385);
assert.match(solarCsv.content.split("\r\n")[0], /"REPD Record Updated"/);
assert.match(solarCsv.content.split("\r\n")[0], /"Atlas V8 URL"/);
assert.match(solarCsv.content, /https:\/\/globalgrid2050\.com\/repd_grid_atlasv8\//);

resetCanonicalProjectFilters(state);
setCanonicalProjectFilter(state, "query", "no-v9-project-can-match-this-value");
const emptyCsv = buildCanonicalProjectCsv(state, { date: "2026-08-23" });
assert.equal(emptyCsv.rowCount, 0);
assert.equal(emptyCsv.content.split("\r\n").length, 1);

const html = await readText("index.html");
const readme = await readText("README.md");
const rootIndex = await readFile(new URL("index.html", repoUrl), "utf8");
assert.match(html, /V9\.0 INTERIM/);
assert.equal((html.match(/<th(?:\s[^>]*)?>/g) || []).length, 13);
assert.match(html, /id="exportInline"/);
assert.match(html, /REPD RECORD UPDATED/);
assert.match(html, /flies to the exact V9 project coordinate/);
assert.match(readme, /independently of a new chat, context truncation or model replacement/);
assert.match(readme, /exact canonical focus/i);
const atlasEngine = await readFile(new URL("repd_grid_atlasv8/ventus-corev8engine.js", repoUrl), "utf8");
assert.match(atlasEngine, /focusCanonicalProjectDeepLink/);
assert.match(atlasEngine, /data\/v7\.2\/projects\.geojson/);
assert.match(rootIndex, /UK Solar \+ Storage Daily V9/);

console.log("V9.0 interim release: PASS (dates, filtered CSV, Atlas links, 766 projects)");
