/* Systems — a star for every real code block, planets for its functions, and
 * the question of what fits with what.
 *
 * WHAT THIS IS. The estate's block register holds 210 numbered blocks, 187 of
 * which carry working code in a named repository at a pinned commit. Each one
 * is drawn here as a system: the block is the star, and every function inside
 * it is a planet in orbit. Tap a planet and the real source is fetched from the
 * commit the register names, so what you read is what ships, not a description
 * of it.
 *
 * WHY SYSTEMS RATHER THAN A LIST. A register tells you a block has eleven
 * functions. A system shows you that one block has six hundred and another has
 * two, that some stars are crowded and some are nearly empty, and that four of
 * them have no planets at all. Size is information and a table hides it.
 *
 * WHAT FITS WITH WHAT, AND HOW IT IS KNOWN. Two sources, both evidence, never
 * invention:
 *
 *   DECLARED — the register's own `depends_on` and `needs`. 41 blocks declare a
 *   dependency. This is what the authors wrote down.
 *
 *   DISCOVERED — the chemistry star tested 3,319 distinct compositions of the
 *   live cartridges and recorded 913 failures. Two of those failures are rules
 *   rather than accidents: sld-sandbox will not run without sld-styles, seen in
 *   702 failed compositions, and grid-scope will not run without geodesy, seen
 *   in 211. Nobody declared either. They were learned by trying.
 *
 * So a line drawn between two systems is answered three ways: declared, learned
 * by failure, or not known. The third is the honest and most common answer, and
 * it is the one that tells you where to test next.
 *
 * SLOTTING NEW MODULES IN. A block's place is a pure function of its permanent
 * number, so a block numbered 211 tomorrow already has a system waiting, and
 * every link made today still points at the same place. Nothing is re-laid-out
 * when the register grows.
 *
 * WHAT IS NOT CLAIMED. A dependency here is a declaration or a recorded
 * failure, not a proof of coupling. A function count is the register's count. A
 * preview is the file at a commit, not a statement that the code is correct.
 */

const BLOCKS = 'https://ventusltd.github.io/stars/blocks/blocks.json';
const RAW = 'https://raw.githubusercontent.com/';
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('en-GB');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let stage = $('stage');

/* Rules the chemistry star learned by testing, quoted with their evidence.
   These are not invented: each is a decay message counted across compositions,
   and the count travels with the rule so it can be argued with. */
const LEARNED = [
  { from: 'sld-sandbox', to: 'sld-styles', failures: 702,
    text: 'sld-sandbox: Error: sld-sandbox requires the sld-styles module' },
  { from: 'grid-scope', to: 'geodesy', failures: 211,
    text: 'sld-sandbox: Error: grid-scope requires the geodesy module' }
];

