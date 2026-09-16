/* denominators.report.mjs — rule 24, turned on this surface's own proof folder.
 *
 * NOT a *.check.mjs, and the filename is the fix rather than a convention.
 *
 * Rule 24 was written at 07:13Z: a check must report the denominator of what it EXAMINED,
 * not only of what it asserted about. Its boundary said a refusal would sit in a lint over
 * the proof folder, "which is mechanical and was not written tonight."
 *
 * Writing it produced two defects in twenty minutes, both mine, and the second is the
 * reason this is a report and not a check:
 *
 *  1. It went into charter.check.mjs first and took that suite past 120 seconds — the file
 *     whose own header says the charter gate must "stay quick enough to run on every
 *     commit", a sentence I had read while writing the thing that broke it.
 *
 *  2. Moved to estate-vacuity.check.mjs it stopped returning inside any window I watched,
 *     and self-exclusion by resolved path did not fix it. The cycle is not self-invocation,
 *     it is MUTUAL: charter runs the vacuity
 *     gate over every suite, the vacuity gate runs estate-vacuity, and estate-vacuity's
 *     lint ran charter. A lint that EXECUTES suites cannot live inside the graph of suites
 *     that execute each other, and no amount of excluding itself would have found that.
 *     I did not reason either of them out. I watched runs exceed their timeout and went
 *     looking.
 *
 * CORRECTED 07:41Z, BY THE FIRST RUN ANSWERING BACK. The backgrounded charter run
 * COMPLETED — 5/6 passed, exit 0 — while the stone already said it hung. Slow is not
 * hung, and I wrote the stronger word because the tool had stopped showing me output:
 * the measurer describing its own window and calling it the world, inside the hour
 * spent writing the rule against exactly that. What survives the correction: charter
 * DID breach its documented contract, and the charter -> vacuity gate -> estate-vacuity
 * -> lint -> charter cycle is real BY CONSTRUCTION — verified by reading the call graph
 * rather than by having watched it loop, and that distinction belongs in the record.
 *
 * AND THE TWO ARTIFACTS DISAGREE, CORRECTLY: that run reported 8 of 11 suites silent
 * with estate-vacuity counted; this file reports 7 of 10 with it excluded and says so.
 * Both are right, and they differ only by the frame — rule 24 demonstrating itself on
 * the two artifacts written to serve it.
 *
 * So it lives outside the graph, is run by hand or by CI, and prints a denominator rather
 * than a verdict — which is rule 24's own boundary: a denominator makes a gap visible, it
 * does not close it.
 *
 * Run:  node proof/denominators.report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');

/* Words are allowed between the count and its population: the first version of this
   measurement was a grep for /\d+ (of|\/) \d+/ and it MISSED "6,762 keys of 250,174",
   undercounting particles by a third while measuring whether other checks undercount. */
const DENOM = /\d[\d,]*\s+(?:\S+\s+){0,3}?(?:of|\/)\s*\d[\d,]*/;

/* estate-vacuity is excluded because it spawns 48 processes of its own and this report is
   about detail lines, not about the vacuity gate. Excluded BY MEASURE, and said out loud
   rather than silently skipped — classify, don't exclude. */
const SKIP = new Set(['estate-vacuity.check.mjs']);
const suites = fs.readdirSync(path.join(SURF, 'proof'))
  .filter((f) => f.endsWith('.check.mjs')).sort();

const rows = [];
for (const f of suites) {
  if (SKIP.has(f)) { rows.push([f.replace('.check.mjs', ''), null, null]); continue; }
  let out = '';
  try {
    out = execFileSync(process.execPath, [path.join(SURF, 'proof', f)],
      { cwd: SURF, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const lines = out.split('\n');
  let checks = 0, withDenom = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/^(PASS|FAIL)\s/.test(lines[i])) continue;
    checks++;
    if (DENOM.test((lines[i + 1] || '') + ' ' + (lines[i + 2] || ''))) withDenom++;
  }
  rows.push([f.replace('.check.mjs', ''), withDenom, checks]);
}

let tChecks = 0, tDenom = 0, silent = 0, ran = 0;
for (const [name, d, n] of rows) {
  if (d === null) { console.log(name.padEnd(18) + '  not run here (spawns 48 of its own)'); continue; }
  ran++; tChecks += n; tDenom += d;
  if (d === 0) silent++;
  console.log(name.padEnd(18) + '  ' + String(d).padStart(2) + ' of ' + String(n).padStart(2) +
    ' details state a population' + (d === 0 ? '   <- silent' : ''));
}
console.log('\n' + tDenom + ' of ' + tChecks + ' details across ' + ran +
  ' suites state what was examined · ' + silent + ' suites state none at all');
console.log('A green verdict over an unstated population is a claim about the population.');
console.log('This is a REPORT, not a gate: rule 24 says a denominator makes a gap visible,');
console.log('not that it closes it. The number is the finding; closing it is scheduled work.');
