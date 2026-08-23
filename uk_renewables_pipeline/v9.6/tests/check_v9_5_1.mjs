import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildProjectSearchTextV9_2,
  projectMatchesV9_2,
  summariseProjectsV9_2,
  tokeniseSearchV9_2,
} from "../scripts/core/project-filter-v9-2.js";
import { atlasUrlV9_5_1, compareProjectUpdatesV9_5_1 } from "../scripts/plugins/projects-v9-5-1.js";

const base = new URL("../", import.meta.url);
const root = new URL("../../../", import.meta.url);
const rootPath = fileURLToPath(root);
const readText = (path) => readFile(new URL(path, base), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const gitBlob = (path) => execFileSync("git", ["-C", rootPath, "hash-object", path], { encoding: "utf8" }).trim();
const gitTree = (revisionPath) => execFileSync("git", ["-C", rootPath, "rev-parse", revisionPath], { encoding: "utf8" }).trim();

const contract = await readJson("contracts/release.v9.5.1.json");
const parentContract = await readJson("contracts/release.v9.5.json");
const dataContract = await readJson("contracts/release.v9.1.json");
const releaseManifest = await readJson("data/v9_manifest.json");
const payload = await readJson("data/v9.1/build_manifest.json");
const projectParts = await Promise.all(payload.project_partitions.map(({ path }) => readJson(path)));
const projects = projectParts.flatMap((part) => part.projects);
const news = JSON.parse(await readFile(new URL("dist/major_project_news_v9_5_1.json", root), "utf8"));

assert.equal(contract.release, "9.5.1");
assert.equal(contract.frozen_parent.release, "9.5");
assert.equal(contract.frozen_parent.commit, "3acd56386d0bf2952f8f26754d615d20a7345e35");
assert.equal(contract.frozen_parent.subtree, "457d060161c0edaf9a55cc633ee884ebca5fbe43");
assert.equal(contract.frozen_parent.tree_listing_sha256, "ddb147828316c7fba73cd7af4c7bb5c63280fb77b5410a66483b9618d460e15e");
assert.equal(contract.frozen_parent.must_remain_unchanged, true);
assert.equal(gitTree("HEAD:uk_renewables_pipeline/v9.5"), contract.frozen_parent.subtree, "V9.5 subtree changed while building V9.5.1");
assert.equal(gitTree("HEAD:uk_renewables_pipeline/v9.4"), contract.frozen_v9_4.subtree, "V9.4 subtree changed while building V9.5.1");
assert.equal(contract.data_parent.release, "9.1");
assert.equal(contract.data_parent.data_changed, false);
assert.equal(parentContract.release, "9.5");
assert.equal(dataContract.release, "9.1");
assert.equal(releaseManifest.version, "9.5.1");
assert.ok(["CANDIDATE", "LIVE_VALIDATED"].includes(releaseManifest.status));
assert.equal(releaseManifest.frozen_v9_5_commit, contract.frozen_parent.commit);
assert.equal(releaseManifest.frozen_v9_5_subtree, contract.frozen_parent.subtree);
assert.equal(contract.ui_contract.first_click, "updated_desc");
assert.equal(contract.ui_contract.second_click, "updated_asc");
assert.equal(contract.ui_contract.aria_sort_default, "none");
assert.equal(contract.ui_contract.aria_sort_newest, "descending");
assert.equal(contract.ui_contract.aria_sort_oldest, "ascending");
assert.equal(contract.ui_contract.project_table_columns, 11);
assert.equal(contract.news_contract.all_headline_count, 133);
assert.equal(contract.news_contract.relevant_headline_count, 45);
assert.equal(contract.news_contract.v9_4_baseline_headline_count, 125);
assert.equal(contract.news_contract.relevant_filter_is_functional, true);
assert.equal(contract.news_contract.discovery_only_drives_project_signal, false);
assert.equal(contract.news_contract.beacon_fen.repd_ref, "13599");
assert.equal(contract.news_contract.beacon_fen.official_capacity_mw, 400);

const frozenV92Blobs = {
  "uk_renewables_pipeline/v9/scripts/core/project-filter-v9-2.js": "dceee01d0f51e85b071aef275250c1fb223eeba7",
  "uk_renewables_pipeline/v9/scripts/core/news-relevance-v9-2.js": "f8374bfd6f0c47e98ca1e7f2f3312c9281a34e8a",
  "uk_renewables_pipeline/v9/scripts/data/canonical-projects-v9-2.js": "e3d9b7bb0f39b813cf3b1f125467efbd6a021dda",
  "uk_renewables_pipeline/v9/scripts/plugins/gauges-v9-2.js": "1d081d2d9e1630912b912953cf18f431754f9e19",
  "uk_renewables_pipeline/v9/scripts/plugins/newspaper-v9-2.js": "6c72de9e9bd8f41bf525a32ca2436e53ddb466b0",
  "uk_renewables_pipeline/v9/scripts/plugins/projects-v9-2.js": "0e222ea75e9db8dc3e9f1e829a15ac3ee1ca0acf",
  "uk_renewables_pipeline/v9/styles/v9-2.css": "f4ac1a09145b0f4824e333ac2acbc767d84f2da6",
};
for (const [path, expected] of Object.entries(frozenV92Blobs)) {
  assert.equal(gitBlob(path), expected, `${path} changed after the frozen V9.2 checkpoint`);
}

assert.equal(payload.project_count, 7680);
assert.equal(payload.capacity_mw, 356474.09);
assert.equal(payload.largest_mw, 4100);
assert.equal(payload.geometry_count, 7652);
assert.equal(payload.missing_geometry_count, 28);
assert.equal(payload.solar_count, 3563);
assert.equal(payload.bess_count, 1609);
assert.equal(payload.wind_onshore_count, 2399);
assert.equal(payload.wind_offshore_count, 109);
assert.equal(projects.length, 7680);
assert.equal(new Set(projects.map((project) => project.repd_ref)).size, 7680);
assert.ok(projects.every((project) => project.capacity_mw >= 1));
assert.deepEqual(summariseProjectsV9_2(projects), { count: 7680, capacity_mw: 356474.09, largest_mw: 4100 });

const datedProjects = projects.filter((project) => project.repd_record_updated);
const undatedProjects = projects.filter((project) => !project.repd_record_updated);
assert.ok(datedProjects.length > 1);
assert.ok(datedProjects.every((project) => /^\d{4}-\d{2}-\d{2}$/.test(project.repd_record_updated)));
const newestFirst = [...projects].sort((left, right) => compareProjectUpdatesV9_5_1(left, right, "desc"));
const oldestFirst = [...projects].sort((left, right) => compareProjectUpdatesV9_5_1(left, right, "asc"));
assert.ok(newestFirst[0].repd_record_updated >= newestFirst[1].repd_record_updated);
assert.ok(oldestFirst[0].repd_record_updated <= oldestFirst[1].repd_record_updated);
if (undatedProjects.length) {
  assert.equal(newestFirst.at(-1).repd_record_updated, null);
  assert.equal(oldestFirst.at(-1).repd_record_updated, null);
}

const berwick = projects.find((project) => project.repd_ref === "9873");
assert.ok(berwick);
const searchText = buildProjectSearchTextV9_2(berwick);
assert.equal(projectMatchesV9_2(berwick, {
  technology: "wind_offshore",
  status: "All",
  county: "All",
  tokens: tokeniseSearchV9_2("GG2050-REPD-9873 Berwick"),
}, searchText), true);
assert.equal(projectMatchesV9_2(berwick, {
  technology: "solar",
  status: "All",
  county: "All",
  tokens: [],
}, searchText), false);

const validAtlas = new URL(atlasUrlV9_5_1(berwick));
assert.equal(validAtlas.searchParams.get("repd_ref"), "9873");
assert.equal(validAtlas.searchParams.get("technology"), "wind_offshore");
const missingGeometry = projects.find((project) => project.geometry_status !== "valid");
assert.ok(missingGeometry);
assert.equal(atlasUrlV9_5_1(missingGeometry), "");

assert.equal(news.schema, "globalgrid2050.major-project-news.v9.5.1");
assert.equal(news.all_headline_count, news.all_items.length);
assert.equal(news.relevant_headline_count, news.canonical_items.length);
assert.equal(news.all_items.length, 133);
assert.equal(news.canonical_items.length, 45);
assert.equal(news.v9_4_baseline_headline_count, 125);
assert.ok(news.canonical_items.every((item) => item.role === "PRIMARY_MATCH"));
assert.ok(news.canonical_items.every((item) => item.eligible_for_news_signal === true));
assert.ok(news.canonical_items.every((item) => item.gg_project_id === `GG2050-REPD-${item.repd_ref}`));
assert.equal(news.all_items.filter((item) => item.canonical_relevant).length, 45);
const beacon = news.canonical_items.find((item) => item.headline === "Beacon Fen Energy Park development consent decision announced");
assert.ok(beacon);
assert.equal(beacon.repd_ref, "13599");
assert.equal(beacon.capacity_mw, 400);
assert.equal(beacon.operator, "Low Carbon Limited");
const brecks = news.canonical_items.filter((item) => item.repd_ref === "10087");
assert.ok(brecks.length > 0);
assert.ok(brecks.every((item) => item.gg_development_id));

const html = await readText("index.html");
const mobileCss = await readText("styles/mobile.css");
const additiveCss = await readText("styles/v9-3.css");
const parentAdditiveCss = await readText("styles/v9-2.css");
const headerCss = await readText("styles/v9-4.css");
const responsiveCss = await readText("styles/v9-5-1.css");
const frozenParentCss = await readFile(new URL("uk_renewables_pipeline/v9/styles/v9-3.css", root), "utf8");
const projectsV95 = await readText("scripts/plugins/projects-v9-5-1.js");
const newspaperV95 = await readText("scripts/plugins/newspaper-v9-5-1.js");
const app = await readText("scripts/app-v9-5-1.js");
const rootIndex = await readFile(new URL("index.html", root), "utf8");
const packageJson = await readJson("package.json");

assert.match(html, /UK RENEWABLES PIPELINE V9\.5\.1/);
assert.match(html, />V9\.5\.1 (?:CANDIDATE|LIVE)</);
assert.match(html, /V9\.5 FROZEN APP/);
assert.match(html, /V9\.4 FROZEN APP/);
const styleOrder = [
  html.indexOf("styles/v7.css?v=9.5.1"),
  html.indexOf("styles/mobile.css?v=9.5.1"),
  html.indexOf("styles/v9-3.css?v=9.5.1"),
  html.indexOf("styles/v9-4.css?v=9.5.1"),
  html.indexOf("styles/v9-5-1.css?v=9.5.1"),
];
assert.ok(styleOrder.every((value) => value >= 0));
assert.ok(styleOrder.every((value, index) => index === 0 || value > styleOrder[index - 1]));
assert.equal((html.match(/<canvas id="g[1-3]"/g) || []).length, 3);
assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 11);
assert.match(html, /<th class="hide-mobile">REPD REF<\/th>/);
assert.match(html, /<th class="hide-mobile">GLOBALGRID REF<\/th>/);
assert.match(html, /id="repdUpdatedHeader" aria-sort="none"/);
assert.match(html, /id="sortUpdated"/);
assert.match(html, /id="updatedSortIndicator"[^>]*>↕<\/span>/);
assert.match(html, /id="sortProjects"/);
assert.match(html, /value="updated_desc"/);
assert.match(html, /value="updated_asc"/);
assert.match(html, /scripts\/app-v9-5-1\.js\?v=9\.5\.1/);

