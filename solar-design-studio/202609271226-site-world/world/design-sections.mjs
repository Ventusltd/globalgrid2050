// design-sections.mjs: the parts of the Design panel that follow a specification, kept out of design-ui.mjs.
//   Options        specification, ground condition (alluvium) and the generic MV network (design-options.mjs)
//   Plant layout   a plant laid out inside a drawn boundary on the measured ground (plant-ui.mjs)
//   Solar block    the 10 MVA station block, built in sequence and ringed to the grid (block-ui.mjs)
// Each loads the first time its section opens (or its world.plant / world.block call is made), so none of it is on
// the first frame. Until Options loads, trenches are dug to the network operator spec in normal ground.
// Close to the viewer every trench shows its true cross-section and every cable its outside diameter.

import { OPERATOR_SPEC, applyGround, looseSpoil } from './spec-rules.mjs';
import { crossSection, sectionLines, tubeLines } from './trench-section.mjs';
import { createTrench } from './trench.mjs';
import { formatLength, formatVolume } from './measure-format.mjs';
import { mountDesignTabs } from './design-tabs.mjs';

// The sections' markup, put into the Design panel when this module loads (after the first frame), so world.html
// stays light: the Plant tab gains the specification, ground and MV network, and Plant layout and Solar block folds.
const OPTIONS_HTML = `
    <label>Specification <select id="spec-source">
      <option value="operator">Network operator spec</option>
      <option value="project">Project specification (local file)</option>
      <option value="example">Example specification (made-up values)</option>
    </select></label>
    <input type="file" id="spec-file" accept=".json,application/json" hidden>
    <label>Ground condition <select id="ground-condition"><option value="normal">Normal ground</option></select></label>
    <details class="fold" id="mv-fold"><summary>MV network (generic)</summary>
      <label>Plant size (MW) <input type="number" id="mv-mw" min="1" max="5000" step="1" value="50"></label>
      <label>Route file, drawing coordinates (optional) <input type="file" id="mv-routes-file" accept=".json,application/json"></label>
      <label>Metres per drawing unit <input type="number" id="mv-scale" min="0.001" step="any" value="1"></label>
      <div class="row">
        <button type="button" id="mv-place">Place MV network here</button>
        <button type="button" id="mv-clear">Clear network</button>
      </div>
    </details>
    <p id="spec-status" role="status"></p>`;
const SECTIONS_HTML = `
  <details class="fold" id="plant"><summary>Plant layout</summary>
    <div class="row" id="plant-presets" hidden role="group" aria-label="Capacity presets">
      <button type="button" data-mw="10">10 MW</button><button type="button" data-mw="100">100 MW</button><button type="button" data-mw="1000">1000 MW</button>
    </div>
    <label>Capacity, export (MW) <input type="number" id="plant-mw" min="1" max="5000" step="1" value="100"></label>
    <label>Layout <select id="plant-layout"></select></label>
    <label>Slope limit (%) <input type="number" id="plant-slope" min="1" max="40" step="1" value="15"></label>
    <label>Tables inside the fence (m, 5 to 10) <input type="number" id="plant-fence" min="5" max="10" step="0.5" value="8"></label>
    <div class="row" role="group" aria-label="Plant boundary">
      <button type="button" data-tool="boundary" aria-pressed="false">Draw boundary</button>
      <button type="button" id="plant-open">Use the open land around me</button>
    </div>
    <div class="row">
      <button type="button" id="plant-run">Lay out</button>
      <button type="button" id="plant-clear">Clear layout</button>
    </div>
    <p id="plant-status" role="status"></p>
    <dl id="plant-readout" aria-live="polite"></dl>
  </details>
  <details class="fold" id="block"><summary>Solar block (10 MVA station)</summary>
    <label>Stations on the 33 kV rings (1 to 10) <input type="number" id="block-stations" min="1" max="10" step="1" value="4"></label>
    <label>Grid connection <select id="block-poc"><option value="400" selected>400 kV</option><option value="275">275 kV</option>
      <option value="132">132 kV</option></select></label>
    <div class="row">
      <button type="button" id="block-place">Place block here</button>
      <button type="button" id="block-clear">Clear block</button>
    </div>
    <div class="row"><button type="button" id="block-gpu" title="The GPU study's placement on open-land-01, illustrative">GPU-checked placement</button>
      <button type="button" id="block-export" aria-pressed="false"
        title="The GPU study's 33 kV export route to the nearest substation, illustrative">Export route (GPU-checked, illustrative)</button></div>
    <div class="row" role="group" aria-label="Build sequence">
      <button type="button" id="block-play">Play</button><button type="button" id="block-pause">Pause</button>
      <button type="button" id="block-step">Step</button>
    </div>
    <p id="block-stage" aria-live="polite"></p>
    <p id="block-status" role="status"></p>
    <dl id="block-readout" aria-live="polite"></dl>
    <details class="fold" id="block-cables"><summary>Cable checks (illustrative)</summary><div id="cables-box"></div></details>
  </details>`;
