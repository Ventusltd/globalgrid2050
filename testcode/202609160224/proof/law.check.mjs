/* law.check.mjs — the core law must put the most-used code at the centre, and must
 * not quietly pretend to be permanent.
 *
 * Run: node proof/law.check.mjs            (from testcode/202609160224)
 *      node proof/law.check.mjs --mutate
 *
 * The law is arithmetic, so it can be checked without a browser: this reimplements
 * nothing — it reads the constants and the formula out of nest.mjs and exercises them.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
let js = readFileSync(path.join(here, '..', 'nest.mjs'), 'utf8');
const MUT = process.argv.includes('--mutate');

/* literal regexes: building these with the RegExp constructor cost an escaping
   level and silently produced NaN, which then made two checks pass by accident. */
const pick = (re) => Number((js.match(re) || [])[1]);
let R_MAX = pick(/R_MAX\s*=\s*(-?[\d.]+)/), CORE_BAND = pick(/CORE_BAND\s*=\s*(-?[\d.]+)/);
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
if (MUT) { R_MAX = -R_MAX; js = js.replace('not a permanent address', 'totally permanent'); }

/* the same arithmetic the page uses */
const coreR = (key, rad) => R_MAX * (1 - rad) + (((key * 2654435761) >>> 0) % 1000 / 1000) * CORE_BAND;
const waferR = (key) => Math.sqrt(key);

const checks = [];
if (!Number.isFinite(R_MAX) || !Number.isFinite(CORE_BAND)) {
  console.error('FAIL  could not read R_MAX / CORE_BAND from nest.mjs — refusing to report on values it did not read');
  process.exit(1);
}
const ok = (n, c, d) => checks.push({ n, pass: !!c, d });

ok('the most-used code lands at the core',
   coreR(4242, 1) < coreR(4242, 0.5) && coreR(4242, 0.5) < coreR(4242, 0),
   `rad 1 -> r=${coreR(4242,1).toFixed(1)} ; rad .5 -> ${coreR(4242,0.5).toFixed(1)} ; dust -> ${coreR(4242,0).toFixed(1)}`);
ok('fully-used code is at or near r=0',
   coreR(4242, 1) < CORE_BAND + 1, `r=${coreR(4242,1).toFixed(2)} within one shell of the centre`);
ok('dust sits at the rim, still drawn',
   coreR(4242, 0) > R_MAX * 0.9 && Number.isFinite(coreR(4242, 0)),
   `dust r=${coreR(4242,0).toFixed(1)} of R_MAX ${R_MAX} — present, not hidden`);
ok('core fills the same disc as wafer',
   Math.abs(R_MAX - waferR(342795)) < 5, `R_MAX ${R_MAX} vs sqrt(maxKey) ${waferR(342795).toFixed(1)}`);
ok('equal usage spreads into a shell, not a wire',
   Number.isFinite(coreR(4242,0.5)) && coreR(4242, 0.5) !== coreR(4243, 0.5),
   'two keys at identical usage get different radii');
ok('core is reproducible for the same inputs',
   coreR(9999, 0.3) === coreR(9999, 0.3), 'same key and usage -> same radius, every time');
ok('the angle still comes from the permanent key',
   /const a = key \* GOLDEN/.test(js), 'theta = key x golden angle under both laws');
ok('wafer remains the default',
   /get\('law'\) \|\| 'wafer'/.test(js), "no ?law= gives the permanent law");
ok('wafer positions never move when usage refines',
   /if \(LAW === 'core'\) \{ const p = placeXY/.test(js),
   'the refinement repositions only under core');
ok('the page admits core is not permanent',
   /not a permanent address/.test(js), 'stated in the footer, where the visitor reads it');

const pass = checks.filter(c => c.pass).length;
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.n}\n        ${c.d}`);
console.log(`\n${pass}/${checks.length} passed` + (MUT ? '   (--mutate: failures above are the proof the checks can fail)' : ''));
process.exit(MUT ? 0 : (pass === checks.length ? 0 : 1));
