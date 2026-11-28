const reader = "https://ventusltd.github.io/legislation/legal-evidence/";
const nations = new Set(["England", "Scotland", "Wales", "Northern Ireland"]);

export function legalEvidenceURL(project, pathname = globalThis.location?.pathname ?? "") {
  const ref = String(project?.repd_ref ?? "");
  if (!/^[1-9]\d*$/.test(ref) || project.gg_project_id !== "GG2050-REPD-" + ref)
    return null;
  const url = new URL(reader);
  url.searchParams.set("source_app", "pipelinenews");
  url.searchParams.set("repd_ref", ref);
  const release = /^\/uk_renewables_pipeline\/(\d{12})\/(?:index\.html)?$/.exec(pathname);
  if (release) url.searchParams.set("source_release", release[1]);
  for (const [key, value] of Object.entries({
    project: project.name, technology: project.technology, status: project.status,
    jurisdiction: nations.has(project.country) ? project.country : undefined,
  })) {
    if (typeof value === "string" && value.trim()) url.searchParams.set(key, value.trim());
  }
  if (project.capacity_known === true && Number.isFinite(project.capacity_mw) && project.capacity_mw >= 0)
    url.searchParams.set("mw", String(project.capacity_mw));
  return url.href;
}

export function legalEvidenceAction(project) {
  const href = legalEvidenceURL(project);
  return href ? '<div><a class="action-link" href="' + href.replaceAll("&", "&amp;") + '">Legal evidence</a></div>' : "";
}
