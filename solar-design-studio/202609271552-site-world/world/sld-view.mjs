// sld-view.mjs: the SLD view, a clean schematic single-line diagram of the whole plant in a flat panel over the world.
//
// Drawn from the same network the world's symbols and the readouts come from (sld-graph.mjs, sld-source.mjs): the
// landing bay and HV cable at the top, the plant-end HV bay and grid transformers, the 33 kV board sections with their
// normally-open bus ties and earthing, then one column per feeder, RMU under RMU, each station beside its RMU. A ring's
// normally-open link is dashed red. Click or tap a station to fly to it; any other symbol shows its readout. Follow
// highlights its path here too. Only redrawn when the network changes (nothing runs while it is open and still).

const NS = 'http://www.w3.org/2000/svg', COL = 96, ROW = 74, TOP = 24;
const CSS = `
#sld-panel { left: 8px; top: 56px; bottom: calc(var(--foot, 20px) + 8px); width: min(640px, calc(100vw - 16px)); display: flex; /* the full height */
  flex-direction: column; gap: 6px; z-index: 5; }
#sld-panel[hidden] { display: none; }
#sld-panel header { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
#sld-panel h2 { margin: 0; font-size: 12px; font-weight: 600; color: var(--text, #cfe9ff); }
#sld-panel .note { margin: 0; color: var(--dim, #6f8ea6); font-size: 11px; }
#sld-panel .scroll { overflow: auto; flex: 1; min-height: 120px; border: 1px solid var(--edge, #1c2c3a); border-radius: 4px; }
#sld-panel svg { display: block; }
#sld-panel svg * { vector-effect: non-scaling-stroke; }
#sld-panel .ln { stroke: #9cdbff; stroke-width: 1.4; fill: none; } #sld-panel .mv { stroke: #ffa050; }
#sld-panel .lv { stroke: #8cffa0; } #sld-panel .op { stroke: #ff5a4a; stroke-dasharray: 5 4; } #sld-panel .ea { stroke: #d8d89a; }
#sld-panel .hl, #sld-panel .hl * { stroke: #c0ffff !important; stroke-width: 3 !important; }
#sld-panel text { fill: #9fb8cc; font: 10px system-ui, sans-serif; } #sld-panel .st { cursor: pointer; }
#sld-panel .st:hover .box { stroke: #fff; }
#sld-panel button { background: var(--panel, #111); color: var(--text, #cfe9ff); border: 1px solid var(--edge, #1c2c3a); border-radius: 4px;
  min-height: var(--btn, 30px); padding: 0 9px; cursor: pointer; }
#sld-panel dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; font-variant-numeric: tabular-nums; }
#sld-panel dt { color: var(--text, #cfe9ff); } #sld-panel dd { margin: 0; color: var(--dim, #6f8ea6); }
@media (pointer: coarse) { #sld-panel { right: 8px; width: auto; max-height: 50vh; } }`;

const el = (tag, attrs = {}, parent = null) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
};

