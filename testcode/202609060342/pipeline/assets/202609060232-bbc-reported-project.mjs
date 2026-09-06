// A named, attributed report is useful even when it has no validated REPD join.
// Never borrow an adjacent article subject's numbers to fill its unknowns.
export function validateReportedProject(project) {
  if (project?.schema !== 'pipelinenews.reported-project.v1' || !project.primary_project) throw Error('Invalid project evidence schema');
  const url = new URL(project.article_url);
  if (url.protocol !== 'https:' || !['www.bbc.co.uk','www.bbc.com'].includes(url.hostname)) throw Error('Invalid publisher URL');
  if (!project.publisher || !project.evidence_basis || !project.source_published_at) throw Error('Attribution required');
  if (!Array.isArray(project.claims) || !Array.isArray(project.related_projects)) throw Error('Claims required');
  const validate = (claims, subject) => {
    const metrics = new Set();
    for (const claim of claims) {
      if (claim.subject !== subject) throw Error('Cross-project attribution rejected');
      if (metrics.has(claim.metric)) throw Error('Conflicting metric requires explicit resolution');
      metrics.add(claim.metric);
      if (!['reported_statement','reported_claim','reported_proposal'].includes(claim.kind)) throw Error('Unsupported evidence class');
      if (typeof claim.value === 'number' && (!Number.isFinite(claim.value) || claim.value < 0)) throw Error('Invalid reported number');
      if (claim.metric === 'solar_capacity' && claim.unit !== 'MW') throw Error('Capacity must retain MW units');
    }
  };
  validate(project.claims, project.primary_project);
  for (const related of project.related_projects) validate(related.claims, related.name);
  if (project.repd_ref === null && project.eligible_for_project_signal !== false) throw Error('Unmatched news cannot become a matched project signal');
  return structuredClone(project);
}
