/** Offline browser/Node view adapter for pinned FIGURES e0deabac.
 * No extraction, association, number conversion, source fetch or publication.
 * Claims remain source assertions. This UI accepts HTTPS DNS URLs only; public
 * IP-literal URLs admitted by the Python contract are unsupported in this slice.
 */
export const MODEL_SCHEMA = 'testcode.filing-figures-view.v1';
export const CLAIM_SCHEMA = 'globalgrid2050.filing-figure.v1';
export const MAX_CLAIMS = 100;

const POWER = ['generation_power', 'storage_power', 'it_load', 'project_demand', 'secured_connection', 'energised_load', 'grid_upgrade'];
const ENERGY = ['storage_energy', 'generation_energy', 'energy_procurement'];
const SCOPES = ['issuer', 'consolidated_group', 'project', 'site', 'campus', 'phase', 'public_institution'];
const CLAIM_KEYS = ['schema', 'claim_id', 'status', 'quantity_kind', 'metric', 'value', 'scale', 'unit', 'original_unit', 'currency', 'finance_stage', 'entity', 'reporting_period', 'as_of', 'basis', 'assurance', 'provenance', 'revision'];
const LABELS = {
  finance: 'Finance', generation_power: 'Generation power', storage_power: 'Storage power',
  it_load: 'IT load', project_demand: 'Project demand', secured_connection: 'Secured connection',
  energised_load: 'Energised load', grid_upgrade: 'Grid upgrade', storage_energy: 'Storage energy',
  generation_energy: 'Generation energy', energy_procurement: 'Energy procurement',
  issuer: 'Issuer', consolidated_group: 'Consolidated group', project: 'Project', site: 'Site',
  campus: 'Campus', phase: 'Phase', public_institution: 'Public institution',
  forecast: 'Forecast', reported: 'Reported', announced: 'Announced', committed: 'Committed', disbursed: 'Disbursed',
};
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const SOURCE_DATE = /^([0-9]{4})(?:-([0-9]{2})(?:-([0-9]{2}))?)?$/;
const TIMESTAMP = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,6})?(Z|[+-]([0-9]{2}):([0-9]{2}))$/;