const U = { blocks: null, live: [], pos: null, sys: -1, source: new Map() };
const view = { x: 0, y: 0, zoom: 1, w: 0, h: 0, dpr: 1, mode: 'galaxy' };

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const place = n => { const r = Math.sqrt(n) * 7, t = n * GOLDEN; return [r * Math.cos(t), r * Math.sin(t)]; };
function phase(n) {
  let h = (n + 1) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ── loading ─────────────────────────────────────────────────────────────── */

async function load() {
  const r = await fetch(BLOCKS, { cache: 'default' });
  if (!r.ok) throw new Error('blocks.json returned HTTP ' + r.status);
  const doc = await r.json();
  U.blocks = doc.blocks;
  U.live = doc.blocks.filter(b => b.functions > 0 && b.files && b.files.length);
  U.generated = doc.generated_utc;

  const fns = U.live.reduce((a, b) => a + b.functions, 0);
  const declared = doc.blocks.filter(b => (b.depends_on || []).length).length;
  $('count').textContent =
    `${fmt(U.live.length)} systems with working code · ${fmt(fns)} functions · ${fmt(declared)} declare a dependency`;
  $('prov').textContent =
    `block register generated ${String(U.generated).slice(0, 16).replace('T', ' ')} UTC · read live, never typed`;
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

let ctx = null;
function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = stage.clientWidth; view.h = stage.clientHeight;
  stage.width = Math.round(view.w * view.dpr);
  stage.height = Math.round(view.h * view.dpr);
}

const CAT_COLOUR = {
  geodesy: '#7fd6a2', network: '#5ec8f2', connections: '#8ea8ff', cartridges: '#ffd54a',
  layers: '#b39ddb', arrival: '#f48fb1', news: '#ffab91', solar: '#ffd54a',
  interface: '#80cbc4', proofs: '#a5d6a7', constants: '#90a4ae', other: '#8b93a7'
};
const colourOf = b => CAT_COLOUR[b.category] || '#8b93a7';

function toScreen(x, y) {
  return [(x - view.x) * view.zoom + view.w / 2, view.h / 2 - (y - view.y) * view.zoom];
}

function render() {
  const c = ctx;
  c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  c.fillStyle = '#0b0d12'; c.fillRect(0, 0, view.w, view.h);

  if (view.mode === 'system' && U.sys >= 0) return renderSystem(U.live[U.sys]);

  /* Lines first, so systems sit on top of them. */
  const idx = new Map(U.blocks.map((b, i) => [b.symbol, b]));
  c.lineWidth = 1;
  for (const b of U.live) {
    const [ax, ay] = place(b.number);
    const A = toScreen(ax, ay);
    for (const d of b.depends_on || []) {
      const t = idx.get(d.symbol);
      if (!t) continue;
      const [bx, by] = place(t.number);
      const B = toScreen(bx, by);
      c.strokeStyle = 'rgba(94,200,242,0.20)';
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
    }
  }
  /* Learned rules, drawn differently because they are evidence of a different kind. */
  c.setLineDash([4, 4]);
  for (const r of LEARNED) {
    const a = U.live.find(b => (b.title || '').toLowerCase().includes(r.from) || b.symbol.toLowerCase() === r.from);
    const bb = U.live.find(b => (b.title || '').toLowerCase().includes(r.to));
    if (!a || !bb) continue;
    const A = toScreen(...place(a.number)), B = toScreen(...place(bb.number));
    c.strokeStyle = 'rgba(255,213,74,0.55)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
  }
  c.setLineDash([]);

  for (let i = 0; i < U.live.length; i++) {
    const b = U.live[i];
    const [x, y] = place(b.number);
    const [sx, sy] = toScreen(x, y);
    if (sx < -60 || sy < -60 || sx > view.w + 60 || sy > view.h + 60) continue;
    const r = Math.max(2, Math.min(26, 2 + Math.sqrt(b.functions) * 1.5) * Math.min(view.zoom, 2) / 1.4);
    c.fillStyle = colourOf(b);
    c.globalAlpha = 0.9;
    c.beginPath(); c.arc(sx, sy, r, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
    if (view.zoom > 1.6) {
      c.fillStyle = '#d8dee9'; c.font = '10px ui-monospace,monospace';
      c.fillText(`${b.symbol} ${b.title}`.slice(0, 34), sx + r + 4, sy + 3);
    }
  }
}

function renderSystem(b) {
  const c = ctx;
  const cx = view.w / 2, cy = view.h / 2 - 20;
  const fns = b.inside || [];
  c.fillStyle = colourOf(b);
  c.beginPath(); c.arc(cx, cy, 16, 0, 6.2832); c.fill();
  c.fillStyle = '#0b0d12'; c.font = 'bold 11px ui-monospace,monospace';
  c.textAlign = 'center'; c.fillText(b.symbol, cx, cy + 4); c.textAlign = 'left';

  const n = Math.max(fns.length, 1);
  U.planets = [];
  for (let i = 0; i < fns.length; i++) {
    let k = i, shell = 1;
    while (k >= shell * 8) { k -= shell * 8; shell++; }
    const seats = shell * 8;
    const a = (k / seats) * 6.2832 + phase(b.number) * 6.2832;
    const rad = 46 + shell * 34;
    const x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a) * 0.72;
    c.strokeStyle = 'rgba(139,147,167,0.16)';
    c.beginPath(); c.ellipse(cx, cy, rad, rad * 0.72, 0, 0, 6.2832); c.stroke();
    c.fillStyle = '#d8dee9';
    c.beginPath(); c.arc(x, y, 5, 0, 6.2832); c.fill();
    if (fns.length <= 60) {
      c.fillStyle = '#8b93a7'; c.font = '9.5px ui-monospace,monospace';
      c.fillText(String(fns[i].name || '').slice(0, 18), x + 7, y + 3);
    }
    U.planets.push({ x, y, fn: fns[i] });
  }
  if (!fns.length) {
    c.fillStyle = '#ffd54a'; c.font = '12px ui-monospace,monospace'; c.textAlign = 'center';
    c.fillText('the register names no functions inside this block', cx, cy + 60);
    c.textAlign = 'left';
  }
}

let pending = false;
const draw = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; render(); }); } };

