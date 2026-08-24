import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const CLASSIFIER_VERSION = "v9.7.0";

const SOLAR = /\b(?:solar|photovoltaic(?:s)?|pv|agrivoltaic(?:s)?)\b/i;
const BESS = /\b(?:bess|battery|batteries|energy storage|grid storage)\b/i;
const UTILITY_CONTEXT = /\b(?:project|projects|system|systems|portfolio|plant|farm|construction|commission(?:ed|ing)?|financ(?:e|ed|ing|ial)|acquir(?:e|es|ed|ing)|acquisition|stake|market|grid|utility|utilities|capacity|operations|services|deal|deals|proposal|online|developer|cluster|roundup|rfps?|facility|facilities|mw|mwh|gw|gwh|nem|tso)\b/i;
const UK = /\b(?:UK|U\.K\.|United Kingdom|Britain|British|England|English|Scotland|Scottish|Wales|Welsh|Northern Ireland|North Yorkshire|Lincolnshire|Nottinghamshire|Devon|Cornish|Cumbria|Suffolk|Kent|Surrey|Gloucestershire|Oxfordshire|Warwickshire|Yorkshire|Essex|Norfolk|Somerset|Dorset|Lancashire|Derbyshire|Leicestershire|Cambridgeshire|Bedfordshire|Hertfordshire|Buckinghamshire|Worcestershire|Shropshire|Staffordshire|Cheshire|Northumberland|Tyne and Wear|Greater Manchester|Merseyside|West Midlands|East Sussex|West Sussex|County Durham|Ayrshire|Aberdeenshire)\b/i;

const LOCATION_RULES = [
  { region: "US", country: "United States", label: "US acronym", regex: /\b(?:US|USA)\b(?!\$)|\bU\.S\.(?:A\.)?(?!\$)/ },
  { region: "US", country: "United States", label: "United States", regex: /\bUnited States\b/i },
  { region: "US", country: "United States", label: "US state or city", regex: /\b(?:New Jersey|Virginia|California|Arizona|Texas|New York|Florida|Illinois|Ohio|Pennsylvania|Colorado|Nevada|Oregon|Washington State|Massachusetts|Connecticut|Maryland|Michigan|Minnesota|Wisconsin|Georgia|North Carolina|South Carolina|Tennessee|Kentucky|Indiana|Iowa|Kansas|Missouri|Oklahoma|New Mexico|Utah|Idaho|Montana|Wyoming|Maine|Vermont|New Hampshire|Rhode Island|Delaware|West Virginia|Alabama|Mississippi|Louisiana|Arkansas|Nebraska|South Dakota|North Dakota|Hawaii|Alaska|Tucson)\b/i },
  { region: "EUROPE", country: "European Union", label: "EU acronym", regex: /\bEU\b/ },
  { region: "EUROPE", country: "Europe", label: "Europe", regex: /\b(?:Europe|European Union)\b/i },
  { region: "EUROPE", country: "Ireland", label: "Ireland", regex: /\b(?:Ireland|Irish)\b/i },
  { region: "EUROPE", country: "Germany", label: "Germany", regex: /\b(?:Germany|German)\b/i },
  { region: "EUROPE", country: "France", label: "France", regex: /\b(?:France|French)\b/i },
  { region: "EUROPE", country: "Spain", label: "Spain", regex: /\b(?:Spain|Spanish)\b/i },
  { region: "EUROPE", country: "Italy", label: "Italy", regex: /\b(?:Italy|Italian)\b/i },
  { region: "EUROPE", country: "Switzerland", label: "Switzerland", regex: /\b(?:Switzerland|Swiss)\b/i },
  { region: "EUROPE", country: "Romania", label: "Romania", regex: /\b(?:Romania|Romanian)\b/i },
  { region: "EUROPE", country: "Greece", label: "Greece", regex: /\b(?:Greece|Greek)\b/i },
  { region: "EUROPE", country: "Europe", label: "European country", regex: /\b(?:Netherlands|Dutch|Belgium|Belgian|Poland|Polish|Portugal|Portuguese|Denmark|Danish|Sweden|Swedish|Norway|Norwegian|Finland|Finnish|Austria|Austrian|Czechia|Czech|Bulgaria|Bulgarian|Hungary|Hungarian|Croatia|Croatian|Serbia|Serbian|Slovenia|Slovakia|Estonia|Latvia|Lithuania|Ukraine|Moldova|Luxembourg|Cyprus|Malta|Iceland|Kosovo|Albania|Bosnia|Montenegro|North Macedonia)\b/i },
  { region: "INTERNATIONAL_OTHER", country: "Australia", label: "Australia", regex: /\b(?:Australia|Australian)\b/i },
  { region: "INTERNATIONAL_OTHER", country: "Japan", label: "Japan", regex: /\b(?:Japan|Japanese)\b/i },
  { region: "INTERNATIONAL_OTHER", country: "Chile", label: "Chile", regex: /\bChile\b/i },
  { region: "INTERNATIONAL_OTHER", country: "South Korea", label: "South Korea", regex: /\b(?:South Korea|Republic of Korea)\b/i },
  { region: "INTERNATIONAL_OTHER", country: "International", label: "non-UK country", regex: /\b(?:Canada|India|China|Chinese|South Africa|New Zealand|Brazil|Brazilian|Mexico|Mexican|UAE|United Arab Emirates|Saudi Arabia|Taiwan|Philippines|Argentina|Turkey|Turkiye|Israel|Vietnam|Indonesia|Thailand|Singapore|Africa|Asia|Latin America|Middle East)\b/i },
];

