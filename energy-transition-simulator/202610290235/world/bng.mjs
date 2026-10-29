// British National Grid <-> WGS84, pure functions, no imports, no DOM.
//
// WHAT THIS IS
//   bngToWgs84 mirrors osgb36_to_wgs84() in globalgrid2050
//   uk_renewables_pipeline/v9.7/scripts/data/build_v7_2_spine.py term for term (one
//   deliberate difference: the meridian-arc loop, see tmInverse):
//   Transverse Mercator inverse on Airy 1830 with the OS National Grid constants
//   (F0 0.9996012717, true origin 49N 2W, false origin E 400000 N -100000), then a
//   7-parameter Helmert OSGB36 -> WGS84 with heights taken as zero on Airy.
//   wgs84ToBng is its exact algebraic inverse: the Helmert matrix inverted (not the
//   usual sign-flipped approximation, which is out by about 1 cm) and the WGS84 height
//   chosen so the Airy height is zero, then the TM forward series, then one fixed-point
//   step against tmInverse (the OS forward and inverse series are truncations and part
//   by up to 2 mm 400 km from the central meridian). So a round trip through both
//   functions closes to well under a millimetre anywhere on the grid.
//
// HOW ACCURATE IT IS, AND IS NOT
//   Closing a round trip proves consistency, not truth. The Helmert transformation is
//   accurate to about 3.5 m against the real National Grid (Ordnance Survey, "A guide to
//   coordinate systems in Great Britain", section 6.6; the OS says 3-5 m and does not
//   recommend it where better is needed). The definitive transformation is OSTN15, a
//   grid of offsets not held here. Where a site has a known OSTN15 offset it can be
//   passed as { de, dn } in metres: wgs84ToBng adds it to the result and bngToWgs84
//   removes it before converting, so the pair stays inverses of each other.
//
// Sources: Ordnance Survey, "A guide to coordinate systems in Great Britain" (v3.6),
//   Annex B (Helmert), Annex C (Transverse Mercator), Annex C.1 worked example.

const AIRY_A = 6377563.396, AIRY_B = 6356256.909;
const WGS_A = 6378137.0, WGS_B = 6356752.3141;
const F0 = 0.9996012717;
const LAT0 = 49 * Math.PI / 180, LON0 = -2 * Math.PI / 180;
const E0 = 400000, N0 = -100000;
const AIRY_E2 = 1 - (AIRY_B * AIRY_B) / (AIRY_A * AIRY_A);
const WGS_E2 = 1 - (WGS_B * WGS_B) / (WGS_A * WGS_A);
const N_ = (AIRY_A - AIRY_B) / (AIRY_A + AIRY_B);
const RAD = Math.PI / 180, SEC = RAD / 3600;

// OSGB36 -> WGS84, exactly as the Python: x2 = t + M x1
const T = [446.448, -125.157, 542.060];
const RX = 0.1502 * SEC, RY = 0.2470 * SEC, RZ = 0.8421 * SEC;
const S = 1 - 20.4894e-6;
const M = [[S, -RZ, RY], [RZ, S, -RX], [-RY, RX, S]];

function invert3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}
const MI = invert3(M);

const apply = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

function toCartesian(lat, lon, h, a, e2) {
  const s = Math.sin(lat), c = Math.cos(lat);
  const nu = a / Math.sqrt(1 - e2 * s * s);
  return [(nu + h) * c * Math.cos(lon), (nu + h) * c * Math.sin(lon), (nu * (1 - e2) + h) * s];
}

// Cartesian -> geodetic, the same fixed-point iteration as the Python (12 steps max).
function fromCartesian(x, y, z, a, e2) {
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - e2));
  for (let k = 0; k < 12; k++) {
    const nu = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    const next = Math.atan2(z + e2 * nu * Math.sin(lat), p);
    const done = Math.abs(next - lat) < 1e-12;
    lat = next;
    if (done) break;
  }
  const nu = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const h = Math.abs(Math.cos(lat)) > 1e-9 ? p / Math.cos(lat) - nu : Math.abs(z) - nu * (1 - e2);
  return { lat, lon: Math.atan2(y, x), h };
}

