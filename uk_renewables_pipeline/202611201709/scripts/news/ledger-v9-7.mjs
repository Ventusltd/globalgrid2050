import { createHash } from "node:crypto";
import { CLASSIFIER_VERSION, classifyRegionalV9_7 } from "./classifier-v9-7.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stableId = (item) => `GG2050-REGION-${sha256(`${item.url || ""}\n${item.headline || ""}`).slice(0, 16).toUpperCase()}`;

export function buildRegionalArtifactsV9_7(items, sourceMeta) {
  const decisions = [];
  const articles = [];
  for (const item of items) {
    const articleId = stableId(item);
    const classification = classifyRegionalV9_7(item);
    const common = {
      article_id: articleId,
      headline: String(item.headline || "").trim(),
      url: String(item.url || "").trim(),
      source: String(item.source || "").trim(),
      published: String(item.published || "").trim(),
    };
    decisions.push({
      ...common,
      decision: classification.decision,
      reason: classification.reason,
      evidence: classification.evidence || [],
      classifier_version: CLASSIFIER_VERSION,
      project_signal_eligible: false,
      canonical_identity: false,
    });
    if (classification.decision === "ACCEPT_REGIONAL") {
      articles.push({
        ...common,
        technology: classification.technology,
        country: classification.country,
        region: classification.region,
        evidence: classification.evidence,
        classifier_version: CLASSIFIER_VERSION,
        project_signal_eligible: false,
        canonical_identity: false,
      });
    }
  }
  const byDecision = Object.fromEntries([...new Set(decisions.map((item) => item.decision))].sort()
    .map((decision) => [decision, decisions.filter((item) => item.decision === decision).length]));
  const byRegion = Object.fromEntries(["US", "EUROPE", "INTERNATIONAL_OTHER"]
    .map((region) => [region, articles.filter((item) => item.region === region).length]));
  const dates = items.map((item) => item.published).filter(Boolean).sort();
  const sources = [...new Set(items.map((item) => item.source).filter(Boolean))].sort();
  return {
    regional: {
      schema: "globalgrid2050.regional-news.v9.7",
      release: "9.7",
      classifier_version: CLASSIFIER_VERSION,
      generated_from: sourceMeta.id,
      articles,
    },
    ledger: {
      schema: "globalgrid2050.regional-news-decisions.v9.7",
      release: "9.7",
      classifier_version: CLASSIFIER_VERSION,
      generated_from: sourceMeta.id,
      decisions,
    },
    telemetry: {
      input_count: items.length,
      accepted_count: articles.length,
      by_decision: byDecision,
      by_region: byRegion,
      source_count: sources.length,
      sources,
      earliest_published: dates[0] || null,
      latest_published: dates.at(-1) || null,
      invalid_url_count: items.filter((item) => !/^https:\/\//.test(String(item.url || ""))).length,
      last_known_good: articles.length > 0,
    },
  };
}
