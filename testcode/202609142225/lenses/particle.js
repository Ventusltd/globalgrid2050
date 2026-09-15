/* lens particle — from v03-particle-universe (GRAMMAR §7 particle). Stars in 12 sectors; families orbit the open block (u_orbit). */
const TAU = Math.PI * 2;

export default {
  id: 'particle',
  from: 'v03-particle-universe',
  wants: ['block', 'group', 'family', 'category', 'repo'],
  always: ['block', 'group', 'category', 'repo'],
  draws: ['depends on', 'uses', 'used by', 'shared line', 'random link', 'entangled'],
  curve: { mode: 'bow', bow: 0.2 },
  hint(core, view) { return view.open >= 0 ? 'Every block is a star in its category sector; the families of the open block orbit it.' : 'Every block is a star in its category sector; repositories sit on the rim. Tap a star to open it.'; },
  simplify(width) { return width <= 600 ? { rings: 2, tooltip: false } : { rings: 4, tooltip: true }; },
  camera() { return { pan: true, zoom: [0.5, 6], rotate: false }; },
  layout(core, view, out) {
    const { w, h } = view, S = Math.min(w, h), cx = w / 2, cy = h / 2, nc = core.range.cat[1] - core.range.cat[0], span = TAU / nc;
    const put = (i, r, a) => { out[2 * i] = cx + r * Math.cos(a); out[2 * i + 1] = cy + r * Math.sin(a); };
    const [b0, b1] = core.range.block; const perCat = new Map(); for (let i = b0; i < b1; i++) { const c = core.cat[i]; if (!perCat.has(c)) perCat.set(c, []); perCat.get(c).push(i); }
    for (const [c, list] of perCat) { const a0 = c * span - Math.PI / 2, n = list.length; list.forEach((i, k) => { const r = (0.12 + 0.36 * Math.pow((k + 1) / (n + 1), 0.8)) * 1.05 * S; const a = a0 + span * (0.15 + 0.7 * ((k * 0.618) % 1)); put(i, r, a); }); }
    for (let c = core.range.cat[0]; c < core.range.cat[1]; c++) put(c, 0.05 * S, (c - core.range.cat[0] + 0.5) * span - Math.PI / 2);
    const [g0, g1] = core.range.group; for (let i = g0; i < g1; i++) put(i, 0.52 * S, (i - g0 + 0.5) * TAU / (g1 - g0) - Math.PI / 2);
    const [r0, r1] = core.range.repo; for (let i = r0; i < r1; i++) put(i, 0.58 * S, (i - r0 + 0.5) * TAU / (r1 - r0) - Math.PI / 2);
    let orbit = null;
    if (view.open >= 0 && out[2 * view.open] === out[2 * view.open]) { for (const f of core.familiesOf(view.open)) { out[2 * f] = out[2 * view.open]; out[2 * f + 1] = out[2 * view.open + 1]; } orbit = { parent: view.open, rings: view.params.rings || 4 }; }
    else if (view.open >= 0) { for (const f of core.familiesOf(view.open)) { out[2 * f] = out[2 * view.open]; out[2 * f + 1] = out[2 * view.open + 1]; } orbit = { parent: view.open, rings: view.params.rings || 4 }; }
    return { bounds: [cx - 0.6 * S, cy - 0.6 * S, cx + 0.6 * S, cy + 0.6 * S], home: { pan: [0, 0], zoom: 1, rotate: 0 }, orbit };
  },
  edges(core, view) {
    const a = [], b = [], kind = [], cls = [], w = [], o = view.open, f = view.focus, E = core.edges;
    if (o >= 0) {
      for (const t of core.edgesOf(o, 1, 'out')) { a.push(o); b.push(t); kind.push(1); cls.push(2); w.push(1); }
      for (const s of core.edgesOf(o, 1, 'in')) { a.push(s); b.push(o); kind.push(3); cls.push(2); w.push(1); }
    }
    if (f >= 0 && core.cls[f] === 4) {
      // uses threads cross to the star that holds the used family
      for (const t of core.edgesOf(f, 2, 'out')) { const p = core.parent[t]; if (p >= 0 && p !== o) { a.push(f); b.push(p); kind.push(2); cls.push(2); w.push(1); } else if (p === o) { a.push(f); b.push(t); kind.push(2); cls.push(2); w.push(1); } }
      for (const s of core.edgesOf(f, 2, 'in')) { const p = core.parent[s]; if (p >= 0 && p !== o) { a.push(p); b.push(f); kind.push(3); cls.push(2); w.push(1); } else if (p === o) { a.push(s); b.push(f); kind.push(3); cls.push(2); w.push(1); } }
      for (const e of core.edgeIds(f, 4, 'both')) { const t = E.a[e] === f ? E.b[e] : E.a[e], p = core.parent[t]; a.push(f); b.push(p === o ? t : p); kind.push(4); cls.push(2); w.push(E.w[e]); }
      for (const e of core.edgeIds(f, 5, 'both')) { const t = E.a[e] === f ? E.b[e] : E.a[e], p = core.parent[t]; a.push(f); b.push(p === o ? t : p); kind.push(5); cls.push(2); w.push(E.w[e]); }
      for (const t of core.edgesOf(f, 6, 'out')) { a.push(f); b.push(t); kind.push(6); cls.push(2); w.push(1); }
    }
    for (const r of view.recipe) if (core.cls[r] === 2) for (const t of core.edgesOf(r, 1, 'out')) if (view.recipe.includes(t)) { a.push(r); b.push(t); kind.push(1); cls.push(2); w.push(1); }
    return { a: Uint32Array.from(a.slice(0, 4000)), b: Uint32Array.from(b.slice(0, 4000)), kind: Uint8Array.from(kind.slice(0, 4000)), cls: Uint8Array.from(cls.slice(0, 4000)), w: Float32Array.from(w.slice(0, 4000)) };
  },
  labels(core, view, max) {
    const out = [];
    for (let i = 0; i < core.N && out.length < max; i++) if ((view.lit[i] & 15) && core.cls[i] !== 4) out.push(i);
    for (let i = core.range.block[0]; i < core.range.block[1] && out.length < max; i++) if (2 + 0.55 * Math.sqrt(core.mass[i]) > 9 && !out.includes(i)) out.push(i);
    for (let c = core.range.cat[0]; c < core.range.cat[1] && out.length < max; c++) if (!out.includes(c)) out.push(c);
    return Uint32Array.from(out);
  },
};
