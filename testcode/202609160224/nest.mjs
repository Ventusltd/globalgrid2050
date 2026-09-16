/* nest.mjs — the code wafer: every unique line the estate has ever numbered.
 *
 * 250,174 lines, drawn from 1.75 MB of binary and nothing else. Zoom in and the
 * families name themselves; zoom further and each particle shows its real line of
 * code; tap one and you get the block it lives in, in plain English and in the
 * original, read from the file at the commit the numbered database pins.
 *
 * INFINITE INFO WITHOUT INFINITE COMPUTE. Three rules, applied without exception:
 *
 *  1. POSITION IS DERIVED.  r = sqrt(key), theta = key x 2.39996 (the golden
 *     angle). A pure function of the line's own permanent key, so it is never
 *     stored, never fetched, identical on every device for ever, and line
 *     400,000 already has a place before it is issued.
 *  2. STATE IS DERIVED.  derive.mjs computes a line's nature, radiation and
 *     relational field from three numbers the pack already holds — key, length,
 *     family membership. 7 bytes a line for the entire estate. Adding 100,000
 *     lines costs 700 KB and no new logic.
 *  3. DETAIL IS FETCHED ONLY WHEN IT IS BOTH IN VIEW AND LEGIBLE.  Resolutions
 *     are split into radial bands of 4,096 keys; because position is a function
 *     of the key, a key range IS a ring on the wafer, so loading what is on
 *     screen and loading what is near are the same operation. Zoomed out, the
 *     page fetches nothing at all.
 *
 * WHY A CPU AND NOT A GALAXY. A die is logic cells plus the routing between them,
 * read at whatever zoom the reader needs. The navigation is borrowed from what
 * the code already is rather than from a picture it resembles.
 *
 * WHAT IS NOT CLAIMED. Proximity is not similarity — adjacent particles have near
 * line numbers, which means they were issued near each other in time. The card is
 * the Grid Atlas popup from iterations/07-code-card, reused unchanged.
 */

import { derive, radiation, census, nature, NATURE_NAME, NOISE, OPERATIONAL } from './derive.mjs';

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const PACK = '../202609142202/data/';

const stage = document.getElementById('stage');
const ctx = stage.getContext('2d', { alpha: false });
const countEl = document.getElementById('count');
const footEl = document.getElementById('foot');
const panel = document.getElementById('panel');
const panelBody = document.getElementById('panelbody');

let keys = null, lens = null, fams = null, meta = null;   /* the estate, 1.75 MB */
let head = null;                                          /* places + names tables */
let px = null, py = null;                                 /* wafer units, derived once */
let lit = null;                                           /* radiation, derived once */
let nat = null;                                           /* nature, derived once */
let dpr = 1, scale = 1, cx = 0, cy = 0, zoom = 1, panX = 0, panY = 0;
let focusIdx = -1, counts = null;

const LOD_NAMES = 8, LOD_CODE = 30, MAX_LAZY = 48;
const bucketCache = new Map();      /* bucket id -> resolution arrays | 'pending' */
const fileCache = new Map();
const lineText = new Map();
let lazyQueue = [];

/* ---- load --------------------------------------------------------------- */
const buf = (n) => fetch(PACK + n).then((r) => {
  if (!r.ok) throw new Error(n + ': HTTP ' + r.status);
  return r.arrayBuffer();
});

Promise.all([
  buf('all-lines.bin'), buf('all-lines.len.bin'), buf('all-lines.family.bin'),
  fetch(PACK + 'all-lines.meta.json').then((r) => r.json()),
  fetch('particles.json').then((r) => r.json()),
]).then(([k, l, f, m, h]) => {
  keys = new Uint32Array(k); lens = new Uint16Array(l); fams = new Uint8Array(f);
  meta = m; head = h;
  buildDerived();
  counts = census(keys, lens, fams);
  countEl.textContent = keys.length.toLocaleString() + ' unique lines · ' +
    counts[OPERATIONAL].toLocaleString() + ' operational · ' +
    counts[NOISE].toLocaleString() + ' noise';
  countEl.classList.remove('dim');
  layout(); draw();
}).catch((err) => {
  countEl.textContent = 'the pack did not load: ' + err.message;
  footEl.textContent = 'Expected the numbered pack at ' + PACK;
});

