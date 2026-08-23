import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL("../", import.meta.url);
const root = new URL("../../../", import.meta.url);
const readText = (path) => readFile(new URL(path, base), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

const contract = await readJson("contracts/release.v9.1.json");
const payload = await readJson("data/v9.1/build_manifest.json");
const projectParts = await Promise.all(payload.project_partitions.map(({ path }) => readJson(path.replace(/^data\/v9\.1\//, "data/v9.1/"))));
const projects = projectParts.flatMap((part) => part.projects);
const atlasParts = await Promise.all(payload.atlas_partitions.map(({ path }) => readJson(path.replace(/^data\/v9\.1\//, "data/v9.1/"))));
const legacy = await readJson("fixtures/v5/repd_master.json");

assert.equal(contract.release, "9.1");
assert.equal(contract.frozen_parent.commit, "50a6df6c4bd54ff4c113aaf0df4f230b7c9544d2");
assert.equal(contract.frozen_parent.tree, "60b72b3665e6b65a397541b221c4bca75aa402c9");
assert.equal(payload.schema, "globalgrid2050.v9.project-spine-build.v9.1");
assert.equal(payload.project_count, 7680);
assert.equal(payload.capacity_mw, 356474.09);
assert.equal(payload.largest_mw, 4100);
assert.equal(payload.solar_count, 3563);
assert.equal(payload.bess_count, 1609);
assert.equal(payload.wind_onshore_count, 2399);
assert.equal(payload.wind_offshore_count, 109);
assert.equal(projects.length, 7680);
assert.equal(new Set(projects.map((project) => project.repd_ref)).size, 7680);
assert.equal(new Set(projects.map((project) => project.gg_project_id)).size, 7680);
assert.ok(projects.every((project) => project.capacity_mw >= 1));
assert.ok(projects.every((project) => ["solar", "bess", "wind_onshore", "wind_offshore"].includes(project.technology)));
assert.equal(atlasParts.reduce((sum, part) => sum + part.feature_count, 0), 7652);
assert.equal(payload.missing_geometry_count, 28);

const classifyLegacy = (properties) => {
  const raw = String(properties.raw_tech || "").toLowerCase();
  if (properties.tech === "solar" || properties.tech === "solar_roof") return "solar";
  if (properties.tech === "bess") return "bess";
  if (properties.tech === "wind") return raw.includes("offshore") ? "wind_offshore" : "wind_onshore";
  return null;
};
const legacyProjects = legacy.features.map((feature) => ({ ...feature.properties, technology: classifyLegacy(feature.properties) }))
  .filter((project) => project.technology && Number(project.capacity) >= 1);
assert.equal(legacyProjects.length, 5210);
assert.equal(Math.round(legacyProjects.reduce((sum, project) => sum + Number(project.capacity), 0) * 100) / 100, 262396.8);
assert.equal(Math.max(...legacyProjects.map((project) => Number(project.capacity))), 4100);

const html = await readText("index.html");
assert.match(html, /UK RENEWABLES PIPELINE V9\.1/);
assert.equal((html.match(/<canvas id="g[1-3]"/g) || []).length, 3);
assert.doesNotMatch(html, /id="g4"/);
for (const technology of ["all", "solar", "bess", "wind_onshore", "wind_offshore"]) {
  assert.match(html, new RegExp(`data-technology="${technology}"`));
}
assert.match(html, /REPD REF/);
assert.match(html, /GLOBALGRID ID/);
assert.match(html, /REPD RECORD UPDATED/);
assert.match(html, /ATLAS V8/);
assert.match(html, /LEGACY NEWS SIGNAL/);

const app = await readText("scripts/app.js");
assert.match(app, /gauges-v9-1\.js/);
assert.match(app, /projects-v9-1\.js/);
const atlasEngine = await readFile(new URL("repd_grid_atlasv8/ventus-corev8engine.js", root), "utf8");
assert.match(atlasEngine, /data\/v9\.1\/build_manifest\.json/);
assert.match(atlasEngine, /atlas_partitions/);
const rootIndex = await readFile(new URL("index.html", root), "utf8");
assert.match(rootIndex, /UK Renewables Pipeline V9/);

console.log("V9.1: PASS (V1–V5 UI contract, 7,680 canonical ≥1 MW records, IDs/news/map/export retained)");
