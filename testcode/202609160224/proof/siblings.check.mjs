/* siblings.check.mjs — two surfaces that claim to differ and do not.
 *
 * vikra-ac, 04:18Z: every check in this estate examines ONE artifact, and the defects
 * lived BETWEEN artifacts. Two of the published 24 rendered an identical picture — 22
 * distinct canvases across 24 addresses — and all four surfaces passed 12/12 throughout,
 * correctly, because each proof examined its own surface and the defect lived in the gap.
 *
 * `POINT` was declared in every generated surface and read by nothing, so the -fine
 * variants drew the -plain picture. The constants differed; the behaviour did not.
 *
 * THIS IS THE ENFORCER FORM OF THE COMPARE VERB. vikra-ac proposed comparison as a noun
 * a person can reach for — A and B, A minus B, B minus A, each a set with a derived id.
 * The chair's addition was that a verb a person must CHOOSE to use catches nothing: the
 * between-artifact defects survived because nobody compared, and a button still waits for
 * someone to press it. So the same question runs here without being asked.
 *
 * THE TEST. For each pair of surfaces drawing the same law, find the module-level
 * constants whose values differ. If every one of those differing constants is DECLARED
 * AND NEVER READ, the two surfaces are behaviourally identical and one of them is an
 * address with nothing of its own at it.
 *
 * WHAT IT DOES NOT CLAIM, and the limit matters as much as the check. This reads source,
 * not pixels. It proves two surfaces compute the same thing; it cannot prove two surfaces
 * DRAW the same thing, because a difference could live somewhere this parser does not
 * look. Only a browser comparing two canvases settles that, and vikra-ac holds that.
 * Comparison here is extensional about the code, exactly as set comparison is extensional
 * about the lines: "are these the same instructions", never "do these mean the same".
 *
 * Run:  node proof/siblings.check.mjs
 *       node proof/siblings.check.mjs --mutate
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const ROOT = path.resolve(SURF, '..');
const MUTATE = process.argv.includes('--mutate');

const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });

/* Module-level constants, including several declared on one line:
     const R = 585.5, B = 26, LAT = 597;
   A name is READ if it appears anywhere beyond its own declaration. */
function constantsOf(src) {
  const out = new Map();
  for (const line of src.split('\n')) {
    const m = /^const\s+(.+?);\s*$/.exec(line.trim());
    if (!m) continue;
    for (const part of m[1].split(/,(?![^(]*\))/)) {
      const d = /^\s*([A-Za-z_$][\w$]*)\s*=\s*(.+?)\s*$/.exec(part);
      if (!d) continue;
      out.set(d[1], d[2]);
    }
  }
  /* COUNT READS IN CODE, NOT IN PROSE. The first version counted every appearance of a
     name anywhere in the file, and would NOT have caught the defect it was written for:
     in the wafer law, `B` appears once in its declaration and four times in COMMENTS —
     including the comment describing this very bug — so a word count called it read while
     place() ignores it entirely. A check that counts its own documentation as usage is
     measuring the wrong text. Comments and string literals are stripped first. */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const reads = new Map();
  for (const name of out.keys()) {
    const hits = (code.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length;
    reads.set(name, hits > 1);           /* >1 means used beyond its own declaration */
  }
  return { values: out, read: reads };
}

const surfaces = [];
for (const d of fs.readdirSync(ROOT)) {
  const f = path.join(ROOT, d, 'wafer.mjs');
  if (!/^\d{10,14}$/.test(d) || !fs.existsSync(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  const law = (/the ([a-z][a-z0-9-]*) law, generated/i.exec(src) || [, null])[1];
  const variant = (/Variation ([a-z0-9-]+)/i.exec(src) || [, null])[1];
  if (!law) continue;
  surfaces.push({ stamp: d, law, variant, ...constantsOf(src) });
}

if (MUTATE && surfaces.length >= 2) {
  /* The lie: give a surface a sibling it differs from only in a constant nothing
     reads — exactly the POINT defect, which passed every per-surface proof. */
  const a = surfaces[0];
  const clone = { ...a, stamp: a.stamp + '-mutant', variant: a.variant + '-mutant',
    values: new Map(a.values), read: new Map(a.read) };
  clone.values.set('DEAD_CONST', '99');
  clone.read.set('DEAD_CONST', false);
  surfaces.push(clone);
}

check('surfaces were found and carry a law', surfaces.length >= 8,
  surfaces.length + ' surfaces with a declared law, across ' +
  new Set(surfaces.map((s) => s.law)).size + ' laws');

/* Every pair inside a law. */
const identical = [];
const byLaw = new Map();
for (const s of surfaces) {
  if (!byLaw.has(s.law)) byLaw.set(s.law, []);
  byLaw.get(s.law).push(s);
}
let pairs = 0;
for (const [law, group] of byLaw) {
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j];
      pairs++;
      const names = new Set([...a.values.keys(), ...b.values.keys()]);
      const differing = [...names].filter((n) => a.values.get(n) !== b.values.get(n));
      if (!differing.length) {
        identical.push(a.stamp + ' / ' + b.stamp + ' (' + law + ') — byte-identical constants');
        continue;
      }
      const meaningful = differing.filter((n) => a.read.get(n) || b.read.get(n));
      if (!meaningful.length) {
        identical.push(a.stamp + ' / ' + b.stamp + ' (' + law + ') — differ only in ' +
          differing.join(', ') + ', which nothing reads');
      }
    }
  }
}

check('no two surfaces differ only in constants nothing reads',
  identical.length === 0,
  identical.length
    ? identical.length + ' pair(s) are the same variation wearing two addresses: ' +
      identical.slice(0, 4).join(' · ')
    : pairs + ' sibling pairs compared across ' + byLaw.size +
      ' laws, every pair differing in at least one constant that is read');

/* Stated, not failed: an unread constant is untidy, and only a DIFFERENCE in one is a
   defect. TAU is declared and unread in every generated surface and identical in all of
   them, so it creates no false distinction — saying so is more useful than failing it. */
const unread = new Map();
for (const s of surfaces) {
  for (const [n, r] of s.read) if (!r) unread.set(n, (unread.get(n) || 0) + 1);
}
check('unread constants are reported, not failed', true,
  unread.size
    ? [...unread].map(([n, c]) => n + ' in ' + c + ' surface(s)').join(' · ') +
      ' — harmless while identical everywhere; a defect only where siblings differ in one'
    : 'every declared constant is read somewhere');

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.n + '\n        ' + r.d);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: a sibling differing only in an unread constant must be caught)' : ''));
console.log('END OF REPORT - ' + results.length + ' checks');
process.exit(MUTATE ? 0 : failed ? 1 : 0);
