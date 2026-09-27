// design-options.mjs: the Options part of the Design panel (world.html #design-options).
//   Specification  Network operator spec, the made-up example, or a project specification from a local file.
//                  A local file is read in the browser and kept in memory only; it is never sent anywhere.
//   Ground         Normal ground, or Alluvium / soft wet ground (support or batter, dewatering, spoil handling).
//   MV network     a generic plant block diagram (plant-template.mjs) placed on the ground where you stand,
//                  optionally following a route file in drawing coordinates, drawn as equipment outlines and cables.
// The trench tool asks spec() and ground() when it builds a trench; batches() draws the placed network.

import { OPERATOR_SPEC, readSpec, GROUNDS } from './spec-rules.mjs';
import { plantTemplate } from './plant-template.mjs';
import { placeNetwork, readRoutes, solidLines, cableLines } from './mv-network.mjs';

const COLOUR = { equipment: [0.85, 0.88, 0.95, 1], mv: [1, 0.55, 0.25, 1], hv: [1, 0.3, 0.75, 1], open: [0.6, 0.6, 0.6, 1] };

// deps: { doc, viewer() -> { pos, yaw }, heightAt(x, y), redraw(), onChange() }
export function createOptions({ doc, viewer, heightAt, redraw, onChange = () => {} }) {
  const $ = id => doc.getElementById(id);
  const state = { spec: OPERATOR_SPEC, project: null, ground: 'normal', routes: null, net: null, version: 0 };
  const say = (msg, warn = false) => { const el = $('spec-status'); el.textContent = msg; el.className = warn ? 'warn' : ''; };

  function setSource(v) {
    if (v === 'operator') { state.spec = OPERATOR_SPEC; say('Operator sections, general practice ground rules.'); }
    else if (v === 'project') {
      if (state.project) { state.spec = state.project; say(`${state.project.label} (local file, in memory only)`); }
      else { $('spec-file').click(); return; }                        // choose a file; change fires on load
    } else if (v === 'example') loadExample();
    onChange();
  }
  async function loadExample() {
    try {
      const r = await fetch('./world/data/spec-example.json', { cache: 'no-cache' });
      state.spec = readSpec(await r.json()); say(`${state.spec.label}: every value is made up.`);
    } catch (e) { state.spec = OPERATOR_SPEC; $('spec-source').value = 'operator'; say('Example could not be read: ' + e.message, true); }
    onChange();
  }
  async function readFile(input, parse) {
    const f = input.files && input.files[0];
    if (!f) return null;
    const json = JSON.parse(await f.text());
    input.value = '';                                                  // the same file can be chosen again
    return parse(json);
  }

  $('spec-source').addEventListener('change', e => setSource(e.target.value));
  $('spec-file').addEventListener('change', async e => {
    try {
      state.project = await readFile(e.target, readSpec);
      if (!state.project) return;
      state.spec = state.project; $('spec-source').value = 'project';
      say(`${state.project.label} (local file, in memory only)`);
    } catch (err) { state.spec = OPERATOR_SPEC; $('spec-source').value = 'operator'; say('Specification not used: ' + err.message, true); }
    onChange();
  });
  $('ground-condition').replaceChildren(...GROUNDS.map(([id, label]) => new Option(label, id)));
  $('ground-condition').addEventListener('change', e => { state.ground = e.target.value; onChange(); });

  // ---- MV network ----
  $('mv-routes-file').addEventListener('change', async e => {
    try { state.routes = await readFile(e.target, readRoutes); say(`Route file read: ${state.routes.nodes.size} nodes, drawing units.`); }
    catch (err) { state.routes = null; say('Route file not used: ' + err.message, true); }
  });
  function place() {
    const mw = Number($('mv-mw').value), scale = Number($('mv-scale').value) || 1, v = viewer();
    try {
      const diagram = plantTemplate({ targetMW: mw });
      const net = placeNetwork(diagram, { routes: state.routes, at: [v.pos[0], v.pos[1]], heading: v.yaw || 0,
        metresPerUnit: scale, groundAt: heightAt });
      state.net = { diagram, ...net }; state.version++;
      const c = diagram.counts, fail = diagram.checks.filter(k => !k.ok).map(k => k.name);
      say(`MV network placed: ${c.stations} stations, ${c.feeders} feeders, ${c.boardSections} board sections, `
        + `${c.gridTransformers} grid transformers, ${diagram.ratings.pocKv} kV connection`
        + `${fail.length ? '. Outside limits: ' + fail.join(', ') : '; every level within its limit'}${net.missing.length ? `; ${net.missing.length} nodes not in the route file` : ''}.`,
      fail.length > 0);
    } catch (err) { say(err.message, true); }
    redraw();
  }
  $('mv-place').addEventListener('click', place);
  $('mv-clear').addEventListener('click', () => { state.net = null; state.version++; say('MV network cleared.'); redraw(); });

  function batch(key, pos, color) {
    if (!pos || pos.length < 6) return null;
    const o = [pos[0], pos[1], pos[2]], out = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) out[i] = pos[i] - o[i % 3];
    return { key, version: state.version, positions: out, color, origin: o };
  }
  function batches() {
    const n = state.net;
    if (!n) return [];
    const open = n.cables.filter(c => c.normallyOpen), live = n.cables.filter(c => !c.normallyOpen);
    return [batch('mv-equipment', solidLines(n.equipment.flatMap(e => e.solids)), COLOUR.equipment),
      batch('mv-cables', cableLines(live.filter(c => c.kv < 100)), COLOUR.mv),
      batch('mv-hv', cableLines(live.filter(c => c.kv >= 100)), COLOUR.hv),
      batch('mv-open', cableLines(open), COLOUR.open)].filter(Boolean);
  }
  say('Operator sections, general practice ground rules.');
  return {
    spec: () => state.spec, ground: () => state.ground, batches,
    snapshot: () => ({ spec: state.spec.label, source: state.spec.source, ground: state.ground,
      network: state.net ? { counts: state.net.diagram.counts, ratings: state.net.diagram.ratings, ok: state.net.diagram.ok,
        equipment: state.net.equipment.length, cables: state.net.cables.length } : null })
  };
}
