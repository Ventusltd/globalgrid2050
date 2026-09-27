// Sun and sky pack (world.pack.v1). Self-contained ES module with no imports.
//
// What it does: the sun's position for a place and a moment, a date and time you can scrub or play, the sun's path
// over the day with sunrise, noon and sunset lines, terrain shadow found by ray marching the world's ground, the
// shadow outlines of configured mounting tables, and clear-sky irradiance on the ground and on a tilted plane.
//
// Methods (our own code, written from the publications):
//  - Solar position: I. Reda and A. Andreas, "Solar Position Algorithm for Solar Radiation Applications",
//    NREL/TP-560-34302 (2003, revised 2008). Earth periodic terms (Table A4.2) and nutation terms (Table A4.3) are the
//    published coefficients. Stated uncertainty +/-0.0003 degree for years -2000 to 6000. The tests check the paper's
//    worked example (Table A5.1).
//  - Delta T (TT - UT): F. Espenak and J. Meeus polynomial expressions (2006), 1986-2050; a long-term parabola
//    elsewhere. An error of 10 s in Delta T moves the sun by under 0.0002 degree.
//  - Clear-sky irradiance: P. Ineichen and R. Perez, "A new airmass independent formulation for the Linke turbidity
//    coefficient", Solar Energy 73(3), 151-157 (2002), without its optional high-air-mass enhancement term. Relative
//    air mass: F. Kasten and A. T. Young, Applied Optics 28(22), 4735-4738 (1989). Pressure from altitude: the
//    standard atmosphere of ISO 2533. Solar constant 1361 W/m2 (G. Kopp and J. Lean, Geophysical Research
//    Letters 38, L01706, 2011), scaled by the sun-earth distance from the position algorithm.
//  - Plane of array: beam on the plane plus isotropic sky diffuse and ground reflection (B. Y. H. Liu and
//    R. C. Jordan, Solar Energy 7(2), 53-74, 1963).
//  - Map projection, only when the world's origin is given in EPSG:27700: the transverse Mercator inverse series and
//    a seven-parameter Helmert shift to EPSG:4326, accurate to a few metres, which is far finer than the sun needs.
//
// Everything this pack shows is illustrative: a clear sky is assumed, and clouds, haze, near objects and the world's
// own buildings are not modelled.
//
// World axes: x east, y north (the world's grid north), z up, local metres. Azimuths are degrees clockwise from
// true north unless said otherwise; drawing turns them to grid north by the configured grid convergence.

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const DAY_MS = 86400000, MIN_MS = 60000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const lim360 = a => ((a % 360) + 360) % 360;

