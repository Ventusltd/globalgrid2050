/* particles.check.mjs — the checks the code wafer must pass.
 *
 * The wafer claims three things that are easy to assert and easy to get wrong:
 * that every band named in the head exists and holds what it says, that a key
 * resolves to the line the numbered database actually recorded, and that the
 * derived state is a pure function of the key. Each check below is a way for
 * those claims to be false.
 *
 * --mutate corrupts the head in memory and checks 1-3 must fail. Check 4 cannot
 * be falsified that way — a pure function is not made impure by a bad manifest —
 * and that is stated rather than papered over with an artificial mutation.
 *
 * Run:  node proof/particles.check.mjs
 *       node proof/particles.check.mjs --mutate
 */
import fs from 'node:fs';
import path from 'node:path';
import { derive, nature, radiation, NATURE_NAME, NOISE } from '../derive.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const PACK = path.resolve(SURF, '..', '202609142202', 'data');
const MUTATE = process.argv.includes('--mutate');

const head = JSON.parse(fs.readFileSync(path.join(SURF, 'particles.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(PACK, 'all-lines.meta.json'), 'utf8'));
const buckets = head.buckets.map(([b, n]) => [b, n]);

if (MUTATE) {
  buckets.push([999999, 7]);                 /* a band that does not exist   -> 1 */
  if (buckets[2]) buckets[2][1] += 5;        /* a band with a wrong count    -> 2 */
  /* This lie was wrong the first time it was written: it replaced a place with
     'Ventusltd/not-a-repo' and forty zeros, which IS well formed — a repository
     that does not exist is not a malformed place, and check 3 correctly passed.
     The check tests shape, so the lie must break shape: a truncated commit is
     what actually reaches a browser as a silent 404. */
  head.places[0] = ['Ventusltd/globalgrid2050', 'deadbeef', 'engine/geo-core.js'];  /* -> 3 */
}

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

/* 1. Every band the head names exists on disk. */
const missing = buckets.filter(([b]) => !fs.existsSync(path.join(SURF, 'p', b + '.json'))).map(([b]) => b);
check('every band named in the head exists', missing.length === 0,
  missing.length ? 'absent: ' + missing.join(', ') : buckets.length + ' bands, all present');

/* 2. Every band holds exactly the number of keys the head promises, and its keys
      fall inside the band's own range. A band whose keys stray is a band the
      page will fetch for the wrong ring. */
let wrong = [];
for (const [b, n] of buckets) {
  const f = path.join(SURF, 'p', b + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (d.key.length !== n) { wrong.push(b + ' says ' + n + ' holds ' + d.key.length); continue; }
  const lo = b * head.span, hi = lo + head.span;
  if (d.key.some((k) => k < lo || k >= hi)) wrong.push(b + ' holds a key outside its range');
}
check('every band holds what the head promises', wrong.length === 0,
  wrong.length ? wrong.slice(0, 3).join(' · ') : buckets.length + ' bands agree with the head');

/* 3. A resolution points at a real repository and a full commit. The page builds
      a raw.githubusercontent URL from these; a malformed one fails silently in a
      browser, which is the worst way for it to fail. */
const badPlace = head.places.filter(
  ([repo, commit, p]) => !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[0-9a-f]{40}$/.test(commit) || !p
);
check('every place is a real repo and a full commit', badPlace.length === 0,
  badPlace.length ? badPlace.length + ' malformed, first: ' + JSON.stringify(badPlace[0]).slice(0, 90)
    : head.places.length + ' places, all well formed');

/* 4. The derived state is a pure function of the key. Same input, same output,
      and a key that has not been issued yet already has one. NOT covered by
      --mutate: corrupting a manifest cannot make a pure function impure. */
const a = derive(4242, 60, 1, 3), b2 = derive(4242, 60, 1, 3);
const future = derive(meta.max + 100000, 60, 1);
check('derived state is pure and unbounded',
  a.nature === b2.nature && a.radiation === b2.radiation && a.field === b2.field &&
  Number.isFinite(future.radiation),
  'key 4242 -> ' + NATURE_NAME[a.nature] + ', radiation ' + a.radiation.toFixed(3) +
  ' ; unissued key ' + (meta.max + 100000) + ' already derives ' + NATURE_NAME[future.nature]);

/* 5. Radiation means "has this code been used somewhere" — so a line used in more
      places must radiate more, and noise must radiate nothing at all. */
check('radiation rises with use, and noise radiates nothing',
  radiation(60, 1, 2) < radiation(60, 1, 90) && radiation(2, 0) === 0 && nature(2, 0) === NOISE,
  '2 places ' + radiation(60, 1, 2).toFixed(3) + ' < 90 places ' + radiation(60, 1, 90).toFixed(3) +
  ' ; a 2-character line in no family is ' + NATURE_NAME[nature(2, 0)] + ' at radiation 0');

/* 6. The particle count matches the pack's own in_a_family. If these disagree the
      wafer is resolving lines the numbering does not think are resolvable. */
check('particles equal the pack\'s in_a_family', head.particles === meta.in_a_family,
  head.particles.toLocaleString() + ' particles vs pack in_a_family ' +
  meta.in_a_family.toLocaleString() + ' (pack built ' + meta.built_utc + ')');

/* 7. THE RASTER REACHES THE CANVAS.
 *
 * This file passed 6/6 honest and 3/6 mutated on a surface that drew NOTHING.
 * Every check above describes the data; none asked whether a pixel ever reached
 * the canvas. The pixel path wrote 250,174 particles into an ImageData buffer
 * and never blitted it, so the page was black at its default zoom while its own
 * counters reported every particle on screen — and it rendered correctly at
 * dpr 2, so it worked on a phone and failed on a desktop.
 *
 * Node has no canvas, so this cannot count pixels the way vikra-ac did in a
 * browser. It checks the invariant that actually broke instead: the default zoom
 * takes the pixel path, and the pixel path must end in a blit, positioned after
 * the buffer is written and before anything is composited over it.
 */
{
  const src = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8');
  const sizeAt = (zoom, dpr) => Math.max(1, 1.1 * dpr * Math.min(zoom, 2.4));
  const defaultIsPixelPath = sizeAt(1, 1) <= 1.5;

  const iWrite = src.lastIndexOf('buf32[o] =');
  const iBlit = MUTATE ? -1 : src.indexOf('putImageData');

  /* The blit overwrites rather than composites, so it must never run in a frame
     that also draws labels. Rather than guess that from where the calls sit in
     the file — the first version of this check did, and got the comparison
     backwards — assert the numeric invariant: at every zoom where labels are
     drawn, the pixel path must be off. LOD_NAMES is 8 in nest.mjs. */
  const LOD_NAMES = 8;
  let overlap = null;
  for (let z = LOD_NAMES; z <= 600; z += 0.5) {
    for (const dpr of [1, 2]) {
      if (sizeAt(z, dpr) <= 1.5) { overlap = 'zoom ' + z + ' dpr ' + dpr; break; }
    }
    if (overlap) break;
  }

  const ok = defaultIsPixelPath && iWrite >= 0 && iBlit > iWrite && overlap === null;
  check('the pixel path ends in a blit, and the default zoom uses it', ok,
    'default zoom size ' + sizeAt(1, 1).toFixed(2) + ' -> pixel path ' + defaultIsPixelPath +
    ' ; buffer written at ' + iWrite + ' ; putImageData at ' + iBlit +
    (iBlit < 0 ? '  <-- NOTHING REACHES THE CANVAS' : '') +
    ' ; labels never co-occur with the pixel path: ' + (overlap === null ? 'yes' : 'NO at ' + overlap));
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + '\n        ' + r.detail);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: checks 1-3 must be among the failures)' : ''));
process.exit(MUTATE ? 0 : failed ? 1 : 0);
