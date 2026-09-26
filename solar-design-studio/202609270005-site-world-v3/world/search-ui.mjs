// Search panel: "Find a place". A small box over the world that finds a REPD project (or a typed
// "lat, lon") and hands the chosen point to the caller. The logic is pure functions at the top,
// tested without a DOM; createSearchPanel at the bottom only wires them to elements.
// The project index is large, so it is loaded the first time the panel is opened, never before.

import { search } from './search.mjs';

// The on-screen credit for the search layer, as worded in data/attribution.json (sources.repd.line).
// tests/search-ui.test.mjs checks this copy against the file, so the two cannot drift apart.
export const REPD_CREDIT = Object.freeze({
  text: 'Contains public sector information licensed under the Open Government Licence v3.0. Source: DESNZ Renewable Energy Planning Database, via GridAtlas.',
  link: 'https://www.gov.uk/government/publications/renewable-energy-planning-database-monthly-extract'
});

// What the panel says after a jump, when the place has no staged ground.
export const NO_TERRAIN = 'No terrain tiles here yet. The ground is shown flat until terrain is fetched for this place.';

const TECH = {
  solar: 'Solar', wind: 'Wind', bess: 'Battery storage', battery: 'Battery storage', hydro: 'Hydro',
  biomass: 'Biomass', 'energy from waste': 'Energy from waste', efw: 'Energy from waste', 'anaerobic digestion': 'Anaerobic digestion',
  'offshore wind': 'Offshore wind', 'onshore wind': 'Onshore wind', tidal: 'Tidal', geothermal: 'Geothermal', 'landfill gas': 'Landfill gas'
};

// The credit lines for the given attribution.json object: every on-screen source under the
// "search" layer, de-duplicated. Falls back to REPD_CREDIT when no attribution data is given.
export function creditsFor(attribution, layer = 'search') {
  const ids = attribution?.layers?.[layer];
  if (!Array.isArray(ids)) return [REPD_CREDIT];
  const out = [];
  for (const id of new Set(ids)) {
    const s = attribution.sources?.[id];
    if (s && s.on_screen !== false && s.line) out.push({ text: s.line, link: s.link ?? null });
  }
  return out;
}

// "49.9 MW", "650 kW", "1.2 GW"; empty when the capacity is unknown.
export function formatCapacity(mw) {
  if (mw == null || mw === '' || !Number.isFinite(Number(mw))) return '';
  const v = Number(mw);
  if (v >= 1000) return `${trim(v / 1000)} GW`;
  if (v > 0 && v < 1) return `${trim(v * 1000)} kW`;
  return `${trim(v)} MW`;
}
const trim = (v) => String(Number(v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)));

export function formatTechnology(t) {
  if (t == null || t === '') return '';
  const k = String(t).trim().toLowerCase();
  return TECH[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

// search() output to display rows. Each row: { key, title, detail, choice: { lat, lon, label } }.
// A coordinate query gives one row. Projects without a usable point are left out.
export function toRows(result) {
  if (!result) return [];
  if (result.kind === 'coords') {
    const label = `${result.lat.toFixed(5)}, ${result.lon.toFixed(5)}`;
    return [{ key: 'coords', title: label, detail: 'Latitude, longitude', choice: { lat: result.lat, lon: result.lon, label } }];
  }
  return (result.results ?? [])
    .filter((r) => r.lat != null && r.lon != null && r.lat !== '' && r.lon !== '' && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)))
    .map((r) => {
      const title = r.name ? String(r.name) : `REPD ${r.repd_ref}`;
      const detail = [formatCapacity(r.capacity_mw), formatTechnology(r.technology), r.county ?? ''].filter(Boolean).join(' · ');
      return { key: `repd-${r.repd_ref}`, title, detail, choice: { lat: Number(r.lat), lon: Number(r.lon), label: title } };
    });
}

// "12 of 340 projects", "1 project", "No projects match", "" (no query).
export function summaryText(result, shown) {
  if (!result) return '';
  if (result.kind === 'coords') return 'Go to this point';
  if (!result.total) return 'No projects match';
  const noun = result.total === 1 ? 'project' : 'projects';
  return shown < result.total ? `${shown} of ${result.total} ${noun}` : `${result.total} ${noun}`;
}

