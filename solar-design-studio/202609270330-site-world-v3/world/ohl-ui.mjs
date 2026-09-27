// Overhead line safety zones on the page: a layer that draws the zones on the ground from the grid layer's conductors,
// the design checks (ohl-zones.mjs), a short readout with the working height input, and the bill rows.
// Nothing is fetched: the conductors are the grid layer's own (layer.wires()), the design is the one in memory.
// A frame is drawn only when something changes (the substrate's frame gate): 0 fps when still.
import { buildSpans, zoneRings, checkDesign, designItems } from './ohl-zones.mjs';
import { DISCLAIMER, WORKING_HEIGHT, ZONES } from './ohl-gs6.mjs';
import { dashRing, drapePieces } from './layers/buffers.mjs';

export const ID = 'ohl-safety';
export const COLORS = { zone: [1.0, 0.62, 0.25, 0.85], barrier: [1.0, 0.38, 0.30, 0.9], flag: [1.0, 0.30, 0.30, 1], goalpost: [1.0, 1.0, 1.0, 0.95] };
const LIFT_M = 0.12, CROSS_M = 2, POST_M = 5, POST_HALF_M = 3; // marker sizes, metres (symbols, not designs)

// Pure: the readout line. No flag is never shown as a good sign: places without a flag are not assessed.
export function readout(spans, result, height) {
  if (!spans.length) return 'Overhead line zones: no overhead line conductors drawn near here yet.';
  const n = f => result.flags.filter(x => x.flag === f).length;
  const items = new Set(result.flags.filter(f => f.flag !== 'height').map(f => f.item)).size;
  const parts = [`Overhead line zones round ${spans.length} span${spans.length === 1 ? '' : 's'}`,
    items ? `${items} design item${items === 1 ? '' : 's'} inside a zone (${n('crosses')} crossing under)` : 'no design item flagged (not assessed beyond the zones)',
    result.goalposts.length ? `${result.goalposts.length / 2} goalpost crossing${result.goalposts.length === 2 ? '' : 's'} suggested` : '',
    height > 0 ? `plant ${height} m tall (user-set) reaches an exclusion distance at ${n('height')} item${n('height') === 1 ? '' : 's'}` : '',
    result.unmeasured ? `${result.unmeasured} points not assessed: no measured ground` : ''];
  return parts.filter(Boolean).join(' · ') + '.';
}

// Pure: the bill items: one per design item with any flag, counting its zone flags, height flags and goalposts.
export function boqItems(result) {
  const by = new Map();
  const get = id => { if (!by.has(id)) by.set(id, { id: `ohl-${id}`, kind: 'ohlZone', zone: 0, height: 0, goalposts: 0 }); return by.get(id); };
  for (const f of result.flags) get(f.item)[f.flag === 'height' ? 'height' : 'zone']++;
  for (const g of result.goalposts) get(g.item).goalposts++;
  return [...by.values()];
}

// Pure: goalpost marker at (x, y) across a road heading (dx, dy): two posts and a crossbar, xyz pairs relative to o.
export function goalpostLines(x, y, dx, dy, heightAt, o) {
  const L = Math.hypot(dx, dy) || 1, px = -dy / L * POST_HALF_M, py = dx / L * POST_HALF_M, out = [];
  const g = (a, b) => (Number.isFinite(heightAt(a, b)) ? heightAt(a, b) : o[2]);
  const P = (a, b, up) => [a - o[0], b - o[1], g(a, b) + up - o[2]];
  const A = [x + px, y + py], B = [x - px, y - py];
  out.push(...P(...A, 0), ...P(...A, POST_M), ...P(...B, 0), ...P(...B, POST_M), ...P(...A, POST_M), ...P(...B, POST_M));
  return out;
}