// ------------------------------------------------------------------------------------------ SPA tables
// Each row [A, B, C]: term = A * cos(B + C * JME). From NREL/TP-560-34302, Table A4.2.
const L_TERMS = [
  [[175347046, 0, 0], [3341656, 4.6692568, 6283.07585], [34894, 4.6261, 12566.1517], [3497, 2.7441, 5753.3849],
    [3418, 2.8289, 3.5231], [3136, 3.6277, 77713.7715], [2676, 4.4181, 7860.4194], [2343, 6.1352, 3930.2097],
    [1324, 0.7425, 11506.7698], [1273, 2.0371, 529.691], [1199, 1.1096, 1577.3435], [990, 5.233, 5884.927],
    [902, 2.045, 26.298], [857, 3.508, 398.149], [780, 1.179, 5223.694], [753, 2.533, 5507.553],
    [505, 4.583, 18849.228], [492, 4.205, 775.523], [357, 2.92, 0.067], [317, 5.849, 11790.629],
    [284, 1.899, 796.298], [271, 0.315, 10977.079], [243, 0.345, 5486.778], [206, 4.806, 2544.314],
    [205, 1.869, 5573.143], [202, 2.458, 6069.777], [156, 0.833, 213.299], [132, 3.411, 2942.463],
    [126, 1.083, 20.775], [115, 0.645, 0.98], [103, 0.636, 4694.003], [102, 0.976, 15720.839],
    [102, 4.267, 7.114], [99, 6.21, 2146.17], [98, 0.68, 155.42], [86, 5.98, 161000.69],
    [85, 1.3, 6275.96], [85, 3.67, 71430.7], [80, 1.81, 17260.15], [79, 3.04, 12036.46],
    [75, 1.76, 5088.63], [74, 3.5, 3154.69], [74, 4.68, 801.82], [70, 0.83, 9437.76],
    [62, 3.98, 8827.39], [61, 1.82, 7084.9], [57, 2.78, 6286.6], [56, 4.39, 14143.5],
    [56, 3.47, 6279.55], [52, 0.19, 12139.55], [52, 1.33, 1748.02], [51, 0.28, 5856.48],
    [49, 0.49, 1194.45], [41, 5.37, 8429.24], [41, 2.4, 19651.05], [39, 6.17, 10447.39],
    [37, 6.04, 10213.29], [37, 2.57, 1059.38], [36, 1.71, 2352.87], [36, 1.78, 6812.77],
    [33, 0.59, 17789.85], [30, 0.44, 83996.85], [30, 2.74, 1349.87], [25, 3.16, 4690.48]],
  [[628331966747, 0, 0], [206059, 2.678235, 6283.07585], [4303, 2.6351, 12566.1517], [425, 1.59, 3.523],
    [119, 5.796, 26.298], [109, 2.966, 1577.344], [93, 2.59, 18849.23], [72, 1.14, 529.69], [68, 1.87, 398.15],
    [67, 4.41, 5507.55], [59, 2.89, 5223.69], [56, 2.17, 155.42], [45, 0.4, 796.3], [36, 0.47, 775.52],
    [29, 2.65, 7.11], [21, 5.34, 0.98], [19, 1.85, 5486.78], [19, 4.97, 213.3], [17, 2.99, 6275.96],
    [16, 0.03, 2544.31], [16, 1.43, 2146.17], [15, 1.21, 10977.08], [12, 2.83, 1748.02], [12, 3.26, 5088.63],
    [12, 5.27, 1194.45], [12, 2.08, 4694], [11, 0.77, 553.57], [10, 1.3, 6286.6], [10, 4.24, 1349.87],
    [9, 2.7, 242.73], [9, 5.64, 951.72], [8, 5.3, 2352.87], [6, 2.65, 9437.76], [6, 4.67, 4690.48]],
  [[52919, 0, 0], [8720, 1.0721, 6283.0758], [309, 0.867, 12566.152], [27, 0.05, 3.52], [16, 5.19, 26.3],
    [16, 3.68, 155.42], [10, 0.76, 18849.23], [9, 2.06, 77713.77], [7, 0.83, 775.52], [5, 4.66, 1577.34],
    [4, 1.03, 7.11], [4, 3.44, 5573.14], [3, 5.14, 796.3], [3, 6.05, 5507.55], [3, 1.19, 242.73],
    [3, 6.12, 529.69], [3, 0.31, 398.15], [3, 2.28, 553.57], [2, 4.38, 5223.69], [2, 3.75, 0.98]],
  [[289, 5.844, 6283.076], [35, 0, 0], [17, 5.49, 12566.15], [3, 5.2, 155.42], [1, 4.72, 3.52],
    [1, 5.3, 18849.23], [1, 5.97, 242.73]],
  [[114, 3.142, 0], [8, 4.13, 6283.08], [1, 3.84, 12566.15]],
  [[1, 3.14, 0]]
];
const B_TERMS = [
  [[280, 3.199, 84334.662], [102, 5.422, 5507.553], [80, 3.88, 5223.69], [44, 3.7, 2352.87], [32, 4, 1577.34]],
  [[9, 3.9, 5507.55], [6, 1.73, 5223.69]]
];
const R_TERMS = [
  [[100013989, 0, 0], [1670700, 3.0984635, 6283.07585], [13956, 3.05525, 12566.1517], [3084, 5.1985, 77713.7715],
    [1628, 1.1739, 5753.3849], [1576, 2.8469, 7860.4194], [925, 5.453, 11506.77], [542, 4.564, 3930.21],
    [472, 3.661, 5884.927], [346, 0.964, 5507.553], [329, 5.9, 5223.694], [307, 0.299, 5573.143],
    [243, 4.273, 11790.629], [212, 5.847, 1577.344], [186, 5.022, 10977.079], [175, 3.012, 18849.228],
    [110, 5.055, 5486.778], [98, 0.89, 6069.78], [86, 5.69, 15720.84], [86, 1.27, 161000.69],
    [65, 0.27, 17260.15], [63, 0.92, 529.69], [57, 2.01, 83996.85], [56, 5.24, 71430.7], [49, 3.25, 2544.31],
    [47, 2.58, 775.52], [45, 5.54, 9437.76], [43, 6.01, 6275.96], [39, 5.36, 4694], [38, 2.39, 8827.39],
    [37, 0.83, 19651.05], [37, 4.9, 12139.55], [36, 1.67, 12036.46], [35, 1.84, 2942.46], [33, 0.24, 7084.9],
    [32, 0.18, 5088.63], [32, 1.78, 398.15], [28, 1.21, 6286.6], [28, 1.9, 6279.55], [26, 4.59, 10447.39]],
  [[103019, 1.10749, 6283.07585], [1721, 1.0644, 12566.1517], [702, 3.142, 0], [32, 1.02, 18849.23],
    [31, 2.84, 5507.55], [25, 1.32, 5223.69], [18, 1.42, 1577.34], [10, 5.91, 10977.08], [9, 1.42, 6275.96],
    [9, 0.27, 5486.78]],
  [[4359, 5.7846, 6283.0758], [124, 5.579, 12566.152], [12, 3.14, 0], [9, 3.63, 77713.77], [6, 1.87, 5573.14],
    [3, 5.47, 18849.23]],
  [[145, 4.273, 6283.076], [7, 3.92, 12566.15]],
  [[4, 2.56, 6283.08]]
];
// Nutation, Table A4.3: multipliers of X0..X4, then [a, b, c, d] for psi = (a + b JCE) sin, eps = (c + d JCE) cos.
const Y_TERMS = [
  [0, 0, 0, 0, 1], [-2, 0, 0, 2, 2], [0, 0, 0, 2, 2], [0, 0, 0, 0, 2], [0, 1, 0, 0, 0], [0, 0, 1, 0, 0],
  [-2, 1, 0, 2, 2], [0, 0, 0, 2, 1], [0, 0, 1, 2, 2], [-2, -1, 0, 2, 2], [-2, 0, 1, 0, 0], [-2, 0, 0, 2, 1],
  [0, 0, -1, 2, 2], [2, 0, 0, 0, 0], [0, 0, 1, 0, 1], [2, 0, -1, 2, 2], [0, 0, -1, 0, 1], [0, 0, 1, 2, 1],
  [-2, 0, 2, 0, 0], [0, 0, -2, 2, 1], [2, 0, 0, 2, 2], [0, 0, 2, 2, 2], [0, 0, 2, 0, 0], [-2, 0, 1, 2, 2],
  [0, 0, 0, 2, 0], [-2, 0, 0, 2, 0], [0, 0, -1, 2, 1], [0, 2, 0, 0, 0], [2, 0, -1, 0, 1], [-2, 2, 0, 2, 2],
  [0, 1, 0, 0, 1], [-2, 0, 1, 0, 1], [0, -1, 0, 0, 1], [0, 0, 2, -2, 0], [2, 0, -1, 2, 1], [2, 0, 1, 2, 2],
  [0, 1, 0, 2, 2], [-2, 1, 1, 0, 0], [0, -1, 0, 2, 2], [2, 0, 0, 2, 1], [2, 0, 1, 0, 0], [-2, 0, 2, 2, 2],
  [-2, 0, 1, 2, 1], [2, 0, -2, 0, 1], [2, 0, 0, 0, 1], [0, -1, 1, 0, 0], [-2, -1, 0, 2, 1], [-2, 0, 0, 0, 1],
  [0, 0, 2, 2, 1], [-2, 0, 2, 0, 1], [-2, 1, 0, 2, 1], [0, 0, 1, -2, 0], [-1, 0, 1, 0, 0], [-2, 1, 0, 0, 0],
  [1, 0, 0, 0, 0], [0, 0, 1, 2, 0], [0, 0, -2, 2, 2], [-1, -1, 1, 0, 0], [0, 1, 1, 0, 0], [0, -1, 1, 2, 2],
  [2, -1, -1, 2, 2], [0, 0, 3, 2, 2], [2, -1, 0, 2, 2]
];
const PE_TERMS = [
  [-171996, -174.2, 92025, 8.9], [-13187, -1.6, 5736, -3.1], [-2274, -0.2, 977, -0.5], [2062, 0.2, -895, 0.5],
  [1426, -3.4, 54, -0.1], [712, 0.1, -7, 0], [-517, 1.2, 224, -0.6], [-386, -0.4, 200, 0], [-301, 0, 129, -0.1],
  [217, -0.5, -95, 0.3], [-158, 0, 0, 0], [129, 0.1, -70, 0], [123, 0, -53, 0], [63, 0, 0, 0], [63, 0.1, -33, 0],
  [-59, 0, 26, 0], [-58, -0.1, 32, 0], [-51, 0, 27, 0], [48, 0, 0, 0], [46, 0, -24, 0], [-38, 0, 16, 0],
  [-31, 0, 13, 0], [29, 0, 0, 0], [29, 0, -12, 0], [26, 0, 0, 0], [-22, 0, 0, 0], [21, 0, -10, 0],
  [17, -0.1, 0, 0], [16, 0, -8, 0], [-16, 0.1, 7, 0], [-15, 0, 9, 0], [-13, 0, 7, 0], [-12, 0, 6, 0],
  [11, 0, 0, 0], [-10, 0, 5, 0], [-8, 0, 3, 0], [7, 0, -3, 0], [-7, 0, 0, 0], [-7, 0, 3, 0], [-7, 0, 3, 0],
  [6, 0, 0, 0], [6, 0, -3, 0], [6, 0, -3, 0], [-6, 0, 3, 0], [-6, 0, 3, 0], [5, 0, 0, 0], [-5, 0, 3, 0],
  [-5, 0, 3, 0], [-5, 0, 3, 0], [4, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0], [-4, 0, 0, 0], [-4, 0, 0, 0],
  [-4, 0, 0, 0], [3, 0, 0, 0], [-3, 0, 0, 0], [-3, 0, 0, 0], [-3, 0, 0, 0], [-3, 0, 0, 0], [-3, 0, 0, 0],
  [-3, 0, 0, 0], [-3, 0, 0, 0]
];

