/* wafer.mjs - the radius-by-length law, generated. Variation radius-by-length-fine.
 *
 * Radius by how much a line says. Short connective lines inside, long statements out.
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
const R = 585.5, B = 14, LAT = 597;
const POINT = 0.7, ORDER = 'ascending', COLOUR = 'nature';

/* key-derived spread: deterministic, so equal-valued lines form a shell not a wire */
const shell = (key) => ((key * 2654435761) >>> 0) % 1000 / 1000;

export function place(key, rad, len, fam, maxKey) {
  const r = R*Math.min(1,len/120) + shell(key)*B;
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
  ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, stage.width, stage.height);
  const img = ctx.createImageData(stage.width, stage.height), d = img.data;
  const step = ORDER === 'descending' ? -1 : 1;
  const from = step > 0 ? 0 : keys.length - 1, to = step > 0 ? keys.length : -1;
  let shown = 0;
  for (let i = from; i !== to; i += step) {
    const x = (cx + px[i] * scale) | 0, y = (cy + py[i] * scale) | 0;
    if (x < 0 || y < 0 || x >= stage.width || y >= stage.height) continue;
    const a = COLOUR === 'radiation' ? 0.18 + lit[i] * 0.82 : (fams[i] ? 0.85 : 0.3);
    const o = (y * stage.width + x) * 4;
    d[o] = 90 + a * 165; d[o + 1] = 110 + a * 145; d[o + 2] = 140 + a * 115; d[o + 3] = 255;
    shown++;
  }
  ctx.putImageData(img, 0, 0);
  footEl.textContent = 'law: radius-by-length - Line length. ' + shown.toLocaleString() +
    ' of ' + keys.length.toLocaleString() + ' on screen - pack ' + meta.built_utc +
    ' - identity is the key, not the coordinate';
}
addEventListener('resize', () => { layout(); draw(); });
window.__wafer = { law: 'radius-by-length', variant: 'radius-by-length-fine', place };
