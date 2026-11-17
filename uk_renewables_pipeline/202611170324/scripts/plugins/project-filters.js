import { state } from "../core/state.js";
import { updateGauges } from "./gauges.js";
import { drawProjectTable } from "./project-table.js";

export function applyProjectFilters() {
  state.filtered = state.all.filter((project) => (
    (state.tech === "All" || project.cat === state.tech)
    && (state.status === "All" || project.status.includes(state.status))
    && (state.county === "All" || project.county === state.county)
    && (!state.search || project.op.includes(state.search) || project.name.toUpperCase().includes(state.search))
  ));
  updateGauges(state.filtered);
  drawProjectTable(state.filtered);
}

export function bindProjectFilters() {
  document.querySelectorAll("#tech .btn").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#tech .btn").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      state.tech = button.dataset.tech;
      applyProjectFilters();
    };
  });
  document.querySelectorAll("#status .btn").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#status .btn").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      state.status = button.dataset.status;
      applyProjectFilters();
    };
  });
  document.getElementById("county").onchange = (event) => {
    state.county = event.target.value;
    applyProjectFilters();
  };
  document.getElementById("search").oninput = (event) => {
    state.search = event.target.value.trim().toUpperCase();
    applyProjectFilters();
  };
}
