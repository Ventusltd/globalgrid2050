import { buildAtlasV9DeepLink } from "./202608311343-atlas-pointer-deep-link.mjs";

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
const STATUSES = new Set(["All", "Operational", "Under Construction", "Awaiting Construction", "Application Submitted"]);
const SORTS = new Set(["capacity_desc", "updated_desc", "updated_asc"]);
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
  gridProximityImports: 0,
  gridProximityPayloadRequests: 0,
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
  const news = new URL("https://www.google.com/search");
  news.searchParams.set("q", `${item.name} ${label} UK`);
  news.searchParams.set("tbm", "nws");
  const atlas = atlasUrl(item);
  const mapAction = atlas
    ? `<a class="action-link atlaslink" target="_blank" rel="noopener" href="${escapeHtml(atlas)}">MAP ↗</a>`
    : '<span class="action-disabled" title="REPD geometry is unavailable; the record remains searchable and exportable">NO MAP</span>';
  return `<tr id="repd-${escapeHtml(item.repd_ref)}" data-project-index="${index}"><td class="site">${escapeHtml(item.name)}<div class="project-meta">REPD ${escapeHtml(item.repd_ref)} · ${escapeHtml(item.gg_project_id)} · UPDATED ${escapeHtml(displayDate(item.repd_record_updated))}</div><div class="mobile-extra">${escapeHtml([locationText, item.operator].filter(Boolean).join(" | "))}</div><details class="project-record" data-detail-index="${index}"><summary>PROJECT RECORD</summary><div class="record-grid"><div class="detail-loading">Open to load official project details…</div></div></details></td><td class="hide-mobile">${escapeHtml(locationText || "-")}</td><td class="hide-mobile">${escapeHtml(item.operator || "-")}</td><td><span class="badge" style="background:${COLOURS[item.technology]}">${escapeHtml(label)}</span></td><td>${escapeHtml(item.status)}</td><td class="mw">${formatNumber(item.capacity_mw)} ${UNITS[item.technology]}</td><td class="hide-mobile reference-cell repd-ref">${escapeHtml(item.repd_ref)}</td><td class="hide-mobile reference-cell globalgrid-ref">${escapeHtml(item.gg_project_id)}</td><td class="hide-mobile reference-cell repd-updated">${escapeHtml(displayDate(item.repd_record_updated))}</td><td><span class="signal ${escapeHtml(signal.cls)}">${escapeHtml(signal.label)}</span><div class="signal-note">${escapeHtml(signal.note)}</div></td><td><div class="project-actions">${mapAction}<a class="action-link newslink" target="_blank" rel="noopener" href="${escapeHtml(news.href)}">NEWS ↗</a><button class="copy-id" type="button" data-copy-id="${escapeHtml(item.gg_project_id)}">COPY ID</button></div></td></tr>`;
}

