// build_state.mjs — Quantum Twin Star data builder (node >= 20, fetch built in).
// Downloads ONLY the public sources listed below and packs them for a browser page.
// Nothing is invented: every number written comes from the fetched bytes.
// Outputs go to ./data next to this file. Run:  node build_state.mjs

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'data');

const STARS = 'https://ventusltd.github.io/stars/';
const STAR_MAKER_COMMIT = 'c5bf5f6518feba594bb057988e8e99ca81044952';
const SM = `https://raw.githubusercontent.com/Ventusltd/star-maker/${STAR_MAKER_COMMIT}/`;

const SHIP_LIMIT_BYTES = 3_500_000; // "under 3.5 MB"; the MiB figure (3,670,016) is reported alongside
const EXPECTED_LINES_AT_1955_UTC = 250174; // stated by the task; index.json is the authority
const BUCKET_CONCURRENCY = 8;

// ---------------------------------------------------------------- fetch with retries + provenance
const provenanceSources = [];
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function fetchBytes(url, { retries = 4 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'quantum-twin-star-build/1 (node)' } });
      if (res.status === 404) {
        // A 404 is not transient. Fail loudly; never invent.
        throw Object.assign(new Error(`404 Not Found: ${url}`), { fatal: true });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      provenanceSources.push({
        url,
        bytes: buf.length,
        sha256: sha256(buf),
        fetched_utc: new Date().toISOString(),
        http_status: res.status,
        attempts: attempt,
      });
      return buf;
    } catch (err) {
      lastErr = err;
      if (err.fatal) throw err;
      const wait = 500 * 2 ** (attempt - 1);
      console.warn(`  retry ${attempt}/${retries} for ${url} after error: ${err.message} (waiting ${wait} ms)`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`fetch failed after ${retries} attempts: ${url} :: ${lastErr && lastErr.message}`);
}
const fetchJson = async (url) => JSON.parse((await fetchBytes(url)).toString('utf8'));
const fetchText = async (url) => (await fetchBytes(url)).toString('utf8');

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const isU32 = (x) => Number.isInteger(x) && x >= 0 && x <= 0xffffffff;

// ELECTRON.md "## Conduction band" section: "- **#2039 Number** (def, 7 lines, home …) · valence 6: … · spin unpaired"
export function parseConductionBand(md) {
  const start = md.indexOf('\n## Conduction band');
  if (start < 0) return [];
  const end = md.indexOf('\n## ', start + 1);
  const section = md.slice(start, end < 0 ? undefined : end);
  const out = [];
  for (const line of section.split('\n')) {
    const m = /^- \*\*#(\d+) (.+?)\*\*/.exec(line);
    if (m) out.push({ n: +m[1], name: m[2] });
  }
  return out;
}

