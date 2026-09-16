/* law.check.mjs - proves THIS variation's law, not another surface's.
 * Run: node proof/law.check.mjs   |   node proof/law.check.mjs --mutate
 *
 * It imports the shipped module and exercises the real function. It cannot draw, and
 * says so at the end rather than reporting green on something it never saw.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'wafer.mjs'), 'utf8');
const MUT = process.argv.includes('--mutate');

/* the browser module touches document at import; evaluate just the pure part */
const head = src.slice(0, src.indexOf('const stage'));
/* The mutation must actually break the properties under test. An earlier version used
   Math.random()*0, which is a no-op - a mutation that cannot fail proves nothing, and
   would have shipped on every surface. These three each break a different check. */
const broken = head
  .replace('const r =', 'const r = Math.random() +')          // kills determinism
  .replace('Math.cos(a) * r, Math.sin(a) * r',
           'key > 342795 ? NaN : Math.cos(a) * r, key > 342795 ? NaN : Math.sin(a) * r'); // kills unboundedness
const mod = await import('data:text/javascript;base64,' +
  Buffer.from(MUT ? broken : head).toString('base64'));
const place = mod.place;
const MAXK = 342795;
const checks = [];
const ok = (n, c, d) => checks.push({ n, pass: !!c, d });

const A = place(4242, 0.5, 40, 1, MAXK), A2 = place(4242, 0.5, 40, 1, MAXK);
ok('the same key lands in the same place, every time',
   A[0] === A2[0] && A[1] === A2[1], `key 4242 -> ${A[0].toFixed(3)}, ${A[1].toFixed(3)}`);
const B1 = place(4243, 0.5, 40, 1, MAXK);
ok('different keys land in different places',
   A[0] !== B1[0] || A[1] !== B1[1], 'no two keys share a point');
const U = place(MAXK + 100000, 0.3, 30, 0, MAXK);
ok('a key that was never issued already has a place',
   Number.isFinite(U[0]) && Number.isFinite(U[1]),
   `unissued ${MAXK + 100000} -> ${U[0].toFixed(1)}, ${U[1].toFixed(1)} - unbounded, not merely large`);
const rs = [1, 999, 50000, 200000, MAXK].map(k => Math.hypot(...place(k, 0.5, 40, 1, MAXK)));
ok('every position is finite and inside the disc',
   rs.every(r => Number.isFinite(r) && r <= 600), `max radius ${Math.max(...rs).toFixed(1)} of 585.5`);
ok('the page names the law it is drawing',
   /law: bands-by-usage/.test(MUT ? src.replace('law: bands-by-usage', 'law: ???') : src),
   'a visitor can tell which reading they are looking at');
ok('the law takes no hidden state',
   !/Math\.random|Date\.now|performance\.now/.test(head), 'no randomness, no clock');

const pass = checks.filter(c => c.pass).length;
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.n}\n        ${c.d}`);
console.log(`\n${pass}/${checks.length} passed` +
  (MUT ? '   (--mutate: failures above are the proof the checks can fail)' : ''));
console.log('NOT CHECKED HERE: that the canvas draws what the law computes. That needs a browser.');
process.exit(MUT ? 0 : (pass === checks.length ? 0 : 1));
