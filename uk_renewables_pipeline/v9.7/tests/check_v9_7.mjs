import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { classifyRegionalV9_7 } from "../scripts/build/regional-news-v9-7.mjs";

const base = new URL("../", import.meta.url);
const root = new URL("../../../", import.meta.url);
const rootPath = fileURLToPath(root);
const text = (url) => readFile(url, "utf8");
const json = async (url) => JSON.parse(await text(url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const gitTree = (revisionPath) => execFileSync(
  "git", ["-C", rootPath, "rev-parse", revisionPath], { encoding: "utf8" },
).trim();

assert.equal(
  gitTree("HEAD:uk_renewables_pipeline/v9.6.2"),
  "99d3b5d80be77b43c9819a571f468913e6132d07",
  "the validated V9.6.2 parent subtree changed",
);

const [contract, sourceContract, html, packageJson, feed, regionalText, ledgerText, manifest] = await Promise.all([
  json(new URL("contracts/release.v9.7.json", base)),
  json(new URL("contracts/regional-news-sources.v9.7.json", base)),
  text(new URL("index.html", base)),
  json(new URL("package.json", base)),
  json(new URL("dist/major_project_news_v9_5_1.json", root)),
  text(new URL("data/v9.7/regional_news.json", base)),
  text(new URL("data/v9.7/regional_decisions.json", base)),
  json(new URL("data/v9.7/regional_manifest.json", base)),
]);
const regional = JSON.parse(regionalText);
const ledger = JSON.parse(ledgerText);

assert.equal(contract.release, "9.7");
assert.equal(contract.status, "CANDIDATE");
assert.equal(contract.frozen_parent.subtree, "99d3b5d80be77b43c9819a571f468913e6132d07");
assert.equal(contract.runtime.project_data_changed, false);
assert.equal(contract.runtime.project_javascript_changed, false);
assert.equal(contract.runtime.project_styles_changed, false);
assert.equal(contract.runtime.mobile_interface_changed, false);
assert.equal(contract.runtime.regional_project_signal_eligible, false);
assert.equal(packageJson.version, "9.7.0");
assert.equal(sourceContract.adapters.filter((adapter) => adapter.enabled).length, 1);
assert.equal(sourceContract.adapters[0].independent_of_repd_signals, true);

assert.match(html, /UK RENEWABLES PIPELINE V9\.7/);
assert.match(html, /V9\.7 CANDIDATE/);
assert.match(html, /scripts\/app-v9-7\.js\?v=9\.7/);
assert.doesNotMatch(html, /scripts\/app-v9-6-2\.js/);
assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 11);
for (const mode of ["UK", "INTERNATIONAL", "US", "EUROPE"]) {
  assert.match(html, new RegExp(`data-news="${mode}"`));
}

assert.equal(feed.all_items.length, 133);
assert.equal(feed.canonical_items.length, 45);
assert.equal(regional.release, "9.7");
assert.equal(regional.articles.length, 19);
assert.equal(ledger.decisions.length, 133);
assert.equal(new Set(ledger.decisions.map((item) => item.article_id)).size, 133);
assert.deepEqual(manifest.telemetry.by_region, { US: 4, EUROPE: 9, INTERNATIONAL_OTHER: 6 });
assert.equal(manifest.telemetry.by_decision.UK_CANONICAL, 45);
assert.equal(manifest.telemetry.accepted_count, 19);
assert.equal(manifest.telemetry.last_known_good, true);
assert.equal(manifest.hashes.regional_news_sha256, hash(regionalText));
assert.equal(manifest.hashes.decision_ledger_sha256, hash(ledgerText));

const forbidden = ["project", "project_id", "repd_ref", "gg_project_id", "operator", "county", "capacity_mw", "eligible_for_news_signal"];
for (const item of regional.articles) {
  assert.equal(item.project_signal_eligible, false);
  assert.equal(item.canonical_identity, false);
  assert.ok(["US", "EUROPE", "INTERNATIONAL_OTHER"].includes(item.region));
  assert.ok(["SOLAR", "BESS", "SOLAR + BESS"].includes(item.technology));
  for (const key of forbidden) assert.equal(Object.hasOwn(item, key), false, `regional article leaked ${key}`);
}

const hostile = [
  ["Battery storage helps us cut emissions at a utility-scale project", "ABSTAIN_NO_EXPLICIT_GEOGRAPHY"],
  ["American Battery Technology announces quarterly earnings", "ABSTAIN_NO_UTILITY_CONTEXT"],
  ["Canadian Solar says patent dispute is formally terminated", "ABSTAIN_NO_UTILITY_CONTEXT"],
  ["Utility-scale battery project opens in South Korea", "ACCEPT_REGIONAL"],
  ["U.S. utility commissions a grid-scale battery project", "ACCEPT_REGIONAL"],
  ["Developer finances US$100 million battery project", "ABSTAIN_NO_EXPLICIT_GEOGRAPHY"],
];
for (const [headline, decision] of hostile) {
  assert.equal(classifyRegionalV9_7({ headline }).decision, decision, headline);
}
assert.equal(classifyRegionalV9_7({
  headline: "EDF to optimise Chinese supplier's 160MWh Kintore battery storage system",
  project: "Kintore Battery Storage",
  county: "Scotland",
}).decision, "REJECT_UK_EVIDENCE");
assert.equal(classifyRegionalV9_7({
  headline: "Beacon Fen Energy Park development consent decision announced",
  canonical_relevant: true,
}).decision, "UK_CANONICAL");

const runtime = await text(new URL("scripts/plugins/newspaper-v9-7.js", base));
assert.match(runtime, /data\/v9\.7\/regional_news\.json/);
assert.doesNotMatch(runtime, /classifyRegional|classifyInternational|news-regions-v9-6-2/);
assert.match(runtime, /project_signal_eligible === false/);

console.log("V9.7 static gate: PASS (133 ledger decisions; 19 sanitized regional articles; 45 UK frozen)");
