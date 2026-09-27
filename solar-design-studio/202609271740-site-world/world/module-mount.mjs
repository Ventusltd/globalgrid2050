// module-mount.mjs: module detail on zoom, wired into the world. Close to the Solar block or a plant layout, the
// few modules nearest where you look open into their front and back (module-view.mjs chooses, module-geometry.mjs
// draws, data/modules.json holds the generic classes). Tap a detailed module, or world.module.inspect(id), for its
// datasheet values, its place in the string and its cold open-circuit voltage; the class picker, or
// world.module.use('B'), changes the class and the table and string counts follow.
// Nothing loads until a block or layout exists; nothing draws when still; a level opening plays for ANIM_MS, then stops.

import { rayFromScreen } from './pick.mjs';

export const ANIM_MS = 280;
const COLOUR = { frame: [0.84, 0.86, 0.9, 0.95], cells: [0.36, 0.52, 0.88, 0.75], bus: [0.72, 0.76, 0.84, 0.45], split: [0.96, 0.74, 0.3, 0.95],
  back: [0.7, 0.71, 0.74, 0.85], cable: [0.92, 0.36, 0.28, 0.95], holes: [0.96, 0.94, 0.6, 0.95] };
const n1 = v => v.toFixed(1), n2 = v => v.toFixed(2);