function meridional(lat) {
  const n = N_, dl = lat - LAT0, sl = lat + LAT0;
  const ma = (1 + n + 5 / 4 * n ** 2 + 5 / 4 * n ** 3) * dl;
  const mb = (3 * n + 3 * n ** 2 + 21 / 8 * n ** 3) * Math.sin(dl) * Math.cos(sl);
  const mc = (15 / 8 * n ** 2 + 15 / 8 * n ** 3) * Math.sin(2 * dl) * Math.cos(2 * sl);
  const md = 35 / 24 * n ** 3 * Math.sin(3 * dl) * Math.cos(3 * sl);
  return AIRY_B * F0 * (ma - mb + mc - md);
}

/** OSGB36 latitude/longitude (radians, Airy 1830) -> National Grid { e, n }. OS Annex C. */
export function tmForward(lat, lon) {
  const s = Math.sin(lat), c = Math.cos(lat), t = Math.tan(lat);
  const nu = AIRY_A * F0 / Math.sqrt(1 - AIRY_E2 * s * s);
  const rho = AIRY_A * F0 * (1 - AIRY_E2) / (1 - AIRY_E2 * s * s) ** 1.5;
  const eta2 = nu / rho - 1;
  const I = meridional(lat) + N0;
  const II = nu / 2 * s * c;
  const III = nu / 24 * s * c ** 3 * (5 - t ** 2 + 9 * eta2);
  const IIIA = nu / 720 * s * c ** 5 * (61 - 58 * t ** 2 + t ** 4);
  const IV = nu * c;
  const V = nu / 6 * c ** 3 * (nu / rho - t ** 2);
  const VI = nu / 120 * c ** 5 * (5 - 18 * t ** 2 + t ** 4 + 14 * eta2 - 58 * t ** 2 * eta2);
  const dl = lon - LON0;
  return {
    e: E0 + IV * dl + V * dl ** 3 + VI * dl ** 5,
    n: I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6,
  };
}

/** National Grid (e, n) -> OSGB36 { lat, lon } in radians on Airy 1830. Mirrors the Python. */
export function tmInverse(easting, northing) {
  let lat = LAT0, m = 0;
  // OS Annex C.6 repeats while |N - N0 - M| >= 0.01 mm. The Python tests the signed value,
  // so north of about 55N, where a step overshoots, it stops early: 3-11 cm out in Scotland
  // and up to 46 m north of N 1,210,000. Here the absolute value, as the OS writes it.
  for (let k = 0; k < 100 && Math.abs(northing - N0 - m) >= 0.00001; k++) {
    lat += (northing - N0 - m) / (AIRY_A * F0);
    m = meridional(lat);
  }
  const s = Math.sin(lat), c = Math.cos(lat), t = Math.tan(lat);
  const nu = AIRY_A * F0 / Math.sqrt(1 - AIRY_E2 * s * s);
  const rho = AIRY_A * F0 * (1 - AIRY_E2) / (1 - AIRY_E2 * s * s) ** 1.5;
  const eta2 = nu / rho - 1;
  const de = easting - E0;
  const VII = t / (2 * rho * nu);
  const VIII = t / (24 * rho * nu ** 3) * (5 + 3 * t ** 2 + eta2 - 9 * t ** 2 * eta2);
  const IX = t / (720 * rho * nu ** 5) * (61 + 90 * t ** 2 + 45 * t ** 4);
  const X = 1 / (c * nu);
  const XI = 1 / (c * 6 * nu ** 3) * (nu / rho + 2 * t ** 2);
  const XII = 1 / (c * 120 * nu ** 5) * (5 + 28 * t ** 2 + 24 * t ** 4);
  const XIIA = 1 / (c * 5040 * nu ** 7) * (61 + 662 * t ** 2 + 1320 * t ** 4 + 720 * t ** 6);
  return {
    lat: lat - VII * de ** 2 + VIII * de ** 4 - IX * de ** 6,
    lon: LON0 + X * de - XI * de ** 3 + XII * de ** 5 - XIIA * de ** 7,
  };
}

const offset = (o) => ({ de: (o && Number.isFinite(o.de)) ? o.de : 0, dn: (o && Number.isFinite(o.dn)) ? o.dn : 0 });

