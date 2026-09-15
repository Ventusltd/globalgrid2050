/* GLOBALGRID2050 Star Generator — core.js (GRAMMAR §0, §1, §5).
 * Descends from testcode/202609141522/core.js and keeps its exported names.
 * Holds keys, never text: entity index (categories, repositories, blocks, groups, families), CSR edges per kind,
 * the numbered-line index from the pack, labels, the count sentence, the URL grammar, the trail, grid picking.
 * Tier 1 (before first paint): stars/blocks/blocks.json, stars/blocks/families.json, stars/code/index.json.
 * Tier 2 (after first paint): the packed state vector at ../202609142202/data/ by RELATIVE path.
 * Lazy forever: stars/code/f/<bucket>.json per family; source text from raw.githubusercontent.com.
 * Every number on screen comes from these files; missing data reads "not yet known".
 */
export const STARS = 'https://ventusltd.github.io/stars/';
export const PACK = '../202609142202/data/';
export const REL = { 'contains': '#8b93a7', 'depends on': '#ffd54a', 'uses': '#00e5ff', 'used by': '#ff7ab6', 'shared line': '#39d353', 'random link': '#8b93a7', 'entangled': '#b8ccff' };
export const REL_WORDS = Object.keys(REL);                    // legend order; kind index = position (3 = used by, a reading)
export const KIND = { 'contains': 0, 'depends on': 1, 'uses': 2, 'used by': 3, 'shared line': 4, 'random link': 5, 'entangled': 6, 'journey': 7 };
export const PAL = { body: '#0b0d12', text: '#d8dee9', accent: '#00e5ff', panel: '#0f1218', border: '#2a3140', chip: '#12151c', chipBorder: '#385464', code: '#07090d', key: '#ffd54a', muted: '#8b93a7', counts: '#7da0c8', footer: '#566079', busbar: '#eef2fb' };
export const CLS = { cat: 0, repo: 1, block: 2, group: 3, family: 4 };
export const CLS_WORD = ['category', 'repository', 'block', 'group', 'family'];
export const CLS_KEY = ['cat', 'repo', 'block', 'group', 'family'];
export const LENSES = ['ring', 'particle', 'chord', 'river', 'table', 'column'];
export const KIND_WORD = ['constant', 'engine', 'cartridge', 'layer', 'deeplink', 'app', 'tool', 'auto'];
export const KIND_TEXT = { constant: 'A constant: a value the whole estate must agree on.', engine: 'An engine: a calculation that answers a question.', cartridge: 'A cartridge: a plug-in part of the GridAtlas map.', layer: 'A layer: data drawn on the map.', deeplink: 'A deep link: how a link lands a reader on the right place.', app: 'An app: a page a reader can open and use.', tool: 'A tool: code that serves the other code.', auto: 'Found automatically: a group of functions the star-maker clustered without a name from the catalogue.' };

export const U = { blocks: null, cats: [], groups: null, index: null, names: null, famToGroup: new Map(), famGroups: new Map(), buckets: new Map(), texts: new Map(), trail: [], pack: null, prov: null, random: null, entangled: null, packStats: null, packSha: null, edgesDrawnLitOnly: false };

export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'html') e.innerHTML = v; else if (v != null && v !== false) e.setAttribute(k, v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
export async function getJSON(url) {
  const r = await fetch(url, { cache: 'default' });
  if (!r.ok) throw new Error(`${url} returned HTTP ${r.status}`);
  return r.json();
}
export function fail(where, err) {
  const box = $(where) || document.body;
  box.prepend(el('div', { class: 'u-fail' }, `Could not load live data: ${err.message}. Check the internet connection and reload.`));
}
export const fmt = n => Number(n).toLocaleString('en-GB');
export const stamp = iso => { const m = String(iso || '').match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/); return m ? m.slice(1).join('') : ''; };
export const shortUtc = iso => { const m = String(iso || '').match(/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d)/); return m ? `${m[1]} ${m[2]} UTC` : 'not yet known'; };