assert.equal(sha256(mobileCss), "9855b9c11255a85f477873d07cca45b057aedcdc8a6cc4aab2d29a0ffaac9b85");
assert.equal(additiveCss, frozenParentCss, "V9.4 changed its inherited V9.3.1 stylesheet copy");
const parentCssPrefix = parentAdditiveCss.trimEnd();
assert.ok(additiveCss.startsWith(parentCssPrefix), "V9.3 additive CSS no longer preserves the complete V9.2 prefix");
assert.match(headerCss, /\.repd-updated-heading button/);
assert.match(headerCss, /#updatedSortIndicator/);
assert.match(headerCss, /focus-visible/);
assert.match(responsiveCss, /@media\s*\(min-width:\s*921px\)\s*and\s*\(max-width:\s*1100px\)/);
assert.match(responsiveCss, /\.header\s*\{[^}]*flex-direction:\s*column[^}]*\}/s);
assert.match(responsiveCss, /\.status\s*\{[^}]*width:\s*100%[^}]*white-space:\s*normal[^}]*\}/s);

assert.match(app, /gauges-v9-2\.js/);
assert.match(app, /projects-v9-5-1\.js/);
assert.match(app, /newspaper-v9-5-1\.js/);
assert.match(projectsV95, /globalgrid2050_uk_renewables_pipeline_v9_5_1_/);
assert.match(projectsV95, /compareProjectUpdatesV9_5_1/);
assert.match(projectsV95, /function updateSortHeader\(\)/);
assert.match(projectsV95, /sortMode === "updated_desc" \? "updated_asc" : "updated_desc"/);
assert.match(projectsV95, /document\.getElementById\("sortUpdated"\)\.onclick/);
assert.match(projectsV95, /header\.setAttribute\("aria-sort", "descending"\)/);
assert.match(projectsV95, /header\.setAttribute\("aria-sort", "ascending"\)/);
assert.match(newspaperV95, /item\.role === "PRIMARY_MATCH"/);
assert.match(newspaperV95, /newsIndex\.get\(String\(project\.repd_ref\)\)/);
assert.match(newspaperV95, /major_project_news_v9_5_1\.json/);
assert.match(newspaperV95, /state\.newsMode === "RELEVANT" && item\.canonical_relevant !== true/);
assert.match(newspaperV95, /payload\.v9_4_baseline_headline_count === 125/);
assert.doesNotMatch(newspaperV95, /normaliseProject\(project\.name\)/);

assert.match(rootIndex, /UK Renewables Pipeline V9\.3\.1/);
assert.match(rootIndex, /UK Renewables Pipeline V9\.4/);
assert.match(rootIndex, /UK Renewables Pipeline V9\.5/);
assert.match(rootIndex, /UK Renewables Pipeline V9\.5\.1/);
assert.equal(packageJson.version, "9.5.1");
assert.equal(packageJson.scripts.validate, "bash tests/run_v9_5_1.sh");
assert.equal(packageJson.scripts["validate:browser"], "V9_BROWSER_SMOKE=1 bash tests/run_v9_5_1.sh");

console.log("V9.5.1: PASS (133 ALL, 45 RELEVANT, Beacon Fen REPD 13599; V9.5/V9.4 frozen)");