// ------------------------------------------------------------------------------------------ solar position
export const julianDay = ms => ms / DAY_MS + 2440587.5;

// Delta T in seconds for a decimal year (Espenak and Meeus 2006; 1986-2050 polynomials, long-term parabola outside).
export function deltaT(year) {
  if (year >= 2005 && year < 2050) { const t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  if (year >= 1986 && year < 2005) {
    const t = year - 2000;
    return 63.86 + t * (0.3345 + t * (-0.060374 + t * (0.0017275 + t * (0.000651814 + t * 0.00002373599))));
  }
  const u = (year - 1820) / 100;
  if (year >= 2050 && year < 2150) return -20 + 32 * u * u - 0.5628 * (2150 - year);
  return -20 + 32 * u * u;
}

const series = (rows, x) => { let s = 0; for (const [a, b, c] of rows) s += a * Math.cos(b + c * x); return s; };
const periodic = (terms, jme) => { let s = 0, p = 1; for (const rows of terms) { s += series(rows, jme) * p; p *= jme; } return s / 1e8; };

// Topocentric solar position (NREL/TP-560-34302, section 3). Inputs: utcMs, lat and lon (degrees, east positive),
// elevation (m), pressure (hPa), temperature (C), deltaT (s, optional). Returns degrees unless named otherwise:
// zenith and elevation with refraction, trueElevation without, azimuth clockwise from north, declination, hourAngle,
// the earth-sun distance r (AU), julianDay, and the steps the paper tabulates (L, B, R, dPsi, dEps, eps, alpha, delta).
export function solarPosition({ utcMs, lat, lon, elevation = 0, pressure = 1010, temperature = 10, deltaT: dT, refraction = true }) {
  if (![utcMs, lat, lon].every(Number.isFinite)) throw Error('solar position needs a finite time, latitude and longitude');
  if (Math.abs(lat) > 90) throw Error(`latitude ${lat} is outside -90 to 90`);
  const jd = julianDay(utcMs);
  const year = 2000 + (jd - 2451544.5) / 365.2425;
  const dt = Number.isFinite(dT) ? dT : deltaT(year);
  const jde = jd + dt / 86400, jc = (jd - 2451545) / 36525, jce = (jde - 2451545) / 36525, jme = jce / 10;

  const L = lim360(periodic(L_TERMS, jme) * DEG), B = periodic(B_TERMS, jme) * DEG, R = periodic(R_TERMS, jme);
  const theta = lim360(L + 180), beta = -B;

  const X = [
    297.85036 + jce * (445267.111480 + jce * (-0.0019142 + jce / 189474)),
    357.52772 + jce * (35999.050340 + jce * (-0.0001603 - jce / 300000)),
    134.96298 + jce * (477198.867398 + jce * (0.0086972 + jce / 56250)),
    93.27191 + jce * (483202.017538 + jce * (-0.0036825 + jce / 327270)),
    125.04452 + jce * (-1934.136261 + jce * (0.0020708 + jce / 450000))
  ];
  let sp = 0, se = 0;
  for (let i = 0; i < Y_TERMS.length; i++) {
    const y = Y_TERMS[i], arg = (y[0] * X[0] + y[1] * X[1] + y[2] * X[2] + y[3] * X[3] + y[4] * X[4]) * RAD, p = PE_TERMS[i];
    sp += (p[0] + p[1] * jce) * Math.sin(arg);
    se += (p[2] + p[3] * jce) * Math.cos(arg);
  }
  const dPsi = sp / 36000000, dEps = se / 36000000;
  const U = jme / 10;
  const eps0 = 84381.448 + U * (-4680.93 + U * (-1.55 + U * (1999.25 + U * (-51.38 + U * (-249.67 + U * (-39.05 + U * (7.12 + U * (27.87 + U * (5.79 + U * 2.45)))))))));
  const eps = eps0 / 3600 + dEps;
  const lambda = theta + dPsi - 20.4898 / (3600 * R);
  const nu0 = lim360(280.46061837 + 360.98564736629 * (jd - 2451545) + jc * jc * (0.000387933 - jc / 38710000));
  const nu = nu0 + dPsi * Math.cos(eps * RAD);
  const lr = lambda * RAD, er = eps * RAD, br = beta * RAD;
  const alpha = lim360(Math.atan2(Math.sin(lr) * Math.cos(er) - Math.tan(br) * Math.sin(er), Math.cos(lr)) * DEG);
  const delta = Math.asin(Math.sin(br) * Math.cos(er) + Math.cos(br) * Math.sin(er) * Math.sin(lr)) * DEG;
  const H = lim360(nu + lon - alpha);

  // Topocentric parallax.
  const xi = (8.794 / (3600 * R)) * RAD, phi = lat * RAD, u = Math.atan(0.99664719 * Math.tan(phi));
  const x = Math.cos(u) + (elevation / 6378140) * Math.cos(phi), y = 0.99664719 * Math.sin(u) + (elevation / 6378140) * Math.sin(phi);
  const Hr = H * RAD, dr = delta * RAD;
  const dAlpha = Math.atan2(-x * Math.sin(xi) * Math.sin(Hr), Math.cos(dr) - x * Math.sin(xi) * Math.cos(Hr));
  const deltaP = Math.atan2((Math.sin(dr) - y * Math.sin(xi)) * Math.cos(dAlpha), Math.cos(dr) - x * Math.sin(xi) * Math.cos(Hr));
  const Hp = Hr - dAlpha;
  const e0 = Math.asin(Math.sin(phi) * Math.sin(deltaP) + Math.cos(phi) * Math.cos(deltaP) * Math.cos(Hp)) * DEG;
  const de = refraction && e0 >= -(0.26667 + 0.5667)
    ? (pressure / 1010) * (283 / (273 + temperature)) * 1.02 / (60 * Math.tan((e0 + 10.3 / (e0 + 5.11)) * RAD)) : 0;
  const el = e0 + de;
  const gamma = Math.atan2(Math.sin(Hp), Math.cos(Hp) * Math.sin(phi) - Math.tan(deltaP) * Math.cos(phi)) * DEG;
  return {
    zenith: 90 - el, elevation: el, trueElevation: e0, azimuth: lim360(gamma + 180),
    declination: deltaP * DEG, hourAngle: ((Hp * DEG + 540) % 360) - 180, r: R, julianDay: jd, deltaT: dt,
    L, B, R, dPsi, dEps, eps, alpha, delta, geocentricHourAngle: H
  };
}

// Angle of incidence (degrees) of the sun on a plane of tilt (degrees from horizontal) facing azimuth (true, from north).
export function incidence(zenith, azimuth, tilt, planeAzimuth) {
  const c = Math.cos(zenith * RAD) * Math.cos(tilt * RAD) + Math.sin(tilt * RAD) * Math.sin(zenith * RAD) * Math.cos((azimuth - planeAzimuth) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

// Unit vector towards the sun: x east, y north, z up. rotate (degrees) turns true azimuth to the drawing's north.
export function sunVector(azimuth, elevation, rotate = 0) {
  const a = (azimuth - rotate) * RAD, e = elevation * RAD;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}

// ------------------------------------------------------------------------------------------ clear sky
// Kasten and Young (1989) relative air mass for an apparent zenith in degrees (NaN at or below the horizon).
export function airMass(zenith) {
  if (!(zenith < 90)) return NaN;
  return 1 / (Math.cos(zenith * RAD) + 0.50572 * (96.07995 - zenith) ** -1.6364);
}
// Standard atmosphere pressure (Pa) at an altitude (m), ISO 2533 troposphere.
export const pressureAt = h => 101325 * (1 - 2.25577e-5 * h) ** 5.25588;

// Ineichen and Perez (2002) clear-sky irradiance, W/m2: { ghi, dni, dhi }. zenith is apparent (degrees),
// altitude in metres, linke is the Linke turbidity (about 2 very clean to 6 hazy), r the earth-sun distance (AU).
export function clearSky(zenith, { altitude = 0, linke = 3, r = 1, solarConstant = 1361 } = {}) {
  const cz = Math.cos(zenith * RAD);
  if (!(zenith < 90) || cz <= 0) return { ghi: 0, dni: 0, dhi: 0, airMass: NaN };
  const am = airMass(zenith) * pressureAt(altitude) / 101325;
  const i0 = solarConstant / (r * r);
  const fh1 = Math.exp(-altitude / 8000), fh2 = Math.exp(-altitude / 1250);
  const cg1 = 5.09e-5 * altitude + 0.868, cg2 = 3.92e-5 * altitude + 0.0387;
  const ghi = Math.max(0, cg1 * i0 * cz * Math.exp(-cg2 * am * (fh1 + fh2 * (linke - 1))));
  const b = 0.664 + 0.163 / fh1;
  const bnci = i0 * Math.max(0, b * Math.exp(-0.09 * am * (linke - 1)));
  const bnci2 = ghi * Math.min(Math.max((1 - (0.1 - 0.2 * Math.exp(-linke)) / (0.1 + 0.882 / fh1)) / cz, 0), 1e20);
  const dni = Math.min(bnci, bnci2);
  return { ghi, dni, dhi: Math.max(0, ghi - dni * cz), airMass: am };
}

// Irradiance on a plane (W/m2) from its parts: beam, isotropic sky diffuse, and ground reflection (Liu and Jordan 1963).
export function planeIrradiance({ ghi, dni, dhi }, incidenceDeg, tilt, albedo = 0.2) {
  const beam = dni * Math.max(0, Math.cos(incidenceDeg * RAD)), ct = Math.cos(tilt * RAD);
  const sky = dhi * (1 + ct) / 2, ground = ghi * albedo * (1 - ct) / 2;
  return { poa: beam + sky + ground, beam, sky, ground };
}

// ------------------------------------------------------------------------------------------ EPSG:27700 -> EPSG:4326
// Transverse Mercator inverse on the grid's ellipsoid; returns { lat, lon } in degrees on that ellipsoid.
export function tmInverse(E, N) {
  const a = 6377563.396, b = 6356256.909, F0 = 0.9996012717, phi0 = 49 * RAD, lam0 = -2 * RAD, N0 = -100000, E0 = 400000;
  const e2 = 1 - (b * b) / (a * a), n = (a - b) / (a + b), n2 = n * n, n3 = n2 * n;
  const M = p => b * F0 * ((1 + n + 1.25 * n2 + 1.25 * n3) * (p - phi0)
    - (3 * n + 3 * n2 + 2.625 * n3) * Math.sin(p - phi0) * Math.cos(p + phi0)
    + (1.875 * n2 + 1.875 * n3) * Math.sin(2 * (p - phi0)) * Math.cos(2 * (p + phi0))
    - (35 / 24) * n3 * Math.sin(3 * (p - phi0)) * Math.cos(3 * (p + phi0)));
  let p = (N - N0) / (a * F0) + phi0;
  for (let k = 0; k < 20 && Math.abs(N - N0 - M(p)) >= 1e-5; k++) p += (N - N0 - M(p)) / (a * F0);
  const s = Math.sin(p), t = Math.tan(p), t2 = t * t, t4 = t2 * t2, sec = 1 / Math.cos(p);
  const nu = a * F0 / Math.sqrt(1 - e2 * s * s), rho = a * F0 * (1 - e2) / (1 - e2 * s * s) ** 1.5, eta2 = nu / rho - 1;
  const d = E - E0;
  const VII = t / (2 * rho * nu), VIII = t / (24 * rho * nu ** 3) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2);
  const IX = t / (720 * rho * nu ** 5) * (61 + 90 * t2 + 45 * t4);
  const X = sec / nu, XI = sec / (6 * nu ** 3) * (nu / rho + 2 * t2), XII = sec / (120 * nu ** 5) * (5 + 28 * t2 + 24 * t4);
  const XIIA = sec / (5040 * nu ** 7) * (61 + 662 * t2 + 1320 * t4 + 720 * t4 * t2);
  return {
    lat: (p - VII * d ** 2 + VIII * d ** 4 - IX * d ** 6) * DEG,
    lon: (lam0 + X * d - XI * d ** 3 + XII * d ** 5 - XIIA * d ** 7) * DEG
  };
}
// Grid easting and northing (EPSG:27700) to latitude and longitude (EPSG:4326), a few metres accuracy.
export function gridToLatLon(E, N) {
  const g = tmInverse(E, N), p = g.lat * RAD, l = g.lon * RAD;
  const a1 = 6377563.396, b1 = 6356256.909, e1 = 1 - (b1 * b1) / (a1 * a1), nu1 = a1 / Math.sqrt(1 - e1 * Math.sin(p) ** 2);
  const x1 = nu1 * Math.cos(p) * Math.cos(l), y1 = nu1 * Math.cos(p) * Math.sin(l), z1 = (1 - e1) * nu1 * Math.sin(p);
  const tx = 446.448, ty = -125.157, tz = 542.060, sc = -20.4894e-6;
  const rx = (0.1502 / 3600) * RAD, ry = (0.2470 / 3600) * RAD, rz = (0.8421 / 3600) * RAD;
  const x2 = tx + (1 + sc) * x1 - rz * y1 + ry * z1, y2 = ty + rz * x1 + (1 + sc) * y1 - rx * z1, z2 = tz - ry * x1 + rx * y1 + (1 + sc) * z1;
  const a2 = 6378137, b2 = 6356752.3142, e2 = 1 - (b2 * b2) / (a2 * a2), pr = Math.hypot(x2, y2);
  let lat = Math.atan2(z2, pr * (1 - e2));
  for (let k = 0; k < 10; k++) lat = Math.atan2(z2 + e2 * (a2 / Math.sqrt(1 - e2 * Math.sin(lat) ** 2)) * Math.sin(lat), pr);
  return { lat: lat * DEG, lon: Math.atan2(y2, x2) * DEG };
}

// ------------------------------------------------------------------------------------------ time
// Local time is UTC plus a fixed offset (utcOffset hours), or a named time zone when the host offers Intl.
function makeClock(cfg) {
  const zone = typeof cfg.timeZone === 'string' ? cfg.timeZone : null;
  let fmt = null;
  if (zone && typeof Intl !== 'undefined') {
    try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); } catch { fmt = null; }
  }
  const fixed = Number.isFinite(cfg.utcOffset) ? cfg.utcOffset * 60 : null;
  const offset = ms => {
    if (fmt) {
      const p = {};
      for (const { type, value } of fmt.formatToParts(new Date(ms))) p[type] = +value;
      const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
      return Math.round((wall - Math.floor(ms / 1000) * 1000) / MIN_MS);
    }
    return fixed ?? 0;
  };
  const parts = ms => {
    const off = offset(ms), d = new Date(ms + off * MIN_MS);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), minute: d.getUTCHours() * 60 + d.getUTCMinutes(), off };
  };
  const toUtc = (y, m, d, minute) => {
    const wall = Date.UTC(y, m - 1, d, 0, minute);
    let t = wall - offset(wall) * MIN_MS;
    return wall - offset(t) * MIN_MS;
  };
  const label = off => (off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : '-'}${Math.floor(Math.abs(off) / 60)}${Math.abs(off) % 60 ? ':' + String(Math.abs(off) % 60).padStart(2, '0') : ''}`);
  return { offset, parts, toUtc, label };
}
const mon = m => MONTHS[m - 1][0].toUpperCase() + MONTHS[m - 1].slice(1);
const hhmm = minute => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}`;