/* ================= tier 1 ================= */
export async function loadUniverse() {
  const [b, groups, index] = await Promise.all([getJSON(STARS + 'blocks/blocks.json'), getJSON(STARS + 'blocks/families.json'), getJSON(STARS + 'code/index.json')]);
  U.blocks = b.blocks; U.cats = b.categories; U.groups = groups; U.index = index; U.generated = b.generated_utc;
  U.bySym = new Map(U.blocks.map(x => [x.symbol, x]));
  U.famGroups = new Map();
  for (const [g, fams] of Object.entries(groups)) for (const n of fams) { if (!U.famGroups.has(n)) U.famGroups.set(n, []); U.famGroups.get(n).push(g); }
  for (const [n, gs] of U.famGroups) U.famToGroup.set(n, gs.find(g => U.bySym.has(g)) || gs[0]);
  U.catOf = new Map(U.cats.map(c => [c.id, c]));
  U.unnamed = Object.keys(groups).filter(g => !U.bySym.has(g));
  buildEntities();
  return U;
}
export async function loadNames() { if (!U.names) { U.names = await getJSON(STARS + 'code/names.json'); U.nameOf = new Map(); for (const [k, ns] of Object.entries(U.names)) for (const n of ns) if (!U.nameOf.has(n)) U.nameOf.set(n, k); } return U.names; }
export const catColour = id => (U.catOf.get(id) || {}).colour || PAL.muted;
export const catTitle = id => (U.catOf.get(id) || {}).title || id;
export function blockLabel(sym) { const b = U.bySym.get(sym); return b ? `${sym} · ${b.title}` : `${sym} · (not yet named)`; }
export function blockFamilies(sym) { return U.groups[sym] || []; }
export function blockDeps(sym) { const b = U.bySym.get(sym); return b ? (b.depends_on || []).map(d => d.symbol || d).filter(s => U.bySym.has(s) || U.groups[s]) : []; }
export function blockUsers(sym) { const b = U.bySym.get(sym); return b ? (b.used_by || []).filter(s => U.bySym.has(s) || U.groups[s]) : []; }

