import { buildAtlasV9DeepLink } from "./202609040044-atlas-pointer-deep-link.mjs";

const GENERATION = "202608291447";
const EXPECTED_COMPILER_METHOD = "pipelinenews-atlas-pointer-exact-identity-successor-v2";
const EXPECTED_CACHE_IDENTITY = "d439dda1793f26dabad006df78dfce43e0add0e7c8a57e079e1fd3b6f0b24c6c";
const REGISTRY_URL = "data/202608291447-registry.json";
const WINDOW_SIZE = 100;
const NEWS_WINDOW_SIZE = 30;
const DETAIL_CONCURRENCY = 4;

const PROJECT_FIELDS = Object.freeze([
  "repd_ref",
  "gg_project_id",
  "name",
  "technology",
  "status",
  "capacity_mw",
  "county",
  "region",
  "operator",
  "repd_record_updated",
  "geometry_status",
  "latitude",
  "longitude",
]);

const NEWS_FIELDS = Object.freeze([
  "gg_article_id",
  "repd_ref",
  "gg_project_id",
  "project",
  "technology",
  "capacity_mw",
  "operator",
  "county",
  "country",
  "event",
  "headline",
  "published",
  "source",
  "url",
  "confidence",
  "canonical_relevant",
  "role",
  "eligible_for_news_signal",
  "regional_classification",
  "regional_technology",
  "regional_evidence",
  "event_detail",
  "relationship",
  "related_context_repd_ref",
  "related_context_project",
  "binding_label",
  "related_components",
  "evidence_snippet",
]);

const FIELD = Object.freeze({
  repdRef: 0,
  projectId: 1,
  name: 2,
  technology: 3,
  status: 4,
  capacity: 5,
  county: 6,
  region: 7,
  operator: 8,
  updated: 9,
  geometry: 10,
  latitude: 11,
  longitude: 12,
});

const NEWS_FIELD = Object.freeze({
  articleId: 0,
  repdRef: 1,
  projectId: 2,
  project: 3,
  technology: 4,
  capacity: 5,
  operator: 6,
  county: 7,
  country: 8,
  event: 9,
  headline: 10,
  published: 11,
  source: 12,
  url: 13,
  confidence: 14,
  canonical: 15,
  role: 16,
  eligible: 17,
  region: 18,
  regionalTechnology: 19,
  regionalEvidence: 20,
  eventDetail: 21,
  relationship: 22,
  relatedContextRepdRef: 23,
  relatedContextProject: 24,
  bindingLabel: 25,
  relatedComponents: 26,
  evidenceSnippet: 27,
});

const LABELS = Object.freeze({
  solar: "Solar",
  bess: "Battery Storage",
  wind_onshore: "Onshore Wind",
  wind_offshore: "Offshore Wind",
});
const COLOURS = Object.freeze({
  solar: "#ffff00",
  bess: "#ffae00",
  wind_onshore: "#00ffff",
  wind_offshore: "#0066ff",
});
const UNITS = Object.freeze({ solar: "MWp", bess: "MW", wind_onshore: "MW", wind_offshore: "MW" });
const TECHNOLOGIES = new Set(["all", "solar", "bess", "wind_onshore", "wind_offshore"]);
/* The four the product draws as tabs, and ALL. This list is the TABS, not the
   register: populateStatuses() adds every status the payload actually carries,
   so ?status= answers for all of them and a status DESNZ adds tomorrow needs no
   edit here. A hand-kept list of the register's own values is the mistake this
   product already made once with technology. */
const STATUS_TABS = Object.freeze(["All", "Operational", "Under Construction",
  "Awaiting Construction", "Application Submitted"]);
const STATUSES = new Set(STATUS_TABS);
const SORTS = new Set(["capacity_desc", "capacity_asc", "updated_desc", "updated_asc",
  "county_asc", "county_desc", "town_asc", "town_desc", "postcode_asc", "postcode_desc",
  "grid_asc", "grid_desc"]);

// Which heading each sort mode belongs to, so one function can drive every
// aria-sort and every indicator instead of five near-identical ones.
const SORT_HEADINGS = {
  capacity: { header: "capacityHeader", indicator: "capacitySortIndicator", asc: "capacity_asc", desc: "capacity_desc", first: "capacity_desc" },
  updated: { header: "repdUpdatedHeader", indicator: "updatedSortIndicator", asc: "updated_asc", desc: "updated_desc", first: "updated_desc" },
  county: { header: "countyHeader", indicator: "countySortIndicator", asc: "county_asc", desc: "county_desc", first: "county_asc" },
  town: { header: "townHeader", indicator: "townSortIndicator", asc: "town_asc", desc: "town_desc", first: "town_asc" },
  postcode: { header: "postcodeHeader", indicator: "postcodeSortIndicator", asc: "postcode_asc", desc: "postcode_desc", first: "postcode_asc" },
};

// The locality payload: town, postcode and planning authority, keyed by REPD
// ref. Resolved at BUILD time (see the cartridge's build_payload.py) so the
// table never touches the network. Null until it lands, and null forever if
// the fetch fails -- the table renders either way.
let locality = null;

function localityFor(item) {
  return (locality && locality[String(item.repd_ref)]) || null;
}

// The grid-distance payload: the nearest mapped circuit per REPD ref, carried
// across from the GRID panel's own payload and verified at build time against
// Ventusltd/grid-distance-maths. Slim on purpose -- the panel's payload is
// 5.5 MB and is fetched only when a user opens it; this is 240 KB and is
// fetched once at boot because a column needs every row.
//
// Null until it lands, and null forever if the fetch fails. The column then
// reads "-" and every other column is untouched.
let gridDistance = null;

function gridFor(item) {
  return (gridDistance && gridDistance[String(item.repd_ref)]) || null;
}

// A distance the register cannot support is a dash, never a zero and never a
// large number standing in for "not found". Absence from a mapped layer is not
// absence on the ground.
// The nearest 33 kV+ substation, keyed by REPD ref. Scope is 33 kV and above:
// 11 kV is rare for utility-scale export and where it occurs is often a private
// network behind the meter, so it is not a screening signal. Every one of the
// 5,800 substations in the Atlas layer qualifies, so nothing is filtered out at
// runtime -- the scope is a property of the layer, recorded in the payload.
let substation = null;

function substationFor(item) {
  return (substation && substation[String(item.repd_ref)]) || null;
}

// The sentence a distance can never answer. Held in one place so the two chips
// and the strip cannot drift apart.
const HEADROOM_CAVEAT = "Fault level and thermal headroom cannot be inferred from "
  + "distance: they depend on DNO network data such as source impedance, fault "
  + "infeed and existing committed connections, and are established by a "
  + "connection study.";

function metricChip({ ready, hit, located, label, unitSuffix, lines }) {
  if (!ready) return `<span class="action-metric pending">${label} \u2026</span>`;
  if (!hit || typeof hit.k !== "number") {
    // One sentence covered two different silences, and it asserted a search
    // that never ran. Counted on this cut: 3,047 of the 7,680 records carry a
    // distance and 4,633 do not, and the grid-distance payload's own coverage
    // block records no_circuit: 0 -- not one project was measured and came up
    // empty. "No mapped feature found for this project" therefore described
    // none of the 4,633 rows it was printed on. 4,605 of them hold a register
    // coordinate and were simply not measured; the other 28 have no coordinate
    // to measure from. The row already knows which it is.
    //
    // The mapped-layer caveat is not repeated here. It qualifies a distance
    // that was measured against an incomplete layer, and no distance was
    // measured for this row; it still stands, verbatim, on every chip that
    // carries a number and in the GRID + SUB strip.
    const why = located
      ? "Not measured. 3,047 of the 7,680 records in this cut carry a grid measurement and 4,633 do not. This project has a register coordinate and is one of the 4,605 unmeasured records that do: no search was run for it, so none failed."
      : "Not measurable. The register publishes no usable coordinate for this project, so there is no point on the ground to measure from. 28 of the 7,680 records are in that state, 26 missing and 2 invalid. The record stays searchable and exportable."
    return `<span class="action-metric" title="${why}">${label} -</span>`;
  }
  // No band attribute is emitted, so nothing downstream can style or read
  // a verdict back out of the DOM. The distance is the whole claim.
  const band = "";
  const title = escapeHtml(lines.filter(Boolean).join(" \u00b7 "));
  return `<span class="action-metric"${band} title="${title}">${label}`
    + `<b>${hit.k.toFixed(2)}</b><span class="unit">km${unitSuffix}</span></span>`;
}

// Distance to the nearest mapped circuit, at 33 kV and above.
function gridActionHtml(item) {
  const hit = gridFor(item);
  const lines = [];
  if (hit && typeof hit.k === "number") {
    lines.push(`Nearest mapped circuit ${hit.k.toFixed(2)} km${hit.v ? ` at ${hit.v} kV` : ""}`);
    if (typeof hit.t === "number") lines.push(`transmission ${hit.t.toFixed(2)} km${hit.tv ? ` (${hit.tv} kV)` : ""}`);
    if (typeof hit.d === "number") lines.push(`distribution ${hit.d.toFixed(2)} km${hit.dv ? ` (${hit.dv} kV)` : ""}`);
    lines.push("Straight-line to mapped geometry, not a cable route or a connection length.");
    lines.push(HEADROOM_CAVEAT);
  }
  return metricChip({
    ready: Boolean(gridDistance), hit, located: item.geometry_status === "valid",
    label: "GRID",
    unitSuffix: hit && hit.v ? ` \u00b7 ${hit.v}kV` : "", lines,
  });
}

// Distance to the nearest 33 kV+ substation -- for a scheme of a few tens of MW
// this is closer to where it would actually connect than the circuit is.
function substationActionHtml(item) {
  const hit = substationFor(item);
  const lines = [];
  if (hit && typeof hit.k === "number") {
    lines.push(`Nearest substation at 33 kV or above, ${hit.k.toFixed(2)} km`
      + (hit.n ? ` \u2014 ${hit.n}` : "")
      + (hit.v && hit.v.length ? ` (${hit.v.join("/")} kV)` : ""));
    lines.push("A mapped substation point does not confirm capacity, voltage suitability, connection rights, queue position or acceptance by any network party.");
    lines.push(HEADROOM_CAVEAT);
  }
  return metricChip({
    ready: Boolean(substation), hit, located: item.geometry_status === "valid",
    label: "SUB", unitSuffix: "", lines,
  });
}

// Blanks sort last in BOTH directions. A project with no postcode has not got
// a small postcode; pushing it to the bottom either way keeps the populated
// rows contiguous, which is the whole point of clustering by locality.
function compareText(leftText, rightText, direction) {
  const left = leftText || "";
  const right = rightText || "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return direction * left.localeCompare(right, "en-GB");
}
const FINANCE_EVENTS = new Set(["FINANCIAL CLOSE", "ACQUISITION"]);

const immutablePromises = new Map();

