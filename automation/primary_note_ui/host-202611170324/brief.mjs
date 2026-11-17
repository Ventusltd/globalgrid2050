/* ROOT renderer for the existing Machine Read Notes brief; no new panel. */
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (cls) node.className = cls;
  return node;
};
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Unknown';
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
function link(label, value) {
  let url;
  try {url = new URL(value);} catch {return el('span', label + ' unavailable');}
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return el('span', label + ' unavailable');
  const node = el('a', label);node.href = url.href;node.target = '_blank';node.rel = 'noopener noreferrer';return node;
}
export function decoratePrimaryButton(button, note) {
  button.replaceChildren(
    el('span', 'PROVISIONAL \u00b7 GOVERNMENT DECISION \u00b7 ' + date(note.claim.decision_date).toUpperCase(), 'machine-note-kind'),
    el('span', 'Development consent refused \u00b7 ' + note.binding.planning_reference, 'machine-note-headline')
  );
  button.dataset.notePrimary = 'provisional';
  button.setAttribute('aria-label', 'Provisional project association. Government decision dated ' + date(note.claim.decision_date) + '. Open the source brief.');
  button.title = note.source.author + ' \u00b7 provisional association; frozen REPD record retained';
}
export function appendPrimaryBrief(body, note, project) {
  const section = el('section', undefined, 'machine-note-source machine-note-primary');
  section.dataset.primaryNoteId = note.id;
  section.append(el('h3', 'Primary government decision'), el('p', note.claim.statement.replace(/REPD(\d)/g,'REPD $1')));
  section.append(el('p', 'Decision date: ' + date(note.claim.decision_date) + '. Letter date: ' + date(note.source.document_date) + '.'));
  section.append(el('p', note.source.author + ' \u00b7 ' + note.source.locators.decision), link('Open the government decision letter', note.source.url));
  const details = el('details');details.append(el('summary', 'Source receipt and qualifications'));
  details.append(el('p', 'Frozen REPD status: ' + project.status + '. Record updated ' + date(project.repd_record_updated) + '.'));
  details.append(el('p', 'Submission dates remain source-specific: REPD ' + date(project.planning_application_submitted) + '; decision letter ' + date(note.claim.source_application_submitted) + '.'));
  details.append(el('p', 'The original application and frozen REPD baseline are ' + note.claim.capacity_context.original_application_repd_baseline_mw + ' MW. The letter describes a later reduction; the final reduced capacity is not established.'));
  details.append(el('p', 'Later project status, installed capacity, electrical connection and judicial review status remain unknown.'));
  details.append(el('p', 'Document retrieved: ' + note.source.retrieved_at + '. Independent review: ' + note.evidence_review.independent_review_at + '.'));
  const receipt = el('p', 'Observed PDF: ' + note.source.bytes.toLocaleString('en-GB') + ' bytes. SHA-256: ' + note.source.sha256);
  receipt.style.overflowWrap = 'anywhere';details.append(receipt);
  details.append(el('p', note.rights.attribution), link('Open Government Licence v3.0', note.rights.licence_url));
  details.append(el('p', 'Reuse is limited to government-authored decision facts. Applicant and other third-party material, personal information and standalone logos are excluded. No official endorsement is implied.'));
  section.append(details);body.append(section);
}
