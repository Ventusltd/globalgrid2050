import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  capacityRangeLabelV9_6,
  capacityRangeV9_6,
  parseCapacityBoundV9_6,
  projectMatchesOfficialCapacityV9_6,
} from "../scripts/core/project-filter-v9-6.js";
import { atlasUrlV9_6, compareProjectUpdatesV9_6 } from "../scripts/plugins/projects-v9-6.js";

const base = new URL("../", import.meta.url);
const root = new URL("../../../", import.meta.url);
const rootPath = fileURLToPath(root);
const readText = (path) => readFile(new URL(path, base), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const gitTree = (revisionPath) => execFileSync("git", ["-C", rootPath, "rev-parse", revisionPath], { encoding: "utf8" }).trim();
const gitListingHash = (path) => sha256(execFileSync("git", ["-C", rootPath, "ls-tree", "-r", "HEAD", path], { encoding: "utf8" }));

const contract = await readJson("contracts/release.v9.6.json");
const parentContract = await readFile(new URL("uk_renewables_pipeline/v9.5.1/contracts/release.v9.5.1.json", root), "utf8").then(JSON.parse);
const releaseManifest = await readJson("data/v9_manifest.json");
const payload = await readJson("data/v9.1/build_manifest.json");
const projectParts = await Promise.all(payload.project_partitions.map(({ path }) => readJson(path)));
const projects = projectParts.flatMap((part) => part.projects);
const news = JSON.parse(await readFile(new URL("dist/major_project_news_v9_5_1.json", root), "utf8"));

assert.equal(contract.release, "9.6");
assert.ok(["CANDIDATE", "LIVE_VALIDATED"].includes(contract.status));
assert.equal(contract.frozen_parent.release, "9.5.1");
assert.equal(contract.frozen_parent.commit, "8b2432be75f224562fc1c416dbcc3319e31a47a8");
assert.equal(contract.frozen_parent.subtree, "6288b9d8196adce57207b549c555c9bcee42587a");
assert.equal(contract.frozen_parent.tree_listing_sha256, "b6197b79601daab1ee3b1d33fb9356c6c56ec02c69f51be73298be34095d5fe8");
assert.equal(gitTree("HEAD:uk_renewables_pipeline/v9.5.1"), contract.frozen_parent.subtree, "frozen V9.5.1 subtree changed");
assert.equal(gitListingHash("uk_renewables_pipeline/v9.5.1"), contract.frozen_parent.tree_listing_sha256, "frozen V9.5.1 listing changed");
assert.equal(parentContract.status, "LIVE_VALIDATED");
assert.equal(releaseManifest.version, "9.6");
assert.ok(["CANDIDATE", "LIVE_VALIDATED"].includes(releaseManifest.status));
assert.equal(releaseManifest.frozen_v9_5_1_commit, contract.frozen_parent.commit);
assert.equal(releaseManifest.frozen_v9_5_1_subtree, contract.frozen_parent.subtree);
assert.equal(releaseManifest.data_changed, false);
assert.equal(contract.ui_contract.mobile_project_batch, 50);
assert.equal(contract.ui_contract.mobile_news_batch, 20);
assert.equal(contract.ui_contract.minimum_touch_target_px, 44);
assert.equal(contract.ui_contract.capacity_filter_minimum_inclusive, true);
assert.equal(contract.ui_contract.capacity_filter_maximum_inclusive, true);
assert.equal(contract.ui_contract.all_projects_loaded_searchable_sortable_exportable, true);
assert.deepEqual(contract.ui_contract.capacity_filter_sentinel, {
  minimum_mw: 100,
  maximum_mw: 500,
  matching_projects: 476,
  matching_capacity_mw: 106714.5,
  largest_matching_project_mw: 500,
});

assert.equal(payload.project_count, 7680);
assert.equal(payload.capacity_mw, 356474.09);
assert.equal(payload.largest_mw, 4100);
assert.equal(projects.length, 7680);
assert.equal(new Set(projects.map((project) => project.repd_ref)).size, 7680);

assert.equal(parseCapacityBoundV9_6(""), null);
assert.equal(parseCapacityBoundV9_6("100.5"), 100.5);
assert.ok(Number.isNaN(parseCapacityBoundV9_6("-1")));
const allRange = capacityRangeV9_6("", "");
const boundedRange = capacityRangeV9_6("100", "500");
const exactRange = capacityRangeV9_6("400", "400");
assert.deepEqual(allRange, { minMW: null, maxMW: null, valid: true, reason: "" });
assert.deepEqual(boundedRange, { minMW: 100, maxMW: 500, valid: true, reason: "" });
assert.equal(capacityRangeV9_6("500", "100").valid, false);
assert.equal(capacityRangeLabelV9_6(boundedRange), "100–500 MW inclusive");
assert.equal(projectMatchesOfficialCapacityV9_6({ capacity_mw: 100 }, boundedRange), true);
assert.equal(projectMatchesOfficialCapacityV9_6({ capacity_mw: 500 }, boundedRange), true);
assert.equal(projectMatchesOfficialCapacityV9_6({ capacity_mw: 99.99 }, boundedRange), false);
assert.equal(projectMatchesOfficialCapacityV9_6({ capacity_mw: 500.01 }, boundedRange), false);

const boundedProjects = projects.filter((project) => projectMatchesOfficialCapacityV9_6(project, boundedRange));
assert.equal(boundedProjects.length, 476);
assert.equal(Number(boundedProjects.reduce((sum, project) => sum + project.capacity_mw, 0).toFixed(2)), 106714.5);
assert.equal(Math.max(...boundedProjects.map((project) => project.capacity_mw)), 500);
assert.equal(projects.filter((project) => projectMatchesOfficialCapacityV9_6(project, exactRange)).length, 37);

const datedProjects = projects.filter((project) => project.repd_record_updated);
const newestFirst = [...projects].sort((left, right) => compareProjectUpdatesV9_6(left, right, "desc"));
const oldestFirst = [...projects].sort((left, right) => compareProjectUpdatesV9_6(left, right, "asc"));
assert.ok(datedProjects.length > 1);
assert.ok(newestFirst[0].repd_record_updated >= newestFirst[1].repd_record_updated);
assert.ok(oldestFirst[0].repd_record_updated <= oldestFirst[1].repd_record_updated);
const berwick = projects.find((project) => project.repd_ref === "9873");
assert.equal(new URL(atlasUrlV9_6(berwick)).searchParams.get("repd_ref"), "9873");

assert.equal(news.all_items.length, 133);
assert.equal(news.canonical_items.length, 45);
const beacon = news.canonical_items.find((item) => item.headline === "Beacon Fen Energy Park development consent decision announced");
assert.equal(beacon.repd_ref, "13599");
assert.equal(beacon.capacity_mw, 400);
assert.equal(beacon.operator, "Low Carbon Limited");

const html = await readText("index.html");
const css = await readText("styles/v9-6.css");
const projectsPlugin = await readText("scripts/plugins/projects-v9-6.js");
const newspaperPlugin = await readText("scripts/plugins/newspaper-v9-6.js");
const app = await readText("scripts/app-v9-6.js");
const rootIndex = await readFile(new URL("index.html", root), "utf8");
const packageJson = await readJson("package.json");

assert.match(html, /UK RENEWABLES PIPELINE V9\.6/);
assert.match(html, />V9\.6 (?:CANDIDATE|LIVE)</);
assert.match(html, /V9\.5\.1 FROZEN APP/);
assert.match(html, /id="minCapacity"[^>]*type="number"[^>]*inputmode="decimal"/);
assert.match(html, /id="maxCapacity"[^>]*type="number"[^>]*inputmode="decimal"/);
assert.match(html, /id="loadMoreProjects"/);
assert.match(html, /id="loadMoreNews"/);
assert.match(html, /id="mobileSortUpdated"/);
assert.match(html, /id="exportMobile"/);
assert.match(html, /styles\/v9-6\.css\?v=9\.6/);
assert.match(html, /scripts\/app-v9-6\.js\?v=9\.6/);
assert.match(css, /\.tablewrap table\s*\{[^}]*min-width:\s*0/s);
assert.match(css, /\.tablewrap tr\s*\{[^}]*display:\s*grid/s);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
assert.match(projectsPlugin, /filtered\.slice\(0, visibleLimit\)/);
assert.match(projectsPlugin, /state\.filtered = filtered/);
assert.match(projectsPlugin, /MOBILE_PROJECT_BATCH = 50/);
assert.match(projectsPlugin, /min_mw/);
assert.match(projectsPlugin, /max_mw/);
assert.match(projectsPlugin, /globalgrid2050_uk_renewables_pipeline_v9_6_/);
assert.match(newspaperPlugin, /rows\.slice\(0, visibleLimit\)/);
assert.match(newspaperPlugin, /MOBILE_NEWS_BATCH = 20/);
assert.match(newspaperPlugin, /state\.newsItems\.filter\(newsMatches\)/);
assert.match(app, /projects-v9-6\.js/);
assert.match(app, /newspaper-v9-6\.js/);
assert.match(rootIndex, /UK Renewables Pipeline V9\.5\.1/);
assert.match(rootIndex, /UK Renewables Pipeline V9\.6/);
assert.equal(packageJson.version, "9.6.0");
assert.equal(packageJson.scripts.validate, "bash tests/run_v9_6.sh");

console.log("V9.6: PASS (V9.5.1 frozen; 7,680 loaded; 100–500 MW = 476; mobile 50/20 batches)");
