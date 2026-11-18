import { COLORS, state } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { signalForProject } from "./newspaper.js";

export function drawProjectTable(projects) {
  const tableBody = document.getElementById("tbody");
  tableBody.innerHTML = "";
  projects.forEach((project) => {
    const row = document.createElement("tr");
    const query = encodeURIComponent(`${project.name} ${project.cat}`);
    const mobileSubline = [project.county, project.op].filter(Boolean).join(" | ");
    const foreground = project.cat === "Offshore Wind" ? "#fff" : "#000";
    const signal = signalForProject(project.name);
    row.innerHTML = `<td class="site">${escapeHtml(project.name)}${mobileSubline ? `<div class="mobile-extra">${escapeHtml(mobileSubline)}</div>` : ""}</td><td class="hide-mobile">${escapeHtml(project.county || "-")}</td><td class="hide-mobile">${escapeHtml(project.op || "-")}</td><td><span class="badge" style="background:${COLORS[project.cat] || "#888"};color:${foreground}">${escapeHtml(project.cat)}</span></td><td>${escapeHtml(project.status)}</td><td class="mw">${project.mw.toFixed(1)}</td><td><span class="signal ${signal.cls}">${escapeHtml(signal.label)}</span><div class="signal-note">${escapeHtml(signal.note)} · not REPD-confirmed</div></td><td><a class="newslink" target="_blank" rel="noopener" href="https://www.google.com/search?q=${query}&tbm=nws">📰</a></td>`;
    tableBody.appendChild(row);
  });
}

export function refreshProjectTable() {
  drawProjectTable(state.filtered);
}
