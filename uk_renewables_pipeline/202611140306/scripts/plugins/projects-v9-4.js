import { escapeHtml } from "../core/utils.js";
import { buildAtlasDeepLinkV9_7 } from "../core/atlas-receiver-v9-7.js";
import { state } from "../core/state.js";
import {
  buildProjectSearchTextV9_2,
  projectMatchesV9_2,
  summariseProjectsV9_2,
  tokeniseSearchV9_2,
} from "../core/project-filter-v9-2.js";
import { loadCanonicalProjectsV9_4 } from "../data/canonical-projects-v9-4.js";
import {
  formatCapacityV9_2,
  formatLargestV9_2,
  setGaugeUniverseV9_2,
  updateGaugesV9_2,
} from "./gauges-v9-2.js";
import { signalForProjectV9_2 } from "./newspaper-v9-2.js";

const LABELS = Object.freeze({
  solar: "Solar",
  bess: "Battery Storage",
  wind_onshore: "Onshore Wind",
  wind_offshore: "Offshore Wind",
});
const COLOURS = Object.freeze({ solar: "#ffff00", bess: "#ffae00", wind_onshore: "#00ffff", wind_offshore: "#0066ff" });
const UNITS = Object.freeze({ solar: "MWp", bess: "MW", wind_onshore: "MW", wind_offshore: "MW" });
const ALLOWED_TECHNOLOGIES = new Set(["all", "solar", "bess", "wind_onshore", "wind_offshore"]);
const ALLOWED_STATUSES = new Set(["All", "Operational", "Under Construction", "Awaiting Construction", "Application Submitted"]);
const ALLOWED_SORTS = new Set(["capacity_desc", "updated_desc", "updated_asc"]);

let all = [];
let filtered = [];
let metadata = null;
let release = null;
let searchIndex = new Map();
let technology = "all";
let status = "All";
let county = "All";
let query = "";
let sortMode = "capacity_desc";
let controlsBound = false;

export function atlasUrlV9_4(project) {
  // The receiver is not named here. It is read from the deep-link contract the
  // engine publishes -- see ../core/atlas-receiver-v9-7.js for the measurement
  // that made this necessary. Seven files in this directory each held their own
  // copy of a route that had quietly stopped carrying the engine.
  return buildAtlasDeepLinkV9_7(project);
}

function displayDate(value) {
  if (!value) return "not supplied by REPD";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value);
}

function repdUpdatedTimestamp(project) {
  if (!project.repd_record_updated) return null;
  const value = Date.parse(`${project.repd_record_updated}T00:00:00Z`);
  return Number.isFinite(value) ? value : null;
}

export function compareProjectUpdatesV9_4(left, right, direction = "desc") {
  const leftTime = repdUpdatedTimestamp(left);
  const rightTime = repdUpdatedTimestamp(right);
  if (leftTime === null && rightTime === null) return 0;
  if (leftTime === null) return 1;
  if (rightTime === null) return -1;
  return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
}

function updateSortHeader() {
  const header = document.getElementById("repdUpdatedHeader");
  const button = document.getElementById("sortUpdated");
  const indicator = document.getElementById("updatedSortIndicator");
  if (!header || !button || !indicator) return;
  if (sortMode === "updated_desc") {
    header.setAttribute("aria-sort", "descending");
    indicator.textContent = "▼";
    button.setAttribute("aria-label", "REPD updated date sorted newest first; click for oldest first");
    button.title = "Newest first — click for oldest first";
    return;
  }
  if (sortMode === "updated_asc") {
    header.setAttribute("aria-sort", "ascending");
    indicator.textContent = "▲";
    button.setAttribute("aria-label", "REPD updated date sorted oldest first; click for newest first");
    button.title = "Oldest first — click for newest first";
    return;
  }
  header.setAttribute("aria-sort", "none");
  indicator.textContent = "↕";
  button.setAttribute("aria-label", "Sort by REPD updated date, newest first");
  button.title = "Click for newest first";
}

function relationshipSummary(project) {
  const development = Array.isArray(project.development_repd_refs) ? project.development_repd_refs.length : 0;
  const direct = Array.isArray(project.direct_related_repd_refs) ? project.direct_related_repd_refs.length : 0;
  const siblings = Array.isArray(project.planning_sibling_repd_refs) ? project.planning_sibling_repd_refs.length : 0;
  return `${development} development · ${direct} direct · ${siblings} planning sibling record(s)`;
}

