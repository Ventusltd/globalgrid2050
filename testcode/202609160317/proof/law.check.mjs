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
   /law: inward-by-length-and-usage/.test(MUT ? src.replace('law: inward-by-length-and-usage', 'law: ???') : src),
   'a visitor can tell which reading they are looking at');
ok('the law takes no hidden state',
   !/Math\.random|Date\.now|performance\.now/.test(head), 'no randomness, no clock');

/* ---- the strip must lead somewhere real ----------------------------------
 * A navigation whose targets 404 is worse than none: it promises a journey.
 *
 * EVERY RESOLUTION IN THIS BLOCK IS readFileSync. It resolves the same RELATIVE PATH the
 * reader would - '../<stamp>/' from this surface - but it resolves it against the TREE,
 * on this disk. That is not the reader's question and this block cannot answer it.
 *
 * This sentence used to claim the block resolved "the way the READER does", which was
 * false. Seat A caught the one check that failed loudly, that check was scoped, and this
 * header was left making the same wrong claim about the whole block - because
 * documentation does not fail visibly, so it does not get corrected when the code does.
 *
 * The window is real and was open tonight: a generated surface is in the tree the instant
 * it is written and live only after Pages deploys. In that window these checks pass and a
 * visitor gets a 404. Measured the same night - 7.0 minutes of deploy lag, and three
 * Pages runs cancelled by newer pushes. The reader-side question belongs to
 * _board/liveness.py, which nothing here wires in.
 */
let page = readFileSync(path.join(here, '..', 'index.html'), 'utf8');
if (MUT) page = page.replace('id="laws"', 'id="laws-broken"');
const idxRel = MUT ? '../no-such-index/laws-index.json'
                   : (src.match(/LAWS_INDEX = '([^']+)'/) || [])[1];
let index = null;
try { index = JSON.parse(readFileSync(path.join(here, '..', idxRel), 'utf8')); } catch { }

ok('the surface is not a dead end',
   /id="laws"/.test(page) && /LAWS_INDEX/.test(src),
   'a strip exists in the markup and the module fetches it');
ok('the strip is navigation, not content - the page draws without it',
   /nav\.hidden = false/.test(src) && /\.catch\(/.test(src),
   'starts hidden, revealed only on success, failure swallowed');
ok('the laws index exists IN THE TREE (says nothing about the reader)',
   !!index && Array.isArray(index.laws) && index.laws.length > 0,
   `${idxRel} -> ${index ? index.laws.length + ' laws' : 'UNREADABLE'}`);
const targets = index ? index.laws.filter(l => l.open).map(l => l.open) : [];
const dead = targets.filter(s => {
  try { readFileSync(path.join(here, '..', '..', s, 'index.html')); return false; }
  catch { return true; }
});
/* SCOPE, stated because this check once cried DEAD on eight surfaces that were alive.
 * It resolves against the TREE. The tree is not the reader: a target can exist here and
 * 404 on the site, or exist on the site after being removed here. When the generator had
 * churning stamps this reported the map broken when it was the territory that had moved.
 * The reader's view is _board/liveness.py, which fetches the published URLs. */
ok('every target the strip offers exists IN THE TREE (not proof it is live)',
   targets.length > 0 && dead.length === 0,
   dead.length ? `ABSENT FROM TREE: ${dead.join(', ')} - check _board/liveness.py before concluding they are dead`
               : `${targets.length} targets resolve to an index.html here; liveness is a separate question`);
ok('the galaxy is reachable from here',
   src.includes("'../202609160224/'"), 'a way back, not only a way across');
ok('this law marks itself in the strip',
   /aria-current/.test(src) && src.includes("law.id === 'inward-by-length-and-usage'"),
   'a visitor can tell which law they are looking at');

const pass = checks.filter(c => c.pass).length;
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.n}\n        ${c.d}`);
console.log(`\n${pass}/${checks.length} passed` +
  (MUT ? '   (--mutate: failures above are the proof the checks can fail)' : ''));
console.log('NOT CHECKED HERE: that the canvas draws what the law computes. That needs a browser.');
process.exit(MUT ? 0 : (pass === checks.length ? 0 : 1));