export function mountModules(api, sources, doc = document) {
  let V = null, G = null, K = null, cat = null, cls = null, loading = null;
  const st = { sig: '', faces: [], box: null, cache: new Map(), prev: new Map(), since: new Map(), picks: [], out: [], pose: '', verts: 0, pinned: null };
  const src = () => ({ block: sources.block?.built?.()?.built ?? null, plant: sources.plant?.result?.() ?? null });
  const redraw = () => api.gate.invalidate();

  function load() {
    return (loading ||= (async () => {
      [V, G, K] = await Promise.all([import('./module-view.mjs'), import('./module-geometry.mjs'), import('./module-catalogue.mjs')]);
      const doc2 = await (await fetch('./world/data/modules.json', { cache: 'no-cache' })).json(), bad = K.checkCatalogue(doc2);
      if (bad.length) throw Error('module catalogue: ' + bad.join('; '));
      cat = doc2; cls = cat.classes[0]; panel(); redraw();
      return true;
    })().catch(e => { console.warn(e.message); return false; }));
  }
  function refresh() {
    const s = src(), v = sources.plant?.version?.() ?? 0;
    const sig = `${s.block ? 'b' + s.block.groups?.tables?.base : ''}|${s.plant ? 'p' + v + ':' + s.plant.tables.length + ':' + s.plant.tables[0] : ''}`;
    if (sig === st.sig) return;
    st.sig = sig; st.cache.clear(); st.prev.clear(); st.since.clear(); st.pose = '';
    st.faces = [...V.blockFaces(s.block), ...V.plantFaces(s.plant)].map(f => ({ ...f, box: V.faceBox(f) }));
    st.box = st.faces.length ? [0, 1, 2, 3, 4, 5].map(i => (i % 2 ? Math.max : Math.min)(...st.faces.map(f => f.box[i]))) : null;
    st.grid = V.faceGrid(st.faces);                          // faces by 50 m cell: a frame visits only those near the eye
  }
  const eyeDir = () => {
    const s = api.state(), o = api.origin(), c = Math.cos(s.pitch);
    return { eye: [s.pos[0] + o.e, s.pos[1] + o.n, s.pos[2]], dir: [Math.sin(s.yaw) * c, Math.cos(s.yaw) * c, Math.sin(s.pitch)], s, o };
  };

  function batches() {
    const s = src();
    if (!s.block && !s.plant) { if (st.picks.length) { st.picks = []; st.out = []; show(); } return []; }
    if (!cat) { load(); return []; }
    refresh();
    const { eye, dir, s: pose, o } = eyeDir(), now = performance.now();
    const key = `${cls.id}|${o.e},${o.n}|${pose.pos.map(v => v.toFixed(2))}|${pose.yaw.toFixed(3)}|${pose.pitch.toFixed(3)}|${st.sig}`;
    const animating = st.picks.some(p => [1, 2, 3].some(l => l <= p.level && now - (st.since.get(p.key + l) ?? 0) < ANIM_MS));
    if (key === st.pose && !animating) return st.out;
    st.pose = key;
    const near = st.box && Math.hypot(Math.max(st.box[0] - eye[0], 0, eye[0] - st.box[1]), Math.max(st.box[2] - eye[1], 0, eye[1] - st.box[3])) < 40;
    // Only the faces in the cells round the eye, and none when the eye is well above the highest table (the detail opens
    // within about 26 m): no scan of every face on a moving frame over a large plant.
    const low = near && eye[2] - st.box[5] < 30, picks = low ? V.choose(V.facesNear(st.grid, eye), eye, dir, cls, st.prev, st.cache) : [];
    // The vertex budget: nearest first; a module that would pass it opens fewer levels, or none.
    const cost = K_cost(), kept = [];
    let verts = 0;
    for (const p of picks) {
      let l = p.level;
      while (l > 0 && verts + cost[l - 1] > G.VERTEX_BUDGET) l--;
      if (l) { kept.push({ ...p, level: l }); verts += cost[l - 1]; }
    }
    const was = st.picks.map(p => p.key + p.level).join(), prev = new Map();
    for (const p of kept) {                                   // each new level opens 120 ms after the one below it
      const p0 = st.prev.get(p.key) || 0;
      prev.set(p.key, p.level);
      for (let l = 1; l <= p.level; l++) if (!st.since.has(p.key + l)) st.since.set(p.key + l, now + Math.max(0, l - p0 - 1) * 120);
    }
    for (const k of [...st.since.keys()]) { const m = k.match(/^(.*)(\d)$/); if (!(prev.get(m[1]) >= Number(m[2]))) st.since.delete(k); }
    st.prev = prev; st.picks = kept; st.verts = verts;
    st.out = draw(kept, now, o);
    if (kept.some(p => [1, 2, 3].some(l => l <= p.level && now - st.since.get(p.key + l) < ANIM_MS))) redraw(); // play the opening, then stop
    if (was !== kept.map(p => p.key + p.level).join()) show();
    return st.out;
  }
  let costOf = null;
  const K_cost = () => (costOf?.id === cls.id ? costOf.n : (costOf = { id: cls.id, n: G.levelCost(cls) }).n);

  // One source of truth for the string length (user test H7): the block's and the plant's own strings as built; the
  // class's own limit is said beside it, never used in its place.
  const builtMps = face => V.builtStringLength(face, src());
  const mpsFor = face => builtMps(face) || K.modulesPerString(cls, cat.coldest_cell_C, cat.system_voltage_V);
  function draw(picks, now, o) {
    if (!picks.length) return [];
    const out = Object.fromEntries(G.PARTS.map(p => [p, []])), base = G.placeModule(picks[0].face, picks[0].row, picks[0].col, cls).centre;
    for (const p of picks) {
      const mps = mpsFor(p.face);
      const grow = {};
      for (let l = 1; l <= p.level; l++) grow[l] = Math.max(0, (now - st.since.get(p.key + l)) / ANIM_MS);
      G.moduleLines(G.placeModule(p.face, p.row, p.col, cls), cls, p.level, out, base, grow, p.face.stringOf(p.row, p.col, mps, cls));
    }
    const origin = [base[0] - o.e, base[1] - o.n, base[2]], v = Math.round(now);
    return G.PARTS.filter(k => out[k].length).map(k => ({ key: 'module-' + k, version: `${st.pose}|${v}`, positions: new Float32Array(out[k]), color: COLOUR[k], origin }));
  }

  // ---- readout: datasheet values, string position, cold Voc ----
  function inspect(id = null) {
    if (!cat) return null;
    const p = id ? findPick(id) : st.picks[0];
    if (!p) return null;
    const b = K.nominal(cls), hi = K.highestVoc(cls), cold = cat.coldest_cell_C, mps = mpsFor(p.face), classMps = K.modulesPerString(cls, cold, cat.system_voltage_V);
    const s = p.face.stringOf(p.row, p.col, mps, cls), vCold = K.coldVoc(cls, cold, b), vColdHi = K.coldVoc(cls, cold, hi); // the stricter of the cell and Voc x 1.15
    st.pinned = p.key;
    const r = { id: p.key, class: { id: cls.id, label: cls.label, source: cls.source, technology: cls.technology, construction: cls.construction },
      datasheet: { pmaxW: b.pmax, vmpV: b.vmp, impA: b.imp, vocV: b.voc, iscA: b.isc, tempCoeffPctPerK: { ...cls.temp_coeff }, bifaciality: cls.bifaciality,
        sizeMm: [...cls.size_mm], weightKg: cls.weight_kg, cells: `${cls.cells.count} (${cls.cells.columns} x ${cls.cells.rows}, ${cls.cells.cut}-cut)`,
        junctionBoxes: cls.junction_boxes.count, bypassDiodes: cls.junction_boxes.bypass_diodes, leadsMm: [cls.cable.plus_mm, cls.cable.minus_mm] },
      string: { table: p.face.table, half: p.face.half, string: s.string, position: s.position, of: s.of, modulesPerString: mps, asBuilt: !!builtMps(p.face), classAllows: classMps },
      cold: { cellC: cold, moduleVocV: +n2(vCold), highestBinVocV: +n2(vColdHi), stringVocV: +n1(vColdHi * s.of), limitV: cat.system_voltage_V, ok: vColdHi * s.of <= cat.system_voltage_V },
      level: p.level, distanceM: +n1(p.d), assumed: [...cls.assumed] };
    show(r);
    return r;
  }
  function findPick(id) {
    const hit = st.picks.find(p => p.key === id);
    if (hit) return hit;
    const m = /^(.*)\/(\d+)\/(\d+)$/.exec(String(id)), f = m && st.faces.find(x => x.key === m[1]);
    return f ? { key: id, face: f, row: +m[2], col: +m[3], level: 0, d: NaN } : null;
  }
  function tap(x, y) {
    if (!st.picks.length || !cat) return false;
    const { eye, s } = eyeDir(), r = api.canvas.getBoundingClientRect();
    const ray = rayFromScreen(x, y, r.width, r.height, eye, s.yaw, s.pitch, api.FOV), p = V.hitModule(st.picks, cls, ray.origin, ray.dir);
    if (!p) return false;
    inspect(p.key);
    return true;
  }
  // The plant's modules and MWp as laid out (the plant readout's own figures: one MWp across the panels); the class's
  // fit on the same tables is kept beside them as drawn.
  const laid = c => { const r = src().plant; if (!r?.built?.tables || !c.modules) return c; const m = r.built.tables * r.table.modules;
    return { ...c, drawn: c.modules, modules: m, strings: Math.floor(m / (c.modulesPerString || 1)), kWp: r.built.mwp * 1000, laidOut: true }; };
  function counts() {
    if (!cat) return null;
    const faces = st.faces.length ? st.faces : [], by = k => faces.filter(f => f.key.startsWith(k));
    const asBuilt = (list, c) => { const m = builtMps(list[0]); return m ? { ...c, modulesPerString: m, strings: Math.floor(c.modules / m),
      stringed: Math.floor(c.modules / m) * m, asBuilt: true, classAllows: c.modulesPerString } : c; };
    return { class: cls.id, block: asBuilt(by('block:'), K.countsFor(cls, by('block:'), cat.coldest_cell_C, cat.system_voltage_V)),
      plant: laid(asBuilt(by('plant:'), K.countsFor(cls, by('plant:'), cat.coldest_cell_C, cat.system_voltage_V))) };
  }
  async function use(id) {
    await load();
    const c = cat && K.classOf(cat, String(id).toUpperCase());
    if (!c) return null;
    cls = c; st.pose = ''; st.since.clear(); st.prev.clear();
    if (st.sig === '' && V) refresh();
    const sel = doc.getElementById('module-class'); if (sel) sel.value = c.id;
    show(); redraw();
    return counts();
  }

  // ---- the small panel: the class picker and the readout; shown while modules are detailed or one is inspected ----
  let box = null;
  function panel() {
    if (box || !doc.body) return;
    box = doc.createElement('section');
    box.id = 'module-panel'; box.hidden = true; box.setAttribute('aria-label', 'Module detail');
    box.style.cssText = 'position:fixed;right:12px;bottom:12px;max-width:min(340px,calc(100vw - 32px));max-height:45vh;overflow:auto;z-index:5;'
      + 'background:#111;color:#ddd;border:1px solid #333;border-radius:6px;padding:8px 10px;font:12px/1.4 system-ui,sans-serif';
    const sel = doc.createElement('select'); sel.id = 'module-class'; sel.setAttribute('aria-label', 'Module class');
    sel.style.cssText = 'width:100%;background:#1a1a1a;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px;margin-bottom:4px';
    for (const c of cat.classes) { const o = doc.createElement('option'); o.value = c.id; o.textContent = c.label; sel.append(o); }
    sel.addEventListener('change', () => use(sel.value));
    const out = doc.createElement('div'); out.id = 'module-readout';
    box.append(sel, out); doc.body.append(box);
  }
  function show(r = null) {
    if (!box) return;
    box.hidden = !st.picks.length && !r;
    const c = counts(), rows = [];
    if (c) for (const k of ['block', 'plant']) if (c[k].modules) rows.push(`${k === 'block' ? 'Solar block' : 'Plant layout'}: ${c[k].modules} modules, ${c[k].strings} strings of `
      + `${c[k].modulesPerString}${c[k].asBuilt ? ' as built' : ''}, ${n1(c[k].kWp / 1000)} MWp`
      + (c[k].asBuilt && c[k].classAllows < c[k].modulesPerString ? ` (this class allows ${c[k].classAllows} a string at ${cat.coldest_cell_C} °C)` : ''));
    if (r) rows.push(`Module ${r.id} · ${r.class.source}`, `Pmax ${r.datasheet.pmaxW} W · Vmp ${r.datasheet.vmpV} V · Imp ${r.datasheet.impA} A`,
      `Voc ${r.datasheet.vocV} V · Isc ${r.datasheet.iscA} A · β Voc ${r.datasheet.tempCoeffPctPerK.voc} %/K`,
      `Table ${r.string.table} ${r.string.half} · string ${r.string.string} · module ${r.string.position} of ${r.string.of}`,
      `Cold (the stricter of ${r.cold.cellC} °C and Voc × 1.15): module Voc ${r.cold.moduleVocV} V; string ${r.cold.stringVocV} V (highest bin) ${r.cold.ok ? 'within' : 'OVER'} ${r.cold.limitV} V`);
    else rows.push(`${st.picks.length} module(s) in detail · tap one for its values`);
    const out = doc.getElementById('module-readout');
    out.replaceChildren(...rows.map(t => { const d = doc.createElement('div'); d.textContent = t; return d; }));
  }

  const debug = () => ({ loaded: !!cat, class: cls?.id ?? null, faces: st.faces.length, detailed: st.picks.length, vertices: st.verts,
    budget: G?.VERTEX_BUDGET ?? null, picks: st.picks.map(p => ({ key: p.key, level: p.level, d: +n2(p.d), off: +n2(p.off) })), pinned: st.pinned });
  return { batches, tap, api: Object.freeze({ inspect, use, counts, debug, classes: () => (cat ? cat.classes.map(c => ({ id: c.id, label: c.label })) : []), load }) };
}
