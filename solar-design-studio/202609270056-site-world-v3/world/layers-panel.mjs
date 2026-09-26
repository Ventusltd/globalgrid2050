// Layers panel. A small panel titled "Layers" with one labelled switch per optional layer, grouped by the
// groups Grid, Access, Water and ground, Planning (docs/world-lenses.md; desktop studies under Planning). For each layer switched on it shows the layer's
// status line (from loadLayers) and the attribution its data requires (web/world/data/attribution.json,
// keyed by layer id). attributionText() gives the combined small print for the bottom footer.
//
// The logic is in pure functions (panelModel, attributionLines, attributionText) so node tests can check
// it without a DOM; createLayersPanel only draws the model and wires events.

// Optional layers in display order. `sources` are the keys under attribution.json "layers" whose sources
// this layer draws on (flow is computed from the DTM, so it carries the terrain credit).
export const OPTIONAL_LAYERS = Object.freeze([
  { id: 'grid', label: 'Grid network', lens: 'grid', sources: ['grid-lines', 'substations'] },
  { id: 'ways', label: 'Roads and rail', lens: 'access', sources: ['ways'] },
  { id: 'contours', label: 'Contours', lens: 'ground', sources: ['contours'] }, // from the DTM
  { id: 'slope', label: 'Slope', lens: 'ground', sources: ['slope'] },
  { id: 'canopy', label: 'Hedges and trees', lens: 'ground', sources: ['canopy'] }, // DTM and both DSMs
  { id: 'water', label: 'Water', lens: 'ground', sources: ['rivers'] }, // rivers only: no flood zones are drawn
  { id: 'flow', label: 'Drainage', lens: 'ground', sources: ['terrain'] },
  { id: 'ground', label: 'Ground', lens: 'planning', sources: ['ground'] }, // desktop study: geology, boreholes, mining, SPZ
  { id: 'land', label: 'Land grades', lens: 'planning', sources: ['land'] },
  { id: 'buffers', label: 'Buffers', lens: 'planning', sources: ['buffers'] }, // zones round the grid, water, roads, hedges
  { id: 'visibility', label: 'Visibility', lens: 'planning', sources: ['visibility'] }, // DTM seen from OS Open Roads
  { id: 'shade', label: 'Terrain shadow', lens: 'planning', sources: ['shade'] }, // from the DTM: the terrain credit
]);

// Optional layers that never start on, whatever the page's start list (layers-ui.mjs DEFAULT_ON) says.
export const START_OFF = Object.freeze(['ground']);
export const isOptional = id => OPTIONAL_LAYERS.some(l => l.id === id);

export const LENSES = Object.freeze([
  { id: 'grid', label: 'Grid' },
  { id: 'access', label: 'Access' },
  { id: 'ground', label: 'Water and ground' },
  { id: 'planning', label: 'Planning' },
]);

const OPTIONAL_IDS = new Set(OPTIONAL_LAYERS.map(l => l.id));
// A layer is available once loaded, or when it is ready to load on first switch-on (deferred, layers.mjs).
const isLoaded = entry => !!entry && typeof entry.status === 'string' && /^(loaded|ready)/.test(entry.status);

// layers: loadLayers(...).layers, i.e. [{ id, status }]. on: Set or array of switched-on ids.
// Returns [{ id, label, layers: [{ id, label, available, on, status }] }]; a layer is available only when
// the manifest loaded it, and a layer that is not available is never on.
export function panelModel(layers = [], on = []) {
  const byId = new Map((layers || []).map(l => [l.id, l]));
  const onSet = new Set(on);
  return LENSES.map(lens => ({
    id: lens.id,
    label: lens.label,
    layers: OPTIONAL_LAYERS.filter(l => l.lens === lens.id).map(l => {
      const entry = byId.get(l.id);
      const available = isLoaded(entry);
      const isOn = available && onSet.has(l.id);
      // status: the full words (tests, the Layer details); short: what the panel shows, plain and brief.
      return { id: l.id, label: l.label, available, on: isOn, status: isOn ? statusLine(entry) : '', short: isOn ? (entry.short || '') : '' };
    }),
  }));
}

// A plain sentence from the loader's status.
export function statusLine(entry) {
  if (!entry) return 'Not in this site\'s data yet.';
  const s = String(entry.status || '').trim();
  if (!s) return 'No status given.';
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? '' : '.');
}

