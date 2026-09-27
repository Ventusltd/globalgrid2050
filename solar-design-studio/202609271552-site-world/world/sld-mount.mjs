// sld-mount.mjs: the single-line diagram in the world. Loaded on first use (world.sld, the Single-line diagram and
// Follow buttons, or a tap on a module of the placed solar block), never on the first frame.
//   SLD view      the schematic of the whole plant (sld-view.mjs); a station click flies there
//   symbols       every element's single-line symbol standing over it in the world (sld-symbols.mjs)
//   readouts      load, current, cable, length, voltage drop and fault level per element (sld-calc.mjs)
//   Follow        from one module to the landing bay (sld-follow.mjs): the camera flies the path in legs and pauses at
//                 each element; play, pause, step (next, back). Paused, nothing is drawn (0 fps).
// The network is the placed solar block (Design > Plant > Solar block), else the laid-out plant. The grid source's
// fault level is assumed (40 kA) and can be set with world.sld.source(kA). Illustrative, not a design for any site.

import { toBng, toLocal } from './origin.mjs';
import { rayFromScreen, pickGround } from './pick.mjs';
import { sourceFromBlock, sourceFromLayout } from './sld-source.mjs';
import { buildGraph } from './sld-graph.mjs';
import { solve, readouts, checkGraph, RISE_NOTE } from './sld-calc.mjs';
import { followPath, pickPanel, parsePanel } from './sld-follow.mjs';
import { symbolGroups, glowGroup, SYMBOL_COLOURS, GLOW } from './sld-symbols.mjs';
import { createSldView } from './sld-view.mjs';
import { SLD_LABEL } from './sld-rules.mjs';
import { chooseConnection, CONNECT_LABEL } from './sld-connect.mjs';

const VIEW = { walk: { back: 7, pitch: -0.35 }, drone: { back: 45, pitch: -0.6 }, high: { back: 160, pitch: -0.8 } };
const DWELL_MS = 2500;
const FOLLOW_CSS = `#sld-follow { left: 50%; transform: translateX(-50%); bottom: calc(var(--foot, 20px) + 8px); width: min(420px, calc(100vw - 16px));
  z-index: 6; } #sld-follow[hidden] { display: none; } #sld-follow h3 { margin: 0 0 4px; font-size: 12px; color: var(--text, #cfe9ff); }
#sld-follow dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0 0 6px; font-variant-numeric: tabular-nums; }
#sld-follow dt { color: var(--text, #cfe9ff); } #sld-follow dd { margin: 0; color: var(--dim, #6f8ea6); }
#sld-follow .row { display: flex; gap: 4px; } #sld-follow button { flex: 1; background: var(--panel, #111); color: var(--text, #cfe9ff);
  border: 1px solid var(--edge, #1c2c3a); border-radius: 4px; min-height: var(--btn, 30px); cursor: pointer; }
#sld-follow .note { margin: 0 0 4px; color: var(--dim, #6f8ea6); font-size: 11px; }
body:has(#sld-follow:not([hidden])) #sld-panel { bottom: calc(var(--foot, 20px) + 250px); max-height: 30vh; }`;

