// Page wiring for the Layers panel. The panel sits inside the Controls panel (no dash button of its own).
// Switching a layer on calls its setEnabled(true) when it has one and lets the substrate draw it; switching it off
// hides it (item.hidden, which the substrate skips). The footer credits exactly the data on screen: every loaded
// base layer plus the optional layers switched on (layers-panel.mjs sourceKeysFor, attribution.mjs footerText).
import { OPTIONAL_LAYERS, START_OFF, createLayersPanel, shownIds, sourceKeysFor } from './layers-panel.mjs';
import { footerText, aboutList } from './attribution.mjs';

const OPTIONAL = new Set(OPTIONAL_LAYERS.map(l => l.id));
export const DEFAULT_ON = Object.freeze(['grid']); // the grid network shows from the start, as in the live release

// The loader's items as the panel reads them: a loaded layer's own status line follows the hash check.
export function panelLayers(items) {
  return (items || []).map(it => {
    const own = it.layer && typeof it.layer.status === 'string' && it.layer.status ? it.layer.status : '';
    const loaded = !!it.layer && String(it.status).startsWith('loaded');
    return { id: it.id, status: loaded && own ? `${it.status}; ${own}` : String(it.status) };
  });
}

// { full, short } footer text for the ids on screen.
export function footerFor(items, on, attribution, year) {
  const keys = sourceKeysFor(shownIds(panelLayers(items), on));
  const byLine = new Map(); // sources that share one required line (OS Open Rivers and Roads) are credited once
  for (const a of aboutList(keys, attribution, { year })) {
    const k = `${a.line} · ${a.licence_name}`;
    byLine.set(k, [...(byLine.get(k) || []), a.name]);
  }
  const full = [...byLine].map(([k, names]) => `${names.join(', ')}: ${k}`).join(' · ');
  return { full, short: footerText(keys, attribution, { year }) };
}

// Marks each optional item hidden unless it is on, and tells layers that load on demand.
export function applyOn(items, on) {
  const set = new Set(on);
  for (const it of items || []) {
    if (!OPTIONAL.has(it.id)) continue;
    const want = set.has(it.id);
    it.hidden = !want;
    if (it.layer && typeof it.layer.setEnabled === 'function' && !!it.layer.enabled !== want) {
      try { it.layer.setEnabled(want); } catch (e) { it.layer = null; it.status = 'failed to switch and switched off: ' + e.message; }
    }
  }
}

// items: loadLayers(...).layers (live objects). host: element the panel goes in. footer: the #attribution element.
// Returns { panel, refresh() } or null when there is nothing to host it.
// onChange(ids) is called with the ids switched on, at start and after every change (e.g. to show the sun control).
export function mountLayersUi({ items, host, footer, attribution, invalidate = () => {}, on = DEFAULT_ON, year, onChange = () => {} } = {}) {
  if (!host) return null;
  const start = on.filter(id => !START_OFF.includes(id)).filter(id => panelLayers(items).some(l => l.id === id && l.status.startsWith('loaded')));
  applyOn(items, start);
  const writeFooter = ids => {
    if (!footer || !attribution) return;
    const f = footerFor(items, ids, attribution, year), full = footer.querySelector('.full'), short = footer.querySelector('.short');
    if (full) full.textContent = f.full; if (short) short.textContent = f.short;
    footer.title = f.full;
  };
  const panel = createLayersPanel(host, {
    layers: panelLayers(items), attribution, on: start, year,
    onToggle: (_id, _on, ids) => { applyOn(items, ids); writeFooter(ids); onChange(ids); invalidate(); }
  });
  panel.element.classList.add('in-help');
  panel.element.addEventListener('close', () => { panel.element.hidden = false; }); // Escape closes Controls, not this part of it
  writeFooter(panel.onIds());
  onChange(panel.onIds());
  let last = '';
  const refresh = () => { // statuses change as data streams in; redraw the panel only when they do
    const now = panelLayers(items), key = JSON.stringify(now);
    if (key === last) return;
    last = key;
    panel.update(now);
    applyOn(items, panel.onIds());
    writeFooter(panel.onIds());
  };
  return { panel, refresh };
}