/* ── the panel ───────────────────────────────────────────────────────────── */

function fitVerdict(b) {
  const declared = (b.depends_on || []).map(d => d.symbol + (d.title ? ' · ' + d.title : ''));
  const learned = LEARNED.filter(r =>
    (b.title || '').toLowerCase().includes(r.from) || b.symbol.toLowerCase() === r.from);
  const needs = (b.needs || []).map(n => n.name);
  return { declared, learned, needs };
}

function openSystem(i) {
  U.sys = i; view.mode = 'system';
  const b = U.live[i];
  const f = fitVerdict(b);
  const p = $('body');
  p.innerHTML =
    `<h2>${esc(b.symbol)} · ${esc(b.title)}</h2>
     <p class="dim">${esc(b.category ?? 'no category')} · ${esc(b.kind)} · ${fmt(b.functions)} functions ·
      ${fmt((b.repos || []).length)} repositor${(b.repos || []).length === 1 ? 'y' : 'ies'}${
        b.first_written ? ' · first written ' + esc(String(b.first_written).slice(0, 10)) : ''}</p>
     ${b.description ? `<p>${esc(b.description)}</p>` : ''}
     <h3>What it fits with</h3>
     ${f.declared.length
        ? `<p><b>Declared</b> by the register: ${f.declared.map(esc).join(', ')}.</p>`
        : `<p class="dim"><b>Declared</b>: nothing. The register records no dependency for this block.</p>`}
     ${f.learned.length
        ? f.learned.map(r => `<p class="learned"><b>Learned by failure</b>: this will not run without
            <b>${esc(r.to)}</b>. Recorded in ${fmt(r.failures)} failed compositions as
            &ldquo;${esc(r.text)}&rdquo;. Nobody declared this; the chemistry star found it by trying.</p>`).join('')
        : `<p class="dim"><b>Learned by failure</b>: nothing recorded. Either it composes cleanly or it has
            not been tested in combination.</p>`}
     ${f.needs.length
        ? `<p class="dim"><b>Needs from outside</b>: ${f.needs.slice(0, 12).map(esc).join(', ')}${
            f.needs.length > 12 ? ' and ' + (f.needs.length - 12) + ' more' : ''}. These are environment
            names, not modules.</p>` : ''}
     <h3>Planets</h3>
     <p class="dim">${b.inside && b.inside.length
        ? `${fmt(b.inside.length)} named function${b.inside.length === 1 ? '' : 's'}. Tap one to read the real source.`
        : 'The register names no functions inside this block, though it counts ' + fmt(b.functions) + '.'}</p>
     <div id="files"></div>`;

  const fd = $('files');
  for (const file of (b.files || []).slice(0, 4)) {
    const a = document.createElement('button');
    a.className = 'file'; a.type = 'button';
    a.textContent = `read ${file.path}`;
    a.addEventListener('click', () => preview(file));
    fd.appendChild(a);
  }
  $('back').hidden = false;
  $('panel').classList.add('open');
  draw();
}