class FetchQueue {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.maximumActive = 0;
    this.pending = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject });
      this.drain();
    });
  }

  drain() {
    while (this.active < this.limit && this.pending.length) {
      const entry = this.pending.shift();
      this.active += 1;
      this.maximumActive = Math.max(this.maximumActive, this.active);
      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}

const detailQueue = new FetchQueue(DETAIL_CONCURRENCY);
const detailPromises = new Map();
const detailByRef = new Map();
const charts = { capacity: null, projects: null, largest: null };

let registry = null;
let projectPayload = null;
let rows = [];
let dictionaries = null;
let searchSupplement = null;
let newsRows = [];
let filtered = [];
let updatedTimes = [];
let windowStart = 0;
let newsStart = 0;
let technology = "all";
let status = "All";
let county = "All";
let query = "";
let requestedRepdRef = "";
let sortMode = "capacity_desc";
let newsMode = "ALL";
let newsQuery = "";
let searchTimer = null;
let controlsBound = false;

const runtimeEvidence = {
  generation: GENERATION,
  detailConcurrency: DETAIL_CONCURRENCY,
  maximumDetailConcurrency: 0,
  detailRequests: 0,
  newsRequests: 0,
  searchRequests: 0,
  chartsReady: false,
  newsReady: false,
  searchReady: false,
  sectorIntelligenceImports: 0,
  sectorPayloadRequestsAtMount: 0,
  federatedRelationshipImports: 0,
  federatedRelationshipPayloadRequests: 0,
  projectIntelligenceImports: 0,
  projectIntelligencePayloadRequests: 0,
  localityRequests: 0,
  localityReady: false,
  gridDistanceRequests: 0,
  gridDistanceReady: false,
  substationRequests: 0,
  substationReady: false,
  gridProximityImports: 0,
  gridProximityPayloadRequests: 0,
  gbElectricityImports: 0,
  gbElectricityPayloadRequests: 0,
  widerFleetImports: 0,
  widerFleetPayloadRequests: 0,
};
globalThis.__PIPELINENEWS_FAST__ = runtimeEvidence;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function normalise(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-GB")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function invariant(condition, message) {
  if (!condition) throw new Error(`PipelineNews V9 timestamped runtime: ${message}`);
}

function arraysEqual(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

async function hashJson(value) {
  invariant(globalThis.crypto?.subtle, "Web Crypto unavailable for cache-contract verification");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function fetchImmutable(url, { timeoutMs = 15000 } = {}) {
  const target = new URL(url, document.baseURI);
  invariant(target.origin === location.origin, `cross-origin cartridge rejected: ${target.href}`);
  const key = target.href;
  if (immutablePromises.has(key)) return immutablePromises.get(key);
  const promise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target, { cache: "force-cache", signal: controller.signal });
      invariant(response.ok, `${target.pathname} returned HTTP ${response.status}`);
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  })();
  immutablePromises.set(key, promise);
  promise.catch(() => immutablePromises.delete(key));
  return promise;
}

function dictionary(name, index) {
  return dictionaries[name][index] ?? "";
}

function project(index) {
  const row = rows[index];
  return {
    index,
    row,
    repd_ref: row[FIELD.repdRef],
    gg_project_id: row[FIELD.projectId],
    name: row[FIELD.name],
    technology: dictionary("technology", row[FIELD.technology]),
    status: dictionary("status", row[FIELD.status]),
    capacity_mw: Number(row[FIELD.capacity]),
    county: dictionary("county", row[FIELD.county]),
    region: dictionary("region", row[FIELD.region]),
    operator: dictionary("operator", row[FIELD.operator]),
    repd_record_updated: row[FIELD.updated],
    geometry_status: dictionary("geometry_status", row[FIELD.geometry]),
    latitude: row[FIELD.latitude],
    longitude: row[FIELD.longitude],
  };
}

// The prebuilt search index (generation 202608270055) predates these columns,
// and it is an immutable asset behind a cache_identity invariant, so it cannot
// be extended. County and region were always in it; town, postcode and
// planning authority are appended here instead, at query time.
const localitySearchCache = new Map();

function localitySearchText(index) {
  if (!locality) return "";                 // nothing to cache yet
  if (localitySearchCache.has(index)) return localitySearchCache.get(index);
  const place = locality[String(project(index).repd_ref)];
  let text = "";
  if (place) {
    // Both spellings of the postcode, so "CT19 4RH" and "CT194RH" both hit,
    // and so does the bare outcode.
    const postcode = place.postcode || "";
    text = normalise([place.town, place.authority, postcode,
                      postcode.replace(/\s+/gu, "")].filter(Boolean).join(" "));
  }
  localitySearchCache.set(index, text);
  return text;
}

function searchTextFor(index) {
  const base = searchSupplement?.[index] || compactSearchText(index);
  const extra = localitySearchText(index);
  return extra ? `${base} ${extra}` : base;
}

function compactSearchText(index) {
  const item = project(index);
  return normalise([
    item.name,
    item.operator,
    item.repd_ref,
    item.gg_project_id,
    item.technology,
    item.status,
    item.capacity_mw,
    item.county,
    item.region,
    item.repd_record_updated,
    item.geometry_status,
  ].join(" "));
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

function displayDate(value) {
  if (!value) return "not supplied by REPD";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
}

function updatedTimestamp(index) {
  return updatedTimes[index] ?? null;
}

function atlasUrl(item) {
  return buildAtlasV9DeepLink(item);
}

function signalFor(item) {
  const signal = registry.signals[item.repd_ref];
  if (!signal) return { label: "—", cls: "none", note: "no exact canonical PRIMARY_MATCH" };
  const [eventValue, confidence, published] = signal;
  const event = String(eventValue || "PROJECT UPDATE").toUpperCase();
  if (event === "CONSENT") return { label: "APPROVED*", cls: "approved", note: `canonical PRIMARY_MATCH ${confidence}% · unverified event · ${published}` };
  if (event === "OPERATIONAL") return { label: "OPERATIONAL*", cls: "operational", note: `canonical PRIMARY_MATCH ${confidence}% · unverified event · ${published}` };
  if (event === "CONSTRUCTION") return { label: "CONSTRUCTION*", cls: "construction", note: `canonical PRIMARY_MATCH ${confidence}% · unverified event · ${published}` };
  if (FINANCE_EVENTS.has(event)) return { label: event === "ACQUISITION" ? "M&A*" : "FINANCED*", cls: "finance", note: `canonical PRIMARY_MATCH ${confidence}% · unverified event · ${published}` };
  return { label: `${event}*`.slice(0, 22), cls: "", note: `canonical PRIMARY_MATCH ${confidence}% · unverified event · ${published}` };
}

function relationshipSummary(item) {
  const development = Array.isArray(item.development_repd_refs) ? item.development_repd_refs.length : 0;
  const direct = Array.isArray(item.direct_related_repd_refs) ? item.direct_related_repd_refs.length : 0;
  const siblings = Array.isArray(item.planning_sibling_repd_refs) ? item.planning_sibling_repd_refs.length : 0;
  return `${development} development · ${direct} direct · ${siblings} planning sibling record(s)`;
}

function rowHtml(index) {
  const item = project(index);
  const label = LABELS[item.technology];
  const signal = signalFor(item);
  const locationText = [item.county, item.region].filter(Boolean).join(" · ");
  const place = localityFor(item);
  // A town the register cannot source is a dash, never a guess. One taken from
  // the address rather than from ONS is shown dimmed and says so on hover.
  const townCell = !locality
    ? "…"
    : place?.town
      ? (place.town_source === "derived"
        ? `<span class="derived" title="Derived from the REPD address line; no postcode in the register to resolve against ONS">${escapeHtml(place.town)}</span>`
        : `<span title="ONS Postcode Directory (${escapeHtml(place.town_source)})">${escapeHtml(place.town)}</span>`)
      : "-";
  const news = new URL("https://www.google.com/search");
  news.searchParams.set("q", `${item.name} ${label} UK`);
  news.searchParams.set("tbm", "nws");
  const atlas = atlasUrl(item);
  const mapAction = atlas
    ? `<a class="action-link atlaslink" target="_blank" rel="noopener" href="${escapeHtml(atlas)}">MAP ↗</a>`
    : '<span class="action-disabled" title="REPD geometry is unavailable; the record remains searchable and exportable">NO MAP</span>';
  return `<tr id="repd-${escapeHtml(item.repd_ref)}" data-project-index="${index}"><td class="site">${escapeHtml(item.name)}<div class="project-meta">REPD ${escapeHtml(item.repd_ref)} · ${escapeHtml(item.gg_project_id)} · UPDATED ${escapeHtml(displayDate(item.repd_record_updated))}</div><div class="mobile-extra">${escapeHtml([locationText, item.operator].filter(Boolean).join(" | "))}</div><details class="project-record" data-detail-index="${index}"><summary>PROJECT RECORD</summary><div class="record-grid"><div class="detail-loading">Open to load official project details…</div></div></details></td><td class="hide-mobile">${escapeHtml(locationText || "-")}</td><td class="hide-mobile town-cell">${townCell}</td><td class="hide-mobile reference-cell">${escapeHtml(place?.postcode || "-")}</td><td class="hide-mobile">${escapeHtml(item.operator || "-")}</td><td><span class="badge" style="background:${COLOURS[item.technology]}">${escapeHtml(label)}</span></td><td>${escapeHtml(item.status)}</td><td class="mw">${formatNumber(item.capacity_mw)} ${UNITS[item.technology]}</td><td class="hide-mobile reference-cell repd-ref">${escapeHtml(item.repd_ref)}</td><td class="hide-mobile reference-cell globalgrid-ref">${escapeHtml(item.gg_project_id)}</td><td class="hide-mobile reference-cell repd-updated">${escapeHtml(displayDate(item.repd_record_updated))}</td><td><span class="signal ${escapeHtml(signal.cls)}">${escapeHtml(signal.label)}</span><div class="signal-note">${escapeHtml(signal.note)}</div></td><td><div class="project-actions">${mapAction}${gridActionHtml(item)}${substationActionHtml(item)}<a class="action-link newslink" target="_blank" rel="noopener" href="${escapeHtml(news.href)}">NEWS ↗</a><button class="copy-id" type="button" data-copy-id="${escapeHtml(item.gg_project_id)}">COPY ID</button></div></td></tr>`;
}

function ensureWindowControls() {
  let panel = document.getElementById("projectWindowControls");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "projectWindowControls";
  panel.className = "project-window-controls";
  /* The buttons said PREVIOUS 50 and NEXT 50 and moved WINDOW_SIZE, which is
     100: from "1-100 of 7,680" one press reached "101-200 of 7,680". They also
     serve the wider-fleet cut, whose own page is 50, so no single number on
     these two buttons can be true of both. The range readout beside them
     already states the window exactly, for whichever cut is showing, so the
     number comes off the buttons rather than being made wrong in a second
     place. */
  panel.innerHTML = '<button type="button" data-window="previous">PREVIOUS</button><span data-window-range></span><button type="button" data-window="next">NEXT</button>';
  document.querySelector(".tablewrap").after(panel);
  panel.addEventListener("click", (event) => {
    const action = event.target.closest("[data-window]")?.dataset.window;
    if (!action) return;
    if (action === "previous") windowStart = Math.max(0, windowStart - WINDOW_SIZE);
    if (action === "next") windowStart = Math.min(Math.floor(Math.max(0, filtered.length - 1) / WINDOW_SIZE) * WINDOW_SIZE, windowStart + WINDOW_SIZE);
    renderTable();
  });
  return panel;
}

function renderTable() {
  const body = document.getElementById("tbody");
  const page = filtered.slice(windowStart, windowStart + WINDOW_SIZE);
  body.innerHTML = page.map(rowHtml).join("");
  const panel = ensureWindowControls();
  const end = Math.min(filtered.length, windowStart + WINDOW_SIZE);
  panel.querySelector("[data-window-range]").textContent = filtered.length
    ? `${windowStart + 1}–${end} of ${filtered.length.toLocaleString("en-GB")}`
    : "0 records";
  panel.querySelector('[data-window="previous"]').disabled = windowStart === 0;
  panel.querySelector('[data-window="next"]').disabled = end >= filtered.length;
}

function updateSortHeader() {
  for (const spec of Object.values(SORT_HEADINGS)) {
    const header = document.getElementById(spec.header);
    const indicator = document.getElementById(spec.indicator);
    if (!header || !indicator) continue;
    if (sortMode === spec.desc) {
      header.setAttribute("aria-sort", "descending");
      indicator.textContent = "▼";
    } else if (sortMode === spec.asc) {
      header.setAttribute("aria-sort", "ascending");
      indicator.textContent = "▲";
    } else {
      header.setAttribute("aria-sort", "none");
      indicator.textContent = "↕";
    }
  }
}

function updateChart(chart, value, maximum) {
  if (!chart) return;
  chart.data.datasets[0].data = [value, Math.max(maximum - value, 0)];
  chart.update("none");
}

function updateGauges(summary) {
  document.getElementById("v1").textContent = formatNumber(summary.capacity);
  document.getElementById("v2").textContent = summary.count.toLocaleString("en-GB");
  document.getElementById("v3").textContent = formatNumber(summary.largest);
  updateChart(charts.capacity, summary.capacity, registry.totals.capacity_mw || 1);
  updateChart(charts.projects, summary.count, registry.totals.project_count || 1);
  updateChart(charts.largest, summary.largest, registry.totals.largest_mw || 1);
}

function updateSummary(summary) {
  const element = document.getElementById("resultsMeta");
  element.textContent = `${summary.count.toLocaleString("en-GB")} of ${summary.total.toLocaleString("en-GB")} records · ${formatNumber(summary.capacity)} MW · largest ${formatNumber(summary.largest)} MW`;
  element.classList.toggle("is-filtered", summary.count !== summary.total);
  element.dataset.filteredCount = String(summary.count);
  element.dataset.totalCount = String(summary.total);
}

/* ── THE SUMMARY SEAM ─────────────────────────────────────────────

   Five surfaces of this product are derived from one summary: the record
   counter's four figures and its dataset, the three gauge numbers, the three
   gauge ARCS, and what EXPORT FILTERED CSV writes. Until this generation the
   maths behind them lived in two files. apply() computed a summary and drove
   the counter and the gauges from it; the wider-fleet cartridge computed the
   same three quantities itself and wrote only the gauge TEXT. Everything it
   did not write kept the previous technology's answer, and nothing announced
   it. Measured on 202609031308 and on 202609030009 before it, across all
   twenty wider-fleet technologies:

     counter    kept the previous technology's count, total, MW and largest
     dataset    kept is-filtered, filteredCount 3563, totalCount 7680
     arcs       g1/g2/g3 unchanged across a switch, byte for byte on toDataURL
     the page   on FLYWHEELS, #v3 read 400 while the counter read largest 840
     the CSV    exported 3,563 solar rows with one flywheel on screen, and
                said "3,563 filtered records exported" while doing it

   Four of those were visible and one left the building. Patching the visible
   three would have left the duplication that produced all five in place, so
   the fix is this function instead: ONE entry point, which every cut on the
   product's table calls with the figures it is showing, and which owns every
   surface a summary drives. A cut that is not the spine's own passes an
   exportProvider as well, because a cut that cannot honestly fill the spine's
   50-column CSV must say so rather than let the spine write somebody else's
   rows under its heading.

   `total` is the counter's second figure and is part of the shape for the
   same reason the other three are. The spine's own total is its register,
   rows.length, which is what it has always been and what a call that omits
   the field still gets. A wider-fleet cut is NOT part of that register --
   there is no flywheel among the spine's 7,680 -- so "1 of 7,680 records"
   would have been a fifth wrong number invented by the fix. It passes its
   own.

   Called with null, this restores nothing and repaints nothing. It drops the
   export provider and clears the export strip, and the spine's own apply()
   puts the product's figures back, as it already did. */

const EXPORT_META_DEFAULT = "CSV contains the current filtered rows only";

/* The export answer for the cut currently on screen. null means the spine's
   own `filtered` array is what EXPORT FILTERED CSV should write -- and that
   is the only state in which `filtered` describes the rows a reader can
   actually see. */
let presentedExport = null;

function presentSummary(summary) {
  presentedExport = null;
  const exportMeta = document.getElementById("exportMeta");
  if (exportMeta) {
    exportMeta.textContent = EXPORT_META_DEFAULT;
    exportMeta.classList.remove("is-declined");
    delete exportMeta.dataset.exportDeclinedColumns;
  }
  if (!summary) return;
  const shaped = {
    count: summary.count,
    total: typeof summary.total === "number" ? summary.total : rows.length,
    capacity: summary.capacity,
    largest: summary.largest,
  };
  updateSummary(shaped);
  updateGauges(shaped);
  presentedExport = typeof summary.exportProvider === "function"
    ? summary.exportProvider
    : null;
}

/* ── THE RELEASE SEAM ─────────────────────────────────

   The other half of the summary seam. presentSummary() lets a cut that is not
   the spine's own SAY what it is showing. This lets it be TOLD that the spine
   has taken the table back.

   Measured on 202609040144, live, with WIDER FLEET set to Landfill Gas
   (275 rows, 787.87 MW):

     control used            what the table then held        the control still said
     SORT county A–Z         24 solar, 45 battery, 31 wind   LANDFILL GAS
     COUNTY select           24 solar, 43 battery, 31 wind   LANDFILL GAS
     STATUS Operational       3 solar,  1 battery,  2 wind   LANDFILL GAS
     COUNTY column header     3 solar,  1 battery,  2 wind   LANDFILL GAS
     CLEAR FILTERS            9 solar, 36 battery, 55 wind   LANDFILL GAS

   Zero landfill gas rows in all five, and the wider-fleet note above the table
   went on describing a cut that was no longer on it. The cartridge let go on a
   click of one of the spine's five tabs and on nothing else, so every other
   control that repaints repainted underneath it.

   The fix is not a longer list of control ids. A hand-kept list of controls is
   the same mistake as a hand-kept list of technologies, one layer up, and the
   next control added to this product would not be on it. apply() is the single
   place the spine repaints from its own data — every one of the fourteen
   handlers ends there — so apply() is where the announcement belongs. A cut
   that is not the spine's own registers here and lets go when it fires. */

let spineRepaintListener = null;

function onSpineRepaint(listener) {
  spineRepaintListener = typeof listener === "function" ? listener : null;
}

function syncFilterUrl() {
  const url = new URL(location.href);
  for (const parameter of ["technology", "status", "county", "q", "sort", "repd_ref",
    "mw_min", "mw_max"]) url.searchParams.delete(parameter);
  if (technology !== "all") url.searchParams.set("technology", technology);
  if (status !== "All") url.searchParams.set("status", status);
  if (county !== "All") url.searchParams.set("county", county);
  if (requestedRepdRef) url.searchParams.set("repd_ref", requestedRepdRef);
  else if (query) url.searchParams.set("q", query);
  if (sortMode !== "capacity_desc") url.searchParams.set("sort", sortMode);
  if (capacityMin > SIZE_FLOOR) url.searchParams.set("mw_min", String(capacityMin));
  if (capacityMax < SIZE_CEILING) url.searchParams.set("mw_max", String(capacityMax));
  history.replaceState(null, "", url);
}

// PROJECT SIZE range.
//
// The ladder is not linear, and the reason is in the data rather than in
// taste. The register's median project is 12.3 MW and 98% of it sits under
// 500 MW, so a linear 1-5000 track would compress the band almost every user
// cares about into the first two pixels. These stops thicken where the
// projects are and still reach 5000.
const SIZE_STOPS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000, 4500, 5000]);
const SIZE_FLOOR = SIZE_STOPS[0];
const SIZE_CEILING = SIZE_STOPS[SIZE_STOPS.length - 1];