function renderTable() {
  const body = document.getElementById("tbody");
  body.innerHTML = filtered.map((project) => {
    const label = LABELS[project.technology];
    const unit = UNITS[project.technology];
    const location = [project.county, project.region].filter(Boolean).join(" · ");
    const signal = signalForProjectV9_2(project);
    const news = new URL("https://www.google.com/search");
    news.searchParams.set("q", `${project.name} ${label} UK`);
    news.searchParams.set("tbm", "nws");
    const atlas = atlasUrlV9_4(project);
    const mapAction = atlas
      ? `<a class="action-link atlaslink" target="_blank" rel="noopener" href="${escapeHtml(atlas)}">MAP ↗</a>`
      : '<span class="action-disabled" title="REPD geometry is unavailable; the record remains searchable and exportable">NO MAP</span>';
    const planning = project.planning_application_reference || "not supplied by REPD";
    const authority = project.planning_authority || "not supplied by REPD";
    const developmentId = project.gg_development_id || "not assigned";
    const updated = displayDate(project.repd_record_updated);
    return `<tr id="repd-${escapeHtml(project.repd_ref)}" data-repd-updated="${escapeHtml(project.repd_record_updated || "")}"><td class="site">${escapeHtml(project.name)}<div class="project-meta">REPD ${escapeHtml(project.repd_ref)} · ${escapeHtml(project.gg_project_id)} · UPDATED ${escapeHtml(updated)}</div><div class="mobile-extra">${escapeHtml([location, project.operator].filter(Boolean).join(" | "))}</div><details class="project-record"><summary>PROJECT RECORD</summary><div class="record-grid"><div><b>PLANNING AUTHORITY</b><span>${escapeHtml(authority)}</span></div><div><b>PLANNING REF</b><span>${escapeHtml(planning)}</span></div><div><b>DEVELOPMENT ID</b><span>${escapeHtml(developmentId)}</span></div><div><b>LIFECYCLE</b><span>${escapeHtml(project.lifecycle || "not derived")}</span></div><div><b>RELATIONSHIPS</b><span>${escapeHtml(relationshipSummary(project))}</span></div><div><b>GEOMETRY</b><span>${escapeHtml(project.geometry_status === "valid" ? "valid REPD map point" : "missing — retained without deletion")}</span></div></div></details></td><td class="hide-mobile">${escapeHtml(location || "-")}</td><td class="hide-mobile">${escapeHtml(project.operator || "-")}</td><td><span class="badge" style="background:${COLOURS[project.technology]}">${escapeHtml(label)}</span></td><td>${escapeHtml(project.status)}</td><td class="mw">${project.capacity_mw.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${unit}</td><td class="hide-mobile reference-cell repd-ref">${escapeHtml(project.repd_ref)}</td><td class="hide-mobile reference-cell globalgrid-ref">${escapeHtml(project.gg_project_id)}</td><td class="hide-mobile reference-cell repd-updated">${escapeHtml(updated)}</td><td><span class="signal ${escapeHtml(signal.cls)}">${escapeHtml(signal.label)}</span><div class="signal-note">${escapeHtml(signal.note)}</div></td><td><div class="project-actions">${mapAction}<a class="action-link newslink" target="_blank" rel="noopener" href="${escapeHtml(news.href)}">NEWS ↗</a><button class="copy-id" type="button" data-copy-id="${escapeHtml(project.gg_project_id)}">COPY ID</button></div></td></tr>`;
  }).join("");
}

function updateResultSummary() {
  const summary = summariseProjectsV9_2(filtered);
  const element = document.getElementById("resultsMeta");
  element.textContent = `${summary.count.toLocaleString("en-GB")} of ${all.length.toLocaleString("en-GB")} records · ${formatCapacityV9_2(summary.capacity_mw)} MW · largest ${formatLargestV9_2(summary.largest_mw)} MW`;
  element.classList.toggle("is-filtered", summary.count !== all.length);
  element.dataset.filteredCount = String(summary.count);
  element.dataset.totalCount = String(all.length);
}

