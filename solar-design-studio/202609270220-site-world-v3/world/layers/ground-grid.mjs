// Layer: ground grid. A 1 m grid near the viewer and a 10 m grid to the horizon, draped on whatever
// ground the world has (flat until a terrain layer supplies heightAt). The grid follows the viewer in
// 10 m steps, so it looks endless but only ever holds a few thousand lines.
// Within 100 m of the viewer every segment is split to 2 m or less, so the grid follows real banks and
// ditches rather than bridging them. Batches carry an origin at the centre of the viewer's 10 m cell and
// positions relative to it, so they stay sharp on the GPU. The grid is rebuilt on a new cell or new ground.
//
// Cost: every grid point is a heightAt call, and real terrain makes those dear (about 45,000 per rebuild
// before, when each segment asked for both ends). Now each point is asked for once: heights are kept in
// a store for one ground (one heightAt and groundVersion), so stepping into a new 10 m cell only asks for
// the strip of points that came into view. New ground starts a new store and nothing old is trusted: the
// first frame asks again for everything within 50 m (the 1 m grid and the nearest banks and ditches), and
// the next few frames widen that to 150 m, 300 m and the horizon. Until a far point is asked again it is
// drawn at its height on the previous ground, so a new tile never stalls a walk for a whole rebuild.

const MINOR = { spacing: 1, radius: 30, color: [156 / 255, 219 / 255, 1, 0.16] };  // #9cdbff
const MAJOR = { spacing: 10, radius: 400, color: [156 / 255, 219 / 255, 1, 0.42] };
const ORIGIN = { color: [1, 1, 1, 0.9], arm: 5 };
const FOLLOW = 10;
export const DETAIL = { radius: 100, step: 2 }; // near the viewer, no segment is longer than 2 m
export const REACH = [50, 150, 300, Infinity];  // metres asked again on the frames after new ground
let cached = { version: null, batches: [] };
let store = null, api = null;

export default {
  id: 'ground-grid',
  init(a) { api = a; },
  // ctx: { pos, heightAt, groundVersion?, origin? }
  lines({ pos, heightAt, groundVersion = 0 }) {
    const cx = Math.floor(pos[0] / FOLLOW) * FOLLOW, cy = Math.floor(pos[1] / FOLLOW) * FOLLOW;
    const version = cx + ',' + cy + '@' + groundVersion, same = cached.version === version && cached.heightAt === heightAt;
    if (same && cached.pass === store.pass) return cached.batches; // new cell, new ground or a wider reach only
    if (!store || !store.fits(heightAt, groundVersion)) store = heightStore(heightAt, groundVersion, cx, cy, api ? store : null);
    const mx = cx + FOLLOW / 2, my = cy + FOLLOW / 2, sample = store.begin(mx, my), mz = sample(mx, my);
    const origin = [mx, my, mz], opts = { origin, near: [mx, my], sample };
    const step = store.pass ? '#' + store.pass : '', tag = version + step;
    const minor = same && cached.minorWhole ? cached.batches[0]
      : { key: 'ground-grid/minor', version: tag, origin, color: MINOR.color, positions: grid(cx, cy, MINOR, heightAt, opts) };
    const minorWhole = !store.partial;
    const major = { key: 'ground-grid/major', version: tag, origin, color: MAJOR.color, positions: grid(cx, cy, MAJOR, heightAt, opts) };
    const mark = { key: 'ground-grid/origin', version: 'origin@' + groundVersion + step, color: ORIGIN.color, positions: originMark(sample, mz) };
    cached = { version, heightAt, pass: store.pass, minorWhole, batches: [minor, major, mark] };
    if (store.partial) later(store); // after this frame: widen the reach and ask for another frame
    return cached.batches;
  }
};

// Only with a live page (init gave an api to ask for frames) does new ground arrive in steps; without
// one, every rebuild asks for every point it lacks.
function later(s) {
  setTimeout(() => { if (s === store && s.partial) { s.widen(); api.invalidate({ ground: false }); } }, 0);
}

