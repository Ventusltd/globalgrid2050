/**
 * V9.74 candidate composer. Copy the FULL accepted V9.73 page, change only:
 * index title, report controller, README, CHANGES, and add test+receipt.
 * No source data, colors, existing CSS, MAP/A4, gauges or GridAtlas edits.
 * Re-running with changed candidate bytes must fail, never overwrite.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const oldId = "202611222330";
const newId = "202611231400";
const oldDir = path.join(root, "uk_renewables_pipeline", oldId);
const newDir = path.join(root, "uk_renewables_pipeline", newId);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

async function inventory(folder) {
  const items = new Map();
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes:true })) {
      const full = path.join(directory,entry.name);
      if (entry.isSymbolicLink()) throw new Error("Unreviewed symlink: " + full);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) items.set(path.relative(folder,full).replaceAll("\\","/"),await fs.readFile(full));
      else throw new Error("Unreviewed entry " + full);
    }
  }
  await walk(folder);
  return items;
}
if ((await fs.stat(oldDir)).isDirectory() !== true) throw new Error("Missing exact V9.73 source");
try {
  await fs.stat(newDir);
  throw new Error("Candidate path already exists; immutable release must not be replaced");
} catch(e) { if (e.code !== "ENOENT") throw e; }

const original = await inventory(oldDir);
if (original.size < 35) throw new Error("Source V9.73 unexpectedly truncated, only " + original.size + " files");
const mustProtect = [
  "map-entry.mjs","report-a4.mjs","report-model.mjs","report-pdf.mjs",
  "repd-expanded.mjs","scripts/plugins/projects-v9-8.js",
  "scripts/plugins/preview-v928.js","styles/v7.css","styles/repd-reports.css",
  "data/v9.1/build_manifest.json", "tests/v972-vicinity-a4-pdf.mjs"
];
for (const file of mustProtect) if (!original.has(file)) throw new Error("Missing protected V9.73 dependency: " + file);

const oldHtml = original.get("index.html").toString("utf8");
if (!oldHtml.includes("V9.73") || !oldHtml.includes(oldId) ||
    !oldHtml.includes('src="repd-reports.mjs"') ||
    !oldHtml.includes('data-repd-report="operator"')) {
  throw new Error("V9.73 page identity/report mounting is not as expected");
}
const html = oldHtml.replace("V9.73", "V9.74").replace(oldId,newId);
const controller = await fs.readFile(path.join(here, "repd-reports-integrated.mjs"),"utf8");
const browserTest = await fs.readFile(path.join(here,"tests","v974-cockpit-browser.mjs"),"utf8");
for (const mark of [
  'import { state } from "./scripts/core/state.js"',
  'import { buildRepdCapacityReport } from "./repd-reports-model.mjs"',
  'import { buildCockpitReport, SOURCE_UNAVAILABLE }',
  'pipeline-projects-rendered', 'atlasUrlV9_5_1',
  'buildAtlasInterconnectorLinkV9_8'
]) if (!controller.includes(mark)) throw new Error("Missing integration contract " + mark);

await fs.cp(oldDir,newDir,{recursive:true,errorOnExist:true,force:false});
await fs.writeFile(path.join(newDir,"index.html"),html);
await fs.writeFile(path.join(newDir,"repd-reports.mjs"),controller);
await fs.writeFile(path.join(newDir,"README.md"),[
 "# V9.74 — Technology-aware REPD operator, status and region cockpit",
 "",
 "Full immutable successor of V9.73 ("+oldId+").",
 "The SAME existing REPD cockpit now ranks operators by the selected technology.",
 "Solar shows solar-only MWp and operators; BESS, onshore and offshore use their own MW.",
 "A status facet covers every original REPD status, including refused, withdrawn",
 "and not reported. Operator and region facets intersect; switching report buttons",
 "retains selections. Current Table Filters remains an explicit, separate scope.",
 "Interconnectors retain their own inventory and are never added to 7,775 REPD records.",
 "Grid reporting awaits a verified separate source. No measured energy claims.",
 "",
 "No changes to published V9.73, data, styling, colours, original chart gauges,",
 "ticker, navigation, REPD source, MAP/A4/PDF/expanded view or GridAtlas.",
 "Only index.html (version title), repd-reports.mjs, README.md and CHANGES.md",
 "differ from V9.73, plus the new browser test and build receipt.",
 "",
 "Rollback remains /uk_renewables_pipeline/"+oldId+"/.",
 ""
].join("\n"));
await fs.writeFile(path.join(newDir,"CHANGES.md"),[
 "# V9.74 candidate: REPD cockpit cross-filter integration",
 "",
 "- Existing Operator MW / Status MW / Region MW grouped reports respond to the same",
 "  Solar / BESS / Onshore / Offshore technology selection as the REPD table.",
 "- Compact report-native status, operator and region facets, without resetting on",
 "  switching reports, give ranked operators by recorded selected-technology capacity.",
 "- All official statuses remain selectable, including statuses absent from the",
 "  four fast table status buttons; missing labels stay explicit.",
 "- Native per-project REPD drill-back and MAP/A4 navigation unchanged.",
 "- Interconnector source kept separate from REPD, not combined in ALL TECH.",
 "- All original CSS, gauge, ticker, GridAtlas and core data bytes unchanged.",
 ""
].join("\n"));
await fs.writeFile(path.join(newDir,"tests","v974-cockpit-browser.mjs"),browserTest);

const after = await inventory(newDir);
const changed = [], missing=[];
for (const [rel,originalBytes] of original) {
  const newBytes=after.get(rel);
  if (!newBytes) {missing.push(rel);continue;}
  if (!originalBytes.equals(newBytes)) changed.push(rel);
}
const expectedChanged=["index.html","repd-reports.mjs","README.md","CHANGES.md"].sort();
if (missing.length || JSON.stringify(changed.sort()) !== JSON.stringify(expectedChanged)) {
  throw new Error("Copied edition's inherited file diff is not exact: " +
    JSON.stringify({missing,changed,expectedChanged}));
}
const added=[...after.keys()].filter(x=>!original.has(x)).sort();
if (JSON.stringify(added)!==JSON.stringify(["tests/v974-cockpit-browser.mjs"])) {
  throw new Error("Unreviewed new file additions " + JSON.stringify(added));
}
const immutable = [...original.entries()].filter(([name])=>!expectedChanged.includes(name));
const receipt = {
  schema:"ventus.pipeline.cockpit-v974-receipt.v1",
  originalRelease:oldId, newRelease:newId,
  originalFileCount:original.size,
  inheritedUnchangedCount:immutable.length,
  missingFiles:missing, changedFiles:changed, addedFiles:added,
  inheritedManifestSha256:sha(Buffer.from(immutable.sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([rel,buf])=>rel+"\t"+sha(buf)+"\n").join(""))),
  sourceCssSha256:sha(original.get("styles/v7.css")),
  candidateCssSha256:sha(after.get("styles/v7.css")),
  sourceReportCssSha256:sha(original.get("styles/repd-reports.css")),
  candidateReportCssSha256:sha(after.get("styles/repd-reports.css")),
  releaseAccepted:false, published:false,
  status:"ISOLATED_UNVERIFIED_BROWSER_AND_PUBLIC",
 };
await fs.writeFile(path.join(newDir,"COCKPIT-BUILD-RECEIPT.json"),JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify(receipt,null,2));
