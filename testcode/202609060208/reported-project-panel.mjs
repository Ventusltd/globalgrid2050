import {validateReportedProject} from './reported-project.mjs';
export function showReportedProject(host, input) {
  const project=validateReportedProject(input);
  const title=document.createElement('h2');title.textContent=project.primary_project+' - reported proposal';
  const scope=document.createElement('p');scope.textContent='No name match in the pinned '+project.snapshot_check.rows+'-project Pipeline snapshot. Current national REPD presence and aliases have not been established.';
  const list=document.createElement('dl');
  for (const claim of project.claims) {
    const term=document.createElement('dt'), description=document.createElement('dd');
    term.textContent=claim.metric.replaceAll('_',' ');
    description.textContent=(claim.value===true?'Reported included':String(claim.value))+(claim.unit?' '+claim.unit:'')+(claim.qualifier?' - '+claim.qualifier:'');
    list.append(term,description);
  }
  const related=document.createElement('p');related.textContent='Separate related project: '+project.related_projects.map(p=>p.name).join(', ')+'. Its capacity and cost are not attributed to '+project.primary_project+'.';
  const unknown=document.createElement('p');unknown.textContent='Still unverified or unspecified: '+project.unknowns.join('; ')+'.';
  const evidence=document.createElement('p'),link=document.createElement('a');link.href=project.article_url;link.textContent=project.publisher+' source';evidence.append(link,document.createTextNode(' | '+project.evidence_basis));
  const caveat=document.createElement('p');caveat.textContent=project.paper_alignment;
  host.replaceChildren(title,scope,list,related,unknown,evidence,caveat);
}