/* Derived once at load, then never again: two floats and two bytes per line.
   This is the only per-line memory the page holds. */
function buildDerived() {
  const n = keys.length;
  px = new Float32Array(n); py = new Float32Array(n);
  lit = new Float32Array(n); nat = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const key = keys[i], r = Math.sqrt(key), a = key * GOLDEN;
    px[i] = Math.cos(a) * r; py[i] = Math.sin(a) * r;
    const d = derive(key, lens[i], fams[i]);
    lit[i] = d.radiation; nat[i] = d.nature;
  }
}

function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  stage.width = Math.floor(innerWidth * dpr);
  stage.height = Math.floor(innerHeight * dpr);
  if (!keys) return;
  const maxR = Math.sqrt(meta.max);
  scale = (Math.min(stage.width, stage.height) / 2 - 18 * dpr) / maxR;
  cx = stage.width / 2; cy = stage.height / 2;
}

/* keys is sorted, so a key finds its index by bisection rather than by scanning
   250,174 entries every time a band lands. */
function indexOfKey(k) {
  let lo = 0, hi = keys.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] === k) return mid;
    if (keys[mid] < k) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}

const sx = (i) => cx + px[i] * scale * zoom + panX;
const sy = (i) => cy + py[i] * scale * zoom + panY;

/* ---- resolution bands --------------------------------------------------- */
function bucketOf(key) { return Math.floor(key / head.span); }

