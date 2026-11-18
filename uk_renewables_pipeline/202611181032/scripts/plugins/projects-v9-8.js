import { escapeHtml } from "../core/utils.js";
import {
atlasCentresOnRepdPointV9_7,
atlasReceiverV9_7,
atlasUnavailableReasonV9_7,
buildAtlasDeepLinkV9_7,
verifyAtlasReceiverV9_7,
} from "../core/atlas-receiver-v9-7.js";
import { state } from "../core/state.js";
import {
buildProjectSearchTextV9_2,
projectMatchesV9_2,
summariseProjectsV9_2,
tokeniseSearchV9_2,
} from "../core/project-filter-v9-2.js";
import { loadCanonicalProjectsV9_5_1 } from "../data/canonical-projects-v9-5-1.js";
import {
formatCapacityV9_2,
formatLargestV9_2,
setGaugeUniverseV9_2,
updateGaugesV9_2,
} from "./gauges-v9-2.js";
import { signalForProjectV9_5_1 } from "./newspaper-v9-5-1.js";
import { loadInterconnectorsV9_8 } from "../data/interconnectors-v9-8.js";
import {
buildAtlasInterconnectorLinkV9_8,
interconnectorMapNoteV9_8,
interconnectorMapUnavailableReasonV9_8,
} from "../core/atlas-interconnector-link-v9-8.js";
const LABELS = Object.freeze({
solar: "Solar",
bess: "Battery Storage",
wind_onshore: "Onshore Wind",
wind_offshore: "Offshore Wind",
interconnector: "Interconnector",
});
const COLOURS = Object.freeze({ solar: "#ffff00", bess: "#ffae00", wind_onshore: "#00ffff", wind_offshore: "#0066ff", interconnector: "#0066ff" });
const UNITS = Object.freeze({ solar: "MWp", bess: "MW", wind_onshore: "MW", wind_offshore: "MW", interconnector: "MW" });
const ALLOWED_TECHNOLOGIES = new Set(["all", "solar", "bess", "wind_onshore", "wind_offshore", "interconnector"]);
const ALLOWED_STATUSES = new Set(["All", "Operational", "Under Construction", "Awaiting Construction", "Application Submitted"]);
const ALLOWED_SORTS = new Set(["capacity_desc", "updated_desc", "updated_asc", "submitted_desc", "submitted_asc", "operational_desc", "operational_asc"]);
let all = [];
let interconnectors = [];
let interconnectorFailure = "";
function universeFor() {
return technology === "interconnector" ? interconnectors : all;
}
let filtered = [];
let page = 0;
let metadata = null;
let release = null;
let searchIndex = new Map();
let technology = "all";
let status = "All";
let county = "All";
let query = "";
let sortMode = "capacity_desc";
let controlsBound = false;
let submittedYear = "All", updatedYear = "All", operationalYear = "All";
export function atlasUrlV9_5_1(project) {
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
export function compareProjectUpdatesV9_5_1(left, right, direction = "desc") {
const leftTime = repdUpdatedTimestamp(left);
const rightTime = repdUpdatedTimestamp(right);
if (leftTime === null && rightTime === null) return 0;
if (leftTime === null) return 1;
if (rightTime === null) return -1;
return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
}
export function compareProjectSubmissionsV934(left, right, direction="desc") {
const a=left.planning_application_submitted, b=right.planning_application_submitted;
if(!a)return b?1:0;if(!b)return -1;
return direction==="asc"?a.localeCompare(b):b.localeCompare(a);
}
export function compareProjectOperationalV935(left,right,direction="desc") {
const a=left.operational,b=right.operational;
if(!a)return b?1:0;if(!b)return -1;
return direction==="asc"?a.localeCompare(b):b.localeCompare(a);
}
function updateSortHeader() {
for(const [prefix,id,label] of [["updated","repdUpdatedHeader","REPD updated"],["submitted","planningSubmittedHeader","Planning application submitted"],["operational","operationalHeader","Operational date"]]) {
const header=document.getElementById(id), button=document.getElementById(prefix==="updated"?"sortUpdated":prefix==="submitted"?"sortSubmitted":"sortOperational");
const direction=sortMode===prefix+"_asc"?"ascending":sortMode===prefix+"_desc"?"descending":"none";
header.setAttribute("aria-sort",direction);button.setAttribute("aria-label",label+", "+direction+"; click to toggle date order");
document.getElementById(prefix+"SortIndicator").textContent=direction==="ascending"?"\u25b2":direction==="descending"?"\u25bc":"\u2195";
}
}
function populateDateYears() {
for(const [field,id] of [["planning_application_submitted","submittedYear"],["repd_record_updated","updatedYear"],["operational","operationalYear"]]) {
const years=[...new Set(all.map(p=>p[field]?.slice(0,4)).filter(Boolean))].sort().reverse();
for(const select of document.querySelectorAll('[data-year-filter="'+id+'"]')) {
select.replaceChildren(new Option("All years","All"),new Option("Not supplied","missing"));
for(const year of years)select.add(new Option(year,year));
}
}
}
function syncYearControls() {
for(const [id,value] of [["submittedYear",submittedYear],["updatedYear",updatedYear],["operationalYear",operationalYear]])for(const select of document.querySelectorAll('[data-year-filter="'+id+'"]'))select.value=value;
}
function matchesYear(value,year){return year==="All"||(year==="missing"?!value:value?.startsWith(year+"-"));}
function relationshipSummary(project) {
const development = Array.isArray(project.development_repd_refs) ? project.development_repd_refs.length : 0;
const direct = Array.isArray(project.direct_related_repd_refs) ? project.direct_related_repd_refs.length : 0;
const siblings = Array.isArray(project.planning_sibling_repd_refs) ? project.planning_sibling_repd_refs.length : 0;
return `${development} development · ${direct} direct · ${siblings} planning sibling record(s)`;
}
function mapActionHtmlV9_5_1(project) {
const href = atlasUrlV9_5_1(project);
if (!href) {
return `<span class="action-disabled">NO MAP</span>`
+ `<div class="map-note">${escapeHtml(atlasUnavailableReasonV9_7(project))}</div>`;
}
const link = `<a class="action-link atlaslink" target="_blank" rel="noopener" href="${escapeHtml(href)}">MAP ↗</a>`;
if (atlasCentresOnRepdPointV9_7(project)) return link;
return `${link}<div class="map-note">REPD published no coordinate for this record. `
+ `The Atlas resolves it from REPD ${escapeHtml(project.repd_ref)} and centres on its own geometry.</div>`;
}
const FIRST_PAINT_ROWS = 100;
const CHUNK_ROWS = 300;
let renderToken = 0;
function schedule(step) {
if (document.visibilityState === "visible" && typeof requestAnimationFrame === "function") {
requestAnimationFrame(step);
} else {
setTimeout(step, 0);
}
}
function interconnectorRowHtml(record) {
const label = LABELS[record.technology];
const unit = UNITS[record.technology];
const location = [record.county, record.region].filter(Boolean).join(" · ");
const news = new URL("https://www.google.com/search");
news.searchParams.set("q", `${record.name} interconnector`);
news.searchParams.set("tbm", "nws");
const href = buildAtlasInterconnectorLinkV9_8(record);
const mapAction = href
? `<a class="action-link atlaslink" target="_blank" rel="noopener" href="${escapeHtml(href)}">MAP ↗</a><div class="map-note">${escapeHtml(interconnectorMapNoteV9_8(record))}</div>`
: `<span class="action-disabled">NO MAP</span><div class="map-note">${escapeHtml(interconnectorMapUnavailableReasonV9_8(record))}</div>`;
const identity = record.bmrs_code ? `BMRS ${record.bmrs_code}` : "NO BMRS CODE YET";
const geometry = record.geometry_status === "valid"
? `straight line converter to converter, ${record.span.straight_line_km} km; the midpoint is a label anchor, not a location`
: record.geometry_status === "gb_end_only"
? `GB converter ${record.gb_end.name}; the far converter is not held yet`
: "no converter coordinates held";
const gbEnd = record.gb_end && record.gb_end.name ? record.gb_end.name : "GB end not held";
const farEnd = record.far_end && record.far_end.name ? record.far_end.name : `${record.country} end not held`;
const flow = record.flow
? `${record.flow.net_direction}; ${Math.round(record.flow.net_mwh).toLocaleString("en-GB")} MWh net over ${record.flow.years}`
: "flow data not wired for this link";
const lifecycle = record.lifecycle + (record.target_operational ? ` · target ${record.target_operational}` : "");
return `<tr id="repd-${escapeHtml(record.repd_ref)}" data-repd-updated="" data-technology="interconnector"><td class="site">${escapeHtml(record.name)}<div class="project-meta">${escapeHtml(identity)} · ${escapeHtml(record.gg_project_id)} · NOT A REPD RECORD</div><div class="mobile-extra">${escapeHtml(location)}</div><details class="project-record"><summary>INTERCONNECTOR RECORD</summary><div class="record-grid"><div><b>CONVERTERS</b><span>${escapeHtml(gbEnd)} ↔ ${escapeHtml(farEnd)}</span></div><div><b>GEOMETRY</b><span>${escapeHtml(geometry)}</span></div><div><b>FLOW</b><span>${escapeHtml(flow)}</span></div><div><b>LIFECYCLE</b><span>${escapeHtml(lifecycle)}</span></div><div><b>SOURCE</b><span>data-interconnectors reference list; converter positions from gridatlas</span></div><div><b>NOTES</b><span>${escapeHtml(record.notes || "-")}</span></div></div></details></td><td class="hide-mobile">${escapeHtml(location)}</td><td class="hide-mobile">${escapeHtml(record.operator || "not in reference data")}</td><td><span class="badge" style="background:${COLOURS[record.technology]}">${escapeHtml(label)}</span></td><td>${escapeHtml(record.status)}</td><td class="mw">${record.capacity_mw.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${unit}</td><td class="hide-mobile reference-cell repd-ref">${escapeHtml(record.bmrs_code || "no BMRS code")}</td><td class="hide-mobile reference-cell globalgrid-ref">${escapeHtml(record.gg_project_id)}</td><td class="hide-mobile reference-cell repd-updated">not a REPD record</td><td class="hide-mobile reference-cell planning-submitted">not a REPD record</td><td class="hide-mobile reference-cell operational-date">not a REPD record</td><td class="machine-note-cell">NOT A REPD RECORD</td><td><div class="project-actions">${mapAction}<a class="action-link newslink" target="_blank" rel="noopener" href="${escapeHtml(news.href)}">NEWS ↗</a><button class="copy-id" type="button" data-copy-id="${escapeHtml(record.gg_project_id)}">COPY ID</button></div></td></tr>`;
}
function projectRowHtml(project) {
if (project.technology === "interconnector") return interconnectorRowHtml(project);
const label = LABELS[project.technology];
const unit = UNITS[project.technology];
const location = [project.county, project.region].filter(Boolean).join(" · ");
const signal = signalForProjectV9_5_1(project);
const news = new URL("https://www.google.com/search");
news.searchParams.set("q", `${project.name} ${label} UK`);
news.searchParams.set("tbm", "nws");
const mapAction = mapActionHtmlV9_5_1(project);
const planning = project.planning_application_reference || "not supplied by REPD";
const authority = project.planning_authority || "not supplied by REPD";
const developmentId = project.gg_development_id || "not assigned";
const updated = displayDate(project.repd_record_updated);
const submitted = displayDate(project.planning_application_submitted);
const operational = displayDate(project.operational);
return `<tr id="repd-${escapeHtml(project.repd_ref)}" data-repd-updated="${escapeHtml(project.repd_record_updated || "")}" data-planning-application-submitted="${escapeHtml(project.planning_application_submitted || "")}" data-operational="${escapeHtml(project.operational || "")}"><td class="site">${escapeHtml(project.name)}<div class="project-meta">REPD ${escapeHtml(project.repd_ref)} · ${escapeHtml(project.gg_project_id)} · UPDATED ${escapeHtml(updated)}</div><div class="mobile-extra">${escapeHtml([location, project.operator].filter(Boolean).join(" | "))}</div><button type="button" class="machine-note-button mobile-machine-note" data-note-ref="${escapeHtml(project.repd_ref)}" data-note-name="${escapeHtml(project.name)}" data-note-status="${escapeHtml(project.status)}">NOTES · CHECK</button><details class="project-record"><summary>PROJECT RECORD</summary><div class="record-grid"><div><b>PLANNING APPLICATION SUBMITTED</b><span>${escapeHtml(submitted)}</span></div><div><b>OPERATIONAL DATE</b><span>${escapeHtml(operational)}</span></div><div><b>REPD UPDATED</b><span>${escapeHtml(updated)}</span></div><div><b>PLANNING AUTHORITY</b><span>${escapeHtml(authority)}</span></div><div><b>PLANNING REF</b><span>${escapeHtml(planning)}</span></div><div><b>DEVELOPMENT ID</b><span>${escapeHtml(developmentId)}</span></div><div><b>LIFECYCLE</b><span>${escapeHtml(project.lifecycle || "not derived")}</span></div><div><b>RELATIONSHIPS</b><span>${escapeHtml(relationshipSummary(project))}</span></div><div><b>GEOMETRY</b><span>${escapeHtml(project.geometry_status === "valid" ? "valid REPD map point" : "missing — retained without deletion")}</span></div></div></details></td><td class="hide-mobile">${escapeHtml(location || "-")}</td><td class="hide-mobile">${escapeHtml(project.operator || "-")}</td><td><span class="badge" style="background:${COLOURS[project.technology]}">${escapeHtml(label)}</span></td><td>${escapeHtml(project.status)}</td><td class="mw">${project.capacity_mw.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${unit}</td><td class="hide-mobile reference-cell repd-ref">${escapeHtml(project.repd_ref)}</td><td class="hide-mobile reference-cell globalgrid-ref">${escapeHtml(project.gg_project_id)}</td><td class="hide-mobile reference-cell repd-updated">${escapeHtml(updated)}</td><td class="hide-mobile reference-cell planning-submitted">${escapeHtml(submitted)}</td><td class="hide-mobile reference-cell operational-date">${escapeHtml(operational)}</td><td class="machine-note-cell"><button type="button" class="machine-note-button" data-note-ref="${escapeHtml(project.repd_ref)}" data-note-name="${escapeHtml(project.name)}" data-note-status="${escapeHtml(project.status)}">CHECK NOTE</button></td><td><div class="project-actions">${mapAction}<a class="action-link newslink" target="_blank" rel="noopener" href="${escapeHtml(news.href)}">NEWS ↗</a><button class="copy-id" type="button" data-copy-id="${escapeHtml(project.gg_project_id)}">COPY ID</button></div></td></tr>`;
}
const PAGE_ROWS = 20;
function pageCount() {
return Math.max(1, Math.ceil(filtered.length / PAGE_ROWS));
}
function pagerElement() {
let el = document.getElementById("projectPager");
if (!el) {
el = document.createElement("nav");
el.id = "projectPager";
el.className = "pager";
el.setAttribute("aria-label", "Project pages");
const table = document.getElementById("tbody");
const anchor = table ? table.closest("table") : null;
if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
else if (table) table.parentNode.appendChild(el);
}
return el;
}
function renderPager() {
const el = pagerElement();
const pages = pageCount();
const total = filtered.length;
if (!total) {
el.innerHTML = '<span class="pager-meta">no records match the current filters</span>';
return;
}
const from = page * PAGE_ROWS + 1;
const to = Math.min(total, (page + 1) * PAGE_ROWS);
el.innerHTML =
'<button type="button" class="pager-btn" data-page-step="-1"' + (page === 0 ? ' disabled' : '') + '>&larr; PREV</button>' +
'<span class="pager-meta">' + from.toLocaleString("en-GB") + '&ndash;' + to.toLocaleString("en-GB") +
' of ' + total.toLocaleString("en-GB") + ' &middot; page ' + (page + 1) + ' of ' + pages + '</span>' +
'<button type="button" class="pager-btn" data-page-step="1"' + (page + 1 >= pages ? ' disabled' : '') + '>NEXT &rarr;</button>';
el.dataset.page = String(page + 1);
el.dataset.pages = String(pages);
el.dataset.from = String(from);
el.dataset.to = String(to);
}
function renderTable() {
const body = document.getElementById("tbody");
const total = filtered.length;
const pages = pageCount();
if (page > pages - 1) page = pages - 1;
if (page < 0) page = 0;
const from = page * PAGE_ROWS;
const slice = filtered.slice(from, from + PAGE_ROWS);
body.innerHTML = slice.map(projectRowHtml).join("");
window.dispatchEvent(new Event("pipeline-projects-rendered"));
body.dataset.rendered = String(slice.length);
body.dataset.total = String(total);
body.dataset.page = String(page + 1);
body.dataset.pages = String(pages);
body.dataset.complete = "true";
renderPager();
}
function updateResultSummary() {
const summary = summariseProjectsV9_2(filtered);
const element = document.getElementById("resultsMeta");
const universe = universeFor();
element.textContent = `${summary.count.toLocaleString("en-GB")} of ${universe.length.toLocaleString("en-GB")} ${technology === "interconnector" ? "interconnector records (outside the REPD spine)" : "records"} · ${formatCapacityV9_2(summary.capacity_mw)} MW · largest ${formatLargestV9_2(summary.largest_mw)} MW`;
element.classList.toggle("is-filtered", summary.count !== universe.length);
element.dataset.filteredCount = String(summary.count);
element.dataset.totalCount = String(universe.length);
}
function syncFilterUrl() {
const url = new URL(window.location.href);
for (const parameter of ["technology", "status", "county", "q", "sort", "submitted_year", "updated_year", "operational_year"]) url.searchParams.delete(parameter);
if (technology !== "all" || submittedYear !== "All" || updatedYear !== "All" || operationalYear !== "All" || sortMode !== "capacity_desc") url.searchParams.set("technology", technology);
if (status !== "All") url.searchParams.set("status", status);
if (county !== "All") url.searchParams.set("county", county);
if (query) url.searchParams.set("q", query);
if (sortMode !== "capacity_desc") url.searchParams.set("sort", sortMode);
if(submittedYear!=="All")url.searchParams.set("submitted_year",submittedYear);
if(updatedYear!=="All")url.searchParams.set("updated_year",updatedYear);
if(operationalYear!=="All")url.searchParams.set("operational_year",operationalYear);
history.replaceState(history.state, "", url);
}
function apply({ syncUrl = true } = {}) {
const tokens = tokeniseSearchV9_2(query);
filtered = universeFor().filter((project) => projectMatchesV9_2(project, {
technology,
status,
county,
tokens,
}, searchIndex.get(project.repd_ref)) && matchesYear(project.planning_application_submitted,submittedYear) && matchesYear(project.repd_record_updated,updatedYear) && matchesYear(project.operational,operationalYear));
if (sortMode === "updated_desc") filtered.sort((left, right) => compareProjectUpdatesV9_5_1(left, right, "desc"));
if (sortMode === "updated_asc") filtered.sort((left, right) => compareProjectUpdatesV9_5_1(left, right, "asc"));
if(sortMode.startsWith("submitted_"))filtered.sort((a,b)=>compareProjectSubmissionsV934(a,b,sortMode.endsWith("_asc")?"asc":"desc"));
if(sortMode.startsWith("operational_"))filtered.sort((a,b)=>compareProjectOperationalV935(a,b,sortMode.endsWith("_asc")?"asc":"desc"));
state.filtered = filtered;
page = 0;
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
for(const [param,id] of [["submitted_year","submittedYear"],["updated_year","updatedYear"],["operational_year","operationalYear"]]){const v=parameters.get(param)||"All";const valid=[...document.querySelector('[data-year-filter="'+id+'"]').options].some(o=>o.value===v);if(id==="submittedYear")submittedYear=valid?v:"All";else if(id==="updatedYear")updatedYear=valid?v:"All";else operationalYear=valid?v:"All";}
syncYearControls();
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
function reconciliationNote() {
const count = Number(metadata && metadata.source_record_count);
if (!Number.isInteger(count) || count <= 0) return "source record count not stated by the build manifest";
return `${count}/${count} canonical REPD Ref IDs`;
}
function downloadCsv(event) {
event.preventDefault();
const headers = ["Site Name", "REPD Ref", "GlobalGrid Project ID", "GlobalGrid Development ID", "Identity Status", "Identity Confidence", "Technology", "Official REPD Technology", "Official REPD Capacity", "Capacity Unit", "Official REPD Status", "Derived Lifecycle", "Operator or Applicant", "County", "Region", "Country", "Planning Authority", "Planning Application Reference", "REPD Record Updated", "Planning Application Submitted", "Planning Application Withdrawn", "Planning Permission Granted", "Planning Permission Refused", "Planning Permission Expired", "Under Construction", "Operational", "Old REPD Ref", "Direct Related REPD Refs", "Planning Sibling REPD Refs", "Development REPD Refs", "Typed Relationships JSON", "Geometry Status", "Easting", "Northing", "Source CRS", "Longitude", "Latitude", "Atlas V8 URL", "Output CRS", "Coordinate Transform", "Coordinate Use", "Source Dataset", "Source Row", "Projects Array SHA-256", "Source Identity SHA-256", "Source Coordinate Fixture SHA-256", "Source Workbook SHA-256", "Source Reconciliation", "Canonical News Signal — Event Unverified", "Canonical News Match Note"];
const rows = filtered.map((project) => {
const signal = signalForProjectV9_5_1(project);
return [project.name, project.repd_ref, project.gg_project_id, project.gg_development_id, project.identity_status, project.identity_confidence, LABELS[project.technology], project.repd_technology, project.capacity_mw, UNITS[project.technology], project.status, project.lifecycle, project.operator, project.county, project.region, project.country, project.planning_authority, project.planning_application_reference, project.repd_record_updated, project.planning_application_submitted, project.planning_application_withdrawn, project.planning_permission_granted, project.planning_permission_refused, project.planning_permission_expired, project.under_construction, project.operational, project.repd_old_ref, project.direct_related_repd_refs.join("|"), project.planning_sibling_repd_refs.join("|"), project.development_repd_refs.join("|"), JSON.stringify(project.relationships), project.geometry_status, project.easting, project.northing, "EPSG:27700", project.longitude, project.latitude, atlasUrlV9_5_1(project), "RFC 7946 WGS84", project.coordinate_source, "market map context only; never evidence of a grid connection or cadastral boundary", metadata.source_dataset, project.source_row, metadata.projects_sha256, metadata.source_identity_sha256, metadata.source_coordinate_fixture_sha256, metadata.source_workbook_sha256, reconciliationNote(), signal.label, signal.note];
});
const content = `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
const anchor = document.createElement("a");
anchor.href = url;
anchor.download = `globalgrid2050_uk_renewables_pipeline_v9_8_${new Date().toISOString().slice(0, 10)}.csv`;
anchor.click();
URL.revokeObjectURL(url);
document.getElementById("exportMeta").textContent = `${filtered.length.toLocaleString("en-GB")} filtered records exported`;
}
function clearFilters(event) {
event.preventDefault();
technology = "all";
status = "All";
county = "All";
submittedYear = updatedYear = operationalYear = "All";syncYearControls();
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
export async function loadProjectsV9_8() {
try {
const verifying = verifyAtlasReceiverV9_7();
const model = await loadCanonicalProjectsV9_5_1();
all = [...model.projects];
try {
const interconnectorModel = await loadInterconnectorsV9_8();
interconnectors = [...interconnectorModel.records];
} catch (error) {
interconnectors = [];
interconnectorFailure = String((error && error.message) || error);
console.error(error);
const tab = document.querySelector('#tech [data-technology="interconnector"]');
if (tab) { tab.disabled = true; tab.title = interconnectorFailure; }
}
state.interconnectors = interconnectors;
filtered = all;
metadata = model.metadata;
release = model.release;
searchIndex = new Map(all.map((project) => [project.repd_ref, buildProjectSearchTextV9_2(project)]));
for (const record of interconnectors) searchIndex.set(record.repd_ref, buildProjectSearchTextV9_2(record));
state.all = all;
state.filtered = filtered;
state.canonicalModel = model;
setGaugeUniverseV9_2(all);
populateCounties();
populateDateYears();
hydrateFiltersFromUrl();
apply({ syncUrl: false });
document.getElementById("releaseMeta").textContent = `V9.8 interface · V${release.data_parent.release} canonical data spine · ${interconnectors.length} interconnectors on their own tab · all ${all.length.toLocaleString("en-GB")} qualifying records loaded`;
verifying.then((result) => {
if (result.changed) refreshProjectsV9_8();
syncMapAtlasNavV9_7();
if (!result.verified) console.warn(`V9.5.1 MAP: ${result.reason}`);
});
} catch (error) {
console.error(error);
document.getElementById("tbody").innerHTML = '<tr><td colspan="13" style="text-align:center;color:#ff6666">Canonical Q2 REPD data unavailable. V9.5.1 has failed closed.</td></tr>';
document.getElementById("resultsMeta").textContent = "canonical data unavailable";
}
}
export function refreshProjectsV9_8() {
if (metadata) renderTable();
}
export function bindProjectControlsV9_8() {
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
document.getElementById("sortSubmitted").onclick=()=>{sortMode=sortMode==="submitted_desc"?"submitted_asc":"submitted_desc";document.getElementById("sortProjects").value=sortMode;apply();};
document.getElementById("sortOperational").onclick=()=>{sortMode=sortMode==="operational_desc"?"operational_asc":"operational_desc";document.getElementById("sortProjects").value=sortMode;apply();};
for(const select of document.querySelectorAll('[data-year-filter]'))select.onchange=()=>{if(select.dataset.yearFilter==="submittedYear")submittedYear=select.value;else if(select.dataset.yearFilter==="updatedYear")updatedYear=select.value;else if(select.dataset.yearFilter==="operationalYear")operationalYear=select.value;syncYearControls();apply();};
for(const button of document.querySelectorAll('[data-date-sort]'))button.onclick=()=>{sortMode=button.dataset.dateSort;document.getElementById("sortProjects").value=sortMode;button.closest("details").open=false;apply();};
document.getElementById("search").oninput = (event) => { query = event.target.value.trim(); apply(); };
document.addEventListener("click", (event) => {
const button = event.target.closest ? event.target.closest("[data-page-step]") : null;
if (!button || !document.getElementById("projectPager")) return;
const step = Number(button.getAttribute("data-page-step"));
if (!Number.isFinite(step)) return;
const pages = pageCount();
const next = Math.min(pages - 1, Math.max(0, page + step));
if (next === page) return;
page = next;
renderTable();
const table = document.getElementById("tbody");
if (table && table.closest("table")) table.closest("table").scrollIntoView({ block: "start" });
});
document.getElementById("export").onclick = downloadCsv;
document.getElementById("exportInline").onclick = downloadCsv;
document.getElementById("clearFilters").onclick = clearFilters;
document.getElementById("tbody").addEventListener("click", (event) => {
const button = event.target.closest(".copy-id");
if (button) copyProjectId(button);
});
}
function syncMapAtlasNavV9_7() {
const nav = document.getElementById("mapAtlasNav");
if (!nav) return;
const route = atlasReceiverV9_7();
if (!route) {
nav.hidden = true;
return;
}
nav.hidden = false;
nav.href = route;
}
