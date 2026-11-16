/** Offline consumer of the pinned SUPPORT composer. FIGURES remains injected. */
export const MAX_BYTES = 16 * 1024 * 1024;
const SCHEMA = 'globalgrid2050.transition-context.v1';
const families = ['policy', 'grid', 'solar'];
const digestPattern = /^[a-f0-9]{64}$/;
function requireValue(ok) { if (!ok) throw new TypeError('Unsupported transition context'); }
function equal(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
function keys(value, names) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  requireValue(equal(Object.keys(value).sort(), names.split(' ').sort()));
}
function text(value) { requireValue(typeof value === 'string' && value.length > 0 && value.length <= 100000); }
export function sourceUrl(value) {
  requireValue(typeof value === 'string' && /^[\x21-\x7e]+$/.test(value) && !/[\\]/.test(value));
  const url = new URL(value);
  requireValue(url.protocol === 'https:' && !url.username && !url.password && !url.port);
  requireValue(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname));
  requireValue(!/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/i.test(url.hostname));
  return url.href;
}
function date(value, timestamp = false) {
  if (value === null) return;
  requireValue(typeof value === 'string' && (timestamp
    ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
    : /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/).test(value));
  // A well-shaped date such as 2026-02-30 is not a valid source clock.
  const [year, month = 1, day = 1] = value.slice(0, 10).split('-').map(Number);
  requireValue(month >= 1 && month <= 12 && day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate());
  if (timestamp) requireValue(Number.isFinite(Date.parse(value)));
}
function scope(nativeScope, entity, family, relationship) {
  const kind = relationship === 'portfolio_storage_access' || nativeScope === 'consolidated_group'
    ? 'portfolio' : nativeScope === 'issuer' ? 'issuer'
      : ['project', 'site', 'campus', 'phase'].includes(nativeScope) ? 'project'
        : family === 'policy' ? 'policy' : 'UNKNOWN';
  return {kind, native_scope: nativeScope, entity_id: entity, canonical_project_id: null, binding: 'UNLINKED'};
}
function validateLink(link) {
  keys(link, 'document_id url publisher published_date reviewed_at retrieved_at sha256 locator receipt');
  text(link.document_id); text(link.publisher); sourceUrl(link.url);
  date(link.published_date); date(link.reviewed_at, true); date(link.retrieved_at, true);
  requireValue(link.sha256 === null || digestPattern.test(link.sha256));
  keys(link.locator, 'section page text');
  for (const value of Object.values(link.locator)) if (value !== null) text(value);
  const doc = link.receipt;
  const policy = Object.hasOwn(doc, 'published_on');
  for (const [key, expected] of Object.entries({document_id: policy ? doc.id : doc.document_id,
    url: doc.url, publisher: policy ? doc.issuer : doc.publisher,
    published_date: policy ? doc.published_on : doc.published_date,
    reviewed_at: policy ? doc.reviewed_at : null, retrieved_at: doc.retrieved_at,
    sha256: policy ? doc.content_sha256 : doc.sha256})) requireValue(equal(link[key], expected));
}
/** expectedSha256 must come from the host's accepted manifest, never the payload. */
export async function readContext(raw, {expectedSha256, buildViewModel}) {
  requireValue(raw instanceof Uint8Array && raw.length > 0 && raw.length <= MAX_BYTES);
  requireValue(typeof expectedSha256 === 'string' && digestPattern.test(expectedSha256));
  requireValue(typeof buildViewModel === 'function');
  const bytes = raw.slice(); // prevent mutation while WebCrypto is pending
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  requireValue(digest === expectedSha256);
  const report = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  keys(report, 'schema as_of status coverage input_receipts records limitations');
  requireValue(report.schema === SCHEMA && report.status === 'PROVISIONAL');
  date(report.as_of, true); requireValue(report.as_of !== null);
  requireValue(Array.isArray(report.records) && report.records.length > 0 && report.records.length <= 3000);
  requireValue(Array.isArray(report.limitations) && report.limitations.length > 0);
  report.limitations.forEach(text);
  const counts = {policy: 0, grid: 0, solar: 0}, ids = new Set(), claims = new Set();
  for (const row of report.records) {
    keys(row, 'id family title scope source_state evaluation_state applicability_state source_links numeric_claims native_schema native_record');
    requireValue(families.includes(row.family)); counts[row.family]++;
    text(row.id); text(row.title); requireValue(!ids.has(row.id)); ids.add(row.id);
    const n = row.native_record, policy = row.family === 'policy', solar = row.family === 'solar';
    requireValue(row.id === row.family + ':' + (policy ? n.commitment_id : n.id));
    requireValue(row.title === (policy ? n.statement : n.name));
    requireValue(row.native_schema === (policy ? 'globalgrid2050.policy-commitment-evaluation.v1' : `globalgrid2050.${row.family}-dc-context.v1`));
    requireValue(equal(row.scope, scope(policy ? n.scope.figure_entity_scope : solar ? n.entity.scope : n.entity_scope,
      policy ? n.scope.entity_id : solar ? n.entity.id : n.id, row.family, n.relationship)));
    requireValue(row.source_state === (policy ? n.document_state : n.source_state));
    requireValue(row.evaluation_state === (policy ? n.state : 'UNKNOWN'));
    requireValue(row.applicability_state === (policy ? n.applicability.state : 'UNKNOWN'));
    if (policy) requireValue(n.legal_compliance === 'NOT_ASSESSED');
    else requireValue(n.canonical_project_id === null && (solar ? n.current_delivery : n.current_project_state) === 'UNKNOWN');
    const nativeFigures = policy
      ? [['TARGET', n.target], ['BASELINE', n.baseline], ...n.updates.map(u => ['UPDATE', u.claim])]
        .filter(([, claim]) => claim !== null).map(([role, claim]) => ({role, qualifier: null, claim}))
      : n.numeric_claims.map(item => ({role: 'CONTEXT', qualifier: solar ? item.qualifier : null, claim: solar ? item.claim : item}));
    requireValue(equal(row.numeric_claims, nativeFigures));
    for (const figure of row.numeric_claims) {
      requireValue([null, 'stated', 'upper_bound', 'approximate'].includes(figure.qualifier));
      requireValue(!claims.has(figure.claim.claim_id)); claims.add(figure.claim.claim_id);
      requireValue(figure.claim.entity.id === row.scope.entity_id && figure.claim.entity.scope === row.scope.native_scope);
      buildViewModel({entityId: row.scope.entity_id, state: 'available', claims: [figure.claim]});
    }
    requireValue(Array.isArray(row.source_links) && row.source_links.length > 0);
    row.source_links.forEach(validateLink);
  }
  requireValue(families.every(f => counts[f] > 0));
  requireValue(equal(report.coverage, {records: report.records.length, families: counts,
    numeric_claims: claims.size, linked_projects: 0, scope: 'BOUNDED_SUPPLIED_CONTEXT'}));
  requireValue(Array.isArray(report.input_receipts) && report.input_receipts.length === 3);
  const receipts = new Set();
  for (const receipt of report.input_receipts) {
    keys(receipt, 'family input_schema input_sha256 output_schema record_count source_count source_byte_validation native_metadata');
    requireValue(families.includes(receipt.family) && !receipts.has(receipt.family)); receipts.add(receipt.family);
    requireValue(receipt.record_count === counts[receipt.family] && digestPattern.test(receipt.input_sha256));
    requireValue(receipt.source_byte_validation === 'RECEIPTS_ONLY');
    requireValue(receipt.native_metadata.schema === receipt.output_schema && receipt.native_metadata.as_of === report.as_of);
    for (const doc of receipt.native_metadata.documents ?? []) {
      sourceUrl(doc.url); date(doc.published_on); date(doc.reviewed_at, true); date(doc.retrieved_at, true);
      requireValue(doc.content_sha256 === null || digestPattern.test(doc.content_sha256));
    }
  }
  // The payload is already hash-pinned by the host. Still fail closed when
  // multiple *internal* copies of the same source contradict each other.
  // Neither matching receipts nor a hash pin amounts to source-truth review.
  const sourceDocuments = new Map();
  const registerSource = (id, receipt) => {
    text(id);
    const prior = sourceDocuments.get(id);
    requireValue(prior === undefined || equal(prior, receipt));
    sourceDocuments.set(id, receipt);
  };
  const policyReceipt = report.input_receipts.find(r => r.family === 'policy');
  requireValue(Array.isArray(policyReceipt.native_metadata.documents) &&
    policyReceipt.native_metadata.documents.length === policyReceipt.source_count);
  for (const doc of policyReceipt.native_metadata.documents) {
    sourceUrl(doc.url); date(doc.published_on); date(doc.reviewed_at, true); date(doc.retrieved_at, true);
    registerSource(doc.id, doc);
  }
  for (const family of ['grid', 'solar']) {
    const receipt = report.input_receipts.find(r => r.family === family);
    const familyRows = report.records.filter(r => r.family === family);
    const meta = receipt.native_metadata;
    requireValue(meta.context_count === familyRows.length &&
      meta.numeric_claim_count === familyRows.reduce((n, row) => n + row.numeric_claims.length, 0) &&
      meta.linked_project_count === 0 &&
      (meta.source_byte_validation === undefined || meta.source_byte_validation === 'RECEIPTS_ONLY'));
    requireValue(Array.isArray(meta.limitations) && meta.limitations.length > 0);
    meta.limitations.forEach(text);
    for (const row of familyRows) {
      const native = row.native_record;
      requireValue(row.source_links.length === 1 && native.source && native.source_id === native.source.id);
      const link = row.source_links[0];
      requireValue(equal(link.receipt, native.source) &&
        link.document_id === native.source.document_id &&
        link.locator.section === native.section && link.locator.page === native.page);
      registerSource(link.document_id, link.receipt);
      // A FIGURES claim may not borrow another source's identity, date or locator.
      for (const {claim} of row.numeric_claims) {
        const p = claim.provenance;
        requireValue(p.document_id === link.document_id && p.document_url === link.url &&
          p.sha256 === link.sha256 && p.published_date === link.published_date &&
          p.retrieved_at === link.retrieved_at && p.section === link.locator.section &&
          p.page === link.locator.page);
      }
    }
  }
  const asOfTime = Date.parse(report.as_of);
  for (const row of report.records) {
    if (row.family === 'policy') {
      const native = row.native_record;
      const references = [native.source, ...native.applicability.evidence,
        ...native.updates.map(u => u.source)];
      for (const ref of references) requireValue(row.source_links.some(link =>
        link.document_id === ref.document_id && link.locator.text === ref.locator));
    }
    for (const link of row.source_links) {
      requireValue(equal(sourceDocuments.get(link.document_id), link.receipt));
      for (const clock of [link.reviewed_at, link.retrieved_at]) {
        if (clock !== null) requireValue(Date.parse(clock) <= asOfTime);
      }
      if (link.published_date !== null) {
        date(link.published_date);
        const year = Number(link.published_date.slice(0, 4));
        requireValue(year <= Number(report.as_of.slice(0, 4)));
      }
    }
  }
  return report; // untouched native records, nulls, source clocks and metadata
}
