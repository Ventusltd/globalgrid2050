import { state } from "../core/state.js";
import { signalForProject } from "./newspaper.js";

function exportCsv(event) {
  event.preventDefault();
  const rows = state.filtered.length ? state.filtered : state.all;
  const output = ["Site Name,County,Operator,Technology,REPD Status,Capacity MW,News Signal,News Signal Note"];
  rows.forEach((project) => {
    const signal = signalForProject(project.name);
    output.push([
      project.name,
      project.county,
      project.op,
      project.cat,
      project.status,
      project.mw,
      signal.label,
      `${signal.note}; not REPD-confirmed`,
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
  });
  const url = URL.createObjectURL(new Blob([`\ufeff${output.join("\n")}`], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `globalgrid2050_uk_renewables_pipeline_v7_1_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function bindProjectExport() {
  document.getElementById("export").onclick = exportCsv;
}
