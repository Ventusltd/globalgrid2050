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

export function geographyEvidenceV9_7(headline) {
  const value = String(headline || "");
  const rule = LOCATION_RULES.find((candidate) => candidate.regex.test(value));
  if (!rule) return null;
  return Object.freeze({
    region: rule.region,
    country: rule.country,
    evidence: value.match(rule.regex)?.[0] || rule.label,
  });
}