let capacityMin = SIZE_FLOOR;
let capacityMax = SIZE_CEILING;

// The full range is "no filter", so it never reaches the URL and never claims
// to have excluded anything.
function sizeFilterActive() {
  return capacityMin > SIZE_FLOOR || capacityMax < SIZE_CEILING;
}

function nearestStopIndex(value) {
  let best = 0;
  for (let i = 1; i < SIZE_STOPS.length; i += 1) {
    if (Math.abs(SIZE_STOPS[i] - value) < Math.abs(SIZE_STOPS[best] - value)) best = i;
  }
  return best;
}

// A typed value is honoured exactly; only the slider snaps. Reversed bounds are
// swapped rather than rejected, because a user who types 40 then 30 means the
// band between them.
//
// The absent cases are tested BEFORE Number(), not after. Number(null) is 0 and
// Number("") is 0 -- both finite -- so a missing mw_max would otherwise clamp to
// the floor and pin the whole register to 1 MW. An emptied box does the same.
// This is the fallback path, so it has to survive the values that mean "nothing
// was given" rather than only the ones that mean "not a number".
function clampSize(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(SIZE_CEILING, Math.max(SIZE_FLOOR, number));
}

function formatMw(value) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

function renderCapacityRange() {
  const minRange = document.getElementById("sizeMinRange");
  const maxRange = document.getElementById("sizeMaxRange");
  const minBox = document.getElementById("sizeMinBox");
  const maxBox = document.getElementById("sizeMaxBox");
  const readout = document.getElementById("sizeReadout");
  const selected = document.getElementById("sizeSelected");
  if (!minRange || !maxRange) return;
  const last = SIZE_STOPS.length - 1;
  for (const input of [minRange, maxRange]) {
    input.min = "0";
    input.max = String(last);
    input.step = "1";
  }
  const lowIndex = nearestStopIndex(capacityMin);
  const highIndex = nearestStopIndex(capacityMax);
  minRange.value = String(lowIndex);
  maxRange.value = String(highIndex);
  if (minBox) minBox.value = String(capacityMin);
  if (maxBox) maxBox.value = String(capacityMax);
  if (readout) {
    readout.textContent = sizeFilterActive()
      ? `${formatMw(capacityMin)} – ${formatMw(capacityMax)} MW`
      : `1 – ${formatMw(SIZE_CEILING)} MW · all sizes`;
  }
  if (selected) {
    const left = (lowIndex / last) * 100;
    const right = (highIndex / last) * 100;
    selected.style.left = `${left}%`;
    selected.style.width = `${Math.max(right - left, 0)}%`;
  }
}

function apply({ syncUrl = true } = {}) {
  const tokens = normalise(query).split(" ").filter(Boolean);
  const next = [];
  let capacity = 0;
  let largest = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const item = project(index);
    if (technology !== "all" && item.technology !== technology) continue;
    // An official status is a value, not a phrase to search inside. Measured
    // across all 7,680 records of this cut, substring and equality agree
    // exactly on the four tab values -- 2,232 / 282 / 1,910 / 840, leak zero --
    // so this changes no answer today. It is tightened because the register has
    // fourteen statuses and the control below now reaches all of them, and
    // "Appeal Refused" inside "Application Refused" is the kind of pair a
    // substring test finds the day someone adds one.
    if (status !== "All" && item.status !== status) continue;
    if (county !== "All" && item.county !== county) continue;
    if (item.capacity_mw < capacityMin || item.capacity_mw > capacityMax) continue;
    if (requestedRepdRef && String(item.repd_ref) !== requestedRepdRef) continue;
    if (!requestedRepdRef && tokens.length) {
      const searchable = searchTextFor(index);
      if (!tokens.every((token) => searchable.includes(token))) continue;
    }
    next.push(index);
    capacity += item.capacity_mw;
    largest = Math.max(largest, item.capacity_mw);
  }
  if (sortMode === "capacity_asc") {
    // capacity_desc is the payload's own row order, so only ascending sorts.
    next.sort((left, right) => project(left).capacity_mw - project(right).capacity_mw || left - right);
  } else if (sortMode === "county_asc" || sortMode === "county_desc") {
    const direction = sortMode === "county_asc" ? 1 : -1;
    next.sort((left, right) =>
      compareText(project(left).county, project(right).county, direction) || left - right);
  } else if (sortMode === "town_asc" || sortMode === "town_desc") {
    const direction = sortMode === "town_asc" ? 1 : -1;
    next.sort((left, right) =>
      compareText(localityFor(project(left))?.town, localityFor(project(right))?.town, direction) || left - right);
  } else if (sortMode === "postcode_asc" || sortMode === "postcode_desc") {
    const direction = sortMode === "postcode_asc" ? 1 : -1;
    next.sort((left, right) =>
      compareText(localityFor(project(left))?.postcode, localityFor(project(right))?.postcode, direction) || left - right);
  } else if (sortMode === "grid_asc" || sortMode === "grid_desc") {
    // Blanks sort last in BOTH directions, exactly as postcode does. A project
    // with no mapped circuit has not got an infinite distance and has not got a
    // zero one; pushing it to the bottom either way keeps the measured rows
    // contiguous, which is the whole point of sorting by proximity.
    const direction = sortMode === "grid_asc" ? 1 : -1;
    next.sort((left, right) => {
      const a = gridFor(project(left))?.k;
      const b = gridFor(project(right))?.k;
      const aMissing = typeof a !== "number";
      const bMissing = typeof b !== "number";
      if (aMissing && bMissing) return left - right;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return (a - b) * direction || left - right;
    });
  } else if (sortMode === "updated_desc" || sortMode === "updated_asc") {
    const direction = sortMode === "updated_asc" ? 1 : -1;
    next.sort((left, right) => {
      const leftTime = updatedTimestamp(left);
      const rightTime = updatedTimestamp(right);
      if (leftTime === null && rightTime === null) return left - right;
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;
      return direction * (leftTime - rightTime) || left - right;
    });
  }
  filtered = next;
  windowStart = 0;
  const summary = { count: next.length, capacity: Math.round((capacity + Number.EPSILON) * 100) / 100, largest };
  renderTable();
  presentSummary(summary);
  // The spine has just repainted from its own payload. Anything that had the
  // table before this line no longer has it, and must stop saying it does.
  if (spineRepaintListener) spineRepaintListener();
  updateSortHeader();
  if (syncUrl) syncFilterUrl();
}

