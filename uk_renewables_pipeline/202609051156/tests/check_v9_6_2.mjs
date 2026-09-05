import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  classifyInternationalV9_6_2,
  regionalCountsV9_6_2,
  ukEvidenceV9_6_2,
} from "../scripts/core/news-regions-v9-6-2.js";

const base = new URL("../", import.meta.url);
const root = new URL("../../../", import.meta.url);
const rootPath = fileURLToPath(root);
const text = (url) => readFile(url, "utf8");
const json = async (url) => JSON.parse(await text(url));
const gitTree = (revisionPath) => execFileSync(
  "git", ["-C", rootPath, "rev-parse", revisionPath], { encoding: "utf8" },
).trim();

assert.equal(
  gitTree("HEAD:uk_renewables_pipeline/v9.6.1"),
  "6fc655fd5f1e80e0e2c390dce62a38bdea69a20e",
  "the validated V9.6.1 parent subtree changed",
);

const [contract, html, packageJson, feed] = await Promise.all([
  json(new URL("contracts/release.v9.6.2.json", base)),
  text(new URL("index.html", base)),
  json(new URL("package.json", base)),
  json(new URL("dist/major_project_news_v9_5_1.json", root)),
]);

assert.equal(contract.release, "9.6.2");
assert.ok(["CANDIDATE", "LIVE_VALIDATED"].includes(contract.status));
assert.equal(contract.frozen_parent.subtree, "6fc655fd5f1e80e0e2c390dce62a38bdea69a20e");
assert.equal(contract.runtime.project_data_changed, false);
assert.equal(contract.runtime.uk_matching_changed, false);
assert.equal(contract.runtime.regional_project_signal_eligible, false);
assert.equal(packageJson.version, "9.6.2");

assert.match(html, /UK RENEWABLES PIPELINE V9\.6\.2/);
for (const mode of ["UK", "INTERNATIONAL", "US", "EUROPE"]) {
  assert.match(html, new RegExp(`data-news="${mode}"`));
}
assert.doesNotMatch(html, /data-news="RELEVANT"/);
assert.match(html, /scripts\/app-v9-6-2\.js\?v=9\.6\.2/);
assert.equal((html.match(/<th(?:\s|>)/g) || []).length, 11);

assert.equal(feed.all_items.length, 133);
assert.equal(feed.canonical_items.length, 45);
assert.equal(feed.all_items.filter((item) => item.canonical_relevant === true).length, 45);
for (const item of feed.canonical_items) {
  assert.equal(item.role, "PRIMARY_MATCH");
  assert.equal(item.eligible_for_news_signal, true);
  assert.equal(item.gg_project_id, `GG2050-REPD-${item.repd_ref}`);
}

const counts = regionalCountsV9_6_2(feed.all_items);
assert.deepEqual(counts, { international: 19, us: 4, europe: 9, other: 6 });
assert.deepEqual(counts, {
  international: contract.expected.international_headline_count,
  us: contract.expected.us_headline_count,
  europe: contract.expected.europe_headline_count,
  other: contract.expected.international_other_headline_count,
});

const regional = feed.all_items.flatMap((item) => {
  const classification = classifyInternationalV9_6_2(item);
  return classification ? [{ item, classification }] : [];
});
assert.equal(regional.length, 19);
for (const { item, classification } of regional) {
  assert.equal(item.canonical_relevant, false);
  assert.equal(classification.project_signal_eligible, false);
  assert.equal(classification.canonical_identity, false);
  assert.ok(["SOLAR", "BESS", "SOLAR + BESS"].includes(classification.technology));
  assert.equal(ukEvidenceV9_6_2(item), "");
}

function story(headline) {
  return feed.all_items.find((item) => item.headline === headline);
}

assert.equal(classifyInternationalV9_6_2(story(
  "New Jersey Board of Public Utilities releases 150MW BTM energy storage proposal - Energy-Storage.News",
)).region, "US");
assert.equal(classifyInternationalV9_6_2(story(
  "Capital Dynamics acquires 170MW/680MWh BESS in County Kerry, Ireland",
)).region, "EUROPE");
assert.equal(classifyInternationalV9_6_2(story(
  "‘One market into many’: AER says battery storage systems are reshaping Australia’s NEM - Energy-Storage.News",
)).region, "INTERNATIONAL_OTHER");
assert.equal(classifyInternationalV9_6_2(story(
  "Canadian Solar says patent dispute with Maxeon is formally terminated",
)), null, "company name alone must not establish geography");
assert.equal(classifyInternationalV9_6_2(story(
  "EDF to optimise Chinese lithium giant Ganfeng’s 160MWh Kintore battery storage system",
)), null, "the Kintore UK project must not leak into INTERNATIONAL");
assert.equal(classifyInternationalV9_6_2(story(
  "Beacon Fen Energy Park development consent decision announced",
)), null, "canonical UK stories must not leak into INTERNATIONAL");

console.log("V9.6.2 static gate: PASS (45 UK; 19 international = 4 US + 9 Europe + 6 other)");