// Sunrise, solar noon and sunset for the local day containing ms: UTC ms or null (polar day or night).
// Rise and set are where the topocentric true elevation crosses -0.8333 degree (upper limb with standard refraction);
// scanned at 10 minutes and refined by bisection to one second. Noon is where the local hour angle crosses zero.
export function dayEvents(place, dayStartMs, dayEndMs) {
  const el = t => solarPosition({ ...place, utcMs: t, refraction: false }).trueElevation + 0.8333;
  const ha = t => solarPosition({ ...place, utcMs: t, refraction: false }).hourAngle;
  const bisect = (f, a, b) => { let fa = f(a); for (let k = 0; k < 24 && b - a > 1000; k++) { const m = (a + b) / 2, fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; } return Math.round((a + b) / 2); };
  let rise = null, set = null, noon = null, maxEl = -90;
  const step = 10 * MIN_MS;
  let t0 = dayStartMs, e0 = el(t0), h0 = ha(t0);
  maxEl = Math.max(maxEl, e0);
  for (let t1 = t0 + step; t0 < dayEndMs; t0 = t1, t1 += step) {
    const t = Math.min(t1, dayEndMs), e1 = el(t), h1 = ha(t);
    maxEl = Math.max(maxEl, e1);
    if (rise === null && e0 <= 0 && e1 > 0) rise = bisect(el, t0, t);
    if (set === null && e0 > 0 && e1 <= 0) set = bisect(el, t0, t);
    if (noon === null && h0 < 0 && h1 >= 0 && h1 - h0 < 90) noon = bisect(ha, t0, t);
    e0 = e1; h0 = h1;
  }
  return { rise, noon, set, polar: rise === null && set === null ? (maxEl > 0 ? 'day' : 'night') : null };
}

