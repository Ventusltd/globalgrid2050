// key_permanence.mjs — the permanent-key rule, checked between the previous numbered pack (testcode/202609142202/data) and this one (./data).
// A line's number is its permanent key: it never changes and is never reused. So (1) every key in the old all-lines.bin must be in the new
// all-lines.bin, and (2) every key present in both must carry the same code length in all-lines.len.bin (a reused key would almost surely
// carry a different line). Also prints old vs new counts (lines, max key, families) and writes proof/key_permanence.json.
// Formats: all-lines.bin Uint32 LE ascending; all-lines.len.bin Uint16 LE, same order. Run from anywhere:  node proof/key_permanence.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD = path.resolve(HERE, '..', '202609142202', 'data');
const NEW = path.join(HERE, 'data');
const u32 = (b) => new Uint32Array(b.buffer, b.byteOffset, b.length / 4);
const u16 = (b) => new Uint16Array(b.buffer, b.byteOffset, b.length / 2);
const load = (dir) => {
  const keys = u32(Buffer.from(fs.readFileSync(path.join(dir, 'all-lines.bin'))));
  const lens = u16(Buffer.from(fs.readFileSync(path.join(dir, 'all-lines.len.bin'))));
  const fam = fs.readFileSync(path.join(dir, 'all-lines.family.bin'));
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'all-lines.meta.json'), 'utf8'));
  const families = JSON.parse(fs.readFileSync(path.join(dir, 'families.json'), 'utf8'));
  const prov = JSON.parse(fs.readFileSync(path.join(dir, 'provenance.json'), 'utf8'));
  if (keys.length !== lens.length || keys.length !== fam.length) throw new Error(`${dir}: file lengths disagree`);
  for (let i = 1; i < keys.length; i++) if (keys[i] <= keys[i - 1]) throw new Error(`${dir}: all-lines.bin not strictly ascending at ${i}`);
  let inFam = 0; for (const v of fam) inFam += v;
  return { keys, lens, inFam, meta, families, prov };
};
const O = load(OLD), N = load(NEW);

// merge walk over two ascending arrays
let i = 0, j = 0, missing = 0, lenChanged = 0, added = 0, addedBelowOldMax = 0;
const missingEx = [], lenEx = [], addedBelowEx = [];
const oldMax = O.keys[O.keys.length - 1];
while (i < O.keys.length || j < N.keys.length) {
  const a = i < O.keys.length ? O.keys[i] : Infinity, b = j < N.keys.length ? N.keys[j] : Infinity;
  if (a === b) { if (O.lens[i] !== N.lens[j]) { lenChanged++; if (lenEx.length < 20) lenEx.push({ key: a, old_len: O.lens[i], new_len: N.lens[j] }); } i++; j++; }
  else if (a < b) { missing++; if (missingEx.length < 20) missingEx.push(a); i++; }
  else { added++; if (b <= oldMax) { addedBelowOldMax++; if (addedBelowEx.length < 20) addedBelowEx.push(b); } j++; }
}
const shared = O.keys.length - missing;
const R = {
  old_pack: 'testcode/202609142202/data', new_pack: path.basename(HERE) ? `testcode/${path.basename(HERE)}/data` : null,
  old: { lines: O.keys.length, max_key: oldMax, families: O.families.length, family_line_entries: O.prov.checks.lines_bin_entries, in_a_family: O.inFam, lines_md_generated_utc: O.prov.checks.lines_md_generated_utc, index_generated_utc: O.prov.checks.index_generated_utc },
  new: { lines: N.keys.length, max_key: N.keys[N.keys.length - 1], families: N.families.length, family_line_entries: N.prov.checks.lines_bin_entries, in_a_family: N.inFam, lines_md_generated_utc: N.prov.checks.lines_md_generated_utc, index_generated_utc: N.prov.checks.index_generated_utc },
  old_keys_missing_from_new: missing, missing_examples: missingEx,
  keys_in_both: shared, keys_in_both_with_different_length: lenChanged, length_change_examples: lenEx,
  keys_new_only: added, keys_new_only_at_or_below_old_max: addedBelowOldMax, new_only_below_old_max_examples: addedBelowEx,
  note: 'A new key at or below the old max is not a violation by itself (a number issued after the old export can be lower only if numbering is not monotone); it is reported, not failed.',
};
R.pass = missing === 0 && lenChanged === 0;
fs.writeFileSync(path.join(HERE, 'proof', 'key_permanence.json'), JSON.stringify(R, null, 1) + '\n');
console.log(JSON.stringify(R, null, 1));
console.log(R.pass ? 'PASS: every old key is present and every shared key has the same line length' : 'FAIL: permanent-key rule broken');
process.exit(R.pass ? 0 : 1);
