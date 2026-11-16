/** Inline, provisional filing figures. No extraction or publication authority. */
import { buildViewModel } from './model.mjs';

const ROOT_ATTRIBUTE = 'data-filings-figures-root';

function element(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function knownText(value) {
  return value === null || value === undefined || value === '' ? 'Unknown' : String(value);
}

function sourceUrl(value) {
  if (typeof value !== 'string' || /[\s\\]/u.test(value) || !/^[\x21-\x7e]+$/.test(value)) {
    throw new TypeError('Unsupported source link');
  }
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new TypeError('Unsupported source link');
  }
  // The model validates the source URL too. Keep a separate conservative DOM
  // boundary: no local/literal hosts or browser numeric IPv4 aliases.
  const labels = url.hostname.split('.');
  if (labels.length < 2 || !/^[a-z]{2,63}$/i.test(labels.at(-1))
      || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname)
      || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) {
    throw new TypeError('Unsupported source link');
  }
  return url;
}

function addField(document, list, label, value, attribute) {
  const term = element(document, 'dt', 'ff-field-label', label);
  const definition = element(document, 'dd', 'ff-field-value', knownText(value));
  if (attribute) definition.setAttribute(attribute, '');
  list.append(term, definition);
}

function renderRow(document, row) {
  const item = element(document, 'li', 'ff-claim');
  item.setAttribute('data-figure-claim', row.id);
  const metric = knownText(row.claim.metric);
  item.append(element(document, 'p', 'ff-metric', metric));
  const amount = element(document, 'p', 'ff-amount', knownText(row.display.amount));
  amount.setAttribute('data-figure-value', '');
  item.append(amount);
  const original = element(document, 'p', 'ff-original-unit');
  original.append(element(document, 'span', 'ff-inline-label', 'Original unit: '));
  original.append(element(document, 'span', '', knownText(row.claim.original_unit)));
  item.append(original);

  const status = element(document, 'p', 'ff-status', 'Provisional · requires independent review');
  status.setAttribute('data-figure-status', 'provisional');
  item.append(status);
  const fields = element(document, 'dl', 'ff-fields');
  addField(document, fields, 'Quantity', row.display.quantityKind);
  addField(document, fields, 'Scope', row.display.entityScope);
  addField(document, fields, 'Entity', row.claim.entity.id);
  addField(document, fields, 'Group overlap', row.claim.entity.consolidation_group_id);
  addField(document, fields, 'Basis', row.display.basis);
  addField(document, fields, 'Assurance', row.display.assurance);
  addField(document, fields, 'Finance stage', row.display.financeStage);
  addField(document, fields, 'Reporting period', row.display.period);
  addField(document, fields, 'As of', row.display.asOf);
  addField(document, fields, 'Published', row.display.publishedDate);
  addField(document, fields, 'Retrieved', row.display.retrievedAt);
  addField(document, fields, 'Source location', row.display.sourceLocator);
  addField(document, fields, 'Revision', row.display.revision, 'data-figure-revision');
  item.append(fields);

  const source = sourceUrl(row.claim.provenance.document_url);
  const link = element(document, 'a', 'ff-source-link', 'Source document');
  link.href = source.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  link.setAttribute('data-figure-link', '');
  link.setAttribute('aria-label', `Source document for ${metric} (opens in a new tab)`);
  const sourceLine = element(document, 'p', 'ff-source');
  sourceLine.append(link, element(document, 'span', 'ff-source-host', ` · ${source.hostname}`));
  item.append(sourceLine);
  return item;
}

function detailsRoot(document, view, wasOpen) {
  const root = element(document, 'details', 'filings-figures');
  root.setAttribute(ROOT_ATTRIBUTE, '');
  root.setAttribute('data-state', view.state);
  root.setAttribute('data-entity-id', view.entityId ?? '');
  root.open = Boolean(wasOpen);
  const summary = element(document, 'summary', 'ff-summary');
  summary.append(element(document, 'span', 'ff-summary-title', 'Filing figures'));
  const badge = element(document, 'span', 'ff-badge',
    view.state === 'available' && view.rows.length ? 'Provisional' : knownText(view.stateLabel));
  badge.setAttribute('data-figure-state-badge', '');
  summary.append(badge);
  root.append(summary);

  const body = element(document, 'div', 'ff-content');
  if (!view.rows.length) {
    const empty = element(document, 'p', 'ff-empty', knownText(view.message));
    empty.setAttribute('data-figure-empty', '');
    empty.setAttribute('role', 'status');
    body.append(empty);
  } else {
    const note = element(document, 'p', 'ff-notice',
      'Source assertions for this entity. Figures remain provisional; source rights and independent review are still required.');
    body.append(note);
    const list = element(document, 'ul', 'ff-claims');
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Provisional filing figures');
    for (const row of view.rows) list.append(renderRow(document, row));
    body.append(list);
  }
  root.append(body);
  return root;
}

/**
 * Replace this adapter's direct child only; host MAP/export controls survive.
 * Returns the new details Element, or null for an unusable host container.
 * Invalid input clears any prior figures and displays an unavailable state.
 */
export function renderFigures(container, input) {
  if (!container || container.nodeType !== 1 || !container.ownerDocument
      || typeof container.append !== 'function') return null;
  const document = container.ownerDocument;
  const prior = Array.from(container.children).filter(node => node.hasAttribute(ROOT_ATTRIBUTE));
  let root;
  try {
    const view = buildViewModel(input);
    const wasOpen = prior.some(node => node.open && node.getAttribute('data-entity-id') === view.entityId);
    root = detailsRoot(document, view, wasOpen);
  } catch {
    // Never leave stale figures from the previously selected entity in view,
    // expose untrusted exception values, or label invalid input as empty data.
    root = detailsRoot(document, {
      entityId: '', state: 'unavailable', stateLabel: 'Unavailable', rows: [],
      message: 'Figures are unavailable because the supplied data could not be validated.',
    }, prior.some(node => node.open));
  }
  if (prior.length) {
    prior[0].replaceWith(root);
    for (const duplicate of prior.slice(1)) duplicate.remove();
  } else {
    container.append(root);
  }
  return root;
}
