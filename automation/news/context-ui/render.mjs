import {readContext, sourceUrl} from './adapter.mjs';
const generations = new WeakMap();
const rootAttribute = 'data-transition-context-root';
const known = value => value === null || value === undefined ? 'Unknown' : String(value);
const label = value => known(value).replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
// Complete values remain in readContext's result; presentation omits transport
// identifiers and renders source/history evidence without JSON or schema jargon.
const transport = new Set(['schema', 'input_schema', 'output_schema', 'input_sha256', 'source_byte_validation', 'output_policy']);
function evidence(document, parent, value) {
  if (value.schema === 'globalgrid2050.filing-figure.v1') {
    line(document, parent, 'Figure', 'See the figure and source details above');
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (transport.has(key)) continue;
    const title = ({sha256: 'Source fingerprint', content_sha256: 'Source fingerprint',
      native_metadata: 'Source background', numeric_claims: 'Figures', canonical_project_id: 'Confirmed project',
      canonical_binding: 'Project association', binding_basis: 'Basis for project association',
      figure_entity_scope: 'Figure coverage', entity_id: 'Organisation or project reference'})[key] ?? label(key);
    if (entry && typeof entry === 'object') {
      const group = disclosure(document, parent, title);
      if (!Object.keys(entry).length) line(document, group, 'Details', 'None supplied');
      else evidence(document, group, entry);
    } else line(document, parent, title, typeof entry === 'string' && /^[A-Z_]+$/.test(entry) ? label(entry) : entry);
  }
}
function node(document, tag, text) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  return result;
}
function line(document, parent, label, value) {
  parent.append(node(document, 'p', `${label}: ${known(value)}`));
}
function disclosure(document, parent, title) {
  const details = node(document, 'details'); details.append(node(document, 'summary', title)); parent.append(details); return details;
}
function source(document, parent, link) {
  const details = disclosure(document, parent, `Source: ${link.publisher}`);
  const a = node(document, 'a', link.receipt.title || 'Read source'); a.href = sourceUrl(link.url);
  a.target = '_blank'; a.rel = 'noopener noreferrer'; details.append(a);
  for (const [label, value] of [['Published', link.published_date], ['Reviewed', link.reviewed_at],
    ['Retrieved', link.retrieved_at], ['Source fingerprint', link.sha256],
    ['Section', link.locator.section], ['Page', link.locator.page], ['Locator', link.locator.text]]) line(document, details, label, value);
  evidence(document, disclosure(document, details, 'Source details'), link.receipt);
}
/** Mount only inside a host explicitly designated by the News integrator. */
export async function renderContext(host, bytes, {expectedSha256, figures}) {
  if (!host?.hasAttribute('data-news-context-host')) throw new TypeError('An opted-in News host is required');
  const generation = (generations.get(host) ?? 0) + 1; generations.set(host, generation);
  const document = host.ownerDocument;
  const root = node(document, 'details'); root.setAttribute(rootAttribute, ''); root.className = 'transition-context';
  let report;
  try {
    if (typeof figures?.renderFigures !== 'function') throw new TypeError('Missing FIGURES renderer');
    report = await readContext(bytes, {expectedSha256, buildViewModel: figures.buildViewModel});
    root.contextReport = report; // exact native evidence retained for the host
    root.dataset.state = 'available';
    root.append(node(document, 'summary', 'Policy, grid and energy context'));
    root.append(node(document, 'p', 'Provisional information from dated sources. Project associations, current delivery and legal compliance have not been confirmed.'));
    line(document, root, 'Assessment date (sources may be older)', report.as_of);
    for (const row of report.records) {
      const item = disclosure(document, root, `${row.title} — ${label(row.source_state)}`); item.dataset.contextId = row.id;
      line(document, item, 'Coverage', `${label(row.scope.kind)}; source describes: ${label(row.scope.native_scope)}`);
      line(document, item, 'Project association', 'Not confirmed');
      line(document, item, 'Source status', label(row.source_state)); line(document, item, 'Progress', label(row.evaluation_state));
      line(document, item, 'Applies to this project', label(row.applicability_state));
      const n = row.native_record;
      if (row.family === 'policy') {
        line(document, item, 'Policy scope', n.scope.description);
        line(document, item, 'Applicability reason', n.applicability.reason);
        line(document, item, 'Measurement', label(n.measurement_state));
        line(document, item, 'Evidence limitation', n.metric.limitation);
        line(document, item, 'Deadline', n.deadline.value); line(document, item, 'Deadline wording', n.deadline.wording);
        line(document, item, 'Reporting obligation', n.reporting_obligation);
        for (const condition of n.conditions) line(document, item, 'Condition', condition);
        for (const reason of n.reasons) line(document, item, 'Reason', reason);
        line(document, item, 'Legal compliance', label(n.legal_compliance));
      } else {
        line(document, item, 'Current delivery / project status', label(row.family === 'solar' ? n.current_delivery : n.current_project_state));
        if (row.family === 'solar') line(document, item, 'Scope limitation', n.scope_note);
        line(document, item, 'Research needed', n.research_action);
        if (n.figures_omitted_reason !== null) line(document, item, 'Why figures are unavailable', n.figures_omitted_reason);
      }
      if (!row.numeric_claims.length) item.append(node(document, 'p', 'No supported figures available.'));
      for (const figure of row.numeric_claims) {
        const box = node(document, 'div'); box.dataset.contextFigure = '';
        line(document, box, 'Figure purpose', label(figure.role));
        line(document, box, 'Qualifier', figure.qualifier === 'upper_bound' ? 'Upper bound (up to)' : known(figure.qualifier));
        figures.renderFigures(box, {entityId: row.scope.entity_id, state: 'available', claims: [figure.claim]});
        item.append(box);
      }
      row.source_links.forEach(link => source(document, item, link));
      evidence(document, disclosure(document, item, 'Supporting details and history'), n);
    }
    const backgroundDetails = disclosure(document, root, 'Coverage and source background');
    backgroundDetails.append(node(document, 'p', 'Coverage is limited to the sources listed here. Source retrieval does not independently verify the facts. Figures are not added together or allocated to sites.'));
    for (const receipt of report.input_receipts) {
      const family = disclosure(document, backgroundDetails, label(receipt.family));
      for (const doc of receipt.native_metadata.documents ?? []) {
        const background = disclosure(document, family, `${doc.title} — ${label(doc.document_state)}`);
        line(document, background, 'Source coverage', doc.read_coverage.note);
        source(document, background, {document_id: doc.id, publisher: doc.issuer, url: doc.url,
          published_date: doc.published_on, reviewed_at: doc.reviewed_at, retrieved_at: doc.retrieved_at,
          sha256: doc.content_sha256, locator: {section: null, page: null, text: doc.read_coverage.locators.join('; ')}, receipt: doc});
      }
      evidence(document, disclosure(document, family, 'Source background details'), receipt.native_metadata);
    }
  } catch {
    root.replaceChildren();
    delete root.contextReport;
    root.dataset.state = 'unavailable';
    root.append(node(document, 'summary', 'Policy, grid and energy context — unavailable'));
    root.append(node(document, 'p', 'This information is temporarily unavailable.'));
  }
  if (generations.get(host) !== generation) return null;
  for (const child of Array.from(host.children)) if (child.hasAttribute(rootAttribute)) child.remove();
  host.append(root);
  return root;
}
