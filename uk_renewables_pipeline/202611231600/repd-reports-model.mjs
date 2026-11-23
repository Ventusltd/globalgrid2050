// PipelineNews V9.73: pure, source-fidelity REPD capacity reporting.
export const REPORT_DIMENSIONS = Object.freeze(["operator", "status", "region"]);
export const NOT_REPORTED = "Not reported";

function label(value) {
  const result = typeof value === "string" ? value.trim() : "";
  return result || NOT_REPORTED;
}
function emptySummary() {
  return { count: 0, recordedCapacity: 0, solarMwp: 0, otherMw: 0, missingCapacity: 0 };
}
function accumulate(summary, project) {
  summary.count += 1;
  const capacity = project.capacity_mw;
  if (typeof capacity !== "number" || !Number.isFinite(capacity) || capacity < 0) {
    summary.missingCapacity += 1;
    return;
  }
  summary.recordedCapacity += capacity;
  if (project.technology === "solar") summary.solarMwp += capacity;
  else summary.otherMw += capacity;
}
export function buildRepdCapacityReport(projects, dimension) {
  if (!REPORT_DIMENSIONS.includes(dimension)) throw new TypeError("Unsupported REPD report dimension");
  if (!Array.isArray(projects)) throw new TypeError("REPD report expects an array");
  const seen = new Set();
  const total = emptySummary();
  const grouped = new Map();
  for (const project of projects) {
    if (project?.technology === "interconnector") continue; // never count separate interconnector inventory
    const ref = String(project?.repd_ref ?? "").trim();
    if (!ref) throw new Error("Missing REPD identity");
    if (seen.has(ref)) throw new Error("Duplicate REPD identity: " + ref);
    seen.add(ref);
    const name = label(project[dimension]);
    let group = grouped.get(name);
    if (!group) {
      group = { name, ...emptySummary(), projects: [], statuses: new Map() };
      grouped.set(name, group);
    }
    const projectStatus = label(project.status);
    if (!group.statuses.has(projectStatus)) group.statuses.set(projectStatus, emptySummary());
    accumulate(group.statuses.get(projectStatus), project);
    accumulate(group, project);
    accumulate(total, project);
    group.projects.push(project);
  }
  const groups = [...grouped.values()].sort((a, b) =>
    b.recordedCapacity - a.recordedCapacity ||
    b.count - a.count ||
    a.name.localeCompare(b.name, "en-GB"));
  // Preserve every original status and source operator/region string. No ownership inference.
  return { dimension, total, groups, uniqueRefs: seen.size };
}
