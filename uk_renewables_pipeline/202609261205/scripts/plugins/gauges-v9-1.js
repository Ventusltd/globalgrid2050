const charts = { capacity: null, projects: null, largest: null };
let universe = [];

function createGauge(canvasId, colour, options) {
  const config = { type: "doughnut", data: { datasets: [{ data: [0, 1], backgroundColor: [colour, "#222"], borderWidth: 0 }] }, options };
  if (typeof globalThis.Chart !== "function") return { data: config.data, update() {} };
  return new globalThis.Chart(document.getElementById(canvasId), config);
}

function updateChart(chart, value, maximum) {
  chart.data.datasets[0].data = [value, Math.max(maximum - value, 0)];
  chart.update();
}

export function initialiseGaugesV9_1() {
  const options = { responsive: true, maintainAspectRatio: false, circumference: 180, rotation: 270, cutout: "80%", plugins: { tooltip: { enabled: false }, legend: { display: false } } };
  charts.capacity = createGauge("g1", "#ff00ff", options);
  charts.projects = createGauge("g2", "#00ffff", options);
  charts.largest = createGauge("g3", "#00ff88", options);
}

export function setGaugeUniverseV9_1(projects) {
  universe = projects;
}

export function updateGaugesV9_1(projects) {
  const total = projects.reduce((sum, project) => sum + project.capacity_mw, 0);
  const largest = projects.length ? Math.max(...projects.map((project) => project.capacity_mw)) : 0;
  const universeTotal = universe.reduce((sum, project) => sum + project.capacity_mw, 0) || 1;
  const universeLargest = universe.length ? Math.max(...universe.map((project) => project.capacity_mw)) : 1;
  document.getElementById("v1").textContent = total.toLocaleString("en-GB", { maximumFractionDigits: 0 });
  document.getElementById("v2").textContent = projects.length.toLocaleString("en-GB");
  document.getElementById("v3").textContent = largest.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  updateChart(charts.capacity, total, universeTotal);
  updateChart(charts.projects, projects.length, universe.length || 1);
  updateChart(charts.largest, largest, universeLargest);
}
