/* lens river — from v07-flow-repos with the ribbon idea of v09-line-river (GRAMMAR §7 river).
 * Repositories → categories → blocks as bands (two stacked quadratics with horizontal / vertical tangents). */
let bands = null;   // last layout's band table for hit()

function spread(out, list, fixed, lo, hi, vertical) { const n = list.length; list.forEach((i, k) => { const v = lo + (hi - lo) * (k + 0.5) / Math.max(n, 1); out[2 * i] = vertical ? fixed : v; out[2 * i + 1] = vertical ? v : fixed; }); }

export default {
  id: 'river',
  from: 'v07-flow-repos',
  wants: ['repo', 'category', 'block', 'group', 'family'],
  always: ['repo', 'category', 'block', 'group'],
  draws: ['contains', 'depends on', 'shared line'],
  curve: { mode: 'bow', bow: 0.15 },
  hint(core, view) { return view.mobile ? 'Repositories flow down through categories into blocks; drag sideways along the block row.' : 'Repositories flow right through categories into blocks; drag up and down along the block column.'; },
  simplify(width) { return width <= 600 ? { vertical: true, nameCap: 14 } : { vertical: false, nameCap: 40 }; },
  camera(view) { return { pan: view.params.vertical ? 'x' : 'y', zoom: [0.5, 3], rotate: false }; },
  layout(core, view, out) {
    const { w, h } = view, V = !!view.params.vertical, R = core.range, repos = [], cats = [], blocks = [], groups = [];
    for (let i = R.repo[0]; i < R.repo[1]; i++) repos.push(i); for (let i = R.cat[0]; i < R.cat[1]; i++) cats.push(i); for (let i = R.block[0]; i < R.block[1]; i++) blocks.push(i); for (let i = R.group[0]; i < R.group[1]; i++) groups.push(i);
    const L = Math.max(V ? w : h, blocks.length * 14 + 40);   // the flow axis is long: page-scrolled by the camera
    if (!V) { spread(out, repos, 0.15 * w, 20, h - 20, true); spread(out, cats, 0.50 * w, 20, h - 20, true); spread(out, blocks, 0.71 * w, 20, L - 20, true); spread(out, groups, 0.90 * w, 20, L - 20, true); }
    else { spread(out, repos, 0.12 * h, 10, w - 10, false); spread(out, cats, 0.50 * h, 10, w - 10, false); spread(out, blocks, 0.85 * h, 20, L - 20, false); spread(out, groups, 0.97 * h, 20, L - 20, false); }
    if (view.open >= 0) { const fams = [...core.familiesOf(view.open)]; const bx = out[2 * view.open], by = out[2 * view.open + 1]; if (!V) spread(out, fams, 0.86 * w, by - 60, by + 60, true); else spread(out, fams, 0.95 * h, bx - 80, bx + 80, false); }
    // recipe families of other blocks get a place beside their block too, so every recipe member can be named on the river
    const perBlock = new Map(); for (const f of view.recipe) { if (core.cls[f] !== 4 || out[2 * f] === out[2 * f]) continue; const p = core.parent[f]; if (p < 0 || out[2 * p] !== out[2 * p]) continue; const k = perBlock.get(p) || 0; perBlock.set(p, k + 1); if (!V) { out[2 * f] = 0.86 * w; out[2 * f + 1] = out[2 * p + 1] + k * 12; } else { out[2 * f] = out[2 * p] + k * 12; out[2 * f + 1] = 0.95 * h; } }
    bands = { V, w, h, L };
    // the camera follows the open block along the flow axis (the row is blocks·14+40 px long), so the key and its families are on screen
    let pan = [0, 0]; if (view.open >= 0 && out[2 * view.open] === out[2 * view.open]) { const c = V ? out[2 * view.open] : out[2 * view.open + 1], span = V ? w : h; const off = Math.max(span - L, Math.min(0, span / 2 - c)); pan = V ? [off, 0] : [0, off]; }
    return { bounds: V ? [0, 0, L, h] : [0, 0, w, L], home: { pan, zoom: 1, rotate: 0 }, follow: true };
  },
  edges(core, view) {
    const a = [], b = [], kind = [], cls = [], w = [], o = view.open, f = view.focus;
    if (o >= 0 && core.cls[o] === 2) { for (const t of core.edgesOf(o, 1, 'out')) { a.push(o); b.push(t); kind.push(1); cls.push(2); w.push(1); } for (const s of core.edgesOf(o, 1, 'in')) { a.push(s); b.push(o); kind.push(3); cls.push(2); w.push(1); } }
    if (f >= 0 && core.cls[f] === 4) for (const e of core.edgeIds(f, 4, 'both')) { const E = core.edges; a.push(E.a[e]); b.push(E.b[e]); kind.push(4); cls.push(2); w.push(E.w[e]); }
    return { a: Uint32Array.from(a), b: Uint32Array.from(b), kind: Uint8Array.from(kind), cls: Uint8Array.from(cls), w: Float32Array.from(w) };
  },
  /** bands need the positions the shell just laid out; the shell passes them back through view.pos (set by layout in the shell) */
  geometry(core, view) {
    if (!bands || !view.pos) return null; const P = view.pos, { V } = bands, g = [], R = core.range, lit = view.lit;
    const S = (x0, y0, x1, y1, width, cat, cls) => { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; if (!V) g.push(x0, y0, mx, y0, mx, my, width, cat, cls, mx, my, mx, y1, x1, y1, width, cat, cls); else g.push(x0, y0, x0, my, mx, my, width, cat, cls, mx, my, x1, my, x1, y1, width, cat, cls); };
    const touched = i => (lit[i] & 3) > 0;
    for (let r = R.repo[0]; r < R.repo[1]; r++) { const perCat = new Map(); for (const bl of core.edgesOf(r, 0, 'out')) { const c = core.cat[bl]; if (c === 255) continue; perCat.set(c, (perCat.get(c) || 0) + 1); } for (const [c, n] of perCat) { const ci = R.cat[0] + c; S(P[2 * r], P[2 * r + 1], P[2 * ci], P[2 * ci + 1], Math.sqrt(n) * 2.2, c, touched(r) || touched(ci) ? 2 : 1); } }
    for (let bl = R.block[0]; bl < R.block[1]; bl++) { const c = core.cat[bl]; if (c === 255) continue; const ci = R.cat[0] + c; if (view.cat >= 0 && view.cat !== c) continue; S(P[2 * ci], P[2 * ci + 1], P[2 * bl], P[2 * bl + 1], 1.4, c, touched(bl) ? 2 : 1); }
    if (view.open >= 0) for (const fm of core.familiesOf(view.open)) S(P[2 * view.open], P[2 * view.open + 1], P[2 * fm], P[2 * fm + 1], 1, core.cat[fm] === 255 ? core.GEOM.muted : core.cat[fm], touched(fm) ? 2 : 1);
    for (const fm of view.recipe) { const p = core.parent[fm]; if (core.cls[fm] !== 4 || p === view.open || p < 0 || P[2 * fm] !== P[2 * fm] || P[2 * p] !== P[2 * p]) continue; S(P[2 * p], P[2 * p + 1], P[2 * fm], P[2 * fm + 1], 1, core.cat[fm] === 255 ? core.GEOM.muted : core.cat[fm], 2); }
    // the ribbon: a focus family's numbered lines as ticks in key order (green where shared, grey otherwise)
    const f = view.focus; const pk = f >= 0 && core.famPack ? core.famPack[f] : null;
    if (pk && P[2 * f] === P[2 * f]) { const keys = []; for (let i = pk.lineOffset; i < pk.lineOffset + pk.lineCount; i++) keys.push([core.lineKey[i], core.lineShared[i]]); keys.sort((p, q) => p[0] - q[0]); const n = Math.min(keys.length, 400), x = P[2 * f], y = P[2 * f + 1]; keys.slice(0, n).forEach(([k, sh], j) => { const t = (j + 0.5) / n; if (!V) { const yy = y + 14 + t * 0; const xx = x + 12 + t * 120; g.push(xx, y + 8, xx, y + 11, xx, y + 14, 1, sh ? core.GEOM.shared : core.GEOM.muted, 2); } else { const yy = y - 12 - t * 60; g.push(x + 8, yy, x + 11, yy, x + 14, yy, 1, sh ? core.GEOM.shared : core.GEOM.muted, 2); } }); }
    return Float32Array.from(g);
  },
  labels(core, view, max) {
    const out = []; const R = core.range;
    for (const i of view.recipe) if (out.length < max && !out.includes(i)) out.push(i);   // every recipe member is named on the river, not only the focus
    for (let i = 0; i < core.N && out.length < max; i++) if ((view.lit[i] & 15) && core.cls[i] !== 3 && (core.cls[i] !== 4 || i === view.focus) && !out.includes(i)) out.push(i);
    for (let c = R.cat[0]; c < R.cat[1] && out.length < max; c++) if (!out.includes(c)) out.push(c);
    for (let r = R.repo[0]; r < R.repo[1] && out.length < max; r++) if (!out.includes(r)) out.push(r);
    return Uint32Array.from(out);
  },
  leave() { bands = null; },
};
