// PipelineNews V9.73: additive Operator / Status / Region REPD report panels.
import { state } from "./scripts/core/state.js";
import { atlasUrlV9_5_1 } from "./scripts/plugins/projects-v9-8.js";
import { buildRepdCapacityReport } from "./repd-reports-model.mjs";

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

function el(tag, className, value) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (value !== undefined) result.textContent = String(value);
  return result;
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
  return href.href;
}
function projectMapLink(project) {
  try {
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
  row.append(el("span", "", "REPD " + project.repd_ref));
  row.append(el("span", "", String(project.status || "Not reported")));
  row.append(el("span", "", formatCapacity(project.capacity_mw) +
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
function makeGroup(group, maximum) {
  const details = el("details", "repd-report-group");
  const heading = el("summary", "repd-report-row");
  heading.append(el("span", "repd-report-name", group.name));
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
  const selection = reportScope.value === "filtered" ? state.filtered : state.all;
  return Array.isArray(selection) ? selection : [];
}
function render() {
  if (!active || panel.hidden) return;
  const rows = sourceRows();
  reportBody.replaceChildren();
  if (!rows) {
    lastReport = null;
    reportSummary.textContent = "Loading the canonical REPD records…";
    return;
  }
  try {
    const report = buildRepdCapacityReport(rows, active);
    lastReport = report;
    const scope = reportScope.value === "filtered" ? "Current REPD table filters" : "Full official REPD register · all statuses";
    reportSummary.textContent = titles[active] + " · " + scope + " · " +
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
    for (const group of report.groups) fragment.append(makeGroup(group, maximum));
    reportBody.append(fragment);
    if (!report.groups.length) reportBody.append(el("p", "", "No REPD projects match the chosen scope."));
  } catch (error) {
    lastReport = null;
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
  const quote = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
  const rows = [["dimension", "group", "projects", "recorded MW/MWp", "solar MWp", "other MW", "missing capacity"]];
  for (const group of lastReport.groups) {
    rows.push([active, group.name, group.count, group.recordedCapacity, group.solarMwp, group.otherMw, group.missingCapacity]);
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
  window.addEventListener("pipeline-projects-rendered", () => {
    if (active && reportScope.value === "filtered") render();
    else if (active && !lastReport) render();
  });
}