const GENERIC_PROJECT = new Set([
  "and", "the", "farm", "solar", "battery", "bess", "storage", "energy", "park", "site",
  "road", "lane", "wind", "offshore", "onshore", "project", "phase", "extension", "facility",
  "system", "scheme", "development", "power", "limited", "ltd", "centre", "center", "grid",
  "services", "complex", "south", "north", "east", "west", "southern", "northern", "eastern",
  "western", "california", "virginia", "jersey", "australia", "germany", "france", "spain",
  "italy", "ireland", "romania", "greece", "chile", "japan",
]);

const normalise = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function technologyEvidence(headline) {
  const solar = headline.match(SOLAR)?.[0] || "";
  const bess = headline.match(BESS)?.[0] || "";
  return {
    technology: solar && bess ? "SOLAR + BESS" : solar ? "SOLAR" : bess ? "BESS" : "",
    terms: [solar, bess].filter(Boolean),
  };
}

function inheritedUkEvidence(item) {
  if (item?.canonical_relevant === true) return "canonical REPD PRIMARY_MATCH";
  const headline = String(item?.headline || "");
  if (UK.test(headline)) return `explicit UK geography: ${headline.match(UK)?.[0]}`;
  const normalisedHeadline = normalise(headline);
  const projectToken = normalise(item?.project).split(" ")
    .find((token) => token.length >= 5 && !GENERIC_PROJECT.has(token) && normalisedHeadline.includes(token));
  if (projectToken && String(item?.county || "").trim()) return `inherited UK project veto: ${projectToken}`;
  return "";
}

export function classifyRegionalV9_7(item) {
  const headline = String(item?.headline || "").trim();
  const technology = technologyEvidence(headline);
  const ukEvidence = inheritedUkEvidence(item);
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
  const context = headline.match(UTILITY_CONTEXT)?.[0] || "";
  if (!context) {
    return { ...base, decision: "ABSTAIN_NO_UTILITY_CONTEXT", reason: "technology term lacks utility-scale project or market context" };
  }
  const location = LOCATION_RULES.find((rule) => rule.regex.test(headline));
  if (!location) {
    return { ...base, decision: "ABSTAIN_NO_EXPLICIT_GEOGRAPHY", reason: "no explicit, case-safe non-UK geography", evidence: [...technology.terms, context] };
  }
  const locationMatch = headline.match(location.regex)?.[0] || location.label;
  return {
    decision: "ACCEPT_REGIONAL",
    reason: "explicit non-UK geography with utility-scale solar or battery context",
    region: location.region,
    country: location.country,
    technology: technology.technology,
    evidence: [...technology.terms, context, locationMatch],
  };
}

function stableId(item) {
  return `GG2050-REGION-${sha256(`${item.url || ""}\n${item.headline || ""}`).slice(0, 16).toUpperCase()}`;
}

export function buildRegionalArtifacts(items, sourceMeta) {
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

async function main() {
  const releaseRoot = fileURLToPath(new URL("../../", import.meta.url));
  const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const contractPath = `${releaseRoot}contracts/regional-news-sources.v9.7.json`;
  const sourceContractText = await readFile(contractPath, "utf8");
  const sourceContract = JSON.parse(sourceContractText);
  const sourceMeta = sourceContract.adapters.find((adapter) => adapter.enabled);
  const inputPath = `${repoRoot}${sourceMeta.input}`;
  const inputText = await readFile(inputPath, "utf8");
  const input = JSON.parse(inputText);
  const { regional, ledger, telemetry } = buildRegionalArtifacts(input[sourceMeta.input_collection], sourceMeta);
  const regionalText = `${JSON.stringify(regional, null, 2)}\n`;
  const ledgerText = `${JSON.stringify(ledger, null, 2)}\n`;
  const manifest = {
    schema: "globalgrid2050.regional-news-manifest.v9.7",
    release: "9.7",
    snapshot_at: sourceContract.snapshot_at,
    classifier_version: CLASSIFIER_VERSION,
    source_adapter: sourceMeta,
    telemetry,
    hashes: {
      source_contract_sha256: sha256(sourceContractText),
      input_sha256: sha256(inputText),
      regional_news_sha256: sha256(regionalText),
      decision_ledger_sha256: sha256(ledgerText),
    },
  };
  const outputDir = `${releaseRoot}data/v9.7`;
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(`${outputDir}/regional_news.json`, regionalText),
    writeFile(`${outputDir}/regional_decisions.json`, ledgerText),
    writeFile(`${outputDir}/regional_manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`),
  ]);
  process.stdout.write(`V9.7 regional build: ${telemetry.accepted_count}/${telemetry.input_count} accepted; ${JSON.stringify(telemetry.by_region)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
