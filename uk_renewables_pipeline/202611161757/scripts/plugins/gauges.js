import { state } from "../core/state.js";

function createGauge(canvasId, colour, options) {
  const config = {
    type: "doughnut",
    data: { datasets: [{ data: [0, 1], backgroundColor: [colour, "#222"], borderWidth: 0 }] },
    options,
  };
  if (typeof globalThis.Chart !== "function") {
    document.getElementById(canvasId).hidden = true;
    return { data: config.data, update() {} };
  }
  return new globalThis.Chart(document.getElementById(canvasId), config);
}

export function initialiseGauges() {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    circumference: 180,
    rotation: 270,
    cutout: "80%",
    plugins: { tooltip: { enabled: false }, legend: { display: false } },
  };

  state.charts.solar = createGauge("g1", "#ffff00", options);
  state.charts.bess = createGauge("g2", "#ffae00", options);
  state.charts.projects = createGauge("g3", "#00ffff", options);
  state.charts.largest = createGauge("g4", "#00ff88", options);
}

function totalFor(projects, technology) {
  return projects
    .filter((project) => project.technology === technology)
    .reduce((sum, project) => sum + project.capacity_mw, 0);
}

function updateChart(chart, value, maximum) {
  chart.data.datasets[0].data = [value, Math.max(maximum - value, 0)];
  chart.update();
}

export function updateGauges(projects) {
  const solarMwp = totalFor(projects, "solar");
  const bessMw = totalFor(projects, "bess");
  const projectCount = projects.length;
  const largestMw = projects.length ? Math.max(...projects.map((project) => project.capacity_mw)) : 0;
  const allSolarMwp = totalFor(state.all, "solar") || 1;
  const allBessMw = totalFor(state.all, "bess") || 1;
  const allProjectCount = state.all.length || 1;
  const allLargestMw = state.all.length ? Math.max(...state.all.map((project) => project.capacity_mw)) : 1;
  const capacityFormat = { maximumFractionDigits: 2 };

  document.getElementById("v1").textContent = solarMwp.toLocaleString("en-GB", capacityFormat);
  document.getElementById("v2").textContent = bessMw.toLocaleString("en-GB", capacityFormat);
  document.getElementById("v3").textContent = projectCount.toLocaleString("en-GB");
  document.getElementById("v4").textContent = largestMw.toLocaleString("en-GB", capacityFormat);

  updateChart(state.charts.solar, solarMwp, allSolarMwp);
  updateChart(state.charts.bess, bessMw, allBessMw);
  updateChart(state.charts.projects, projectCount, allProjectCount);
  updateChart(state.charts.largest, largestMw, allLargestMw);
}