function populateCounties() {
  const select = document.getElementById("county");
  select.replaceChildren(new Option("🌍 ALL COUNTIES", "All"));
  dictionaries.county.filter(Boolean).sort((left, right) => left.localeCompare(right, "en-GB"))
    .forEach((value) => select.add(new Option(`📍 ${value}`, value)));
}

/* ── EVERY STATUS THE REGISTER HAS ────────────────────────────────────

   The product draws four official statuses as tabs. The register carries
   fourteen, and the other ten are 2,416 of this cut's 7,680 records -- just
   under a third:

     Application Refused 667 · Revised 531 · Application Withdrawn 420
     Appeal Refused 295 · Planning Permission Expired 227 · Abandoned 221
     Appeal Withdrawn 39 · Decommissioned 9 · Appeal Lodged 5
     No Application Required 2

   Every one of those rows is loaded, searchable, sortable and in the CSV. None
   of them could be SELECTED. ALL STATUS was the only view that contained them,
   and nothing on the surface said that the four tabs stop 2,416 records short
   of the register -- which is exactly what the product's own STATUS DISCIPLINE
   panel promises it will not do.

   One labelled select, in the status row, on the same pattern the technology
   row already settled on: the names and the counts are read from the payload
   at boot and are never listed in source, each option carries its own row
   count so a two-row status is visibly a two-row status, and the control costs
   the row one line at every width. It reuses the wider-fleet control's own
   classes, so it is the same object to look at and inherits the same 44px
   floor on a phone.

   It is NOT a separate cut. These are the spine's own rows in the spine's own
   payload, so this sets the spine's own `status` and calls the spine's own
   apply(). Nothing renders a second table. */

