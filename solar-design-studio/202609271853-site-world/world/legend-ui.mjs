// legend-ui.mjs: the compact key. One small "Key" fold at the bottom left; opened, it lists what the last frame drew, one
// row per colour: a swatch (dashed for earth) and plain words. Built from the drawn line batches themselves, so it names
// only what is on screen. Electrical classes take their words from the one table
// (elec-style.mjs); grid lines their voltage from the grid layer's own colour table. Nothing is drawn for it: it reads
// the batches only after a frame the world drew anyway, and only while open (0 fps when still).
// Loaded just after the first frame (substrate.mjs).

import { OPTIONAL_LAYERS } from './layers-panel.mjs';
import { COLORS as GRID_COLORS } from './layers/grid.mjs';
import { ELEC } from './elec-style.mjs';

const MAX_ROWS = 14;
const BASE = { 'ground-grid': 'Ground grid, 1 m and 10 m', terrain: 'Ground', 'place-pin': 'Place found', sld: 'Single-line symbols',
  block: 'Solar block', plant: 'Plant layout', design: 'Design', piles: 'Piles', module: 'Module detail' };
// Words for the parts of the solar block and the single-line symbols, by the electrical class they belong to.
const PART = { strings: 'dc', dc: 'dc', 'pull-dc': 'dc', 'gpu-dc-cables-pulled': 'dc', ac: 'lv', 'pull-ac': 'lv', 'gpu-ac-cables-pulled': 'lv',
  lv: 'lv', mv: 'mv', 'pull-mv': 'mv', hv: 'hv', rmu: 'mv', open: 'open', earth: 'earth', glow: 'glow' };
const LABELS = new Map(OPTIONAL_LAYERS.map(l => [l.id, l.label]));
const same = (a, b) => a && b && [0, 1, 2].every(i => Math.abs(a[i] - b[i]) < 0.02);
const SKIP = /^(zone|line|minor|major|ticks|origin)$/; // parts of a key that say how it is drawn, not what it is
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const words = s =>s.replace(/[-_]+/g, ' ').replace(/ILLUSTRATIVE|HYPOTHETICAL/g, '').trim();

/** One batch's words for the key, or null for batches the key leaves out (a design's own labels say what they are). */
export function labelFor(b) {
  const key = String(b?.key || ''), parts = key.split('/'), head = parts[0];
  if (head === 'grid' && parts[1] === 'line') {
    const kv = Object.keys(GRID_COLORS).find(k => same(GRID_COLORS[k], b.color));
    return `Grid line${kv ? ', ' + kv.replace('kV', ' kV') : ''}`;
  }
  if (head === 'grid') return 'Substation';
  if (BASE[key]) return BASE[key];
  const dash = key.indexOf('-'), stem = dash > 0 ? key.slice(0, dash) : key;
  if (BASE[stem] && dash > 0 && !key.includes('/')) {                 // sld-mv, block-pull-dc, plant-tables
    const part = key.slice(dash + 1), cls = (stem === 'sld' || stem === 'block') && ELEC[PART[part]];
    if (!cls) return `${BASE[stem]}: ${words(part)}`;
    // A cable drawn grey is not energised yet (the block's build): the key says so rather than borrow the live colour.
    return same(rgbOf(cls.hex), b.color) ? cls.label : `${cls.label}, not yet energised`;
  }
  const layer = LABELS.get(head) || BASE[head] || BASE[stem];
  if (!layer) return null;
  const last = parts.length > 1 ? parts.at(-1) : '', sub = /^[a-z][a-z -]*$/i.test(last) && !SKIP.test(last) ? words(last) : '';
  return sub ? `${layer}: ${sub}` : layer;
}

/** legendRows(batches) -> [{ label, color: [r, g, b, a], dash }]: one row per label, in the order first drawn. */
export function legendRows(batches) {
  const out = new Map();
  for (const b of batches || []) {
    if (!b?.color || out.size >= MAX_ROWS) continue;
    const label = labelFor(b);
    if (label && !out.has(label)) out.set(label, { label, color: b.color, dash: /earth|bond/i.test(label) });
  }
  return [...out.values()];
}

const CSS = `#legend { position: fixed; left: 10px; bottom: calc(var(--foot, 20px) + 30px); z-index: 3; max-width: min(280px, calc(100vw - 20px));
  background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; color: var(--dim); font-size: 11px; }
#legend > summary { cursor: pointer; list-style: none; min-height: var(--btn); display: flex; align-items: center; padding: 0 10px; color: var(--text); }
#legend > summary::-webkit-details-marker { display: none; }
#legend ul { list-style: none; margin: 0; padding: 0 10px 8px; max-height: 40vh; overflow: auto; display: grid; gap: 3px; }
#legend li { display: flex; align-items: center; gap: 8px; }
#legend i { flex: none; width: 18px; height: 0; border-top: 3px solid; } #legend i.dash { border-top-style: dashed; }
body[data-panel] #legend, body[data-cmd] #legend, body:has(#sld-follow:not([hidden])) #legend { display: none; }
body.sun-on #legend { bottom: calc(var(--foot, 20px) + var(--sun-h, 0px) + 34px); } /* above the time bar */
/* Touch: right of the move pad, level with it (the plan inset sits above the pad, Up and Down on the right). */
@media (pointer: coarse) { #legend { left: 156px; bottom: calc(var(--foot, 33px) + 36px); max-width: calc(100vw - 230px); }
  body.sun-on #legend { bottom: calc(var(--foot, 33px) + var(--sun-h, 0px) + 16px); } }
@media print { #legend { display: none; } }`;

const css = c => `rgba(${c.slice(0, 3).map(v => Math.round(v * 255)).join(', ')}, ${Math.max(0.6, c[3] ?? 1)})`;

// deps: { api (substrate: batches(), hooks.after), doc }
export function mountLegend({ api, doc = document }) {
  if (!doc.getElementById('legend-style')) { const s = doc.createElement('style'); s.id = 'legend-style'; s.textContent = CSS; doc.head.append(s); }
  const box = doc.createElement('details'), sum = doc.createElement('summary'), list = doc.createElement('ul');
  box.id = 'legend'; sum.textContent = 'Key'; sum.title = 'What the colours on screen mean'; box.append(sum, list);
  doc.body.append(box);
  let shown = '', last = 0;
  const draw = () => {
    const rows = legendRows(api.batches()), key = rows.map(r => r.label + css(r.color)).join('|');
    sum.textContent = `Key · ${rows.length}`;
    if (key === shown) return;
    shown = key;
    list.replaceChildren(...rows.map(r => {
      const li = doc.createElement('li'), sw = doc.createElement('i'), t = doc.createElement('span');
      sw.style.borderTopColor = css(r.color); if (r.dash) sw.className = 'dash';
      t.textContent = r.label; li.append(sw, t); return li;
    }));
  };
  box.addEventListener('toggle', () => { if (box.open) draw(); });
  // After frames the world drew anyway: at most twice a second, and only while the key is open.
  api.hooks.after.add(now => { if (box.open && now - last > 500) { last = now; draw(); } });
  return { element: box, rows: () => legendRows(api.batches()), open: on => { box.open = on !== false; if (box.open) draw(); return legendRows(api.batches()); } };
}
