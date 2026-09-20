// assemble.mjs - the one gathering animation of the estate. Give it a shape and a count, it gives you places;
// give it where the points were, where they are going and how far along, it gives you where they are now.
//
//   import { targets, step, MOVE_MS } from './assemble.mjs';
//   const to = targets('cluster', n);                       // or 'text:GRIDATLAS', 'ring', 'orbit', 'clock'
//   each frame:  step(from, to, (now - t0) / MOVE_MS, out); // from = the places the points had when the move began
//
// SHAPES, named by a string so a program can ask for any of them:
//   'cluster'      one dense round body, every point the same distance from its neighbours (a sunflower disc)
//   'ring'         a thin circle
//   'orbit'        an ellipse with the centre at one focus, as the wafer's "orbit" draws an app
//   'clock'        a dial, twelve ticks and three hands; opts.date sets the time shown (default: now)
//   'text:WORDS'   the words in block capitals; a line break is ' / ' or '\n'. A to Z, 0 to 9, space and . , : - & / '
//   SHAPES         the list above, exported, so a page can offer them without typing them again
//
// WHAT THIS IS LIFTED FROM, AND WHY IT FEELS THE SAME. The Real Systems wafer moves every point by one rule:
//   drawn = from + (target - from) * ease(u),   u = elapsed / 2000 ms,   ease = cubic in and out.
// step() is that rule and nothing else. 'cluster' is the wafer's own core: point j sits at radius sqrt((j + 1/2) / n)
// and angle j * the golden angle, which is how a sunflower packs seeds and why the body has no spokes and no gaps.
// 'orbit' is the wafer's Kepler law, r = p / (1 + e cos angle), e = 0.3. 'clock' is the wafer's clock, share for share.
//
// PURE. No page, no canvas, no globals, no clock of its own, nothing kept between calls: the same arguments give the
// same places on any machine, which is what lets a link name an animation and a test check it. The words are drawn
// from a five by seven block alphabet carried in this file, so 'text:' needs no font and no canvas; a page that wants
// its own lettering passes opts.raster = { w, h, on } (on = Uint8Array of w*h, 1 where there is ink) and gets the
// same placing over its own letters.
//
// UNITS. Places are pairs (x, y) in one Float32Array of 2n, centred on (0, 0), y UP, and every shape fits inside
// radius 1. Multiply by whatever a unit is on your screen. Nothing here knows about pixels.
//
// Provided as is, without warranty of any kind. It decides where dots are SHOWN; it calculates nothing about a network.

export const MOVE_MS = 2000;
export const GOLDEN = Math.PI * (3 - Math.sqrt(5));            // the golden angle, 2.39996... radians
export const SHAPES = ['cluster', 'ring', 'orbit', 'clock', 'text:WORDS'];