// ------------------------------------------------------------------------------------------ the pack
const COLOURS = {
  ray: [1, 0.86, 0.35, 0.95], path: [1, 0.72, 0.25, 0.7], ticks: [1, 0.72, 0.25, 0.9],
  rise: [1, 0.55, 0.3, 0.9], noon: [1, 0.9, 0.5, 0.9], set: [0.85, 0.4, 0.55, 0.9],
  shade: [0.2, 0.28, 0.55, 0.85], table: [0.55, 0.8, 1, 0.9], tableShade: [0.25, 0.3, 0.6, 0.9]
};
const DEFAULTS = Object.freeze({
  lat: 52, lon: 0, elevation: 0, utcOffset: 0, linkeTurbidity: 3, albedo: 0.2, pressure: 1010, temperature: 10,
  plane: { tilt: 30, azimuth: 180 }, pathRadius: 60, groundLine: 40, shadowGrid: 24, shadowSpacing: 8, shadowReach: 400,
  maxTables: 64, gridConvergence: 0, start: { year: 2026, month: 6, day: 21, minute: 720 }
});

let S = null;

function num(v, d) { return Number.isFinite(v) ? v : d; }

function setup(api) {
  const c = api?.config || {};
  const s = {
    api, on: true, playing: false, rate: 60, // minutes of sun time per second of simulation time
    lat: DEFAULTS.lat, lon: DEFAULTS.lon, located: false,
    elevation: num(c.elevation, DEFAULTS.elevation), pressure: num(c.pressure, DEFAULTS.pressure),
    temperature: num(c.temperature, DEFAULTS.temperature), deltaT: Number.isFinite(c.deltaT) ? c.deltaT : undefined,
    linke: num(c.linkeTurbidity, DEFAULTS.linkeTurbidity), albedo: num(c.albedo, DEFAULTS.albedo),
    plane: { tilt: num(c.plane?.tilt, DEFAULTS.plane.tilt), azimuth: num(c.plane?.azimuth, DEFAULTS.plane.azimuth) },
    convergence: num(c.gridConvergence, DEFAULTS.gridConvergence), crs: c.crs === 'EPSG:27700' ? c.crs : null,
    clock: makeClock({ utcOffset: num(c.utcOffset, DEFAULTS.utcOffset), timeZone: c.timeZone }),
    grid: Math.max(4, Math.min(36, Math.round(num(c.shadowGrid, DEFAULTS.shadowGrid)))),
    spacing: Math.max(1, num(c.shadowSpacing, DEFAULTS.shadowSpacing)), reach: Math.max(20, num(c.shadowReach, DEFAULTS.shadowReach)),
    tables: [], utcMs: 0, sun: null, sunAt: NaN, day: null, dayKey: '', cache: new Map(), lastEmitMin: NaN, offs: []
  };
  if (Number.isFinite(c.lat) && Number.isFinite(c.lon)) { s.lat = c.lat; s.lon = c.lon; s.located = true; }
  else if (s.crs) locateFromOrigin(s, api?.origin?.());
  if (Array.isArray(c.tables)) {
    for (const t of c.tables.slice(0, DEFAULTS.maxTables)) {
      if (!t || ![t.x, t.y].every(Number.isFinite)) continue;
      s.tables.push({ x: t.x, y: t.y, length: num(t.length, 20), width: num(t.width, 4), tilt: num(t.tilt, 20), azimuth: num(t.azimuth, 180), height: num(t.height, 0.8) });
    }
  }
  if (Number.isFinite(c.utcMs)) s.utcMs = Math.round(c.utcMs);
  else {
    const st = DEFAULTS.start;
    s.utcMs = s.clock.toUtc(st.year, st.month, st.day, st.minute);
  }
  return s;
}

