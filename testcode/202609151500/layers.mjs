/* layers.mjs — the layer registry for the wafer, in Grid Atlas's own grammar.
 *
 * THE SUBSTRATE IS FROZEN. The wafer is the basemap. A numbered line sits at
 * r = sqrt(key), theta = key x the golden angle, and that never changes, in the
 * same way the Atlas never changes its Carto ground. Every link ever made stays
 * true, and a key issued tomorrow already has a place. Nothing in this file
 * moves a point; a layer only decides what is drawn on top and in what colour.
 *
 * THE GRAMMAR IS THE ATLAS'S. Each layer declares an id, a label, a group and a
 * state, and the state vocabulary is the Atlas's own:
 *
 *   WAIT   nothing fetched, the source is empty, waiting for you to tick it
 *   LOAD   fetching now
 *   OK     loaded and drawn
 *   EMPTY  loaded and there was nothing in it, which is an answer
 *   FAIL   the fetch or the build failed, with the reason kept
 *
 * Twelve of the Atlas's sixty layers preload and forty-eight do not. The same
 * split is used here: the layers that need only the base pack are marked
 * preload, and everything that needs the family index or a remote register waits
 * until it is asked for. That is what makes the surface hold more than a phone
 * can carry.
 *
 * WHAT A LAYER MAY AND MAY NOT DO. A layer returns marks: points to tint, or
 * pairs of keys to join with a line. It may not move a point, add a point that
 * has no number, or invent a relationship. Every layer names its evidence, and
 * a layer whose evidence is a recorded failure says so differently from one
 * whose evidence is a declaration.
 */

export const STATES = ['WAIT', 'LOAD', 'OK', 'EMPTY', 'FAIL'];

const STARS = 'https://ventusltd.github.io/stars/';
const PACK = '../202609142202/data/';

/* ── helpers shared by the layers ────────────────────────────────────────── */

async function json(url) {
  const r = await fetch(url, { cache: 'default' });
  if (!r.ok) throw new Error(url.split('/').pop() + ' returned HTTP ' + r.status);
  return r.json();
}
async function bin(url, K) {
  const r = await fetch(url, { cache: 'default' });
  if (!r.ok) throw new Error(url.split('/').pop() + ' returned HTTP ' + r.status);
  return new K(await r.arrayBuffer());
}

/* The family index is needed by several layers, so it is built once and shared
   rather than fetched per layer. This is the Atlas's fan-out pattern: one
   source, several layers drawn from it. */
let familyIndexPromise = null;
export function familyIndex(U) {
  if (!familyIndexPromise) familyIndexPromise = (async () => {
    const [families, famLines] = await Promise.all([
      json(PACK + 'families.json'),
      bin(PACK + 'lines.bin', Uint32Array)
    ]);
    const owner = new Map();
    for (let f = 0; f < families.length; f++) {
      const o = families[f].lineOffset, c = families[f].lineCount;
      for (let i = o; i < o + c; i++) {
        const k = famLines[i], cur = owner.get(k);
        if (cur === undefined) owner.set(k, [f]);
        else if (cur[cur.length - 1] !== f) cur.push(f);
      }
    }
    return { families, famLines, owner };
  })();
  return familyIndexPromise;
}

const rowOf = U => {
  if (!U._row) { U._row = new Map(); for (let i = 0; i < U.n; i++) U._row.set(U.keys[i], i); }
  return U._row;
};

/* ── the layers ──────────────────────────────────────────────────────────── */

