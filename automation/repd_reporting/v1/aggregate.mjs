/**
 * REPD Intelligence reports v1 — pure, read-only aggregation over canonical
 * project records. Never converts MW/MWp to energy without explicit assumptions.
 * This module makes no network calls or homepage/publication changes.
 */
export const PERIODS = Object.freeze(["month", "quarter", "year"]);
export const DIMENSIONS = Object.freeze(["operator", "status", "region", "technology", "all"]);
const UNKNOWN = "Not supplied";
const DAY = 86_400_000;

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : UNKNOWN;
}
function field(project, dimension) {
  switch (dimension) {
    case "technology": return text(project.repd_technology ?? project.technology_label ?? project.technology);
    case "status": return text(project.status);
    case "region": return text(project.region);
    case "operator": return text(project.operator);
    case "all": return "All projects";
    default: throw new Error("Unsupported dimension: " + dimension);
  }
}
function dateUTC(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const valueMs = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(valueMs) && new Date(valueMs).toISOString().slice(0, 10) === value ? valueMs : null;
}
export function periodKey(date, period) {
  if (!PERIODS.includes(period)) throw new Error("Invalid period");
  const ms = dateUTC(date);
  if (ms === null) return null;
  const year = date.slice(0, 4);
  const month = Number(date.slice(5, 7));
  return period === "year" ? year : period === "quarter"
    ? year + "-Q" + Math.ceil(month / 3) : date.slice(0, 7);
}
export function validateIdentity(projects) {
  if (!Array.isArray(projects)) throw new Error("Expected canonical REPD project array");
  const seen = new Set();
  for (const project of projects) {
    const ref = String(project?.repd_ref ?? "");
    if (!/^\d+$/.test(ref) || seen.has(ref)) throw new Error("Missing or duplicate REPD reference: " + ref);
    seen.add(ref);
  }
  return projects.length;
}
function capacity(project) {
  const n = project.capacity_mw;
  if (n === null || n === undefined || n === "") return null;
  const parsed = typeof n === "number" ? n : Number(n);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function matches(project, filters) {
  return ["operator", "status", "region", "technology"].every((dimension) => {
    const selection = filters?.[dimension];
    return !selection || selection === "All" || field(project, dimension).toLowerCase() === String(selection).trim().toLowerCase();
  });
}
function add(project, row) {
  row.projects += 1;
  row.repdRefs.push(String(project.repd_ref));
  const mw = capacity(project);
  if (mw === null) {
    row.missingCapacity += 1;
  } else {
    const unit = text(project.capacity_unit);
    row.capacityByUnit[unit] = (row.capacityByUnit[unit] ?? 0) + mw;
  }
}
function newRow(key, dimension) {
  return { period: key, group: dimension, projects: 0, missingCapacity: 0, capacityByUnit: {}, repdRefs: [] };
}
function rowsOut(grouped) {
  return [...grouped.values()].sort((a, b) =>
    a.period.localeCompare(b.period) || a.group.localeCompare(b.group)
  );
}
export function snapshotReport(projects, { dimension = "technology", filters = {} } = {}) {
  validateIdentity(projects);
  if (!DIMENSIONS.includes(dimension)) throw new Error("Invalid dimension");
  const grouped = new Map();
  for (const project of projects) {
    if (!matches(project, filters)) continue;
    const group = field(project, dimension);
    if (!grouped.has(group)) grouped.set(group, newRow("SNAPSHOT", group));
    add(project, grouped.get(group));
  }
  return { kind: "snapshot", dimension, count: projects.length, rows: rowsOut(grouped) };
}
/**
 * REPD-reported operational projects, not independently certified energisation.
 * A date on a non-operational status is NEVER counted as an energised project.
 * Unknown milestone dates and impossible future dates have explicit buckets.
 */
export function operationalReport(projects, {
  period = "year", dimension = "technology", filters = {},
  asOf = "2026-11-22",
} = {}) {
  validateIdentity(projects);
  if (!PERIODS.includes(period) || !DIMENSIONS.includes(dimension)) throw new Error("Invalid report options");
  const asOfMs = dateUTC(asOf);
  if (asOfMs === null) throw new Error("Invalid snapshot date");
  const grouped = new Map();
  for (const project of projects) {
    if (!matches(project, filters) || text(project.status).toLowerCase() !== "operational") continue;
    const date = project.operational ?? project.operational_date;
    const ms = dateUTC(date);
    const bucket = ms === null ? "UNKNOWN-DATE" : ms > asOfMs ? "FUTURE-DATE-CONFLICT" : periodKey(date, period);
    const group = field(project, dimension);
    const id = bucket + "\u0000" + group;
    if (!grouped.has(id)) grouped.set(id, newRow(bucket, group));
    add(project, grouped.get(id));
  }
  return { kind: "repd-reported-operational", period, dimension, asOf, count: projects.length, rows: rowsOut(grouped) };
}
function daysInPeriod(year, month) {
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(year, month, 1) - DAY;
  return { start, end };
}
function isStorage(technology) {
  return /battery|storage|pumped hydro|bess|flywheel/i.test(technology);
}
function configuredFactor(factors, technology) {
  const val = factors?.[technology];
  return typeof val === "number" && Number.isFinite(val) && val >= 0 && val <= 1 ? val : null;
}
function configuredSeasonality(seasonality, technology, month) {
  const profile = seasonality?.[technology];
  if (profile === undefined) return 1;
  if (!Array.isArray(profile) || profile.length !== 12 || !profile.every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) {
    throw new Error("Invalid twelve-month profile for " + technology);
  }
  return profile[month - 1];
}
/**
 * Optional, explicitly assumed generation scenario, never metered output.
 * No capacity factor defaults; unavailable assumptions yield null, NOT zero.
 * Storage is excluded; a separate throughput model is required for BESS.
 */
export function estimatedGeneration(projects, {
  year, period = "month", factors = {}, seasonality = {}, filters = {},
  asOf = "2026-11-22",
} = {}) {
  validateIdentity(projects);
  if (!PERIODS.includes(period) || !Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("Invalid report period");
  const asOfMs = dateUTC(asOf);
  if (asOfMs === null) throw new Error("Invalid snapshot date");
  const monthly = [];
  const excludedStorage = new Set();
  const excludedNoDate = new Set();
  for (let month = 1; month <= 12; month++) {
    const { start, end } = daysInPeriod(year, month);
    const cutoff = Math.min(end, asOfMs);
    let mwh = 0, missingAssumptions = 0, contributingProjects = 0, projectMonths = 0;
    if (start > asOfMs) {
      monthly.push({ period: String(year) + "-" + String(month).padStart(2, "0"), mwh: null, availability: "FUTURE", contributingProjects: 0, missingAssumptions: 0 });
      continue;
    }
    for (const project of projects) {
      if (!matches(project, filters) || text(project.status).toLowerCase() !== "operational") continue;
      const tech = field(project, "technology");
      if (isStorage(tech)) {
        excludedStorage.add(String(project.repd_ref));
        continue;
      }
      const commission = dateUTC(project.operational ?? project.operational_date);
      if (commission === null) {
        excludedNoDate.add(String(project.repd_ref));
        continue;
      }
      const mw = capacity(project);
      if (commission > cutoff) continue;
      projectMonths += 1;
      const cf = configuredFactor(factors, tech);
      if (mw === null || cf === null) {
        missingAssumptions += 1;
        continue;
      }
      const days = Math.floor((cutoff - Math.max(start, commission)) / DAY) + 1;
      mwh += mw * days * 24 * cf * configuredSeasonality(seasonality, tech, month);
      contributingProjects += 1;
    }
    monthly.push({
      period: String(year) + "-" + String(month).padStart(2, "0"),
      mwh: missingAssumptions > 0 ? null : mwh,
      partialMwh: missingAssumptions > 0 ? mwh : null,
      availability: missingAssumptions > 0 ? "INCOMPLETE_ASSUMPTIONS" : "SCENARIO_ONLY",
      contributingProjects, projectMonths, missingAssumptions,
    });
  }
  const grouped = new Map();
  for (const month of monthly) {
    const key = period === "month" ? month.period : period === "year"
      ? month.period.slice(0, 4)
      : month.period.slice(0, 4) + "-Q" + Math.ceil(Number(month.period.slice(5, 7)) / 3);
    if (!grouped.has(key)) grouped.set(key, {
      period: key, mwh: 0, partialMwh: 0, contributingProjectMonths: 0, missingAssumptions: 0, months: 0, unavailableMonths: 0,
    });
    const out = grouped.get(key);
    out.months += 1;
    out.contributingProjectMonths += month.contributingProjects;
    out.missingAssumptions += month.missingAssumptions;
    if (month.mwh === null) {
      out.unavailableMonths += 1;
      out.partialMwh += month.partialMwh ?? 0;
    } else {
      out.mwh += month.mwh;
    }
  }
  return {
    kind: "scenario-estimated-generation-not-metered",
    period, year, asOf, units: "MWh", method: "MW/MWp_as_recorded * operational_active_hours * user_supplied_CF * user_supplied_monthly_multiplier",
    rows: [...grouped.values()].map(row => ({
      ...row, mwh: row.unavailableMonths ? null : row.mwh,
      availability: row.unavailableMonths ? "INCOMPLETE_OR_FUTURE" : "SCENARIO_ONLY",
    })),
    excludedStorageRefs: [...excludedStorage].sort(),
    excludedUnknownOperationalDateRefs: [...excludedNoDate].sort(),
  };
}