function ensureBucket(b) {
  if (bucketCache.has(b)) return;
  bucketCache.set(b, 'pending');
  fetch('p/' + b + '.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
    .then((d) => {
      bucketCache.set(b, d);
      /* The band carries the true usage count, so radiation stops being the
         pack's floor and becomes measured. Brightness on screen is then
         literally "has this code been used somewhere", as it should be. */
      for (let j = 0; j < d.key.length; j++) {
        const i = indexOfKey(d.key[j]);
        if (i >= 0) lit[i] = radiation(lens[i], fams[i], d.also[j] + 1);
      }
      draw();
    })
    .catch(() => bucketCache.set(b, null));   /* null = this band resolves to nothing */
}

/* A key's resolution, or null if its band is absent or it is one of the 121,805
   lines that belongs to no family and therefore has no place to point at. */
function resolve(key) {
  const b = bucketCache.get(bucketOf(key));
  if (!b || b === 'pending') return null;
  const j = b.key.indexOf(key);
  if (j < 0) return null;
  return {
    place: head.places[b.place[j]], line: b.line[j],
    family: b.family[j], name: head.names[b.name_of[j]], also: b.also[j],
  };
}

/* ---- drawing ------------------------------------------------------------ */
const COLOUR = [
  [58, 66, 88],        /* noise        — present, dark, never clickable */
  [90, 122, 158],      /* boilerplate  */
  [120, 200, 245],     /* operational  — the code worth studying */
  [150, 140, 200],     /* structural   */
  [78, 88, 110],       /* orphan       */
];

/* THE ZOOMED-OUT PATH IS NOT fillRect.
 *
 * At zoom 1 every one of the 250,174 lines is on screen, and a fillRect each is
 * roughly 250,000 canvas state changes per frame — tens of milliseconds, felt
 * immediately as a page that fights the finger. A particle at that zoom is one
 * pixel, so it is written as one pixel: straight into an ImageData buffer, no
 * canvas calls at all, then blitted once. The buffer is allocated at layout and
 * reused, so a frame allocates nothing.
 *
 * Brighter wins where two lines land on the same pixel, rather than the last one
 * drawn winning — otherwise the picture would depend on iteration order, and the
 * whole point of a derived layout is that it does not depend on anything but the
 * keys. Above ~1.5 px a particle is a shape rather than a pixel, and the ordinary
 * path takes over.
 */
let img = null, buf32 = null;

function ensureBuffer() {
  if (img && img.width === stage.width && img.height === stage.height) return;
  img = ctx.createImageData(stage.width, stage.height);
  buf32 = new Uint32Array(img.data.buffer);
}

function draw() {
  ctx.fillStyle = '#05070b';
  ctx.fillRect(0, 0, stage.width, stage.height);
  if (!keys) return;

  const n = keys.length;
  const size = Math.max(1, 1.1 * dpr * Math.min(zoom, 2.4));
  const wantNames = zoom >= LOD_NAMES, wantCode = zoom >= LOD_CODE;
  const bands = new Set();
  let labelled = 0, asked = 0, shown = 0;

  const pixelPath = size <= 1.5;
  const W = stage.width, H = stage.height;
  if (pixelPath) { ensureBuffer(); buf32.fill(0xff0b0705); }   /* ABGR: the ground */

  for (let i = 0; i < n; i++) {
    const x = sx(i), y = sy(i);
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    shown++;
    const c = COLOUR[nat[i]], a = 0.22 + lit[i] * 0.78;

    if (pixelPath) {
      const xi = x | 0, yi = y | 0;
      if (xi >= 0 && yi >= 0 && xi < W && yi < H) {
        const o = yi * W + xi;
        /* Composite against the ground once, then keep the brighter of the two. */
        const r = (c[0] * a + 5 * (1 - a)) | 0;
        const g = (c[1] * a + 7 * (1 - a)) | 0;
        const b = (c[2] * a + 11 * (1 - a)) | 0;
        const v = (255 << 24) | (b << 16) | (g << 8) | r;
        const prev = buf32[o];
        if (((prev >> 16) & 255) + ((prev >> 8) & 255) + (prev & 255) < b + g + r) buf32[o] = v;
      }
      continue;
    }

    ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    ctx.fillRect(x, y, size, size);

    /* Only bands that are on screen AND legible are ever requested. */
    if (wantNames && nat[i] !== NOISE) bands.add(bucketOf(keys[i]));

    if (wantCode && nat[i] !== NOISE) {
      const t = lineText.get(keys[i]);
      if (t === undefined && asked < MAX_LAZY) { queueText(i); asked++; }
      if (t) {
        ctx.fillStyle = 'rgba(216,222,233,.75)';
        ctx.font = (10 * dpr) + 'px ui-monospace,monospace';
        ctx.fillText(t, x + 7 * dpr, y + 3.5 * dpr);
      }
    } else if (wantNames && labelled < 120 && nat[i] === OPERATIONAL) {
      const r = resolve(keys[i]);
      if (r) {
        ctx.fillStyle = 'rgba(255,213,74,.60)';
        ctx.font = (10 * dpr) + 'px ui-monospace,monospace';
        ctx.fillText(r.name, x + 6 * dpr, y + 3.5 * dpr);
        labelled++;
      }
    }
  }

  for (const b of bands) ensureBucket(b);

  if (focusIdx >= 0) {
    ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.arc(sx(focusIdx), sy(focusIdx), 9 * dpr, 0, TAU); ctx.stroke();
  }

  footEl.textContent =
    (wantCode ? 'layer 3 · the code itself'
      : wantNames ? 'layer 2 · family names — keep zooming for the code'
      : 'layer 1 · zoom in') +
    '   ·   ' + shown.toLocaleString() + ' on screen of ' + n.toLocaleString() +
    '   ·   ' + bucketCache.size + ' bands loaded' +
    '   ·   pack ' + meta.built_utc;

  if (lazyQueue.length) drainQueue();
}

/* ---- the line's own text, fetched only for what is on screen ------------- */
function queueText(i) {
  const key = keys[i];
  if (lineText.has(key) || lazyQueue.includes(i) || lazyQueue.length >= MAX_LAZY) return;
  lazyQueue.push(i);
}

async function drainQueue() {
  while (lazyQueue.length) {
    const i = lazyQueue.shift();
    const key = keys[i];
    if (lineText.has(key)) continue;
    const r = resolve(key);
    if (!r) { lineText.set(key, ''); continue; }
    lineText.set(key, '');
    const text = await readFile(r.place);
    if (text) {
      const l = text.split(/\r?\n/)[r.line - 1];
      lineText.set(key, (l === undefined ? '' : l).trim().slice(0, 120));
      draw();
    }
  }
}

/* ---- NO DEAD ENDS -------------------------------------------------------
 *
 * Vikram's rule: "never give the user a broken journey… leave no deadends, the
 * universe is endless." Every particle must lead somewhere, and three of them
 * can otherwise stop dead:
 *
 *   a line whose family resolves but whose file will not load,
 *   a line that belongs to no family at all — 121,805 of them,
 *   a line whose block has no ten lines above or below it.
 *
 * None of those is actually a dead end, because LINES.md holds a row for EVERY
 * numbered key, family or no family. So when the file cannot answer, the
 * numbering itself can: the line's own text, and its numbered neighbours, read
 * by byte range out of a 25 MB document without downloading it.
 *
 * REUSED, NOT REINVENTED: the sparse anchor index is vikra-ac's, published at
 * testcode/202609160207/line-index.json — 588 anchors every 512 rows, 9.3 KB
 * against 1.1 MB for a dense one. Block k is bytes offs[k]..offs[k+1]. Building
 * a second index would have been the estate's own disease.
 */
const LINE_INDEX = '../202609160207/line-index.json';
const LINES_MD = 'https://ventusltd.github.io/stars/LINES.md';
let lineIdx = null, lineIdxTried = false;
const blockCache = new Map();          /* anchor block -> Map(key -> text) */

async function ensureLineIndex() {
  if (lineIdx || lineIdxTried) return lineIdx;
  lineIdxTried = true;
  try {
    const r = await fetch(LINE_INDEX);
    if (r.ok) lineIdx = await r.json();
  } catch { /* the ladder simply stops one rung shorter */ }
  return lineIdx;
}

/* Every numbered key's own text, by byte range. Verified per read rather than by
   ETag: a row must begin with the key and a tab, so a stale index costs a wasted
   fetch and can never return another line's code. */
async function textByKey(key) {
  const idx = await ensureLineIndex();
  if (!idx) return null;
  let k = 0;
  while (k + 1 < idx.keys.length && idx.keys[k + 1] <= key) k++;
  if (blockCache.has(k)) return blockCache.get(k).get(key) ?? null;
  const from = idx.offs[k], to = idx.offs[k + 1];
  try {
    const r = await fetch(LINES_MD, { headers: { Range: 'bytes=' + from + '-' + (to - 1) } });
    if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
    const rows = (await r.text()).split(/\r?\n/);
    const map = new Map();
    for (const row of rows) {
      const t = row.indexOf('\t');
      if (t <= 0) continue;
      const n = Number(row.slice(0, t));
      if (Number.isFinite(n)) map.set(n, row.slice(t + 1));
    }
    blockCache.set(k, map);
    return map.get(key) ?? null;
  } catch { return null; }
}

/* The numbered neighbourhood: this key and the issued keys either side of it.
   When a file cannot give ten lines above and below, the numbering can — they
   are not the same ten lines, and the page says so rather than pretending. */
async function neighbourhood(i) {
  const out = [];
  const from = Math.max(0, i - 10), to = Math.min(keys.length - 1, i + 10);
  for (let j = from; j <= to; j++) out.push({ i: j, key: keys[j], text: await textByKey(keys[j]) });
  return out;
}

/* The nearest particle that DOES resolve to a file, so a line with nowhere of
   its own still has somewhere to go. */
function nearestResolvable(i) {
  for (let d = 1; d < 4000; d++) {
    for (const j of [i - d, i + d]) {
      if (j < 0 || j >= keys.length) continue;
      if (fams[j] && resolve(keys[j])) return j;
    }
  }
  return -1;
}

async function readFile([repo, commit, p]) {
  const url = 'https://raw.githubusercontent.com/' + repo + '/' + commit + '/' + p;
  if (fileCache.has(url)) return fileCache.get(url);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    fileCache.set(url, t);
    return t;
  } catch { fileCache.set(url, null); return null; }
}

