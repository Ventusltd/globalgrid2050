/* lens ring — from v08-ring-journey (GRAMMAR §7 ring). Positions only; the shell draws, picks and acts. */
const TAU = Math.PI * 2;
const pt = (cx, cy, r, a) => [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)];

export default {
  id: 'ring',
  from: 'v08-ring-journey',
  wants: ['block', 'group', 'family', 'category'],
  always: ['block', 'group', 'category'],
  draws: ['contains', 'depends on', 'uses', 'used by', 'shared line', 'random link', 'entangled'],
  curve: { mode: 'centre' },
  hint(core, view) { return view.open >= 0 ? 'Blocks on the outer ring; families of the open block on the inner ring. Drag to rotate.' : 'Blocks on the outer ring, in table order; tap one to open its families on the inner ring.'; },
  simplify(width) { return width <= 600 ? { innerCap: 60, labelCap: 12 } : { innerCap: Infinity, labelCap: 60 }; },
  camera() { return { pan: false, zoom: [0.5, 6], rotate: true }; },
  layout(core, view, out) {
    const { w, h } = view, S = Math.min(w, h), cx = w / 2, cy = h / 2, RB = 0.42 * S, RF = 0.27 * S, RC = 0.48 * S, RG = 0.47 * S;
    const [b0, b1] = core.range.block, nB = b1 - b0, step = TAU / nB;
    const put = (i, p) => { out[2 * i] = p[0]; out[2 * i + 1] = p[1]; };
    let rotate = 0;
    for (let i = b0; i < b1; i++) { const a = (i - b0 + 0.5) * step; put(i, pt(cx, cy, RB, a)); if (i === view.open) rotate = -a; }
    // categories at their sector mid-angles (blocks are contiguous per category in ordinal order)
    const first = new Map(), last = new Map(); for (let i = b0; i < b1; i++) { const c = core.cat[i]; if (!first.has(c)) first.set(c, i - b0); last.set(c, i - b0); }
    for (let c = core.range.cat[0]; c < core.range.cat[1]; c++) { const ci = c - core.range.cat[0]; if (!first.has(ci)) continue; put(c, pt(cx, cy, RC, ((first.get(ci) + last.get(ci)) / 2 + 0.5) * step)); }
    const [g0, g1] = core.range.group, gs = TAU / (g1 - g0); for (let i = g0; i < g1; i++) put(i, pt(cx, cy, RG, (i - g0 + 0.5) * gs));
    if (view.open >= 0) {
      const fams = core.familiesOf(view.open), cap = Math.min(fams.length, view.params.innerCap || Infinity), fs = TAU / Math.max(cap, 1);
      let k = 0; for (const f of fams) { if (k >= cap && f !== view.focus) continue; put(f, pt(cx, cy, RF, (k + 0.5) * fs)); k++; }
      if (view.focus >= 0 && core.cls[view.focus] === 4 && out[2 * view.focus] !== out[2 * view.focus]) put(view.focus, pt(cx, cy, RF, 0.5 * fs));
    }
    return { bounds: [cx - RC, cy - RC, cx + RC, cy + RC], home: { pan: [0, 0], zoom: 1, rotate } };
  },
  edges(core, view) {
    const a = [], b = [], kind = [], cls = [], w = [], has = i => i >= 0 && view.lit !== undefined;
    const f = view.focus, o = view.open;
    if (o >= 0) {
      for (const t of core.edgesOf(o, 1, 'out')) { a.push(o); b.push(t); kind.push(1); cls.push(2); w.push(1); }
      for (const s of core.edgesOf(o, 1, 'in')) { a.push(s); b.push(o); kind.push(3); cls.push(2); w.push(1); }
      for (const t of core.familiesOf(o)) { a.push(o); b.push(t); kind.push(0); cls.push(1); w.push(1); }
    }
    if (f >= 0 && core.cls[f] === 4) {
      for (const t of core.edgesOf(f, 2, 'out')) { a.push(f); b.push(t); kind.push(2); cls.push(2); w.push(1); }
      for (const s of core.edgesOf(f, 2, 'in')) { a.push(s); b.push(f); kind.push(3); cls.push(2); w.push(1); }
      for (const e of core.edgeIds(f, 4, 'both')) { const E = core.edges; a.push(E.a[e]); b.push(E.b[e]); kind.push(4); cls.push(2); w.push(E.w[e]); }
      for (const e of core.edgeIds(f, 5, 'both')) { const E = core.edges; a.push(E.a[e]); b.push(E.b[e]); kind.push(5); cls.push(2); w.push(E.w[e]); }
    }
    // the recipe's own wiring
    for (const r of view.recipe) if (core.cls[r] === 2) for (const t of core.edgesOf(r, 1, 'out')) if (view.recipe.includes(t)) { a.push(r); b.push(t); kind.push(1); cls.push(2); w.push(1); }
    return { a: Uint32Array.from(a), b: Uint32Array.from(b), kind: Uint8Array.from(kind), cls: Uint8Array.from(cls), w: Float32Array.from(w) };
  },
  geometry(core, view) {
    // the core disc r = 0.15·S as 24 quadratic arcs (muted), and the faint group band at 0.47·S
    const { w, h } = view, S = Math.min(w, h), cx = w / 2, cy = h / 2, g = [];
    for (const [r, wd] of [[0.15 * S, 1], [0.47 * S, 0.5]]) for (let k = 0; k < 24; k++) { const a0 = k / 24 * TAU, a1 = (k + 1) / 24 * TAU, am = (a0 + a1) / 2, rc = r / Math.cos((a1 - a0) / 2); const p0 = pt(cx, cy, r, a0), p1 = pt(cx, cy, r, a1), c = pt(cx, cy, rc, am); g.push(p0[0], p0[1], c[0], c[1], p1[0], p1[1], wd, core.GEOM.muted, 1); }
    return Float32Array.from(g);
  },
  labels(core, view, max) {
    const out = []; const cap = Math.min(max, view.params.labelCap || max);
    for (let i = 0; i < core.N && out.length < cap; i++) if ((view.lit[i] & 15) && core.cls[i] !== 1) out.push(i);
    if (view.open < 0) for (let c = core.range.cat[0]; c < core.range.cat[1] && out.length < cap; c++) out.push(c);
    return Uint32Array.from(out);
  },
};