/** National Grid easting/northing (m) -> WGS84 { lat, lon } in degrees. */
export function bngToWgs84(e, n, ostn) {
  const { de, dn } = offset(ostn);
  const g = tmInverse(e - de, n - dn);
  const p = toCartesian(g.lat, g.lon, 0, AIRY_A, AIRY_E2);
  const q = apply(M, p);
  const w = fromCartesian(q[0] + T[0], q[1] + T[1], q[2] + T[2], WGS_A, WGS_E2);
  return { lat: w.lat / RAD, lon: w.lon / RAD };
}

/** WGS84 { lat, lon } in degrees -> National Grid { e, n } in metres. Exact inverse of bngToWgs84. */
export function wgs84ToBng(lat, lon, ostn) {
  const { de, dn } = offset(ostn);
  const la = lat * RAD, lo = lon * RAD;
  let h = 0, g = null;
  // bngToWgs84 puts the point at height zero on Airy; find the WGS84 height that does too.
  for (let k = 0; k < 4; k++) {
    const w = toCartesian(la, lo, h, WGS_A, WGS_E2);
    const p = apply(MI, [w[0] - T[0], w[1] - T[1], w[2] - T[2]]);
    g = fromCartesian(p[0], p[1], p[2], AIRY_A, AIRY_E2);
    if (Math.abs(g.h) < 1e-6) break;
    h -= g.h;
  }
  const r0 = tmForward(g.lat, g.lon);
  let r = r0;
  for (let k = 0; k < 3; k++) { // make it the inverse of tmInverse, not just the OS series
    const back = tmInverse(r.e, r.n), b = tmForward(back.lat, back.lon);
    r = { e: r.e + (r0.e - b.e), n: r.n + (r0.n - b.n) };
  }
  return { e: r.e + de, n: r.n + dn };
}

// ---- grid references: two letters for the 100 km square, then digits ----

const LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'; // 25 letters, no I

/** 'TQ 30 80' / 'TQ3080' / 'tq 3000 8000' -> { e, n } of the square's south-west corner. */
export function parseGridRef(ref) {
  const s = String(ref ?? '').toUpperCase().replace(/[\s,]+/g, ' ').trim();
  const m = /^([A-HJ-Z])([A-HJ-Z])\s*(\d*)\s*(\d*)$/.exec(s);
  if (!m) throw new Error(`not a grid reference: ${ref}`);
  const l1 = LETTERS.indexOf(m[1]), l2 = LETTERS.indexOf(m[2]);
  const e100 = ((l1 - 2) % 5) * 5 + (l2 % 5);
  const n100 = (19 - Math.floor(l1 / 5) * 5) - Math.floor(l2 / 5);
  let de = m[3], dn = m[4];
  if (!dn) { // run together: split in half
    if (de.length % 2) throw new Error(`odd number of digits: ${ref}`);
    dn = de.slice(de.length / 2); de = de.slice(0, de.length / 2);
  }
  if (de.length !== dn.length || de.length > 5) throw new Error(`unbalanced digits: ${ref}`);
  const pad = (d) => (d ? Number((d + '00000').slice(0, 5)) : 0);
  const e = e100 * 100000 + pad(de), n = n100 * 100000 + pad(dn);
  if (e100 < 0 || e100 > 6 || n100 < 0 || n100 > 12) throw new Error(`square outside the grid: ${ref}`);
  return { e, n };
}

/** { e, n } -> 'TQ 30 80' with `digits` digits in all (0, 2, 4, ... 10). Truncates, as the OS does. */
export function gridRef(e, n, digits = 10) {
  if (!(digits >= 0 && digits <= 10 && digits % 2 === 0)) throw new Error(`digits must be 0..10 and even: ${digits}`);
  if (!(e >= 0 && e < 700000 && n >= 0 && n < 1300000)) throw new Error(`outside the grid: ${e}, ${n}`);
  const e100 = Math.floor(e / 100000), n100 = Math.floor(n / 100000);
  const l1 = (19 - n100) - ((19 - n100) % 5) + Math.floor((e100 + 10) / 5);
  const l2 = ((19 - n100) * 5) % 25 + (e100 % 5);
  const sq = LETTERS[l1] + LETTERS[l2];
  if (digits === 0) return sq;
  const k = digits / 2, div = 10 ** (5 - k);
  const fmt = (v) => String(Math.floor((v % 100000) / div)).padStart(k, '0');
  return `${sq} ${fmt(e)} ${fmt(n)}`;
}