// Arrow keys move the highlighted row, wrapping; Home and End jump. -1 means nothing highlighted.
// Returns the new index, or null when the key is not a selection key.
export function moveSelection(index, count, key) {
  if (count <= 0) return key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End' ? -1 : null;
  switch (key) {
    case 'ArrowDown': return index < 0 || index >= count - 1 ? 0 : index + 1;
    case 'ArrowUp': return index <= 0 ? count - 1 : index - 1;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}

// Which row Enter chooses: the highlighted one, or the first when nothing is highlighted.
export function rowForEnter(rows, index) {
  if (!rows.length) return null;
  return rows[index >= 0 && index < rows.length ? index : 0];
}

// Trailing-edge debounce. Clock functions are injectable so tests need no real time.
export function debounce(fn, ms, clock = { set: (f, t) => setTimeout(f, t), clear: id => clearTimeout(id) }) { // bound: a bare setTimeout called as clock.set throws 'Illegal invocation' in browsers
  let id = null;
  const d = (...args) => {
    if (id !== null) clock.clear(id);
    id = clock.set(() => { id = null; fn(...args); }, ms);
  };
  d.cancel = () => { if (id !== null) clock.clear(id); id = null; };
  d.flush = (...args) => { d.cancel(); fn(...args); };
  return d;
}

// The note to show after choosing a place. hasTerrain(lat, lon) is the caller's answer to
// "is ground staged here?"; without it we cannot know, so we say so plainly.
export function arrivalNote(choice, hasTerrain) {
  const known = typeof hasTerrain === 'function' ? Boolean(hasTerrain(choice.lat, choice.lon)) : false;
  return known ? '' : NO_TERRAIN;
}

// One lookup: query text in, everything the list needs out. Pure.
export function runQuery(index, text, limit = 12) {
  const q = String(text ?? '').trim();
  if (!q) return { rows: [], summary: '', credits: false };
  const result = search(index, q, limit);
  const rows = toRows(result);
  return { rows, summary: summaryText(result, rows.length), credits: result.kind === 'projects' && rows.length > 0 };
}

// ---- DOM wiring ----------------------------------------------------------------------------

// Uses world.html's colour tokens, with fallbacks. Rows are 44 px tall for touch.
const STYLE = `
.find-panel { position: fixed; top: 46px; right: 8px; width: min(360px, calc(100vw - 16px)); box-sizing: border-box;
  background: var(--panel, rgba(10,10,10,.9)); border: 1px solid var(--edge, #1c2c3a); border-radius: 6px; padding: 8px 10px; z-index: 5; }
.find-panel[hidden] { display: none; }
.find-panel label { display: block; color: var(--dim, #6f8ea6); margin-bottom: 4px; }
.find-panel input { width: 100%; box-sizing: border-box; height: 34px; padding: 0 8px; font: inherit; font-size: 16px;
  color: var(--text, #cfe9ff); background: #000; border: 1px solid var(--edge, #1c2c3a); border-radius: 4px; }
.find-panel input:focus { outline: none; border-color: var(--line, #9cdbff); }
.find-status { color: var(--dim, #6f8ea6); font-size: 11px; min-height: 16px; margin: 4px 0; }
.find-list { list-style: none; margin: 0; padding: 0; max-height: min(50vh, 400px); overflow-y: auto; }
.find-row { min-height: 44px; box-sizing: border-box; padding: 5px 6px; border-radius: 4px; cursor: pointer;
  display: flex; flex-direction: column; justify-content: center; }
.find-row[aria-selected="true"], .find-row:hover { background: rgba(156, 219, 255, 0.10); }
.find-name { color: var(--text, #cfe9ff); } .find-detail { color: var(--dim, #6f8ea6); font-size: 11px; }
.find-credit { margin: 6px 0 0; font-size: 10px; line-height: 1.3; } .find-credit[hidden] { display: none; }
.find-credit a { color: var(--dim, #6f8ea6); }
`;

// container: element the panel is built inside. loadIndex(): Promise of the projects.json object,
// called once, on first open. onChoose({ lat, lon, label }): the caller moves the world there.
// Options: attribution (the attribution.json object; defaults to the REPD line), hasTerrain(lat, lon),
// limit (rows shown), delay (debounce ms). Returns { open, close, toggle, isOpen, element, destroy }.
let panelCount = 0;

export function createSearchPanel(container, { loadIndex, onChoose, attribution = null, hasTerrain = null, limit = 12, delay = 120 } = {}) {
  if (typeof loadIndex !== 'function') throw Error('createSearchPanel needs loadIndex');
  if (typeof onChoose !== 'function') throw Error('createSearchPanel needs onChoose');
  const doc = container.ownerDocument;
  const el = (tag, props = {}, attrs = {}) => {
    const e = doc.createElement(tag);
    Object.assign(e, props);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const uid = `find-${++panelCount}`; // a counter, not a random draw: ids stay the same on every run
  if (doc.head && !doc.getElementById?.('find-panel-style')) doc.head.appendChild(el('style', { id: 'find-panel-style', textContent: STYLE }));

  const root = el('section', { className: 'find-panel', hidden: true }, { 'aria-label': 'Find a place' });
  const label = el('label', { textContent: 'Find a place', htmlFor: `${uid}-q` });
  const input = el('input', { type: 'search', id: `${uid}-q`, autocomplete: 'off', spellcheck: false,
    placeholder: 'Project, postcode, county or lat, lon' },
  { role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': `${uid}-list`, enterkeyhint: 'go' });
  const status = el('div', { className: 'find-status' }, { role: 'status', 'aria-live': 'polite' });
  const list = el('ul', { id: `${uid}-list`, className: 'find-list' }, { role: 'listbox', 'aria-label': 'Places found' });
  const credit = el('p', { className: 'find-credit', hidden: true });
  for (const c of creditsFor(attribution)) {
    const a = el('a', { textContent: c.text, href: c.link ?? '#', target: '_blank', rel: 'noopener' });
    credit.appendChild(a);
  }
  root.append(label, input, status, list, credit);
  container.appendChild(root);

  let index = null, loading = null, rows = [], sel = -1, open = false, shown = null; // shown: the text the list was built for

  const ensureIndex = () => {
    if (index || loading) return loading;
    status.textContent = 'Loading project list...';
    loading = Promise.resolve().then(loadIndex).then((ix) => {
      index = ix; status.textContent = '';
      if (input.value.trim()) render(input.value);
    }, (e) => {
      loading = null; status.textContent = `Project list could not be loaded: ${e?.message ?? e}`;
    });
    return loading;
  };

  const highlight = (i) => {
    sel = i;
    list.childNodes.forEach((li, k) => li.setAttribute('aria-selected', String(k === sel)));
    if (sel >= 0) { input.setAttribute('aria-activedescendant', `${uid}-o${sel}`); list.childNodes[sel]?.scrollIntoView?.({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };

  const choose = (row) => {
    if (!row) return;
    status.textContent = arrivalNote(row.choice, hasTerrain) || `Going to ${row.choice.label}`;
    list.replaceChildren(); rows = []; shown = null; credit.hidden = true; input.setAttribute('aria-expanded', 'false');
    onChoose({ ...row.choice });
  };

  function render(text) {
    if (!index && !parseLike(text)) { ensureIndex(); return; }
    const out = runQuery(index, text, limit);
    shown = text;
    rows = out.rows;
    list.replaceChildren(...rows.map((r, i) => {
      const li = el('li', { id: `${uid}-o${i}`, className: 'find-row' }, { role: 'option', 'aria-selected': 'false' });
      li.append(el('span', { className: 'find-name', textContent: r.title }), el('span', { className: 'find-detail', textContent: r.detail }));
      li.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the box
      li.addEventListener('click', () => choose(r));
      return li;
    }));
    status.textContent = out.summary;
    credit.hidden = !out.credits;
    input.setAttribute('aria-expanded', String(rows.length > 0));
    highlight(-1);
  }
  const parseLike = (text) => runQuery(null, text).rows.length > 0; // a typed point needs no index

  const later = debounce(render, delay);
  input.addEventListener('input', () => later(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (input.value !== shown) later.flush(input.value); else later.cancel(); choose(rowForEnter(rows, sel)); return; }
    const next = moveSelection(sel, rows.length, e.key);
    if (next !== null) { e.preventDefault(); highlight(next); }
  });

  function openPanel() {
    if (open) return;
    open = true; root.hidden = false; ensureIndex(); input.focus?.(); input.select?.();
  }
  function close() { open = false; root.hidden = true; later.cancel(); }

  return {
    element: root,
    open: openPanel,
    close,
    toggle: () => (open ? close() : openPanel()),
    isOpen: () => open,
    destroy: () => { close(); root.remove(); }
  };
}

export default createSearchPanel;