export const LAYERS = [

  /* GROUP: the ground itself */
  { id: 'carried', label: 'Carried by a family', group: 'THE NUMBERED GROUND', preload: true,
    colour: '#d8dee9',
    evidence: 'the pack\'s own flag: 128,369 of 250,174 numbered lines are inside at least one function family',
    note: 'The base tint. A line the estate has organised into a function is lit; a line that exists and '
        + 'belongs to no function is left dim. The dark rings are stretches of numbering where almost '
        + 'nothing was ever gathered into a named function.',
    async build(U) {
      const tint = new Float32Array(U.n);
      for (let i = 0; i < U.n; i++) tint[i] = U.inFam[i] ? 1 : 0.12;
      return { kind: 'tint', tint, lit: U.n };
    } },

  { id: 'length', label: 'Line length', group: 'THE NUMBERED GROUND', preload: true,
    colour: '#80cbc4',
    evidence: 'the pack\'s length column, one unsigned 16-bit value per line',
    note: 'Brightness is the character count. The empty lines vanish and the long ones stand out, which is '
        + 'the quickest way to see where the estate writes densely. Exactly one line reaches the ceiling of '
        + 'the sixteen-bit field, so its true length is not known and it is drawn at the ceiling.',
    async build(U) {
      const tint = new Float32Array(U.n);
      for (let i = 0; i < U.n; i++) tint[i] = 0.08 + 0.92 * Math.min(1, Math.log1p(U.lens[i]) / Math.log1p(160));
      return { kind: 'tint', tint };
    } },

  /* GROUP: duplication, from the family index */
  { id: 'fanout', label: 'Duplication', group: 'WHAT IS WRITTEN TWICE', preload: false,
    colour: '#ffd54a',
    evidence: 'counted from families.json and lines.bin: how many function families carry each line',
    note: 'The estate was numbered so that nothing is written twice without knowing it. This is that answer. '
        + 'Brightness is how many families carry the same line. The brightest points are not the most '
        + 'important code; they are braces, blanks and imports. That is the honest result and the reason '
        + 'the next layer exists.',
    async build(U) {
      const { owner } = await familyIndex(U);
      const row = rowOf(U);
      const tint = new Float32Array(U.n).fill(0.05);
      let shared = 0, max = 0;
      for (const [k, fs] of owner) {
        const i = row.get(k); if (i === undefined) continue;
        if (fs.length > 1) shared++;
        if (fs.length > max) max = fs.length;
        tint[i] = 0.12 + 0.88 * Math.min(1, Math.log(fs.length) / Math.log(60));
      }
      return { kind: 'tint', tint, stat: `${shared.toLocaleString('en-GB')} lines in more than one family, the most in ${max.toLocaleString('en-GB')}` };
    } },

  { id: 'copying', label: 'Real copying only', group: 'WHAT IS WRITTEN TWICE', preload: false,
    colour: '#ff8a65',
    evidence: 'lines in 2 to 40 families and at least 12 characters long; the rest discarded as structural',
    note: 'The same measurement with the noise removed. A line in more than forty families is structure, not '
        + 'copying, and a line under twelve characters carries too little to be evidence. What is left is '
        + 'where the estate genuinely repeats itself, and it is a small fraction of the previous layer.',
    async build(U) {
      const { owner } = await familyIndex(U);
      const row = rowOf(U);
      const tint = new Float32Array(U.n).fill(0.04);
      let usable = 0;
      for (const [k, fs] of owner) {
        if (fs.length < 2 || fs.length > 40) continue;
        const i = row.get(k); if (i === undefined || U.lens[i] < 12) continue;
        usable++;
        tint[i] = 0.35 + 0.65 * Math.min(1, fs.length / 12);
      }
      return { kind: 'tint', tint, stat: `${usable.toLocaleString('en-GB')} lines are usable evidence of copying` };
    } },

  /* GROUP: the blocks, from the live register */
  { id: 'blocks', label: 'Inside a numbered block', group: 'THE WORKING MODULES', preload: false,
    colour: '#5ec8f2',
    evidence: 'the live block register at ventusltd.github.io/stars/blocks/blocks.json',
    note: 'Which numbered lines sit inside a block the estate has named, numbered and proved. These are the '
        + 'modules with a repository, a pinned commit and a path. Everything lit here is code somebody can '
        + 'point at; everything dark is code that works but that no module claims.',
    async build(U) {
      const doc = await json(STARS + 'blocks/blocks.json');
      const { families, famLines } = await familyIndex(U);
      const row = rowOf(U);
      const wanted = new Set();
      for (const b of doc.blocks) for (const f of b.inside || []) wanted.add(f.family);
      const byN = new Map(families.map((f, i) => [f.n, i]));
      const tint = new Float32Array(U.n).fill(0.05);
      let lit = 0;
      for (const n of wanted) {
        const fi = byN.get(n); if (fi === undefined) continue;
        const f = families[fi];
        for (let j = f.lineOffset; j < f.lineOffset + f.lineCount; j++) {
          const i = row.get(famLines[j]); if (i === undefined) continue;
          if (tint[i] < 0.9) { tint[i] = 0.95; lit++; }
        }
      }
      return { kind: 'tint', tint,
        stat: `${lit.toLocaleString('en-GB')} lines lie inside ${wanted.size.toLocaleString('en-GB')} named function families across ${doc.blocks.length} blocks` };
    } },

  { id: 'engine', label: 'The grid engine', group: 'THE WORKING MODULES', preload: false,
    colour: '#7fd6a2',
    evidence: 'blocks whose repository is Ventusltd/ventus-grid-engine in the live register',
    note: 'The lines that are the grid mathematics itself: distance and bearing, voltage drop, firm capacity, '
        + 'connection capacity, ratings, route obstacles. This is the smallest layer on the wafer and it is '
        + 'the one the whole estate exists to serve.',
    async build(U) {
      const doc = await json(STARS + 'blocks/blocks.json');
      const { families, famLines } = await familyIndex(U);
      const row = rowOf(U);
      const byN = new Map(families.map((f, i) => [f.n, i]));
      const tint = new Float32Array(U.n).fill(0.04);
      let lit = 0, blocks = 0;
      for (const b of doc.blocks) {
        if (!(b.repos || []).some(r => /ventus-grid-engine/.test(r))) continue;
        blocks++;
        for (const fn of b.inside || []) {
          const fi = byN.get(fn.family); if (fi === undefined) continue;
          const f = families[fi];
          for (let j = f.lineOffset; j < f.lineOffset + f.lineCount; j++) {
            const i = row.get(famLines[j]); if (i === undefined) continue;
            if (tint[i] < 0.9) { tint[i] = 1; lit++; }
          }
        }
      }
      return { kind: 'tint', tint,
        stat: `${lit.toLocaleString('en-GB')} lines across ${blocks} engine blocks` };
    } },

  /* GROUP: joins drawn as lines */
  { id: 'declared', label: 'Declared dependencies', group: 'WHAT FITS WITH WHAT', preload: false,
    colour: '#8ea8ff', draws: 'lines',
    evidence: 'depends_on in the live block register: only 48 of 205 blocks with code declare anything',
    note: 'A line between two blocks that the register says depend on each other, drawn between the first '
        + 'numbered line of each. This is what the authors wrote down, and it is thin: most of the estate '
        + 'declares nothing at all.',
    async build(U) {
      const doc = await json(STARS + 'blocks/blocks.json');
      const { families, famLines } = await familyIndex(U);
      const row = rowOf(U);
      const byN = new Map(families.map((f, i) => [f.n, i]));
      const anchor = b => {
        for (const fn of b.inside || []) {
          const fi = byN.get(fn.family);
          if (fi !== undefined && families[fi].lineCount) return famLines[families[fi].lineOffset];
        }
        return null;
      };
      const bySym = new Map(doc.blocks.map(b => [b.symbol, b]));
      const joins = [];
      for (const b of doc.blocks) {
        const a = anchor(b); if (a === null) continue;
        for (const d of b.depends_on || []) {
          const t = bySym.get(d.symbol); if (!t) continue;
          const z = anchor(t); if (z === null) continue;
          joins.push({ a, b: z, label: `${b.symbol} depends on ${d.symbol}`, kind: 'declared' });
        }
      }
      return joins.length ? { kind: 'joins', joins, stat: `${joins.length} declared dependencies drawable` }
                          : { kind: 'empty', why: 'no declared dependency could be anchored to a numbered line' };
    } },

  { id: 'learned', label: 'Learned by failure', group: 'WHAT FITS WITH WHAT', preload: false,
    colour: '#ffd54a', draws: 'lines',
    evidence: 'the chemistry star: 3,319 tested compositions, 913 failures, two of them rules',
    note: 'Two rules nobody declared and the estate learned by trying: sld-sandbox will not run without '
        + 'sld-styles, recorded in 702 failed compositions, and grid-scope will not run without geodesy, '
        + 'recorded in 211. Drawn differently from a declaration because the evidence is of a different '
        + 'kind. If there are only two of these, it is because only the cartridges have been composed at '
        + 'scale, not because the rest fit together.',
    async build(U) {
      const doc = await json(STARS + 'blocks/blocks.json');
      const { families, famLines } = await familyIndex(U);
      const row = rowOf(U);
      const byN = new Map(families.map((f, i) => [f.n, i]));
      const anchor = b => {
        for (const fn of b.inside || []) {
          const fi = byN.get(fn.family);
          if (fi !== undefined && families[fi].lineCount) return famLines[families[fi].lineOffset];
        }
        return null;
      };
      const find = word => doc.blocks.find(b =>
        (b.title || '').toLowerCase().includes(word) || (b.description || '').toLowerCase().includes(word));
      const RULES = [
        ['sld-sandbox', 'sld-styles', 702], ['grid-scope', 'geodesy', 211]
      ];
      const joins = [];
      for (const [from, to, n] of RULES) {
        const A = find(from), B = find(to);
        if (!A || !B) continue;
        const a = anchor(A), z = anchor(B);
        if (a === null || z === null) continue;
        joins.push({ a, b: z, kind: 'learned',
          label: `${from} will not run without ${to} — ${n} failed compositions` });
      }
      return joins.length ? { kind: 'joins', joins, stat: `${joins.length} rules learned by failure` }
                          : { kind: 'empty', why: 'neither rule could be anchored: the register names no line for one of the blocks' };
    } }
];

export const GROUPS = [...new Set(LAYERS.map(l => l.group))];
export const byId = Object.fromEntries(LAYERS.map(l => [l.id, l]));