/** The wafer's easing: slow out, fast through the middle, slow in. u below 0 is 0, above 1 is 1. */
export function ease(u) {
  if (!(u > 0)) return 0;
  if (u >= 1) return 1;
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/** Where the points are now. from and to are Float32Array(2n); t runs 0 to 1. Returns out (made if not given).
 *  from is where the points were WHEN THE MOVE BEGAN, not where they were last frame: that is what makes the end
 *  state exact and the motion the same at any frame rate. */
export function step(from, to, t, out) {
  const n2 = Math.min(from.length, to.length);
  const o = out || new Float32Array(n2);
  const e = ease(t);
  if (e >= 1) { for (let q = 0; q < n2; q++) o[q] = to[q]; return o; }
  if (e <= 0) { for (let q = 0; q < n2; q++) o[q] = from[q]; return o; }
  for (let q = 0; q < n2; q++) o[q] = from[q] + (to[q] - from[q]) * e;
  return o;
}

/** n places for a named shape. Returns Float32Array(2n). An unknown shape is refused, never guessed. */
export function targets(shape, n, opts = {}) {
  n = Math.max(0, n | 0);
  const name = String(shape || '');
  if (name === 'cluster') return cluster(n, opts);
  if (name === 'ring') return ring(n, opts);
  if (name === 'orbit') return orbit(n, opts);
  if (name === 'clock') return clock(n, opts);
  if (name.startsWith('text:')) return text(name.slice(5), n, opts);
  throw new Error('assemble: no shape called "' + name + '"; the shapes are ' + SHAPES.join(', '));
}

// ---- cluster: the dense body -------------------------------------------------------------------------------
function cluster(n, { radius = 1 } = {}) {
  const t = new Float32Array(n * 2);
  for (let j = 0; j < n; j++) {
    const r = radius * Math.sqrt((j + 0.5) / n), th = j * GOLDEN;
    t[2 * j] = r * Math.cos(th); t[2 * j + 1] = r * Math.sin(th);
  }
  return t;
}

// ---- ring -------------------------------------------------------------------------------------------------
function ring(n, { radius = 1 } = {}) {
  const t = new Float32Array(n * 2);
  for (let j = 0; j < n; j++) {
    const th = j / Math.max(1, n) * 2 * Math.PI;
    t[2 * j] = radius * Math.cos(th); t[2 * j + 1] = radius * Math.sin(th);
  }
  return t;
}

// ---- orbit: r = p / (1 + e cos angle), the centre at the focus; scaled so the far end reaches the radius -----
function orbit(n, { radius = 1, e = 0.3 } = {}) {
  const p = radius * (1 - e);                                  // farthest point is p / (1 - e) = radius
  const t = new Float32Array(n * 2);
  for (let j = 0; j < n; j++) {
    const th = j * GOLDEN, r = p / (1 + e * Math.cos(th));
    t[2 * j] = r * Math.cos(th); t[2 * j + 1] = r * Math.sin(th);
  }
  return t;
}

// ---- clock: 45 % dial, 15 % ticks, the rest shared 40 : 35 : 25 between hour, minute and second hands ---------
function clock(n, { radius = 1, date } = {}) {
  const d = date instanceof Date ? date : new Date();
  const R = radius, t = new Float32Array(n * 2);
  let j = 0;
  const put = (x, y) => { if (j < n) { t[2 * j] = x; t[2 * j + 1] = y; j++; } };
  const dial = Math.floor(n * 0.45), ticks = Math.floor(n * 0.15), hands = n - dial - ticks;
  for (let i = 0; i < dial; i++) { const a = i / Math.max(1, dial) * 2 * Math.PI; put(R * Math.cos(a), R * Math.sin(a)); }
  for (let i = 0; i < ticks; i++) {
    const h = i % 12, u = (Math.floor(i / 12) % 40) / 40, a = Math.PI / 2 - h * Math.PI / 6, r = R * (0.86 + 0.1 * u);
    put(r * Math.cos(a), r * Math.sin(a));
  }
  const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  const hand = (count, turn, len) => {
    const a = Math.PI / 2 - turn * 2 * Math.PI;
    for (let i = 0; i < count; i++) { const r = R * len * (i + 0.5) / Math.max(1, count); put(r * Math.cos(a), r * Math.sin(a)); }
  };
  const nh = Math.floor(hands * 0.40), nm = Math.floor(hands * 0.35);
  hand(nh, h / 12, 0.5); hand(nm, m / 60, 0.75); hand(hands - nh - nm, s / 60, 0.85);
  while (j < n) put(R * Math.cos(j * GOLDEN), R * Math.sin(j * GOLDEN));          // never leave a point unplaced
  return t;
}

// ---- text: block capitals, five wide and seven tall, carried here so no font and no canvas is needed --------
// Seven rows of five, top row first, '#' where there is ink. Written as rows so a wrong letter can be SEEN:
// the first version packed each letter into one string of 35, six of them were a character out, and the
// letters came out sheared while every test passed. The self test now checks the shape of every letter.
export const GLYPHS = {
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.####'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
};
const GW = 5, GH = 7, GAP = 1, LINE_GAP = 3;

/** The ink of some words as a grid: { w, h, on }. Exported so a page can look at what will be drawn. */
export function raster(words) {
  const lines = String(words).toUpperCase().split(/\s+\/\s+|\n/).filter(l => l.length);   // ' / ' breaks the line; 'A/B' draws a slash
  if (!lines.length) lines.push(' ');
  const cols = Math.max(...lines.map(l => l.length * (GW + GAP) - GAP));
  const w = cols, h = lines.length * GH + (lines.length - 1) * LINE_GAP;
  const on = new Uint8Array(w * h);
  lines.forEach((line, li) => {
    const x0 = Math.floor((cols - (line.length * (GW + GAP) - GAP)) / 2), y0 = li * (GH + LINE_GAP);
    [...line].forEach((ch, ci) => {
      const g = GLYPHS[ch] || GLYPHS[' '];
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++)
        if (g[y][x] === '#') on[(y0 + y) * w + x0 + ci * (GW + GAP) + x] = 1;
    });
  });
  return { w, h, on };
}

