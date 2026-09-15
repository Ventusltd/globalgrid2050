// PRNG check for the page's Born draw: r = first output of mulberry32(FNV-1a(seedString|soul|count)), exactly as quantum.js does it.
// Measures P(r < 1/3) over 20,000 consecutive counts for three souls (expected 0.3333) and prints it; nothing else.
function hash32(str) { let h = 0x811c9dc5 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const out = {};
for (const soul of [2039, 766, 6554]) { let lt = 0; const N = 20000; for (let c = 0; c < N; c++) if (mulberry32(hash32('2026-09-14|' + soul + '|' + c))() < 1 / 3) lt++; out[soul] = { counts: N, p_r_lt_one_third: +(lt / N).toFixed(4) }; }
console.log(JSON.stringify(out));
