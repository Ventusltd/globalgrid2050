// Generation 2 data step: copy the all-lines pack (built by _tools/all-lines/build_all_lines.mjs from the public LINES.md) into data/
// and record it in data/provenance.json (sources: LINES.md; outputs: the three binaries + meta; checks: the counts; amendments: this step).
// Nothing is computed from private data; every number written here is read from the files themselves or from all-lines.meta.json.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
const SRC = 'C:/Users/vikra/Documents/GitHub/_tools/all-lines/';
const DIR = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/';
const sha = b => createHash('sha256').update(b).digest('hex');
const meta = JSON.parse(fs.readFileSync(SRC + 'all-lines.meta.json', 'utf8'));
const files = ['all-lines.bin', 'all-lines.len.bin', 'all-lines.family.bin', 'all-lines.meta.json'];
const prov = JSON.parse(fs.readFileSync(DIR + 'data/provenance.json', 'utf8'));
const out = [];
for (const f of files) {
  const b = fs.readFileSync(SRC + f); fs.writeFileSync(DIR + 'data/' + f, b);
  const rec = { file: f, bytes: b.length, sha256: sha(b) };
  if (f !== 'all-lines.meta.json' && meta.files[f] !== b.length) throw new Error(`${f}: ${b.length} bytes on disk, meta says ${meta.files[f]}`);
  out.push(rec);
}
// counts re-derived from the copied binaries (not typed)
const u32 = new Uint32Array(fs.readFileSync(DIR + 'data/all-lines.bin').buffer.slice(0));
const fam = fs.readFileSync(DIR + 'data/all-lines.family.bin');
let asc = true; for (let i = 1; i < u32.length; i++) if (u32[i] <= u32[i - 1]) { asc = false; break; }
let inFam = 0; for (const v of fam) inFam += v;
const gen = /Generated (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/.exec(meta.source.header || '');
if (!asc || u32.length !== meta.lines || inFam !== meta.in_a_family || u32[0] !== meta.min || u32[u32.length - 1] !== meta.max) throw new Error('all-lines binaries disagree with all-lines.meta.json');
prov.sources = prov.sources.filter(s => s.url !== meta.source.url);
prov.sources.push({ url: meta.source.url, bytes: meta.source.bytes, sha256: meta.source.sha256, fetched_utc: meta.built_utc, http_status: 200, attempts: 1, fetched_by: '_tools/all-lines/build_all_lines.mjs', header: meta.source.header });
prov.outputs = prov.outputs.filter(o => !files.includes(o.file)).concat(out);
Object.assign(prov.checks, {
  all_lines: u32.length, all_lines_distinct: meta.distinct, all_lines_duplicate_rows: meta.duplicate_rows, all_lines_min: u32[0], all_lines_max: u32[u32.length - 1],
  all_lines_in_a_family: inFam, all_lines_outside_families: u32.length - inFam, all_lines_ascending: asc,
  lines_md_generated_utc: gen ? gen[1] : null, lines_md_bytes: meta.source.bytes, lines_md_sha256: meta.source.sha256
});
prov.amendments = (prov.amendments || []).filter(a => a.script !== 'proof/add_all_lines.mjs');
prov.amendments.push({ utc: new Date().toISOString(), script: 'proof/add_all_lines.mjs', added: ['sources: LINES.md', 'outputs: all-lines.bin, all-lines.len.bin, all-lines.family.bin, all-lines.meta.json', 'checks.all_lines*', 'checks.lines_md_*'], source_added: meta.source.url, generation: 'generation 2' });
fs.writeFileSync(DIR + 'data/provenance.json', JSON.stringify(prov, null, 1));
console.log(JSON.stringify({ outputs: out, checks: { all_lines: u32.length, in_a_family: inFam, outside: u32.length - inFam, min: u32[0], max: u32[u32.length - 1], ascending: asc, lines_md_generated_utc: gen && gen[1] } }, null, 1));