/* ---- plain English, generated from what the pack states ------------------ */
function english(i, r) {
  const key = keys[i], len = lens[i], nm = NATURE_NAME[nat[i]];
  const d = derive(key, len, fams[i]);
  const what = nat[i] === NOISE
    ? 'This line holds ' + len + ' characters and belongs to no function, so the wafer treats it as noise — present, dark, and retirable without losing any code.'
    : r
      ? 'This line is ' + nm + ' code inside the function ' + r.name +
        ', which the numbered database records at ' + r.place[2].split('/').pop() + ' line ' + r.line + '.'
      : 'This line is ' + nm + ' code holding ' + len + ' characters. No function family claims it, so the estate records no file for it — one of the ' +
        (meta.lines - meta.in_a_family).toLocaleString() + ' lines in that position.';
  /* RADIATION: has this code been used somewhere. */
  const rad = r
    ? (r.also
      ? ' RADIATION: it is used in ' + (r.also + 1).toLocaleString() +
        ' places across the estate, so changing it here changes one copy of ' +
        (r.also + 1).toLocaleString() + '.'
      : ' RADIATION: the estate records exactly one use of it.')
    : ' RADIATION: unknown until this band loads — the pack knows only that no family claims it.';
  /* RELATIONAL FIELD: the block it sits in, and the computation it is part of. */
  const rel = nat[i] === NOISE
    ? ' RELATIONAL FIELD: none. Noise relates to nothing, which is what makes it retirable.'
    : ' RELATIONAL FIELD: the ten lines above and ten below, shown here' +
      (r ? ', and the computation ' + r.name + ' that carries it' : '') + '.';
  return what + rad + rel;
}

