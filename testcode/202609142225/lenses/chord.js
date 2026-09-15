/* lens chord — from v05-chord-dependencies (GRAMMAR §7 chord). 210 arcs as geometry; depends-on chords through the centre. */
const TAU = Math.PI * 2, GAP = 0.004;
const pt = (cx, cy, r, a) => [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)];
let geo = null;   // last layout's arc table for hit()

export default {
  id: 'chord',
  from: 'v05-chord-dependencies',
  wants: ['block', 'family', 'category'],
  always: ['block', 'category'],
  draws: ['depends on', 'uses', 'used by'],
  curve: { mode: 'centre' },
  hint(core, view) { return `${core.dependsOnCount} depends-on chords between blocks on the table.`; },
  simplify(width) { return width <= 600 ? { thick: 18, strip: true } : { thick: 14, strip: false }; },
  camera() { return { pan: false, zoom: [0.5, 6], rotate: true }; },
  layout(core, view, out) {
    const { w, h } = view, S = Math.min(w, h), cx = w / 2, cy = h / 2, R = 0.40 * S, [b0, b1] = core.range.block, n = b1 - b0, step = TAU / n;
    const put = (i, p) => { out[2 * i] = p[0]; out[2 * i + 1] = p[1]; };
    geo = { cx, cy, R, step, n, b0, thick: view.params.thick || 14 };
    let rotate = 0;
    for (let i = b0; i < b1; i++) { const a = (i - b0 + 0.5) * step; put(i, pt(cx, cy, 0.98 * R, a)); if (i === view.open) rotate = -a; }
    const first = new Map(), last = new Map(); for (let i = b0; i < b1; i++) { const c = core.cat[i]; if (!first.has(c)) first.set(c, i - b0); last.set(c, i - b0); }
    for (let c = core.range.cat[0]; c < core.range.cat[1]; c++) { const ci = c - core.range.cat[0]; if (first.has(ci)) put(c, pt(cx, cy, 1.08 * R, ((first.get(ci) + last.get(ci)) / 2 + 0.5) * step)); }
    if (view.focus >= 0 && core.cls[view.focus] === 4 && view.open >= 0 && core.cls[view.open] === 2) put(view.focus, pt(cx, cy, 0.9 * R, (view.open - b0 + 0.5) * step));
    return { bounds: [cx - 1.1 * R, cy - 1.1 * R, cx + 1.1 * R, cy + 1.1 * R], home: { pan: [0, 0], zoom: 1, rotate } };
  },
  edges(core, view) {
    const a = [], b = [], kind = [], cls = [], w = [], o = view.open, f = view.focus;
    if (o >= 0 && core.cls[o] === 2) {
      for (const t of core.edgesOf(o, 1, 'out')) { a.push(o); b.push(t); kind.push(1); cls.push(2); w.push(1); }
      for (const s of core.edgesOf(o, 1, 'in')) { a.push(s); b.push(o); kind.push(3); cls.push(2); w.push(1); }
    }
    if (f >= 0 && core.cls[f] === 4 && o >= 0) {
      const seen = new Set();
      for (const t of core.edgesOf(f, 2, 'out')) { const p = core.parent[t]; if (p >= 0 && p !== o && core.cls[p] === 2 && !seen.has('u' + p)) { seen.add('u' + p); a.push(f); b.push(p); kind.push(2); cls.push(2); w.push(1); } }
      for (const s of core.edgesOf(f, 2, 'in')) { const p = core.parent[s]; if (p >= 0 && p !== o && core.cls[p] === 2 && !seen.has('b' + p)) { seen.add('b' + p); a.push(p); b.push(f); kind.push(3); cls.push(2); w.push(1); } }
    }
    for (const r of view.recipe) if (core.cls[r] === 2) for (const t of core.edgesOf(r, 1, 'out')) if (view.recipe.includes(t)) { a.push(r); b.push(t); kind.push(1); cls.push(2); w.push(1); }
    return { a: Uint32Array.from(a), b: Uint32Array.from(b), kind: Uint8Array.from(kind), cls: Uint8Array.from(cls), w: Float32Array.from(w) };
  },
  geometry(core, view) {
    if (!geo) return null; const { cx, cy, R, step, n, b0, thick } = geo, g = [];
    for (let k = 0; k < n; k++) { const i = b0 + k, a0 = k * step + GAP / 2, a1 = (k + 1) * step - GAP / 2, am = (a0 + a1) / 2, rc = R / Math.cos((a1 - a0) / 2); const p0 = pt(cx, cy, R, a0), p1 = pt(cx, cy, R, a1), c = pt(cx, cy, rc, am); const lit = view.lit[i] & 15; g.push(p0[0], p0[1], c[0], c[1], p1[0], p1[1], thick, core.cat[i] === 255 ? core.GEOM.muted : core.cat[i], lit ? 2 : 1); }
    // every depends-on chord between table blocks, faint, in the depending block's category colour when idle
    if ((view.kindsOn >> 1) & 1) { const E = core.edges; for (let e = 0; e < E.n; e++) { if (E.kind[e] !== 1) continue; const s = E.a[e], t = E.b[e]; if (core.cls[s] !== 2 || core.cls[t] !== 2) continue; if (view.open >= 0 && (s === view.open || t === view.open)) continue; const ps = pt(cx, cy, 0.98 * R, (s - b0 + 0.5) * step), pt2 = pt(cx, cy, 0.98 * R, (t - b0 + 0.5) * step); g.push(ps[0], ps[1], cx, cy, pt2[0], pt2[1], 1, core.cat[s] === 255 ? core.GEOM.muted : core.cat[s], 1); } }
    return Float32Array.from(g);
  },
  hit(core, view, x, y) {
    if (!geo) return -1; const { cx, cy, R, step, n, b0, thick } = geo; const d = Math.hypot(x - cx, y - cy); if (Math.abs(d - R) > thick) return -1;
    let a = Math.atan2(y - cy, x - cx) + Math.PI / 2; if (a < 0) a += TAU; const k = Math.floor(a / step); return k >= 0 && k < n ? b0 + k : -1;
  },
  labels(core, view, max) { const out = []; for (let i = 0; i < core.N && out.length < max; i++) if ((view.lit[i] & 15) && core.cls[i] !== 1 && core.cls[i] !== 3) out.push(i); if (view.open < 0) for (let c = core.range.cat[0]; c < core.range.cat[1] && out.length < max; c++) out.push(c); return Uint32Array.from(out); },
  overlay(core, view, host, shell) {
    host.innerHTML = ''; host.style.pointerEvents = 'none'; if (!view.params.strip) return;
    const strip = document.createElement('div'); strip.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:44px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;pointer-events:auto;padding:4px 6px;';
    for (let i = core.range.block[0]; i < core.range.block[1]; i++) { const b = document.createElement('button'); b.textContent = core.rec[i].symbol; b.style.cssText = `display:inline-block;min-width:36px;height:36px;margin-right:2px;border-radius:6px;border:1px solid ${core.colour(i)};background:${i === view.open ? core.colour(i) : 'transparent'};color:${i === view.open ? core.PAL.body : core.colour(i)};font-size:11px;cursor:pointer`; b.addEventListener('click', () => shell.navigate(i)); strip.append(b); if (i === view.open) requestAnimationFrame(() => { strip.scrollLeft = b.offsetLeft - 180; }); }
    host.append(strip);
  },
  leave() { geo = null; },
};