// Lines of the grid centred on (cx, cy). Positions are relative to opts.origin ([0, 0, 0] by default).
// Segments whose midpoint lies within DETAIL.radius of opts.near are split to DETAIL.step or less.
// opts.sample(x, y, guess), if given, is used in place of heightAt and must return a finite height; guess is
// the height of the point before it on the line (the origin's for the first), for a sampler that may guess.
export function grid(cx, cy, { spacing, radius }, heightAt, { origin = [0, 0, 0], near = null, sample = null } = {}) {
  const h = sample || ((x, y) => finite(heightAt(x, y)));
  const n = Math.round(radius / spacing), pieces = spacing > DETAIL.step ? Math.ceil(spacing / DETAIL.step) : 1;
  const [ox, oy, oz] = origin, r2 = DETAIL.radius * DETAIL.radius;
  // How many pieces the segment from b0 to b0 + spacing along a line at offset a is cut into.
  const split = pieces > 1 && near
    ? (ax, ay, bx, by) => { const dx = (ax + bx) / 2 - near[0], dy = (ay + by) / 2 - near[1]; return dx * dx + dy * dy <= r2 ? pieces : 1; }
    : () => 1;
  let count = 0;
  for (let i = -n; i <= n; i++) {
    const a = i * spacing;
    for (let j = -n; j < n; j++) {
      const b0 = j * spacing, b1 = b0 + spacing;
      count += split(cx + a, cy + b0, cx + a, cy + b1) + split(cx + b0, cy + a, cx + b1, cy + a);
    }
  }
  const out = new Float32Array(count * 6);
  let w = 0;
  for (let i = -n; i <= n; i++) {
    const a = i * spacing;
    for (let dir = 0; dir < 2; dir++) { // 0: north-south line at x = cx + a; 1: east-west line at y = cy + a
      let px = dir ? cx - n * spacing : cx + a, py = dir ? cy + a : cy - n * spacing, pz = h(px, py, oz);
      for (let j = -n; j < n; j++) {
        const b0 = j * spacing, b1 = b0 + spacing;
        const x0 = dir ? cx + b0 : cx + a, y0 = dir ? cy + a : cy + b0, x1 = dir ? cx + b1 : cx + a, y1 = dir ? cy + a : cy + b1;
        const k = split(x0, y0, x1, y1);
        for (let p = 0; p < k; p++) {
          const qx = x0 + (x1 - x0) * (p + 1) / k, qy = y0 + (y1 - y0) * (p + 1) / k, qz = h(qx, qy, pz); // whole metres stay whole
          out[w++] = px - ox; out[w++] = py - oy; out[w++] = pz - oz;
          out[w++] = qx - ox; out[w++] = qy - oy; out[w++] = qz - oz;
          px = qx; py = qy; pz = qz;
        }
      }
    }
  }
  return out;
}

// Heights asked for once per ground, kept in fixed typed arrays that wrap around as the viewer walks
// (no Map, nothing to trim). A whole-metre point on a 10 m line has a slot in one of two line planes;
// any other whole-metre point near the viewer has one in the inner plane; each slot remembers which point
// and which ground it holds. Other points go straight to heightAt. A store serves one heightAt and one
// groundVersion. When the store before it had the same heightAt, a new store asks only within its reach
// of the centre and answers further points from older ground (or the guess), marking itself partial.
const LINES = 2 * Math.ceil(MAJOR.radius / MAJOR.spacing) + 4, ALONG = 2 * MAJOR.radius + 4 * FOLLOW, INNER = 2 * MINOR.radius + 12;
let slots = null, generation = 0;
const wrap = (v, m) => ((v % m) + m) % m;
function slotOf(x, y) {
  if ((x | 0) !== x || (y | 0) !== y) return -1;
  if (x % MAJOR.spacing === 0) return wrap(x / MAJOR.spacing, LINES) * ALONG + wrap(y, ALONG);
  if (y % MAJOR.spacing === 0) return (LINES + wrap(y / MAJOR.spacing, LINES)) * ALONG + wrap(x, ALONG);
  return 2 * LINES * ALONG + wrap(x, INNER) * INNER + wrap(y, INNER);
}
function heightStore(heightAt, groundVersion, cx, cy, before) {
  if (!slots) {
    const n = 2 * LINES * ALONG + INNER * INNER;
    slots = { z: new Float64Array(n), x: new Int32Array(n).fill(-0x80000000), y: new Int32Array(n), gen: new Uint32Array(n) };
  }
  const { z, x: sx, y: sy, gen } = slots, g = ++generation;
  const guessing = !!before && before.heightAt === heightAt;
  let pass = guessing ? 0 : REACH.length - 1, reach2 = REACH[pass] ** 2, mx = 0, my = 0;
  const self = {
    heightAt, partial: false,
    get pass() { return pass; },
    sample(x, y, guess = 0) {
      const k = slotOf(x, y);
      if (k < 0) return finite(heightAt(x, y));
      const held = sx[k] === x && sy[k] === y;
      if (held && gen[k] === g) return z[k];
      if ((x - mx) ** 2 + (y - my) ** 2 > reach2) { self.partial = true; return held ? z[k] : guess; } // older ground
      const h = finite(heightAt(x, y));
      z[k] = h; sx[k] = x; sy[k] = y; gen[k] = g;
      return h;
    },
    begin(x, y) { mx = x; my = y; self.partial = false; return self.sample; },
    widen() { pass = Math.min(pass + 1, REACH.length - 1); reach2 = REACH[pass] ** 2; },
    fits: (f, gv) => f === heightAt && gv === groundVersion && g === generation
  };
  return self;
}

function originMark(sample, guess) {
  const a = ORIGIN.arm, h = sample(0, 0, guess);
  return new Float32Array([-a, 0, h, a, 0, h, 0, -a, h, 0, a, h, 0, 0, h, 0, 0, h + 2 * a]);
}

const finite = h => (Number.isFinite(h) ? h : 0);