// Source keys (attribution.json "layers" keys) for the ids given: optional layers map through
// OPTIONAL_LAYERS, any other id (terrain, ground-grid) is used as its own key.
export function sourceKeysFor(ids) {
  const keys = [];
  for (const id of ids) {
    const def = OPTIONAL_LAYERS.find(l => l.id === id);
    for (const k of def ? def.sources : [id]) if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}

// [{ source, name, text, link }] for the ids given, de-duplicated by source id and by text, in first-seen order.
// Sources with on_screen === false are credited in ATTRIBUTION.md only and are left out. {year} is filled.
export function attributionLines(ids, attribution, year = new Date().getFullYear()) {
  const map = attribution?.layers || {};
  const sources = attribution?.sources || {};
  const seen = new Set(), out = [];
  for (const key of sourceKeysFor(ids)) {
    for (const sid of map[key] || []) {
      if (seen.has(sid)) continue;
      seen.add(sid);
      const src = sources[sid];
      if (!src || src.on_screen === false || !src.line) continue;
      const text = String(src.line).replaceAll('{year}', String(year));
      if (out.some(l => l.text === text)) continue; // e.g. OS Open Roads and OS OpenMap - Local share one OS line
      out.push({ source: sid, name: src.name || sid, text, link: src.link || '' });
    }
  }
  return out;
}

// The ids whose data is on screen: every loaded base (non-optional) layer, plus optional layers switched on.
export function shownIds(layers = [], on = []) {
  const onSet = new Set(on);
  return (layers || []).filter(l => isLoaded(l) && (!OPTIONAL_IDS.has(l.id) || onSet.has(l.id))).map(l => l.id);
}

// Combined small print for the footer: one string, lines joined with " · ".
export function attributionText(layers, on, attribution, year) {
  return attributionLines(shownIds(layers, on), attribution, year).map(l => l.text).join(' · ');
}

// Next on-set after a toggle; unknown or unavailable ids leave it unchanged.
export function toggle(on, id, layers, want) {
  const next = new Set(on);
  const entry = (layers || []).find(l => l.id === id);
  if (!OPTIONAL_IDS.has(id) || !isLoaded(entry)) return next;
  const value = typeof want === 'boolean' ? want : !next.has(id);
  if (value) next.add(id); else next.delete(id);
  return next;
}

const STYLE = `
.lp { position: fixed; top: 46px; right: 8px; width: min(300px, calc(100vw - 16px)); box-sizing: border-box;
  max-height: calc(100vh - 110px); overflow-y: auto; background: var(--panel, rgba(10,10,10,0.86));
  border: 1px solid var(--edge, #1c2c3a); border-radius: 6px; padding: 8px 12px 10px; color: var(--text, #cfe9ff); }
.lp[hidden] { display: none; }
.lp h2 { font-size: 13px; font-weight: 600; margin: 0 0 4px; }
.lp fieldset { border: 0; margin: 6px 0 0; padding: 0; }
.lp legend { color: var(--dim, #6f8ea6); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 0; }
.lp .row { border-top: 1px solid var(--edge, #1c2c3a); padding: 2px 0; }
.lp .row:first-of-type { border-top: 0; }
.lp button[role="switch"] { display: flex; align-items: center; justify-content: space-between; width: 100%;
  min-height: 40px; padding: 0; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; text-align: left; }
.lp button[role="switch"]:focus-visible { outline: 2px solid var(--line, #9cdbff); outline-offset: 2px; border-radius: 3px; }
.lp button[role="switch"][aria-disabled="true"] { color: var(--dim, #6f8ea6); cursor: default; }
.lp .track { flex: none; width: 34px; height: 18px; border-radius: 9px; border: 1px solid var(--edge, #1c2c3a);
  background: rgba(255,255,255,0.04); position: relative; margin-left: 10px; }
.lp .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%;
  background: var(--dim, #6f8ea6); transition: left 120ms; }
.lp button[aria-checked="true"] .track { border-color: var(--line, #9cdbff); }
.lp button[aria-checked="true"] .track::after { left: 18px; background: var(--line, #9cdbff); }
.lp .note, .lp .status, .lp .credit { font-size: 11px; color: var(--dim, #6f8ea6); margin: 0 0 4px; overflow-wrap: anywhere; }
.lp .credit a { color: inherit; }
@media (prefers-reduced-motion: reduce) { .lp .track::after { transition: none; } }
`;

// container: element to hold the panel. options:
//   layers       loadLayers(...).layers ([{ id, status }]); can be replaced later with update(layers)
//   onToggle     (id, on, onIds[]) called after a switch changes
//   attribution  parsed web/world/data/attribution.json
//   on           ids switched on at start (default none)
//   year         fills {year} in attribution lines (default this year)
// Returns { element, set(id, on), isOn(id), onIds(), update(layers), attributionText(), show(v), hidden(), destroy() }.
export function createLayersPanel(container, { layers = [], onToggle = () => {}, attribution = null, on = [], year } = {}) {
  if (!container || typeof container.appendChild !== 'function') throw Error('createLayersPanel needs a container element');
  const doc = container.ownerDocument || document;
  let current = layers || [];
  let onSet = new Set([...on].filter(id => OPTIONAL_IDS.has(id) && isLoaded(current.find(l => l.id === id))));

  if (!doc.getElementById('layers-panel-style')) {
    const st = doc.createElement('style');
    st.id = 'layers-panel-style';
    st.textContent = STYLE;
    doc.head.appendChild(st);
  }
  const root = doc.createElement('section');
  root.className = 'lp';
  root.id = 'layers-panel';
  root.setAttribute('aria-labelledby', 'layers-panel-title');
  container.appendChild(root);

  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function render() {
    const focusId = doc.activeElement?.dataset?.layer;
    root.replaceChildren();
    const h = el('h2', null, 'Layers');
    h.id = 'layers-panel-title';
    root.appendChild(h);
    for (const lens of panelModel(current, onSet)) {
      const fs = el('fieldset');
      fs.appendChild(el('legend', null, lens.label));
      for (const l of lens.layers) {
        const row = el('div', 'row');
        const b = el('button');
        b.type = 'button';
        b.setAttribute('role', 'switch');
        b.dataset.layer = l.id;
        b.setAttribute('aria-checked', String(l.on));
        if (!l.available) b.setAttribute('aria-disabled', 'true');
        b.appendChild(el('span', null, l.label));
        b.appendChild(el('span', 'track'));
        b.addEventListener('click', () => set(l.id));
        row.appendChild(b);
        if (!l.available) {
          const n = el('p', 'note', 'Not available for this site yet.');
          n.id = `lp-note-${l.id}`;
          b.setAttribute('aria-describedby', n.id);
          row.appendChild(n);
        }
        if (l.on) {
          const st = el('p', 'status', l.short || l.status); st.title = l.status; row.appendChild(st);
          for (const c of attributionLines([l.id], attribution, year)) {
            const p = el('p', 'credit');
            if (c.link && /^https?:/i.test(c.link)) {
              const a = el('a', null, c.text);
              a.href = c.link; a.target = '_blank'; a.rel = 'noopener';
              p.appendChild(a);
            } else p.textContent = c.text;
            row.appendChild(p);
          }
        }
        fs.appendChild(row);
      }
      root.appendChild(fs);
    }
    if (focusId) root.querySelector(`[data-layer="${focusId}"]`)?.focus();
  }

  function set(id, want) {
    const next = toggle(onSet, id, current, want);
    const changed = next.has(id) !== onSet.has(id);
    onSet = next;
    if (changed) { render(); onToggle(id, onSet.has(id), [...onSet]); }
    return onSet.has(id);
  }

  const onKey = e => { if (e.key === 'Escape' && !root.hidden) { root.hidden = true; root.dispatchEvent(new Event('close')); } };
  root.addEventListener('keydown', onKey);
  render();

  return {
    element: root,
    set,
    isOn: id => onSet.has(id),
    onIds: () => [...onSet],
    update(layers) {
      current = layers || [];
      onSet = new Set([...onSet].filter(id => isLoaded(current.find(l => l.id === id))));
      render();
    },
    attributionText: () => attributionText(current, onSet, attribution, year),
    show(v = true) { root.hidden = !v; if (v) root.querySelector('button[role="switch"]:not([aria-disabled])')?.focus(); },
    hidden: () => root.hidden,
    destroy() { root.removeEventListener('keydown', onKey); root.remove(); },
  };
}
