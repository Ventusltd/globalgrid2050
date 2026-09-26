import { geographyEvidenceV9_7 } from "./rules/geography-v9-7.mjs";
import { technologyEvidenceV9_7, utilityContextEvidenceV9_7 } from "./rules/technology-v9-7.mjs";
import { inheritedUkEvidenceV9_7 } from "./rules/uk-veto-v9-7.mjs";

export const CLASSIFIER_VERSION = "v9.7.0";

export function classifyRegionalV9_7(item) {
  const headline = String(item?.headline || "").trim();
  const technology = technologyEvidenceV9_7(headline);
  const ukEvidence = inheritedUkEvidenceV9_7(item);
  const base = { technology: technology.technology, evidence: technology.terms };

  if (item?.canonical_relevant === true) {
    return { ...base, decision: "UK_CANONICAL", reason: "canonical UK story stays outside the regional pipeline", evidence: [ukEvidence] };
  }
  if (ukEvidence) {
    return { ...base, decision: "REJECT_UK_EVIDENCE", reason: "UK evidence vetoed regional classification", evidence: [ukEvidence, ...technology.terms] };
  }
  if (!technology.technology) {
    return { ...base, decision: "ABSTAIN_NO_TECHNOLOGY", reason: "no explicit solar or battery technology evidence" };
  }
  const context = utilityContextEvidenceV9_7(headline);
  if (!context) {
    return { ...base, decision: "ABSTAIN_NO_UTILITY_CONTEXT", reason: "technology term lacks utility-scale project or market context" };
  }
  const location = geographyEvidenceV9_7(headline);
  if (!location) {
    return { ...base, decision: "ABSTAIN_NO_EXPLICIT_GEOGRAPHY", reason: "no explicit, case-safe non-UK geography", evidence: [...technology.terms, context] };
  }
  return {
    decision: "ACCEPT_REGIONAL",
    reason: "explicit non-UK geography with utility-scale solar or battery context",
    region: location.region,
    country: location.country,
    technology: technology.technology,
    evidence: [...technology.terms, context, location.evidence],
  };
}
