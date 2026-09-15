/* lens column — from ventus-grid-engine column view + v10 single-line diagram (GRAMMAR §7 column).
 * A native single column of cards on a busbar; on desktop a spider toggle fans the same cards out from the same positions. */
import { swipeable } from './table.js';   // the same tap / long-press / swipe-right gesture on a card as on a tile
let host = null, cards = new Map(), show = 'both', spider = false, sections = [];

function card(core, i, view, shell, kindWord, focus) {
  const c = document.createElement('div'); c.className = 'card' + (focus ? ' focus' : '') + (view.recipe.includes(i) ? ' recipe' : '') + (view.recipeDerived && view.recipeDerived.includes(i) ? ' derived' : '');
  const colour = kindWord ? core.REL[kindWord] : core.PAL.border; c.style.borderLeftColor = colour; c.style.background = `linear-gradient(90deg, ${core.colour(i)}14, transparent 40%)`;
  const t = document.createElement('div'); t.textContent = core.label(i); c.append(t);
  const w = document.createElement('div'); w.className = 'cw'; w.textContent = core.CLS_WORD[core.cls[i]] + (kindWord ? ` · ${kindWord}` : ''); c.append(w);
  if (focus) { const cnt = document.createElement('div'); cnt.className = 'cw'; const parts = []; if (core.cls[i] === 2 || core.cls[i] === 3) { parts.push(`depends on ${core.edgesOf(i, 1, 'out').length}`, `used by ${core.edgesOf(i, 1, 'in').length}`, `contains ${core.familiesOf(i).length}`, `found in ${core.edgesOf(i, 0, 'in').filter(x => core.cls[x] === 1).length}`); } else if (core.cls[i] === 4) { parts.push(`uses ${core.edgesOf(i, 2, 'out').length}`, `used by ${core.edgesOf(i, 2, 'in').length}`, `shared line ${core.edgesOf(i, 4, 'both').length}`); } else parts.push(`contains ${core.edgesOf(i, 0, 'out').length}`); cnt.textContent = parts.join(' · '); c.append(cnt); }
  swipeable(c, i, shell, () => { if (focus) shell.measure(i); else shell.navigate(i); });
  cards.set(i, { el: c, kind: kindWord }); return c;
}

