const TECHNOLOGIES = new Set(["all", "solar", "bess", "wind_onshore", "wind_offshore"]);

export function normaliseSearchV9_2(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-GB")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokeniseSearchV9_2(value) {
  const normalised = normaliseSearchV9_2(value);
  return normalised ? normalised.split(" ").filter(Boolean) : [];
}

export function buildProjectSearchTextV9_2(project) {
  const relationshipRefs = [
    ...(Array.isArray(project.direct_related_repd_refs) ? project.direct_related_repd_refs : []),
    ...(Array.isArray(project.planning_sibling_repd_refs) ? project.planning_sibling_repd_refs : []),
    ...(Array.isArray(project.development_repd_refs) ? project.development_repd_refs : []),
  ];
  return normaliseSearchV9_2([
    project.name,
    project.operator,
    project.repd_ref,
    project.gg_project_id,
    project.gg_development_id,
    project.repd_old_ref,
    project.repd_technology,
    project.technology,
    project.status,
    project.lifecycle,
    project.capacity_mw,
    project.county,
    project.region,
    project.country,
    project.planning_authority,
    project.planning_application_reference,
    project.repd_record_updated,
    project.geometry_status,
    relationshipRefs.join(" "),
  ].join(" "));
}

export function projectMatchesV9_2(project, filters, searchText = buildProjectSearchTextV9_2(project)) {
  const technology = TECHNOLOGIES.has(filters.technology) ? filters.technology : "all";
  const status = String(filters.status || "All");
  const county = String(filters.county || "All");
  const tokens = Array.isArray(filters.tokens) ? filters.tokens : tokeniseSearchV9_2(filters.query);

  if (technology !== "all" && project.technology !== technology) return false;
  if (status !== "All" && !String(project.status || "").includes(status)) return false;
  if (county !== "All" && project.county !== county) return false;
  return tokens.every((token) => searchText.includes(token));
}

export function summariseProjectsV9_2(projects) {
  let capacity = 0;
  let largest = 0;
  for (const project of projects) {
    capacity += Number(project.capacity_mw) || 0;
    largest = Math.max(largest, Number(project.capacity_mw) || 0);
  }
  return {
    count: projects.length,
    capacity_mw: Math.round((capacity + Number.EPSILON) * 100) / 100,
    largest_mw: largest,
  };
}
