import { DATA_SOURCES, state } from "../core/state.js";
import { titleCase } from "../core/utils.js";
import { bindProjectExport } from "./project-export.js";
import { applyProjectFilters, bindProjectFilters } from "./project-filters.js";

function category(properties) {
  const rawTechnology = String(properties.raw_tech || "").toLowerCase();
  if (properties.tech === "solar" || properties.tech === "solar_roof") return "Solar";
  if (properties.tech === "bess") return "Battery Storage";
  if (properties.tech === "wind") return rawTechnology.includes("offshore") ? "Offshore Wind" : "Onshore Wind";
  return "Other";
}

function normaliseProject(feature) {
  const properties = feature.properties || {};
  const mw = parseFloat(properties.capacity) || 0;
  if (mw < 1) return null;
  const projectCategory = category(properties);
  if (projectCategory === "Other") return null;

  let county = titleCase(String(
    properties.county
    || properties.County
    || properties.lpa
    || properties.local_planning_authority
    || properties.region
    || "",
  ).trim());
  if (["nan", "none"].includes(county.toLowerCase())) county = "";

  let operator = String(properties.operator || properties.Operator || "").trim().toUpperCase();
  if (["NAN", "NONE"].includes(operator)) operator = "";

  return {
    name: properties.name || "Unknown Site",
    county,
    op: operator,
    cat: projectCategory,
    status: titleCase(properties.status || "Unknown"),
    mw,
  };
}

export async function loadProjects() {
  try {
    const response = await fetch(`${DATA_SOURCES.repd}?v=${Date.now()}`);
    if (!response.ok) throw new Error(`REPD ${response.status}`);
    const geojson = await response.json();
    const counties = new Set();
    state.all = (geojson.features || []).map(normaliseProject).filter(Boolean);
    state.all.forEach((project) => {
      if (project.county) counties.add(project.county);
    });
    state.all.sort((left, right) => right.mw - left.mw);
    [...counties].sort().forEach((county) => {
      const option = document.createElement("option");
      option.value = county;
      option.textContent = `📍 ${county}`;
      document.getElementById("county").appendChild(option);
    });
    applyProjectFilters();
  } catch (error) {
    console.error(error);
    document.getElementById("tbody").innerHTML = '<tr><td colspan="8" style="text-align:center;color:#ff6666">Error loading REPD data.</td></tr>';
  }
}

export function bindProjectControls() {
  bindProjectFilters();
  bindProjectExport();
}