function syncFilterUrl() {
  const url = new URL(window.location.href);
  for (const parameter of ["technology", "status", "county", "q", "sort"]) url.searchParams.delete(parameter);
  if (technology !== "all") url.searchParams.set("technology", technology);
  if (status !== "All") url.searchParams.set("status", status);
  if (county !== "All") url.searchParams.set("county", county);
  if (query) url.searchParams.set("q", query);
  if (sortMode !== "capacity_desc") url.searchParams.set("sort", sortMode);
  history.replaceState(null, "", url);
}

function apply({ syncUrl = true } = {}) {
  const tokens = tokeniseSearchV9_2(query);
  filtered = all.filter((project) => projectMatchesV9_2(project, {
    technology,
    status,
    county,
    tokens,
  }, searchIndex.get(project.repd_ref)));
  if (sortMode === "updated_desc") filtered.sort((left, right) => compareProjectUpdatesV9_4(left, right, "desc"));
  if (sortMode === "updated_asc") filtered.sort((left, right) => compareProjectUpdatesV9_4(left, right, "asc"));
  state.filtered = filtered;
  updateGaugesV9_2(filtered);
  renderTable();
  updateResultSummary();
  updateSortHeader();
  if (syncUrl) syncFilterUrl();
}

function populateCounties() {
  const select = document.getElementById("county");
  select.replaceChildren(new Option("🌍 ALL COUNTIES", "All"));
  [...new Set(all.map((project) => project.county).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en-GB"))
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
  const parameters = new URLSearchParams(window.location.search);
  const requestedTechnology = parameters.get("technology") || "all";
  const requestedStatus = parameters.get("status") || "All";
  const requestedCounty = parameters.get("county") || "All";
  const requestedSort = parameters.get("sort") || "capacity_desc";
  technology = ALLOWED_TECHNOLOGIES.has(requestedTechnology) ? requestedTechnology : "all";
  status = ALLOWED_STATUSES.has(requestedStatus) ? requestedStatus : "All";
  county = [...document.getElementById("county").options].some((option) => option.value === requestedCounty)
    ? requestedCounty
    : "All";
  query = parameters.get("q") || "";
  sortMode = ALLOWED_SORTS.has(requestedSort) ? requestedSort : "capacity_desc";
  setButtonState("#tech", "technology", technology);
  setButtonState("#status", "officialStatus", status);
  document.getElementById("county").value = county;
  document.getElementById("search").value = query;
  document.getElementById("sortProjects").value = sortMode;
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^(?:[=+\-@]|\s+[=+\-@]|\t|\r|\n)/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(event) {
  event.preventDefault();
  const headers = ["Site Name", "REPD Ref", "GlobalGrid Project ID", "GlobalGrid Development ID", "Identity Status", "Identity Confidence", "Technology", "Official REPD Technology", "Official REPD Capacity", "Capacity Unit", "Official REPD Status", "Derived Lifecycle", "Operator or Applicant", "County", "Region", "Country", "Planning Authority", "Planning Application Reference", "REPD Record Updated", "Planning Application Submitted", "Planning Application Withdrawn", "Planning Permission Granted", "Planning Permission Refused", "Planning Permission Expired", "Under Construction", "Operational", "Old REPD Ref", "Direct Related REPD Refs", "Planning Sibling REPD Refs", "Development REPD Refs", "Typed Relationships JSON", "Geometry Status", "Easting", "Northing", "Source CRS", "Longitude", "Latitude", "Atlas V8 URL", "Output CRS", "Coordinate Transform", "Coordinate Use", "Source Dataset", "Source Row", "Projects Array SHA-256", "Source Identity SHA-256", "Source Coordinate Fixture SHA-256", "Source Workbook SHA-256", "Source Reconciliation", "Legacy News Signal — Unverified", "Legacy News Note — Unverified"];
  const rows = filtered.map((project) => {
    const signal = signalForProjectV9_2(project);
    return [project.name, project.repd_ref, project.gg_project_id, project.gg_development_id, project.identity_status, project.identity_confidence, LABELS[project.technology], project.repd_technology, project.capacity_mw, UNITS[project.technology], project.status, project.lifecycle, project.operator, project.county, project.region, project.country, project.planning_authority, project.planning_application_reference, project.repd_record_updated, project.planning_application_submitted, project.planning_application_withdrawn, project.planning_permission_granted, project.planning_permission_refused, project.planning_permission_expired, project.under_construction, project.operational, project.repd_old_ref, project.direct_related_repd_refs.join("|"), project.planning_sibling_repd_refs.join("|"), project.development_repd_refs.join("|"), JSON.stringify(project.relationships), project.geometry_status, project.easting, project.northing, "EPSG:27700", project.longitude, project.latitude, atlasUrlV9_4(project), "RFC 7946 WGS84", project.coordinate_source, "market map context only; never evidence of a grid connection or cadastral boundary", metadata.source_dataset, project.source_row, metadata.projects_sha256, metadata.source_identity_sha256, metadata.source_coordinate_fixture_sha256, metadata.source_workbook_sha256, "14657/14657 canonical REPD Ref IDs", signal.label, signal.note];
  });
  const content = `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `globalgrid2050_uk_renewables_pipeline_v9_4_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  document.getElementById("exportMeta").textContent = `${filtered.length.toLocaleString("en-GB")} filtered records exported`;
}

function clearFilters(event) {
  event.preventDefault();
  technology = "all";
  status = "All";
  county = "All";
  query = "";
  sortMode = "capacity_desc";
  setButtonState("#tech", "technology", technology);
  setButtonState("#status", "officialStatus", status);
  document.getElementById("county").value = county;
  document.getElementById("search").value = "";
  document.getElementById("sortProjects").value = sortMode;
  apply();
}

async function copyProjectId(button) {
  const value = button.dataset.copyId;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  const original = button.textContent;
  button.textContent = "COPIED";
  button.classList.add("copied");
  setTimeout(() => {
    button.textContent = original;
    button.classList.remove("copied");
  }, 1200);
}

export async function loadProjectsV9_4() {
  try {
    const model = await loadCanonicalProjectsV9_4();
    all = [...model.projects];
    filtered = all;
    metadata = model.metadata;
    release = model.release;
    searchIndex = new Map(all.map((project) => [project.repd_ref, buildProjectSearchTextV9_2(project)]));
    state.all = all;
    state.filtered = filtered;
    state.canonicalModel = model;
    setGaugeUniverseV9_2(all);
    populateCounties();
    hydrateFiltersFromUrl();
    apply({ syncUrl: false });
    document.getElementById("releaseMeta").textContent = `V9.4 interface · V${release.data_parent.release} canonical data spine · all ${all.length.toLocaleString("en-GB")} qualifying records loaded`;
  } catch (error) {
    console.error(error);
    document.getElementById("tbody").innerHTML = '<tr><td colspan="11" style="text-align:center;color:#ff6666">Canonical Q2 REPD data unavailable. V9.4 has failed closed.</td></tr>';
    document.getElementById("resultsMeta").textContent = "canonical data unavailable";
  }
}

export function refreshProjectsV9_4() {
  if (metadata) renderTable();
}

export function bindProjectControlsV9_4() {
  if (controlsBound) return;
  controlsBound = true;
  document.querySelectorAll("#tech .btn").forEach((button) => {
    button.onclick = () => {
      technology = button.dataset.technology;
      setButtonState("#tech", "technology", technology);
      apply();
    };
  });
  document.querySelectorAll("#status .btn").forEach((button) => {
    button.onclick = () => {
      status = button.dataset.officialStatus;
      setButtonState("#status", "officialStatus", status);
      apply();
    };
  });
  document.getElementById("county").onchange = (event) => { county = event.target.value; apply(); };
  document.getElementById("sortProjects").onchange = (event) => { sortMode = event.target.value; apply(); };
  document.getElementById("sortUpdated").onclick = () => {
    sortMode = sortMode === "updated_desc" ? "updated_asc" : "updated_desc";
    document.getElementById("sortProjects").value = sortMode;
    apply();
  };
  document.getElementById("search").oninput = (event) => { query = event.target.value.trim(); apply(); };
  document.getElementById("export").onclick = downloadCsv;
  document.getElementById("exportInline").onclick = downloadCsv;
  document.getElementById("clearFilters").onclick = clearFilters;
  document.getElementById("tbody").addEventListener("click", (event) => {
    const button = event.target.closest(".copy-id");
    if (button) copyProjectId(button);
  });
}