export class FigureModelError extends TypeError {}
function fail(field, reason) { throw new FigureModelError(`${field}: ${reason}`); }
function fullMatch(pattern, value) { return pattern.exec(value)?.[0] === value; }
function object(value, keys, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(field, 'expected a plain object');
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some(key => !keys.includes(key))) fail(field, 'unexpected or missing fields');
  for (const key of own) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(field, 'expected JSON data properties');
  }
  return value;
}
function claimsArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_CLAIMS) {
    fail('claims', 'expected an ordinary dense JSON array of at most 100 claims');
  }
  // Array.from and iteration would execute caller-controlled Symbol.iterator,
  // allowing an empty/short array to yield arbitrary rows after the length gate.
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys.some(key => typeof key !== 'string')) fail('claims', 'unexpected array properties');
  const snapshot = [];
  for (let i = 0; i < value.length; i += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail('claims', 'expected dense array data entries');
    }
    snapshot.push(descriptor.value);
  }
  // Dense entries + the built-in length exhaust the exact own-key count above;
  // no named property, symbol, accessor or custom prototype can pass through.
  return snapshot;
}
function text(value, field, max = 200) {
  if (typeof value !== 'string' || !value || Array.from(value).length > max || value.trim() !== value
      || value.startsWith('\u0085') || value.endsWith('\u0085')
      || /[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value)) fail(field, 'expected bounded nonempty text');
  return value;
}
function id(value, field) {
  if (typeof value !== 'string' || !fullMatch(ID, value)) fail(field, 'invalid identifier');
  return value;
}
function choice(value, options, field) {
  if (typeof value !== 'string' || !options.includes(value)) fail(field, 'unsupported value');
  return value;
}
function sourceDate(value, field) {
  if (typeof value !== 'string') fail(field, 'expected a source date');
  const m = SOURCE_DATE.exec(value);
  if (!m || m[0] !== value) fail(field, 'expected YYYY, YYYY-MM or YYYY-MM-DD');
  // These are calendar components only. Financial quantity strings never pass
  // through Number, parseFloat, Intl.NumberFormat or arithmetic.
  const year = Number(m[1]), month = m[2] ? Number(m[2]) : 1, day = m[3] ? Number(m[3]) : 1;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) fail(field, 'invalid calendar date');
  return `${m[1]}-${m[2] || '01'}-${m[3] || '01'}`;
}
function timestampDate(value, field) {
  if (typeof value !== 'string') fail(field, 'timestamp requires timezone');
  const m = TIMESTAMP.exec(value);
  if (!m || m[0] !== value) fail(field, 'timestamp requires seconds and timezone');
  const day = sourceDate(value.slice(0, 10), field);
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59
      || (m[7] !== 'Z' && (Number(m[8]) > 23 || Number(m[9]) > 59))) fail(field, 'invalid timestamp');
  // Python contract compares the retrieval calendar date in its supplied offset.
  // Do not silently normalize to UTC and move a source's day boundary.
  return day;
}
function url(value, field) {
  text(value, field, 2048);
  if (!/^[\x21-\x7e]+$/.test(value) || value.includes('\\')) fail(field, 'expected ASCII HTTPS URL');
  const authority = /^https:\/\/([^/?#]+)/.exec(value)?.[1];
  if (!authority || authority.includes('@')) fail(field, 'expected HTTPS URL without credentials');
  const parts = /^([^:]+)(?::(443))?$/.exec(authority);
  if (!parts) fail(field, 'IP literals and custom ports are unsupported');
  const hostname = parts[1].toLowerCase();
  const labels = hostname.split('.');
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
      || !/^[a-z]{2,63}$/.test(labels.at(-1))
      || ['localhost', 'local', 'internal', 'test', 'invalid'].includes(labels.at(-1))) {
    fail(field, 'expected a public DNS-form hostname');
  }
  let parsed;
  try { parsed = new URL(value); } catch { fail(field, 'invalid URL'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== hostname || parsed.username || parsed.password) fail(field, 'ambiguous URL');
  return value;
}

function validateClaim(claim, entityId) {
  const c = object(claim, CLAIM_KEYS, 'claim');
  choice(c.schema, [CLAIM_SCHEMA], 'schema');
  choice(c.status, ['machine-provisional'], 'status');
  id(c.claim_id, 'claim_id');
  const kind = choice(c.quantity_kind, [...POWER, ...ENERGY, 'finance'], 'quantity_kind');
  text(c.metric, 'metric');
  if (typeof c.value !== 'string' || c.value.length > 100 || !fullMatch(DECIMAL, c.value)) fail('value', 'expected exact decimal string');
  if (kind !== 'finance' && c.value.startsWith('-') && /[1-9]/.test(c.value)) fail('value', 'negative power/energy');
  choice(c.scale, ['1', '1e3', '1e6', '1e9', '1e12'], 'scale');
  text(c.original_unit, 'original_unit', 100);
  if (kind === 'finance') {
    choice(c.unit, ['currency'], 'unit');
    if (typeof c.currency !== 'string' || !fullMatch(/^[A-Z]{3}$/, c.currency)) fail('currency', 'explicit currency label required');
    choice(c.finance_stage, ['announced', 'committed', 'disbursed', 'reported'], 'finance_stage');
  } else {
    choice(c.unit, POWER.includes(kind) ? ['W', 'kW', 'MW', 'GW'] : ['Wh', 'kWh', 'MWh', 'GWh', 'TWh'], 'unit');
    if (c.currency !== null || c.finance_stage !== null) fail('currency/finance_stage', 'must be null for power/energy');
  }
  const entity = object(c.entity, ['scope', 'id', 'consolidation_group_id', 'identity_evidence_url'], 'entity');
  choice(entity.scope, SCOPES, 'entity.scope');
  id(entity.id, 'entity.id');
  if (entity.id !== entityId) fail('entity.id', 'does not match selected entity');
  url(entity.identity_evidence_url, 'entity.identity_evidence_url');
  if (entity.consolidation_group_id !== null) id(entity.consolidation_group_id, 'entity.consolidation_group_id');
  if (entity.scope === 'consolidated_group' && entity.consolidation_group_id !== entity.id) fail('entity.consolidation_group_id', 'group must retain own identity');
  choice(c.basis, ['reported', 'forecast'], 'basis');
  choice(c.assurance, ['audited', 'unaudited', 'unknown'], 'assurance');
  if (c.basis === 'forecast' && c.assurance === 'audited') fail('assurance', 'forecast cannot be audited actual');
  const provenance = object(c.provenance, ['document_id', 'document_url', 'sha256', 'page', 'section', 'published_date', 'retrieved_at'], 'provenance');
  id(provenance.document_id, 'provenance.document_id');
  url(provenance.document_url, 'provenance.document_url');
  if (typeof provenance.sha256 !== 'string' || !fullMatch(/^[a-f0-9]{64}$/, provenance.sha256)) fail('provenance.sha256', 'source byte hash required');
  for (const key of ['page', 'section']) if (provenance[key] !== null) text(provenance[key], `provenance.${key}`);
  if (provenance.page === null && provenance.section === null) fail('provenance', 'page or section required');
  const retrievedDate = timestampDate(provenance.retrieved_at, 'provenance.retrieved_at');
  if (provenance.published_date !== null && sourceDate(provenance.published_date, 'provenance.published_date') > retrievedDate) fail('provenance.published_date', 'publication follows retrieval');
  if (c.as_of !== null && sourceDate(c.as_of, 'as_of') > retrievedDate && c.basis !== 'forecast') fail('as_of', 'future date requires forecast');
  if (c.reporting_period !== null) {
    const period = object(c.reporting_period, ['start', 'end'], 'reporting_period');
    const start = sourceDate(period.start, 'reporting_period.start'), end = sourceDate(period.end, 'reporting_period.end');
    if (period.start.length !== period.end.length || end < start) fail('reporting_period', 'ordered equal-precision bounds required');
    if (c.basis === 'reported' && end > retrievedDate) fail('reporting_period', 'future period requires forecast');
  } else if (c.as_of === null) fail('reporting_period/as_of', 'source temporal basis required');
  const revision = object(c.revision, ['id', 'supersedes_claim_id', 'restated'], 'revision');
  id(revision.id, 'revision.id');
  if (revision.supersedes_claim_id !== null) {
    id(revision.supersedes_claim_id, 'revision.supersedes_claim_id');
    if (revision.supersedes_claim_id === c.claim_id) fail('revision', 'claim cannot supersede itself');
  }
  if (typeof revision.restated !== 'boolean' || (revision.restated && revision.supersedes_claim_id === null)) fail('revision', 'restatement requires an earlier claim');
  return JSON.parse(JSON.stringify(c));
}

function row(claim) {
  const p = claim.provenance, r = claim.revision;
  const period = claim.reporting_period;
  const amount = `${claim.value}${claim.scale === '1' ? '' : ` × ${claim.scale}`} ${claim.currency || claim.unit}`;
  return { id: claim.claim_id, claim, display: {
    amount, quantityKind: LABELS[claim.quantity_kind], basis: LABELS[claim.basis],
    assurance: claim.assurance === 'unknown' ? 'Unknown' : `${claim.assurance === 'audited' ? 'Audited' : 'Unaudited'} (source assertion)`,
    financeStage: claim.finance_stage === null ? 'Not applicable' : LABELS[claim.finance_stage],
    entityScope: LABELS[claim.entity.scope],
    period: period === null ? 'Unknown' : (period.start === period.end ? period.start : `${period.start} to ${period.end}`),
    asOf: claim.as_of ?? 'Unknown',
    sourceLocator: [p.page === null ? null : `Page ${p.page}`, p.section].filter(value => value !== null).join(' · '),
    publishedDate: p.published_date ?? 'Unknown', retrievedAt: p.retrieved_at,
    revision: `${r.id} · ${r.restated ? 'Restated' : 'Restatement not asserted'}${r.supersedes_claim_id === null ? '' : ` · Supersedes ${r.supersedes_claim_id}`}`,
    status: 'Provisional; not independently verified',
  } };
}

/** Validate the entire input before returning any rows; caller clears stale UI on error. */
export function buildViewModel(input) {
  object(input, ['entityId', 'claims', 'state'], 'input');
  id(input.entityId, 'entityId');
  choice(input.state, ['available', 'unknown', 'unavailable'], 'state');
  const claims = claimsArray(input.claims);
  if (input.state !== 'available' && claims.length !== 0) fail('claims', 'nonavailable states require empty claims');
  const ids = new Set();
  const rows = [];
  for (let i = 0; i < claims.length; i += 1) {
    const validated = validateClaim(claims[i], input.entityId);
    if (ids.has(validated.claim_id)) fail('claim_id', 'duplicate claim');
    ids.add(validated.claim_id);
    rows.push(row(validated));
  }
  const messages = {
    available: rows.length ? 'Source figures are provisional. Each keeps its own unit, scope and period; no total is calculated.' : 'No figures have been supplied.',
    unknown: 'No source figures are known for this entity. Unknown does not mean zero.',
    unavailable: 'Source figures are currently unavailable. This does not mean zero.',
  };
  return {
    schema: MODEL_SCHEMA, entityId: input.entityId, state: input.state,
    stateLabel: { available: rows.length ? 'Figures supplied' : 'No figures supplied', unknown: 'Figures unknown', unavailable: 'Figures unavailable' }[input.state],
    message: messages[input.state], rows, publishable: false,
  };
}