function text(words, n, { radius = 1, raster: own } = {}) {
  const G = own || raster(words);
  const cells = [];
  for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) if (G.on[y * G.w + x]) cells.push(x, y);
  const S = cells.length / 2, t = new Float32Array(n * 2);
  if (!S) return cluster(n, { radius });
  // The words fit inside the radius whichever way they are long. One unit for both directions: never stretched.
  const unit = 2 * radius / Math.hypot(G.w, G.h);
  // Each inked square takes its share of the points, spread inside the square on a small sunflower of its own, so a
  // word made of 5,000 points and one made of 500,000 are both solid, and the same n always lands in the same places.
  const per = Math.floor(n / S), extra = n - per * S;
  let j = 0;
  for (let c = 0; c < S && j < n; c++) {
    const k = per + (c < extra ? 1 : 0), cx = cells[2 * c] + 0.5, cy = cells[2 * c + 1] + 0.5;
    for (let i = 0; i < k && j < n; i++, j++) {
      const r = 0.5 * Math.sqrt((i + 0.5) / k), th = i * GOLDEN;
      t[2 * j] = (cx + r * Math.cos(th) - G.w / 2) * unit;
      t[2 * j + 1] = (G.h / 2 - (cy + r * Math.sin(th))) * unit;                  // y up: the top row is the top
    }
  }
  return t;
}

/** A check anyone can run: node -e "import('./assemble.mjs').then(m => console.log(m.selftest()))"
 *  Every shape must place every point, inside the radius, the same way twice; step must start at from, end at to,
 *  and pass through the middle; an unknown shape must be refused. Returns { ok, lines }. */
export function selftest() {
  const lines = []; let ok = true;
  const say = (good, what) => { lines.push((good ? 'pass  ' : 'FAIL  ') + what); if (!good) ok = false; };
  const date = new Date(2026, 8, 19, 10, 8, 30);
  for (const shape of ['cluster', 'ring', 'orbit', 'clock', 'text:GRIDATLAS', 'text:VENTUS / CABLES & CONNECTIVITY']) {
    const n = 5000, a = targets(shape, n, { date }), b = targets(shape, n, { date });
    let finite = true, inside = true, same = true, far = 0;
    for (let q = 0; q < a.length; q++) { if (!Number.isFinite(a[q])) finite = false; if (a[q] !== b[q]) same = false; }
    for (let j = 0; j < n; j++) { const r = Math.hypot(a[2 * j], a[2 * j + 1]); if (r > far) far = r; if (r > 1.0001) inside = false; }
    say(a.length === 2 * n && finite, shape + ': ' + n + ' points, every one placed');
    say(inside && far > 0.5, shape + ': fits inside radius 1 and uses it (farthest ' + far.toFixed(3) + ')');
    say(same, shape + ': the same places twice');
  }
  const from = targets('cluster', 100), to = targets('text:GRID', 100);
  const s0 = step(from, to, 0), s1 = step(from, to, 1), sh = step(from, to, 0.5);
  say(s0.every((v, q) => v === from[q]), 'step at 0 is where the points began');
  say(s1.every((v, q) => v === to[q]), 'step at 1 is exactly the target');
  say(sh.every((v, q) => Math.abs(v - (from[q] + to[q]) / 2) < 1e-6), 'step at one half is half way');
  say(ease(0.25) < 0.25 && ease(0.75) > 0.75, 'the move starts slowly and ends slowly');
  const bad = Object.entries(GLYPHS).filter(([, g]) => g.length !== GH || g.some(r => r.length !== GW || /[^#.]/.test(r))).map(([k]) => k);
  say(!bad.length, 'every letter is seven rows of five' + (bad.length ? ': wrong ' + bad.join(' ') : ''));
  // and a letter must LOOK like itself: an H is two uprights joined in the middle, an O has a hole in it
  const H = GLYPHS.H, O = GLYPHS.O;
  say(H.every(r => r[0] === '#' && r[4] === '#') && H[3] === '#####' && H[0] === '#...#', 'an H is two uprights joined in the middle');
  say(O[3] === '#...#' && O[0] === '.###.' && O[6] === '.###.', 'an O has a hole in it');
  let refused = false; try { targets('spiral', 10); } catch { refused = true; }
  say(refused, 'an unknown shape is refused, not guessed');
  const ink = raster('GRIDATLAS'); let cells = 0; for (const v of ink.on) cells += v;
  say(ink.w === 9 * 6 - 1 && ink.h === 7 && cells > 100, 'GRIDATLAS is ' + ink.w + ' by ' + ink.h + ' squares, ' + cells + ' of them inked');
  return { ok, lines };
}
