// amend_pack.mjs — repair round 1: add to the pack three facts the page used to carry as code literals.
// Fetches ONLY code/index.json, electron/graph.json and ELECTRON.md (the same public URLs build_state.mjs used),
// verifies their sha256 against data/provenance.json → sources (so the sources are provably the bytes the pack was built from),
// then adds: electron.json.focus_default, electron.json.conduction_band_electron_md, provenance.checks.index_bucket_size,
// provenance.checks.index_buckets. Nothing else in data/ is touched. Run:  node amend_pack.mjs
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConductionBand } from './build_state.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'data');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const prov = JSON.parse(await readFile(path.join(DATA, 'provenance.json'), 'utf8'));
const electronBuf = await readFile(path.join(DATA, 'electron.json'));
const electron = JSON.parse(electronBuf.toString('utf8'));
const recorded = prov.outputs.find((o) => o.file === 'electron.json');
if (sha256(electronBuf) !== recorded.sha256) throw new Error(`data/electron.json on disk (${sha256(electronBuf)}) is not the pack's output (${recorded.sha256}); refusing to amend`);

async function fetchVerified(urlEnd) {
  const src = prov.sources.find((s) => s.url.endsWith(urlEnd));
  if (!src) throw new Error(`provenance.json has no source ending ${urlEnd}`);
  const res = await fetch(src.url, { headers: { 'user-agent': 'quantum-twin-star-amend/1 (node)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${src.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const h = sha256(buf);
  const same = h === src.sha256 && buf.length === src.bytes;
  console.log(`${src.url}\n  ${buf.length} bytes sha256 ${h} — ${same ? 'matches the pack build' : 'DIFFERS from the pack build (' + src.sha256 + ')'}`);
  if (!same) throw new Error(`live bytes of ${src.url} differ from the pack's fetch at ${src.fetched_utc}; re-run build_state.mjs instead of amending`);
  return { buf, src };
}

const [idx, graph, md] = await Promise.all([
  fetchVerified('/code/index.json'),
  fetchVerified('/electron/graph.json'),
  fetchVerified('/ELECTRON.md'),
]);
const index = JSON.parse(idx.buf.toString('utf8'));
const eGraph = JSON.parse(graph.buf.toString('utf8'));
const band = parseConductionBand(md.buf.toString('utf8'));

electron.focus_default = typeof eGraph.focus_default === 'string' ? eGraph.focus_default : null;
electron.conduction_band_electron_md = band;
prov.checks.index_bucket_size = Number.isInteger(index.bucket_size) ? index.bucket_size : null;
prov.checks.index_buckets = Array.isArray(index.buckets) ? index.buckets.slice() : null;

const electronOut = Buffer.from(JSON.stringify(electron));
recorded.bytes = electronOut.length; recorded.sha256 = sha256(electronOut);
const shippedBefore = prov.checks.shipped_bytes;
prov.checks.shipped_bytes = prov.outputs.reduce((s, o) => s + o.bytes, 0);
prov.amendments = (prov.amendments || []).concat([{
  utc: new Date().toISOString(), script: 'amend_pack.mjs',
  added: ['electron.json.focus_default', 'electron.json.conduction_band_electron_md', 'checks.index_bucket_size', 'checks.index_buckets'],
  sources_reverified: [idx.src.url, graph.src.url, md.src.url],
  electron_json_bytes_before: electronBuf.length, electron_json_bytes_after: electronOut.length,
  shipped_bytes_before: shippedBefore, shipped_bytes_after: prov.checks.shipped_bytes,
}]);
await writeFile(path.join(DATA, 'electron.json'), electronOut);
await writeFile(path.join(DATA, 'provenance.json'), Buffer.from(JSON.stringify(prov, null, 1)));
console.log(`electron.json: focus_default=${JSON.stringify(electron.focus_default)} conduction_band=${JSON.stringify(band)}`);
console.log(`provenance.checks: index_bucket_size=${prov.checks.index_bucket_size} index_buckets=${prov.checks.index_buckets.length} entries`);
console.log(`electron.json ${electronBuf.length} → ${electronOut.length} bytes, sha256 ${recorded.sha256}; shipped ${shippedBefore} → ${prov.checks.shipped_bytes} bytes`);
