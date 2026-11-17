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
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value ? 'Unknown' :
    parsed.toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
function link(label, value) {
  let url;
  try {url = new URL(value);} catch {return el('span', label + ' unavailable');}
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return el('span', label + ' unavailable');
  const node = el('a', label);node.href = url.href;node.target = '_blank';node.rel = 'noopener noreferrer';return node;
}
const outcomes = Object.freeze({
  DEVELOPMENT_CONSENT_REFUSED:'Development consent refused',
  DEVELOPMENT_CONSENT_GRANTED:'Development consent granted',
  DEVELOPMENT_CONSENT_GRANTED_WITH_MODIFICATIONS:'Development consent granted with modifications'
});
export function decoratePrimaryButton(button, note) {
  button.replaceChildren(
    el('span', 'PROVISIONAL \u00b7 GOVERNMENT DECISION \u00b7 ' + date(note.claim.decision_date).toUpperCase(), 'machine-note-kind'),
    el('span', (outcomes[note.claim.type] || 'Government decision') + ' \u00b7 ' + note.binding.planning_reference, 'machine-note-headline')
  );
  button.dataset.notePrimary = 'provisional';
  button.setAttribute('aria-label', 'Provisional project association. Government decision dated ' + date(note.claim.decision_date) + '. Open the source brief.');
  button.title = note.source.author + ' \u00b7 provisional association; frozen REPD record retained';
}
export function appendPrimaryBrief(body, note, project) {
  const section = el('section', undefined, 'machine-note-source machine-note-primary');
  const letter = note.source.authorship === 'GOVERNMENT_DECISION_LETTER';
  section.dataset.primaryNoteId = note.id;
  section.append(el('h3', 'Primary government decision'), el('p', note.claim.statement.replace(/REPD(\d)/g,'REPD $1')));
  section.append(el('p', 'Decision date: ' + date(note.claim.decision_date) + '. ' +
    (letter ? 'Letter date: ' : 'Government publication date: ') + date(note.source.document_date) + '.'));
  section.append(el('p', note.source.author + ' \u00b7 ' + note.source.locators.decision),
    link(letter ? 'Open the government decision letter' : 'Open the government announcement', note.source.url));
  const details = el('details');details.append(el('summary', 'Source receipt and qualifications'));
  details.append(el('p', 'Frozen REPD status: ' + project.status + '. Record updated ' + date(project.repd_record_updated) + '.'));
  details.append(el('p', 'Submission dates remain source-specific: REPD ' + date(project.planning_application_submitted) + '; ' +
    (letter ? 'decision letter ' : 'government announcement ') + date(note.claim.source_application_submitted) + '.'));
  if (note.claim.source_application_accepted) details.append(el('p', 'Government application acceptance: ' +
    date(note.claim.source_application_accepted) + '. Submission and acceptance are separate events.'));
  const capacity = note.claim.capacity_context;
  if (note.claim.type === 'DEVELOPMENT_CONSENT_REFUSED') {
    details.append(el('p', 'The original application and frozen REPD baseline are ' + capacity.original_application_repd_baseline_mw +
      ' MW. The letter describes a later reduction; the final reduced capacity is not established.'));
    details.append(el('p', 'Later project status, installed capacity, electrical connection and judicial review status remain unknown.'));
  } else {
    details.append(el('p', 'Frozen solar-row REPD baseline: ' + capacity.frozen_solar_row_reported_mw + ' MW. Government capacity description: ' +
      capacity.government_reported_mw + ' MW (' + capacity.government_reported_basis + '). Original, final and as-built project capacity are not established by this note.'));
    details.append(link('Government capacity description source', capacity.government_reported_source_url));
    const scope = note.claim.development_scope, battery = scope.battery_component;
    details.append(el('p', 'Consent covers the whole solar-and-storage development. This solar-row association remains provisional. Battery REPD ' +
      battery.repd_ref + ' retains a separate identity; its MW and MWh are unknown, with no component capacity allocation.'));
    details.append(el('p', 'Government applicant: ' + note.source.government_applicant + '. Frozen REPD operator: ' + project.operator +
      '. Corporate ownership equivalence is not established.'));
    details.append(el('p', 'Later project status, installed capacity, electrical connection, commissioning and judicial review status remain unknown.'));
  }
  if (note.news_metadata.basis === 'GOVERNMENT_PUBLICATION_METADATA_ONLY') {
    const precision = note.news_metadata.publication_precision;
    const publication = precision === 'DAY' ? date(note.news_metadata.published_at.slice(0,10)) + ' (day precision)' :
      precision === 'RECORDED_METADATA_TIMESTAMP' ? note.news_metadata.published_at + ' (recorded publication metadata)' : 'Unknown';
    details.append(el('p', 'Government page published: ' + publication + '. Administrative update: ' +
      note.news_metadata.administrative_updated_at + '. The decision date remains ' + date(note.claim.decision_date) + '.'));
  }
  details.append(el('p', 'Document retrieved: ' + note.source.retrieved_at + '. Independent review: ' + note.evidence_review.independent_review_at + '.'));
  const receipt = el('p', (letter ? 'Observed PDF: ' : 'Observed government HTML: ') +
    note.source.bytes.toLocaleString('en-GB') + ' bytes. SHA-256: ' + note.source.sha256);
  receipt.style.overflowWrap = 'anywhere';details.append(receipt);
  if (note.source.corroboration) {
    details.append(link('Corroborating government publication', note.source.corroboration.url));
    const observed = el('p', 'Corroborating source retrieved: ' + note.source.corroboration.retrieved_at +
      '. Observed bytes: ' + note.source.corroboration.bytes + '. SHA-256: ' + note.source.corroboration.sha256);
    observed.style.overflowWrap = 'anywhere';details.append(observed);
  }
  details.append(el('p', note.rights.attribution), link('Open Government Licence v3.0', note.rights.licence_url));
  details.append(el('p', 'Reuse is limited to government-authored decision facts. Applicant and other third-party material, personal information and standalone logos are excluded. No official endorsement is implied.'));
  section.append(details);body.append(section);
}
