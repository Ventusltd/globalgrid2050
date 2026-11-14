const SOLAR = /\b(?:solar|photovoltaic(?:s)?|pv|agrivoltaic(?:s)?)\b/i;
const BESS = /\b(?:bess|battery|batteries|energy storage|grid storage)\b/i;
const UTILITY_CONTEXT = /\b(?:project|projects|system|systems|portfolio|plant|farm|construction|commission(?:ed|ing)?|financ(?:e|ed|ing|ial)|acquir(?:e|es|ed|ing)|acquisition|stake|market|grid|utility|utilities|capacity|operations|services|deal|deals|proposal|online|developer|cluster|roundup|rfps?|facility|facilities|mw|mwh|gw|gwh|nem|tso)\b/i;

export function technologyEvidenceV9_7(headline) {
  const value = String(headline || "");
  const solar = value.match(SOLAR)?.[0] || "";
  const bess = value.match(BESS)?.[0] || "";
  return {
    technology: solar && bess ? "SOLAR + BESS" : solar ? "SOLAR" : bess ? "BESS" : "",
    terms: [solar, bess].filter(Boolean),
  };
}

export function utilityContextEvidenceV9_7(headline) {
  return String(headline || "").match(UTILITY_CONTEXT)?.[0] || "";
}