function locateFromOrigin(s, o) {
  if (!o || !Number.isFinite(o.e) || !Number.isFinite(o.n) || o.e < -1e5 || o.e > 8e5 || o.n < -2e5 || o.n > 1.4e6) return false;
  const g = gridToLatLon(o.e, o.n);
  s.lat = g.lat; s.lon = g.lon; s.located = true;
  if (!Number.isFinite(s.api?.config?.gridConvergence)) s.convergence = (s.lon + 2) * Math.sin(s.lat * RAD); // first-order grid convergence
  s.sunAt = NaN; s.dayKey = '';
  return true;
}

const place = s => ({ lat: s.lat, lon: s.lon, elevation: s.elevation, pressure: s.pressure, temperature: s.temperature, deltaT: s.deltaT });

function sunNow(s) {
  if (s.sunAt !== s.utcMs || !s.sun) {
    const p = solarPosition({ ...place(s), utcMs: s.utcMs });
    const sky = clearSky(p.zenith, { altitude: s.elevation, linke: s.linke, r: p.r });
    const inc = incidence(p.zenith, p.azimuth, s.plane.tilt, s.plane.azimuth);
    s.sun = { ...p, sky, incidence: inc, plane: planeIrradiance(sky, inc, s.plane.tilt, s.albedo), dir: sunVector(p.azimuth, p.elevation, s.convergence) };
    s.sunAt = s.utcMs;
  }
  return s.sun;
}

function dayNow(s) {
  const p = s.clock.parts(s.utcMs), key = `${p.year}-${p.month}-${p.day}@${s.lat},${s.lon}`;
  if (key !== s.dayKey) {
    const start = s.clock.toUtc(p.year, p.month, p.day, 0), end = s.clock.toUtc(p.year, p.month, p.day, 1440);
    s.day = { ...dayEvents(place(s), start, end), start, end };
    s.dayKey = key;
  }
  return s.day;
}

function emitSun(s) {
  const m = Math.floor(s.utcMs / MIN_MS);
  if (m === s.lastEmitMin || !s.api?.events) return;
  s.lastEmitMin = m;
  const sun = sunNow(s);
  try {
    s.api.events.emit('position', { utcMs: s.utcMs, azimuth: sun.azimuth, elevation: sun.elevation, direction: sun.dir, up: sun.elevation > 0 });
    s.api.events.emit('irradiance', { ghi: sun.sky.ghi, dni: sun.sky.dni, dhi: sun.sky.dhi, poa: sun.plane.poa, tilt: s.plane.tilt, azimuth: s.plane.azimuth, illustrative: true });
  } catch (e) { s.api.log?.('sun: ' + (e?.message || e)); }
}

// True when a ray from p towards the sun meets the ground within reach.
function shaded(heightAt, p, dir, reach) {
  if (dir[2] <= 0) return true;
  for (let t = 1; t < reach; t *= 1.18) {
    const x = p[0] + dir[0] * t, y = p[1] + dir[1] * t, z = p[2] + dir[2] * t, g = heightAt(x, y);
    if (Number.isFinite(g) && g > z) return true;
    if (z > 3000) return false;
  }
  return false;
}
// Where a ray from p away from the sun meets the ground (the shadow of p), or null beyond reach.
function shadowPoint(heightAt, p, dir, reach) {
  if (dir[2] <= 0.01) return null;
  const at = t => [p[0] - dir[0] * t, p[1] - dir[1] * t, p[2] - dir[2] * t];
  const above = t => { const q = at(t), g = heightAt(q[0], q[1]); return !Number.isFinite(g) || q[2] > g; };
  let a = 0, b = 0.25;
  while (b < reach && above(b)) { a = b; b *= 1.3; }
  if (b >= reach) return null;
  for (let k = 0; k < 20; k++) { const m = (a + b) / 2; if (above(m)) a = m; else b = m; }
  return at(b);
}

// Keeps one batch per key and rebuilds it only when its version changes, so the world keeps the GPU buffer.
// An empty result is remembered too, so a quiet batch costs nothing per frame.
function cached(s, key, version, build) {
  const hit = s.cache.get(key);
  if (hit && hit.version === version) return hit.batch;
  const b = build();
  const batch = b ? { key, version, ...b } : null;
  s.cache.set(key, { version, batch });
  return batch;
}

