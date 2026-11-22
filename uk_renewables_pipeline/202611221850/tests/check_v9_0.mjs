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
import { primeAtlasReceiverV9_7 } from "../scripts/core/atlas-receiver-v9-7.js";

/* The deep-link contract, as the engine publishes it. Held here as the test's
   own input so every branch runs with no network; the live file is audited
   separately by Ventusltd/testcode drivers/link-targets.mjs, which reads
   ventus-grid-engine/deeplink/receivers.json rather than restating it. */
const RECEIVER_CONTRACT = {
  schema: "ventus.grid-engine.deeplink-receivers.v1",
  canonical: { id: "gridatlas-v9", route: "https://ventusltd.github.io/gridatlas/atlas/", carries_engine: true },
  /* A synthetic retired route. This fixture only needs SOMETHING retired to
     exercise the refusal branch, and naming the estate's real dead route in a
     test keeps a copy of it alive for the next person to copy. */
  retired: [{ id: "synthetic-retired-receiver", route: "https://retired.invalid/no-engine/", carries_engine: false }],
};

/* Primed before the first table view: buildAtlasV8Url() is synchronous and the
   view builds a link per row, so the contract must be in place first. Without
   it the link is empty by design -- there is no fallback to a retired route. */
assert.equal(primeAtlasReceiverV9_7(RECEIVER_CONTRACT), RECEIVER_CONTRACT.canonical.route);


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
/* Was: the origin and pathname of the retired V8 overlay. The engine
   retired that route on 2026-09-05 for carrying no cartridges, so the old
   assertion pinned the defect. */
assert.equal(atlas.origin, "https://ventusltd.github.io");
assert.equal(atlas.pathname, "/gridatlas/atlas/");
assert.equal(atlas.searchParams.get("repd_ref"), "12453");
assert.equal(atlas.searchParams.get("technology"), "bess");
assert.equal(atlas.searchParams.get("latitude"), "53.5802575");
assert.equal(atlas.searchParams.get("longitude"), "-1.0850616");
/* `project` and `capacity_mw` are deliberately no longer sent. The engine's
   deep-link contract names five parameters -- repd_ref, technology, latitude,
   longitude, zoom -- and the canonical receiver resolves the project's name,
   capacity, postcode and status from the REPD reference itself. Measured live
   on REPD 8162: the arrival reads "Longfield solar 500 MW ... CM3 3AS - Essex
   REPD 8162 - awaiting construction" with none of it carried in the link.
   Sending them again would be a second source for a fact the receiver already
   holds, which is the shape of fault this whole change is removing. */
assert.equal(atlas.searchParams.get("capacity_mw"), null);
assert.equal(atlas.searchParams.get("project"), null);

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
/* Was: assert the CSV contains the retired V8 overlay route.
   That route was retired by the engine on 2026-09-05 for carrying no
   cartridges, so the old assertion pinned the defect. It now asserts the
   canonical receiver is present and the retired one is absent -- the same
   check, made specific about which receiver is right and why.

   The CSV column is still headed "Atlas V8 URL". That label is a published
   contract, pinned above and in contracts/projects-plugin.v7.2.json;
   renaming it is a separate governed decision and is recorded as an
   erratum rather than taken here. */
const csvAtlasUrls = [...solarCsv.content.matchAll(/https:\/\/[^",\s]+/g)].map((m) => m[0])
  .filter((href) => /atlas|repd_grid/i.test(href));
assert.ok(csvAtlasUrls.length > 0, "the CSV carries no Atlas URL at all");
assert.ok(
  csvAtlasUrls.every((href) => href.startsWith(RECEIVER_CONTRACT.canonical.route)),
  `CSV Atlas URLs are not all the canonical receiver: ${[...new Set(csvAtlasUrls)].slice(0, 3).join(" | ")}`,
);

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