/* ---- the card ----------------------------------------------------------- */
async function show(i) {
  focusIdx = i;
  const key = keys[i];
  ensureBucket(bucketOf(key));
  const r = resolve(key);
  panelBody.textContent = '';

  const h = document.createElement('h2');
  h.textContent = 'line ' + key.toLocaleString();
  panelBody.append(h);

  const sub = document.createElement('div');
  sub.className = 'dim';
  sub.textContent = NATURE_NAME[nat[i]] + ' · ' + lens[i] + ' characters' +
    (r ? ' · family ' + r.family + ' ' + r.name : ' · in no family');
  panelBody.append(sub);

  const box = document.createElement('p');
  box.className = 'plain';
  box.textContent = english(i, r);
  panelBody.append(box);

  if (r) {
    const doors = document.createElement('div');
    doors.className = 'doors';
    const gh = document.createElement('a');
    gh.href = 'https://github.com/' + r.place[0] + '/blob/' + r.place[1] + '/' + r.place[2] + '#L' + r.line;
    gh.target = '_blank'; gh.rel = 'noopener';
    gh.textContent = 'OPEN ON GITHUB ↗';
    doors.append(gh);
    const m = /testcode\/(\d{10,14})\//.exec(r.place[2]);
    if (m) {
      const sf = document.createElement('a');
      sf.href = '../' + m[1] + '/';
      sf.textContent = 'OPEN THE SURFACE →';
      doors.append(sf);
    }
    panelBody.append(doors);

    const holder = document.createElement('div');
    holder.className = 'block';
    holder.textContent = 'reading ' + r.place[2].split('/').pop() + ' at ' + r.place[1].slice(0, 7) + '…';
    panelBody.append(holder);
    const text = await readFile(r.place);
    holder.textContent = '';
    if (!text) {
      /* Not a dead end: the file refused, so the numbering answers instead. */
      await renderNeighbourhood(holder, i,
        'The file did not load — the commit is pinned, so the blob is gone or the network refused. ' +
        'These are the numbered lines either side instead.');
    } else {
      const lines = text.split(/\r?\n/);
      const from = Math.max(1, r.line - 10), to = Math.min(lines.length, r.line + 10);
      const pre = document.createElement('pre');
      pre.className = 'code';
      for (let ln = from; ln <= to; ln++) {
        const row = document.createElement('div');
        row.className = 'cl' + (ln === r.line ? ' hit' : '');
        const num = document.createElement('span');
        num.className = 'ln'; num.textContent = String(ln).padStart(5, ' ');
        const src = document.createElement('span');
        src.textContent = lines[ln - 1] === undefined ? '' : lines[ln - 1];
        row.append(num, src); pre.append(row);
      }
      holder.append(pre);
      const note = document.createElement('div');
      note.className = 'dim';
      note.textContent = 'lines ' + from + '–' + to + ' of ' + lines.length + ', at commit ' + r.place[1].slice(0, 10);
      holder.append(note);
    }
  } else {
    /* No family claims this line — 121,805 of them. The numbering still does,
       so the journey continues rather than stopping. */
    const doors = document.createElement('div');
    doors.className = 'doors';
    const near = nearestResolvable(i);
    if (near >= 0) {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = 'NEAREST LINE WITH A FILE → ' + keys[near].toLocaleString();
      a.addEventListener('click', (e) => { e.preventDefault(); show(near); });
      doors.append(a);
    }
    const est = document.createElement('a');
    est.href = 'https://ventusltd.github.io/stars/LINES.md';
    est.target = '_blank'; est.rel = 'noopener';
    est.textContent = 'THE NUMBERING ↗';
    doors.append(est);
    const gg = document.createElement('a');
    gg.href = '../';
    gg.textContent = 'ALL SURFACES →';
    doors.append(gg);
    panelBody.append(doors);

    const holder = document.createElement('div');
    holder.className = 'block';
    panelBody.append(holder);
    await renderNeighbourhood(holder, i,
      bucketCache.get(bucketOf(key)) === 'pending'
        ? 'Reading this band. Meanwhile, the numbered lines either side:'
        : 'No function family claims this line, so the estate records no file for it. ' +
          'LINES.md holds a row for every numbered key, so these are its numbered neighbours.');
  }

  panel.hidden = false;
  draw();
}

