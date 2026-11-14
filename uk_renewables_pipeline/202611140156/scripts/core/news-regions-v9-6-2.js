import { normaliseProject } from "./utils.js";

const SOLAR = /\b(?:solar|photovoltaic(?:s)?|pv|agrivoltaic(?:s)?)\b/i;
const BESS = /\b(?:bess|battery|batteries|energy storage|grid storage)\b/i;

const UK = /\b(?:uk|u\.k\.|united kingdom|britain|british|england|english|scotland|scottish|wales|welsh|northern ireland|north yorkshire|lincolnshire|nottinghamshire|devon|cornish|cumbria|suffolk|kent|surrey|gloucestershire|oxfordshire|warwickshire|yorkshire|essex|norfolk|somerset|dorset|lancashire|derbyshire|leicestershire|cambridgeshire|bedfordshire|hertfordshire|buckinghamshire|worcestershire|shropshire|staffordshire|cheshire|northumberland|tyne and wear|greater manchester|merseyside|west midlands|east sussex|west sussex)\b/i;

const US = /\b(?:us(?!\$)|u\.s\.(?!\$)|usa|u\.s\.a\.|united states|american|new jersey|virginia|california|arizona|texas|new york|florida|illinois|ohio|pennsylvania|colorado|nevada|oregon|washington state|massachusetts|connecticut|maryland|michigan|minnesota|wisconsin|georgia|north carolina|south carolina|tennessee|kentucky|indiana|iowa|kansas|missouri|oklahoma|new mexico|utah|idaho|montana|wyoming|maine|vermont|new hampshire|rhode island|delaware|west virginia|alabama|mississippi|louisiana|arkansas|nebraska|south dakota|north dakota|hawaii|alaska|tucson)\b/i;

const EUROPE = /\b(?:europe|european union|eu|ireland|irish|germany|german|france|french|spain|spanish|italy|italian|netherlands|dutch|belgium|belgian|poland|polish|portugal|portuguese|greece|greek|denmark|danish|sweden|swedish|norway|norwegian|finland|finnish|austria|austrian|switzerland|swiss|czechia|czech|romania|romanian|bulgaria|bulgarian|hungary|hungarian|croatia|croatian|serbia|serbian|slovenia|slovakia|estonia|latvia|lithuania|ukraine|moldova|luxembourg|cyprus|malta|iceland|kosovo|albania|bosnia|montenegro|north macedonia)\b/i;

const OTHER = /\b(?:australia|australian|canada|india|china|chinese|south africa|new zealand|japan|japanese|brazil|brazilian|mexico|mexican|uae|united arab emirates|saudi arabia|taiwan|philippines|chile|argentina|africa|asia|latin america|middle east)\b/i;

const GENERIC_PROJECT = new Set([
  "and", "the", "farm", "solar", "battery", "bess", "storage", "energy", "park", "site",
  "road", "lane", "wind", "offshore", "onshore", "project", "phase", "extension", "facility",
  "system", "scheme", "development", "power", "limited", "ltd", "centre", "center",
  "grid", "services", "complex", "south", "north", "east", "west", "southern", "northern",
  "eastern", "western", "california", "virginia", "jersey", "australia", "germany", "france",
  "spain", "italy", "ireland", "romania", "greece", "chile", "japan",
]);

function distinctiveProjectTokens(item) {
  return normaliseProject(item.project || "")
    .split(" ")
    .filter((token) => token.length >= 5 && !GENERIC_PROJECT.has(token));
}

export function ukEvidenceV9_6_2(item) {
  if (item?.canonical_relevant === true) return "canonical REPD PRIMARY_MATCH";
  const headline = String(item?.headline || "");
  if (UK.test(headline)) return "explicit UK geography";
  const normalisedHeadline = normaliseProject(headline);
  const projectToken = distinctiveProjectTokens(item).find((token) => normalisedHeadline.includes(token));
  if (projectToken && String(item?.county || "").trim()) return `UK project token ${projectToken}`;
  return "";
}

function technology(headline) {
  const solar = SOLAR.test(headline);
  const bess = BESS.test(headline);
  if (solar && bess) return "SOLAR + BESS";
  if (solar) return "SOLAR";
  if (bess) return "BESS";
  return "";
}

export function classifyInternationalV9_6_2(item) {
  const headline = String(item?.headline || "");
  const classifiedTechnology = technology(headline);
  if (!classifiedTechnology || ukEvidenceV9_6_2(item)) return null;

  let region = "";
  let evidence = "";
  if (US.test(headline)) {
    region = "US";
    evidence = "explicit US geography";
  } else if (EUROPE.test(headline)) {
    region = "EUROPE";
    evidence = "explicit European geography";
  } else if (OTHER.test(headline)) {
    region = "INTERNATIONAL_OTHER";
    evidence = "explicit non-UK geography";
  }
  if (!region) return null;

  return Object.freeze({
    region,
    technology: classifiedTechnology,
    evidence,
    project_signal_eligible: false,
    canonical_identity: false,
  });
}

export function regionalCountsV9_6_2(items) {
  const counts = { international: 0, us: 0, europe: 0, other: 0 };
  for (const item of items || []) {
    const result = classifyInternationalV9_6_2(item);
    if (!result) continue;
    counts.international += 1;
    if (result.region === "US") counts.us += 1;
    else if (result.region === "EUROPE") counts.europe += 1;
    else counts.other += 1;
  }
  return Object.freeze(counts);
}
