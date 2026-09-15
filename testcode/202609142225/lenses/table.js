/* lens table — from stars/table.html + v04-periodic-arrows (GRAMMAR §7 table). A DOM overlay of tiles; layout() reads the tile centres. */
let host = null, tiles = new Map(), shellRef = null, scrollKeep = 0, groupPage = 40, coreRef = null;
const parentOf = idx => (coreRef && idx >= 0 ? coreRef.parent[idx] : -1);

function tile(core, i, view, shell) {
  const r = core.rec[i], isBlock = core.cls[i] === 2;
  const t = document.createElement('div'); t.className = 'tile' + (i === view.focus || i === view.open ? ' focus' : '') + (view.recipe.includes(i) ? ' recipe' : '') + (view.recipeDerived && view.recipeDerived.includes(i) ? ' derived' : '') + ((view.lit[i] & 1) ? ' lit' : '') + (view.cat >= 0 && core.cat[i] !== view.cat && core.cat[i] !== 255 ? ' dim' : '');
  if (view.recipeDerived && view.recipeDerived.includes(i)) t.title = 'will travel: a family of this block is in the recipe';
  t.style.borderTopColor = core.colour(i);
  const n = document.createElement('span'); n.textContent = isBlock ? String(r.number) : 'group'; t.append(n);
  const s = document.createElement('b'); s.textContent = isBlock ? r.symbol : r; t.append(s);
  const tt = document.createElement('span'); tt.className = 't'; tt.textContent = isBlock ? r.title : '(not yet named)'; t.append(tt);
  const f = document.createElement('span'); f.textContent = isBlock ? (r.functions ? `${r.functions} functions` : 'data only') + (r.state === 'UNSETTLED' ? ' · not agreed' : '') : `${core.familiesOf(i).length} families`; t.append(f);
  swipeable(t, i, shell, () => shell.navigate(i));
  tiles.set(i, t); return t;
}
/** tap = navigate (or measure), long-press = measure, swipe-right ≥ 60 px = compose. touch-action: pan-y (style.css) keeps horizontal
 *  pointer moves with the tile, so the swipe completes on pointermove instead of ending in the browser's pointercancel. */
export function swipeable(node, i, shell, onTap) {
  let x0 = 0, y0 = 0, t0 = 0, press = null, done = false;
  node.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); done = false; clearTimeout(press); press = setTimeout(() => { press = null; done = true; shell.measure(i); }, 450); });
  node.addEventListener('pointermove', e => { if (done || !press) return; const dx = e.clientX - x0, dy = e.clientY - y0; if (Math.abs(dy) > 24) { clearTimeout(press); press = null; return; } if (dx > 60) { clearTimeout(press); press = null; done = true; shell.compose(i); } });
  node.addEventListener('pointerup', e => { if (done || !press) return; clearTimeout(press); press = null; const dx = e.clientX - x0; if (dx > 60) shell.compose(i); else if (performance.now() - t0 < 350 && Math.abs(dx) <= 6 && Math.abs(e.clientY - y0) <= 6) onTap(); });
  for (const ev of ['pointerleave', 'pointercancel']) node.addEventListener(ev, () => { clearTimeout(press); press = null; });
  node.addEventListener('contextmenu', e => e.preventDefault());
}

