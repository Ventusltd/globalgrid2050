import { escapeHtml } from "../core/utils.js";
import { loadCanonicalProjectsV9_1 } from "../data/canonical-projects-v9-1.js";
import { setGaugeUniverseV9_1, updateGaugesV9_1 } from "./gauges-v9-1.js";
import { signalForProject } from "./newspaper.js";

const LABELS = Object.freeze({ solar: "Solar", bess: "Battery Storage", wind_onshore: "Onshore Wind", wind_offshore: "Offshore Wind" });
const COLOURS = Object.freeze({ solar: "#ffff00", bess: "#ffae00", wind_onshore: "#00ffff", wind_offshore: "#0066ff" });
const UNITS = Object.freeze({ solar: "MWp", bess: "MW", wind_onshore: "MW", wind_offshore: "MW" });
let all = [];
let filtered = [];
let metadata = null;
let technology = "all";
let status = "All";
let county = "All";
let query = "";
let controlsBound = false;

function atlasUrl(project) {
  const url = new URL("https://globalgrid2050.com/repd_grid_atlasv8/");
  url.searchParams.set("repd_ref", project.repd_ref);
  url.searchParams.set("project", project.name);
  url.searchParams.set("technology", project.technology);
  url.searchParams.set("capacity_mw", project.capacity_mw);
  if (project.geometry_status === "valid") {
    url.searchParams.set("latitude", project.latitude);
    url.searchParams.set("longitude", project.longitude);
    url.searchParams.set("zoom", "12");
  }
  return url.href;
}

function displayDate(value) {
  if (!value) return "not supplied by REPD";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function renderTable() {
  const body = document.getElementById("tbody");
  body.innerHTML = filtered.map((project) => {
    const label = LABELS[project.technology];
    const unit = UNITS[project.technology];
    const location = [project.county, project.region].filter(Boolean).join(" · ");
    const signal = signalForProject(project.name);
    const news = new URL("https://www.google.com/search");
    news.searchParams.set("q", `${project.name} ${label} UK`);
    news.searchParams.set("tbm", "nws");
    return `<tr><td class="site">${escapeHtml(project.name)}<div class="mobile-extra">${escapeHtml([location, project.operator, project.repd_ref].filter(Boolean).join(" | "))}</div></td><td class="hide-mobile">${escapeHtml(location || "-")}</td><td class="hide-mobile">${escapeHtml(project.operator || "-")}</td><td><span class="badge" style="background:${COLOURS[project.technology]}">${escapeHtml(label)}</span></td><td>${escapeHtml(project.status)}</td><td class="mw">${project.capacity_mw.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${unit}</td><td class="identity">${escapeHtml(project.repd_ref)}</td><td class="identity">${escapeHtml(project.gg_project_id)}</td><td>${escapeHtml(project.planning_application_reference || "-")}</td><td class="updated">${escapeHtml(displayDate(project.repd_record_updated))}</td><td><a class="atlaslink" target="_blank" rel="noopener" href="${escapeHtml(atlasUrl(project))}">MAP ↗</a></td><td><span class="signal">${escapeHtml(signal.label)}</span><div class="signal-note">legacy/unverified · ${escapeHtml(signal.note)}</div></td><td><a class="newslink" target="_blank" rel="noopener" href="${escapeHtml(news.href)}">📰</a></td></tr>`;
  }).join("");
}

function apply() {
  filtered = all.filter((project) => {
    const haystack = [project.name, project.operator, project.repd_ref, project.gg_project_id, project.gg_development_id, project.planning_application_reference, project.planning_authority, project.county, project.region].join(" ").toLocaleLowerCase("en-GB");
    return (technology === "all" || project.technology === technology)
      && (status === "All" || project.status.includes(status))
      && (county === "All" || project.county === county)
      && (!query || haystack.includes(query));
  });
  updateGaugesV9_1(filtered);
  renderTable();
}

function populateCounties() {
  const select = document.getElementById("county");
  [...new Set(all.map((project) => project.county).filter(Boolean))].sort((left, right) => left.localeCompare(right, "en-GB")).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `📍 ${value}`;
    select.appendChild(option);
  });
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
    const signal = signalForProject(project.name);
    return [project.name, project.repd_ref, project.gg_project_id, project.gg_development_id, project.identity_status, project.identity_confidence, LABELS[project.technology], project.repd_technology, project.capacity_mw, UNITS[project.technology], project.status, project.lifecycle, project.operator, project.county, project.region, project.country, project.planning_authority, project.planning_application_reference, project.repd_record_updated, project.planning_application_submitted, project.planning_application_withdrawn, project.planning_permission_granted, project.planning_permission_refused, project.planning_permission_expired, project.under_construction, project.operational, project.repd_old_ref, project.direct_related_repd_refs.join("|"), project.planning_sibling_repd_refs.join("|"), project.development_repd_refs.join("|"), JSON.stringify(project.relationships), project.geometry_status, project.easting, project.northing, "EPSG:27700", project.longitude, project.latitude, atlasUrl(project), "RFC 7946 WGS84", project.coordinate_source, "market map context only; never evidence of a grid connection or cadastral boundary", metadata.source_dataset, project.source_row, metadata.projects_sha256, metadata.source_identity_sha256, metadata.source_coordinate_fixture_sha256, metadata.source_workbook_sha256, "14657/14657 canonical REPD Ref IDs", signal.label, signal.note];
  });
  const content = `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `globalgrid2050_uk_renewables_pipeline_v9_1_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  document.getElementById("exportMeta").textContent = `${filtered.length.toLocaleString("en-GB")} filtered records exported`;
}

export async function loadProjectsV9_1() {
  try {
    const model = await loadCanonicalProjectsV9_1();
    all = [...model.projects];
    filtered = all;
    metadata = model.metadata;
    setGaugeUniverseV9_1(all);
    populateCounties();
    apply();
  } catch (error) {
    console.error(error);
    document.getElementById("tbody").innerHTML = '<tr><td colspan="13" style="text-align:center;color:#ff6666">Canonical Q2 REPD data unavailable. V9.1 has failed closed.</td></tr>';
  }
}

export function refreshProjectsV9_1() {
  if (metadata) renderTable();
}

export function bindProjectControlsV9_1() {
  if (controlsBound) return;
  controlsBound = true;
  document.querySelectorAll("#tech .btn").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#tech .btn").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      technology = button.dataset.technology;
      apply();
    };
  });
  document.querySelectorAll("#status .btn").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#status .btn").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      status = button.dataset.officialStatus;
      apply();
    };
  });
  document.getElementById("county").onchange = (event) => { county = event.target.value; apply(); };
  document.getElementById("search").oninput = (event) => { query = event.target.value.trim().toLocaleLowerCase("en-GB"); apply(); };
  document.getElementById("export").onclick = downloadCsv;
  document.getElementById("exportInline").onclick = downloadCsv;
}
