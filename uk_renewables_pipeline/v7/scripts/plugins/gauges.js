import { state } from "../core/state.js";

export function initialiseGauges() {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    circumference: 180,
    rotation: 270,
    cutout: "80%",
    plugins: { tooltip: { enabled: false }, legend: { display: false } },
  };

  state.charts.capacity = new Chart(document.getElementById("g1"), {
    type: "doughnut",
    data: { datasets: [{ data: [0, 1], backgroundColor: ["#ff00ff", "#222"], borderWidth: 0 }] },
    options,
  });
  state.charts.projects = new Chart(document.getElementById("g2"), {
    type: "doughnut",
    data: { datasets: [{ data: [0, 1], backgroundColor: ["#00ffff", "#222"], borderWidth: 0 }] },
    options,
  });
  state.charts.largest = new Chart(document.getElementById("g3"), {
    type: "doughnut",
    data: { datasets: [{ data: [0, 1], backgroundColor: ["#00ff88", "#222"], borderWidth: 0 }] },
    options,
  });
}

export function updateGauges(projects) {
  const total = projects.reduce((sum, project) => sum + project.mw, 0);
  const count = projects.length;
  const largest = count ? Math.max(...projects.map((project) => project.mw)) : 0;
  const globalTotal = state.all.reduce((sum, project) => sum + project.mw, 0) || 1;
  const globalLargest = state.all.length ? Math.max(...state.all.map((project) => project.mw)) : 1;

  document.getElementById("v1").textContent = total.toLocaleString(undefined, { maximumFractionDigits: 0 });
  document.getElementById("v2").textContent = count.toLocaleString();
  document.getElementById("v3").textContent = largest.toLocaleString(undefined, { maximumFractionDigits: 1 });

  const { capacity, projects: projectGauge, largest: largestGauge } = state.charts;
  capacity.data.datasets[0].data = [total, Math.max(globalTotal - total, 0)];
  projectGauge.data.datasets[0].data = [count, Math.max(state.all.length - count, 0)];
  largestGauge.data.datasets[0].data = [largest, Math.max(globalLargest - largest, 0)];
  capacity.update();
  projectGauge.update();
  largestGauge.update();
}