export default {
  id: 'table',
  from: 'stars/table.html + v04-periodic-arrows',
  wants: ['block', 'group', 'category', 'repo', 'family'],
  always: ['block', 'group', 'category', 'repo'],
  draws: ['depends on', 'used by'],
  curve: { mode: 'bow', bow: 0.3 },
  hint(core, view) { return 'Tiles in table order, one section per category; found-automatically blocks with fewer than 8 functions fold away.'; },
  simplify(width) { return width <= 600 ? { perRow: 4 } : {}; },
  camera() { return { pan: false, zoom: null, rotate: false }; },
  overlay(core, view, h, shell) {
    host = h; shellRef = shell; coreRef = core; scrollKeep = h.scrollTop; h.innerHTML = ''; h.style.pointerEvents = 'auto'; tiles.clear();
    const R = core.range, strip = document.createElement('div'); strip.className = 'tb-repos';
    for (let r = R.repo[0]; r < R.repo[1]; r++) { const c = document.createElement('button'); c.className = 'u-chip' + (view.focus === r ? ' on' : ''); c.textContent = core.rec[r]; c.style.borderColor = (view.lit[r] & 3) ? core.PAL.accent : ''; c.addEventListener('click', () => shell.navigate(r)); tiles.set(r, c); strip.append(c); }
    if (view.mobile) { const d = document.createElement('details'); d.className = 'tb-cat'; const s = document.createElement('summary'); s.textContent = `repositories (${R.repo[1] - R.repo[0]})`; d.append(s, strip); d.open = view.focus >= R.repo[0] && view.focus < R.repo[1]; h.append(d); }   // 31 chips are taller than the stage at 430: folded until wanted, so the tiles start at the top
    else h.append(strip);
    for (let c = R.cat[0]; c < R.cat[1]; c++) {
      const sec = document.createElement('section'); sec.className = 'tb-cat'; const hd = document.createElement('h3'); hd.textContent = core.rec[c].title; hd.style.color = core.colour(c); hd.style.borderColor = core.colour(c); hd.style.cursor = 'pointer'; hd.addEventListener('click', () => shell.navigate(c)); tiles.set(c, hd); sec.append(hd);
      const grid = document.createElement('div'); grid.className = 'tb-grid'; const fold = [];
      for (let i = R.block[0]; i < R.block[1]; i++) { if (core.cat[i] !== c - R.cat[0]) continue; const b = core.rec[i]; if (b.kind === 'auto' && (b.functions || 0) < 8 && i !== view.open && !view.recipe.includes(i) && !(view.lit[i] & 15)) fold.push(i); else grid.append(tile(core, i, view, shell)); }
      sec.append(grid);
      if (fold.length) { const d = document.createElement('details'); const s = document.createElement('summary'); s.textContent = `found automatically (${fold.length})`; d.append(s); const g2 = document.createElement('div'); g2.className = 'tb-grid'; for (const i of fold) g2.append(tile(core, i, view, shell)); d.append(g2); sec.append(d); }
      h.append(sec);
    }
    const gs = document.createElement('section'); gs.className = 'tb-cat'; const gh = document.createElement('h3'); gh.textContent = `groups off the table (${R.group[1] - R.group[0]})`; gh.style.color = core.PAL.muted; gh.style.borderColor = core.PAL.border; gs.append(gh);
    const gg = document.createElement('div'); gg.className = 'tb-grid'; const want = Math.max(groupPage, view.open >= R.group[0] && view.open < R.group[1] ? view.open - R.group[0] + 1 : 0);
    for (let i = R.group[0]; i < Math.min(R.group[1], R.group[0] + want); i++) gg.append(tile(core, i, view, shell));
    gs.append(gg); if (R.group[0] + want < R.group[1]) { const more = document.createElement('button'); more.className = 'u-chip u-more'; more.textContent = `show 40 more (${R.group[1] - R.group[0] - want} left)`; more.addEventListener('click', () => { groupPage = want + 40; scrollKeep = h.scrollTop; shell.relayout(false); }); gs.append(more); }   // paging: the lens redraws; focus, trail and history do not move
    h.append(gs);
    h.scrollTop = scrollKeep;
  },
  layout(core, view, out) {
    if (!host) return { bounds: [0, 0, view.w, view.h], home: { pan: [0, 0], zoom: 1, rotate: 0 } };
    const hr = host.getBoundingClientRect(), st = host.scrollTop; let maxY = 0;
    for (const [i, t] of tiles) { const r = t.getBoundingClientRect(); const x = r.left - hr.left + r.width / 2, y = r.top - hr.top + st + r.height / 2; out[2 * i] = x; out[2 * i + 1] = y; if (y > maxY) maxY = y; }
    if (view.open >= 0 && out[2 * view.open] === out[2 * view.open]) for (const f of core.familiesOf(view.open)) if (f === view.focus) { out[2 * f] = out[2 * view.open]; out[2 * f + 1] = out[2 * view.open + 1]; }
    return { bounds: [0, 0, view.w, maxY], home: { pan: [0, -st], zoom: 1, rotate: 0 } };
  },
  edges(core, view) {
    const a = [], b = [], kind = [], cls = [], w = [], o = view.open; let k = 0;
    if (o >= 0 && core.cls[o] === 2) { for (const t of core.edgesOf(o, 1, 'out')) { if (k++ >= 30) break; a.push(o); b.push(t); kind.push(1); cls.push(2); w.push(1); } for (const s of core.edgesOf(o, 1, 'in')) { if (k++ >= 30) break; a.push(s); b.push(o); kind.push(3); cls.push(2); w.push(1); } }
    for (const r of view.recipe) if (core.cls[r] === 2) for (const t of core.edgesOf(r, 1, 'out')) if (view.recipe.includes(t)) { a.push(r); b.push(t); kind.push(1); cls.push(2); w.push(1); }
    return { a: Uint32Array.from(a), b: Uint32Array.from(b), kind: Uint8Array.from(kind), cls: Uint8Array.from(cls), w: Float32Array.from(w) };
  },
  labels() { return new Uint32Array(0); },   // the tiles carry their own text
  /** scroll the overlay so the key's tile sits in the band a person can see (visibleH px from the stage top, above the phone sheet);
   *  a family resolves to its block or group tile, a category to its heading */
  scrollTo(idx, visibleH) {
    if (!host) return;
    let t = tiles.get(idx); if (!t) { const p = parentOf(idx); t = p >= 0 ? tiles.get(p) : null; }
    if (!t) return; const d = t.closest('details'); if (d) d.open = true;
    const band = visibleH || host.clientHeight; host.scrollTop = Math.max(0, t.offsetTop - Math.max(0, band / 2 - t.offsetHeight / 2));
  },
  leave() { tiles.clear(); host = null; },
};