function buildLines(s, ctx) {
  const heightAt = typeof ctx?.heightAt === 'function' ? ctx.heightAt : () => 0;
  const pos = Array.isArray(ctx?.pos) ? ctx.pos : [0, 0, 0];
  const snap = s.spacing * 4, ax = Math.round(pos[0] / snap) * snap, ay = Math.round(pos[1] / snap) * snap;
  const gz = heightAt(ax, ay), az = Number.isFinite(gz) ? gz : 0;
  const origin = [ax, ay, az], gv = ctx?.groundVersion ?? 0;
  const sun = sunNow(s), day = dayNow(s), R = DEFAULTS.pathRadius, conv = s.convergence;
  const out = [];
  const anchor = `${ax},${ay},${az}`;

  // Sun ray from the anchor, when up.
  if (sun.elevation > -0.8333) {
    out.push(cached(s, 'ray', `${anchor}@${s.utcMs}`, () => ({ origin, color: COLOURS.ray,
      positions: new Float32Array([0, 0, 0, sun.dir[0] * R * 1.2, sun.dir[1] * R * 1.2, sun.dir[2] * R * 1.2]) })));
  }
  // The day's path on a dome of radius R (above-horizon parts), with hour ticks.
  out.push(cached(s, 'path', `${anchor}@${s.dayKey}`, () => {
    const seg = [], tick = [];
    let prev = null;
    for (let k = 0; k <= 96; k++) {
      const t = day.start + (day.end - day.start) * k / 96, p = solarPosition({ ...place(s), utcMs: t });
      const v = sunVector(p.azimuth, p.elevation, conv).map(c => c * R);
      if (prev && (p.elevation > 0 || prev.el > 0)) seg.push(...prev.v, ...v);
      if (k % 4 === 0 && p.elevation > 0) tick.push(...v, v[0] * 1.06, v[1] * 1.06, v[2] * 1.06);
      prev = { v, el: p.elevation };
    }
    return seg.length ? { origin, color: COLOURS.path, positions: new Float32Array([...seg, ...tick]) } : null;
  }));
  // Sunrise, noon and sunset directions on the ground.
  for (const [name, t] of [['rise', day.rise], ['noon', day.noon], ['set', day.set]]) {
    if (t === null) continue;
    out.push(cached(s, name, `${anchor}@${t}`, () => {
      const p = solarPosition({ ...place(s), utcMs: t }), v = sunVector(p.azimuth, 0, conv), L = DEFAULTS.groundLine;
      const ex = v[0] * L, ey = v[1] * L, gz2 = heightAt(ax + ex, ay + ey);
      return { origin, color: COLOURS[name], positions: new Float32Array([0, 0, 0.3, ex, ey, (Number.isFinite(gz2) ? gz2 - az : 0) + 0.3]) };
    }));
  }
  // Terrain shadow: a cross at each grid node that cannot see the sun.
  // While playing, the shadow is recomputed every 5 minutes of sun time rather than every step (it is the costly part).
  const shadeMs = s.playing ? Math.floor(s.utcMs / 300000) * 300000 : s.utcMs;
  const shadeSun = shadeMs === s.utcMs ? sun : solarPosition({ ...place(s), utcMs: shadeMs });
  const shadeDir = shadeMs === s.utcMs ? sun.dir : sunVector(shadeSun.azimuth, shadeSun.elevation, conv);
  if (shadeSun.elevation > 0) {
    out.push(cached(s, 'shade', `${anchor}@${shadeMs}@${gv}`, () => {
      const n = s.grid, sp = s.spacing, half = (n - 1) / 2, c = sp * 0.3, seg = [];
      let count = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = ax + (i - half) * sp, y = ay + (j - half) * sp, g = heightAt(x, y);
        if (!Number.isFinite(g)) continue;
        if (shaded(heightAt, [x, y, g + 0.05], shadeDir, s.reach)) {
          count++;
          const lx = x - ax, ly = y - ay, lz = g - az + 0.08;
          seg.push(lx - c, ly - c, lz, lx + c, ly + c, lz, lx - c, ly + c, lz, lx + c, ly - c, lz);
        }
      }
      s.shadeCount = count; s.shadeTotal = n * n;
      return seg.length ? { origin, color: COLOURS.shade, positions: new Float32Array(seg) } : null;
    }));
  } else { s.shadeCount = 0; s.shadeTotal = 0; }
  // Mounting tables from the world's config: outline and, in sun, the shadow outline on the ground.
  if (s.tables.length) {
    const corners = tableCorners(s, heightAt);
    out.push(cached(s, 'tables', `${gv}`, () => {
      const seg = [];
      for (const q of corners) for (let k = 0; k < 4; k++) seg.push(...q[k], ...q[(k + 1) % 4]);
      return { color: COLOURS.table, positions: new Float32Array(seg) };
    }));
    if (sun.elevation > 0) {
      out.push(cached(s, 'table-shadows', `${s.utcMs}@${gv}`, () => {
        const seg = [];
        for (const q of corners) {
          const sh = q.map(c => shadowPoint(heightAt, c, sun.dir, s.reach));
          if (sh.some(v => !v)) continue;
          for (let k = 0; k < 4; k++) seg.push(...sh[k].map((v, i) => i === 2 ? v + 0.05 : v), ...sh[(k + 1) % 4].map((v, i) => i === 2 ? v + 0.05 : v));
        }
        return seg.length ? { color: COLOURS.tableShade, positions: new Float32Array(seg) } : null;
      }));
    }
  }
  return out.filter(Boolean);
}

// Corners of each table in world axes: long edge across the facing direction, the plane rising away from it.
function tableCorners(s, heightAt) {
  if (s.cornersFor === heightAt && s.corners) return s.corners;
  s.corners = s.tables.map(t => {
    const a = (t.azimuth - s.convergence) * RAD, f = [Math.sin(a), Math.cos(a)], r = [Math.cos(a), -Math.sin(a)];
    const g = heightAt(t.x, t.y), z = Number.isFinite(g) ? g : 0, run = t.width * Math.cos(t.tilt * RAD) / 2, rise = t.width * Math.sin(t.tilt * RAD);
    const L = t.length / 2;
    const P = (u, v, h) => [t.x + r[0] * u + f[0] * v, t.y + r[1] * u + f[1] * v, z + h];
    return [P(-L, run, t.height), P(L, run, t.height), P(L, -run, t.height + rise), P(-L, -run, t.height + rise)];
  });
  s.cornersFor = heightAt;
  return s.corners;
}

// ------------------------------------------------------------------------------------------ commands
function parseWhen(s, args) {
  const now = s.clock.parts(s.utcMs);
  let { year, month, day, minute } = now, dateSet = false, timeSet = false;
  const words = args.map(w => w.toLowerCase().replace(/,$/, ''));
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(w))) { year = +m[1]; month = +m[2]; day = +m[3]; dateSet = true; }
    else if ((m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(w))) { day = +m[1]; month = +m[2]; if (m[3]) year = +m[3]; dateSet = true; }
    else if ((m = /^(\d{1,2}):(\d{2})$/.exec(w))) {
      const h = +m[1], mi = +m[2];
      if (h > 24 || mi > 59 || (h === 24 && mi > 0)) throw Error(`${w} is not a time of day`);
      minute = h * 60 + mi; timeSet = true;
    }
    else if (MONTHS.includes(w.slice(0, 3)) && /^[a-z]+$/.test(w)) { month = MONTHS.indexOf(w.slice(0, 3)) + 1; dateSet = true; }
    else if (/^\d{4}$/.test(w)) { year = +w; dateSet = true; }
    else if (/^\d{1,2}(st|nd|rd|th)?$/.test(w)) { day = parseInt(w, 10); dateSet = true; }
    else throw Error(`"${args[i]}" is not a date or time. Try: sun 21 dec 12:00`);
  }
  if (!dateSet && !timeSet) throw Error('give a date, a time or both: sun 21 dec 12:00');
  if (year < 1800 || year > 2199) throw Error(`year ${year} is outside 1800 to 2199`);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || day < 1 || check.getUTCDate() !== day) throw Error(`${day} ${MONTHS[month - 1] ?? month} ${year} is not a calendar date`);
  return s.clock.toUtc(year, month, day, minute);
}

