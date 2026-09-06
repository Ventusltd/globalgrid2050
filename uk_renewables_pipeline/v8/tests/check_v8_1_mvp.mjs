import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  buildCanonicalProjectModel,
  searchCanonicalProjects,
} from "../scripts/data/canonical-projects.js";
import {
  commitCanonicalProjectModel,
  createCanonicalProjectState,
  resetCanonicalProjectFilters,
  setCanonicalProjectFilter,
} from "../scripts/core/project-state.js";
import { buildCanonicalProjectCsv } from "../scripts/plugins/canonical-project-export.js";
import { buildCanonicalProjectTableView } from "../scripts/plugins/canonical-project-table.js";

const v8Url = new URL("../", import.meta.url);
const repoUrl = new URL("../../../", import.meta.url);
const readText = (path) => readFile(new URL(path, v8Url), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const mvp = await readJson("contracts/mvp.v8.1.json");
const projectContract = await readJson(mvp.projects.contract);
const projectPayloadBytes = await readFile(new URL(mvp.projects.source, v8Url));
const projectPayload = JSON.parse(projectPayloadBytes.toString("utf8"));
const model = buildCanonicalProjectModel(projectPayload, projectContract);

assert.equal(mvp.schema, "globalgrid2050.v8.mvp-contract.v1");
assert.equal(mvp.release, "8.1");
assert.equal(mvp.status, "LIVE_VALIDATED");
assert.equal(sha256(projectPayloadBytes), mvp.projects.source_sha256);
assert.equal(model.projects.length, mvp.projects.expected.project_count);
assert.equal(new Set(model.projects.map((project) => project.gg_development_id)).size, 718);
assert.equal(model.projects.filter((project) => project.technology === "solar").length, 384);
assert.equal(model.projects.filter((project) => project.technology === "bess").length, 382);
assert.equal(model.projects.filter((project) => !["solar", "bess"].includes(project.technology)).length, 0);
assert.equal(model.metrics.solar_mwp, 34073.49);
assert.equal(model.metrics.bess_mw, 106338.18);
assert.equal(model.metrics.largest_project.capacity_mw, 1450);

const fields = projectContract.interface.search_fields;
const refs = (query) => searchCanonicalProjects(model.projects, query, fields)
  .map((project) => project.repd_ref)
  .sort();
assert.deepEqual(refs("13599"), ["13599"]);
assert.deepEqual(refs("GG2050-REPD-13599"), ["13599"]);
assert.deepEqual(refs("GG2050-DEV-E13842D4D80DEC"), ["13599", "13600"]);
assert.deepEqual(refs("EN010151"), ["13599", "13600"]);
assert.deepEqual(refs("Beacon Fen"), ["13599", "13600"]);

const state = createCanonicalProjectState();
commitCanonicalProjectModel(state, model);
const table = buildCanonicalProjectTableView(state);
assert.equal(table.rowCount, 766);
assert.equal(table.columns.length, 11);
assert.equal(table.rows.every((row) => row.primary.repdRef && row.primary.ggProjectId), true);
assert.equal(table.rows.every((row) => row.primary.legacyNews.verified === false), true);

setCanonicalProjectFilter(state, "technology", "solar");
assert.equal(state.filtered.length, 384);
assert.equal(state.metrics.solar_mwp, 34073.49);
assert.equal(state.metrics.bess_mw, 0);
setCanonicalProjectFilter(state, "technology", "bess");
assert.equal(state.filtered.length, 382);
assert.equal(state.metrics.solar_mwp, 0);
assert.equal(state.metrics.bess_mw, 106338.18);
resetCanonicalProjectFilters(state);
setCanonicalProjectFilter(state, "query", "no-project-can-match-this-v8-1-gate");
const emptyCsv = buildCanonicalProjectCsv(state, { date: "2026-08-23" });
assert.equal(emptyCsv.rowCount, 0);
assert.equal(emptyCsv.content.split("\r\n").length, 1);
assert.equal(emptyCsv.filename, "globalgrid2050_uk_renewables_pipeline_v7_2_2026-08-23.csv");

const newsBytes = await readFile(new URL(mvp.newspaper.fixture, v8Url));
const news = JSON.parse(newsBytes.toString("utf8"));
assert.equal(sha256(newsBytes), mvp.newspaper.fixture_sha256);
assert.equal(news.headline_count, 125);
assert.equal(news.items.length, 125);

const html = await readText("index.html");
const projectsSource = await readText("scripts/plugins/projects.js");
const stateSource = await readText("scripts/core/state.js");
const newspaperSource = await readText("scripts/plugins/newspaper.js");
const pluginManifest = await readJson("data/plugin_manifest.json");
const rootIndex = await readFile(new URL("index.html", repoUrl), "utf8");

assert.match(html, /V8\.1 MVP/);
assert.match(html, /legacy V5 newspaper · project bindings unverified/i);
assert.equal((html.match(/<canvas id="g[1-4]"/g) || []).length, 4);
assert.equal((html.match(/<th(?:\s[^>]*)?>/g) || []).length, 11);
assert.equal(/data-technology="[^"]*wind/i.test(html), false);
assert.match(html, /data-technology="solar"/);
assert.match(html, /data-technology="bess"/);
assert.match(projectsSource, /loadCanonicalProjectModel/);
assert.match(projectsSource, /buildCanonicalProjectCsv/);
assert.equal(stateSource.includes("assets.publishing.service.gov.uk"), false);
assert.equal(newspaperSource.includes("major_project_news_v5.json"), false);
assert.equal(pluginManifest.version, "8.1");
assert.equal(pluginManifest.plugins.find((plugin) => plugin.id === "gauges").owns.includes("g4"), true);
/* Was: assert.match(rootIndex, /V8.1 MVP · canonical 766-project utility
   pipeline/). That is homepage copy, deleted when the front page was rebuilt to
   timestamp-and-title, and asserting it made this version's gate depend on
   editorial wording it does not own. The durable fact is reachability. */
assert.match(rootIndex, /uk_renewables_pipeline\/v8\//);

console.log("V8.1 MVP contract: PASS (766 canonical projects, 125 legacy headlines)");