function ensureWindowControls() {
  let panel = document.getElementById("projectWindowControls");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "projectWindowControls";
  panel.className = "project-window-controls";
  panel.innerHTML = '<button type="button" data-window="previous">PREVIOUS 50</button><span data-window-range></span><button type="button" data-window="next">NEXT 50</button>';
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
  const header = document.getElementById("repdUpdatedHeader");
  const indicator = document.getElementById("updatedSortIndicator");
  const button = document.getElementById("sortUpdated");
  if (sortMode === "updated_desc") {
    header.setAttribute("aria-sort", "descending");
    indicator.textContent = "▼";
    button.title = "Newest first — click for oldest first";
  } else if (sortMode === "updated_asc") {
    header.setAttribute("aria-sort", "ascending");
    indicator.textContent = "▲";
    button.title = "Oldest first — click for newest first";
  } else {
    header.setAttribute("aria-sort", "none");
    indicator.textContent = "↕";
    button.title = "Click for newest first";
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
  element.textContent = `${summary.count.toLocaleString("en-GB")} of ${rows.length.toLocaleString("en-GB")} records · ${formatNumber(summary.capacity)} MW · largest ${formatNumber(summary.largest)} MW`;
  element.classList.toggle("is-filtered", summary.count !== rows.length);
  element.dataset.filteredCount = String(summary.count);
  element.dataset.totalCount = String(rows.length);
}

function syncFilterUrl() {
  const url = new URL(location.href);
  for (const parameter of ["technology", "status", "county", "q", "sort", "repd_ref"]) url.searchParams.delete(parameter);
  if (technology !== "all") url.searchParams.set("technology", technology);
  if (status !== "All") url.searchParams.set("status", status);
  if (county !== "All") url.searchParams.set("county", county);
  if (requestedRepdRef) url.searchParams.set("repd_ref", requestedRepdRef);
  else if (query) url.searchParams.set("q", query);
  if (sortMode !== "capacity_desc") url.searchParams.set("sort", sortMode);
  history.replaceState(null, "", url);
}

function apply({ syncUrl = true } = {}) {
  const tokens = normalise(query).split(" ").filter(Boolean);
  const next = [];
  let capacity = 0;
  let largest = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const item = project(index);
    if (technology !== "all" && item.technology !== technology) continue;
    if (status !== "All" && !item.status.includes(status)) continue;
    if (county !== "All" && item.county !== county) continue;
    if (requestedRepdRef && String(item.repd_ref) !== requestedRepdRef) continue;
    if (!requestedRepdRef && tokens.length) {
      const searchable = searchSupplement?.[index] || compactSearchText(index);
      if (!tokens.every((token) => searchable.includes(token))) continue;
    }
    next.push(index);
    capacity += item.capacity_mw;
    largest = Math.max(largest, item.capacity_mw);
  }
  if (sortMode === "updated_desc" || sortMode === "updated_asc") {
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
  updateSummary(summary);
  updateGauges(summary);
  updateSortHeader();
  if (syncUrl) syncFilterUrl();
}

function populateCounties() {
  const select = document.getElementById("county");
  select.replaceChildren(new Option("🌍 ALL COUNTIES", "All"));
  dictionaries.county.filter(Boolean).sort((left, right) => left.localeCompare(right, "en-GB"))
    .forEach((value) => select.add(new Option(`📍 ${value}`, value)));
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
  setButtonState("#status", "officialStatus", status);
  document.getElementById("county").value = county;
  document.getElementById("search").value = query;
  document.getElementById("sortProjects").value = sortMode;
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

async function downloadCsv(event) {
  event.preventDefault();
  const meta = document.getElementById("exportMeta");
  meta.textContent = "Loading full official fields for filtered export…";
  try {
    await Promise.all(registry.detail_partitions.map((_, index) => loadDetailPartition(index)));
    const headers = ["Site Name", "REPD Ref", "GlobalGrid Project ID", "GlobalGrid Development ID", "Identity Status", "Identity Confidence", "Technology", "Official REPD Technology", "Official REPD Capacity", "Capacity Unit", "Official REPD Status", "Derived Lifecycle", "Operator or Applicant", "County", "Region", "Country", "Planning Authority", "Planning Application Reference", "REPD Record Updated", "Planning Application Submitted", "Planning Application Withdrawn", "Planning Permission Granted", "Planning Permission Refused", "Planning Permission Expired", "Under Construction", "Operational", "Old REPD Ref", "Direct Related REPD Refs", "Planning Sibling REPD Refs", "Development REPD Refs", "Typed Relationships JSON", "Geometry Status", "Easting", "Northing", "Source CRS", "Longitude", "Latitude", "Atlas V9 URL", "Output CRS", "Coordinate Transform", "Coordinate Use", "Source Dataset", "Source Row", "Projects Array SHA-256", "Source Identity SHA-256", "Source Coordinate Fixture SHA-256", "Source Workbook SHA-256", "Source Reconciliation", "Canonical News Signal — Event Unverified", "Canonical News Match Note"];
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

function clearFilters(event) {
  event.preventDefault();
  technology = "all";
  status = "All";
  county = "All";
  query = "";
  requestedRepdRef = "";
  sortMode = "capacity_desc";
  setButtonState("#tech", "technology", technology);
  setButtonState("#status", "officialStatus", status);
  document.getElementById("county").value = county;
  document.getElementById("search").value = "";
  document.getElementById("sortProjects").value = sortMode;
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
      setButtonState("#status", "officialStatus", status);
      apply();
    });
  });
  document.getElementById("county").addEventListener("change", (event) => { county = event.target.value; apply(); });
  document.getElementById("sortProjects").addEventListener("change", (event) => { sortMode = event.target.value; apply(); });
  document.getElementById("sortUpdated").addEventListener("click", () => {
    sortMode = sortMode === "updated_desc" ? "updated_asc" : "updated_desc";
    document.getElementById("sortProjects").value = sortMode;
    apply();
  });
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
  const projectName = row[NEWS_FIELD.project] || "";
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
  return `<a class="story ${articleClass}" data-article-id="${escapeHtml(row[NEWS_FIELD.articleId])}" href="${escapeHtml(row[NEWS_FIELD.url])}" target="_blank" rel="noopener"><div class="kicker">${escapeHtml(technologyValue || "ENERGY")} · ${escapeHtml(row[NEWS_FIELD.event] || "PROJECT UPDATE")}${eventDetail ? ` · ${escapeHtml(eventDetail)}` : ""} · ${escapeHtml(row[NEWS_FIELD.published] || "")}</div><h3>${escapeHtml(row[NEWS_FIELD.headline] || projectName)}</h3><p><span class="project">${escapeHtml(projectName)}${capacity ? ` · ${capacity.toLocaleString("en-GB")} MW` : ""}</span>${row[NEWS_FIELD.operator] ? ` · ${escapeHtml(row[NEWS_FIELD.operator])}` : ""}${row[NEWS_FIELD.county] ? ` · ${escapeHtml(row[NEWS_FIELD.county])}` : ""}</p>${componentNote}<span class="source">${escapeHtml(row[NEWS_FIELD.source] || "Source")} · ${quality} · classified against the frozen REPD spine</span></a>`;
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
    newsRows = payload.rows;
    runtimeEvidence.newsReady = true;
    document.getElementById("newsMeta").textContent = `${registry.news_counts.uk} UK · ${registry.news_counts.international} international (${registry.news_counts.us} US · ${registry.news_counts.europe} Europe · ${registry.news_counts.other} other) · ${registry.news_counts.all} headlines · immutable compact edition`;
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
  const entry = registry.supplemental_assets?.sector_intelligence;
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
  meta.textContent = "WAIT · seven topics · choose one to request the compact Parquet-derived payload";
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
  meta.textContent = "WAIT \u00b7 four tabs \u00b7 choose one to request the derived proximity index";
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
  bindProjectControls();
  bindNewsControls();
  bindSectorIntelligence();
  bindFederatedRelationships();
  bindGridProximity();
  bindProjectIntelligence();
  populateCounties();
  hydrateFiltersFromUrl();
  if (query && !requestedRepdRef) await ensureSearchSupplement();
  apply({ syncUrl: false });
  document.getElementById("releaseMeta").textContent = `Live News + sector and relationship intelligence + Atlas V9 deep-link successor · ${rows.length.toLocaleString("en-GB")} canonical projects · ${registry.performance.maximum_physical_project_rows} physical rows · sector and relationship payloads lazy · TIMESTAMPED RELEASE · POINTER-CONTROLLED`;
  document.body.dataset.fastReady = "true";
  document.body.dataset.fastGeneration = GENERATION;
  globalThis.dispatchEvent(new CustomEvent("pipelinenews-fast-ready", { detail: { generation: GENERATION } }));
  scheduleOptionalLoads();
}

boot().catch((error) => {
  console.error(error);
  document.getElementById("tbody").innerHTML = '<tr><td colspan="11" class="fast-fail">Canonical Q2 REPD data unavailable. The timestamped release has failed closed.</td></tr>';
  document.getElementById("resultsMeta").textContent = "canonical data unavailable";
  document.body.dataset.fastFailed = "true";
});
