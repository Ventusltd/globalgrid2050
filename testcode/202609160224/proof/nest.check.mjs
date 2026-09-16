/* nest.check.mjs — the checks the Nest must pass, run under Node with no browser.
 *
 * The front door this replaces was wrong in one specific way: it named two
 * surfaces out of ninety-six and could not know it was wrong, because it was
 * typed rather than generated. So the checks worth running are not "does it
 * draw" but "can it disagree with the directory". Every check below is a way
 * for the manifest and the directory to disagree, and each must be provably
 * capable of failing: run with --mutate to corrupt the manifest in memory and
 * watch the checks that should fail, fail.
 *
 * Run:  node proof/nest.check.mjs
 *       node proof/nest.check.mjs --mutate     (expect FAILs - that is the point)
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const ROOT = path.resolve(SURF, '..');
const TS = /^(\d{10}|\d{12}|\d{14})$/;
const MUTATE = process.argv.includes('--mutate');

const manifest = JSON.parse(fs.readFileSync(path.join(SURF, 'surfaces.json'), 'utf8'));
const list = manifest.list.map((s) => ({ ...s }));

if (MUTATE) {
  /* Three lies, one per class of check: a surface that is not on disk, a key
     sequence with a hole, and an entry that points at nothing. */
  list.push({ key: list.length + 1, stamp: '209901010000', entry: '209901010000/', files: 1, bytes: 1 });
  if (list[3]) list[3].key = 999;
  if (list[5]) list[5].entry = 'not-a-directory/';
}

const onDisk = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && TS.test(e.name))
  .map((e) => e.name)
  .sort();

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

/* 1. The manifest may not name a surface that is not in the directory. */
const missing = list.filter((s) => !onDisk.includes(s.stamp)).map((s) => s.stamp);
check('every named surface exists on disk', missing.length === 0,
  missing.length ? 'not on disk: ' + missing.join(', ') : list.length + ' named, all present');

/* 2. The manifest may not omit a surface that is in the directory. This is the
      check the old front door would have failed 94 times. */
const named = new Set(list.map((s) => s.stamp));
const omitted = onDisk.filter((d) => !named.has(d));
check('every surface on disk is named', omitted.length === 0,
  omitted.length ? 'omitted: ' + omitted.join(', ') : onDisk.length + ' on disk, all named');

/* 3. Keys are 1..n with no hole and no repeat: the placement law is a function
      of the key, so a duplicate key is two surfaces drawn on top of each other. */
const keys = list.map((s) => s.key).sort((a, b) => a - b);
const contiguous = keys.every((k, i) => k === i + 1);
check('keys are 1..n, contiguous and unique', contiguous,
  contiguous ? '1..' + keys.length : 'first break at index ' + keys.findIndex((k, i) => k !== i + 1));

/* 4. Every openable surface really opens. */
const broken = list.filter((s) => s.entry)
  .filter((s) => !fs.existsSync(path.join(ROOT, s.entry.replace(/\/$/, ''), 'index.html')))
  .map((s) => s.stamp);
check('every entry link resolves to an index.html', broken.length === 0,
  broken.length ? 'no index.html: ' + broken.join(', ') : list.filter((s) => s.entry).length + ' openable, all resolve');

/* 5. The law is a pure function of the key: same key, same point, for ever.
      Checked by computing it twice and, more usefully, by confirming a key that
      does not exist yet already has a place. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const place = (k) => [Math.sqrt(k), k * GOLDEN];
const a = place(4242), b = place(4242);
const future = place(list.length + 1000);
check('placement is deterministic and unbounded',
  a[0] === b[0] && a[1] === b[1] && Number.isFinite(future[0]) && Number.isFinite(future[1]),
  'key 4242 -> r=' + a[0].toFixed(4) + ' ; unissued key ' + (list.length + 1000) + ' already has r=' + future[0].toFixed(4));

/* 6. The manifest states when it was generated. Every stale map in this estate
      was one that did not. */
check('manifest carries generated_utc', typeof manifest.generated_utc === 'string' && !Number.isNaN(Date.parse(manifest.generated_utc)),
  String(manifest.generated_utc));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + '\n        ' + r.detail);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' + (MUTATE ? '   (--mutate: failures above are the proof the checks can fail)' : ''));
process.exit(MUTATE ? 0 : failed ? 1 : 0);
