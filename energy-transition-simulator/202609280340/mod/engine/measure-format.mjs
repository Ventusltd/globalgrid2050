// COPIED UNCHANGED from world/v12 measure-format.mjs at v12 commit 3adcee9 (file last changed 85bfdb1). Modular star family: public #1608 formatNumber.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// measure-format.mjs: plain British English lines from the numbers measure.mjs
// returns. Pure: no imports, no DOM. Parts are joined with " · ", for example
//   "Trench 124.6 m (3D 125.1 m) · spoil 98.4 m³ · 1 bend below 1.05 m"
// Inputs are the summary objects from measure.mjs (trenchSummary, cableSummary,
// cutFillForPlatform, profile); nothing is recomputed here.

const SEP = ' · ';

/** 1234.56 -> "1,234.6" (comma thousands, point decimal). */
export function formatNumber(x, dp = 1) {
  if (x == null || !Number.isFinite(x)) return 'n/a';
  const v = Math.abs(x) < 0.5 * 10 ** -dp ? 0 : x;   // no "-0.0"
  // Rounded as written in decimal (0.825 -> "0.83"), not as the nearest binary double happens to fall (toFixed gives 0.82).
  const [i, f] = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp, useGrouping: false }).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 ? '-' : '') + grouped + (f ? '.' + f : '');
}

export const formatLength = (m, dp = 1) => `${formatNumber(m, dp)} m`;
export const formatArea = (m2, dp = 1) => `${formatNumber(m2, dp)} m²`;
export const formatVolume = (m3, dp = 1) => `${formatNumber(m3, dp)} m³`;

/** 0.05 -> "5.0 % (1 in 20)"; 0 -> "level". */
export function formatGradient(g, dp = 1) {
  if (g == null || !Number.isFinite(g)) return 'n/a';
  if (Math.abs(g) < 1e-6) return 'level';
  return `${formatNumber(g * 100, dp)} % (1 in ${formatNumber(1 / Math.abs(g), 0)})`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "1 bend below 1.05 m", "no bends below 1.05 m", or "" when no rule applies.
function belowPhrase(cs) {
  if (!cs || cs.required.radius == null) return '';
  const r = formatNumber(cs.required.radius, 2);
  return cs.below.length ? `${plural(cs.below.length, 'bend', 'bends')} below ${r} m` : `no bends below ${r} m`;
}

/**
 * "Trench 124.6 m (3D 125.1 m) · spoil 98.4 m³ · 1 bend below 1.05 m"
 * ts from trenchSummary; cs (optional) from cableSummary for the cable it carries.
 */
export function formatTrenchLine(ts, cs = null) {
  let head = `Trench ${formatLength(ts.length2d)}`;
  if (ts.length3d != null) head += ` (3D ${formatLength(ts.length3d)})`;
  const parts = [head];
  if (ts.spoil != null) parts.push(`spoil ${formatVolume(ts.spoil)}`);
  const b = belowPhrase(cs);
  if (b) parts.push(b);
  return parts.join(SEP);
}

/** "Cable 132.4 m (3D 133.0 m) · final radius 0.77 m (15 × OD 51.5 mm) · no bends below 0.77 m" */
export function formatCableLine(cs) {
  const parts = [`Cable ${formatLength(cs.length2d)} (3D ${formatLength(cs.length3d)})`];
  const r = cs.required;
  if (r.radius == null) {
    parts.push(`no ${r.when} bend rule for this cable`);
  } else {
    let od = `OD ${formatNumber(cs.cable.odMm, 1)} mm`;
    if (cs.cable.odStatus === 'estimated') od += ' estimated';
    parts.push(`${r.when} radius ${formatNumber(r.radius, 2)} m (${formatNumber(r.multiple, 3).replace(/\.?0+$/, '')} × ${od})`);
    parts.push(belowPhrase(cs));
  }
  return parts.join(SEP);
}

/** "Platform 600.0 m² at 12.30 m · cut 410.2 m³ · fill 388.9 m³ · net 21.3 m³ cut" */
export function formatPlatformLine(cf) {
  const net = cf.cut - cf.fill;
  const netText = Math.abs(net) < 0.05 ? 'balanced' : `net ${formatVolume(Math.abs(net))} ${net > 0 ? 'cut' : 'fill'}`;
  return [
    `Platform ${formatArea(cf.area)} at ${formatNumber(cf.level, 2)} m`,
    `cut ${formatVolume(cf.cut)}`,
    `fill ${formatVolume(cf.fill)}`,
    netText,
  ].join(SEP);
}

/** "Profile 100.0 m (3D 100.1 m) · ground 0.00 to 5.00 m · steepest 5.0 % (1 in 20)" */
export function formatProfileLine(p) {
  return [
    `Profile ${formatLength(p.length2d)} (3D ${formatLength(p.length3d)})`,
    `ground ${formatNumber(p.min, 2)} to ${formatNumber(p.max, 2)} m`,
    `steepest ${formatGradient(p.gradient.max)}`,
  ].join(SEP);
}

// ---- One number rule for readouts (UI polish; e4 UI spec section 5) ----
// Significant figures, not decimal places: a figure is shown only as well as its inputs are known. Thousands commas,
// no "-0", and an em dash when a value cannot be computed (never NaN, never n/a in a readout).
export const NONE = '—';

/** fmtSig(1234.5) -> "1,230"; fmtSig(0.4213, 2) -> "0.42"; fmtSig(20.44) -> "20.4"; fmtSig(NaN) -> "—". */
export function fmtSig(x, sf = 3) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return NONE;
  if (x === 0) return '0';
  const r = Number(x.toPrecision(sf)), mag = Math.floor(Math.log10(Math.abs(r)));
  return formatNumber(r, Math.max(0, sf - 1 - mag));
}

/** fmtQ(412.3, 'A') -> "412 A": a quantity to sf significant figures with its unit after a space. */
export const fmtQ = (v, unit = '', sf = 3) => (unit && Number.isFinite(v) ? `${fmtSig(v, sf)} ${unit}` : fmtSig(v, sf));

/** Percentages (voltage drop, rise, tap): 2 decimal places below 10 %, 1 above. fmtPct(0.842) -> "0.84 %". */
export const fmtPct = p => (Number.isFinite(p) ? `${formatNumber(p, Math.abs(p) < 10 ? 2 : 1)} %` : NONE);

/** Lengths: whole metres, or km to 2 places above 10 km. fmtLen(1284.4) -> "1,284 m". */
export const fmtLen = m => (!Number.isFinite(m) ? NONE : Math.abs(m) > 10000 ? `${formatNumber(m / 1000, 2)} km` : `${formatNumber(m, 0)} m`);

/** Volts: four figures below 1,000 V, whole volts with a comma above (a string's volts matter to the volt near its limit). */
export const fmtVolt = v => (!Number.isFinite(v) ? NONE : Math.abs(v) < 1000 ? fmtQ(v, 'V', 4) : `${formatNumber(v, 0)} V`);
