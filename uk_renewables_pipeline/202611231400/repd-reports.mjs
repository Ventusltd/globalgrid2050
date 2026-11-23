// PipelineNews V9.74 candidate: same REPD cockpit with source-faithful cross-filters; original visual styles untouched.
import { state } from "./scripts/core/state.js";
import { atlasUrlV9_5_1 } from "./scripts/plugins/projects-v9-8.js";
import { buildRepdCapacityReport } from "./repd-reports-model.mjs";
import { buildCockpitReport, SOURCE_UNAVAILABLE } from "../../automation/repd_reporting/v2/cockpit-facets.mjs";
import { buildAtlasInterconnectorLinkV9_8 } from "./scripts/core/atlas-interconnector-link-v9-8.js";

const panel = document.getElementById("repdReportsPanel");
const reportButtons = [...document.querySelectorAll("[data-repd-report]")];
const reportScope = document.getElementById("repdReportScope");
const reportBody = document.getElementById("repdReportsBody");
const reportSummary = document.getElementById("repdReportsSummary");
const csvButton = document.getElementById("repdReportCsv");
const closeButton = document.getElementById("repdReportsClose");
const titles = { operator: "Capacity by operator", status: "Capacity by official REPD status", region: "Capacity by region" };
let active = "";
let lastReport = null;
let lastSnapshot = null;
let lastSelection = null;

