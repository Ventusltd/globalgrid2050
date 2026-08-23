import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  capacityRangeV9_6,
  projectMatchesOfficialCapacityV9_6,
} from "../scripts/core/project-filter-v9-6.js";

const base = new URL("../", import.meta.url);
const root = new URL("../../../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("data/v9.1/build_manifest.json", base), "utf8"));
const parts = await Promise.all(manifest.project_partitions.map(({ path }) =>
  readFile(new URL(path, base), "utf8").then(JSON.parse)));
const projects = parts.flatMap((part) => part.projects);
const news = JSON.parse(await readFile(new URL("dist/major_project_news_v9_5_1.json", root), "utf8"));
const html = await readFile(new URL("index.html", base), "utf8");
const css = await readFile(new URL("styles/v9-6.css", base), "utf8");
const app = await readFile(new URL("scripts/app-v9-6.js", base), "utf8");

assert.equal(projects.length, 7680);
assert.equal(manifest.capacity_mw, 356474.09);
assert.equal(news.all_items.length, 133);
assert.equal(news.canonical_items.length, 45);
const beacon = news.canonical_items.find((item) => item.headline === "Beacon Fen Energy Park development consent decision announced");
assert.equal(beacon.repd_ref, "13599");
assert.equal(beacon.operator, "Low Carbon Limited");
assert.equal(beacon.capacity_mw, 400);

const range = capacityRangeV9_6("100", "500");
const matching = projects.filter((project) => projectMatchesOfficialCapacityV9_6(project, range));
assert.equal(matching.length, 476);
assert.equal(Number(matching.reduce((sum, project) => sum + project.capacity_mw, 0).toFixed(2)), 106714.5);
assert.equal(Math.max(...matching.map((project) => project.capacity_mw)), 500);

assert.match(html, /UK RENEWABLES PIPELINE V9\.6/);
assert.match(html, /CLEAN REBUILD FROM V9\.5\.1/);
assert.match(html, /id="minCapacity"/);
assert.match(html, /id="maxCapacity"/);
assert.match(html, /scripts\/app-v9-6\.js\?v=9\.6-clean/);
assert.match(app, /newspaper-v9-5-1\.js/);
assert.match(app, /projects-v9-6\.js/);
assert.match(css, /\.tablewrap table\s*\{ min-width: 1850px; \}/);
assert.match(css, /\.tablewrap \.hide-mobile\s*\{ display: table-cell; \}/);
assert.doesNotMatch(css, /display:\s*grid[^}]*grid-template-areas/s);

console.log("V9.6 clean rebuild: PASS (V9.5.1 baseline, 7,680 projects, 133/45 news, 476 capacity sentinel)");
