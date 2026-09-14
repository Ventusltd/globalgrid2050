// Physics critic round 1: reproduce the page's PRNG chain from quantum.js (hash32 FNV-1a + mulberry32) and check convergence.
import fs from 'node:fs';
function hash32(str) { let h = 0x811c9dc5 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const e = JSON.parse(fs.readFileSync('C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/data/electron.json', 'utf8'));
const a = e.atoms.find(x => x.n === 2039);
const T = a.shells.K + a.shells.L + a.shells.M; const theta = 2 * Math.asin(Math.sqrt(a.shells.M / T)); const pT = Math.sin(theta / 2) ** 2;
console.log('atom', a.n, a.name, a.shells, 'theta deg', (theta * 180 / Math.PI).toFixed(2), 'sin^2(theta/2)', pT.toFixed(6), 'M/T', (a.shells.M / T).toFixed(6));
const c = Math.cos(theta / 2), s = Math.sin(theta / 2); console.log('c^2+s^2 =', c * c + s * s);
const out = []; for (let count = 0; count < 26; count++) { const seed = hash32('2026-09-14|2039|' + count); const r = mulberry32(seed)(); out.push(r < pT ? 1 : 0); if (count === 0) console.log('count 0: seed', seed, 'r', r.toFixed(3)); }
console.log('first 26: HOME', out.filter(x => !x).length, 'TUNNEL', out.filter(x => x).length);
for (const N of [1000, 10000, 100000]) { let t = 0; for (let count = 0; count < N; count++) { if (mulberry32(hash32('2026-09-14|2039|' + count))() < pT) t++; } console.log(N, 'draws: TUNNEL fraction', (t / N).toFixed(4), 'expected', pT.toFixed(4), 'sd', Math.sqrt(pT * (1 - pT) / N).toFixed(4)); }
// SOUL tier: the TUNNEL branch fixes the twin to defined_in with probability 1; HOME picks uniform over called_from
const en = JSON.parse(fs.readFileSync('C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/data/entangled.json', 'utf8'));
const soulAtoms = e.atoms.filter(x => en.entanglements.some(y => y.n === x.n)); console.log('shipped atoms in SOUL tier', soulAtoms.length, soulAtoms.slice(0, 5).map(x => `#${x.n} ${x.name} K${x.shells.K} L${x.shells.L} M${x.shells.M} val ${x.valence}`));
// ENTANGLED_MAYBE marginal: p + (1-p) q_em vs p
const r = JSON.parse(fs.readFileSync('C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/data/random.json', 'utf8'));
const soulNum = k => { const m = /^#(\d+)\s/.exec(k); return m ? +m[1] : null; };
let shown = 0; for (const at of e.atoms) { const edges = r.edges.filter(ed => soulNum(ed.from) === at.n || soulNum(ed.to) === at.n); const maker = edges.filter(ed => ed.p != null); const use = maker.length ? maker : edges; if (!use.length) continue; const em = use.find(ed => ed.kind === 'ENTANGLED_MAYBE' && ed.p != null); if (!em) continue; const sum = use.reduce((s, ed) => s + ed.p, 0); const q = em.p / sum; if (shown++ < 4) console.log(`#${at.n} ${at.name}: EM p=${em.p} q=${q.toFixed(3)} effective P(partner)=${(em.p + (1 - em.p) * q).toFixed(3)} (page prints p and q, not this)`); }
console.log('shells stats: shipped atoms with M>0', e.atoms.filter(x => x.shells.M > 0).length, 'of', e.atoms.length, '; atoms with K+L==0', e.atoms.filter(x => x.shells.K + x.shells.L === 0).length);
