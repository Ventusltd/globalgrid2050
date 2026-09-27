// Layer: buffers. Offset zones around features (overhead lines, watercourses, roads, trees, hedges, drawn items)
// drawn as dashed outlines on the ground, and a small cross wherever a drawn item enters a zone.
// Off by default: until setEnabled(true) (or api.config.enabled) it draws nothing.
// Self-contained: no imports (it runs from a blob URL). The zones are worked out by web/world/buffers.mjs on the
// page and handed in with setZones(zones); clashes from checkClashes with setClashes(list). Zone rings are local
// metres from the site origin: [{ id, layer, rule, kind, rings: [[[x, y], ...], ...] }]. Nothing is fetched.
//
// Dashes run continuously round each ring (the pattern carries across corners), are split to STEP_M so they
// follow banks and ditches, and sit LIFT_M above the ground. Batches are rebuilt only on new zones or new ground.

export const DASH_M = 2, GAP_M = 1.5, STEP_M = 1, LIFT_M = 0.08, CROSS_M = 1.2;
// Quiet colours on the dark background, by source layer; drawn-item clearances in white, clashes in red.
export const COLORS = {
  overhead: [1.00, 0.78, 0.40, 0.70],
  water: [0.45, 0.70, 1.00, 0.70],
  roads: [0.78, 0.78, 0.78, 0.60],
  trees: [0.55, 0.88, 0.55, 0.65],
  hedges: [0.55, 0.88, 0.55, 0.65],
  drawn: [1.00, 1.00, 1.00, 0.60],
  clash: [1.00, 0.35, 0.35, 0.95]
};
const OTHER = [0.80, 0.80, 0.80, 0.55];
const finite = h => (Number.isFinite(h) ? h : 0);

// Pure: the dashes of one closed ring as [[x0, y0, x1, y1], ...], each at most `step` long. The pattern starts
// at the first vertex and carries on round the corners, so a dash may bend round one.
export function dashRing(ring, { dash = DASH_M, gap = GAP_M, step = STEP_M } = {}) {
  const out = [], n = ring.length, period = dash + gap;
  if (n < 2 || !(dash > 0) || !(gap >= 0)) return out;
  let s = 0;                                   // distance round the ring so far
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(L > 0)) continue;
    let t = 0;
    while (t < L - 1e-12) {
      const ph = (s + t) % period, inDash = ph < dash - 1e-12;
      const run = Math.min(L - t, inDash ? dash - ph : period - ph, inDash ? step : Infinity);
      if (inDash) out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L,
        a[0] + (b[0] - a[0]) * (t + run) / L, a[1] + (b[1] - a[1]) * (t + run) / L]);
      t += run;
    }
    s += L;
  }
  return out;
}

// Pure: draped xyz pairs for 2D pieces, relative to origin o, lift metres above heightAt. A piece with an end where
// known(x, y) is false (no surveyed ground) is left out rather than drawn at a guessed height.
export function drapePieces(pieces, heightAt, lift = LIFT_M, o = [0, 0, 0], known = () => true) {
  const out = [];
  for (const [x0, y0, x1, y1] of pieces) {
    if (!known(x0, y0) || !known(x1, y1)) continue;
    out.push(x0 - o[0], y0 - o[1], finite(heightAt(x0, y0)) + lift - o[2], x1 - o[0], y1 - o[1], finite(heightAt(x1, y1)) + lift - o[2]);
  }
  return new Float32Array(out);
}

export function createBuffers() {
  let api = null, enabled = false, zones = [], clashes = [], version = 0;
  let cache = { key: null, batches: [] };
  const say = s => { layer.status = s; };
  const describe = () => (enabled ? `${zones.length} zones, ${clashes.length} clashes` : 'off');

  const layer = {
    id: 'buffers',
    status: 'waiting for init',
    init(a) {
      api = a;
      if (a.config?.enabled) enabled = true;
      say(describe());
    },
    setEnabled(on) { enabled = !!on; say(describe()); api?.invalidate({ ground: false }); return enabled; },
    get enabled() { return enabled; },
    // zones: [{ id, layer, rule, kind, rings }] in local metres. Anything without rings is ignored.
    setZones(list) {
      zones = (Array.isArray(list) ? list : []).filter(z => z && Array.isArray(z.rings))
        .map(z => ({ id: String(z.id), layer: z.layer, rule: z.rule, kind: z.kind, rings: z.rings.filter(r => Array.isArray(r) && r.length > 2) }));
      version++; say(describe()); api?.invalidate({ ground: false });
      return zones.length;
    },
    // clashes: [{ zone, item, at: [x, y] }] from checkClashes.
    setClashes(list) {
      clashes = (Array.isArray(list) ? list : []).filter(c => c && Array.isArray(c.at) && Number.isFinite(c.at[0]) && Number.isFinite(c.at[1]));
      version++; say(describe()); api?.invalidate({ ground: false });
      return clashes.length;
    },
    // ctx: { pos, heightAt, groundVersion }
    lines(ctx) {
      if (!enabled || (!zones.length && !clashes.length)) return [];
      const known = typeof ctx.known === 'function' ? ctx.known : undefined;
      const key = `buffers@${version}@${ctx.groundVersion || 0}`;
      if (cache.key === key && cache.heightAt === ctx.heightAt) return cache.batches;
      const batches = [];
      for (const z of zones) {
        const pieces = z.rings.flatMap(r => dashRing(r));
        if (!pieces.length) continue;
        const [x, y] = z.rings[0][0], o = [x, y, finite(ctx.heightAt(x, y))];
        batches.push({ key: `buffers/zone/${z.id}`, version: key, origin: o, color: COLORS[z.layer] || OTHER,
          positions: drapePieces(pieces, ctx.heightAt, LIFT_M, o, known) });
      }
      if (clashes.length) {
        const [x, y] = clashes[0].at, o = [x, y, finite(ctx.heightAt(x, y))], c = CROSS_M / 2;
        const pieces = clashes.flatMap(({ at: [px, py] }) => [[px - c, py - c, px + c, py + c], [px - c, py + c, px + c, py - c]]);
        batches.push({ key: 'buffers/clashes', version: key, origin: o, color: COLORS.clash, positions: drapePieces(pieces, ctx.heightAt, LIFT_M * 2, o, known) });
      }
      cache = { key, heightAt: ctx.heightAt, batches };
      return batches;
    },
    // For tests and the console.
    debug: () => ({ enabled, zones: zones.length, clashes: clashes.length, version })
  };
  return layer;
}

export default createBuffers();
