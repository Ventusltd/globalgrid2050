/* GlobalGrid2050 public wording layer (testcode 202609141754).
 *
 * The origin repositories (stars, spiders, star-maker, ventus-grid-engine) keep
 * their own names and vocabulary; that is where the thinking lives. Pages served
 * to the public read the same live data through this file, which turns what a
 * reader SEES into plain engineering and business language.
 *
 * What it never changes: web addresses, file paths, repository names used as
 * names, commit hashes, numbers. A term inside a path is an address, not
 * language, and changing it would break the link.
 *
 * Usage: Corporate.text(s)   plain text or HTML fragment -> corporate wording
 *        Corporate.type(t)   node or relationship type -> display label
 *        Corporate.graphTitle(id, fallback) / graphDescription(id, fallback)
 *        Corporate.link(url) origin page URL -> corporate page URL, if one exists
 */
(function (root) {
  "use strict";

  // Physical things: repositories and their published sites keep their names.
  const REPOS = ["star-maker", "stars", "spiders", "ventus-grid-engine", "code-generator", "genome-spider", "seer-spider"];

  // Sentences or fragments that are metaphor only and carry no engineering fact.
  const DROP = [
    /\s*·\s*shells\s+K\d+\s+L\d+\s+M\d+/gi,
    /\s*·\s*valence\s+\d+/gi,
    /\s*·\s*spin\s+\w+/gi,
    /\s*·\s*mass\s+[\d.]+/gi,
    /\s*·\s*field\s+[\d.]+/gi,
    /\s*[·—–-]\s*holds no copy of the souls it bonds with/gi,
    /\s*[·—–-]\s*every bond is a tunnel/gi,
  ];

  // Ordered: longer phrases first. Each is [pattern, replacement].
  const PHRASES = [
    [/\bfrom the (electron|soul|vedic|magnetar|chemistry|star-maker|modular|periodic) star\s*[·—–-]?\s*/gi, ""],
    [/\bfive-element classification\b/gi, "five-class classification"],
    [/\bfrom the (\w+) star\b/gi, "from the $1 sample"],
    [/\bThe Spider Sandbox\b/g, "Grid Engine Sandbox"],
    [/\bSpider Sandbox\b/gi, "Grid Engine Sandbox"],
    [/\bSpider dashboard\b/gi, "Grid Engine dashboard"],
    [/\bSpider graphs?\b/gi, m => /s$/i.test(m) ? "dependency graphs" : "dependency graph"],
    [/\bSpider features\b/gi, "Dashboard graph registration"],
    [/\bSpider universe\b/gi, "code map"],
    [/\bfederation-spider\b/gi, "federation scanner"],
    [/\bspider pattern\b/gi, "dependency pattern"],
    [/\bspider view\b/gi, "canvas view"],
    [/\bGenome and spiders\b/g, "Lineage and scanners"],
    [/\bthe spiders\b/gi, m => m[0] === "T" ? "The scanners" : "the scanners"],
    [/\bspider's\b/gi, "scanner's"],
    [/\bnumbered-code universe\b/gi, "numbered code base"],
    [/\bThe code universe\b/g, "The code base"],
    [/\bcode universe\b/gi, "code base"],
    [/\buniverse builder\b/gi, "code map builder"],
    [/\bparticle universe\b/gi, "block map"],
    [/\buniverses?\b/gi, m => /^U/.test(m) ? "Code map" : "code map"],
    [/\bcharted into sense\b/gi, "organised into an assessment"],
    [/\bperiodic table of globalgrid2050\b/gi, "Block register"],
    [/\bperiodic tables?\b/gi, m => /^P/.test(m) ? "Block register" : "block register"],
    [/\bperiodic\b/gi, "block"],
    [/\bChemistry, Vedic and Random\b/g, "Compatibility, Classification and Sampling"],
    [/\bchemistry\b/gi, m => /^C/.test(m) ? "Compatibility" : "compatibility"],
    [/\bvedic\b/gi, m => /^V/.test(m) ? "Classification" : "classification"],
    [/\bModular star\b/g, "Code scan"],
    [/\bmodular star\b/g, "code scan"],
    [/\bStarmaker\b/g, "Test bench"],
    [/\bthe stars\b/gi, m => m[0] === "T" ? "The test records" : "the test records"],
    [/\bfront door\b/gi, m => /^F/.test(m) ? "Overview" : "overview"],
    [/\bstarquakes?\b/gi, "changes"],
    [/\bdrawn toward\b/gi, "linked to"],
    [/\bhomes\b(?=\s+\S)/g, "used in"],
    [/\bcompounds\b/gi, "combinations"],
    [/\bcompound\b/gi, "combination"],
    [/\bdecays_to\b/gi, "fails with"],
    [/\bdecays\b/gi, "failures"],
    [/\bdecay\b/gi, "failure"],
    [/\belements\b(?=\s*\()/gi, "Components"],
    [/\belement\b(?=\s*·)/gi, "component"],
    [/\bparticles?\b/gi, m => /s$/i.test(m) ? "points" : "point"],
    [/\bgenome\b/gi, m => /^G/.test(m) ? "Lineage" : "lineage"],
    [/\bmagnetars?\b/gi, "repository"],
    [/\bsouls?\b/gi, "test code"],
    [/\belectrons?\b/gi, "function"],
    [/\bstars\b/gi, m => /^S/.test(m) ? "Records" : "records"],
    [/\bstar\b/gi, m => /^S/.test(m) ? "Record" : "record"],
    [/\bspiders\b/gi, m => /^S/.test(m) ? "Scanners" : "scanners"],
    [/\bspider\b/gi, m => /^S/.test(m) ? "Scanner" : "scanner"],
    [/\borbits?\b/gi, "surrounds"],
    [/\bjourneys?\b/gi, m => /^J/.test(m) ? "Navigation" : "navigation"],
    [/🕷\s*/g, ""],
  ];

  const TYPES = {
    element: "component", "library element": "library component", decay: "failure",
    electron: "function", soul: "test code", vedic: "classified item", magnetar: "repository",
    chemistry: "component test", star: "record",
    DECAYS_TO: "fails with", IS_MADE_OF: "made of",
    MIGHT_TOUCH: "may affect", RHYMES_WITH: "similar to", WHAT_IF: "worth checking",
    COULD_REPLACE: "could replace", ENTANGLED_MAYBE: "possibly coupled", REMINDS_OF: "resembles",
  };

  const GRAPHS = {
    overview: ["Grid Engine overview", "One card per dependency graph; each opens that graph."],
    federation: ["Repositories", "The public repositories and how they relate: data, interface, governance and external services."],
    "engine-graph": ["Engine modules", "The engine's canonical modules, the copies measured against them and where they have drifted."],
    "genome-spider": ["Lineage scanner output", "Reserved for the lineage scanner's output; no data published yet."],
    "gridatlas-lineage": ["Grid Atlas lineage", "Grid Atlas's current composition and its ancestry: which cartridges it composed, which modules built each cartridge, and any module that has changed since."],
    "globalgrid2050-contents": ["globalgrid2050 contents", "The declared contents of the globalgrid2050 repository."],
  };

  const PAGE_LINKS = [
    [/^https:\/\/ventusltd\.github\.io\/stars\/table\.html/, "../block-register/index.html"],
    [/^https:\/\/ventusltd\.github\.io\/stars\/code\.html/, "../code-record/index.html"],
    [/^https:\/\/ventusltd\.github\.io\/stars\/((?:reports|modular|sense|proof|structure|decisions|blocks)\/[^?#]+\.md)$/, "https://github.com/Ventusltd/stars/blob/main/$1"],
    [/^https:\/\/ventusltd\.github\.io\/ventus-grid-engine\/(\?.*)?$/, "../grid-engine/index.html$1"],
  ];

  // Everything that is an address or a name: kept byte for byte.
  const KEEP = new RegExp(
    [
      String.raw`https?:\/\/[^\s"'<>]+`,
      String.raw`<[^>]+>`,                                   // HTML tags and their attributes
      String.raw`&[a-z#0-9]+;`,
      String.raw`[\w.@-]*\/[\w./@{}-]*`,                     // anything with a slash: a path
      String.raw`\b[\w-]+\.(?:html?|m?js|json|md|css|py|ya?ml|txt|csv)\b`,
      String.raw`\b(?:` + REPOS.map(r => r.replace(/-/g, "\\-")).join("|") + String.raw`)\b(?=\s+(?:repository|repo|machinery|genome|site|\S*\/))`,
      String.raw`\b[0-9a-f]{7,40}\b`,
    ].join("|"),
    "g"
  );

  function words(s) {
    for (const re of DROP) s = s.replace(re, "");
    for (const [re, rep] of PHRASES) s = s.replace(re, rep);
    return s;
  }

  function text(s) {
    if (s == null) return s;
    s = String(s);
    let out = "", last = 0;
    KEEP.lastIndex = 0;
    for (let m; (m = KEEP.exec(s)); ) {
      if (m.index === KEEP.lastIndex) KEEP.lastIndex++;
      out += words(s.slice(last, m.index)) + m[0];
      last = m.index + m[0].length;
    }
    return out + words(s.slice(last));
  }

  // A label that IS a repository name stays a name.
  function label(s, type) {
    if (type === "repo" || type === "repository" || REPOS.includes(String(s))) return s;
    return text(s);
  }

  function type(t) {
    if (t == null) return t;
    return TYPES[t] || TYPES[String(t).toLowerCase()] || text(String(t));
  }

  function graphTitle(id, fallback) { return (GRAPHS[id] && GRAPHS[id][0]) || text(fallback); }
  function graphDescription(id, fallback) { return (GRAPHS[id] && GRAPHS[id][1]) || text(fallback); }

  function link(url) {
    if (!url) return url;
    for (const [re, rep] of PAGE_LINKS) if (re.test(url)) return url.replace(re, rep);
    return url;
  }

  // Public addresses for graph ids; the origin id still works.
  const GRAPH_ALIASES = {
    repositories: "federation", "module-map": "engine-graph", "engine-modules": "engine-graph",
    applications: "generated-apps", assessment: "sense", audit: "proof-of-work",
    classification: "vedic", compatibility: "chemistry", inventory: "periodic-table",
    reuse: "modular", sampling: "random", lineage: "gridatlas-lineage",
  };
  function graphId(id) { return GRAPH_ALIASES[id] || id; }

  const api = { text, label, type, graphTitle, graphDescription, link, graphId, REPOS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Corporate = api;
})(typeof window !== "undefined" ? window : globalThis);
