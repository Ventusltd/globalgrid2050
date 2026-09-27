// Stable keys and the seeded draw for procedural detail (Kuiper style: computed on arrival, never stored).
//
// Identity is geometric: a table is addressed by the layout's own sort tuple (track k, side s, run j,
// row r, index i; plant-layout.mjs sorts candidates by acc.k, acc.s, acc.j, acc.r, acc.i), so a key
// survives a capacity change. Hierarchy:  R:k.s.j.r  ->  T:k.s.j.r.i  ->  S:<table>/n  ->  M:<table>/n.m
//
// The seeded draw is FNV-1a (32-bit, over the UTF-8 bytes of "<seed>|<key>|<kind>") into mulberry32.
// Everything here is integer arithmetic on uint32; no Math.random, no floats are hashed. The same
// arithmetic is re-derived in CuPy by pair_procedural_gpu.py and must hash-match.
// Pure functions, no globals, no DOM.

const FNV_OFFSET = 0x811c9dc5, FNV_PRIME = 0x01000193;

// FNV-1a over a string's UTF-8 bytes (keys are ASCII; non-ASCII is encoded, not truncated).
export function fnv1a(str, h = FNV_OFFSET) {
  const bytes = new TextEncoder().encode(String(str));
  return fnv1aBytes(bytes, h);
}

export function fnv1aBytes(bytes, h = FNV_OFFSET) {
  h >>>= 0;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, FNV_PRIME) >>> 0; }
  return h >>> 0;
}

// FNV-1a over an Int32Array's bytes, little-endian whatever the host order is.
export function fnv1aInt32(arr, h = FNV_OFFSET) {
  h >>>= 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i] >>> 0;
    for (let b = 0; b < 32; b += 8) { h ^= (v >>> b) & 0xff; h = Math.imul(h, FNV_PRIME) >>> 0; }
  }
  return h >>> 0;
}

// mulberry32 as a stream of uint32 draws (the float form is draw / 2^32; integer users take the u32).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

export const unit = u32 => u32 / 4294967296;

// Seeded integer in [lo, hi] from a u32 (modulo bias < 1e-6 for ranges under 4,000; stated, not hidden).
export const intIn = (u32, lo, hi) => lo + (u32 % (hi - lo + 1));

// ---- keys ---------------------------------------------------------------------------------------
const int = (v, name) => {
  if (!Number.isInteger(v) || v < 0 || v > 0xffff) throw new RangeError(`address ${name} must be an integer 0..65535, got ${v}`);
  return v;
};

export function rowKey({ k, s, j, r }) { return `R:${int(k, 'k')}.${int(s, 's')}.${int(j, 'j')}.${int(r, 'r')}`; }
export function tableKey(a) { return `T:${int(a.k, 'k')}.${int(a.s, 's')}.${int(a.j, 'j')}.${int(a.r, 'r')}.${int(a.i, 'i')}`; }
export const stringKey = (tKey, n) => `S:${tKey.slice(2)}/${n}`;
export const moduleKey = (tKey, n, m) => `M:${tKey.slice(2)}/${n}.${m}`;

export function parseKey(key) {
  const m = /^([RTSM]):(\d+)\.(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?(?:\/(\d+)(?:\.(\d+))?)?$/.exec(String(key));
  if (!m) return null;
  const [, level, k, s, j, r, i, n, mod] = m;
  const out = { level, k: +k, s: +s, j: +j, r: +r };
  if (i !== undefined) out.i = +i;
  if (n !== undefined) out.string = +n;
  if (mod !== undefined) out.module = +mod;
  if ((level === 'R') !== (i === undefined)) return null;
  if ((level === 'S' || level === 'M') !== (n !== undefined)) return null;
  if ((level === 'M') !== (mod !== undefined)) return null;
  return out;
}

// The seed of one piece of detail: u32 of "<plantSeed>|<key>|<kind>".
export const detailSeed = (plantSeed, key, kind = 'detail') => fnv1a(`${plantSeed >>> 0}|${key}|${kind}`);

// Quantise metres to integer millimetres (round half away from zero; the only float step, done once
// on the plant record, never per detail).
export const mm = metres => { const v = metres * 1000; return v < 0 ? -Math.round(-v) : Math.round(v); };