function describe(s) {
  const sun = sunNow(s), p = s.clock.parts(s.utcMs);
  const when = `${p.day} ${mon(p.month)} ${p.year} ${hhmm(p.minute)} ${s.clock.label(p.off)}`;
  return sun.elevation > 0
    ? `${when}: sun bearing ${sun.azimuth.toFixed(1)} deg, ${sun.elevation.toFixed(1)} deg up (illustrative clear sky)`
    : `${when}: sun below the horizon (${sun.elevation.toFixed(1)} deg)`;
}

function runSun(args) {
  const s = S;
  if (!s) throw Error('the sun pack is not started');
  const w0 = (args[0] || '').toLowerCase();
  const setTime = ms => { s.utcMs = Math.round(ms); s.lastEmitMin = NaN; emitSun(s); return describe(s); };
  if (!w0 || w0 === 'info') return describe(s);
  let m;
  if ((m = /^([+-])(\d+(?:\.\d+)?)(m|min|h|d)$/.exec(w0))) {
    const unit = { m: MIN_MS, min: MIN_MS, h: 60 * MIN_MS, d: DAY_MS }[m[3]];
    return setTime(s.utcMs + (m[1] === '-' ? -1 : 1) * Number(m[2]) * unit);
  }
  if (w0 === 'play') {
    const r = args[1] === undefined ? s.rate : Number(args[1]);
    if (!Number.isFinite(r) || r === 0 || Math.abs(r) > 1440) throw Error('sun play takes minutes of sun time per second, from -1440 to 1440 (not 0): sun play 60');
    s.rate = r; s.playing = true;
    return `sun playing at ${r} min per second`;
  }
  if (w0 === 'stop' || w0 === 'pause') { s.playing = false; return 'sun still. ' + describe(s); }
  if (w0 === 'rise' || w0 === 'sunrise' || w0 === 'set' || w0 === 'sunset' || w0 === 'noon') {
    const d = dayNow(s), t = w0 === 'noon' ? d.noon : w0.endsWith('rise') ? d.rise : d.set;
    if (t === null) throw Error(`no ${w0} on this day here (${d.polar === 'day' ? 'the sun stays up' : 'the sun stays down'})`);
    return setTime(t);
  }
  if (w0 === 'plane') {
    const tilt = Number(args[1]), az = Number(args[2]);
    if (!Number.isFinite(tilt) || tilt < 0 || tilt > 90 || !Number.isFinite(az)) throw Error('sun plane needs a tilt 0 to 90 and a facing azimuth in degrees from north: sun plane 30 180');
    s.plane = { tilt, azimuth: lim360(az) }; s.sunAt = NaN; s.lastEmitMin = NaN; emitSun(s);
    const sun = sunNow(s);
    return `plane ${tilt} deg facing ${lim360(az)} deg: ${Math.round(sun.plane.poa)} W/m2 clear sky (illustrative)`;
  }
  if (w0 === 'at') {
    const lat = Number(args[1]), lon = Number(args[2]);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) throw Error('sun at needs a latitude and a longitude in degrees: sun at 52.1 -1.3');
    s.lat = lat; s.lon = lon; s.located = true; s.sunAt = NaN; s.dayKey = ''; s.lastEmitMin = NaN; emitSun(s);
    return `sun place ${lat.toFixed(3)}, ${lon.toFixed(3)}. ` + describe(s);
  }
  if (w0 === 'turbidity') {
    const tl = Number(args[1]);
    if (!Number.isFinite(tl) || tl < 1 || tl > 10) throw Error('sun turbidity takes a Linke turbidity from 1 to 10: sun turbidity 3');
    s.linke = tl; s.sunAt = NaN; s.lastEmitMin = NaN; emitSun(s);
    return `Linke turbidity ${tl}: GHI ${Math.round(sunNow(s).sky.ghi)} W/m2 clear sky (illustrative)`;
  }
  return setTime(parseWhen(s, args));
}

// ------------------------------------------------------------------------------------------ hooks
export default {
  id: 'sun',
  init(api) {
    S = setup(api);
    const s = S;
    if (api?.events) s.offs.push(api.events.on('world/origin', o => { if (s.crs && !(Number.isFinite(api.config?.lat) && Number.isFinite(api.config?.lon))) { locateFromOrigin(s, o); s.cache.clear(); s.lastEmitMin = NaN; emitSun(s); } }));
    emitSun(s);
  },
  setEnabled(v) { if (S) { S.on = !!v; if (!S.on) S.playing = false; } },
  step(dt) {
    const s = S;
    if (!s || !s.on || !s.playing) return;
    s.utcMs += Math.round(s.rate * 60000 * dt);
    emitSun(s);
  },
  active() { return !!(S && S.on && S.playing); },
  lines(ctx) { return S ? buildLines(S, ctx) : []; },
  hud() {
    const s = S;
    if (!s) return [];
    const sun = sunNow(s), day = dayNow(s), p = s.clock.parts(s.utcMs), lab = s.clock.label(p.off);
    const loc = s.clock.parts;
    const t = ms => (ms === null ? '--:--' : hhmm(loc(ms).minute));
    const len = day.rise !== null && day.set !== null ? Math.round((day.set - day.rise) / MIN_MS) : null;
    const lines = [
      { id: 'time', text: `${p.day} ${mon(p.month)} ${p.year} ${hhmm(p.minute)} ${lab}  az ${sun.azimuth.toFixed(1)}  el ${sun.elevation.toFixed(1)} deg${s.located ? '' : ' (place not set)'}` },
      { id: 'day', text: day.polar ? `polar ${day.polar}: no sunrise or sunset` : `rise ${t(day.rise)}  noon ${t(day.noon)}  set ${t(day.set)}  day ${len === null ? '-' : Math.floor(len / 60) + ' h ' + (len % 60) + ' min'}` },
      { id: 'sky', text: `clear sky GHI ${Math.round(sun.sky.ghi)}  DNI ${Math.round(sun.sky.dni)}  DHI ${Math.round(sun.sky.dhi)}  plane ${s.plane.tilt}/${s.plane.azimuth}: ${Math.round(sun.plane.poa)} W/m2` },
      { id: 'shade', text: sun.elevation > 0 ? `terrain shadow: ${s.shadeCount ?? 0} of ${s.shadeTotal ?? 0} points${s.playing ? '  playing ' + s.rate + ' min/s' : ''}` : `night${s.playing ? '  playing ' + s.rate + ' min/s' : ''}` }
    ];
    return lines;
  },
  commands() { return [{ verb: 'sun', run: runSun }]; },
  dispose() { if (S) { for (const off of S.offs) try { off(); } catch { /* already gone */ } S.cache.clear(); } S = null; }
};
