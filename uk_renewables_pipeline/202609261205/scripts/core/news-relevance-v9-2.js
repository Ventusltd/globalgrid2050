import { normaliseProject } from "./utils.js";

const GENERIC = new Set([
  "and", "the", "farm", "solar", "battery", "bess", "storage", "energy", "park", "site",
  "road", "lane", "wind", "offshore", "onshore", "project", "phase", "extension", "facility",
  "system", "scheme", "development", "power", "limited", "ltd", "uk", "centre", "center",
]);

function significantTokens(value) {
  return normaliseProject(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !GENERIC.has(token));
}

function countMatches(tokens, text) {
  return tokens.filter((token) => text.includes(token)).length;
}

function capacityAppears(item, headline) {
  const capacity = Number(item.capacity_mw || 0);
  if (!capacity) return false;
  const candidates = new Set([
    String(capacity),
    String(Math.round(capacity)),
    capacity.toLocaleString("en-GB", { maximumFractionDigits: 2 }),
  ]);
  return [...candidates].some((candidate) => candidate && headline.includes(candidate.toLowerCase()));
}

export function assessNewsItemV9_2(item) {
  const headline = normaliseProject(item.headline || "");
  const projectTokens = significantTokens(item.project);
  const operatorTokens = significantTokens(item.operator);
  const matchedProjectTokens = countMatches(projectTokens, headline);
  const matchedOperatorTokens = countMatches(operatorTokens, headline);
  const county = normaliseProject(item.county || "");
  const countyMatch = Boolean(county && headline.includes(county));
  const capacityMatch = capacityAppears(item, headline);
  const technology = String(item.technology || "").toLowerCase();
  const technologyMatch = technology === "solar"
    ? /\bsolar\b/.test(headline)
    : technology === "bess"
      ? /\b(bess|battery|storage)\b/.test(headline)
      : false;
  const sourceConfidence = Math.max(0, Math.min(100, Number(item.confidence || 0)));

  let score = Math.min(matchedProjectTokens, 3) * 30;
  score += Math.min(matchedOperatorTokens, 2) * 12;
  if (countyMatch) score += 15;
  if (capacityMatch) score += 15;
  if (technologyMatch) score += 8;
  score += Math.round(sourceConfidence / 20);
  score = Math.min(score, 100);

  const hasIdentitySupport = matchedProjectTokens >= 2
    || (matchedProjectTokens >= 1 && (matchedOperatorTokens >= 1 || countyMatch || capacityMatch));
  const strong = hasIdentitySupport && score >= 45;
  const reason = strong
    ? `project/headline relevance ${score}%`
    : `relevance gate rejected ${score}%`;

  return Object.freeze({
    score,
    strong,
    reason,
    matched_project_tokens: matchedProjectTokens,
    matched_operator_tokens: matchedOperatorTokens,
    county_match: countyMatch,
    capacity_match: capacityMatch,
    technology_match: technologyMatch,
  });
}

export function newsMatchesProjectV9_2(project, item) {
  if (!project || !item) return false;
  if (normaliseProject(project.name) !== normaliseProject(item.project)) return false;
  const expectedTechnology = project.technology === "solar" ? "solar" : project.technology === "bess" ? "bess" : "";
  if (!expectedTechnology || String(item.technology || "").toLowerCase() !== expectedTechnology) return false;
  return assessNewsItemV9_2(item).strong;
}
