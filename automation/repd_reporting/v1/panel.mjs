import { snapshotReport, operationalReport, estimatedGeneration, validateIdentity } from "./aggregate.mjs";

const REPORTS = Object.freeze([
  ["operator", "OPERATOR MW"],
  ["status", "STATUS MW"],
  ["region", "REGION MW"],
  ["operational", "OPERATIONAL BY YEAR"],
  ["energy", "ENERGY SCENARIO"],
]);
const PERIODS = Object.freeze([["month", "MONTH"], ["quarter", "QUARTER"], ["year", "YEAR"]]);
const fmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const el = (tag, className = "", label = "") => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== "") node.textContent = label;
  return node;
};
const toText = value => typeof value === "string" && value.trim() ? value.trim() : "Not supplied";
function groupUnitText(byUnit) {
  const parts = Object.entries(byUnit ?? {}).sort().map(([unit, value]) => fmt.format(value) + " " + unit);
  return parts.length ? parts.join(" / ") : "Not supplied";
}
function csvCell(value) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@\t\r\n]/.test(raw.trimStart()) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
}
function downloadReport(rows, columns, name) {
  const lines = [columns.map(c => csvCell(c[1])).join(",")];
  for (const row of rows) lines.push(columns.map(c => csvCell(row[c[0]])).join(","));
  const blob = new Blob(["\ufeff" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = el("a");
  a.href = href; a.download = name; a.hidden = true;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
function buttonBar(items, value, onPick, klass) {
  const bar = el("div", "repd-report-buttons " + klass);
  for (const [key, label] of items) {
    const b = el("button", "repd-report-btn", label);
    b.type = "button"; b.dataset.key = key;
    b.setAttribute("aria-pressed", String(key === value()));
    b.addEventListener("click", () => {
      onPick(key);
      for (const child of bar.children) child.setAttribute("aria-pressed", String(child.dataset.key === value()));
    });
    bar.append(b);
  }
  return bar;
}
function dropdown(label, values, read, write) {
  const wrap = el("label", "repd-report-select");
  wrap.append(el("span", "", label));
  const select = el("select");
  select.setAttribute("aria-label", label);
  for (const val of values) {
    const opt = el("option", "", val);
    opt.value = val; select.append(opt);
  }
  select.value = read();
  select.addEventListener("change", () => write(select.value));
  wrap.append(select);
  return wrap;
}
function unique(rows, getter) {
  return [...new Set(rows.map(getter).filter(x => x && x !== "Not supplied"))].sort((a, b) => a.localeCompare(b));
}

/**
 * Standalone UI mount, not an implicit PipelineNews installation.
 * The release owner must connect onSelectProjects to the existing native table
 * and verify actual MAP/A4 action preservation before publishing.
 */
export function mountRepdReports(host, projects, {
  asOf = new Date().toISOString().slice(0, 10),
  onSelectProjects = null,
  sourceLabel = "REPD official snapshot (verify release provenance)",
} = {}) {
  if (!(host instanceof HTMLElement)) throw new Error("Reporting host element required");
  validateIdentity(projects);
  const state = {
    report: "operator", period: "year", trend: false, metric: "capacity",
    dimension: "technology", technology: "All", status: "All",
    region: "All", operator: "All", year: String(new Date(asOf + "T00:00:00Z").getUTCFullYear()),
    factors: {}, seasonality: {}, assumptionsOpen: false,
  };
  const years = unique(projects, p => {
    const d = p.operational ?? p.operational_date;
    return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(0, 4) : null;
  }).filter(y => Number(y) <= Number(asOf.slice(0, 4)));
  if (!years.includes(state.year)) years.push(state.year);
  years.sort((a, b) => b.localeCompare(a));
  const technologies = unique(projects, p => toText(p.repd_technology ?? p.technology_label ?? p.technology));
  const regions = unique(projects, p => toText(p.region));
  const operators = unique(projects, p => toText(p.operator));
  const statuses = unique(projects, p => toText(p.status));
  host.replaceChildren();
  host.classList.add("repd-periodic-reports");
  const heading = el("div", "repd-report-heading");
  heading.append(el("strong", "", "REPD INTELLIGENCE"));
  heading.append(el("small", "", sourceLabel));
  host.append(heading);
  const tools = el("div", "repd-report-tools");
  const reportBar = buttonBar(REPORTS, () => state.report, key => { state.report = key; render(); }, "repd-report-primary");
  const periodBar = buttonBar(PERIODS, () => state.period, key => { state.period = key; render(); }, "repd-report-periods");
  tools.append(reportBar, periodBar);
  const secondary = el("div", "repd-report-secondary");
  const metricBar = buttonBar([["capacity", "CAPACITY"], ["projects", "PROJECTS"]], () => state.metric,
    key => { state.metric = key; render(); }, "repd-report-metrics");
  const trendButton = el("button", "repd-report-btn", "OPERATIONAL TREND");
  trendButton.type = "button";
  trendButton.addEventListener("click", () => {
    state.trend = !state.trend;
    trendButton.setAttribute("aria-pressed", String(state.trend));
    render();
  });
  trendButton.setAttribute("aria-pressed", "false");
  const dimensionBar = buttonBar([["technology", "TECH"], ["operator", "OPERATOR"], ["region", "REGION"]],
    () => state.dimension, key => { state.dimension = key; render(); }, "repd-report-dimensions");
  secondary.append(metricBar, trendButton, dimensionBar);
  const filters = el("div", "repd-report-filters");
  filters.append(
    dropdown("TECHNOLOGY", ["All", ...technologies], () => state.technology, v => { state.technology = v; render(); }),
    dropdown("STATUS", ["All", ...statuses], () => state.status, v => { state.status = v; render(); }),
    dropdown("REGION", ["All", ...regions], () => state.region, v => { state.region = v; render(); }),
    dropdown("OPERATOR", ["All", ...operators], () => state.operator, v => { state.operator = v; render(); }),
    dropdown("YEAR", years, () => state.year, v => { state.year = v; render(); }),
  );
  tools.append(secondary, filters);
  host.append(tools);
  const note = el("p", "repd-report-note");
  const buttons = el("div", "repd-report-actions");
  const assumptions = el("div", "repd-report-assumptions");
  assumptions.hidden = true;
  const toggleAssumptions = el("button", "repd-report-btn", "ASSUMPTIONS");
  toggleAssumptions.type = "button";
  toggleAssumptions.addEventListener("click", () => {
    state.assumptionsOpen = !state.assumptionsOpen;
    assumptions.hidden = !state.assumptionsOpen;
    toggleAssumptions.setAttribute("aria-pressed", String(state.assumptionsOpen));
  });
  const exportButton = el("button", "repd-report-btn", "EXPORT CSV");
  exportButton.type = "button";
  buttons.append(toggleAssumptions, exportButton);
  const chart = el("div", "repd-report-chart");
  chart.setAttribute("aria-label", "Report bar chart");
  const scroller = el("div", "repd-report-scroll");
  scroller.tabIndex = 0;
  const summary = el("p", "repd-report-summary");
  host.append(note, buttons, assumptions, chart, scroller, summary);
  assumptions.append(el("p", "repd-report-note",
    "OPTIONAL ESTIMATION ONLY. Enter your own technology capacity factors (%). These are NOT metered production or independently verified energisation. Storage is excluded."));
  for (const tech of technologies.filter(x => !/battery|storage|bess|pumped hydro|flywheel/i.test(x))) {
    const label = el("label", "repd-report-factor");
    const span = el("span", "", tech + " CF (%)");
    const inp = el("input");
    inp.type = "number"; inp.min = "0"; inp.max = "100"; inp.step = "0.1";
    inp.placeholder = "Not assumed";
    inp.setAttribute("aria-label", tech + " capacity factor percentage");
    inp.addEventListener("change", () => {
      const n = inp.value.trim() ? Number(inp.value) : null;
      if (n === null) delete state.factors[tech];
      else if (Number.isFinite(n) && n >= 0 && n <= 100) state.factors[tech] = n / 100;
      else { inp.value = ""; delete state.factors[tech]; }
      render();
    });
    label.append(span, inp); assumptions.append(label);
  }
  let exportRows = [], exportCols = [];
  exportButton.addEventListener("click", () => {
    downloadReport(exportRows, exportCols,
      "repd_intelligence_" + state.report + "_" + state.period + "_" + asOf + ".csv");
  });
  function filtersNow() {
    return { technology: state.technology, status: state.status, region: state.region, operator: state.operator };
  }
  function render() {
    const isEnergy = state.report === "energy";
    const isOperational = state.report === "operational" || (state.trend && state.report !== "status" && !isEnergy);
    periodBar.hidden = !isOperational && !isEnergy;
    metricBar.hidden = isEnergy;
    trendButton.hidden = isEnergy || state.report === "operational" || state.report === "status";
    dimensionBar.hidden = state.report !== "operational";
    toggleAssumptions.hidden = !isEnergy;
    assumptions.hidden = !isEnergy || !state.assumptionsOpen;
    const yearSelect = filters.querySelectorAll("select")[4].closest("label");
    yearSelect.hidden = !isEnergy;
    const dimension = state.report === "operational" ? state.dimension : state.report;
    let data, visible;
    if (isEnergy) {
      data = estimatedGeneration(projects, {
        year: Number(state.year), period: state.period, asOf,
        factors: state.factors, seasonality: state.seasonality, filters: filtersNow(),
      });
      visible = data.rows.map(r => ({
        label: r.period, projects: r.contributingProjectMonths,
        capacity: "—", energy: r.mwh === null ? "Not available" : fmt.format(r.mwh) + " MWh",
        value: r.mwh, refs: [],
        caveat: r.availability === "SCENARIO_ONLY" ? "Scenario estimate" : r.availability,
      }));
      note.textContent = "ENERGY SCENARIO — MWh, NOT METERED. User-defined capacity factors; BESS excluded. Missing assumptions and future periods show Not available.";
    } else {
      data = isOperational
        ? operationalReport(projects, { dimension, period: state.period, filters: filtersNow(), asOf })
        : snapshotReport(projects, { dimension, filters: filtersNow() });
      visible = data.rows.map(r => {
        const capacities = Object.entries(r.capacityByUnit);
        const metric = state.metric === "projects" ? r.projects : capacities.length === 1 ? capacities[0][1] : null;
        return {
          label: r.period === "SNAPSHOT" ? r.group : r.period + " · " + r.group,
          projects: r.projects, capacity: groupUnitText(r.capacityByUnit),
          energy: "—", value: metric, refs: r.repdRefs,
          caveat: r.missingCapacity ? String(r.missingCapacity) + " missing MW" : "",
        };
      });
      note.textContent = isOperational
        ? "REPD-REPORTED OPERATIONAL MILESTONES — not independently verified energisation. Dates missing or conflicting with the snapshot are separated."
        : "OFFICIAL REPD STATUS AND CAPACITY SNAPSHOT — preserves technology-specific MW and MWp units and all application statuses.";
    }
    chart.replaceChildren();
    scroller.replaceChildren();
    const table = el("table", "repd-report-table");
    const thead = el("thead"); const top = el("tr");
    for (const header of ["PERIOD / GROUP", "PROJECTS", "CAPACITY", "ENERGY", "NOTES"]) {
      const th = el("th", "", header); th.scope = "col"; top.append(th);
    }
    thead.append(top); table.append(thead);
    const tbody = el("tbody");
    const max = Math.max(0, ...visible.map(r => Number.isFinite(r.value) ? r.value : 0));
    for (const row of visible) {
      const tr = el("tr");
      const cell = (content, klass = "") => { const td = el("td", klass, String(content)); tr.append(td); return td; };
      const first = cell(row.label, "repd-report-source");
      if (row.refs.length && typeof onSelectProjects === "function") {
        first.textContent = "";
        const link = el("button", "repd-report-link", row.label);
        link.type = "button";
        link.addEventListener("click", () => onSelectProjects([...row.refs]));
        first.append(link);
      }
      cell(fmt.format(row.projects));
      cell(row.capacity, "repd-report-capacity");
      cell(row.energy, "repd-report-capacity");
      cell(row.caveat);
      tbody.append(tr);
      const bar = el("div", "repd-report-bar-row");
      const name = el("span", "", row.label);
      const track = el("span", "repd-report-bar-track");
      const fill = el("span", "repd-report-bar-fill");
      fill.style.width = max && row.value !== null ? Math.max(0, row.value / max * 100) + "%" : "0%";
      track.append(fill);
      const val = el("span", "", row.value === null ? "—" : fmt.format(row.value));
      bar.append(name, track, val);
      chart.append(bar);
    }
    table.append(tbody); scroller.append(table);
    if (isEnergy) {
      exportRows = visible.map(r => ({ period: r.label, scenario_mwh: r.value, availability: r.caveat, notes: note.textContent }));
      exportCols = [["period", "Period"], ["scenario_mwh", "Scenario MWh (not metered)"], ["availability", "Availability"], ["notes", "Basis"]];
    } else {
      exportRows = data.rows.map(r => ({
        period: r.period, group: r.group, projects: r.projects, unit_breakdown: groupUnitText(r.capacityByUnit),
        missing_capacity: r.missingCapacity, repd_refs: r.repdRefs.join("|"), basis: note.textContent,
      }));
      exportCols = [["period", "Period"], ["group", "Group"], ["projects", "Projects"],
        ["unit_breakdown", "Capacity by original REPD units"], ["missing_capacity", "Missing capacity rows"],
        ["repd_refs", "REPD References"], ["basis", "Basis"]];
    }
    summary.textContent = fmt.format(visible.length) + " report groups • " + fmt.format(projects.length) +
      " canonical REPD records loaded • " + (isEnergy ? "Assumptions explicit; not metered" : "Source-unit conservation");
  }
  render();
  return { render, destroy() { host.replaceChildren(); host.classList.remove("repd-periodic-reports"); } };
}