const NEAR_M = 25; // full cross-sections within this distance of the viewer; beyond, only the trench outline
const COLOUR = { section: [0.95, 0.9, 0.7, 1], cable: [0.55, 1, 0.62, 1] };

// deps: { doc, origin(), viewer(), measuredAt(x, y), heightAt(x, y) designed ground, baseHeight(x, y) layers' ground,
//   assets() -> grid equipment in reach, nearest(e, n) -> Promise<substation | null> (national index), redraw(),
//   animate() (the block's build sequence started or stopped), onChange() (the specification or ground changed) }
export function createSections({ doc, origin, viewer, measuredAt, heightAt, baseHeight, assets = () => [], nearest = null,
  redraw, animate = () => {}, onChange = () => {} }) {
  const $ = id => doc.getElementById(id);
  if (!$('spec-source')) ($('design-spec') || $('design-options'))?.insertAdjacentHTML('beforeend', OPTIONS_HTML);
  if (!$('plant')) ($('design-spec') ? $('design-spec').insertAdjacentHTML('afterend', SECTIONS_HTML)
    : ($('phases-fold') || $('design-profile-box'))?.insertAdjacentHTML('beforebegin', SECTIONS_HTML));
  let options = null, plant = null, block = null;
  const loading = {};
  const once = (name, load) => (loading[name] ||= load().catch(e => { loading[name] = null; console.warn(`${name}: ${e.message}`); return null; }));
  const loadOptions = () => once('options', async () => {
    const { createOptions } = await import('./design-options.mjs');
    options = createOptions({ doc, viewer, heightAt, redraw, onChange });
    onChange();
    return options;
  });
  const loadPlant = () => once('plant', async () => {
    const { createPlant } = await import('./plant-ui.mjs');
    return (plant = createPlant({ doc, origin, viewer, measuredAt: measuredAt || baseHeight, heightAt, assets, nearest, redraw }));
  });
  const loadBlock = () => once('block', async () => {
    const { createBlock } = await import('./block-ui.mjs');
    block = createBlock({ doc, origin, viewer, measuredAt: measuredAt || baseHeight, heightAt: baseHeight, redraw, animate,
      towers: () => assets().filter(a => a.kind === 'tower' && Number.isFinite(a.kv)) });
    return block;
  });
  $('design-options-toggle')?.addEventListener('click', () => loadOptions());
  // Build, Measure, Plant, Share (design-tabs.mjs): the specification and ground load when Plant first opens.
  const tabs = mountDesignTabs(doc, { onFirstOpen: { plant: () => loadOptions() } });
  $('plant')?.addEventListener('toggle', e => { if (e.target.open) loadPlant(); });
  $('block')?.addEventListener('toggle', e => { if (e.target.open) loadBlock(); });
  // The cable schedule as illustrative checks (cable-checks-ui.mjs): loaded the first time its fold opens.
  let cables = null;
  const loadCables = () => once('cables', async () => (cables = await (await import('./cable-checks-ui.mjs')).mountCableChecks({ doc, box: $('cables-box') })));
  $('block-cables')?.addEventListener('toggle', e => { if (e.target.open) loadCables(); });

  const spec = () => options?.spec() || OPERATOR_SPEC, ground = () => options?.ground() || 'normal';
  // The trench as it will be dug: the section, under the chosen specification and ground condition.
  const effOf = section => applyGround(section, spec(), ground());
  const cross = (section, eff, cableOdMm) => crossSection(section, eff, { cableOdMm, tapeAboveM: spec().marker.tape_above_service_m });

  return {
    effOf, cross,
    // Readout rows for the specification and ground, and the loose spoil once the bank volume is known.
    rows: eff => [['Specification', eff.specLabel], ['Ground', eff.groundLabel], ['Support', eff.support],
      ['Working width', formatLength(eff.workingWidth)], ...eff.notes.map((n, i) => [i ? '' : 'Notes', n])],
    spoilRows: (spoil, eff) => (eff.bulking > 1 && spoil ? [['Spoil, loose', formatVolume(looseSpoil(spoil, eff), 2)]] : []),
    // The solar block's open trenches (they cut the ground like any other) and a key that changes when they do.
    key: () => block?.key() || '',
    extra(toLocalPts) {
      const list = block?.trenchItems() || [];
      const eff = list.map(t => effOf(t.section));
      return { trenches: list.map((t, i) => createTrench({ path: toLocalPts(t.path), width: eff[i].width, depth: eff[i].depth,
        benchSlope: eff[i].benchSlope })), sections: list.map((t, i) => cross(t.section, eff[i], t.cableOdMm)) };
    },
    // Close up: true cross-sections and cable tubes, rebuilt when the viewer moves a few metres.
    // b: design-ui's build ({ key, trenches, sections, cables, near }); batch(key, version, positions, colour).
    detail(b, batch) {
      const out = [], eye = viewer().pos, k = `${b.key}:${Math.round(eye[0] / 4)}:${Math.round(eye[1] / 4)}:${Math.round(eye[2] / 4)}`;
      b.trenches.forEach((t, i) => {
        const x = t.bbox;
        if (!x || !b.sections[i] || eye[0] < x.minX - NEAR_M || eye[0] > x.maxX + NEAR_M || eye[1] < x.minY - NEAR_M || eye[1] > x.maxY + NEAR_M) return;
        if (b.near[i]?.k !== k) b.near[i] = { k, v: sectionLines({ trench: t, groundAt: baseHeight, cs: b.sections[i], eye, near: NEAR_M }) };
        out.push(batch('design-section-' + i, k, b.near[i].v, COLOUR.section));
      });
      b.cables.forEach((c, i) => {
        if (b.near['c' + i]?.k !== k) {
          const v = [];
          // Append in a loop: spreading a long route (several km of cable tubes) into push overflows the call stack.
          for (const core of c.cores) for (const run of nearRuns(core.polyline, eye, NEAR_M)) {
            const t = tubeLines(run, c.spec.od_mm / 1000, { eye, near: NEAR_M });
            for (let j = 0; j < t.length; j++) v.push(t[j]);
          }
          b.near['c' + i] = { k, v };
        }
        out.push(batch('design-cable-' + i, k, b.near['c' + i].v, COLOUR.cable));
      });
      return out;
    },
    batches: () => [...(options?.batches() || []), ...(plant?.batches() || []), ...(block?.batches() || [])],
    // The Boundary tool (in Plant layout) hands its closed outline over on Done.
    setBoundary: async path => !!(await loadPlant())?.setBoundary(path),
    animating: () => !!block?.animating(),
    snapshot: () => ({ options: options?.snapshot() || { spec: spec().label, source: spec().source, ground: ground(), network: null },
      plant: plant?.snapshot() || null, block: block?.snapshot() || null }),
    plantApi: Object.freeze({ run: async () => (await loadPlant())?.run() ?? null, openLand: async () => (await loadPlant())?.useOpenLand(),
      summary: () => plant?.snapshot() || null }),
    tabs,
    blockApi: Object.freeze({ place: async () => (await loadBlock())?.place(), placeGpu: async () => (await loadBlock())?.placeGpu(), play: () => block?.play() ?? false, pause: () => block?.pause(),
      step: () => block?.step(), clear: () => block?.clear(), counts: () => block?.counts() ?? null, state: () => block?.snapshot() ?? null,
      cables: async () => { await loadCables(); return cables; } })
  };
}

// Pure: the stretches of a polyline within near metres (plan distance) of the eye, each with one point either side,
// so a long cable route only builds tubes where the viewer can see them.
export function nearRuns(pl, eye, near) {
  const runs = []; let cur = null; const n2 = near * near;
  const close = p => (p[0] - eye[0]) ** 2 + (p[1] - eye[1]) ** 2 <= n2;
  for (let i = 0; i < pl.length; i++) {
    const inside = close(pl[i]) || (i + 1 < pl.length && close(pl[i + 1])) || (i > 0 && close(pl[i - 1]));
    if (inside) { if (!cur) { cur = []; runs.push(cur); } cur.push(pl[i]); } else cur = null;
  }
  return runs.filter(r => r.length > 1);
}
