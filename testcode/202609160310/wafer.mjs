/* wafer.mjs - the grid-by-key law, generated. Variation grid-by-key-plain.
 *
 * The same keys on a square lattice rather than a spiral - the grain of a die, not a galaxy.
 *
 * THE RULE EVERY LAW OBEYS, and this one is checked by proof/law.check.mjs:
 * a position is a pure function of the entity's own permanent key and of published
 * facts about it. No randomness, no simulation state, no memory between frames. The
 * same key under the same law lands on the same point on every device, for ever - which
 * is what makes a key that does not exist yet already have a place.
 *
 * Identity is the KEY, never the coordinate. Laws that place by measured usage move a
 * point when the usage sharpens; the line it names does not move.
 */
const PACK = '../202609142202/data/';
const TAU = Math.PI * 2, GOLDEN = Math.PI * (3 - Math.sqrt(5));
const R = 585.5, B = 26, LAT = 597;
const POINT = 1.0, COLOUR = 'nature';
let ORDER = 'ascending';   /* let, not const: drawWith(order) re-renders the same camera */

/* key-derived spread: deterministic, so equal-valued lines form a shell not a wire */
const shell = (key) => ((key * 2654435761) >>> 0) % 1000 / 1000;

export function place(key, rad, len, fam, maxKey) {
  const r = R*Math.sqrt((key%LAT)/LAT*0.5 + Math.floor(key/LAT)/(maxKey/LAT)*0.5);
  const a = key * GOLDEN;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

const stage = document.getElementById('stage');
const ctx = stage.getContext('2d', { alpha: false });
const countEl = document.getElementById('count');
const footEl = document.getElementById('foot');
let keys, lens, fams, meta, px, py, lit, dpr = 1, scale = 1, cx = 0, cy = 0;

const u8 = (b) => new Uint8Array(b);
Promise.all([
  fetch(PACK + 'all-lines.bin').then(r => r.arrayBuffer()),
  fetch(PACK + 'all-lines.len.bin').then(r => r.arrayBuffer()),
  fetch(PACK + 'all-lines.family.bin').then(r => r.arrayBuffer()),
  fetch(PACK + 'all-lines.meta.json').then(r => r.json()),
]).then(([k, l, f, m]) => {
  keys = new Uint32Array(k); lens = new Uint16Array(l); fams = u8(f); meta = m;
  build(); layout(); draw();
  countEl.textContent = keys.length.toLocaleString() + ' numbered lines';
  countEl.classList.remove('dim');
}).catch(() => { footEl.textContent = 'expected the numbered pack at ' + PACK; });

function build() {
  const n = keys.length;
  px = new Float32Array(n); py = new Float32Array(n); lit = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const key = keys[i], len = lens[i], fam = fams[i];
    /* radiation: the pack's own floor, since this surface draws rather than resolves */
    const rad = len <= 3 ? 0 : (fam ? 0.42 : 0.12);
    lit[i] = rad;
    const p = place(key, rad, len, fam, meta.max);
    px[i] = p[0]; py[i] = p[1];
  }
}

function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  stage.width = Math.floor(innerWidth * dpr); stage.height = Math.floor(innerHeight * dpr);
  scale = (Math.min(stage.width, stage.height) / 2 - 18 * dpr) / R;
  cx = stage.width / 2; cy = stage.height / 2;
}

function draw() {
  const img = ctx.createImageData(stage.width, stage.height), d = img.data;
  /* SEED THE GROUND INTO THE BUFFER. draw() used to fillRect the ground and then
     putImageData a fresh all-zero buffer straight over it, so the ground a surface
     declared was never on the canvas: 74% of it was pure black. Two of the render
     proof's three levels compare pixels against the declared ground, so with no pixel
     ever matching it, every pixel counted as lit and both levels passed on any input -
     they would have passed on a blank page. Seat B found it in the contract I exposed
     so that it could be tested. */
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 5; d[i + 1] = 7; d[i + 2] = 11; d[i + 3] = 255;
  }
  const step = ORDER === 'descending' ? -1 : 1;
  const from = step > 0 ? 0 : keys.length - 1, to = step > 0 ? keys.length : -1;
  let shown = 0;
  const wide = POINT >= 1.15;           /* bolder: a 2x2 footprint */
  const fine = POINT <= 0.85;           /* finer: same footprint, less light */
  /* BRIGHTER WINS. These surfaces used last-write-wins, so where two keys landed on one
     pixel the one drawn last took it - and the picture changed when the iteration order
     reversed. Seat B measured 19 of 24 surfaces differing under drawWith('descending'),
     with the size of the difference tracking how much each law overlaps its points.
     That is not cosmetic: this universe's whole premise is that position is derived from
     the key, and a raster that depends on loop order means two renderings of one estate
     can disagree with neither being wrong. Brighter-wins makes the picture a pure
     function of the SET of keys, independent of the order they arrive in. */
  for (let i = from; i !== to; i += step) {
    const x = (cx + px[i] * scale) | 0, y = (cy + py[i] * scale) | 0;
    if (x < 0 || y < 0 || x >= stage.width || y >= stage.height) continue;
    let a = COLOUR === 'radiation' ? 0.18 + lit[i] * 0.82 : (fams[i] ? 0.85 : 0.3);
    if (fine) a *= 0.62;
    const r = 90 + a * 165, g = 110 + a * 145, b = 140 + a * 115;
    const put = (xx, yy) => {
      if (xx < 0 || yy < 0 || xx >= stage.width || yy >= stage.height) return;
      const o = (yy * stage.width + xx) * 4;
      if (r + g + b <= d[o] + d[o + 1] + d[o + 2]) return;   /* brighter wins */
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    };
    put(x, y);
    if (wide) { put(x + 1, y); put(x, y + 1); put(x + 1, y + 1); }
    shown++;
  }
  ctx.putImageData(img, 0, 0);
  footEl.textContent = 'law: grid-by-key - Square packing. ' + shown.toLocaleString() +
    ' of ' + keys.length.toLocaleString() + ' on screen - pack ' + meta.built_utc +
    ' - identity is the key, not the coordinate' +
    ' - across plain/fine/lit this law varies in weight only';
}
addEventListener('resize', () => { layout(); draw(); });

