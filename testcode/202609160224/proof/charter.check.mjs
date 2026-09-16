/* charter.check.mjs — which of tonight's rules are enforced, and which are only sentences.
 *
 * vikra-ac, 03:49Z, after diagnosing a self-counting query, explaining it, and then
 * running the identical broken command ninety minutes later:
 *
 *   "Reporting discipline decays because it lives in prose; structural discipline
 *    does not because it lives in the tool."
 *
 * That indicts the stones. Every rule written tonight that exists only as a sentence
 * will decay the same way. The ones that became checks will not. So this file does two
 * things, and the second is the one that earns its keep.
 *
 * ONE — THE AUDIT. charter.json lists each rule with the check that enforces it, or
 * null. This verifies that every rule CLAIMING an enforcer names a check which actually
 * exists, and prints how many are prose-only. It cannot verify that a check enforces the
 * rule it is attached to — only a person can — and it says so rather than implying more.
 *
 * TWO — THE VACUITY GATE. A suite whose --mutate run fails nothing proves nothing. That
 * happened FOUR times tonight: the chair's own nest harness could not fail the one check
 * the Nest existed to protect; vikra-2e's generator mutation used Math.random()*0 and
 * reported 24 surfaces at 6/6 when none could be shown to fail; journeys.check went
 * vacuous the moment `companies` was cleaned upstream; and nest check 4b passed under
 * mutation on the day it was written. Every one was caught by a person noticing. This
 * runs each suite both ways and requires the mutated run to fail strictly more.
 *
 * Run:  node proof/charter.check.mjs
 *       node proof/charter.check.mjs --mutate
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const MUTATE = process.argv.includes('--mutate');

const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });

const charter = JSON.parse(fs.readFileSync(path.join(SURF, 'charter.json'), 'utf8'));

/* Every check name that actually exists, read from the proofs rather than listed. */
const existing = new Map();
for (const f of fs.readdirSync(HERE)) {
  if (!f.endsWith('.check.mjs')) continue;
  const src = fs.readFileSync(path.join(HERE, f), 'utf8');
  const names = [...src.matchAll(/check\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
  existing.set(f, new Set(names));
}

/* 1. A rule claiming an enforcer must name one that exists. A charter that cites a
      check nobody wrote is worse than a charter that admits the rule is unenforced. */
const claimed = charter.rules.filter((r) => r.enforced_by);
const missing = claimed.filter((r) => {
  const [file, name] = r.enforced_by.split('#');
  const set = existing.get(file);
  return !set || !set.has(name);
});
check('every claimed enforcer exists', missing.length === 0,
  missing.length
    ? 'cited but absent: ' + missing.map((r) => r.id + ' -> ' + r.enforced_by).join(' · ')
    : claimed.length + ' rules cite a check, all present across ' + existing.size + ' suites');

/* 2. The count that matters, stated rather than hidden. This is not a failure — a rule
      can be true and unenforceable — but it must be visible, because an unenforced rule
      is a rule that will be broken again by whoever did not read the stone. */
const prose = charter.rules.filter((r) => !r.enforced_by);
check('the prose-only count is stated', true,
  prose.length + ' of ' + charter.rules.length + ' rules are prose only: ' +
  prose.map((r) => r.id).join(', '));

/* 3. THE VACUITY GATE. Every suite must fail strictly more under --mutate than honestly.
      A mutation that bites nothing is a proof of nothing, and four went vacuous tonight
      without a machine noticing once. */
function runSuite(file, mutate) {
  try {
    const out = execFileSync(process.execPath,
      [path.join(HERE, file), ...(mutate ? ['--mutate'] : [])],
      { cwd: SURF, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out;
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}
/* Suites report failures in two shapes tonight: a leading FAIL, or an N/M passed tally.
   Count both, so a suite is measured by what it actually prints rather than by the
   convention this file prefers. */
function countFails(out) {
  const marked = (out.match(/^\s*FAIL/gm) || []).length;
  if (marked) return marked;
  const m = /(\d+)\/(\d+) passed/.exec(out);
  return m ? Number(m[2]) - Number(m[1]) : 0;
}

/* EVERY suite, not the ones whose helper this file happens to recognise. The first
   version selected by `existing.get(f).size > 0` — suites whose checks were named via a
   `check('...')` call — and silently skipped card.check.mjs and law.check.mjs, which use
   a differently-named helper. A gate that quietly covers two thirds of what it claims is
   the defect this whole file exists to catch, in the file that catches it. */
const suites = [...existing.keys()].filter((f) => f !== 'charter.check.mjs');
const vacuous = [], measured = [];
for (const f of suites) {
  const honest = countFails(runSuite(f, false));
  const mutated = countFails(runSuite(f, true));
  measured.push(f.replace('.check.mjs', '') + ' ' + honest + '->' + mutated);
  if (mutated <= honest) vacuous.push(f + ' (' + honest + ' -> ' + mutated + ')');
}
check('no mutation harness is vacuous', MUTATE ? false : vacuous.length === 0,
  vacuous.length
    ? 'these prove nothing — mutation bites no harder than the honest run: ' + vacuous.join(' · ')
    : suites.length + ' suites, each fails more under mutation: ' + measured.join(' · '));

/* 4. A rule must say who it binds. "Be careful" binds nobody; "stage what you read"
      binds whoever stages. Recorded because a rule without a subject cannot be broken
      by anyone in particular, which is how it survives unenforced. */
const subjectless = charter.rules.filter((r) => !r.binds);
check('every rule names who it binds', subjectless.length === 0,
  subjectless.length ? 'no subject: ' + subjectless.map((r) => r.id).join(', ')
    : charter.rules.length + ' rules, each naming its subject');

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.n + '\n        ' + r.d);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: the vacuity gate must fail — it is the check that checks the checks)' : ''));
process.exit(MUTATE ? 0 : failed ? 1 : 0);
