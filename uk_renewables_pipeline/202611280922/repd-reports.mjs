// PipelineNews V9.75: reports use the existing filtered REPD table and gauges.
import { state } from "./scripts/core/state.js";
import { atlasUrlV9_5_1 } from "./scripts/plugins/projects-v9-8.js";
import { buildRepdCapacityReport } from "./repd-reports-model.mjs";
import { buildAtlasInterconnectorLinkV9_8 } from "./scripts/core/atlas-interconnector-link-v9-8.js";

const panel = document.getElementById("repdReportsPanel");
const reportButtons = [...document.querySelectorAll("[data-repd-report]")];
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
function nativeTechnology() {
  return document.querySelector('#tech [data-technology][aria-pressed="true"]')?.dataset.technology||"all";
}
function chosenFilter() {
  return {technology:nativeTechnology(),
    status:document.getElementById("repdNativeStatus")?.value||"All",
    operator:document.getElementById("repdNativeOperator")?.value||"All",
    region:document.getElementById("repdNativeRegion")?.value||"All"};
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
  if(!Array.isArray(state.all)||!state.all.length)return null;
  lastSelection=chosenFilter();
  const ic=lastSelection.technology==="interconnector";
  const rows=state.filtered||[];
  lastSnapshot={source:ic?"interconnector":"repd",
    sourceProjects:ic?(state.interconnectors||[]).length:state.all.length,
    matchingProjects:rows.length};
  return rows;
}
function renderNativeSummary(report) {
  const wrap=el("div","tablewrap"), table=el("table","repd-native-report-table");
  wrap.setAttribute("aria-label","Ranked grouping of the original REPD table filters");
  const head=el("thead"),heading=el("tr");
  for(const name of ["Group","Projects","Solar MWp","Other MW","Recorded MW/MWp"])
    heading.append(el("th","",name));
  head.append(heading);
  const body=el("tbody");
  for(const group of report.groups) {
    const row=el("tr"),name=el("td","site"),action=el("button","btn",group.name);
    action.type="button";
    action.title="Apply this exact group to the original REPD table and gauges";
    action.addEventListener("click",()=>{
      const id=active==="operator"?"repdNativeOperator":active==="status"?"repdNativeStatus":"repdNativeRegion";
      const select=document.getElementById(id);
      if(!select||![...select.options].some(o=>o.value===group.name)) {
        reportSummary.textContent="No matching source filter for "+group.name;return;
      }
      select.value=group.name;
      select.dispatchEvent(new Event("change",{bubbles:true}));
      document.getElementById("repdScroll")?.scrollIntoView({block:"nearest"});
    });
    name.append(action);row.append(name);
    for(const [value,css] of [[group.count,""],[group.solarMwp,"mw"],[group.otherMw,"mw"],[group.recordedCapacity,"mw"]])
      row.append(el("td",css,css?formatCapacity(value):formatCount(value)));
    body.append(row);
  }
  table.append(head,body);wrap.append(table);reportBody.append(wrap);
}
function render() {
  if(!active||panel.hidden)return;
  reportBody.replaceChildren();
  try {
    const rows=sourceRows();
    if(!rows){lastReport=null;reportSummary.textContent="Loading original REPD register…";return;}
    const ic=lastSnapshot.source==="interconnector";
    const report=ic?buildInterconnectorCapacityReport(rows,active):buildRepdCapacityReport(rows,active);
    lastReport=report;
    const selection=lastSelection;
    const tech=selection.technology==="all"?"ALL REPD TECHNOLOGIES":selection.technology.replaceAll("_"," ").toUpperCase();
    reportSummary.textContent=titles[active]+" · "+tech+" · "+selection.status+
      " · CURRENT REPD TABLE FILTERS · SOURCE "+formatCount(lastSnapshot.sourceProjects)+
      " · SELECTED "+formatCount(rows.length)+" · "+formatCount(report.groups.length)+
      " groups · "+capacityDescription(report.total)+
      (ic?" · Separate interconnector inventory, not REPD":" · Select a group to filter the original table and gauges");
    if(ic) {
      const heading=el("div","repd-report-row repd-report-columns");
      for(const name of ["Group","Recorded MW","Solar MWp","Other MW","Projects"])heading.append(el("span","",name));
      heading.append(el("span","",""));
      reportBody.append(heading);
      const maximum=report.groups.length?report.groups[0].recordedCapacity:0;
      for(const [index,group] of report.groups.entries())reportBody.append(makeGroup(group,maximum,index));
    } else renderNativeSummary(report);
    if(!report.groups.length)reportBody.append(el("p","","No matching projects in the original REPD table."));
  } catch(error){
    lastReport=null;lastSnapshot=null;
    reportSummary.textContent="Report validation failed: "+String(error?.message||error);
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
if (panel && reportSummary && reportBody) {
  for (const button of reportButtons) button.addEventListener("click", () => selectReport(button.dataset.repdReport));
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