export default {
  id: 'column',
  from: 'ventus-grid-engine column view + v10 single-line diagram',
  wants: ['block', 'group', 'family', 'category', 'repo'],
  always: [],   // every card depends on the focus; with no focus the 210 blocks are the column
  draws: ['contains', 'depends on', 'uses', 'used by', 'shared line'],
  curve: { mode: 'straight' },
  hint(core, view) { return spider ? 'The same cards fanned out: outgoing to the right, incoming to the left.' : 'One column on a busbar: what the key depends on above it, what uses it below it.'; },
  simplify(width) { return width <= 600 ? { cardH: 64, spider: false } : { cardH: 64, spider: true }; },
  camera() { return spider ? { pan: true, zoom: [0.5, 4], rotate: false } : { pan: false, zoom: null, rotate: false }; },
  overlay(core, view, h, shell) {
    host = h; h.innerHTML = ''; cards.clear(); sections = []; h.style.pointerEvents = spider ? 'none' : 'auto';
    const col = document.createElement('div'); col.className = 'col'; const R = core.range, f = view.focus;
    const seg = document.createElement('div'); seg.className = 'seg'; seg.style.pointerEvents = 'auto';
    // show / spider are lens parameters: they redraw the lens and never move the focus, the trail or history
    for (const s of ['both', 'depends on', 'used by']) { const b = document.createElement('button'); b.className = 'u-chip' + (show === s ? ' on' : ''); b.textContent = `show: ${s}`; b.addEventListener('click', () => { show = s; shell.relayout(false); }); seg.append(b); }
    if (view.params.spider) { const b = document.createElement('button'); b.className = 'u-chip' + (spider ? ' on' : ''); b.textContent = spider ? 'column' : 'spider'; b.addEventListener('click', () => { spider = !spider; shell.relayout(true); }); seg.append(b); }
    col.append(seg);
    const H = (t) => { const e = document.createElement('h4'); e.textContent = t; col.append(e); };
    if (f < 0) { H('blocks on the table, in table order'); for (let i = R.block[0]; i < R.block[1]; i++) col.append(card(core, i, view, shell, null, false)); h.append(col); return; }
    const cls = core.cls[f]; const isFam = cls === 4;
    if (core.parent[f] >= 0) { H('◂ contained in'); col.append(card(core, core.parent[f], view, shell, 'contains', false)); }
    const outK = isFam ? 2 : 1, outWord = isFam ? 'uses' : 'depends on'; const outs = [...core.edgesOf(f, outK, 'out')], ins = [...core.edgesOf(f, outK, 'in')];
    if (show !== 'used by' && (cls === 2 || cls === 3 || isFam)) { H(`→ ${outWord} (${outs.length})`); for (const t of outs) col.append(card(core, t, view, shell, outWord, false)); }
    col.append(card(core, f, view, shell, null, true));
    if (show !== 'depends on' && (cls === 2 || cls === 3 || isFam)) { H(`← used by (${ins.length})`); for (const t of ins) col.append(card(core, t, view, shell, 'used by', false)); }
    if (view.lineKey != null) { const fs = [...(core.familiesOfLine(view.lineKey) || [])].filter(x => x !== f); H(`families carrying line ${view.lineKey.toLocaleString('en-GB')} (${fs.length})`); for (const t of fs.slice(0, 40)) col.append(card(core, t, view, shell, 'shared line', false)); }
    if (isFam) { const sh = core.edgesOf(f, 4, 'both'); if (sh.length) { H(`≡ shared line (${sh.length})`); for (const t of [...sh].slice(0, 40)) col.append(card(core, t, view, shell, 'shared line', false)); } }
    if (cls === 0 || cls === 1) { const m = [...core.edgesOf(f, 0, 'out')]; H(`contains (${m.length})`); for (const t of m.slice(0, 60)) col.append(card(core, t, view, shell, 'contains', false)); }
    if (cls === 2 || cls === 3) { const m = [...core.familiesOf(f)]; H(`contains (${m.length} families)`); for (const t of m.slice(0, 40)) col.append(card(core, t, view, shell, 'contains', false)); }
    const repos = cls === 2 ? core.edgesOf(f, 0, 'in').filter(x => core.cls[x] === 1) : [];
    if (repos.length) { H(`▸ found in (${repos.length})`); for (const t of repos) col.append(card(core, t, view, shell, 'contains', false)); }
    h.append(col);
  },
  layout(core, view, out) {
    if (!host) return { bounds: [0, 0, view.w, view.h], home: { pan: [0, 0], zoom: 1, rotate: 0 } };
    const hr = host.getBoundingClientRect(), st = host.scrollTop; let maxY = 0;
    if (!spider) { for (const [i, c] of cards) { const r = c.el.getBoundingClientRect(); out[2 * i] = r.left - hr.left; out[2 * i + 1] = r.top - hr.top + st + r.height / 2; if (out[2 * i + 1] > maxY) maxY = out[2 * i + 1]; } return { bounds: [0, 0, view.w, maxY], home: { pan: [0, -st], zoom: 1, rotate: 0 } }; }
    const { w, h } = view, cx = w / 2, cy = h / 2; const groups = { focus: [], out: [], in: [], up: [], down: [] };
    for (const [i, c] of cards) { if (i === view.focus) groups.focus.push(i); else if (c.kind === 'depends on' || c.kind === 'uses') groups.out.push(i); else if (c.kind === 'used by') groups.in.push(i); else if (c.kind === 'contains' && core.cls[i] === 1) groups.down.push(i); else if (c.kind === 'contains' && (core.cls[i] === 0 || core.cls[i] === 2 || core.cls[i] === 3)) groups.up.push(i); else groups.down.push(i); }
    const fan = (list, x, y0, y1) => list.forEach((i, k) => { out[2 * i] = x; out[2 * i + 1] = y0 + (y1 - y0) * (k + 0.5) / list.length; });
    fan(groups.focus, cx, cy, cy); fan(groups.out, 0.8 * w, 40, h - 40); fan(groups.in, 0.2 * w, 40, h - 40); fan(groups.up, cx, 30, 30); fan(groups.down, cx, h - 30, h - 30);
    return { bounds: [0, 0, w, h], home: { pan: [0, 0], zoom: 1, rotate: 0 } };
  },
  edges(core, view) {
    const a = [], b = [], kind = [], cls = [], w = [], f = view.focus; if (f < 0) return { a: new Uint32Array(0), b: new Uint32Array(0), kind: new Uint8Array(0), cls: new Uint8Array(0), w: new Float32Array(0) };
    if (!spider) return { a: new Uint32Array(0), b: new Uint32Array(0), kind: new Uint8Array(0), cls: new Uint8Array(0), w: new Float32Array(0) };   // in the column the busbar geometry is the wiring
    for (const [i, c] of cards) { if (i === f) continue; const k = c.kind === 'depends on' ? 1 : c.kind === 'uses' ? 2 : c.kind === 'used by' ? 3 : c.kind === 'shared line' ? 4 : 0; if (c.kind === 'used by' || (c.kind === 'contains' && i === core.parent[f])) { a.push(i); b.push(f); } else { a.push(f); b.push(i); } kind.push(k); cls.push(2); w.push(1); }
    return { a: Uint32Array.from(a), b: Uint32Array.from(b), kind: Uint8Array.from(kind), cls: Uint8Array.from(cls), w: Float32Array.from(w) };
  },
  geometry(core, view) {
    if (spider || !view.pos) return null; const P = view.pos, g = []; let y0 = Infinity, y1 = -Infinity;
    for (const [i, c] of cards) { const x = P[2 * i], y = P[2 * i + 1]; if (x !== x) continue; y0 = Math.min(y0, y); y1 = Math.max(y1, y); const k = c.kind ? core.KIND[c.kind] : -1; const col = k >= 0 ? core.GEOM.rel + k : core.GEOM.busbar; g.push(20, y, 32, y, x - 5, y, 2, col, 2); g.push(x - 5, y - 5, x + 5, y - 5, x + 5, y + 5, 1, core.GEOM.busbar, 2); g.push(x + 5, y + 5, x - 5, y + 5, x - 5, y - 5, 1, core.GEOM.busbar, 2); }
    if (isFinite(y0)) g.push(20, y0 - 20, 20, (y0 + y1) / 2, 20, y1 + 20, 4, core.GEOM.busbar, 2);
    return Float32Array.from(g);
  },
  labels(core, view, max) { if (!spider) return new Uint32Array(0); const out = []; for (const i of cards.keys()) if (out.length < max) out.push(i); return Uint32Array.from(out); },
  scrollTo(idx, visibleH) { const c = cards.get(idx); if (c && host && !spider) { const band = visibleH || host.clientHeight; host.scrollTop = Math.max(0, c.el.offsetTop - Math.max(0, band / 2 - c.el.offsetHeight / 2)); } },
  leave() { cards.clear(); host = null; },
};