// deps: { api (substrate), block: design.blockApi, plant: design.plantApi, doc }
export function mountSld({ api, block, plant, doc = document }) {
  const $ = id => doc.getElementById(id);
  const S = { key: '', net: null, groups: null, v: 0, follow: null, at: -1, playing: false, timer: null, sourceKA: null };
  const groundAt = (e, n) => { const [x, y] = toLocal(api.origin(), e, n); return api.heightAt(x, y); };
  const view = createSldView({ doc, onStation: id => station(id), onElement: (n, b) => rowsFor(n, b), onClose: () => { api.invalidate({ ground: false }); } });
  const box = doc.createElement('section');
  box.id = 'sld-follow'; box.className = 'panel'; box.hidden = true; box.setAttribute('aria-label', 'Follow');
  box.innerHTML = `<h3 id="sld-follow-title"></h3><p class="note">${SLD_LABEL} Drop is along the path towards the grid.</p><dl id="sld-follow-rows"></dl>
    <div class="row"><button type="button" data-f="back">Back</button><button type="button" data-f="play">Play</button>
    <button type="button" data-f="next">Next</button><button type="button" data-f="close">Close</button></div>`;
  doc.body.append(box);
  if (!$('sld-follow-style')) { const s = doc.createElement('style'); s.id = 'sld-follow-style'; s.textContent = FOLLOW_CSS; doc.head.append(s); }
  box.addEventListener('click', e => { const f = e.target.closest('[data-f]')?.dataset.f; if (f === 'play') (S.playing ? pause() : play()); else if (f) api_[f](); });

  // ---- the network: the placed block first, else the laid-out plant ----
  // What is near: substations and 400 kV towers of the grid layer, plus the national index's nearest substation.
  function connectionFor(mw, at, kv = null) {
    const model = api.live().find(l => l.id === 'grid')?.layer?.debug?.()?.model, grid = api.live().find(l => l.id === 'grid')?.layer;
    const subs = (model?.substations || []).map(s => ({ e: s.e, n: s.n, kv: s.kv }));
    const towers = (model?.lines || []).flatMap(l => l.towers.map(t => ({ e: t.e, n: t.n, kv: l.kv })));
    const k = `${Math.round(at[0])},${Math.round(at[1])}`;
    if (S.natKey !== k && grid?.nearestSubstation) {
      S.natKey = k;
      Promise.resolve(grid.nearestSubstation(at[0], at[1])).then(x => { if (x && Number.isFinite(x.kv)) { S.nat = x; S.key = ''; api.invalidate({ ground: false }); } }).catch(() => {});
    }
    if (S.nat) subs.push({ e: S.nat.e, n: S.nat.n, kv: S.nat.kv });
    return chooseConnection({ mw, at, subs, towers, kv, rules: S.rules || {} });
  }
  function network() {
    const b = block?.built?.(), pr = !b && plant?.result?.(), r = pr ? { result: pr, version: plant.version?.() ?? 0 } : null;
    const key = b ? `b${b.version}` : r ? `p${r.version}` : '';
    if (!key) return null;
    if (key + ':' + S.sourceKA === S.key && S.net) return S.net;
    let src;
    if (b) { const at = [b.anchor[0] + b.built.mv.poc.at[0], b.anchor[1] + b.built.mv.poc.at[1]]; src = sourceFromBlock(b.built, b.anchor, connectionFor(b.built.mv.exportMW, at, b.built.mv.poc.kv)); }
    else { const first = sourceFromLayout(r.result, null); src = sourceFromLayout(r.result, connectionFor(first.mw, first.hv.plantAt)); }
    const g = buildGraph(src, S.sourceKA ? { sourceKA: S.sourceKA } : {}), sol = solve(g), ro = readouts(g, sol);
    S.net = { src, g, sol, ro, check: checkGraph(g), block: b };
    S.key = key + ':' + S.sourceKA; S.v++; S.groups = null;
    return S.net;
  }
  const need = () => { const n = network(); if (!n) throw Error('Place the solar block, or lay out a plant, first (Design > Plant).'); return n; };

  // ---- readouts: one element, as rows ----
  const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '—');
  function rowsFor(nodeId, branchId) {
    const N = network();
    if (!N) return [];
    const { g, sol, ro } = N, into = nodeId ? sol.tree.via.get(nodeId) : g.branches.find(b => b.id === branchId);
    const n = nodeId && ro.nodes.get(nodeId), b = into && ro.branches.get(into.id), rows = [];
    if (n) rows.push(['Element', n.label], ['Voltage level', n.kv < 1 ? `${f(n.kv * 1000, 0)} V` : `${n.kv} kV`],
      ['Above the landing', `${f(n.riseToLandingPct, 2)} %${n.high ? ' · ' + RISE_NOTE : ''}`], ['Fault level', `${f(n.faultKA, 2)} kA, ${f(n.faultMVA, 0)} MVA`]);
    if (b) rows.push(['Feeding it', b.label], ['Load', `${f(b.loadMVA, 2)} MVA`], ['Current', `${f(b.currentA, 1)} A`],
      ...(b.areaMm2 ? [['Cable', `${b.areaMm2} mm² Al, ${f(b.lengthM, 0)} m${b.ratingA ? `, rated ${f(b.ratingA, 0)} A (${f(100 * b.utilisation, 0)} %)` : ''}`]] : []),
      ...(b.tap ? [['On-load tap', `${f((b.tap - 1) * 100, 2)} % (±10 % in 1.25 % steps, illustrative)`]] : []), ['Voltage drop', `${f(b.dropPct, 3)} %`]);
    rows.push(['Basis', `${SLD_LABEL} Grid fault level ${N.g.params.sourceKA} kA assumed; grid transformer taps set by the load flow.`]);
    return rows;
  }

  // ---- drawing: symbols while the view or Follow is open; the Follow path glows ----
  const o3 = base => [base[0] - api.origin().e, base[1] - api.origin().n, base[2]];
  const batch = (key, G, color, version) => (G.base && G.v.length >= 6 ? { key: 'sld-' + key, version, positions: G.v instanceof Float32Array ? G.v : (G.v = new Float32Array(G.v)),
    color, origin: o3(G.base) } : null);
  function batches() {
    if (!S.net || (!view.open() && !S.follow)) return [];
    S.groups ||= symbolGroups(S.net.g, { groundAt });
    const out = Object.entries(S.groups).map(([k, G]) => batch(k, G, SYMBOL_COLOURS[k], `${S.v}`));
    if (S.follow) out.push(batch('glow', S.follow.glow, GLOW, `${S.v}:${S.follow.panel}:${S.at}`));
    return out.filter(Boolean);
  }

  // ---- SLD view and stations ----
  function show() {
    const N = need();
    view.show(N.src, S.key);
    const gts = N.src.grid.length;
    view.rows([['Plant', `${N.check.stations} stations · ${N.src.feeders.length} feeders · ${N.src.sections.length} board sections · ${gts} grid transformer${gts === 1 ? '' : 's'}`],
      ['Network', N.check.ok ? 'every inverter reaches the landing once' : N.check.problems.join('; ')],
      ['Connection', `${N.src.hv.ruleText} · ${CONNECT_LABEL}`],
      ['Taps', N.g.branches.filter(x => x.tap).map(x => `${x.id.split('.')[0]} ${f((x.tap - 1) * 100, 2)} %`).join(', ') || 'no grid transformer'],
      ['Basis', SLD_LABEL]]);
    api.invalidate({ ground: false });
    return summary();
  }
  function station(id) {
    const N = need(), n = N.g.nodes.find(x => x.id === `${id}.R`);
    if (!n?.at) return null;
    const [x, y] = toLocal(api.origin(), n.at[0], n.at[1]);
    api.flyTo(x, y, { ...VIEW.drone, yaw: api.state().yaw });
    view.highlight([`${id}.R`], []); view.rows(rowsFor(`${id}.R`));
    return { id, at: [...n.at], rows: rowsFor(`${id}.R`) };
  }
  const summary = () => { const N = S.net; return N ? { kind: N.src.kind, stations: N.check.stations, inverters: N.check.inverters, feeders: N.src.feeders.length,
    sections: N.src.sections.length, gridTransformers: N.src.grid.length, ok: N.check.ok, landing: { ...N.src.hv.landing }, rule: N.src.hv.rule, ruleText: N.src.hv.ruleText, open: view.open(),
    ids: N.g.nodes.filter(x => x.kind === 'rmu').map(x => x.id.slice(0, -2)), label: SLD_LABEL } : null; };

  // ---- Follow ----
  async function follow(panel = null) {
    if (!block?.built?.()) await block?.place?.();
    const N = need();
    if (!N.block) throw Error('Follow runs on the solar block: place it first (Design > Plant > Solar block).');
    const b = N.block.built, P = panel ? parsePanel(panel) : { station: 'S1', string: 0, module: 0 };
    if (!P) throw Error('Follow needs a module id such as S1:0:0 (station, string, module).');
    const fp = followPath({ built: b, anchor: N.block.anchor, graph: N.g, sol: N.sol, ro: N.ro, panel: P, groundAt });
    S.follow = { ...fp, glow: glowGroup(fp.points) };
    if (view.open()) view.highlight(fp.nodes, fp.branches);
    box.hidden = false; go(0);
    return followState();
  }
  function go(i) {
    const F = S.follow;
    if (!F) return null;
    S.at = Math.max(0, Math.min(F.stops.length - 1, i));
    const s = F.stops[S.at], prev = F.stops[S.at - 1]?.at || s.leg[0];
    $('sld-follow-title').textContent = `${S.at + 1} / ${F.stops.length} · ${s.title}`;
    const nb = box.querySelector('[data-f="next"]'), bb = box.querySelector('[data-f="back"]'); // no Next at the end, no Back at the start
    if (nb) nb.disabled = S.at >= F.stops.length - 1; if (bb) bb.disabled = S.at <= 0;
    $('sld-follow-rows').replaceChildren(...s.rows.flatMap(([k, v]) => { const dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
    F.glow = glowGroup(F.points, s.at);
    const [x, y] = toLocal(api.origin(), s.at[0], s.at[1]), legM = Math.hypot(s.at[0] - prev[0], s.at[1] - prev[1]);
    const yaw = legM > 1 ? Math.atan2(s.at[0] - prev[0], s.at[1] - prev[1]) : api.state().yaw, seconds = Math.min(5, 1.5 + legM / 500);
    api.flyTo(x, y, { ...VIEW[s.view], yaw, seconds });
    clearTimeout(S.timer);
    if (S.playing) S.timer = setTimeout(() => { if (S.playing && S.at < F.stops.length - 1) go(S.at + 1); else pause(); }, seconds * 1000 + DWELL_MS);
    S.v++; api.invalidate({ ground: false });
    return followState();
  }
  function play() { if (!S.follow) return null; S.playing = true; box.querySelector('[data-f="play"]').textContent = 'Pause'; return go(S.at >= S.follow.stops.length - 1 ? 0 : S.at + 1); }
  function pause() { S.playing = false; clearTimeout(S.timer); box.querySelector('[data-f="play"]').textContent = 'Play'; return followState(); }
  function close() { pause(); S.follow = null; S.at = -1; box.hidden = true; view.highlight(); S.v++; api.invalidate({ ground: false }); return null; }
  const followState = () => (S.follow ? { panel: S.follow.panel, stop: S.at, stops: S.follow.stops.length, key: S.follow.stops[S.at]?.key,
    title: S.follow.stops[S.at]?.title, playing: S.playing, cumDropPct: S.follow.stops[S.at]?.cumDropPct, dcDropPct: S.follow.dcDropPct,
    acDropPct: S.follow.acDropPct, ends: S.follow.stops.at(-1).key, rows: S.follow.stops[S.at]?.rows } : null);

  // A tap on a module of the placed block starts Follow there (not while a design tool is in hand).
  function tap(clientX, clientY) {
    const b = block?.built?.();
    if (!b || api.design().tool) return false;
    const c = api.canvas, r = c.getBoundingClientRect(), st = api.state();
    const ray = rayFromScreen((clientX - r.left) * c.width / r.width, (clientY - r.top) * c.height / r.height, c.width, c.height, st.pos, st.yaw, st.pitch, api.FOV);
    const hit = pickGround(ray, (x, y) => api.heightAt(x, y), { maxDistance: 1500 });
    if (!hit) return false;
    const p = toBng(api.origin(), hit[0], hit[1]), P = pickPanel(b.built, b.anchor, [p.e, p.n]);
    if (!P) return false;
    follow(`${P.station}:${P.string}:${P.module}`).catch(e => console.warn('follow: ' + e.message));
    return true;
  }

  const api_ = { next: () => go(S.at + 1), back: () => go(S.at - 1), close };
  api.hooks.batches?.add(batches);
  return {
    show, hide: () => { view.hide(); api.invalidate({ ground: false }); }, station, follow, play, pause, close, tap, summary,
    next: api_.next, back: api_.back, state: followState, readout: id => rowsFor(id),
    rules(r = {}) { S.rules = { ...(S.rules || {}), ...r }; S.key = ''; if (network() && view.open()) show(); return { ...S.rules }; },
    source(kA) { S.sourceKA = Number(kA) > 0 ? Number(kA) : null; S.key = ''; if (network() && view.open()) show(); return S.net?.g.params.sourceKA ?? null; },
    network: () => { const N = network(); return N ? { summary: summary(), check: N.check, nodes: N.g.nodes.length, branches: N.g.branches.length } : null; }
  };
}
