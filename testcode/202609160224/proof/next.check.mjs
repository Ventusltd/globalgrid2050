/* next.check.mjs — a handover spec must carry its own provenance.
 *
 * NEXT.md states a population: 10,985 families, n to 130,051, median 11 lines. Tonight
 * proved what happens to a figure without its source — three family counts were live at
 * once (10,985 / 10,805 / 13,240) and each looked authoritative, and the chair's own
 * liveness floor was computed from one population and described as if from another.
 *
 * charter.json lists state-the-denominator and state-the-generated-utc as UNENFORCED, with
 * the boundary named as "publishing an artifact — a schema gate refusing it without one".
 * This is that gate, for one document. It does not hold the rule everywhere; it holds it
 * here, which is one more place than it was held before.
 *
 * Run:  node proof/next.check.mjs
 *       node proof/next.check.mjs --mutate
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const ROOT = path.resolve(SURF, '..');
const MUTATE = process.argv.includes('--mutate');

let doc = fs.readFileSync(path.join(SURF, 'NEXT.md'), 'utf8');
if (MUTATE) {
  doc = doc.replace(/2026-09-14T22:44:05\.716Z/g, '').replace(/families\.json/g, '');
}

const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });

check('the spec names the artifact its figures came from',
  /families\.json/.test(doc),
  /families\.json/.test(doc) ? 'cites testcode/202609142202/data/families.json'
    : 'a population with no source — the failure this rule exists for');

check('the spec carries a generated_utc',
  /2026-09-14T22:44:05\.716Z/.test(doc),
  /2026-09-14T22:44:05\.716Z/.test(doc) ? 'built_utc 2026-09-14T22:44:05.716Z'
    : 'no build time — three family counts were live at once tonight');

check('the spec names the figure that disagrees',
  /13,240/.test(doc) && /2026-09-16T00:46:03Z/.test(doc),
  'the live star index says 13,240 at 2026-09-16T00:46:03Z — a different artifact, stated');

/* The numbers in the document must still be true of the pack it cites. A spec that drifts
   from its source is worse than no spec, because it reads as verified. */
let live = null;
try {
  const f = JSON.parse(fs.readFileSync(
    path.join(ROOT, '202609142202', 'data', 'families.json'), 'utf8'));
  const fams = Array.isArray(f) ? f : (f.families || Object.values(f)[0]);
  const ns = fams.map((x) => x && (x.n ?? x.family)).filter((n) => Number.isInteger(n));
  live = { count: fams.length, max: Math.max(...ns) };
} catch { /* pack absent: say so rather than pass */ }

check('the spec still agrees with the pack it cites',
  !!live && /10,985/.test(doc) && String(live.count) === '10985' && live.max === 130051,
  live ? 'pack holds ' + live.count.toLocaleString() + ' families, max n ' +
    live.max.toLocaleString() + ' — matches the document'
    : 'the pack could not be read; this check proves nothing about the document');

check('the spec says what it does not claim',
  /does not claim/i.test(doc) && /Nothing here has been drawn/i.test(doc),
  'states that none of it renders and no canvas was measured');

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.n + '\n        ' + r.d);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: the source and the build time are stripped; 1, 2 must fail)' : ''));
console.log('END OF REPORT - ' + results.length + ' checks');
process.exit(MUTATE ? 0 : failed ? 1 : 0);
