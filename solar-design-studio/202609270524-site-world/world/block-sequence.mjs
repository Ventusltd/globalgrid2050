// block-sequence.mjs: the order a solar block is built in, as a clock the page can play, pause and step.
//
// Stages run one after another; each has a length in seconds at normal speed. progress(t) says, for a time t, how
// far every stage has got (0 before it starts, 1 once done), so drawing is a pure function of t: pausing freezes t
// and nothing is redrawn. The clock never runs a timer of its own; the page asks it for t while it is playing
// and draws at its own capped rate (30 fps), and asks nothing while it is paused (0 fps).
// Pure: no imports, no DOM.

export const STAGES = Object.freeze([
  { id: 'trenches', label: 'Trenches dug (DC and AC)', seconds: 3 },
  { id: 'tables', label: 'Piles driven, tables built', seconds: 6 },
  { id: 'strings', label: 'Modules strung: 30 in series, 24 strings per inverter', seconds: 5 },
  { id: 'inverters', label: 'Inverters mounted on their poles', seconds: 3 },
  { id: 'dc', label: 'DC home cables pulled along the trenches', seconds: 6 },
  { id: 'ac', label: 'AC phase cables pulled to the transformers', seconds: 4 },
  { id: 'station', label: 'Station transformers set; station energised', seconds: 2 },
  { id: 'mv', label: '33 kV ring cables pulled, ring main units joined', seconds: 5 },
  { id: 'grid', label: 'MV board, grid transformer and connection energised', seconds: 3 }
]);

export const TOTAL = STAGES.reduce((t, s) => t + s.seconds, 0);

// Start time of each stage.
export const STARTS = Object.freeze(STAGES.reduce((a, s, i) => (a.push(i ? a[i - 1] + STAGES[i - 1].seconds : 0), a), []));

const clamp01 = x => Math.min(1, Math.max(0, x));

/** progress(t) -> { stageId: 0..1 } for every stage. */
export function progress(t) {
  const out = {};
  STAGES.forEach((s, i) => { out[s.id] = clamp01((t - STARTS[i]) / s.seconds); });
  return out;
}

/** The stage running at t (the last one once everything is built). */
export function stageAt(t) {
  for (let i = 0; i < STAGES.length; i++) if (t < STARTS[i] + STAGES[i].seconds) return { index: i, ...STAGES[i] };
  return { index: STAGES.length - 1, ...STAGES.at(-1), done: true };
}

/** Of n items revealed in order over a stage at fraction f: how many are complete, and how far the next one is. */
export function reveal(n, f) {
  const x = clamp01(f) * n, whole = Math.min(n, Math.floor(x + 1e-9));
  return { whole, part: whole < n ? x - whole : 0 };
}

/** The first fraction f (0..1) of a polyline [[x, y, z], ...] by length: the cable pulled in so far. */
export function partial(points, f) {
  if (f >= 1) return points;
  if (f <= 0 || points.length < 2) return [points[0]];
  let total = 0;
  const seg = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    seg.push(l); total += l;
  }
  let want = f * total;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], l = seg[i - 1];
    if (want >= l) { out.push(b); want -= l; continue; }
    const k = l > 0 ? want / l : 0;
    out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
    break;
  }
  return out;
}

/**
 * createClock({ now }) -> { t(), playing(), play(), pause(), step(), reset(), finish() }
 * t() is seconds of build time; it moves only while playing. step() pauses and jumps to the next stage boundary.
 */
export function createClock({ now = () => performance.now(), speed = 1 } = {}) {
  let base = TOTAL, since = null;           // placed blocks start complete; Play from the end starts again
  const t = () => (since === null ? base : Math.min(TOTAL, base + (now() - since) / 1000 * speed));
  const clock = {
    t,
    playing: () => since !== null && t() < TOTAL,
    play() { if (t() >= TOTAL) base = 0; since = now(); return clock; },
    pause() { base = t(); since = null; return clock; },
    step() {
      const cur = t() >= TOTAL ? 0 : t();
      base = STARTS.find(s => s > cur + 1e-6) ?? TOTAL; since = null; return clock;
    },
    reset() { base = 0; since = null; return clock; },
    finish() { base = TOTAL; since = null; return clock; }
  };
  return clock;
}