// ---------------------------------------------------------------- main
async function main() {
  await mkdir(OUT, { recursive: true });
  const report = { warnings: [], mismatches: [] };
  const warn = (m) => { report.warnings.push(m); console.warn('WARN: ' + m); };

  // ---- 1+2. families and lines --------------------------------------------------------------
  console.log('fetching stars code/index.json ...');
  const index = await fetchJson(STARS + 'code/index.json');
  if (!Array.isArray(index.buckets)) throw new Error('index.json has no "buckets" array');
  console.log(`index.json: families=${index.families} lines=${index.lines} buckets=${index.buckets.length} bucket_size=${index.bucket_size} generated_utc=${index.generated_utc}`);

  console.log('fetching stars code/names.json, blocks/blocks.json, blocks/families.json ...');
  const [names, blocksSrc, blockFamilies] = await Promise.all([
    fetchJson(STARS + 'code/names.json'),
    fetchJson(STARS + 'blocks/blocks.json'),
    fetchJson(STARS + 'blocks/families.json'),
  ]);

  console.log(`fetching ${index.buckets.length} buckets (concurrency ${BUCKET_CONCURRENCY}) ...`);
  const bucketRecords = await mapLimit(index.buckets, BUCKET_CONCURRENCY, async (b) => {
    const body = await fetchJson(`${STARS}code/f/${b}.json`);
    const recs = Array.isArray(body) ? body : Object.values(body);
    for (const r of recs) {
      if (!Number.isInteger(r.n)) throw new Error(`bucket ${b}: family record without integer n`);
      if (!Array.isArray(r.lines)) throw new Error(`bucket ${b}: family ${r.n} has no "lines" array`);
      // published layout: bucket b holds families n with floor(n / bucket_size) === b (family 500 is in bucket 1)
      if (index.bucket_size && Math.floor(r.n / index.bucket_size) !== b) {
        warn(`family ${r.n} found in bucket ${b} but bucket_size ${index.bucket_size} implies bucket ${Math.floor(r.n / index.bucket_size)}`);
      }
    }
    return recs;
  });

  // Group by family in ascending family number. Never renumber; never sort lines within a family.
  const allFamilies = bucketRecords.flat();
  const seenN = new Set();
  for (const r of allFamilies) {
    if (seenN.has(r.n)) throw new Error(`family number ${r.n} appears in more than one bucket record`);
    seenN.add(r.n);
  }
  allFamilies.sort((a, b) => a.n - b.n);

  // Block membership: symbol -> family numbers (blocks/families.json); block -> category (blocks.json)
  const blockBySymbol = new Map(blocksSrc.blocks.map((b) => [b.symbol, b]));
  const categoryById = new Map(blocksSrc.categories.map((c) => [c.id, c]));
  const symbolOfFamily = new Map();
  for (const [symbol, fams] of Object.entries(blockFamilies)) {
    for (const n of fams) {
      if (symbolOfFamily.has(n)) warn(`family ${n} listed under two block symbols: ${symbolOfFamily.get(n)} and ${symbol}`);
      symbolOfFamily.set(n, symbol);
    }
  }
  const symbolsNotOnTable = Object.keys(blockFamilies).filter((s) => !blockBySymbol.has(s));

  let totalLines = 0;
  for (const r of allFamilies) totalLines += r.lines.length;
  const lines = new Uint32Array(totalLines);
  const families = [];
  let offset = 0;
  const lineSeen = new Set();
  let maxLine = 0, minLine = Infinity;
  let familiesWithNoLines = 0;
  let familiesOffTable = 0;
  let familiesNoBlock = 0;
  let familiesAnonymous = 0;
  for (const r of allFamilies) {
    for (const x of r.lines) {
      if (!isU32(x)) throw new Error(`family ${r.n}: line number ${x} is not a uint32`);
      lines[offset++] = x;
      lineSeen.add(x);
      if (x > maxLine) maxLine = x;
      if (x < minLine) minLine = x;
    }
    const lineCount = r.lines.length;
    if (lineCount === 0) familiesWithNoLines++;
    const symbol = symbolOfFamily.get(r.n) ?? null;
    const block = symbol ? blockBySymbol.get(symbol) : undefined;
    if (!symbol) familiesNoBlock++;
    else if (!block) familiesOffTable++;
    const name = Array.isArray(r.names) && r.names.length ? r.names[0] : null;
    if (name === '(anonymous)') familiesAnonymous++;
    families.push({
      n: r.n,
      name,
      kind: r.kind ?? null,
      block: symbol,
      category: block ? block.category : null,
      lineOffset: offset - lineCount,
      lineCount,
      repos: Array.isArray(r.repos) ? r.repos.length : null,
      files: typeof r.files === 'number' ? r.files : null,
      standalone: typeof r.standalone === 'boolean' ? r.standalone : null,
      first_written: r.first_written ?? null,
    });
  }
  if (offset !== totalLines) throw new Error('line packing offset mismatch');

  // names.json cross-check: first name of each named family should be a key in names.json that maps to n.
  // "(anonymous)" families are not in names.json by design; count them separately.
  let nameMismatch = 0, nameMismatchNamed = 0;
  for (const f of families) {
    if (f.name === null) continue;
    const ns = names[f.name];
    if (!Array.isArray(ns) || !ns.includes(f.n)) { nameMismatch++; if (f.name !== '(anonymous)') nameMismatchNamed++; }
  }
  if (nameMismatchNamed) warn(`${nameMismatchNamed} named families whose first name is not mapped back to them in names.json`);

  if (families.length !== index.families) report.mismatches.push(`family count ${families.length} != index.json families ${index.families}`);
  if (totalLines !== index.lines && lineSeen.size !== index.lines) {
    report.mismatches.push(`lines.bin has ${totalLines} entries (${lineSeen.size} distinct line numbers, max ${maxLine}); neither equals index.json lines ${index.lines} — index.json's figure is not reproducible from the per-family "lines" lists in code/f/*.json`);
  }
  if (index.lines !== EXPECTED_LINES_AT_1955_UTC) report.mismatches.push(`index.json lines ${index.lines} != task's stated 19:55 UTC figure ${EXPECTED_LINES_AT_1955_UTC}`);

  const linesBuf = Buffer.from(lines.buffer, lines.byteOffset, lines.byteLength); // Uint32Array is native-endian; assert LE below
  if (new Uint8Array(new Uint32Array([1]).buffer)[0] !== 1) throw new Error('this machine is big-endian; lines.bin must be little-endian');

  // ---- 3. blocks.json (trimmed) -----------------------------------------------------------
  // blocks.json "inside" and blocks/families.json can disagree on a block's family list; ship both counts.
  let insideDisagree = 0;
  for (const b of blocksSrc.blocks) {
    const a = new Set((b.inside || []).map((x) => x.family));
    const f = new Set(blockFamilies[b.symbol] || []);
    if (a.size !== f.size || ![...a].every((x) => f.has(x))) insideDisagree++;
  }
  const blocksOut = {
    generated_utc: blocksSrc.generated_utc ?? null,
    categories: blocksSrc.categories.map((c) => ({ id: c.id, title: c.title, colour: c.colour, blurb: c.blurb ?? null })),
    blocks: blocksSrc.blocks.map((b) => ({
      number: b.number,
      symbol: b.symbol,
      title: b.title,
      category: b.category,
      colour: categoryById.get(b.category)?.colour ?? null,
      kind: b.kind ?? null,
      state: b.state ?? null,
      families: Array.isArray(blockFamilies[b.symbol]) ? blockFamilies[b.symbol].length : 0, // per blocks/families.json
      inside: Array.isArray(b.inside) ? b.inside.length : null, // per blocks.json "inside"
      functions: typeof b.functions === 'number' ? b.functions : null,
    })),
    // symbols present in blocks/families.json but absent from the blocks.json table (no title, no category)
    symbols_off_table: symbolsNotOnTable.map((s) => ({ symbol: s, families: blockFamilies[s].length })),
  };

  // ---- 4. electron.json ------------------------------------------------------------------
  console.log('fetching star-maker electron/graph.json, electron/atoms.json, ELECTRON.md ...');
  const [eGraph, eAtoms, electronMd] = await Promise.all([
    fetchJson(SM + 'electron/graph.json'),
    fetchJson(SM + 'electron/atoms.json'),
    fetchText(SM + 'ELECTRON.md'),
  ]);
  const REASON_RE = /^(\S+) · (\d+) lines · shells K(\d+) L(\d+) M(\d+) · valence (\d+) · spin (paired|unpaired) · homes ([^·]+?)(?: · says: (.*))?$/s;
  const parseReason = (reason) => {
    const m = REASON_RE.exec(reason || '');
    if (!m) return null;
    return {
      kind: m[1], lines: +m[2], shells: { K: +m[3], L: +m[4], M: +m[5] }, valence: +m[6], spin: m[7],
      homes: m[8].split(',').map((s) => s.trim()).filter(Boolean), says: m[9] ?? null,
    };
  };
  const labelKey = (label) => { const m = /^#(\d+)\s+(.*)$/.exec(label); return m ? { n: +m[1], name: m[2] } : null; };

  const atomsByN = new Map();
  const atomRecords = Array.isArray(eAtoms.top) ? eAtoms.top : [];
  for (const a of atomRecords) {
    if (atomsByN.has(a.number)) warn(`atoms.json top: number ${a.number} appears twice`);
    atomsByN.set(a.number, {
      n: a.number, name: a.name, soul: a.soul ?? null, kind: a.kind ?? null, lines: a.lines ?? null,
      purpose: a.purpose ?? null, incarnations: a.incarnations ?? null,
      class: a.class ?? null, shells: a.shells ?? null, valence: a.valence ?? null, spin: a.spin ?? null,
      homes: Array.isArray(a.homes) ? a.homes : [], valence_repos: Array.isArray(a.valence_repos) ? a.valence_repos : [],
      tunnelling: typeof a.tunnelling === 'boolean' ? a.tunnelling : null,
      in_graph: false, rag: null, reason: null,
    });
  }
  let graphOnlyAtoms = 0, unparsedReasons = 0, reasonDisagreements = 0;
  const repoNodes = [];
  for (const node of eGraph.nodes) {
    if (node.type === 'repo' || /^repo /.test(node.label)) {
      repoNodes.push({ repo: node.label.replace(/^repo /, ''), rag: node.rag ?? null, reason: node.reason ?? null });
      continue;
    }
    const k = labelKey(node.label);
    if (!k) { warn(`electron graph node with unparseable label: ${node.label}`); continue; }
    const parsed = parseReason(node.reason);
    if (!parsed) unparsedReasons++;
    let atom = atomsByN.get(k.n);
    if (!atom) {
      graphOnlyAtoms++;
      atom = {
        n: k.n, name: k.name, soul: null, kind: parsed?.kind ?? null, lines: parsed?.lines ?? null, purpose: parsed?.says ?? null,
        incarnations: null, class: node.type ?? null, shells: parsed?.shells ?? null, valence: parsed?.valence ?? null,
        spin: parsed?.spin ?? null, homes: parsed?.homes ?? [], valence_repos: [], tunnelling: null,
        in_graph: true, rag: node.rag ?? null, reason: node.reason ?? null,
      };
      atomsByN.set(k.n, atom);
    } else {
      atom.in_graph = true; atom.rag = node.rag ?? null; atom.reason = node.reason ?? null;
      if (parsed) {
        const disagree = atom.class !== node.type || atom.valence !== parsed.valence || atom.spin !== parsed.spin
          || atom.shells?.K !== parsed.shells.K || atom.shells?.L !== parsed.shells.L || atom.shells?.M !== parsed.shells.M;
        if (disagree) reasonDisagreements++;
      }
    }
  }
  if (unparsedReasons) warn(`${unparsedReasons} electron graph reasons did not match the expected pattern`);
  if (reasonDisagreements) warn(`${reasonDisagreements} electron atoms where graph.json reason disagrees with atoms.json fields`);
  const bonds = [];
  for (const e of eGraph.edges) {
    if (e.kind !== 'BONDS_WITH') { warn(`electron edge of unexpected kind ${e.kind}`); continue; }
    const repo = e.from.replace(/^repo /, '');
    const k = labelKey(e.to);
    if (!k) { warn(`electron edge to unparseable label ${e.to}`); continue; }
    bonds.push({ repo, atom: k.n });
  }
  // class table from ELECTRON.md (atoms.json carries 5 of the 6 classes; "ambiguous" is only in the md table)
  const mdClasses = {};
  for (const m of electronMd.matchAll(/^\|\s*\**([a-z-]+)\**\s*\|[^|]*\|\s*\**(\d+)\**\s*\|\s*$/gm)) mdClasses[m[1]] = +m[2];
  const mdAtomsTotal = (/^# The Electron star — ([\d,]+) atoms/m.exec(electronMd) || [])[1];
  // conduction band order as ELECTRON.md lists it (the page walks the band in this order; nothing typed by hand)
  const conductionBand = parseConductionBand(electronMd);
  const atoms = [...atomsByN.values()].sort((a, b) => a.n - b.n);
  const electronOut = {
    generated_utc: eAtoms.generated_utc ?? eGraph.generated_utc ?? null,
    star_maker_commit: STAR_MAKER_COMMIT,
    note: eGraph.note ?? null,
    focus_default: typeof eGraph.focus_default === 'string' ? eGraph.focus_default : null, // electron/graph.json focus_default, verbatim
    conduction_band_electron_md: conductionBand, // [{n,name}] in ELECTRON.md "## Conduction band" order
    totals: {
      atoms_in_star: typeof eAtoms.atoms === 'number' ? eAtoms.atoms : null,
      atoms_in_md_heading: mdAtomsTotal ? +mdAtomsTotal.replace(/,/g, '') : null,
      atoms_shipped: atoms.length,
      atoms_json_top_records: atomRecords.length,
      classes_atoms_json: eAtoms.classes ?? null,
      classes_electron_md: mdClasses,
      unpaired_with_external_bonds: typeof eAtoms.unpaired === 'number' ? eAtoms.unpaired : null,
      graph_nodes: eGraph.nodes.length,
      graph_edges: eGraph.edges.length,
    },
    atoms,
    repos: repoNodes,
    bonds,
  };

  // ---- 5. random.json --------------------------------------------------------------------
  console.log('fetching stars spider/graphs/random.json and star-maker random/graph.json ...');
  const [rStars, rMaker] = await Promise.all([
    fetchJson(STARS + 'spider/graphs/random.json'),
    fetchJson(SM + 'random/graph.json'),
  ]);
  const RANDOM_KINDS = new Set(['MIGHT_TOUCH', 'RHYMES_WITH', 'WHAT_IF', 'COULD_REPLACE', 'ENTANGLED_MAYBE', 'REMINDS_OF']);
  const RANDOM_TYPES = new Set(['electron', 'soul', 'vedic', 'magnetar', 'chemistry']);
  // The two files are different random draws (different seeds); the same key can be drawn from a
  // different star in each, so type is kept per source. `type` is the single agreed type, else null.
  const rNodes = new Map();
  const addNode = (key, node, src) => {
    if (!RANDOM_TYPES.has(node.type)) warn(`random node ${key} has unexpected type ${node.type}`);
    let n = rNodes.get(key);
    if (!n) { n = { key, type: node.type, type_by_src: {}, src: [], reason: {}, rag: {} }; rNodes.set(key, n); }
    if (n.type !== node.type) n.type = null;
    n.type_by_src[src] = node.type;
    n.src.push(src);
    if (node.reason) n.reason[src] = node.reason;
    if (node.rag) n.rag[src] = node.rag;
    if (node.gh) n.gh = node.gh;
    if (node.ext) n.ext = node.ext;
  };
  const rEdges = [];
  // stars: nodes carry id/label; edges are [fromIndex, toIndex, kind]
  const starsKeys = rStars.nodes.map((nd) => nd.id ?? nd.label);
  rStars.nodes.forEach((nd, i) => addNode(starsKeys[i], nd, 'stars'));
  for (const e of rStars.edges) {
    const [a, b, kind, p] = Array.isArray(e) ? e : [e.from, e.to, e.kind, e.p];
    const from = Array.isArray(e) ? starsKeys[a] : a, to = Array.isArray(e) ? starsKeys[b] : b;
    if (from === undefined || to === undefined) { warn(`stars random edge with bad index ${JSON.stringify(e)}`); continue; }
    if (!RANDOM_KINDS.has(kind)) warn(`stars random edge of unexpected kind ${kind}`);
    const edge = { from, to, kind, src: 'stars' };
    if (typeof p === 'number') edge.p = p;
    rEdges.push(edge);
  }
  // star-maker: nodes carry label; edges are {from,to,kind,p}
  for (const nd of rMaker.nodes) addNode(nd.label, nd, 'maker');
  for (const e of rMaker.edges) {
    if (!RANDOM_KINDS.has(e.kind)) warn(`star-maker random edge of unexpected kind ${e.kind}`);
    if (!rNodes.has(e.from) || !rNodes.has(e.to)) warn(`star-maker random edge references unknown node ${e.from} -> ${e.to}`);
    const edge = { from: e.from, to: e.to, kind: e.kind, src: 'maker' };
    if (typeof e.p === 'number') edge.p = e.p;
    rEdges.push(edge);
  }
  const randomTypeConflicts = [...rNodes.values()].filter((n) => n.type === null).length;
  const randomInBoth = [...rNodes.values()].filter((n) => n.src.length > 1).length;
  const randomOut = {
    note: 'Two independent random draws (different seeds). type is the star a key was drawn from, per source; type is null where the two draws disagree.',
    sources: [
      { src: 'stars', url: STARS + 'spider/graphs/random.json', schema: rStars.schema ?? null, label: rStars.label ?? null, seed: rStars.seed ?? null, generated_utc: rStars.generated_utc ?? null, note: rStars.note ?? null, focus_default: rStars.focus_default ?? null, nodes: rStars.nodes.length, edges: rStars.edges.length },
      { src: 'maker', url: SM + 'random/graph.json', schema: rMaker.schema ?? null, label: rMaker.label ?? null, seed: rMaker.seed ?? null, generated_utc: rMaker.generated_utc ?? null, note: rMaker.note ?? null, focus_default: rMaker.focus_default ?? null, nodes: rMaker.nodes.length, edges: rMaker.edges.length },
    ],
    nodes: [...rNodes.values()],
    edges: rEdges,
  };

  // ---- 6. entangled.json -----------------------------------------------------------------
  console.log('fetching star-maker SOUL.md and soul/graph.json (summary only) ...');
  const [soulMd, soulGraph] = await Promise.all([fetchText(SM + 'SOUL.md'), fetchJson(SM + 'soul/graph.json')]);
  const secStart = soulMd.indexOf('\n## Entanglements');
  if (secStart < 0) throw new Error('SOUL.md has no "## Entanglements" section');
  const secEndRel = soulMd.indexOf('\n## ', secStart + 1);
  const section = soulMd.slice(secStart, secEndRel < 0 ? undefined : secEndRel);
  const entanglements = [];
  const ENT_RE = /^- \*\*#(\d+) (.+?)\*\* defined in `([^`]+)`, called from (.+?)\s*$/;
  for (const line of section.split('\n')) {
    if (!line.startsWith('- ')) continue;
    const m = ENT_RE.exec(line);
    if (!m) { warn(`SOUL.md entanglement line not parsed: ${line.slice(0, 120)}`); continue; }
    entanglements.push({ n: +m[1], name: m[2], defined_in: m[3], called_from: m[4].split(',').map((s) => s.trim()).filter(Boolean) });
  }
  const mdTable = {};
  for (const m of soulMd.matchAll(/^\|\s*(.+?)\s*\|\s*\**([\d,]+)\**(?:\s*\([^)]*\))?\s*\|\s*$/gm)) {
    const label = m[1].replace(/\*\*/g, '').trim();
    if (/^question$/i.test(label)) continue;
    mdTable[label] = +m[2].replace(/,/g, '');
  }
  const headline = /^# Soul stars — ([\d,]+) souls in ([\d,]+) incarnations/m.exec(soulMd);
  const entanglementsStated = Object.entries(mdTable).find(([k]) => /^Entanglements/.test(k))?.[1] ?? null;
  const nodeTypeCounts = {}; for (const nd of soulGraph.nodes) nodeTypeCounts[nd.type] = (nodeTypeCounts[nd.type] || 0) + 1;
  const edgeKindCounts = {}; for (const e of soulGraph.edges) edgeKindCounts[e.kind] = (edgeKindCounts[e.kind] || 0) + 1;
  if (entanglementsStated !== null && entanglementsStated !== entanglements.length) {
    report.mismatches.push(`SOUL.md lists ${entanglements.length} entanglements but its table states ${entanglementsStated}`);
  }
  const entangledOut = {
    star_maker_commit: STAR_MAKER_COMMIT,
    soul_md: {
      souls: headline ? +headline[1].replace(/,/g, '') : null,
      incarnations: headline ? +headline[2].replace(/,/g, '') : null,
      table: mdTable,
      entanglements_stated: entanglementsStated,
      entanglements_listed: entanglements.length,
    },
    entanglements,
    soul_graph_summary: {
      generated_utc: soulGraph.generated_utc ?? null,
      note: soulGraph.note ?? null,
      nodes: soulGraph.nodes.length,
      distinct_node_labels: new Set(soulGraph.nodes.map((nd) => nd.label)).size,
      node_types: nodeTypeCounts,
      orphan_nodes: nodeTypeCounts.orphan ?? 0,
      duplicate_nodes: nodeTypeCounts.duplicate ?? 0,
      edges: soulGraph.edges.length,
      edge_kinds: edgeKindCounts,
      duplicates_edges: edgeKindCounts.DUPLICATES ?? 0,
    },
  };

  // ---- write outputs ---------------------------------------------------------------------
  const outputs = [
    ['lines.bin', linesBuf],
    ['families.json', Buffer.from(JSON.stringify(families))],
    ['blocks.json', Buffer.from(JSON.stringify(blocksOut))],
    ['electron.json', Buffer.from(JSON.stringify(electronOut))],
    ['random.json', Buffer.from(JSON.stringify(randomOut))],
    ['entangled.json', Buffer.from(JSON.stringify(entangledOut))],
  ];
  const outputProv = [];
  let shipped = 0;
  for (const [name, buf] of outputs) {
    await writeFile(path.join(OUT, name), buf);
    outputProv.push({ file: name, bytes: buf.length, sha256: sha256(buf) });
    shipped += buf.length;
  }
  if (shipped > SHIP_LIMIT_BYTES) report.mismatches.push(`shipped data ${shipped} bytes exceeds limit ${SHIP_LIMIT_BYTES} (3.5 MB; 3.5 MiB = 3670016) — lines.bin alone is ${linesBuf.length} bytes because it holds ${totalLines} per-family entries, not ${index.lines}`);

  const byLines = [...families].sort((a, b) => b.lineCount - a.lineCount || a.n - b.n).slice(0, 5)
    .map((f) => ({ n: f.n, name: f.name, lineCount: f.lineCount, block: f.block }));
  const conductors = atoms.filter((a) => a.class === 'conductor').map((a) => ({ n: a.n, name: a.name, valence: a.valence, spin: a.spin, homes: a.homes, valence_repos: a.valence_repos }));

  const checks = {
    index_generated_utc: index.generated_utc ?? null,
    index_families: index.families, families_built: families.length,
    index_lines: index.lines, lines_bin_entries: totalLines, distinct_line_numbers: lineSeen.size,
    min_line_number: minLine, max_line_number: maxLine,
    task_stated_lines_1955utc: EXPECTED_LINES_AT_1955_UTC,
    buckets_listed: index.buckets.length, buckets_fetched: bucketRecords.length,
    index_bucket_size: Number.isInteger(index.bucket_size) ? index.bucket_size : null, // family n lives in bucket floor(n / bucket_size)
    index_buckets: index.buckets.slice(),
    families_with_no_lines: familiesWithNoLines,
    families_anonymous: familiesAnonymous,
    families_with_no_block_symbol: familiesNoBlock,
    families_with_symbol_off_table: familiesOffTable,
    block_symbols_in_families_json: Object.keys(blockFamilies).length,
    blocks_on_table: blocksSrc.blocks.length,
    blocks_inside_vs_families_json_disagree: insideDisagree,
    symbols_off_table: symbolsNotOnTable.length,
    names_json_keys: Object.keys(names).length,
    names_first_name_not_in_names_json: nameMismatch,
    names_first_name_not_in_names_json_excluding_anonymous: nameMismatchNamed,
    electron_atoms_shipped: atoms.length, electron_atoms_graph_only: graphOnlyAtoms, electron_bonds: bonds.length, electron_repo_nodes: repoNodes.length,
    random_nodes: rNodes.size, random_nodes_in_both_draws: randomInBoth, random_nodes_type_differs_between_draws: randomTypeConflicts,
    random_edges: rEdges.length, random_edges_with_p: rEdges.filter((e) => typeof e.p === 'number').length,
    entanglements_listed: entanglements.length, entanglements_stated: entanglementsStated,
    shipped_bytes: shipped, ship_limit_bytes: SHIP_LIMIT_BYTES,
    top5_families_by_lines: byLines,
    conductor_atoms: conductors,
    mismatches: report.mismatches,
    warnings: report.warnings,
  };

  const provenance = {
    built_utc: new Date().toISOString(),
    builder: 'build_state.mjs',
    node: process.version,
    star_maker_commit: STAR_MAKER_COMMIT,
    stars_base: STARS,
    sources: provenanceSources,
    outputs: outputProv,
    checks,
  };
  const provBuf = Buffer.from(JSON.stringify(provenance, null, 1));
  await writeFile(path.join(OUT, 'provenance.json'), provBuf);

  // ---- console report --------------------------------------------------------------------
  console.log('\n=== OUTPUT FILES (bytes) ===');
  for (const o of outputProv) console.log(`  ${o.file.padEnd(16)} ${String(o.bytes).padStart(9)}  sha256 ${o.sha256}`);
  console.log(`  ${'provenance.json'.padEnd(16)} ${String(provBuf.length).padStart(9)}  (not counted toward the ship limit)`);
  console.log(`  shipped (1-6): ${shipped} bytes = ${(shipped / 1e6).toFixed(3)} MB = ${(shipped / 1048576).toFixed(3)} MiB  (limit ${SHIP_LIMIT_BYTES} bytes)`);
  console.log('\n=== CHECKS ===');
  console.log(JSON.stringify(checks, null, 1));
  if (report.mismatches.length) { console.error('\nMISMATCHES:\n  ' + report.mismatches.join('\n  ')); }
  else console.log('\nno mismatches against index.json');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error('\nBUILD FAILED: ' + (err && err.stack || err)); process.exit(1); });
}