/* ================= entity index (§1.2) ================= */
export const core = {};                      // the object lenses receive; filled by buildEntities and the loaders
core.REL = REL; core.KIND = KIND; core.CLS = CLS; core.CLS_WORD = CLS_WORD; core.PAL = PAL; core.U = U;
core.GEOM = { muted: 12, rel: 13, shared: 13 + KIND['shared line'], busbar: 20 };   // geometry colour indexes into the gl.js palette (12 categories, muted, 7 legend colours, busbar)
function buildEntities() {
  const cats = U.cats, catIdx = new Map(cats.map((c, i) => [c.id, i]));
  const repos = [...new Set(U.blocks.flatMap(b => b.repos || []))].map(r => r.replace(/^Ventusltd\//, '')).sort();
  const blocks = [...U.blocks].sort((a, b) => ((catIdx.get(a.category) ?? 99) - (catIdx.get(b.category) ?? 99)) || (a.number - b.number));
  const groups = U.unnamed.slice().sort();
  const fams = [...new Set(Object.values(U.groups).flat())].sort((a, b) => a - b);
  const N = cats.length + repos.length + blocks.length + groups.length + fams.length;
  const range = {}; let at = 0;
  range.cat = [at, at += cats.length]; range.repo = [at, at += repos.length]; range.block = [at, at += blocks.length]; range.group = [at, at += groups.length]; range.family = [at, at += fams.length];
  const keyStr = new Array(N), cls = new Uint8Array(N), cat = new Uint8Array(N).fill(255), parent = new Int32Array(N).fill(-1), mass = new Float32Array(N), rec = new Array(N), byKey = new Map();
  const put = (i, key, c, ct, r) => { keyStr[i] = key; cls[i] = c; cat[i] = ct; rec[i] = r; byKey.set(key, i); };
  cats.forEach((c, i) => put(range.cat[0] + i, `cat:${c.id}`, 0, i, c));
  repos.forEach((r, i) => put(range.repo[0] + i, `repo:${r}`, 1, 255, r));
  blocks.forEach((b, i) => { const idx = range.block[0] + i; put(idx, `block:${b.symbol}`, 2, catIdx.get(b.category) ?? 255, b); parent[idx] = byKey.get(`cat:${b.category}`) ?? -1; });
  groups.forEach((g, i) => put(range.group[0] + i, `group:${g}`, 3, 255, g));
  fams.forEach((n, i) => { const idx = range.family[0] + i; put(idx, `family:${n}`, 4, 255, n); const g = U.famToGroup.get(n); const p = byKey.get(U.bySym.has(g) ? `block:${g}` : `group:${g}`); parent[idx] = p ?? -1; if (p != null) cat[idx] = cat[p]; });
  // families sorted so each container is a contiguous range of famOrder
  const famOrder = new Uint32Array(fams.length); for (let i = 0; i < fams.length; i++) famOrder[i] = range.family[0] + i;
  famOrder.sort((a, b) => (parent[a] - parent[b]) || (a - b));
  const famOff = new Int32Array(N).fill(-1), famCount = new Uint32Array(N);
  for (let i = 0; i < famOrder.length; i++) { const p = parent[famOrder[i]]; if (p < 0) continue; if (famOff[p] < 0) famOff[p] = i; famCount[p]++; }
  for (let i = range.family[0]; i < range.family[1]; i++) mass[i] = 1;
  for (let i = range.block[0]; i < range.group[1]; i++) mass[i] = famCount[i];
  for (let i = range.cat[0]; i < range.cat[1]; i++) mass[i] = blocks.filter(b => catIdx.get(b.category) === i).length;
  repos.forEach((r, i) => { mass[range.repo[0] + i] = U.blocks.filter(b => (b.repos || []).some(x => x.replace(/^Ventusltd\//, '') === r)).length; });
  Object.assign(core, { N, range, keyStr, cls, cat, parent, mass, rec, byKey, famOrder, famOff, famCount, catIdx, blocksOrdered: blocks, reposOrdered: repos, groupsOrdered: groups, famNum: fams });
  core.famName = new Array(N).fill(null); core.famKind = new Array(N).fill(null); core.famRec = new Array(N).fill(null);
  buildTier1Edges();
}
core.ordinal = idx => idx - core.range.block[0];   // block ordinal 0..209: category order then number
core.clsOf = idx => core.cls[idx];
core.isClass = (idx, c) => idx >= 0 && idx < core.N && core.cls[idx] === CLS[c];
core.familiesOf = idx => { const o = core.famOff[idx]; return o < 0 ? new Uint32Array(0) : core.famOrder.subarray(o, o + core.famCount[idx]); };

/* ================= edges (§1.3): CSR per kind, both directions, doubling buffer ================= */
const E = { a: new Uint32Array(4096), b: new Uint32Array(4096), kind: new Uint8Array(4096), w: new Float32Array(4096), n: 0, dirty: true, out: null, in: null, seen: new Set(), via: new Map() };
core.edges = E;
export function addEdge(a, b, kind, w = 1, via = null) {
  if (a < 0 || b < 0 || a === b) return -1;
  const sig = kind === 4 || kind === 5 ? `${Math.min(a, b)}:${Math.max(a, b)}:${kind}` : `${a}:${b}:${kind}`;
  if (E.seen.has(sig)) return -1; E.seen.add(sig);
  if (E.n === E.a.length) { const g = f => { const t = new f.constructor(f.length * 2); t.set(f); return t; }; E.a = g(E.a); E.b = g(E.b); E.kind = g(E.kind); E.w = g(E.w); }
  E.a[E.n] = a; E.b[E.n] = b; E.kind[E.n] = kind; E.w[E.n] = w; if (via) E.via.set(E.n, via); E.dirty = true; return E.n++;
}
function buildCSR() {
  const N = core.N, n = E.n;
  const mk = (src) => { const off = new Uint32Array(N + 1); for (let i = 0; i < n; i++) off[src[i] + 1]++; for (let i = 0; i < N; i++) off[i + 1] += off[i]; const idx = new Uint32Array(n), fill = off.slice(0, N); for (let i = 0; i < n; i++) idx[fill[src[i]]++] = i; return { off, idx }; };
  E.out = mk(E.a); E.in = mk(E.b); E.dirty = false;
}
/** neighbour indexes of idx over edges of `kind` (dir 'out' | 'in' | 'both'); kind -1 = any kind in mask */
core.edgesOf = function edgesOf(idx, kind, dir = 'out', mask = 0x7f) {
  if (E.dirty) buildCSR();
  const outl = [];
  const scan = (csr, other) => { for (let k = csr.off[idx]; k < csr.off[idx + 1]; k++) { const e = csr.idx[k]; if (kind >= 0 ? E.kind[e] !== kind : !((mask >> E.kind[e]) & 1)) continue; outl.push(other[e]); } };
  if (dir === 'out' || dir === 'both') scan(E.out, E.b);
  if (dir === 'in' || dir === 'both') scan(E.in, E.a);
  return Uint32Array.from(outl);
};
core.edgeIds = function edgeIds(idx, kind, dir = 'out') {
  if (E.dirty) buildCSR();
  const outl = []; const scan = csr => { for (let k = csr.off[idx]; k < csr.off[idx + 1]; k++) { const e = csr.idx[k]; if (kind < 0 || E.kind[e] === kind) outl.push(e); } };
  if (dir === 'out' || dir === 'both') scan(E.out); if (dir === 'in' || dir === 'both') scan(E.in); return outl;
};
function buildTier1Edges() {
  const { byKey, range, parent } = core;
  for (let i = range.block[0]; i < range.group[1]; i++) { if (parent[i] >= 0) addEdge(parent[i], i, 0); for (const f of core.familiesOf(i)) addEdge(i, f, 0); }
  for (const b of U.blocks) { const bi = byKey.get(`block:${b.symbol}`); for (const r of b.repos || []) addEdge(byKey.get(`repo:${r.replace(/^Ventusltd\//, '')}`) ?? -1, bi, 0); }
  let dep = 0;
  for (const b of U.blocks) { const bi = byKey.get(`block:${b.symbol}`); for (const d of b.depends_on || []) { const t = byKey.get(`block:${d.symbol}`) ?? byKey.get(`group:${d.symbol}`) ?? -1; if (addEdge(bi, t, 1, 1, d.via && d.via.length ? d.via : null) >= 0) dep++; } }
  core.dependsOnCount = dep;
}
core.viaOf = (a, b) => { for (const e of core.edgeIds(a, 1, 'out')) if (E.b[e] === b) return E.via.get(e) || null; return null; };

/* ================= families: buckets (lazy forever) ================= */
export async function family(n) {
  const b = Math.floor(n / (U.index.bucket_size || 500));
  if (!U.buckets.has(b)) U.buckets.set(b, getJSON(`${STARS}code/f/${b}.json`));
  const bucket = await U.buckets.get(b);
  const rec = bucket[String(n)] || null;
  const idx = core.byKey.get(`family:${n}`);
  if (rec && idx != null) { core.famRec[idx] = rec; if (!core.famName[idx] && rec.names && rec.names[0]) core.famName[idx] = rec.names[0]; if (!core.famKind[idx]) core.famKind[idx] = rec.kind || null; }
  return rec;
}
export async function familyLines(rec) {
  const p = (rec.places || [])[0];
  if (!p) return rec.lines.map(k => ({ key: k, text: '(source not yet known: no place recorded)' }));
  const id = `${p.repo}@${p.commit}:${p.path}`;
  if (!U.texts.has(id)) U.texts.set(id, fetch(`https://raw.githubusercontent.com/${p.repo}/${p.commit}/${p.path.split('/').map(encodeURIComponent).join('/')}`).then(r => { if (!r.ok) throw new Error(`GitHub returned HTTP ${r.status}`); return r.text(); }).then(t => t.split('\n')));
  const all = await U.texts.get(id);
  const src = all.slice(p.first - 1, p.last);
  return rec.lines.map((k, i) => ({ key: k, text: src[i] ?? '' }));
}
export function familyLinks(rec, n) {
  const p = (rec.places || [])[0];
  return { page: `${STARS}code.html?family=${n}`, gh: p ? `https://github.com/${p.repo}/blob/${p.commit}/${p.path}#L${p.first}-L${p.last}` : null, live: (rec.places || []).map(x => x.live).find(Boolean) || null };
}
export const famName = rec => (rec && rec.names && rec.names[0]) || '(name not yet known)';
/** kind 2 edges from the focus family's bucket record, appended once per family (§1.3) */
const famEdgesDone = new Set();
core.loadFamilyEdges = async function (idx) {
  if (!core.isClass(idx, 'family') || famEdgesDone.has(idx)) return core.famRec[idx];
  const rec = await family(core.rec[idx]); famEdgesDone.add(idx); if (!rec) return null;
  for (const u of rec.uses || []) { const t = core.byKey.get(`family:${u.family}`); if (t != null) addEdge(idx, t, 2); }
  for (const u of rec.used_by || []) { const s = core.byKey.get(`family:${u.family}`); if (s != null) addEdge(s, idx, 2); }
  return rec;
};

/* ================= tier 2: the pack (§1.1, §1.2 lines) ================= */
let packPromise = null;
export function loadPack() {
  if (packPromise) return packPromise;
  packPromise = (async () => {
    const [fams, bin, random, entangled, prov] = await Promise.all([getJSON(PACK + 'families.json'), fetch(PACK + 'lines.bin', { cache: 'default' }).then(r => { if (!r.ok) throw new Error(`${PACK}lines.bin returned HTTP ${r.status}`); return r.arrayBuffer(); }), getJSON(PACK + 'random.json'), getJSON(PACK + 'entangled.json'), getJSON(PACK + 'provenance.json')]);
    U.pack = fams; U.random = random; U.entangled = entangled; U.prov = prov; U.packBytes = bin;
    U.packSha = ((prov.outputs || []).find(o => o.file === 'lines.bin') || {}).sha256 || null;
    const { byKey, range } = core;
    const lineKey = new Uint32Array(bin), M = lineKey.length, lineFam = new Uint32Array(M).fill(0xffffffff);
    let orphans = 0, maxKey = 0; const nameToFam = new Map();
    core.famPack = new Array(core.N).fill(null);
    for (const f of fams) {
      const idx = byKey.get(`family:${f.n}`);
      if (idx == null) { orphans++; continue; }
      core.famPack[idx] = f; core.famName[idx] = f.name && f.name !== '(anonymous)' ? f.name : core.famName[idx]; core.famKind[idx] = f.kind || core.famKind[idx]; core.mass[idx] = Math.max(1, f.lineCount || 0);
      if (f.name && !nameToFam.has(f.name)) nameToFam.set(f.name, idx);
      lineFam.fill(idx, f.lineOffset, f.lineOffset + f.lineCount);
    }
    for (let i = 0; i < M; i++) if (lineKey[i] > maxKey) maxKey = lineKey[i];
    // counting sort by key → lineOrder; distinct keys → lineIndex with lineFirst offsets
    const count = new Uint32Array(maxKey + 2); for (let i = 0; i < M; i++) count[lineKey[i] + 1]++;
    for (let k = 0; k <= maxKey; k++) count[k + 1] += count[k];
    const lineOrder = new Uint32Array(M), fill = count.slice(0, maxKey + 1); for (let i = 0; i < M; i++) lineOrder[fill[lineKey[i]]++] = i;
    let distinct = 0; for (let k = 0; k <= maxKey; k++) if (count[k + 1] > count[k]) distinct++;
    const lineIndex = new Uint32Array(distinct), lineFirst = new Uint32Array(distinct + 1); let d = 0;
    for (let k = 0; k <= maxKey; k++) if (count[k + 1] > count[k]) { lineIndex[d] = k; lineFirst[d] = count[k]; d++; } lineFirst[distinct] = M;
    const lineShared = new Uint8Array(M); for (let j = 0; j < distinct; j++) { const a = lineFirst[j], b = lineFirst[j + 1]; if (b - a > 1) { const fs = new Set(); for (let q = a; q < b; q++) fs.add(lineFam[lineOrder[q]]); if (fs.size > 1) for (let q = a; q < b; q++) lineShared[lineOrder[q]] = 1; } }
    Object.assign(core, { lineKey, lineFam, lineOrder, lineIndex, lineFirst, lineShared, nameToFam });
    core.packStats = U.packStats = { instances: M, distinct, unique: U.index.lines, orphans, built: prov.built_utc, sha: U.packSha };
    // kind 5 random link (family ↔ family, joined by name: random.json numbers souls, not families — see GRAMMAR deviations)
    const endpoint = s => { let m = String(s).match(/^#\d+ (.+)$/); if (m) { const nm = m[1].split('/').pop(); return nameToFam.has(nm) ? nameToFam.get(nm) : -1; } return -1; };
    let rDrawn = 0; for (const e of random.edges || []) { const a = endpoint(e.from), b = endpoint(e.to); if (a >= 0 && b >= 0 && addEdge(a, b, 5, typeof e.p === 'number' ? e.p : 0.25) >= 0) rDrawn++; }
    core.randomStats = { edges: (random.edges || []).length, drawn: rDrawn, seed: ((random.sources || [])[0] || {}).seed || null };
    // kind 6 entangled (family → repository, joined by name)
    let eDrawn = 0, eJoined = 0; const soul = entangled.soul_md || {};
    for (const x of entangled.entanglements || []) { const f = nameToFam.get(x.name); if (f == null) continue; eJoined++; for (const r of x.called_from || []) { const ri = byKey.get(`repo:${r}`); if (ri != null && addEdge(f, ri, 6) >= 0) eDrawn++; } }
    core.entangledStats = { stated: soul.entanglements_stated ?? null, listed: (entangled.entanglements || []).length, joined: eJoined, drawn: eDrawn };
    return core.packStats;
  })();
  return packPromise;
}
core.packLoaded = () => !!U.pack;
/** families carrying line number n → Uint32Array of family idx (distinct, in pack order); null before tier 2 */
core.familiesOfLine = function (n) {
  if (!core.lineIndex) return null;
  const L = core.lineIndex; let lo = 0, hi = L.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m] < n) lo = m + 1; else if (L[m] > n) hi = m - 1; else { const s = new Set(); for (let q = core.lineFirst[m]; q < core.lineFirst[m + 1]; q++) { const f = core.lineFam[core.lineOrder[q]]; if (f !== 0xffffffff) s.add(f); } return Uint32Array.from(s); } }
  return new Uint32Array(0);
};
/** kind 4 shared line for one family over the whole pack, ≤ 8 partners per line key, w = shared count; cached */
const sharedDone = new Map();
core.sharedOf = function (idx) {
  if (sharedDone.has(idx)) return sharedDone.get(idx);
  const f = core.famPack && core.famPack[idx]; const acc = new Map();
  if (f) for (let i = f.lineOffset; i < f.lineOffset + f.lineCount; i++) { const fs = core.familiesOfLine(core.lineKey[i]); let k = 0; for (const g of fs) { if (g === idx) continue; if (k++ >= 8) break; acc.set(g, (acc.get(g) || 0) + 1); } }
  const out = [...acc.entries()].sort((a, b) => b[1] - a[1]).map(([g, w]) => { addEdge(idx, g, 4, w); return { idx: g, w }; });
  sharedDone.set(idx, out); return out;
};
/** shared partners among loaded bucket records only (before tier 2), as core.js did */
core.sharedLoaded = async function (n, lines) {
  const keys = new Set(lines), shared = new Map();
  for (const p of U.buckets.values()) { const bucket = await p.catch(() => ({})); for (const [m, r] of Object.entries(bucket)) { if (+m === n) continue; const hit = (r.lines || []).filter(k => keys.has(k)).length; if (hit) shared.set(+m, hit); } }
  return [...shared.entries()].map(([m, w]) => ({ idx: core.byKey.get(`family:${m}`), n: m, w })).filter(x => x.idx != null);
};

/* ================= labels, keys, counts (§0) ================= */
core.label = function label(idx) {
  if (idx < 0 || idx >= core.N) return 'not yet known';
  const r = core.rec[idx];
  switch (core.cls[idx]) {
    case 0: return r.title;
    case 1: return r;
    case 2: return `${r.symbol} · ${r.title}`;
    case 3: return `${r} · (not yet named)`;
    default: { const nm = core.famName[idx] || (U.nameOf && U.nameOf.get(r)); return nm ? `#${r} ${nm}` : (U.pack ? `#${r} (name not yet known)` : `#${r}`); }
  }
};
core.labelKey = function (key) {
  const m = /^line:(\d+)$/.exec(key);
  if (m) { const fs = core.familiesOfLine(+m[1]); return `line ${fmt(m[1])} · ${fs === null ? '(line index still loading)' : fs.length ? core.label(fs[0]) : '(families not yet known)'}`; }
  const i = core.resolve(key); return i >= 0 ? core.label(i) : `Key ${key} is not in the published records.`;
};
core.short = idx => core.cls[idx] === 2 || core.cls[idx] === 3 ? core.rec[idx].symbol || core.rec[idx] : core.cls[idx] === 4 ? `#${core.rec[idx]}` : core.label(idx);
core.colour = idx => { const c = core.cat[idx]; return c < U.cats.length ? U.cats[c].colour || PAL.muted : PAL.muted; };
/** A line key names a line, not a family. NAVIGATE (§4) focuses its first family; COMPOSE must not guess (repair round, major 1):
 *  lineChoice holds the family a person picked for a line carried by several; composeEntity() returns -1 until they do. */
core.lineChoice = new Map();
core.resolveLine = function (n) { const fs = core.familiesOfLine(n); if (fs === null) return { fams: null, idx: -1, chosen: false }; if (fs.length === 1) return { fams: fs, idx: fs[0], chosen: false }; const c = core.lineChoice.get(n); return { fams: fs, idx: c != null && fs.includes(c) ? c : -1, chosen: c != null && fs.includes(c) }; };
core.composeEntity = function (key) { const m = /^line:(\d+)$/.exec(String(key).trim()); if (m) return core.resolveLine(+m[1]).idx; return core.resolve(key); };
core.resolve = function resolve(str) {
  if (typeof str !== 'string') return -1;
  const s = str.trim();
  if (core.byKey.has(s)) return core.byKey.get(s);
  let m;
  if ((m = /^line:(\d+)$/.exec(s))) { const r = core.resolveLine(+m[1]); if (r.idx >= 0) return r.idx; const fs = r.fams; return fs && fs.length ? fs[0] : -1; }
  if ((m = /^#?(\d+)$/.exec(s))) return core.byKey.get(`family:${m[1]}`) ?? -1;
  if (/^[A-Z][a-z]?$/.test(s)) return core.byKey.get(`block:${s}`) ?? -1;
  if (/^x\d+$/.test(s)) return core.byKey.get(`group:${s}`) ?? -1;
  return -1;
};
core.countsLine = function countsLine() {
  const named = U.blocks.filter(b => b.kind !== 'auto').length, auto = U.blocks.filter(b => b.kind === 'auto').length;
  return `${fmt(U.blocks.length)} blocks on the table (${fmt(named)} named · ${fmt(auto)} found automatically) · ${fmt(U.unnamed.length)} groups off the table · ${fmt(U.index.families)} function families · ${fmt(U.index.lines)} unique numbered lines · ${fmt(core.reposOrdered.length)} repositories · data ${shortUtc(U.generated)}`;
};
core.countsTitle = () => U.packStats ? `${fmt(U.packStats.unique)} per code/index.json · ${fmt(U.packStats.instances)} line instances · ${fmt(U.packStats.distinct)} distinct numbers in this pack` : null;
export const countsLine = () => core.countsLine();
core.kindSentence = b => KIND_TEXT[b.kind] || 'not yet known';

/* ================= paging ================= */
export function pageList(host, items, render, step = 40, label = 'more') {
  let shown = 0; const more = el('button', { class: 'u-chip u-more' });
  const fill = () => { const next = items.slice(shown, shown + step); next.forEach(it => host.insertBefore(render(it), more)); shown += next.length; if (shown >= items.length) more.remove(); else more.textContent = `show ${Math.min(step, items.length - shown)} ${label} (${items.length - shown} left)`; };
  host.append(more); more.addEventListener('click', fill); fill();
  return host;
}

/* ================= state, trail, URL grammar (§1.4, §4, §5) ================= */
export const state = { lens: 'ring', focus: -1, measure: -1, trail: [], recipe: [], kindsOn: 0x7f, cat: -1 };
core.state = state;
export function trailPush(idx) { const t = state.trail; if (t.length && t[t.length - 1] === idx) return; t.push(idx); U.trail = t; }
export function trailVisits(idx) { return state.trail.filter(x => x === idx).length; }
const EDGE_INITIALS = 'cdubsre';
export function writeQuery(st = state) {
  const p = [];
  p.push(`lens=${st.lens}`);
  if (st.focus >= 0) p.push(`key=${st.focusKey || core.keyStr[st.focus]}`);
  if (st.trail.length) p.push(`trail=${st.trail.slice(-12).map(i => core.keyStr[i]).join(',')}`);
  if (st.recipe.length) p.push(`recipe=${st.recipe.slice(0, 24).map(k => typeof k === 'string' ? k : core.keyStr[k]).join(',')}`);
  if (st.measure >= 0 && st.measure !== st.focus) p.push(`m=${st.measureKey || core.keyStr[st.measure]}`);
  if (st.kindsOn !== 0x7f) p.push(`edges=${[...EDGE_INITIALS].filter((c, i) => (st.kindsOn >> i) & 1).join('')}`);
  if (st.cat >= 0) p.push(`cat=${U.cats[st.cat].id}`);
  p.push(`data=${stamp(U.generated)}`);
  return '?' + p.join('&');
}
/** parse the query (and the inbound grammars of the other pages) once on load; returns a partial state + notes */
export function readQuery(search = location.search, hash = location.hash) {
  const q = new URLSearchParams(search), out = { notes: [] }, h = new URLSearchParams(hash.replace(/^#/, ''));
  let key = q.get('key');
  if (!key && h.get('family')) key = `family:${h.get('family')}`;
  if (!key && h.get('block')) key = `block:${h.get('block')}`;
  if (!key && q.get('block')) { key = `block:${q.get('block')}`; out.lens = 'table'; }
  if (!key && q.get('family')) { key = `family:${q.get('family')}`; out.lens = 'column'; }
  if (!key && q.get('graph') === 'periodic-table' && q.get('focus')) {
    const f = q.get('focus'), sym = f.split(' · ')[0].trim(); out.lens = 'column';
    let b = U.bySym.get(sym) || U.blocks.find(x => x.title === f) || U.blocks.find(x => x.title.toLowerCase() === f.toLowerCase());
    if (b) key = `block:${b.symbol}`; else out.notes.push('key not yet known');
  }
  if (q.get('blocks') && !q.get('recipe')) { out.lens = out.lens || 'table'; out.recipe = q.get('blocks').split(',').filter(Boolean).map(s => `block:${s.trim()}`); }
  if (q.get('lens') && LENSES.includes(q.get('lens'))) out.lens = q.get('lens');
  if (key) out.key = key;
  if (q.get('trail')) out.trail = q.get('trail').split(',').filter(Boolean);
  if (q.get('recipe')) out.recipe = q.get('recipe').split(',').filter(Boolean);
  if (q.get('m')) out.m = q.get('m');
  if (q.get('edges') != null) { let mask = 0; for (const c of q.get('edges')) { const i = EDGE_INITIALS.indexOf(c); if (i >= 0) mask |= 1 << i; } out.kindsOn = mask; }
  if (q.get('cat')) out.cat = q.get('cat');
  if (q.get('data')) { out.data = q.get('data'); if (out.data < stamp(U.generated)) out.notes.push(`link made against data of ${out.data.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)$/, '$1-$2-$3 $4:$5 UTC')}`); }
  return out;
}

/* ================= picking: CPU uniform grid 32×32 over target positions (§1.5) ================= */
export function buildGrid(pos, N) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < N; i++) { const x = pos[2 * i], y = pos[2 * i + 1]; if (x !== x) continue; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (!isFinite(x0)) return { empty: true, cells: [], x0: 0, y0: 0, cw: 1, ch: 1 };
  const cw = (x1 - x0) / 32 || 1, ch = (y1 - y0) / 32 || 1, cells = Array.from({ length: 1024 }, () => []);
  for (let i = 0; i < N; i++) { const x = pos[2 * i], y = pos[2 * i + 1]; if (x !== x) continue; const cx = Math.min(31, ((x - x0) / cw) | 0), cy = Math.min(31, ((y - y0) / ch) | 0); cells[cy * 32 + cx].push(i); }
  return { empty: false, cells, x0, y0, cw, ch, pos, N };
}
/** nearest entity within r (layout units) of (x,y); returns { idx, d, second, d2 } — the shell decides ambiguity */
export function pick(grid, x, y, r, prefer = null) {
  if (grid.empty) return { idx: -1, d: Infinity, second: -1, d2: Infinity };
  const { cells, x0, y0, cw, ch, pos } = grid; let best = -1, bd = Infinity, sec = -1, sd = Infinity;
  const cx0 = Math.max(0, ((x - r - x0) / cw) | 0), cx1 = Math.min(31, ((x + r - x0) / cw) | 0), cy0 = Math.max(0, ((y - r - y0) / ch) | 0), cy1 = Math.min(31, ((y + r - y0) / ch) | 0);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) for (const i of cells[cy * 32 + cx]) {
    let px = pos[2 * i], py = pos[2 * i + 1]; if (prefer) { const o = prefer(i); if (o) { px += o[0]; py += o[1]; } }
    const d = Math.hypot(px - x, py - y); if (d > r) continue;
    if (d < bd) { sec = best; sd = bd; best = i; bd = d; } else if (d < sd) { sec = i; sd = d; }
  }
  return { idx: best, d: bd, second: sec, d2: sd };
}

/* ================= search resolver (§3.2) ================= */
core.search = function (q) {
  q = q.trim(); const hits = []; let m;
  if (!q) return hits;
  if ((m = /^#?(\d+)$/.exec(q))) { const n = +m[1]; const fi = core.byKey.get(`family:${n}`); if (fi != null) hits.push({ key: `family:${n}`, label: core.label(fi) }); const fs = core.familiesOfLine(n); if (fs === null && !q.startsWith('#')) hits.push({ note: 'line index still loading' }); else if (fs && fs.length) hits.push({ key: `line:${n}`, label: core.labelKey(`line:${n}`) }); if (!hits.length) hits.push({ note: `Key ${q} is not in the published records.` }); return hits; }
  if ((m = /^(?:L|line )(\d+)$/i.exec(q))) { const n = +m[1], fs = core.familiesOfLine(n); if (fs === null) hits.push({ note: 'line index still loading' }); else if (fs.length) hits.push({ key: `line:${n}`, label: core.labelKey(`line:${n}`) }); else hits.push({ note: `Key line:${n} is not in the published records.` }); return hits; }
  if (/^[A-Z][a-z]$/.test(q) && core.byKey.has(`block:${q}`)) return [{ key: `block:${q}`, label: core.label(core.byKey.get(`block:${q}`)) }];
  if (/^x\d+$/.test(q) && core.byKey.has(`group:${q}`)) return [{ key: `group:${q}`, label: core.label(core.byKey.get(`group:${q}`)) }];
  if (q.length < 2) return hits;
  if (!U.names) return [{ note: 'names still loading' }];
  const lq = q.toLowerCase(); const found = Object.keys(U.names).filter(k => k.toLowerCase().includes(lq)).sort((a, b) => a.length - b.length).slice(0, 12);
  for (const k of found) for (const n of U.names[k].slice(0, 3)) if (core.byKey.has(`family:${n}`)) hits.push({ key: `family:${n}`, label: `#${n} ${k}` });
  if (!hits.length) hits.push({ note: 'No function name contains that text.' });
  return hits;
};

export function footerText(id, lens) {
  let s = `${id} · built ${window.BUILT || ''} UTC · live data: ${STARS}blocks/, ${STARS}code/, raw.githubusercontent.com · GLOBALGRID2050`;
  if (lens) s += ` · lens ${lens.id} from ${lens.from}`;
  if (U.packStats) s += ` · pack ${shortUtc(U.packStats.built)} sha256 ${(U.packStats.sha || '').slice(0, 7)}`;
  return s;
}
export { core as default };
