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
import { assessNewsItemV9_2 } from "../scripts/core/news-relevance-v9-2.js";
import { atlasUrlV9_4, compareProjectUpdatesV9_4 } from "../scripts/plugins/projects-v9-4.js";

const base = new URL("../", import.meta.url);
const root = new URL("../../../", import.meta.url);
const rootPath = fileURLToPath(root);
const readText = (path) => readFile(new URL(path, base), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const gitBlob = (path) => execFileSync("git", ["-C", rootPath, "hash-object", path], { encoding: "utf8" }).trim();
const gitTree = (revisionPath) => execFileSync("git", ["-C", rootPath, "rev-parse", revisionPath], { encoding: "utf8" }).trim();

const contract = await readJson("contracts/release.v9.4.json");
const parentContract = await readJson("contracts/release.v9.3.json");
const dataContract = await readJson("contracts/release.v9.1.json");
const releaseManifest = await readJson("data/v9_manifest.json");
const payload = await readJson("data/v9.1/build_manifest.json");
const projectParts = await Promise.all(payload.project_partitions.map(({ path }) => readJson(path)));
const projects = projectParts.flatMap((part) => part.projects);
const news = JSON.parse(await readFile(new URL("dist/major_project_news_v5.json", root), "utf8"));

assert.equal(contract.release, "9.4");
assert.equal(contract.frozen_parent.release, "9.3.1");
assert.equal(contract.frozen_parent.commit, "9e0c51281fc816691a75e4255483a0851122481e");
assert.equal(contract.frozen_parent.subtree, "d9a508845b4e3b717bfb8cb33f244f7507d4d581");
assert.equal(contract.frozen_parent.tree_listing_sha256, "fe3d611555c7d9f19c64fa30105dfecb4ba68e649cd55d6424219b7081d07951");
assert.equal(contract.frozen_parent.must_remain_unchanged, true);
assert.equal(gitTree("HEAD:uk_renewables_pipeline/v9"), contract.frozen_parent.subtree, "V9.3.1 subtree changed while building V9.4");
assert.equal(contract.data_parent.release, "9.1");
assert.equal(contract.data_parent.data_changed, false);
assert.equal(parentContract.release, "9.3");
assert.equal(dataContract.release, "9.1");
assert.equal(releaseManifest.version, "9.4");
assert.ok(["CANDIDATE", "LIVE_VALIDATED"].includes(releaseManifest.status));
assert.equal(releaseManifest.frozen_v9_3_1_commit, contract.frozen_parent.commit);
assert.equal(releaseManifest.frozen_v9_3_1_subtree, contract.frozen_parent.subtree);
assert.equal(contract.ui_contract.first_click, "updated_desc");
assert.equal(contract.ui_contract.second_click, "updated_asc");
assert.equal(contract.ui_contract.aria_sort_default, "none");
assert.equal(contract.ui_contract.aria_sort_newest, "descending");
assert.equal(contract.ui_contract.aria_sort_oldest, "ascending");
assert.equal(contract.ui_contract.project_table_columns, 11);

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
const newestFirst = [...projects].sort((left, right) => compareProjectUpdatesV9_4(left, right, "desc"));
const oldestFirst = [...projects].sort((left, right) => compareProjectUpdatesV9_4(left, right, "asc"));
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

const validAtlas = new URL(atlasUrlV9_4(berwick));
assert.equal(validAtlas.searchParams.get("repd_ref"), "9873");
assert.equal(validAtlas.searchParams.get("technology"), "wind_offshore");
const missingGeometry = projects.find((project) => project.geometry_status !== "valid");
assert.ok(missingGeometry);
assert.equal(atlasUrlV9_4(missingGeometry), "");

const beacon = news.items.find((item) => /Beacon Fen Energy Park development consent decision announced/i.test(item.headline));
const grange = news.items.find((item) => /The Grange celebrates Forest Healthcare/i.test(item.headline));
const wilton = news.items.find((item) => /New Jersey Board of Public Utilities/i.test(item.headline));
const stonestreet = news.items.find((item) => /Evolution Mining/i.test(item.headline));
assert.ok(beacon && grange && wilton && stonestreet);
assert.equal(assessNewsItemV9_2(beacon).strong, true);
assert.equal(assessNewsItemV9_2(grange).strong, false);
assert.equal(assessNewsItemV9_2(wilton).strong, false);
assert.equal(assessNewsItemV9_2(stonestreet).strong, false);

const html = await readText("index.html");
const mobileCss = await readText("styles/mobile.css");
const additiveCss = await readText("styles/v9-3.css");
const parentAdditiveCss = await readText("styles/v9-2.css");
const headerCss = await readText("styles/v9-4.css");
const frozenParentCss = await readFile(new URL("uk_renewables_pipeline/v9/styles/v9-3.css", root), "utf8");
const projectsV94 = await readText("scripts/plugins/projects-v9-4.js");
const app = await readText("scripts/app-v9-4.js");
const rootIndex = await readFile(new URL("index.html", root), "utf8");
const packageJson = await readJson("package.json");

assert.match(html, /UK RENEWABLES PIPELINE V9\.4/);
assert.match(html, />V9\.4 (?:CANDIDATE|LIVE)</);
assert.match(html, /V9\.3\.1 FROZEN APP/);
const styleOrder = [
  html.indexOf("styles/v7.css?v=9.4"),
  html.indexOf("styles/mobile.css?v=9.4"),
  html.indexOf("styles/v9-3.css?v=9.4"),
  html.indexOf("styles/v9-4.css?v=9.4"),
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
assert.match(html, /scripts\/app-v9-4\.js\?v=9\.4/);

assert.equal(sha256(mobileCss), "9855b9c11255a85f477873d07cca45b057aedcdc8a6cc4aab2d29a0ffaac9b85");
assert.equal(additiveCss, frozenParentCss, "V9.4 changed its inherited V9.3.1 stylesheet copy");
const parentCssPrefix = parentAdditiveCss.trimEnd();
assert.ok(additiveCss.startsWith(parentCssPrefix), "V9.3 additive CSS no longer preserves the complete V9.2 prefix");
assert.match(headerCss, /\.repd-updated-heading button/);
assert.match(headerCss, /#updatedSortIndicator/);
assert.match(headerCss, /focus-visible/);

assert.match(app, /gauges-v9-2\.js/);
assert.match(app, /newspaper-v9-2\.js/);
assert.match(app, /projects-v9-4\.js/);
assert.match(projectsV94, /globalgrid2050_uk_renewables_pipeline_v9_4_/);
assert.match(projectsV94, /compareProjectUpdatesV9_4/);
assert.match(projectsV94, /function updateSortHeader\(\)/);
assert.match(projectsV94, /sortMode === "updated_desc" \? "updated_asc" : "updated_desc"/);
assert.match(projectsV94, /document\.getElementById\("sortUpdated"\)\.onclick/);
assert.match(projectsV94, /header\.setAttribute\("aria-sort", "descending"\)/);
assert.match(projectsV94, /header\.setAttribute\("aria-sort", "ascending"\)/);

assert.match(rootIndex, /UK Renewables Pipeline V9\.3\.1/);
assert.match(rootIndex, /UK Renewables Pipeline V9\.4/);
assert.equal(packageJson.version, "9.4.0");
assert.equal(packageJson.scripts.validate, "bash tests/run_v9_4.sh");
assert.equal(packageJson.scripts["validate:browser"], "V9_BROWSER_SMOKE=1 bash tests/run_v9_4.sh");

console.log("V9.4: PASS (clickable REPD UPDATED header; V9.3.1 subtree frozen; 7,680-record data retained)");