/* The last rung of the ladder, and the one that makes the universe endless: the
   key's own text and its numbered neighbours, read by byte range out of a 25 MB
   document. These are NOT the ten lines above and below in a file — they are the
   keys issued around it — and the page says so rather than implying otherwise. */
async function renderNeighbourhood(holder, i, why) {
  holder.textContent = 'reading the numbering…';
  const rows = await neighbourhood(i);
  holder.textContent = '';
  const note = document.createElement('div');
  note.className = 'dim';
  note.textContent = why;
  holder.append(note);

  const any = rows.some((r) => r.text !== null);
  if (!any) {
    const alt = document.createElement('div');
    alt.className = 'dim';
    alt.textContent = 'The numbering could not be read either. Nothing here is a dead end: ' +
      'the doors above lead to the numbering itself and to every surface the estate has published.';
    holder.append(alt);
    return;
  }
  const pre = document.createElement('pre');
  pre.className = 'code';
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'cl' + (r.i === i ? ' hit' : '');
    const num = document.createElement('span');
    num.className = 'ln'; num.textContent = String(r.key).padStart(7, ' ');
    const src = document.createElement('span');
    src.textContent = r.text === null ? '—' : r.text;
    row.append(num, src);
    /* Every neighbour is itself a door: the journey never runs out of next. */
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => show(r.i));
    pre.append(row);
  }
  holder.append(pre);
  const tail = document.createElement('div');
  tail.className = 'dim';
  tail.textContent = 'numbered neighbours, not file neighbours — keys issued either side of this one. Tap any to travel.';
  holder.append(tail);
}

/* ---- picking and interaction -------------------------------------------- */
function pick(mx, my) {
  let best = -1, bd = (22 * dpr) * (22 * dpr);
  for (let i = 0; i < keys.length; i++) {
    const x = sx(i); if (x < -30 || x > stage.width + 30) continue;
    const y = sy(i); if (y < -30 || y > stage.height + 30) continue;
    const dx = x - mx, dy = y - my, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

let dragging = false, lastX = 0, lastY = 0, moved = 0;
stage.addEventListener('pointerdown', (e) => {
  dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  moved += Math.abs(dx) + Math.abs(dy);
  panX += dx * dpr; panY += dy * dpr; lastX = e.clientX; lastY = e.clientY;
  draw();
});
stage.addEventListener('pointerup', (e) => {
  dragging = false;
  if (moved > 6 || !keys) return;
  const i = pick(e.clientX * dpr, e.clientY * dpr);
  if (i >= 0) show(i); else { panel.hidden = true; focusIdx = -1; draw(); }
});
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.2 : 1 / 1.2;
  const mx = e.clientX * dpr, my = e.clientY * dpr;
  panX = mx - (mx - panX) * f; panY = my - (my - panY) * f;
  zoom = Math.max(0.5, Math.min(zoom * f, 600));
  draw();
}, { passive: false });

document.getElementById('close').addEventListener('click', () => {
  panel.hidden = true; focusIdx = -1; draw();
});
addEventListener('resize', () => { layout(); draw(); });