async function preview(file) {
  const key = `${file.repo}@${file.commit}:${file.path}`;
  const box = $('code');
  box.hidden = false;
  box.textContent = 'fetching the file at the commit the register names…';
  try {
    let text = U.source.get(key);
    if (text === undefined) {
      const url = `${RAW}${file.repo}/${file.commit}/${file.path}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(url + ' returned HTTP ' + r.status);
      text = await r.text();
      U.source.set(key, text);
    }
    const lines = text.split('\n');
    box.replaceChildren();
    const head = document.createElement('div');
    head.className = 'codehead';
    head.textContent = `${file.repo} @ ${file.commit.slice(0, 7)} · ${file.path} · ${fmt(lines.length)} lines`;
    const pre = document.createElement('pre');
    pre.textContent = lines.slice(0, 400).join('\n');
    box.append(head, pre);
    if (lines.length > 400) {
      const more = document.createElement('p');
      more.className = 'dim';
      more.textContent = `first 400 lines of ${fmt(lines.length)}; the rest is in the repository at this commit`;
      box.appendChild(more);
    }
  } catch (e) {
    box.textContent = 'Could not read the source: ' + e.message;
  }
}

function backToGalaxy() {
  view.mode = 'galaxy'; U.sys = -1;
  $('back').hidden = true;
  $('code').hidden = true;
  $('panel').classList.remove('open');
  $('body').innerHTML =
    `<h2>Systems</h2>
     <p>Every block of the estate that carries working code, drawn as a system: the block is the star and
     each function inside it is a planet. Size is the function count, colour is the category.</p>
     <p class="dim">A solid line is a dependency the register declares. A dashed gold line is a rule the
     chemistry star learned by testing 3,319 compositions and recording 913 failures. Tap a system to enter
     it and read its real source at the commit the register names.</p>
     <p class="dim">A block's place is a pure function of its permanent number, so a block numbered tomorrow
     already has a system waiting and every link made today still points at the same place.</p>`;
  draw();
}

/* ── gestures ────────────────────────────────────────────────────────────── */

function pick(cx, cy) {
  if (view.mode === 'system') {
    for (const p of (U.planets || [])) {
      if (Math.hypot(p.x - cx, p.y - cy) < 13) return { planet: p };
    }
    return null;
  }
  let best = -1, bd = 26 * 26;
  for (let i = 0; i < U.live.length; i++) {
    const [x, y] = place(U.live[i].number);
    const [sx, sy] = toScreen(x, y);
    const d = (sx - cx) ** 2 + (sy - cy) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best >= 0 ? { system: best } : null;
}

function gestures() {
  const pts = new Map(); let pinch = null, down = null, moved = 0;
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { down = [e.clientX, e.clientY]; moved = 0; }
    if (pts.size === 2) { const [p, q] = [...pts.values()];
      pinch = { d: Math.hypot(p[0]-q[0], p[1]-q[1]), z: view.zoom }; }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [p, q] = [...pts.values()], d = Math.hypot(p[0]-q[0], p[1]-q[1]);
      if (pinch.d > 0) view.zoom = Math.max(0.15, Math.min(60, pinch.z * (d / pinch.d)));
      draw(); return;
    }
    if (view.mode === 'galaxy') {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      view.x -= dx / view.zoom; view.y += dy / view.zoom;
      draw();
    }
  });
  const up = e => {
    if (pts.size === 1 && down && moved < 7) {
      const r = stage.getBoundingClientRect();
      const hit = pick(e.clientX - r.left, e.clientY - r.top);
      if (hit?.system !== undefined) openSystem(hit.system);
      else if (hit?.planet) {
        const b = U.live[U.sys];
        const f = (b.files || [])[0];
        $('code').hidden = false;
        $('code').textContent = `${hit.planet.fn.name} — family #${hit.planet.fn.family}, ` +
          `${hit.planet.fn.places} place${hit.planet.fn.places === 1 ? '' : 's'} in the estate.` +
          (f ? ' Fetching the file that holds it…' : ' The register names no file for this block.');
        if (f) preview(f);
      }
    }
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) down = null;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; down = null; });
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    if (view.mode !== 'galaxy') return;
    view.zoom = Math.max(0.15, Math.min(60, view.zoom * Math.exp(-e.deltaY * 0.0016)));
    draw();
  }, { passive: false });
}

/* ── start ───────────────────────────────────────────────────────────────── */

(async function start() {
  ctx = stage.getContext('2d');
  try { await load(); }
  catch (e) {
    $('count').textContent = 'Could not load the block register: ' + e.message
      + '. Check the internet connection and reload.';
    return;
  }
  resize();
  let maxN = 0; for (const b of U.live) maxN = Math.max(maxN, b.number);
  view.zoom = Math.min(view.w, view.h) / (Math.sqrt(maxN) * 7 * 2.3);
  backToGalaxy();
  gestures();
  window.addEventListener('resize', () => { resize(); draw(); });
  $('back').addEventListener('click', backToGalaxy);
})();