/* ---- the strip: this surface is not a dead end ---------------------------
 * Every generated surface once carried exactly ONE href - its own stylesheet - so a
 * visitor arriving from the homepage could look and then had nowhere to go. That is
 * against the rule that the universe is endless.
 *
 * It is NAVIGATION, NOT CONTENT: it is fetched after the wafer has drawn, it never
 * blocks the picture, and if the index cannot be read the strip stays hidden and the
 * page is exactly as it was. Absent navigation is survivable; wrong navigation is not,
 * because it promises a journey and then 404s.
 *
 * The index is GENERATED from each surface's own declared law, never typed - six of
 * these law ids were renamed after the surfaces existed, and a hand-written strip
 * would still be pointing at the old ones.
 */
const LAWS_INDEX = '../202609160224/laws-index.json';
fetch(LAWS_INDEX).then(r => r.ok ? r.json() : null).then(ix => {
  if (!ix || !Array.isArray(ix.laws) || !ix.laws.length) return;
  const nav = document.getElementById('laws');
  const home = document.createElement('a');
  home.href = '../202609160224/'; home.className = 'home';
  home.textContent = '◀ the galaxy';
  nav.append(home);
  for (const law of ix.laws) {
    if (!law.open || !law.id) continue;
    const a = document.createElement('a');
    a.href = '../' + law.open + '/';
    a.textContent = law.id;
    a.title = law.title || law.id;
    if (law.id === 'grid-by-key') a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  nav.hidden = false;
}).catch(() => { /* the picture stands on its own */ });

/* ---- the hook the render proof drives ------------------------------------
 * Seat B could run only liveness, distinctness and reload-determinism against these
 * surfaces, because they exposed place() and nothing else. The render proof's real
 * levels need a camera to compute the expected picture, a sample to compute it FOR, and
 * a way to redraw the same camera in a different order.
 *
 * Reversing the iteration order is the stronger determinism claim and the reason this
 * matters: reloading proves the PAGE is deterministic; reversing proves the PICTURE is a
 * pure function of the keys. For a universe whose whole premise is derived position,
 * that is the claim worth proving.
 */
window.__wafer = {
  law: 'grid-by-key', variant: 'grid-by-key-plain', place, lawsIndex: LAWS_INDEX,
  ready: () => keys !== null && keys !== undefined,
  camera: () => ({ cx, cy, scale, zoom: 1, panX: 0, panY: 0, dpr,
                   w: stage.width, h: stage.height }),
  ground: [5, 7, 11],                    /* #05070b, what draw() fills with */
  keyCount: () => (keys ? keys.length : 0),
  allKeys: () => keys,
  sampleKeys: (n) => {
    if (!keys) return [];
    const out = [];
    for (let i = 0; i < n; i++) out.push(keys[Math.floor((i + 0.5) * keys.length / n)]);
    return out;
  },
  drawWith: (order) => { const was = ORDER; ORDER = order; draw(); ORDER = was; },
  /* PLACE BY INDEX, NEVER BY GUESSED ARGUMENTS.
   *
   * __wafer exposed place(key, rad, len, fam, maxKey) and none of the per-key inputs it
   * needs, so an external caller had exactly two options: guess the arguments, or
   * recompute rad/len/fam from the pack - which is reimplementing the derivation, the one
   * thing a proof must not do. The contract made the honest path unavailable.
   *
   * Seat B guessed zeros and four laws failed 12 of 24 projections. Worse, ONE law with
   * the same wrong argument PASSED 20 of 20: rings-by-membership reads fam, about half
   * the sampled keys were projected to the wrong ring, and a dense canvas with a 1px
   * tolerance absorbed it. The failures sent someone to look; the false pass did not.
   *
   * placeIndex(i) supplies the page's own arrays, so there is no argument to get wrong.
   * That is the structural form of the same rule the charter applies to prose: remove the
   * opportunity rather than document the hazard. */
  placeIndex: (i) => {
    if (!keys || i < 0 || i >= keys.length) return null;
    const key = keys[i], len = lens[i], fam = fams[i];
    const rad = len <= 3 ? 0 : (fam ? 0.42 : 0.12);
    return place(key, rad, len, fam, meta.max);
  },
  /* If a caller genuinely needs the inputs, it gets the REAL ones rather than inventing
     them. Exposing place() without these is what produced the false pass. */
  inputsFor: (i) => {
    if (!keys || i < 0 || i >= keys.length) return null;
    const key = keys[i], len = lens[i], fam = fams[i];
    return { key, len, fam, rad: len <= 3 ? 0 : (fam ? 0.42 : 0.12), maxKey: meta.max };
  },
  indexOfKey: (k) => {
    if (!keys) return -1;
    let lo = 0, hi = keys.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1;
      if (keys[mid] === k) return mid;
      if (keys[mid] < k) lo = mid + 1; else hi = mid - 1; }
    return -1;
  },
  /* What the parameter sets actually change ON THIS LAW. Derived from the law's own
     radius expression, never typed: a law with no shell term cannot move a point when
     the band changes, so its variants differ in WEIGHT rather than in PLACEMENT. */
  varies: 'weight only',
};