// deps: { grid() -> grid layer or null, gridShown() -> bool, design() snapshot, origin(), measuredAt, invalidate() }
export function createOhlLayer({ grid, gridShown = () => true, design, origin, measuredAt, invalidate = () => {} }) {
  let enabled = true, height = WORKING_HEIGHT.defaultM, spans = [], rings = [], result = { flags: [], goalposts: [], unmeasured: 0 };
  let wiresKey = '', checkKey = '', cache = { key: null, batches: [] }, version = 0;
  const layer = {
    id: ID, status: 'waiting for the grid layer', summary: DISCLAIMER,
    get enabled() { return enabled; },
    setEnabled(on) { enabled = !!on; invalidate(); return enabled; },
    setHeight(h) { const v = Number(h); if (Number.isFinite(v)) { height = Math.min(WORKING_HEIGHT.maxM, Math.max(WORKING_HEIGHT.minM, v)); refresh(); invalidate(); } return height; },
    height: () => height, result: () => result, spans: () => spans, boqItems: () => boqItems(result),
    refresh, lines, debug: () => ({ enabled, spans: spans.length, flags: result.flags.length, goalposts: result.goalposts.length, height })
  };
  // Rebuilds the zones when the grid's conductors change, and the checks when the design, ground or height changes.
  function refresh(groundVersion = 0) {
    const w = grid()?.wires?.(), o = origin();
    if (!w || !w.origin || w.origin.e !== o.e || w.origin.n !== o.n) { layer.status = 'waiting for the grid layer to draw'; return false; }
    if (w.version !== wiresKey) { spans = buildSpans(w.wires); rings = zoneRings(spans); wiresKey = w.version; checkKey = ''; version++; }
    const d = design(), key = `${wiresKey}|${height}|${groundVersion}|${JSON.stringify([d.trenches, d.cables, d.works])}`;
    if (key !== checkKey) {
      result = checkDesign(designItems(d, o), spans, measuredAt, { height });
      checkKey = key; version++;
    }
    layer.status = `${readout(spans, result, height)} Zone ${ZONES.planning.m} m or more from the nearest `
      + `conductor plus sway, barrier line ${ZONES.barrier.m} m plus sway (HSE GS6 paragraphs 11 and 19); tower heights and sag assumed`;
    return true;
  }
  function lines(ctx) {
    if (!enabled || !gridShown()) return [];
    refresh(ctx.groundVersion || 0);
    const key = `${version}@${ctx.groundVersion || 0}`;
    if (cache.key === key && cache.heightAt === ctx.heightAt) return cache.batches;
    const batches = [], h = ctx.heightAt, fin = (x, y) => (Number.isFinite(h(x, y)) ? h(x, y) : 0);
    for (const r of rings) for (const kind of ['zone', 'barrier']) {
      const pieces = r[kind].flatMap(ring => dashRing(ring, kind === 'zone' ? { dash: 4, gap: 2 } : { dash: 1.5, gap: 1.5 }));
      if (!pieces.length) continue;
      const [x, y] = r[kind][0][0], o = [x, y, fin(x, y)];
      batches.push({ key: `${ID}/${kind}/${r.line}`, version: key, origin: o, color: COLORS[kind], positions: drapePieces(pieces, h, LIFT_M, o) });
    }
    if (result.flags.length) {
      const c = CROSS_M / 2, pieces = result.flags.flatMap(({ at: [px, py] }) => [[px - c, py - c, px + c, py + c], [px - c, py + c, px + c, py - c]]);
      const [x, y] = result.flags[0].at, o = [x, y, fin(x, y)];
      batches.push({ key: `${ID}/flags`, version: key, origin: o, color: COLORS.flag, positions: drapePieces(pieces, h, LIFT_M * 2, o) });
    }
    if (result.goalposts.length) {
      const [x, y] = result.goalposts[0].at, o = [x, y, fin(x, y)], out = [];
      for (let i = 0; i + 1 < result.goalposts.length; i += 2) {
        const a = result.goalposts[i].at, b = result.goalposts[i + 1].at;
        out.push(...goalpostLines(a[0], a[1], b[0] - a[0], b[1] - a[1], h, o), ...goalpostLines(b[0], b[1], b[0] - a[0], b[1] - a[1], h, o));
      }
      batches.push({ key: `${ID}/goalposts`, version: key, origin: o, color: COLORS.goalpost, positions: new Float32Array(out) });
    }
    cache = { key, heightAt: h, batches };
    return batches;
  }
  return layer;
}

// The readout under the Layers panel: one line, the working height input and the fixed disclaimer.
export function mountOhlControl(host, layer) {
  if (!host || !layer) return null;
  const doc = host.ownerDocument || document, box = doc.createElement('fieldset');
  box.className = 'sun-time ohl-box';
  box.hidden = true;
  box.innerHTML = '<legend>Overhead line safety zones</legend>'
    + `<label>Working height, m (user-set: tallest plant or load) <input type="number" inputmode="decimal" min="${WORKING_HEIGHT.minM}" `
    + `max="${WORKING_HEIGHT.maxM}" step="0.5" data-ohl="height"></label>`
    + '<p class="note" aria-live="polite" data-ohl="readout"></p><p class="note" data-ohl="disclaimer"></p>';
  const input = box.querySelector('[data-ohl="height"]'), line = box.querySelector('[data-ohl="readout"]');
  box.querySelector('[data-ohl="disclaimer"]').textContent = DISCLAIMER;
  input.value = String(layer.height());
  input.addEventListener('change', () => { input.value = String(layer.setHeight(input.value)); update(); });
  const update = () => { line.textContent = readout(layer.spans(), layer.result(), layer.height()); };
  host.appendChild(box);
  update();
  return { element: box, show(v) { box.hidden = !v; if (v) update(); }, update };
}

// Page wiring, kept here so the substrate stays small. items: loadLayers(...).layers; the zones layer joins them before
// the Layers panel is drawn. Switching the grid on switches its zones on with it (they are on whenever the grid is).
// Returns { layer, onChange(ids, panel), mount(host, panel), update() }.
export function attachOhl(items, deps) {
  const gridItem = () => items.find(l => l.id === 'grid');
  const layer = createOhlLayer({ ...deps, grid: () => gridItem()?.layer || null, gridShown: () => !!gridItem()?.layer && !gridItem().hidden });
  items.push({ id: ID, layer, status: 'loaded, worked out on the page from the grid layer' });
  let gridWasOn = false, ui = null;
  return {
    layer,
    onChange(ids, panel) {
      if (ids.includes('grid') && !gridWasOn && !ids.includes(ID)) setTimeout(() => panel()?.set(ID, true));
      gridWasOn = ids.includes('grid'); ui?.show(ids.includes(ID));
    },
    mount(host, panel) { ui = mountOhlControl(host, layer); ui?.show(!!panel()?.isOn(ID)); },
    update: () => ui?.update()
  };
}
