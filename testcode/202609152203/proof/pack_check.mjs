// pack_check.mjs — the self-contained (no browser) parts of testcode/202609142202's proofs, adapted to this stamp's data/.
// From proof/gen2.mjs "ground truth from disk": lines.bin entries, all-lines count, in/outside a family, the HUD count line rebuilt from disk.
// From the page's "prove it" button: sha256 of every data file equals data/provenance.json → outputs.
// From proof/add_all_lines.mjs: all-lines binaries agree with all-lines.meta.json (ascending, min, max, in_a_family).
// From README generation 2: distinct numbers in the buckets (lines.bin) == in-family unique lines; index.json lines == LINES.md count;
// every lines.bin number is a key of all-lines.bin. Also families.json offsets tile lines.bin exactly. Writes proof/pack_check.json.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (f) => path.join(DIR, 'data', f);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const R = { checks: {} };
const ok = (name, cond, detail) => { R.checks[name] = { pass: !!cond, ...(detail !== undefined ? { detail } : {}) }; };

const prov = JSON.parse(fs.readFileSync(D('provenance.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(D('all-lines.meta.json'), 'utf8'));
const families = JSON.parse(fs.readFileSync(D('families.json'), 'utf8'));
const linesBuf = fs.readFileSync(D('lines.bin')), uniqBuf = fs.readFileSync(D('all-lines.bin')), famBuf = fs.readFileSync(D('all-lines.family.bin'));
const lines = new Uint32Array(linesBuf.buffer, linesBuf.byteOffset, linesBuf.length / 4);
const uniq = new Uint32Array(uniqBuf.buffer, uniqBuf.byteOffset, uniqBuf.length / 4);
let inFam = 0; for (const v of famBuf) inFam += v;

// prove it: provenance outputs vs disk
const provMismatch = prov.outputs.filter((o) => { const b = fs.readFileSync(D(o.file)); return b.length !== o.bytes || sha(b) !== o.sha256; }).map((o) => o.file);
ok('provenance_outputs_match_disk', provMismatch.length === 0 && prov.outputs.length === 10, { outputs: prov.outputs.length, mismatched: provMismatch });

// add_all_lines consistency
let asc = true; for (let i = 1; i < uniq.length; i++) if (uniq[i] <= uniq[i - 1]) { asc = false; break; }
ok('all_lines_agree_with_meta', asc && uniq.length === meta.lines && inFam === meta.in_a_family && uniq[0] === meta.min && uniq[uniq.length - 1] === meta.max,
  { lines: uniq.length, ascending: asc, min: uniq[0], max: uniq[uniq.length - 1], in_a_family: inFam });

// gen2 README claims
const distinct = new Set(lines);
ok('bucket_distinct_equals_in_family_unique', distinct.size === inFam, { bucket_distinct: distinct.size, in_a_family: inFam });
ok('index_lines_equals_lines_md', prov.checks.index_lines === uniq.length, { index_lines: prov.checks.index_lines, lines_md: uniq.length });
const uniqSet = new Set(uniq); let notKey = 0; for (const x of distinct) if (!uniqSet.has(x)) notKey++;
ok('every_family_line_is_a_lines_md_key', notKey === 0, { not_a_key: notKey });
let flagWrong = 0; for (let i = 0; i < uniq.length; i++) if ((famBuf[i] === 1) !== distinct.has(uniq[i])) flagWrong++;
ok('family_flag_matches_lines_bin', flagWrong === 0, { wrong: flagWrong });

// families.json tiles lines.bin
let off = 0, tile = true; for (const f of families) { if (f.lineOffset !== off) { tile = false; break; } off += f.lineCount; }
ok('families_tile_lines_bin', tile && off === lines.length && families.length === prov.checks.index_families, { families: families.length, entries: lines.length });

// gen2 HUD count line, rebuilt from disk (as proof/gen2.mjs computes it)
const stamp = prov.checks.lines_md_generated_utc; const stampText = `${stamp.slice(0, 10)} ${stamp.slice(11, 16)} UTC`;
R.expected_count_line = `on GPU: ${uniq.length.toLocaleString('en-GB')} unique numbered lines (LINES.md ${stampText}) + ${(lines.length).toLocaleString('en-GB')} family-line entries · ${inFam.toLocaleString('en-GB')} unique lines sit inside a function family, ${(uniq.length - inFam).toLocaleString('en-GB')} do not`;

// family numbers of the previous pack (reported, not failed: family records are regrouped by the modular star)
const prevF = path.resolve(DIR, '..', '202609142202', 'data', 'families.json');
if (fs.existsSync(prevF)) { const nowN = new Set(families.map((f) => f.n)); const old = JSON.parse(fs.readFileSync(prevF, 'utf8')); R.previous_family_numbers = { old: old.length, still_present: old.filter((f) => nowN.has(f.n)).length }; }

R.pass = Object.values(R.checks).every((c) => c.pass);
fs.writeFileSync(path.join(DIR, 'proof', 'pack_check.json'), JSON.stringify(R, null, 1) + '\n');
console.log(JSON.stringify(R, null, 1));
process.exit(R.pass ? 0 : 1);
