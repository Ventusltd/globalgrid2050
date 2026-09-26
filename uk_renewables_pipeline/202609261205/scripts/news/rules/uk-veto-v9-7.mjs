const UK = /\b(?:UK|U\.K\.|United Kingdom|Britain|British|England|English|Scotland|Scottish|Wales|Welsh|Northern Ireland|North Yorkshire|Lincolnshire|Nottinghamshire|Devon|Cornish|Cumbria|Suffolk|Kent|Surrey|Gloucestershire|Oxfordshire|Warwickshire|Yorkshire|Essex|Norfolk|Somerset|Dorset|Lancashire|Derbyshire|Leicestershire|Cambridgeshire|Bedfordshire|Hertfordshire|Buckinghamshire|Worcestershire|Shropshire|Staffordshire|Cheshire|Northumberland|Tyne and Wear|Greater Manchester|Merseyside|West Midlands|East Sussex|West Sussex|County Durham|Ayrshire|Aberdeenshire)\b/i;
const GENERIC_PROJECT = new Set([
  "and", "the", "farm", "solar", "battery", "bess", "storage", "energy", "park", "site",
  "road", "lane", "wind", "offshore", "onshore", "project", "phase", "extension", "facility",
  "system", "scheme", "development", "power", "limited", "ltd", "centre", "center", "grid",
  "services", "complex", "south", "north", "east", "west", "southern", "northern", "eastern",
  "western", "california", "virginia", "jersey", "australia", "germany", "france", "spain",
  "italy", "ireland", "romania", "greece", "chile", "japan",
]);

const normalise = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function inheritedUkEvidenceV9_7(item) {
  if (item?.canonical_relevant === true) return "canonical REPD PRIMARY_MATCH";
  const headline = String(item?.headline || "");
  if (UK.test(headline)) return `explicit UK geography: ${headline.match(UK)?.[0]}`;
  const normalisedHeadline = normalise(headline);
  const projectToken = normalise(item?.project).split(" ")
    .find((token) => token.length >= 5 && !GENERIC_PROJECT.has(token) && normalisedHeadline.includes(token));
  if (projectToken && String(item?.county || "").trim()) return `inherited UK project veto: ${projectToken}`;
  return "";
}
