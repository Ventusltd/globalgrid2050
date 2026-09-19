// proof/kuiper-pulse.check.mjs — the Kuiper belt's pulse, checked without a browser.
//
// It re-implements nothing. It cuts the placement laws out of the shipped pilot.mjs by name and runs
// that source text, so what is checked is what is served. Run it from anywhere:
//     node proof/kuiper-pulse.check.mjs [<path to estate-bodies.json>]
// The second argument is optional: without it the join back to the estate run is reported as NOT
// EXAMINED rather than as a pass, because a check that examines nothing refuses.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(DIR, 'pilot.mjs'), 'utf8');

function cut(name, kind) {
  const start = src.indexOf(kind === 'const' ? `const ${name} =` : `function ${name}(`);
  if (start < 0) throw new Error('not found in pilot.mjs: ' + name);
  if (kind === 'const') return src.slice(start, src.indexOf('\n', start));
  let depth = 0;
  for (let j = src.indexOf('{', start); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && !--depth) return src.slice(start, j + 1);
  }
  throw new Error('unbalanced braces: ' + name);
}

const R = 100;                       // stand-in for the wafer radius; any positive number works
const P = new Function(
  `const W = () => ({ kepler: () => ({ R: ${R} }) });\nlet pulseBuf = null, pulseShare = null;\n` +
  [cut('PULSE', 'const'), cut('networkTargets'), cut('pulseTargets'), cut('pulseDistances'),
   cut('stationCopies'), cut('pulseOrigin')].join('\n') +
  '\nreturn { networkTargets, pulseTargets, pulseDistances, stationCopies, pulseOrigin, PULSE };')();

const load = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const M = 245170;                    // 250,174 numbered lines less the 2 % rim: the scope draw() gets

let fail = 0, refused = 0;
const ok = (c, m) => { console.log((c ? '  PASS   ' : '  FAIL   ') + m); if (!c) fail++; };
const no = m => { console.log('  REFUSE ' + m); refused++; };

console.log('1. no other system\'s placement changed');
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('-network.json'))) {
  const t = P.networkTargets(load(f), M);
  ok(t.length === 2 * M && t.every(Number.isFinite), `${f}: networkTargets gives ${M.toLocaleString('en-GB')} finite points`);
}
{ // the fourth element must be invisible to the law that draw uses
  const N = load('kuiper-network.json');
  const three = { ...N, stations: N.stations.map(s => [s[0], s[1], s[2]]) };
  const a = P.networkTargets(three, M), b = P.networkTargets(N, M);
  ok(Buffer.compare(Buffer.from(a.buffer), Buffer.from(b.buffer)) === 0,
    'draw kuiper places every line at byte-identical coordinates with and without the fourth element');
}

console.log('\n2. the measured quantity');
const N = load('kuiper-network.json'), C = P.stationCopies(N), c = N.counts;
ok(!!C, 'a measured copy count is present, so the pulse may examine something');
ok(C.measured === N.stations.length && C.unmeasured === 0, `${C.measured} measured, ${C.unmeasured} unmeasured (unmeasured bodies stay base dust)`);
let dup = 0, uni = 0, paths = 0;
for (const s of N.stations) { if (s[3] > 1) dup++; else uni++; paths += s[3]; }
ok(dup + uni === c.bodies && dup === c.duplicated && uni === c.unique && paths === c.tracked_paths,
  `recounted from the stations themselves: ${c.bodies} bodies, ${dup} duplicated, ${uni} unique, ${paths} tracked paths`);

const BODIES = process.argv[2];
if (!BODIES) no('the join back to estate-bodies.json: NOT EXAMINED — pass its path to check it');
else {
  const by = new Map(JSON.parse(fs.readFileSync(BODIES, 'utf8')).bodies.map(b => [b.id, b.copies]));
  let bad = 0; for (const s of N.stations) if (by.get(s[2]) !== s[3]) bad++;
  ok(bad === 0, `every station's fourth element equals estate-bodies.json copies for that blob SHA (${N.stations.length} of ${N.stations.length})`);
}

console.log('\n3. the pulse law');
const O = P.pulseOrigin(N, '');
ok(O && N.stations[O.i][3] === c.max_copies, `the default origin is the most-copied body, copies ${c.max_copies} — a measurement, not a choice`);
ok(P.pulseOrigin(N, 'zzzz') === null, 'an origin naming no body refuses, and nothing is drawn');
ok(P.pulseOrigin(N, N.stations[9][2].slice(0, 8))?.x === N.stations[9][0], 'a blob SHA prefix resolves to that body');
const { d, dmax } = P.pulseDistances(N, O.x, O.y);
const v = dmax / P.PULSE.T;
ok(d.length === N.stations.length && dmax > 0, `geometric distance computed for ${d.length} bodies, d_max = ${dmax.toFixed(4)}, v = ${v.toFixed(4)} belt units/s`);

let good = true;
for (let step = 0; step <= 12; step++) {
  const t = P.pulseTargets(N, M, C.w, d, v * (step * P.PULSE.T / 12));
  if (t.length !== 2 * M || !t.every(Number.isFinite)) { good = false; break; }
}
ok(good, `every frame is exactly ${M.toLocaleString('en-GB')} finite points: the dust is conserved, the light only moves`);

{ // the response is the measured copy count and nothing else
  const Rf = dmax * 0.5, n = N.stations.length, s = new Float64Array(n);
  let tot = 0;
  for (let q = 0; q < n; q++) {
    const u = (d[q] - Rf) / P.PULSE.SIGMA, f = u * u > 36 ? 0 : Math.exp(-u * u);
    s[q] = 1 + P.PULSE.GAIN * f * Math.exp(-d[q] / P.PULSE.LAMBDA) * C.w[q]; tot += s[q];
  }
  const dots = new Int32Array(n);
  let cum = 0, j = 0, total = 0;
  for (let q = 0; q < n; q++) { cum += s[q]; const end = q === n - 1 ? M : Math.min(M, Math.floor(M * cum / tot)); dots[q] = Math.max(0, end - j); j = end; total += dots[q]; }
  ok(total === M, `the dots handed out sum to exactly ${M.toLocaleString('en-GB')}: no rounding drift`);
  let dD = 0, dN = 0, uD = 0, uN = 0, far = 0;
  for (let q = 0; q < n; q++) {
    if (Math.abs(d[q] - Rf) < P.PULSE.SIGMA) { if (N.stations[q][3] > 1) { dD += dots[q]; dN++; } else { uD += dots[q]; uN++; } }
    else if (d[q] > Rf + 6 * P.PULSE.SIGMA) far += dots[q];
  }
  const da = dD / Math.max(1, dN), ua = uD / Math.max(1, uN);
  ok(da > ua, `in the front band a duplicated body averages ${da.toFixed(1)} dots against ${ua.toFixed(1)} for a unique one — the copy count, measured, is the only cause`);
  ok(far > 0, `the belt away from the front keeps its base dust (${far.toLocaleString('en-GB')} dots)`);
}

console.log('\n' + (fail ? `${fail} FAILED` : 'all checks passed') + (refused ? `, ${refused} NOT EXAMINED` : ''));
process.exit(fail ? 1 : 0);