function populateStatuses() {
  const row = document.getElementById("status");
  if (!row || document.getElementById("widerStatus")) return;
  const counts = new Map();
  for (let index = 0; index < rows.length; index += 1) {
    const value = project(index).status;
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  for (const name of counts.keys()) STATUSES.add(name);
  const rest = [...counts.keys()].filter((name) => !STATUS_TABS.includes(name))
    .sort((left, right) => counts.get(right) - counts.get(left));
  if (!rest.length) return;
  const covered = rest.reduce((total, name) => total + counts.get(name), 0);

  const group = document.createElement("div");
  group.className = "wider-fleet-control";
  const label = document.createElement("label");
  label.className = "wider-fleet-label";
  label.htmlFor = "widerStatus";
  label.textContent = "MORE STATUS";
  const select = document.createElement("select");
  select.id = "widerStatus";
  select.className = "wider-fleet-select";
  select.setAttribute("aria-label", `${rest.length} more official REPD statuses `
    + `outside this row's four, ${covered.toLocaleString("en-GB")} records`);
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = `+ ${rest.length} MORE REPD STATUSES `
    + `(${covered.toLocaleString("en-GB")} RECORDS)`;
  select.appendChild(placeholder);
  for (const name of rest) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${name.toUpperCase()} · ${counts.get(name).toLocaleString("en-GB")}`;
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    // The empty entry is the way back to ALL STATUS, not an empty state.
    status = select.value || "All";
    select.classList.toggle("is-chosen", Boolean(select.value));
    setButtonState("#status", "officialStatus", status);
    apply();
  });
  group.append(label, select);
  row.appendChild(group);
}

function setButtonState(container, dataKey, selected) {
  document.querySelectorAll(`${container} .btn`).forEach((button) => {
    const active = button.dataset[dataKey] === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function hydrateFiltersFromUrl() {
  const parameters = new URLSearchParams(location.search);
  const requestedTechnology = parameters.get("technology") || "all";
  const requestedStatus = parameters.get("status") || "All";
  const requestedCounty = parameters.get("county") || "All";
  const requestedSort = parameters.get("sort") || "capacity_desc";
  technology = TECHNOLOGIES.has(requestedTechnology) ? requestedTechnology : "all";
  status = STATUSES.has(requestedStatus) ? requestedStatus : "All";
  county = dictionaries.county.includes(requestedCounty) ? requestedCounty : "All";
  const repdRefParameter = parameters.get("repd_ref") || "";
  requestedRepdRef = /^\d+$/u.test(repdRefParameter) ? repdRefParameter : "";
  query = requestedRepdRef || (parameters.get("q") || "");
  sortMode = SORTS.has(requestedSort) ? requestedSort : "capacity_desc";
  setButtonState("#tech", "technology", technology);
  releaseWiderStatus(status);
  setButtonState("#status", "officialStatus", status);
  document.getElementById("county").value = county;
  document.getElementById("search").value = query;
  document.getElementById("sortProjects").value = sortMode;
  capacityMin = clampSize(parameters.get("mw_min"), SIZE_FLOOR);
  capacityMax = clampSize(parameters.get("mw_max"), SIZE_CEILING);
  if (capacityMin > capacityMax) [capacityMin, capacityMax] = [capacityMax, capacityMin];
  renderCapacityRange();
}

async function ensureSearchSupplement() {
  if (searchSupplement) return searchSupplement;
  runtimeEvidence.searchRequests += 1;
  const payload = await fetchImmutable(registry.assets.search.path);
  invariant(payload.schema === registry.assets.search.schema, "search schema mismatch");
  invariant(payload.generation === registry.assets.search.generation, "search generation mismatch");
  invariant(payload.cache_identity === registry.assets.search.cache_identity, "search cache identity mismatch");
  invariant(payload.row_alignment === registry.cache_contract.search_index.row_alignment, "search row alignment mismatch");
  invariant(Array.isArray(payload.rows) && payload.rows.length === rows.length, "search row count mismatch");
  searchSupplement = payload.rows;
  runtimeEvidence.searchReady = true;
  return searchSupplement;
}

async function loadDetailPartition(partitionIndex) {
  if (detailPromises.has(partitionIndex)) return detailPromises.get(partitionIndex);
  const entry = registry.detail_partitions[partitionIndex];
  invariant(entry, `detail partition ${partitionIndex} missing`);
  const promise = detailQueue.add(async () => {
    runtimeEvidence.detailRequests += 1;
    const payload = await fetchImmutable(entry.path);
    invariant(payload.schema === registry.detail_schema, `${entry.path} detail schema mismatch`);
    invariant(payload.record_count === entry.record_count && payload.projects.length === entry.record_count, `${entry.path} detail count mismatch`);
    for (const item of payload.projects) detailByRef.set(String(item.repd_ref), item);
    runtimeEvidence.maximumDetailConcurrency = detailQueue.maximumActive;
    return payload.projects;
  });
  detailPromises.set(partitionIndex, promise);
  promise.catch(() => detailPromises.delete(partitionIndex));
  return promise;
}

async function detailFor(index) {
  const ref = String(rows[index][FIELD.repdRef]);
  if (detailByRef.has(ref)) return detailByRef.get(ref);
  const partition = Math.floor(index / registry.detail_partition_size);
  await loadDetailPartition(partition);
  const item = detailByRef.get(ref);
  invariant(item, `REPD ${ref} missing from declared detail partition`);
  return item;
}

async function hydrateDetail(details) {
  if (details.dataset.loaded === "true" || details.dataset.loading === "true") return;
  details.dataset.loading = "true";
  const container = details.querySelector(".record-grid");
  try {
    const item = await detailFor(Number(details.dataset.detailIndex));
    container.innerHTML = `<div><b>PLANNING AUTHORITY</b><span>${escapeHtml(item.planning_authority || "not supplied by REPD")}</span></div><div><b>PLANNING REF</b><span>${escapeHtml(item.planning_application_reference || "not supplied by REPD")}</span></div><div><b>DEVELOPMENT ID</b><span>${escapeHtml(item.gg_development_id || "not assigned")}</span></div><div><b>LIFECYCLE</b><span>${escapeHtml(item.lifecycle || "not derived")}</span></div><div><b>RELATIONSHIPS</b><span>${escapeHtml(relationshipSummary(item))}</span></div><div><b>GEOMETRY</b><span>${escapeHtml(item.geometry_status === "valid" ? "valid REPD map point" : "missing — retained without deletion")}</span></div>`;
    details.dataset.loaded = "true";
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div class="detail-error">Official project details unavailable; the canonical row remains live.</div>';
  } finally {
    delete details.dataset.loading;
  }
}

async function copyProjectId(button) {
  const value = button.dataset.copyId;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  const original = button.textContent;
  button.textContent = "COPIED";
  setTimeout(() => { button.textContent = original; }, 1200);
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^(?:[=+\-@]|\s+[=+\-@]|\t|\r|\n)/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/* The product's CSV contract, named once. It is the export's header row, and
   it is also the question an export provider is asked: a cut that is not the
   spine's own is handed these column names and answers with the ones it can
   honestly fill, so the refusal below counts real columns rather than a
   number somebody typed. Add a column here and the refusal re-counts itself.
*/
const CSV_COLUMNS = Object.freeze(["Site Name", "REPD Ref", "GlobalGrid Project ID", "GlobalGrid Development ID", "Identity Status", "Identity Confidence", "Technology", "Official REPD Technology", "Official REPD Capacity", "Capacity Unit", "Official REPD Status", "Derived Lifecycle", "Operator or Applicant", "County", "Region", "Country", "Planning Authority", "Planning Application Reference", "REPD Record Updated", "Planning Application Submitted", "Planning Application Withdrawn", "Planning Permission Granted", "Planning Permission Refused", "Planning Permission Expired", "Under Construction", "Operational", "Old REPD Ref", "Direct Related REPD Refs", "Planning Sibling REPD Refs", "Development REPD Refs", "Typed Relationships JSON", "Geometry Status", "Easting", "Northing", "Source CRS", "Longitude", "Latitude", "Atlas V9 URL", "Output CRS", "Coordinate Transform", "Coordinate Use", "Source Dataset", "Source Row", "Projects Array SHA-256", "Source Identity SHA-256", "Source Coordinate Fixture SHA-256", "Source Workbook SHA-256", "Source Reconciliation", "Canonical News Signal — Event Unverified", "Canonical News Match Note"]);

async function downloadCsv(event) {
  event.preventDefault();
  const meta = document.getElementById("exportMeta");
  /* ASKED BEFORE ANYTHING IS BUILT, AND FAILING CLOSED.

     `filtered` holds indices into the spine's OWN payload. A wider-fleet row
     is not in that index space at all, so with one flywheel on screen this
     function used to map the spine's 3,563 solar indices, write them to disk
     under a flywheel heading, and report "3,563 filtered records exported".
     That file leaves the platform and cannot be recalled.

     So: if any cut other than the spine's own owns the table, the spine does
     not write the file. The cut answers, in words, what it can and cannot
     fill. A provider that answers nothing useful is refused too -- the
     default here is no CSV, never the spine's rows, because the failure being
     fixed is precisely a plausible file full of the wrong rows. */
  if (presentedExport) {
    const answer = presentedExport({ columns: CSV_COLUMNS }) || {};
    meta.textContent = typeof answer.declined === "string" && answer.declined
      ? answer.declined
      : "EXPORT DECLINED \u00b7 the view on screen is not this product's own cut "
        + "and did not state what it can export. No CSV was written.";
    meta.classList.add("is-declined");
    if (Array.isArray(answer.missing) && answer.missing.length) {
      meta.dataset.exportDeclinedColumns = answer.missing.join(" | ");
    }
    return;
  }
  meta.textContent = "Loading full official fields for filtered export…";
  try {
    await Promise.all(registry.detail_partitions.map((_, index) => loadDetailPartition(index)));
    const headers = CSV_COLUMNS;
    const outputRows = filtered.map((index) => {
      const compact = project(index);
      const item = detailByRef.get(String(compact.repd_ref));
      invariant(item, `REPD ${compact.repd_ref} unavailable for export`);
      const signal = signalFor(compact);
      return [item.name, item.repd_ref, item.gg_project_id, item.gg_development_id, item.identity_status, item.identity_confidence, LABELS[item.technology], item.repd_technology, item.capacity_mw, UNITS[item.technology], item.status, item.lifecycle, item.operator, item.county, item.region, item.country, item.planning_authority, item.planning_application_reference, item.repd_record_updated, item.planning_application_submitted, item.planning_application_withdrawn, item.planning_permission_granted, item.planning_permission_refused, item.planning_permission_expired, item.under_construction, item.operational, item.repd_old_ref, item.direct_related_repd_refs.join("|"), item.planning_sibling_repd_refs.join("|"), item.development_repd_refs.join("|"), JSON.stringify(item.relationships), item.geometry_status, item.easting, item.northing, "EPSG:27700", item.longitude, item.latitude, atlasUrl(compact), "RFC 7946 WGS84", item.coordinate_source, "market map context only; never evidence of a grid connection or cadastral boundary", registry.source.dataset, item.source_row, registry.source.projects_sha256, registry.source.identity_sha256, registry.source.coordinate_fixture_sha256, registry.source.workbook_sha256, "14657/14657 canonical REPD Ref IDs", signal.label, signal.note];
    });
    const content = `\ufeff${[headers, ...outputRows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `globalgrid2050_uk_renewables_pipeline_v8_fast_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    meta.textContent = `${filtered.length.toLocaleString("en-GB")} filtered records exported`;
  } catch (error) {
    console.error(error);
    meta.textContent = "export unavailable; no partial CSV was produced";
  }
}

/* The select and the four tabs are one control between them. Whoever sets the
   status last says so here, so the two can never name different things -- the
   defect this release already fixed once, one row up, for technology. */
function releaseWiderStatus(current) {
  const select = document.getElementById("widerStatus");
  if (!select) return;
  const value = STATUS_TABS.includes(current) ? "" : current;
  select.value = value;
  select.classList.toggle("is-chosen", Boolean(value));
}

function clearFilters(event) {
  event.preventDefault();
  technology = "all";
  status = "All";
  county = "All";
  query = "";
  requestedRepdRef = "";
  sortMode = "capacity_desc";
  setButtonState("#tech", "technology", technology);
  releaseWiderStatus(status);
  setButtonState("#status", "officialStatus", status);
  document.getElementById("county").value = county;
  document.getElementById("search").value = "";
  document.getElementById("sortProjects").value = sortMode;
  capacityMin = SIZE_FLOOR;
  capacityMax = SIZE_CEILING;
  renderCapacityRange();
  apply();
}

function bindProjectControls() {
  if (controlsBound) return;
  controlsBound = true;
  document.querySelectorAll("#tech .btn").forEach((button) => {
    button.addEventListener("click", () => {
      technology = button.dataset.technology;
      setButtonState("#tech", "technology", technology);
      apply();
    });
  });
  document.querySelectorAll("#status .btn").forEach((button) => {
    button.addEventListener("click", () => {
      status = button.dataset.officialStatus;
      // The tabs and the select are one choice, so choosing a tab lets the
      // select go rather than leaving it naming a status the table has left.
      releaseWiderStatus(status);
      setButtonState("#status", "officialStatus", status);
      apply();
    });
  });
  document.getElementById("county").addEventListener("change", (event) => { county = event.target.value; apply(); });
  const sizeMinRange = document.getElementById("sizeMinRange");
  const sizeMaxRange = document.getElementById("sizeMaxRange");
  const sizeMinBox = document.getElementById("sizeMinBox");
  const sizeMaxBox = document.getElementById("sizeMaxBox");
  if (sizeMinRange && sizeMaxRange) {
    // Dragging one handle past the other pushes rather than crosses, so the
    // band can be collapsed to a single stop but never inverted.
    const onRange = () => {
      let low = Number(sizeMinRange.value);
      let high = Number(sizeMaxRange.value);
      if (low > high) { const swap = low; low = high; high = swap; }
      capacityMin = SIZE_STOPS[low];
      capacityMax = SIZE_STOPS[high];
      renderCapacityRange();
      apply();
    };
    sizeMinRange.addEventListener("input", onRange);
    sizeMaxRange.addEventListener("input", onRange);
  }
  // The boxes take an exact value, so a band the ladder does not carry -- 33 to
  // 37 -- is still reachable. Committed on change, not on every keystroke.
  const onBox = () => {
    capacityMin = clampSize(sizeMinBox?.value, SIZE_FLOOR);
    capacityMax = clampSize(sizeMaxBox?.value, SIZE_CEILING);
    if (capacityMin > capacityMax) {
      const swap = capacityMin; capacityMin = capacityMax; capacityMax = swap;
    }
    renderCapacityRange();
    apply();
  };
  if (sizeMinBox) sizeMinBox.addEventListener("change", onBox);
  if (sizeMaxBox) sizeMaxBox.addEventListener("change", onBox);
  const sizeReset = document.getElementById("sizeReset");
  if (sizeReset) {
    sizeReset.addEventListener("click", () => {
      capacityMin = SIZE_FLOOR;
      capacityMax = SIZE_CEILING;
      renderCapacityRange();
      apply();
    });
  }
  document.getElementById("sortProjects").addEventListener("change", (event) => { sortMode = event.target.value; apply(); });
  for (const [column, spec] of Object.entries(SORT_HEADINGS)) {
    const heading = document.getElementById("sort" + column.charAt(0).toUpperCase() + column.slice(1));
    if (!heading) continue;
    heading.addEventListener("click", () => {
      // First click takes the column's natural direction; clicking the column
      // you are already on flips it.
      sortMode = sortMode === spec.first
        ? (spec.first === spec.desc ? spec.asc : spec.desc)
        : spec.first;
      document.getElementById("sortProjects").value = sortMode;
      apply();
    });
  }
  document.getElementById("search").addEventListener("input", (event) => {
    requestedRepdRef = "";
    query = event.target.value.trim();
    clearTimeout(searchTimer);
    if (!query) {
      apply();
      return;
    }
    document.getElementById("resultsMeta").textContent = "loading complete planning/reference search index…";
    searchTimer = setTimeout(async () => {
      try {
        await ensureSearchSupplement();
        apply();
      } catch (error) {
        console.error(error);
        apply();
      }
    }, 120);
  });
  document.getElementById("export").addEventListener("click", downloadCsv);
  document.getElementById("exportInline").addEventListener("click", downloadCsv);
  document.getElementById("clearFilters").addEventListener("click", clearFilters);
  document.getElementById("tbody").addEventListener("click", (event) => {
    const copy = event.target.closest(".copy-id");
    if (copy) copyProjectId(copy);
    const summary = event.target.closest("summary");
    const details = summary?.closest("details[data-detail-index]");
    if (details) hydrateDetail(details);
  });
}

function newsTechnology(row) {
  return String(row[NEWS_FIELD.technology] || row[NEWS_FIELD.regionalTechnology] || "").toUpperCase();
}

function newsMatches(row) {
  const event = String(row[NEWS_FIELD.event] || "").toUpperCase();
  const newsTechnologyValue = newsTechnology(row);
  const regional = row[NEWS_FIELD.region];
  if (newsMode === "UK" && row[NEWS_FIELD.canonical] !== true) return false;
  if (newsMode === "INTERNATIONAL" && !regional) return false;
  if (newsMode === "US" && regional !== "US") return false;
  if (newsMode === "EUROPE" && regional !== "EUROPE") return false;
  if (newsMode === "SOLAR" && !newsTechnologyValue.includes("SOLAR")) return false;
  if (newsMode === "BESS" && !newsTechnologyValue.includes("BESS")) return false;
  if (newsMode === "CONSENT" && event !== "CONSENT") return false;
  if (newsMode === "CONSTRUCTION" && event !== "CONSTRUCTION") return false;
  if (newsMode === "OPERATIONAL" && event !== "OPERATIONAL") return false;
  if (newsMode === "FINANCE" && !FINANCE_EVENTS.has(event)) return false;
  if (newsQuery) {
    const haystack = normalise([
      row[NEWS_FIELD.headline],
      row[NEWS_FIELD.project],
      row[NEWS_FIELD.operator],
      row[NEWS_FIELD.county],
      row[NEWS_FIELD.source],
      row[NEWS_FIELD.event],
      row[NEWS_FIELD.eventDetail],
      row[NEWS_FIELD.repdRef],
      row[NEWS_FIELD.projectId],
      row[NEWS_FIELD.relatedContextRepdRef],
      row[NEWS_FIELD.relatedContextProject],
      row[NEWS_FIELD.bindingLabel],
      JSON.stringify(row[NEWS_FIELD.relatedComponents] || []),
    ].join(" "));
    const tokens = normalise(newsQuery).split(" ").filter(Boolean);
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }
  return true;
}

function newsHtml(row) {
  const regional = row[NEWS_FIELD.region];
  const technologyValue = newsTechnology(row);
  const articleClass = technologyValue.includes("BESS") ? "bess" : "solar";
  // With no repd_ref there is no project this story is about, so it must not
  // carry one. This is what captioned a New Jersey storage story "Wilton
  // International, Greystones Road".
  const projectName = String(row[NEWS_FIELD.repdRef] || "").trim()
    ? (row[NEWS_FIELD.project] || "")
    : "";
  const capacity = Number(row[NEWS_FIELD.capacity] || 0);
  const role = String(row[NEWS_FIELD.role] || "");
  const relatedContextProject = String(row[NEWS_FIELD.relatedContextProject] || "");
  const relatedContextRef = String(row[NEWS_FIELD.relatedContextRepdRef] || "");
  const relatedComponents = Array.isArray(row[NEWS_FIELD.relatedComponents]) ? row[NEWS_FIELD.relatedComponents] : [];
  const eventDetail = String(row[NEWS_FIELD.eventDetail] || "").replaceAll("_", " ");
  const quality = role === "RELATED_MENTION"
    ? `<span class="news-quality unverified">${escapeHtml(row[NEWS_FIELD.bindingLabel] || "RELATED CONTEXT ONLY — NOT A PROJECT BINDING")}</span>${relatedContextProject ? ` · context: ${escapeHtml(relatedContextProject)}` : ""}${relatedContextRef ? ` · related REPD ${escapeHtml(relatedContextRef)}` : ""} · no project signal`
    : row[NEWS_FIELD.canonical] === true
    ? `<span class="news-quality relevant">RELEVANT ${Number(row[NEWS_FIELD.confidence] || 0)}%</span> · PRIMARY_MATCH · REPD ${escapeHtml(row[NEWS_FIELD.repdRef])}`
    : regional
      ? `<span class="news-quality relevant">${escapeHtml(regional === "INTERNATIONAL_OTHER" ? "INTERNATIONAL" : regional)}</span> · ${escapeHtml(row[NEWS_FIELD.regionalEvidence])} · regional discovery only · no REPD project signal`
      : '<span class="news-quality unverified">DISCOVERY ONLY</span> · no project signal';
  const componentNote = relatedComponents.length
    ? `<p>${relatedComponents.map((component) => `RELATED DEVELOPMENT · REPD ${escapeHtml(component.repd_ref || "unknown")} · ${escapeHtml(String(component.technology || "").toUpperCase())}${Number.isFinite(component.official_capacity_mw) ? ` · ${Number(component.official_capacity_mw).toLocaleString("en-GB")} MW` : " · official capacity unknown"} · no project signal`).join(" · ")}</p>`
    : "";
  return `<a class="story ${articleClass}" data-article-id="${escapeHtml(row[NEWS_FIELD.articleId])}" href="${escapeHtml(row[NEWS_FIELD.url])}" target="_blank" rel="noopener"><div class="kicker">${escapeHtml(technologyValue || "ENERGY")} · ${escapeHtml(row[NEWS_FIELD.event] || "PROJECT UPDATE")}${eventDetail ? ` · ${escapeHtml(eventDetail)}` : ""} · ${escapeHtml(row[NEWS_FIELD.published] || "")}</div><h3>${escapeHtml(row[NEWS_FIELD.headline] || projectName)}</h3><p>${projectName ? `<span class="project">${escapeHtml(projectName)}${capacity ? ` · ${capacity.toLocaleString("en-GB")} MW` : ""}</span>${row[NEWS_FIELD.operator] ? ` · ${escapeHtml(row[NEWS_FIELD.operator])}` : ""}${row[NEWS_FIELD.county] ? ` · ${escapeHtml(row[NEWS_FIELD.county])}` : ""}` : `<span class="news-unbound">sector headline · no project binding</span>`}</p>${componentNote}<span class="source">${escapeHtml(row[NEWS_FIELD.source] || "Source")} · ${quality} · classified against the frozen REPD spine</span></a>`;
}

function drawNews() {
  const matches = newsRows.filter(newsMatches);
  const stories = document.getElementById("stories");
  if (newsStart >= matches.length) newsStart = 0;
  if (!matches.length) {
    stories.innerHTML = '<div class="news-empty">No headlines match this newspaper filter.</div>';
  } else {
    stories.innerHTML = matches.slice(newsStart, newsStart + NEWS_WINDOW_SIZE).map(newsHtml).join("");
  }
  let pager = document.getElementById("newsPager");
  if (!pager) {
    pager = document.createElement("div");
    pager.id = "newsPager";
    pager.className = "news-pager";
    pager.innerHTML = '<button id="newsPrevious" type="button">PREVIOUS 30</button><span id="newsWindowRange"></span><button id="newsMore" type="button">NEXT 30</button>';
    document.querySelector(".paper").after(pager);
    pager.querySelector("#newsPrevious").addEventListener("click", () => {
      newsStart = Math.max(0, newsStart - NEWS_WINDOW_SIZE);
      drawNews();
    });
    pager.querySelector("#newsMore").addEventListener("click", () => {
      newsStart += NEWS_WINDOW_SIZE;
      drawNews();
    });
  }
  const end = Math.min(matches.length, newsStart + NEWS_WINDOW_SIZE);
  const previous = pager.querySelector("#newsPrevious");
  const more = pager.querySelector("#newsMore");
  previous.disabled = newsStart === 0;
  more.disabled = end >= matches.length;
  pager.querySelector("#newsWindowRange").textContent = matches.length
    ? `${newsStart + 1}–${end} of ${matches.length.toLocaleString("en-GB")}`
    : "0 headlines";
  more.textContent = `NEXT ${Math.min(NEWS_WINDOW_SIZE, Math.max(0, matches.length - end))} · ${matches.length.toLocaleString("en-GB")} MATCHES`;
}

function bindNewsControls() {
  document.querySelectorAll("#newsTools button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#newsTools button").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      newsMode = button.dataset.news;
      newsStart = 0;
      drawNews();
    });
  });
  document.getElementById("newsSearch").addEventListener("input", (event) => {
    newsQuery = event.target.value.trim();
    newsStart = 0;
    drawNews();
  });
}

async function loadNews() {
  if (runtimeEvidence.newsReady) return;
  runtimeEvidence.newsRequests += 1;
  try {
    const payload = await fetchImmutable(registry.assets.news.path);
    invariant(payload.schema === registry.assets.news.schema, "news schema mismatch");
    invariant(payload.generation === registry.assets.news.generation, "news generation mismatch");
    invariant(payload.cache_identity === registry.assets.news.cache_identity, "news cache identity mismatch");
    invariant(arraysEqual(payload.fields, NEWS_FIELDS), "news field contract mismatch");
    invariant(payload.rows.length === registry.news_counts.all, "news count mismatch");
    // BOUND keeps its caption; SECTOR is real trade news with no project
    // established, so it carries none. Everything else goes.
    //
    // The sector test reads the headline, which is an inference and is treated
    // as one: it decides what to SHOW, and is never used to claim a story is
    // about a project.
    const NEWS_SECTOR = /\b(solar|pv|photovolta|battery|bess|storage|ldes|grid|inverter|substation|transmission|curtail|ppa|renewab|wind|electrolys|interconnector|flexibilit|flexitricity|energy hub|energy park|power plant|megawatt|data ?centres?|datacentres?|data ?centers?)\b/i;
    const NEWS_CAPACITY = /\b\d[\d,.]*\s?(mw|mwh|gw|gwh|kw)\b/i;
    const NEWS_OFFTOPIC = /\b(care home|care centre|care award|ring road|dibden|solent gateway)\b/i;
    // Engineering and business only. Geopolitics is somebody else's page.
    const NEWS_NEUTRAL = /\b(iran|ukraine|russia|israel|gaza|war|sanction|missile|conflict)\b/i;

    const newsBound = (row) =>
      row[NEWS_FIELD.eligible] === true
      && row[NEWS_FIELD.canonical] === true
      && String(row[NEWS_FIELD.role] || "") === "PRIMARY_MATCH"
      && String(row[NEWS_FIELD.repdRef] || "").trim() !== "";

    const newsSector = (row) => {
      const headline = String(row[NEWS_FIELD.headline] || "");
      if (NEWS_OFFTOPIC.test(headline) || NEWS_NEUTRAL.test(headline)) return false;
      return NEWS_SECTOR.test(headline) || NEWS_CAPACITY.test(headline);
    };

    const allNews = payload.rows;
    newsRows = allNews.filter((row) => newsBound(row) || newsSector(row));
    runtimeEvidence.newsBound = allNews.filter(newsBound).length;
    runtimeEvidence.newsSector = newsRows.length - runtimeEvidence.newsBound;
    runtimeEvidence.newsDropped = allNews.length - newsRows.length;
    runtimeEvidence.newsReady = true;
    document.getElementById("newsMeta").textContent =
      `${runtimeEvidence.newsBound.toLocaleString("en-GB")} bound to a REPD project · `
      + `${runtimeEvidence.newsSector.toLocaleString("en-GB")} sector headlines, no project binding · `
      + `${runtimeEvidence.newsDropped.toLocaleString("en-GB")} withheld as off-topic · immutable compact edition`;
    drawNews();
  } catch (error) {
    console.error(error);
    document.getElementById("stories").innerHTML = '<div class="news-empty">Newspaper unavailable. REPD analytics remain live.</div>';
    document.getElementById("newsMeta").textContent = "newspaper unavailable";
  }
}

function createGauge(canvasId, colour) {
  const options = { responsive: true, maintainAspectRatio: false, circumference: 180, rotation: 270, cutout: "80%", plugins: { tooltip: { enabled: false }, legend: { display: false } } };
  return new globalThis.Chart(document.getElementById(canvasId), { type: "doughnut", data: { datasets: [{ data: [0, 1], backgroundColor: [colour, "#222"], borderWidth: 0 }] }, options });
}

async function loadCharts() {
  if (runtimeEvidence.chartsReady) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = registry.assets.chart.path;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("pinned Chart.js failed to load"));
    document.head.appendChild(script);
  });
  invariant(typeof globalThis.Chart === "function", "pinned Chart.js API unavailable");
  charts.capacity = createGauge("g1", "#ff00ff");
  charts.projects = createGauge("g2", "#00ffff");
  charts.largest = createGauge("g3", "#00ff88");
  runtimeEvidence.chartsReady = true;
  updateGauges({ count: filtered.length, capacity: filtered.reduce((sum, index) => sum + Number(rows[index][FIELD.capacity]), 0), largest: filtered.reduce((maximum, index) => Math.max(maximum, Number(rows[index][FIELD.capacity])), 0) });
}

async function openSectorIntelligence() {
  const button = document.getElementById("sectorIntelOpen");
  const host = document.getElementById("sectorIntelHost");
  const meta = document.getElementById("sectorIntelMeta");
  invariant(button && host && meta, "sector-intelligence controls are missing");
  if (host.dataset.sectorIntelligenceState === "ready") {
    host.hidden = !host.hidden;
    button.setAttribute("aria-expanded", String(!host.hidden));
    return;
  }
  if (host.dataset.sectorIntelligenceState === "loading") return;
  const entry = registry.supplemental_assets?.sector_intelligence_clean
    || registry.supplemental_assets?.sector_intelligence;
  invariant(entry?.activation === "dynamic-import-on-user-open; payload-fetch-on-first-topic-selection", "sector activation changed");
  invariant(entry.project_bindings === 0 && entry.eligible_for_news_signal === false, "sector binding boundary changed");
  host.hidden = false;
  host.dataset.sectorIntelligenceState = "loading";
  button.setAttribute("aria-expanded", "true");
  meta.textContent = "LOAD · importing sector controls; no payload requested";
  runtimeEvidence.sectorIntelligenceImports += 1;
  invariant(runtimeEvidence.sectorIntelligenceImports === 1, "sector cartridge imported more than once");
  const cartridge = await import(`./${entry.cartridge.filename}`);
  invariant(cartridge.SECTOR_INTELLIGENCE_CARTRIDGE_CONTRACT.generation === entry.generation, "sector cartridge identity changed");
  const result = cartridge.mountSectorIntelligence({
    host,
    payloadAsset: {
      ...entry.payload,
      url: entry.payload.path,
    },
  });
  runtimeEvidence.sectorPayloadRequestsAtMount = result.payloadRequests;
  invariant(runtimeEvidence.sectorPayloadRequestsAtMount === 0, "sector payload requested at mount");
  meta.textContent = "WAIT · one evidenced topic · choose it to request the compact Parquet-derived payload";
}

function bindSectorIntelligence() {
  const button = document.getElementById("sectorIntelOpen");
  invariant(button, "sector-intelligence opener is missing");
  button.addEventListener("click", () => openSectorIntelligence().catch((error) => {
    console.error("sector intelligence", error);
    document.getElementById("sectorIntelMeta").textContent = "FAIL · sector intelligence unavailable";
  }));
}

async function openFederatedRelationships() {
  const button = document.getElementById("federatedRelationshipOpen");
  const host = document.getElementById("federatedRelationshipHost");
  const meta = document.getElementById("federatedRelationshipMeta");
  invariant(button && host && meta, "federated relationship controls are missing");
  if (host.dataset.federatedRelationshipState === "ready") {
    host.hidden = !host.hidden;
    button.setAttribute("aria-expanded", String(!host.hidden));
    return;
  }
  if (host.dataset.federatedRelationshipState === "loading") return;
  const entry = registry.supplemental_assets?.relationship_governance_status;
  invariant(entry?.activation === "dynamic-import-on-user-open; projection-fetch-after-explicit-open", "relationship activation changed");
  invariant(entry.rows === 3 && entry.project_bindings === 0 && entry.eligible_for_join_rows === 0, "relationship boundary changed");
  host.hidden = false;
  host.dataset.federatedRelationshipState = "loading";
  button.setAttribute("aria-expanded", "true");
  meta.textContent = "LOAD · importing controls and verifying one compact payload";
  runtimeEvidence.federatedRelationshipImports += 1;
  invariant(runtimeEvidence.federatedRelationshipImports === 1, "relationship cartridge imported more than once");
  const cartridge = await import(`./${entry.cartridge.filename}`);
  invariant(cartridge.FEDERATED_RELATIONSHIP_CARTRIDGE_CONTRACT.generation === entry.generation, "relationship cartridge identity changed");
  const result = await cartridge.mountFederatedRelationships({
    host,
    payloadAsset: {
      ...entry.payload,
      url: entry.payload.path.replace(/^releases\//u, ""),
    },
  });
  runtimeEvidence.federatedRelationshipPayloadRequests += result.payloadRequests;
  invariant(runtimeEvidence.federatedRelationshipPayloadRequests === 1 && result.projectBindings === 0, "relationship request or binding boundary changed");
  meta.textContent = "OK · 3 governance rows · all ABSTAIN · zero project bindings";
}

function bindFederatedRelationships() {
  const button = document.getElementById("federatedRelationshipOpen");
  invariant(button, "relationship opener is missing");
  button.addEventListener("click", () => openFederatedRelationships().catch((error) => {
    console.error("federated relationships", error);
    document.getElementById("federatedRelationshipMeta").textContent = "FAIL · relationship evidence unavailable; core product unchanged";
    document.getElementById("federatedRelationshipHost").dataset.federatedRelationshipState = "failed";
  }));
}

function scheduleOptionalLoads() {
  setTimeout(() => {
    const schedule = globalThis.requestIdleCallback || ((callback) => setTimeout(callback, 0));
    schedule(() => loadNews(), { timeout: 1500 });
    schedule(() => loadCharts().catch((error) => console.error(error)), { timeout: 2000 });
  }, 1000);
}

async function openProjectIntelligence() {
  const button = document.getElementById("projectIntelOpen");
  const host = document.getElementById("projectIntelHost");
  const meta = document.getElementById("projectIntelMeta");
  invariant(button && host && meta, "project-intelligence controls are missing");
  if (host.dataset.projectIntelligenceState === "ready") {
    host.hidden = !host.hidden;
    button.setAttribute("aria-expanded", String(!host.hidden));
    return;
  }
  if (host.dataset.projectIntelligenceState === "loading") return;
  const entry = registry.supplemental_assets?.project_intelligence;
  invariant(entry?.activation === "dynamic-import-on-user-open; payload-fetch-on-first-tab-selection", "project intelligence activation changed");
  invariant(entry.project_bindings === 0 && entry.eligible_for_news_signal === false, "project intelligence binding boundary changed");
  host.hidden = false;
  host.dataset.projectIntelligenceState = "loading";
  button.setAttribute("aria-expanded", "true");
  meta.textContent = "LOAD \u00b7 importing derived controls; no payload requested";
  runtimeEvidence.projectIntelligenceImports += 1;
  invariant(runtimeEvidence.projectIntelligenceImports === 1, "project intelligence cartridge imported more than once");
  const cartridge = await import(`./${entry.cartridge.filename}`);
  invariant(cartridge.PROJECT_INTELLIGENCE_CARTRIDGE_CONTRACT.generation === entry.generation, "project intelligence cartridge identity changed");
  invariant(cartridge.PROJECT_INTELLIGENCE_CARTRIDGE_CONTRACT.additive_only === true, "project intelligence cartridge is no longer additive-only");
  const result = cartridge.mountProjectIntelligence({
    host,
    payloadAsset: { ...entry.payload, url: entry.payload.path },
  });
  runtimeEvidence.projectIntelligencePayloadRequests = result.payloadRequests;
  invariant(runtimeEvidence.projectIntelligencePayloadRequests === 0 && result.projectBindings === 0, "project intelligence payload requested at mount, or a binding appeared");
  host.dataset.projectIntelligenceState = "ready";
  meta.textContent = "WAIT \u00b7 five tabs \u00b7 choose one to request the compact derived index";
}

function bindProjectIntelligence() {
  const button = document.getElementById("projectIntelOpen");
  invariant(button, "project-intelligence opener is missing");
  button.addEventListener("click", () => openProjectIntelligence().catch((error) => {
    console.error("project intelligence", error);
    document.getElementById("projectIntelMeta").textContent = "FAIL \u00b7 project intelligence unavailable; core product unchanged";
    document.getElementById("projectIntelHost").dataset.projectIntelligenceState = "failed";
  }));
}

async function openGridProximity() {
  const button = document.getElementById("gridProximityOpen");
  const host = document.getElementById("gridProximityHost");
  const meta = document.getElementById("gridProximityMeta");
  invariant(button && host && meta, "grid-proximity controls are missing");
  if (host.dataset.gridProximityState === "ready") {
    host.hidden = !host.hidden;
    button.setAttribute("aria-expanded", String(!host.hidden));
    return;
  }
  if (host.dataset.gridProximityState === "loading") return;
  const entry = registry.supplemental_assets?.grid_proximity;
  invariant(entry?.activation === "dynamic-import-on-user-open; payload-fetch-on-first-tab-selection", "grid proximity activation changed");
  invariant(entry.project_bindings === 0 && entry.eligible_for_news_signal === false, "grid proximity binding boundary changed");
  host.hidden = false;
  host.dataset.gridProximityState = "loading";
  button.setAttribute("aria-expanded", "true");
  meta.textContent = "LOAD \u00b7 importing derived controls; no payload requested";
  runtimeEvidence.gridProximityImports += 1;
  invariant(runtimeEvidence.gridProximityImports === 1, "grid proximity cartridge imported more than once");
  const cartridge = await import(`./${entry.cartridge.filename}`);
  invariant(cartridge.GRID_PROXIMITY_CARTRIDGE_CONTRACT.generation === entry.generation, "grid proximity cartridge identity changed");
  invariant(cartridge.GRID_PROXIMITY_CARTRIDGE_CONTRACT.additive_only === true, "grid proximity cartridge is no longer additive-only");
  const result = cartridge.mountGridProximity({
    host,
    payloadAsset: { ...entry.payload, url: entry.payload.path },
  });
  runtimeEvidence.gridProximityPayloadRequests = result.payloadRequests;
  invariant(runtimeEvidence.gridProximityPayloadRequests === 0 && result.projectBindings === 0, "grid proximity payload requested at mount, or a binding appeared");
  host.dataset.gridProximityState = "ready";
  meta.textContent = "WAIT \u00b7 five tabs \u00b7 choose one to request the derived proximity index";
}

function bindGridProximity() {
  const button = document.getElementById("gridProximityOpen");
  invariant(button, "grid-proximity opener is missing");
  button.addEventListener("click", () => openGridProximity().catch((error) => {
    console.error("grid proximity", error);
    document.getElementById("gridProximityMeta").textContent = "FAIL \u00b7 grid proximity unavailable; core product unchanged";
    document.getElementById("gridProximityHost").dataset.gridProximityState = "failed";
  }));
}

async function loadSubstation33kv() {
  const entry = registry.supplemental_assets?.grid_actions_inline;
  if (!entry) return;
  try {
    runtimeEvidence.substationRequests += 1;
    const payload = await fetchImmutable(entry.payload.path);
    invariant(payload.schema === entry.payload.schema, "substation schema mismatch");
    invariant(payload.generation === entry.generation, "substation generation mismatch");
    invariant(payload.substation && typeof payload.substation === "object", "substation index missing");
    substation = payload.substation;
    runtimeEvidence.substationReady = true;
  } catch (error) {
    // A substation payload that will not load must not take the table with it.
    substation = null;
  }
}

async function loadGridDistance() {
  const entry = registry.supplemental_assets?.grid_distance_column;
  const note = document.getElementById("gridDistanceNote");
  if (!entry) {
    if (note) note.textContent = "GRID \u00b7 not in this release";
    return;
  }
  try {
    runtimeEvidence.gridDistanceRequests += 1;
    const payload = await fetchImmutable(entry.payload.path);
    invariant(payload.schema === entry.payload.schema, "grid-distance schema mismatch");
    invariant(payload.generation === entry.generation, "grid-distance generation mismatch");
    invariant(payload.grid && typeof payload.grid === "object", "grid-distance index missing");
    gridDistance = payload.grid;
    runtimeEvidence.gridDistanceReady = true;
    if (note) {
      const counts = payload.bands?.counts || {};
      const strong = (counts.STRONG || 0).toLocaleString("en-GB");
      note.textContent = `GRID + SUB \u00b7 BETA \u00b7 in the ACTIONS column, beside MAP \u00b7 `
        + `straight-line km to the nearest mapped circuit and to the nearest substation at 33 kV or above \u00b7 nearest mapped is not nearest: of the 886 transmission substations NESO names at 132 kV and above, the Atlas locates 502 and publishes the other 384 without coordinates rather than dropping them, so the nearest mapped substation may not be the nearest substation \u00b7 `
        + `${(payload.projects || 0).toLocaleString("en-GB")} projects measured, ${strong} within 2 km of a circuit \u00b7 no MVA rating is quoted here; the ratings the Atlas shows are per season, named, and never summed \u2014 NESO publishes a winter rating for all 1,392 circuits and a summer rating for 1,276, and summer differs from winter on 1,081 of those \u00b7 `
        + `not a cable route, and not headroom \u2014 fault level and thermal headroom need DNO network data such as source impedance and a connection study \u00b7 the published transmission network is now answerable: MAP opens the circuits that land at the declared site, their ratings in every season the operator publishes, how many circuits away its neighbours are, and where this output would flow on a declared DC model`;
      // The full scope of the BETA sits on hover rather than in the strip, so
      // the caveat is one gesture away without crowding the filter row.
      note.title = [
        payload.caveat?.distance,
        payload.caveat?.headroom,
        payload.caveat?.coverage,
        payload.beta?.not_covered?.length
          ? "Not covered in this beta: " + payload.beta.not_covered.join("; ")
          : "",
        payload.earth_model
          ? `Measured on ${payload.earth_model.formula} at R = ${payload.earth_model.radius_km} km using ${payload.earth_model.implementation}; every published distance re-measured and reproduced at build time.`
          : "",
      ].filter(Boolean).join("\n\n");
    }
  } catch (error) {
    // A grid payload that will not load must not take the table with it.
    gridDistance = null;
    if (note) note.textContent = "GRID \u00b7 unavailable in this session";
  }
}

async function loadLocality() {
  const entry = registry.supplemental_assets?.table_locality_sort;
  const note = document.getElementById("localityNote");
  if (!entry) {
    if (note) note.textContent = "TOWN + POSTCODE · not in this release";
    return;
  }
  try {
    runtimeEvidence.localityRequests += 1;
    const payload = await fetchImmutable(entry.payload.path);
    invariant(payload.schema === entry.payload.schema, "locality schema mismatch");
    invariant(payload.generation === entry.generation, "locality generation mismatch");
    invariant(payload.locality && typeof payload.locality === "object", "locality index missing");
    locality = payload.locality;
    runtimeEvidence.localityReady = true;
    const counts = payload.counts || {};
    const sourced = (counts.bua || 0) + (counts.parish || 0) + (counts.ward || 0);
    if (note) {
      note.textContent = `TOWN · ${sourced.toLocaleString("en-GB")} from ONS postcode lookup, `
        + `${(counts.derived || 0).toLocaleString("en-GB")} from the REPD address line (dimmed), `
        + `${(counts.none || 0).toLocaleString("en-GB")} unsourceable · `
        + `POSTCODE · ${(counts.postcode || 0).toLocaleString("en-GB")} official REPD values, `
        + `blank offshore`;
      note.title = payload.sources?.town || "";
    }
  } catch (error) {
    // A locality payload that will not load must not take the table with it.
    locality = null;
    if (note) note.textContent = "TOWN + POSTCODE · unavailable in this session";
  }
}

async function openGbElectricityContext() {
  const button = document.getElementById("gbElectricityOpen");
  const host = document.getElementById("gbElectricityHost");
  const meta = document.getElementById("gbElectricityMeta");
  invariant(button && host && meta, "GB electricity context controls are missing");
  if (host.dataset.gbElectricityState === "ready") {
    host.hidden = !host.hidden;
    button.setAttribute("aria-expanded", String(!host.hidden));
    return;
  }
  if (host.dataset.gbElectricityState === "loading") return;
  const entry = registry.supplemental_assets?.gb_electricity_context;
  invariant(entry?.activation === "dynamic-import-and-attested-payload-fetch-on-user-open", "GB electricity activation changed");
  invariant(entry.project_bindings === 0 && entry.eligible_for_news_signal === false, "GB electricity project boundary changed");
  host.hidden = false;
  host.dataset.gbElectricityState = "loading";
  button.setAttribute("aria-expanded", "true");
  meta.textContent = "LOAD · reading the attested 4 kB historic rollup";
  runtimeEvidence.gbElectricityImports += 1;
  invariant(runtimeEvidence.gbElectricityImports === 1, "GB electricity cartridge imported more than once");
  const cartridge = await import(`./${entry.cartridge.filename}`);
  invariant(cartridge.GB_ELECTRICITY_CONTEXT_CONTRACT.generation === entry.generation, "GB electricity cartridge identity changed");
  invariant(cartridge.GB_ELECTRICITY_CONTEXT_CONTRACT.additive_only === true, "GB electricity cartridge is no longer additive-only");
  const result = await cartridge.mountGbElectricityContext({
    host,
    payloadAsset: { ...entry.payload, url: entry.payload.path },
  });
  runtimeEvidence.gbElectricityPayloadRequests = result.payloadRequests;
  invariant(result.payloadRequests === 1 && result.projectBindings === 0, "GB electricity request or project boundary changed");
  meta.textContent = `OK · ${result.years} calendar years · ${result.completeDays.toLocaleString("en-GB")} complete days`;
}

function bindGbElectricityContext() {
  const button = document.getElementById("gbElectricityOpen");
  invariant(button, "GB electricity context opener is missing");
  button.addEventListener("click", () => openGbElectricityContext().catch((error) => {
    console.error("GB electricity context", error);
    document.getElementById("gbElectricityMeta").textContent = "FAIL · historic GB context unavailable; core product unchanged";
    document.getElementById("gbElectricityHost").dataset.gbElectricityState = "failed";
  }));
}

async function openWiderFleet() {
  const meta = document.getElementById("widerFleetMeta");
  const host = document.getElementById("widerFleetHost");
  invariant(meta && host, "wider fleet nodes are missing");
  const entry = registry.supplemental_assets?.map_corpus_contract;
  invariant(entry?.activation === "eager-tab-injection-after-spine-controls-bound", "wider fleet activation changed");
  invariant(entry.project_bindings === 0 && entry.eligible_for_news_signal === false, "wider fleet project boundary changed");
  invariant(entry.reads_spine_payload === false, "wider fleet started reading the spine");
  runtimeEvidence.widerFleetImports += 1;
  invariant(runtimeEvidence.widerFleetImports === 1, "wider fleet cartridge imported more than once");
  const cartridge = await import(`./${entry.cartridge.filename}`);
  invariant(cartridge.WIDER_FLEET_CONTRACT.generation === entry.generation, "wider fleet cartridge identity changed");
  invariant(cartridge.WIDER_FLEET_CONTRACT.additive_only === true, "wider fleet cartridge is no longer additive-only");
  invariant(cartridge.WIDER_FLEET_CONTRACT.control_in_product_technology_row === "select", "wider fleet control left the product technology row");
  invariant(cartridge.WIDER_FLEET_CONTRACT.deep_linkable === true, "wider fleet stopped answering ?technology=");
  invariant(cartridge.WIDER_FLEET_CONTRACT.drives_summary_seam === true, "wider fleet stopped driving the spine summary seam");
  invariant(cartridge.WIDER_FLEET_CONTRACT.releases_on_spine_repaint === true, "wider fleet stopped letting go when the spine repaints");
  invariant(cartridge.WIDER_FLEET_CONTRACT.owns_the_pager_while_showing === true, "wider fleet stopped holding the pager while it holds the table");
  invariant(cartridge.WIDER_FLEET_CONTRACT.export_policy === "declines", "wider fleet changed its export policy without saying so");
  const result = await cartridge.mountWiderFleet({
    host,
    payloadAsset: { ...entry.payload, url: entry.payload.path },
    /* Handed over, not reached for. The cartridge still reads no spine
       payload and holds no spine state: it calls one function with the
       figures it is already showing, and the spine decides what those
       figures mean for the counter, the gauges, the arcs and the CSV. */
    presentSummary,
    /* Handed over for the same reason presentSummary is: so the cut can be
       told the product took its table back, rather than this file keeping a
       list of the controls that do it. */
    onSpineRepaint,
  });
  runtimeEvidence.widerFleetPayloadRequests = result.payloadRequests;
  invariant(result.payloadRequests === 1 && result.projectBindings === 0, "wider fleet request or project boundary changed");
  invariant(result.optionsAdded === entry.repd_technology_types, "wider fleet option count no longer matches the attested cut");
  invariant(result.controlsAdded === 1, "wider fleet put more than one control in the technology row");
  invariant(result.exportPolicy === "declines", "wider fleet started writing the spine 50-column CSV");
  meta.textContent = `OK \u00b7 ${result.optionsAdded} more REPD technology types in one control \u00b7 ${result.projects.toLocaleString("en-GB")} projects \u00b7 ${result.gigawatts} GW${result.deepLinked ? ` \u00b7 deep link \u00b7 ${result.deepLinked}` : ""}`;
}

function bindWiderFleet() {
  // Eager, and deliberately not awaited: the tabs must be on the UI without
  // anyone clicking anything, and a failure here must not delay or break the
  // product's own boot.
  openWiderFleet().catch((error) => {
    console.error("wider fleet", error);
    const meta = document.getElementById("widerFleetMeta");
    if (meta) meta.textContent = "FAIL \u00b7 wider fleet tabs unavailable; core product unchanged";
  });
}

async function boot() {
  registry = await fetchImmutable(REGISTRY_URL);
  invariant(registry.schema === "pipelinenews.v9.timestamp-folder-registry.v1", "registry schema mismatch");
  invariant(registry.generation === GENERATION, "registry generation mismatch");
  invariant(registry.compiler_method === EXPECTED_COMPILER_METHOD, "registry compiler method mismatch");
  invariant(registry.cache_identity === EXPECTED_CACHE_IDENTITY, "registry cache identity mismatch");
  invariant(await hashJson(registry.cache_contract) === EXPECTED_CACHE_IDENTITY, "registry cache contract digest mismatch");
  invariant(registry.cache_contract.compiler_method === EXPECTED_COMPILER_METHOD, "cache compiler method mismatch");
  invariant(arraysEqual(registry.cache_contract.project_index.fields, PROJECT_FIELDS), "registry project field contract mismatch");
  invariant(arraysEqual(registry.cache_contract.news_index.fields, NEWS_FIELDS), "registry news field contract mismatch");
  invariant(registry.cache_contract.news_index.stable_key === "gg_article_id", "registry news key contract mismatch");
  invariant(registry.cache_contract.runtime.physical_project_rows === WINDOW_SIZE, "project window contract mismatch");
  invariant(registry.cache_contract.runtime.physical_news_rows === NEWS_WINDOW_SIZE, "news window contract mismatch");
  invariant(registry.cache_contract.runtime.detail_fetch_concurrency === DETAIL_CONCURRENCY, "detail concurrency contract mismatch");
  projectPayload = await fetchImmutable(registry.assets.projects.path);
  invariant(projectPayload.schema === registry.assets.projects.schema, "project index schema mismatch");
  invariant(projectPayload.generation === registry.assets.projects.generation, "project generation mismatch");
  invariant(projectPayload.cache_identity === registry.assets.projects.cache_identity, "project cache identity mismatch");
  invariant(arraysEqual(projectPayload.fields, PROJECT_FIELDS), "project field contract mismatch");
  invariant(projectPayload.rows.length === registry.totals.project_count, "project index count mismatch");
  rows = projectPayload.rows;
  dictionaries = projectPayload.dictionaries;
  updatedTimes = rows.map((row) => {
    const value = row[FIELD.updated];
    const timestamp = value ? Date.parse(`${value}T00:00:00Z`) : NaN;
    return Number.isFinite(timestamp) ? timestamp : null;
  });
  // Fetched in parallel with nothing else pending, and awaited before the
  // first apply() so the table paints once, with the columns populated. It is
  // allowed to fail: town and postcode fall back to "-", every other column
  // and every sort except town/postcode is unaffected.
  await loadLocality();
  await loadGridDistance();
  await loadSubstation33kv();
  bindProjectControls();
  bindNewsControls();
  bindSectorIntelligence();
  bindWiderFleet();
  bindGbElectricityContext();
  // Relationship abstention ledger withdrawn from the product UI.
  bindGridProximity();
  // Project mixed-taxonomy panel withdrawn from the product UI.
  populateCounties();
  // Before hydrateFiltersFromUrl, because it is what puts the register's other
  // ten statuses into STATUSES -- so ?status=Abandoned arrives instead of being
  // coerced to All.
  populateStatuses();
  hydrateFiltersFromUrl();
  if (query && !requestedRepdRef) await ensureSearchSupplement();
  apply({ syncUrl: false });
  document.getElementById("releaseMeta").textContent = `Live News + evidenced sector intelligence + Atlas V9 deep-link successor · 132 shown headlines · 4 withheld off-topic · ${rows.length.toLocaleString("en-GB")} canonical projects · ${registry.performance.maximum_physical_project_rows} physical rows · TIMESTAMPED RELEASE · POINTER-CONTROLLED`;
  document.body.dataset.fastReady = "true";
  document.body.dataset.fastGeneration = GENERATION;
  globalThis.dispatchEvent(new CustomEvent("pipelinenews-fast-ready", { detail: { generation: GENERATION } }));
  scheduleOptionalLoads();
}

boot().catch((error) => {
  console.error(error);
  document.getElementById("tbody").innerHTML = '<tr><td colspan="13" class="fast-fail">Canonical Q2 REPD data unavailable. The timestamped release has failed closed.</td></tr>';
  document.getElementById("resultsMeta").textContent = "canonical data unavailable";
  document.body.dataset.fastFailed = "true";
});
