import { COLORS, state } from "../core/state.js";
import {
  beginCanonicalProjectLoad,
  canonicalProjectState,
  commitCanonicalProjectModel,
  failCanonicalProjectLoad,
} from "../core/project-state.js";
import { escapeHtml } from "../core/utils.js";
import { loadCanonicalProjectModel } from "../data/canonical-projects.js";
import { createCanonicalProjectControls } from "./canonical-project-controls.js";
import { buildCanonicalProjectCsv } from "./canonical-project-export.js";
import { buildCanonicalProjectTableView } from "./canonical-project-table.js";
import { updateGauges } from "./gauges.js";
import { signalForProject } from "./newspaper.js";

const controls = createCanonicalProjectControls(canonicalProjectState);
let controlsBound = false;

function legacySignal(project) {
  const signal = signalForProject(project.name);
  return { label: signal.label, note: signal.note };
}

function drawTable() {
  const table = buildCanonicalProjectTableView(canonicalProjectState, {
    legacySignalResolver: legacySignal,
  });
  const tableBody = document.getElementById("tbody");
  if (!table.available) {
    tableBody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#ff6666">Canonical REPD project data is unavailable.</td></tr>';
    return;
  }
  tableBody.innerHTML = table.rows.map((row) => {
    const project = row.primary;
    const mobileSubline = [project.location, project.operator, project.repdRef].filter(Boolean).join(" | ");
    const colour = COLORS[project.technology] || "#888";
    return `<tr><td class="site">${escapeHtml(project.project)}${mobileSubline ? `<div class="mobile-extra">${escapeHtml(mobileSubline)}</div>` : ""}</td><td class="hide-mobile">${escapeHtml(project.location || "-")}</td><td class="hide-mobile">${escapeHtml(project.operator || "-")}</td><td><span class="badge" style="background:${colour}">${escapeHtml(project.technology)}</span></td><td>${escapeHtml(project.officialStatus)}</td><td class="mw">${escapeHtml(project.capacity.display)}</td><td class="identity">${escapeHtml(project.repdRef)}</td><td class="identity">${escapeHtml(project.ggProjectId)}</td><td>${escapeHtml(project.planningReference)}</td><td><span class="signal">${escapeHtml(project.legacyNews.label)}</span><div class="signal-note">legacy/unverified · ${escapeHtml(project.legacyNews.note)}</div></td><td><a class="newslink" target="_blank" rel="noopener" href="${escapeHtml(project.news.url)}">📰</a></td></tr>`;
  }).join("");
}

function syncAndRender() {
  state.all = canonicalProjectState.all;
  state.filtered = canonicalProjectState.filtered;
  updateGauges(canonicalProjectState.filtered);
  drawTable();
}

function populateCounties() {
  const county = document.getElementById("county");
  const allCounties = county.options[0];
  county.replaceChildren(allCounties);
  canonicalProjectState.filterOptions.counties.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `📍 ${value}`;
    county.appendChild(option);
  });
}

function setButtonFilter(group, key, button) {
  document.querySelectorAll(`${group} .btn`).forEach((candidate) => candidate.classList.remove("active"));
  button.classList.add("active");
  controls.setFilter(key, button.dataset[key]);
  syncAndRender();
}

function downloadCanonicalCsv(event) {
  event.preventDefault();
  const csv = buildCanonicalProjectCsv(canonicalProjectState, {
    legacySignalResolver: legacySignal,
  });
  const url = URL.createObjectURL(new Blob([csv.content], { type: csv.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = csv.filename.replace("v7_2", "v8_1");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function loadProjects() {
  beginCanonicalProjectLoad(canonicalProjectState);
  try {
    const model = await loadCanonicalProjectModel();
    state.canonicalModel = model;
    commitCanonicalProjectModel(canonicalProjectState, model);
    canonicalProjectState.release = "8.1";
    canonicalProjectState.phase = "live-mvp";
    populateCounties();
    syncAndRender();
  } catch (error) {
    console.error(error);
    failCanonicalProjectLoad(canonicalProjectState, error);
    drawTable();
  }
}

export function refreshCanonicalProjects() {
  if (canonicalProjectState.status === "ready") syncAndRender();
}

export function bindProjectControls() {
  if (controlsBound) return;
  controlsBound = true;
  document.querySelectorAll("#tech .btn").forEach((button) => {
    button.onclick = () => setButtonFilter("#tech", "technology", button);
  });
  document.querySelectorAll("#status .btn").forEach((button) => {
    button.onclick = () => setButtonFilter("#status", "officialStatus", button);
  });
  document.getElementById("county").onchange = (event) => {
    controls.setFilter("county", event.target.value);
    syncAndRender();
  };
  document.getElementById("search").oninput = (event) => {
    controls.setFilter("query", event.target.value);
    syncAndRender();
  };
  document.getElementById("export").onclick = downloadCanonicalCsv;
}
