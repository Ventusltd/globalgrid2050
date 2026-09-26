import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = new URL("../", import.meta.url);
const parent = new URL("../../v9.5.1/", import.meta.url);
const root = new URL("../../../", import.meta.url);
const rootPath = fileURLToPath(root);
const text = (url) => readFile(url, "utf8");
const json = async (url) => JSON.parse(await text(url));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const gitTree = (revisionPath) => execFileSync(
  "git", ["-C", rootPath, "rev-parse", revisionPath], { encoding: "utf8" },
).trim();

async function filesBelow(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (["__pycache__", "node_modules"].includes(entry.name) || entry.name.endsWith(".pyc")) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...await filesBelow(url, relative));
    else files.push(relative);
  }
  return files;
}

async function digestMap(directory) {
  const files = await filesBelow(directory);
  const rows = await Promise.all(files.map(async (path) => [
    path,
    sha256(await readFile(new URL(path, directory))),
  ]));
  return new Map(rows);
}

const allowedModified = new Set([
  "README.md",
  "index.html",
  "package-lock.json",
  "package.json",
]);
const allowedAdded = new Set([
  "contracts/release.v9.6.1.json",
  "docs/releases/9.6.1.md",
  "styles/v9-6-1.css",
  "tests/browser_smoke_v9_6_1.mjs",
  "tests/check_v9_6_1.mjs",
  "tests/run_v9_6_1.sh",
]);

assert.equal(
  gitTree("HEAD:uk_renewables_pipeline/v9.5.1"),
  "95672822a2c534445ca12b0dd62f29154a66c0e8",
  "the validated V9.5.1 parent subtree changed",
);

const [parentFiles, targetFiles] = await Promise.all([digestMap(parent), digestMap(base)]);
assert.deepEqual(
  [...targetFiles.keys()].filter((path) => !parentFiles.has(path)).sort(),
  [...allowedAdded].sort(),
  "V9.6.1 contains an unapproved added or missing file",
);
assert.deepEqual(
  [...parentFiles.keys()].filter((path) => !targetFiles.has(path)),
  [],
  "V9.6.1 omitted a V9.5.1 parent file",
);
for (const [path, digest] of parentFiles) {
  if (!allowedModified.has(path)) {
    assert.equal(targetFiles.get(path), digest, `${path} differs from frozen V9.5.1`);
  }
}

const [contract, manifest, html, css, packageJson] = await Promise.all([
  json(new URL("contracts/release.v9.6.1.json", base)),
  json(new URL("data/v9_manifest.json", base)),
  text(new URL("index.html", base)),
  text(new URL("styles/v9-6-1.css", base)),
  json(new URL("package.json", base)),
]);

assert.equal(contract.release, "9.6.1");
assert.ok(["CANDIDATE", "LIVE_VALIDATED"].includes(contract.status));
assert.equal(contract.frozen_parent.commit, "8b2432be75f224562fc1c416dbcc3319e31a47a8");
assert.equal(contract.frozen_parent.subtree, "95672822a2c534445ca12b0dd62f29154a66c0e8");
assert.equal(contract.runtime.app, "scripts/app-v9-5-1.js");
assert.equal(contract.runtime.data_changed, false);
assert.equal(contract.runtime.javascript_changed, false);
assert.equal(contract.runtime.news_changed, false);
assert.equal(contract.ui_contract.desktop_changed, false);
assert.equal(contract.ui_contract.project_table_inherited_min_width_px, 1280);
assert.equal(contract.ui_contract.capacity_range_filter, false);
assert.equal(contract.ui_contract.forced_table_width_px, null);
assert.equal(manifest.version, "9.5.1", "the V9.5.1 runtime manifest must remain unchanged");
assert.equal(packageJson.version, "9.6.1");

assert.match(html, /UK RENEWABLES PIPELINE V9\.6\.1/);
assert.match(html, /styles\/v9-6-1\.css\?v=9\.6\.1/);
assert.match(html, /scripts\/app-v9-5-1\.js\?v=9\.6\.1/);
assert.match(html, /V9\.6 DISCONTINUED/);
assert.doesNotMatch(html, /minCapacity|maxCapacity|capacity-controls/);
assert.doesNotMatch(html, /app-v9-6\.js|project-filter-v9-6|projects-v9-6/);
assert.equal((html.match(/class="card"/g) || []).length, 3);
assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 11);

assert.match(css, /@media\s*\(max-width:\s*768px\)/);
assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
assert.match(css, /overflow-x:\s*auto/);
assert.match(css, /\.tablewrap \.hide-mobile\s*\{[^}]*display:\s*table-cell/s);
assert.doesNotMatch(css, /\bmin-width\s*:|\n\s*width\s*:|1850|1500/);
assert.doesNotMatch(css, /gauges|stories|header|sidebar|newspaper|filters|display:\s*grid/);

for (const forbidden of [
  "scripts/app-v9-6.js",
  "scripts/core/project-filter-v9-6.js",
  "scripts/plugins/projects-v9-6.js",
]) {
  await assert.rejects(access(new URL(forbidden, base)), `${forbidden} must not exist in V9.6.1`);
}

const buildManifest = await json(new URL("data/v9.1/build_manifest.json", base));
const parts = await Promise.all(buildManifest.project_partitions.map(({ path }) => json(new URL(path, base))));
const projects = parts.flatMap((part) => part.projects);
assert.equal(projects.length, 7680);
assert.equal(Number(projects.reduce((sum, project) => sum + project.capacity_mw, 0).toFixed(2)), 356474.09);
assert.equal(Math.max(...projects.map((project) => project.capacity_mw)), 4100);

const news = await json(new URL("dist/major_project_news_v9_5_1.json", root));
assert.equal(news.all_items.length, 133);
assert.equal(news.canonical_items.length, 45);
const beacon = news.canonical_items.find((item) => item.headline === "Beacon Fen Energy Park development consent decision announced");
assert.equal(beacon.repd_ref, "13599");
assert.equal(beacon.operator, "Low Carbon Limited");
assert.equal(beacon.capacity_mw, 400);

console.log("V9.6.1 static gate: PASS (V9.5.1 byte parity plus mobile-only scroll CSS)");
