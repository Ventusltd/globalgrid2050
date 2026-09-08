import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildProjectSearchTextV9_2,
  projectMatchesV9_2,
  summariseProjectsV9_2,
  tokeniseSearchV9_2,
} from "../scripts/core/project-filter-v9-2.js";
import { assessNewsItemV9_2 } from "../scripts/core/news-relevance-v9-2.js";
import { atlasUrlV9_2 } from "../scripts/plugins/projects-v9-2.js";

const base = new URL("../", import.meta.url);
const root = new URL("../../../", import.meta.url);
const readText = (path) => readFile(new URL(path, base), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

const contract = await readJson("contracts/release.v9.2.json");
const dataContract = await readJson("contracts/release.v9.1.json");
const payload = await readJson("data/v9.1/build_manifest.json");
const projectParts = await Promise.all(payload.project_partitions.map(({ path }) => readJson(path)));
const projects = projectParts.flatMap((part) => part.projects);
const news = JSON.parse(await readFile(new URL("dist/major_project_news_v5.json", root), "utf8"));

assert.equal(contract.release, "9.2");
assert.equal(contract.frozen_parent.commit, "59f74e319fbaad62abdb995107dba5759d7f3ca2");
assert.equal(contract.frozen_parent.tree, "e9dc244b74d9c983e4557a23bd2b745c1daeb105");
assert.equal(contract.data_parent.release, "9.1");
assert.equal(contract.data_parent.data_changed, false);
assert.equal(dataContract.release, "9.1");
assert.equal(payload.project_count, 7680);
assert.equal(payload.capacity_mw, 356474.09);
assert.equal(payload.largest_mw, 4100);
assert.equal(payload.missing_geometry_count, 28);
assert.equal(projects.length, 7680);
assert.equal(new Set(projects.map((project) => project.repd_ref)).size, 7680);
assert.ok(projects.every((project) => project.capacity_mw >= 1));
assert.deepEqual(summariseProjectsV9_2(projects), { count: 7680, capacity_mw: 356474.09, largest_mw: 4100 });

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

const validAtlas = new URL(atlasUrlV9_2(berwick));
assert.equal(validAtlas.searchParams.get("repd_ref"), "9873");
assert.equal(validAtlas.searchParams.get("technology"), "wind_offshore");
const missingGeometry = projects.find((project) => project.geometry_status !== "valid");
assert.ok(missingGeometry);
assert.equal(atlasUrlV9_2(missingGeometry), "");

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
const additiveCss = await readText("styles/v9-2.css");
const projectsPlugin = await readText("scripts/plugins/projects-v9-2.js");
const newsPlugin = await readText("scripts/plugins/newspaper-v9-2.js");
const app = await readText("scripts/app.js");
const rootIndex = await readFile(new URL("index.html", root), "utf8");
const packageJson = await readJson("package.json");

assert.match(html, /UK RENEWABLES PIPELINE V9\.2/);
assert.match(html, /styles\/v7\.css\?v=9\.2/);
assert.match(html, /styles\/v9-2\.css\?v=9\.2/);
assert.doesNotMatch(html, /styles\/mobile\.css/);
assert.doesNotMatch(html, /styles\/v8\.css/);
assert.equal((html.match(/<canvas id="g[1-3]"/g) || []).length, 3);
assert.doesNotMatch(html, /id="g4"/);
assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 8);
assert.match(html, /data-technology="all"[^>]*aria-pressed="true"/);
assert.match(html, /data-official-status="All"[^>]*aria-pressed="true"/);
assert.match(html, /data-news="RELEVANT"/);
assert.match(html, /id="clearFilters"/);
assert.match(html, /id="resultsMeta"/);
assert.doesNotMatch(additiveCss, /\.gauges\s*\{/);
assert.doesNotMatch(additiveCss, /min-width:\s*1850px/);
assert.match(app, /gauges-v9-2\.js/);
assert.match(app, /newspaper-v9-2\.js/);
assert.match(app, /projects-v9-2\.js/);
assert.match(projectsPlugin, /filtered\.map/);
assert.doesNotMatch(projectsPlugin, /filtered\.length\s*\?\s*filtered\s*:\s*all/);
assert.match(projectsPlugin, /geometry_status !== "valid"/);
assert.match(newsPlugin, /relevance gate/);
assert.match(rootIndex, /V9\.2 LIVE/);
assert.equal(packageJson.version, "9.2.0");
assert.equal(packageJson.scripts.validate, "bash tests/run_v9_2.sh");

console.log("V9.2: PASS (V5 UI/mobile restored; full 7,680-record V9 pipeline and features retained)");
