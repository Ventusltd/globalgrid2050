/* estate-vacuity.check.mjs — the 24 generated surfaces must be able to fail too.
 *
 * charter.check.mjs holds a vacuity gate over the suites in THIS surface's proof/ folder:
 * every one must fail strictly more under --mutate than honestly, because a mutation that
 * bites nothing is a proof of nothing. Five went vacuous tonight and a person caught each.
 *
 * THE GATE STOPPED AT THIS SURFACE'S EDGE. The 24 generated law surfaces each carry their
 * own proof/law.check.mjs, and nothing measured whether THEIR mutations bite. That matters
 * more than usual here: vikra-2e's first generator mutation used Math.random()*0 — a no-op
 * — and reported all 24 at 6/6, meaning none could be shown to fail. It fixed that itself
 * before handing them over, and the chair then verified it by hand.
 *
 * A HAND-VERIFICATION IS PROSE. It was true when it was run and nothing holds it. That is
 * the night's whole lesson — reporting discipline decays because it lives in prose,
 * structural discipline does not because it lives in the tool — so the hand-check becomes
 * a gate.
 *
 * It is a separate suite rather than an extension of charter.check.mjs because it spawns
 * 48 node processes and the charter gate should stay quick enough to run on every commit.
 *
 * Run:  node proof/estate-vacuity.check.mjs
 *       node proof/estate-vacuity.check.mjs --mutate
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const ROOT = path.resolve(SURF, '..');
const MUTATE = process.argv.includes('--mutate');

const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });

function run(dir, mutate) {
  try {
    return execFileSync(process.execPath,
      ['proof/law.check.mjs', ...(mutate ? ['--mutate'] : [])],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}

/* Count failures the way the suite reports them, not the way this file prefers —
   a leading FAIL, or an N/M tally. Same correction the charter gate needed. */
function fails(out) {
  const marked = (out.match(/^\s*FAIL/gm) || []).length;
  if (marked) return marked;
  const m = /(\d+)\/(\d+) passed/.exec(out);
  return m ? Number(m[2]) - Number(m[1]) : 0;
}

const surfaces = fs.readdirSync(ROOT)
  .filter((d) => /^\d{10,14}$/.test(d) && fs.existsSync(path.join(ROOT, d, 'proof', 'law.check.mjs')));

check('the generated surfaces were found', surfaces.length >= 20,
  surfaces.length + ' surfaces carry their own proof/law.check.mjs');

const vacuous = [], broken = [], measured = [];
for (const d of surfaces) {
  const dir = path.join(ROOT, d);
  const honest = fails(run(dir, false));
  const mutated = fails(run(dir, true));
  measured.push(d + ' ' + honest + '->' + mutated);
  if (honest > 0) broken.push(d + ' fails ' + honest + ' honestly');
  if (mutated <= honest) vacuous.push(d + ' (' + honest + ' -> ' + mutated + ')');
}

/* --mutate here means: pretend one surface's mutation bites nothing, and require this
   gate to notice. Without it, a gate that reported "0 vacuous" could be reporting that
   because it never looked. */
const injected = MUTATE ? ['injected-surface (2 -> 2)'] : [];
const all = vacuous.concat(injected);

check('every generated surface can be shown to fail', all.length === 0,
  all.length
    ? all.length + ' prove nothing — mutation bites no harder than the honest run: ' +
      all.slice(0, 4).join(' · ')
    : surfaces.length + ' surfaces, each failing more under mutation · ' +
      measured.slice(0, 3).join(' · ') + ' · …');

check('every generated surface passes honestly', broken.length === 0,
  broken.length ? broken.slice(0, 4).join(' · ')
    : surfaces.length + ' surfaces, 0 failures on the honest run');

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.n + '\n        ' + r.d);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: a surface whose mutation bites nothing is injected and must be caught)' : ''));
console.log('NOT CHECKED HERE: that any surface DRAWS what its law computes. That needs a browser.');
console.log('END OF REPORT - ' + results.length + ' checks');
process.exit(MUTATE ? 0 : failed ? 1 : 0);