// deps: { doc, onStation(id), onElement(nodeId) -> [[label, value]...], onClose() }
export function createSldView({ doc, onStation, onElement, onClose }) {
  if (!doc.getElementById('sld-style')) { const s = doc.createElement('style'); s.id = 'sld-style'; s.textContent = CSS; doc.head.append(s); }
  const panel = doc.createElement('section');
  panel.id = 'sld-panel'; panel.className = 'panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Single-line diagram');
  panel.innerHTML = `<header><h2>Single-line diagram</h2><button type="button" id="sld-close">Close</button></header>
    <p class="note" id="sld-note">Illustrative, not a design for any site.</p><div class="scroll"></div><dl id="sld-readout" aria-live="polite"></dl>`;
  doc.body.append(panel);
  const box = panel.querySelector('.scroll'), dl = panel.querySelector('#sld-readout');
  panel.querySelector('#sld-close').addEventListener('click', () => { panel.hidden = true; onClose?.(); });
  let key = '', svg = null;

  function rows(list) {
    dl.replaceChildren(...list.flatMap(([k, v]) => { const dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
  }

  function draw(src, version) {
    if (key === version && svg) return;
    key = version;
    const sections = src.sections.map(s => ({ ...s, feeders: src.feeders.filter(f => f.section === s.id) }));
    const width = Math.max(4, sections.reduce((t, s) => t + Math.max(1, s.feeders.length) + 1, 0)) * COL;
    const depth = Math.max(1, ...src.feeders.map(f => f.hops.filter(h => !h.open).length));
    const yLand = TOP, yHv = yLand + 70, yGt = yHv + 60, yBoard = yGt + 90, height = yBoard + 60 + depth * ROW + 30;
    svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Single-line diagram of the plant' });
    const hit = (g0, id, station) => { g0.dataset.node = id; if (station) { g0.classList.add('st'); g0.dataset.station = station; } return g0; };
    const line = (p, x1, y1, x2, y2, cls = 'ln') => el('line', { x1, y1, x2, y2, class: cls }, p);
    const text = (p, x, y, t, anchor = 'middle') => { const e = el('text', { x, y, 'text-anchor': anchor }, p); e.textContent = t; return e; };
    const circle = (p, cx, cy, r, cls = 'ln') => el('circle', { cx, cy, r, class: cls }, p);
    // Sections and their feeder columns.
    let x = COL / 2;
    const secX = new Map(), colX = new Map();
    for (const s of sections) {
      const n = Math.max(1, s.feeders.length), x0 = x, x1 = x + (n - 1) * COL;
      secX.set(s.id, [x0, x1]); s.feeders.forEach((f, j) => colX.set(f.id, x0 + j * COL));
      const G = hit(el('g', {}, svg), s.id);
      line(G, x0 - 20, yBoard, x1 + 20, yBoard, 'ln mv'); text(G, x0 - 20, yBoard - 6, s.id.replace('MVB', 'Section '), 'start');
      const E = hit(el('g', {}, svg), `${s.id}.NET`);                    // earthing transformer + NER
      const zig = [[-34, 10], [-38, 16], [-30, 22], [-38, 28], [-34, 34]].map(([dx, dy]) => `${x0 + dx},${yBoard + dy}`).join(' ');
      line(E, x0 - 20, yBoard, x0 - 34, yBoard + 10, 'ln ea'); el('polyline', { points: zig, class: 'ln ea' }, E);
      line(E, x0 - 40, yBoard + 36, x0 - 28, yBoard + 36, 'ln ea'); text(E, x0 - 34, yBoard + 48, 'NER');
      x = x1 + 2 * COL;
    }
    sections.slice(1).forEach((s, i) => {                               // bus ties: open blades between sections
      const a = secX.get(sections[i].id)[1] + 20, b = secX.get(s.id)[0] - 20, m = (a + b) / 2, G = hit(el('g', {}, svg), s.id);
      line(G, a, yBoard, m - 8, yBoard, 'ln op'); line(G, m - 8, yBoard, m + 6, yBoard - 10, 'ln op'); line(G, m + 8, yBoard, b, yBoard, 'ln op');
      text(G, m, yBoard + 14, 'N/O');
    });
    // Grid transformers over their sections, the plant-end HV busbar, the HV cable and the landing bay.
    const gx = new Map();
    for (const gt of src.grid) {
      const mine = sections.filter(s => s.gt === gt.id).flatMap(s => secX.get(s.id)), cx = mine.length ? (Math.min(...mine) + Math.max(...mine)) / 2 : width / 2;
      gx.set(gt.id, cx);
      const G = hit(el('g', {}, svg), `${gt.id}.hv`);
      circle(G, cx, yGt - 8, 12); circle(G, cx, yGt + 8, 12, 'ln mv'); text(G, cx + 18, yGt + 4, `${gt.id} ${gt.mva} MVA`, 'start');
      line(G, cx, yGt - 20, cx, yHv, 'ln'); line(G, cx - 5, yHv + 18, cx + 5, yHv + 24, 'ln');   // bay: disconnector mark
      for (const s of sections.filter(q => q.gt === gt.id)) { const [a, b] = secX.get(s.id); line(G, cx, yGt + 20, (a + b) / 2, yBoard, 'ln mv'); }
    }
    const xs = [...gx.values()], hvA = Math.min(...xs, width / 2), hvB = Math.max(...xs, width / 2);
    const H = hit(el('g', {}, svg), 'HVP'); line(H, hvA - 20, yHv, hvB + 20, yHv); text(H, hvA - 20, yHv - 6, `${src.hv.kv} kV plant-end bay`, 'start');
    const Lg = hit(el('g', {}, svg), 'LAND'); line(Lg, width / 2, yHv, width / 2, yLand + 18);
    el('rect', { x: width / 2 - 16, y: yLand, width: 32, height: 18, class: 'ln' }, Lg);
    const lw = { tower: 'line tower, overhead tee', 'gis-bay': 'substation bay', 'dno-sub': 'network operator substation', none: 'no nearby connection (assumed)' };
    text(Lg, width / 2 + 22, yLand + 13, `${src.hv.kv} kV ${lw[src.hv.landing.kind] || lw['gis-bay']}, ${Math.round(src.hv.lengthM)} m`, 'start');
    // Feeders: RMU under RMU, each station beside its RMU; a ring's open link dashed red.
    const rmuY = new Map();
    for (const f of src.feeders) {
      const cx = colX.get(f.id);
      let y = yBoard, k = 0;
      text(svg, cx, yBoard + 22, f.id);
      for (const [i, h] of f.hops.entries()) {
        if (h.open) continue;
        const to = h.to === 'board' ? null : h.to;
        if (!to) continue;
        const y2 = yBoard + 50 + k * ROW, B = el('g', { 'data-branch': `${f.id}.${i + 1}` }, svg);
        line(B, cx, y, cx, y2 - 10, 'ln mv'); y = y2 + 10; k++;
        rmuY.set(to, [cx, y2]);
        const S = hit(el('g', {}, svg), `${to}.R`, to);
        el('rect', { x: cx - 10, y: y2 - 10, width: 20, height: 20, class: 'ln mv box' }, S);
        line(S, cx + 10, y2, cx + 30, y2, 'ln mv'); circle(S, cx + 38, y2 - 5, 7, 'ln mv'); circle(S, cx + 38, y2 + 5, 7, 'ln lv');
        text(S, cx + 50, y2 + 3, to, 'start');
      }
    }
    for (const f of src.feeders) for (const [i, h] of f.hops.entries()) {
      if (!h.open) continue;
      const p = rmuY.get(h.from), q = rmuY.get(h.to === 'board' ? '' : h.to);
      if (p && q) {
        const B = el('g', { 'data-branch': `${f.id}.${i + 1}` }, svg);
        el('path', { d: `M${p[0]},${p[1] + 10} C${p[0]},${p[1] + 40} ${q[0]},${q[1] + 40} ${q[0]},${q[1] + 10}`, class: 'ln op' }, B);
        text(B, (p[0] + q[0]) / 2, Math.max(p[1], q[1]) + 44, 'N/O');
      }
    }
    svg.addEventListener('click', e => {
      const t = e.target.closest('[data-node], [data-branch]');
      if (!t) return;
      if (t.dataset.station) onStation?.(t.dataset.station);
      rows(onElement?.(t.dataset.node || null, t.dataset.branch || null) || []);
    });
    box.replaceChildren(svg);
  }

  return {
    element: panel,
    show(src, version) { draw(src, version); panel.hidden = false; },
    hide() { panel.hidden = true; },
    open: () => !panel.hidden,
    rows,
    // Follow: its nodes and branches glow here too.
    highlight(nodes = [], branches = []) {
      if (!svg) return;
      const on = new Set([...nodes, ...branches]);
      for (const e of svg.querySelectorAll('[data-node], [data-branch]')) e.classList.toggle('hl', on.has(e.dataset.node) || on.has(e.dataset.branch));
    },
    stations: () => (svg ? [...svg.querySelectorAll('[data-station]')].map(e => e.dataset.station) : [])
  };
}