function el(tag, className, value) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (value !== undefined) result.textContent = String(value);
  return result;
}
// All facets live inside the existing REPD report tablet, never a second dashboard.
function makeFacet(key, title) {
  const label = document.createElement("label");
  label.className = "repd-cockpit-facet";
  const span = document.createElement("span");
  span.textContent = title;
  const select = document.createElement("select");
  select.id = "repdFacet" + key[0].toUpperCase() + key.slice(1);
  select.setAttribute("aria-label", "Cockpit report " + title);
  label.append(span, select);
  if (csvButton?.parentElement) csvButton.parentElement.insertBefore(label, csvButton);
  select.addEventListener("change", render);
  return select;
}
const statusFacet = panel ? makeFacet("status", "STATUS") : null;
const operatorFacet = panel ? makeFacet("operator", "OPERATOR") : null;
const regionFacet = panel ? makeFacet("region", "REGION") : null;
if (reportScope?.options?.[0]) reportScope.options[0].textContent = "COCKPIT TECHNOLOGY + STATUS";
if (reportScope?.options?.[1]) reportScope.options[1].textContent = "CURRENT TABLE FILTERS + COCKPIT";
function selections(select, values, initialLabel, initialValue = "All") {
  if (!select) return;
  const previous = select.value || initialValue;
  const options = [new Option(initialLabel, initialValue)];
  for (const value of values) {
    if (value === initialValue) continue;
    options.push(new Option(value, value));
  }
  if (![...options].some(option => option.value === previous)) options.push(new Option(previous, previous));
  select.replaceChildren(...options);
  select.value = previous;
}
function nativeTechnology() {
  const active = document.querySelector('#tech [data-technology][aria-pressed="true"]');
  return active?.dataset.technology || new URL(window.location.href).searchParams.get("technology") || "all";
}
function nativeStatus() {
  const active = document.querySelector('#status [data-official-status][aria-pressed="true"]');
  return active?.dataset.officialStatus || "All";
}
function chosenFilter() {
  return {
    technology: nativeTechnology(),
    status: statusFacet?.value === "FOLLOW" || !statusFacet?.value ? nativeStatus() : statusFacet.value,
    operator: operatorFacet?.value || "All",
    region: regionFacet?.value || "All",
  };
}
function refreshChoices(report) {
  const unique = (items) => [...new Set(items)].sort((a,b) => a.localeCompare(b,"en-GB"));
  const statusValues = unique([...state.all, ...(Array.isArray(state.interconnectors) ? state.interconnectors : [])]
    .map(row => String(row.status || "Not reported").trim() || "Not reported"));
  const previous = statusFacet?.value || "FOLLOW";
  selections(statusFacet, ["All", ...statusValues], "FOLLOW TABLE STATUS", "FOLLOW");
  if (statusFacet) {
    if (![...statusFacet.options].some(option => option.value === "All")) {
      statusFacet.add(new Option("ALL OFFICIAL STATUSES", "All"));
    }
    const all = [...statusFacet.options].find(option => option.value === "All");
    if (all) all.textContent = "ALL OFFICIAL STATUSES";
    statusFacet.value = previous;
  }
  const values = (key) => report.facets?.[key]?.map(item => item.value) || [];
  selections(operatorFacet, values("operator"), "ALL OPERATORS");
  selections(regionFacet, values("region"), "ALL REGIONS");
}
function buildInterconnectorCapacityReport(projects, dimension) {
  // Separate, explicitly labelled interconnector inventory; no REPD ID dedupe or mixing.
  const empty = () => ({count:0, recordedCapacity:0, solarMwp:0, otherMw:0, missingCapacity:0});
  const total = empty(), groups = new Map();
  const seen = new Set();
  const add = (target, project) => {
    target.count++;
    const capacity = project.capacity_mw;
    if (typeof capacity !== "number" || !Number.isFinite(capacity) || capacity < 0) target.missingCapacity++;
    else { target.recordedCapacity+=capacity;target.otherMw+=capacity; }
  };
  for (const project of projects) {
    const ref = String(project.asset_id ?? project.gg_project_id ?? project.bmrs_code ?? "").trim();
    if (!ref || seen.has(ref)) throw new Error("Missing/duplicate interconnector ID: " + ref);
    seen.add(ref);
    const name = String(project[dimension] || "Not reported").trim() || "Not reported";
    let group = groups.get(name);
    if (!group) { group = {name, ...empty(), projects:[], statuses:new Map()};groups.set(name,group); }
    const status = String(project.status || "Not reported").trim() || "Not reported";
    if (!group.statuses.has(status)) group.statuses.set(status,empty());
    add(group.statuses.get(status),project);add(group,project);add(total,project);
    group.projects.push(project);
  }
  return {dimension,total,groups:[...groups.values()].sort((a,b)=>b.recordedCapacity-a.recordedCapacity || b.count-a.count || a.name.localeCompare(b.name,"en-GB")), uniqueRefs:seen.size};
}
function formatCapacity(n) {
  return Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 });
}
function formatCount(n) {
  return Number(n || 0).toLocaleString("en-GB");
}
function capacityDescription(summary) {
  return formatCapacity(summary.recordedCapacity) + " recorded MW/MWp · " +
    formatCapacity(summary.solarMwp) + " solar MWp · " +
    formatCapacity(summary.otherMw) + " other MW";
}
function projectTableLink(project) {
  const href = new URL(window.location.href);
  href.hash = "";
  href.search = "";
  href.searchParams.set("q", String(project.repd_ref));
  href.searchParams.set("technology", String(project.technology || "all"));
  return href.href;
}
function projectMapLink(project) {
  try {
    if (project.technology === "interconnector") {
      const link = buildAtlasInterconnectorLinkV9_8(project);
      return link ? new URL(link, window.location.href).href : "";
    }
    const href = atlasUrlV9_5_1(project);
    if (!href) return "";
    const url = new URL(href);
    if (url.origin !== "https://ventusltd.github.io" ||
        url.pathname !== "/gridatlas/atlas/" ||
        url.searchParams.get("repd_ref") !== String(project.repd_ref)) return "";
    return url.href;
  } catch {
    return "";
  }
}
function statusDetails(group, destination) {
  const heading = el("h4", "repd-report-subtitle", "All source-reported statuses");
  destination.append(heading);
  const statuses = [...group.statuses].sort((a, b) =>
    b[1].recordedCapacity - a[1].recordedCapacity || a[0].localeCompare(b[0], "en-GB"));
  const list = el("div", "repd-report-statuses");
  for (const [status, stats] of statuses) {
    const item = el("div", "repd-report-status-item");
    item.append(el("span", "", status));
    item.append(el("span", "", formatCount(stats.count) + " projects"));
    item.append(el("span", "", capacityDescription(stats)));
    list.append(item);
  }
  destination.append(list);
}
function projectRow(project) {
  const row = el("div", "repd-report-project");
  const link = el("a", "", String(project.name || "Unnamed REPD project"));
  link.href = projectTableLink(project);
  link.title = "Open this REPD record in the existing PipelineNews table, with MAP and A4";
  row.append(link);
  row.append(el("span", "", project.technology === "interconnector" ? "INTERCONNECTOR " + (project.bmrs_code || project.gg_project_id || "") : "REPD " + project.repd_ref));
  row.append(el("span", "", String(project.status || "Not reported")));
  row.append(el("span", "", (typeof project.capacity_mw === "number" && Number.isFinite(project.capacity_mw) ? formatCapacity(project.capacity_mw) : "Not reported") +
    (project.technology === "solar" ? " MWp" : " MW")));
  const mapHref = projectMapLink(project);
  if (mapHref) {
    const map = el("a", "repd-report-map", "MAP");
    map.href = mapHref;
    map.target = "_blank";
    map.rel = "noopener noreferrer";
    map.title = "Open canonical GridAtlas with the selected REPD project";
    row.append(map);
  } else {
    row.append(el("span", "repd-report-no-map", "NO MAP"));
  }
  return row;
}
function projectDetails(group, destination) {
  destination.append(el("h4", "repd-report-subtitle", "Projects · full REPD membership"));
  const projects = [...group.projects].sort((a, b) =>
    (Number(b.capacity_mw) || 0) - (Number(a.capacity_mw) || 0));
  const list = el("div", "repd-report-project-list");
  destination.append(list);
  let shown = 0;
  const more = el("button", "repd-report-more", "");
  more.type = "button";
  const add = () => {
    const fragment = document.createDocumentFragment();
    for (const project of projects.slice(shown, shown + 100)) fragment.append(projectRow(project));
    list.append(fragment);
    shown = Math.min(projects.length, shown + 100);
    more.textContent = "SHOW NEXT 100 · " + formatCount(shown) + " / " + formatCount(projects.length);
    more.hidden = shown >= projects.length;
  };
  more.addEventListener("click", add);
  add();
  destination.append(more);
}
function makeGroup(group, maximum, index) {
  const details = el("details", "repd-report-group");
  const heading = el("summary", "repd-report-row");
  heading.append(el("span", "repd-report-name", (active === "operator" ? "#" + String(index + 1) + "  " : "") + group.name));
  heading.append(el("span", "", formatCapacity(group.recordedCapacity)));
  heading.append(el("span", "", formatCapacity(group.solarMwp)));
  heading.append(el("span", "", formatCapacity(group.otherMw)));
  heading.append(el("span", "", formatCount(group.count)));
  const track = el("span", "repd-report-track");
  const bar = el("span", "repd-report-bar");
  bar.style.width = (maximum > 0 ? Math.max(0, group.recordedCapacity / maximum * 100) : 0) + "%";
  track.append(bar);
  heading.append(track);
  details.append(heading);
  const content = el("div", "repd-report-group-details");
  details.append(content);
  details.addEventListener("toggle", () => {
    if (!details.open || content.dataset.loaded) return;
    content.dataset.loaded = "true";
    statusDetails(group, content);
    projectDetails(group, content);
  });
  return details;
}
function sourceRows() {
  if (!Array.isArray(state.all) || !state.all.length) return null;
  const filters = chosenFilter();
  const usesTable = reportScope.value === "filtered";
  const inRepd = filters.technology !== "interconnector";
  const selectedRows = usesTable && inRepd ? state.filtered : state.all;
  if (!Array.isArray(selectedRows)) return null;
  const interconnectors = usesTable && !inRepd ? state.filtered : state.interconnectors;
  const snapshot = buildCockpitReport(selectedRows, {
    dimension:active, filters, interconnectors
  });
  lastSnapshot = snapshot;
  lastSelection = filters;
  if (snapshot.availability === SOURCE_UNAVAILABLE) {
    throw new Error(snapshot.message);
  }
  // Preserve all original status names, even if the REPD table has only four
  // fast status buttons. The report's STATUS facet exposes the complete source.
  refreshChoices(snapshot);
  return snapshot.rows;
}
function render() {
  if (!active || panel.hidden) return;
  reportBody.replaceChildren();
  try {
    const rows = sourceRows();
    if (!rows) {
      lastReport = null;
      reportSummary.textContent = "Loading the canonical REPD records…";
      return;
    }
    const report = lastSnapshot?.source === "interconnector"
      ? buildInterconnectorCapacityReport(rows, active)
      : buildRepdCapacityReport(rows, active);
    lastReport = report;
    const scope = lastSnapshot?.source === "interconnector"
      ? "Separate interconnector inventory · not REPD" : reportScope.value === "filtered"
      ? "Current REPD table filters + cockpit" : "Cockpit-filtered official REPD register";
    const techLabel = lastSelection?.technology === "all" ? "ALL REPD TECHNOLOGIES" : String(lastSelection?.technology || "all").replaceAll("_"," ").toUpperCase();
    const statusLabel = lastSelection?.status === "All" ? "ALL OFFICIAL STATUSES" : String(lastSelection?.status);
    reportSummary.textContent = titles[active] + " · " + techLabel + " · " + statusLabel + " · " + scope +
      " · SOURCE " + formatCount(lastSnapshot?.sourceProjects || 0) + " · SELECTED " + formatCount(lastSnapshot?.matchingProjects || 0) + " · " +
      formatCount(report.total.count) + " projects · " +
      formatCount(report.groups.length) + " groups · " +
      capacityDescription(report.total) +
      (report.total.missingCapacity ? " · " + report.total.missingCapacity + " without a reported capacity" : "");
    const heading = el("div", "repd-report-row repd-report-columns");
    for (const name of ["Group", "Recorded MW/MWp", "Solar MWp", "Other MW", "Projects"]) {
      heading.append(el("span", "", name));
    }
    heading.append(el("span", "", ""));
    reportBody.append(heading);
    const maximum = report.groups.length ? report.groups[0].recordedCapacity : 0;
    const fragment = document.createDocumentFragment();
    for (const [index, group] of report.groups.entries()) fragment.append(makeGroup(group, maximum, index));
    reportBody.append(fragment);
    if (!report.groups.length) reportBody.append(el("p", "", "No projects match the chosen technology, status, operator and region."));
  } catch (error) {
    lastReport = null;
    lastSnapshot = null;
    reportSummary.textContent = "Report validation failed: " + String(error?.message || error);
  }
}
function selectReport(dimension) {
  if (active === dimension && !panel.hidden) {
    panel.hidden = true;
    active = "";
  } else {
    active = dimension;
    panel.hidden = false;
  }
  for (const button of reportButtons) {
    const pressed = button.dataset.repdReport === active;
    button.setAttribute("aria-pressed", String(pressed));
    button.setAttribute("aria-expanded", String(pressed));
  }
  if (active) render();
}
function downloadCsv() {
  if (!lastReport) return;
  const quote = value => { const text = String(value ?? ""); const safe = /^[=+@\-\t\r\n]/.test(text) ? "'" + text : text; return '"' + safe.replaceAll('"', '""') + '"'; };
  const rows = [["dimension", "technology selection", "status selection", "operator filter", "region filter", "group", "projects", "recorded MW/MWp", "solar MWp", "other MW", "missing capacity"]];
  for (const group of lastReport.groups) {
    rows.push([active, lastSelection?.technology, lastSelection?.status, lastSelection?.operator, lastSelection?.region,
      group.name, group.count, group.recordedCapacity, group.solarMwp, group.otherMw, group.missingCapacity]);
  }
  const blob = new Blob([rows.map(row => row.map(quote).join(",")).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = el("a");
  a.href = url;
  a.download = "repd-" + active + "-capacity.csv";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
if (panel && reportScope && reportSummary && reportBody) {
  for (const button of reportButtons) button.addEventListener("click", () => selectReport(button.dataset.repdReport));
  reportScope.addEventListener("change", render);
  closeButton?.addEventListener("click", () => {
    panel.hidden = true;
    active = "";
    for (const button of reportButtons) {
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-expanded", "false");
    }
  });
  csvButton?.addEventListener("click", downloadCsv);
  window.addEventListener("pipeline-category-changed", () => { if (active) render(); });
  window.addEventListener("pipeline-projects-rendered", () => {
    if (active) render();
  });
}
