import {readContext, sourceUrl} from './adapter.mjs';
const generations = new WeakMap();
const rootAttribute = 'data-transition-context-root';
const known = value => value === null || value === undefined ? 'Unknown' : String(value);
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
  const a = node(document, 'a', link.document_id); a.href = sourceUrl(link.url);
  a.target = '_blank'; a.rel = 'noopener noreferrer'; details.append(a);
  for (const [label, value] of [['Published', link.published_date], ['Reviewed', link.reviewed_at],
    ['Retrieved', link.retrieved_at], ['Original source SHA-256', link.sha256],
    ['Section', link.locator.section], ['Page', link.locator.page], ['Locator', link.locator.text]]) line(document, details, label, value);
  const receipt = disclosure(document, details, 'Complete source receipt');
  receipt.append(node(document, 'pre', JSON.stringify(link.receipt, null, 2)));
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
    root.dataset.state = 'available';
    root.append(node(document, 'summary', `Policy, grid and energy context — ${report.records.length} provisional records`));
    root.append(node(document, 'p', 'Dated source assertions. No linked projects, present delivery or legal compliance established.'));
    line(document, root, 'Evaluation clock (not source freshness)', report.as_of);
    for (const row of report.records) {
      const item = disclosure(document, root, `${row.title} — ${row.source_state}`); item.dataset.contextId = row.id;
      line(document, item, 'Scope', `${row.scope.kind}; native scope: ${known(row.scope.native_scope)}; entity: ${known(row.scope.entity_id)}; UNLINKED`);
      line(document, item, 'Source state', row.source_state); line(document, item, 'Evaluation', row.evaluation_state);
      line(document, item, 'Applicability', row.applicability_state);
      const n = row.native_record;
      if (row.family === 'policy') {
        line(document, item, 'Policy scope', n.scope.description);
        line(document, item, 'Applicability reason', n.applicability.reason);
        line(document, item, 'Measurement', n.measurement_state);
        line(document, item, 'Metric limitation', n.metric.limitation);
        line(document, item, 'Deadline', n.deadline.value); line(document, item, 'Deadline wording', n.deadline.wording);
        line(document, item, 'Reporting obligation', n.reporting_obligation);
        for (const condition of n.conditions) line(document, item, 'Condition', condition);
        for (const reason of n.reasons) line(document, item, 'Reason', reason);
        line(document, item, 'Legal compliance', n.legal_compliance);
      } else {
        line(document, item, 'Current delivery / project state', row.family === 'solar' ? n.current_delivery : n.current_project_state);
        if (row.family === 'solar') line(document, item, 'Scope limitation', n.scope_note);
        line(document, item, 'Research needed', n.research_action);
        line(document, item, 'Omitted figures reason', n.figures_omitted_reason);
      }
      if (!row.numeric_claims.length) item.append(node(document, 'p', 'No supported numeric claim supplied.'));
      for (const figure of row.numeric_claims) {
        const box = node(document, 'div'); box.dataset.contextFigure = '';
        line(document, box, 'Figure role', figure.role);
        line(document, box, 'Qualifier', figure.qualifier === 'upper_bound' ? 'Upper bound (up to)' : known(figure.qualifier));
        figures.renderFigures(box, {entityId: row.scope.entity_id, state: 'available', claims: [figure.claim]});
        item.append(box);
      }
      row.source_links.forEach(link => source(document, item, link));
      const native = disclosure(document, item, 'Complete source-scoped record and revision history');
      native.append(node(document, 'pre', JSON.stringify(n, null, 2)));
    }
    const evidence = disclosure(document, root, 'Coverage and source background');
    report.limitations.forEach(value => evidence.append(node(document, 'p', value)));
    for (const receipt of report.input_receipts) {
      const family = disclosure(document, evidence, `${receipt.family}: ${receipt.record_count} records`);
      for (const doc of receipt.native_metadata.documents ?? []) {
        const background = disclosure(document, family, `${doc.title} — ${doc.document_state}`);
        line(document, background, 'Document only; no additional commitment inferred', doc.read_coverage.note);
        source(document, background, {document_id: doc.id, publisher: doc.issuer, url: doc.url,
          published_date: doc.published_on, reviewed_at: doc.reviewed_at, retrieved_at: doc.retrieved_at,
          sha256: doc.content_sha256, locator: {section: null, page: null, text: doc.read_coverage.locators.join('; ')}, receipt: doc});
      }
      const provenance = disclosure(document, family, 'Supplied input receipt (source bytes not reverified)');
      provenance.append(node(document, 'pre', JSON.stringify(receipt, null, 2)));
    }
  } catch {
    root.replaceChildren();
    root.dataset.state = 'unavailable';
    root.append(node(document, 'summary', 'Policy, grid and energy context — unavailable'));
    root.append(node(document, 'p', 'The supplied context could not be validated. No current result is displayed.'));
  }
  if (generations.get(host) !== generation) return null;
  for (const child of Array.from(host.children)) if (child.hasAttribute(rootAttribute)) child.remove();
  host.append(root);
  return root;
}
