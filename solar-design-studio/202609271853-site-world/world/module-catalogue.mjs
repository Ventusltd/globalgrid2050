// module-catalogue.mjs: the generic module catalogue (data/modules.json): schema check, the cell grid of a class,
// the cold open-circuit voltage, and the string and table counts a class gives on a table face.
// Generic classes only; values come from manufacturer datasheets (sample) or typical class values, as each says.
// Pure: no DOM, no fetching.

export const SCHEMA = 'module-catalogue/1';
const NUM = v => typeof v === 'number' && Number.isFinite(v);

/** Every problem with a catalogue document, as sentences; [] when it is sound. */
export function checkCatalogue(doc) {
  const out = [];
  if (!doc || doc.schema !== SCHEMA) return [`schema is not ${SCHEMA}`];
  if (!NUM(doc.coldest_cell_C) || !NUM(doc.system_voltage_V)) out.push('coldest_cell_C and system_voltage_V must be numbers');
  if (!Array.isArray(doc.classes) || !doc.classes.length) return [...out, 'no classes'];
  const ids = new Set();
  for (const c of doc.classes) {
    const at = `class ${c?.id}`;
    if (!/^[A-Z]$/.test(c?.id || '') || ids.has(c.id)) out.push(`${at}: id must be one unique capital letter`);
    ids.add(c?.id);
    if (!/^Module [A-Z] — /.test(c?.label || '')) out.push(`${at}: label must read "Module X — ..."`);
    if (!/^(manufacturer datasheet \(sample\)|typical class values \(assumed\))$/.test(c?.source || '')) out.push(`${at}: source`);
    const [L, W, D] = c?.size_mm || [], [lL, lW] = c?.laminate_mm || [];
    if (![L, W, D, lL, lW].every(NUM) || !(lL < L && lW < W && D > 0)) out.push(`${at}: size_mm and laminate_mm`);
    const k = c?.cells || {};
    if (!(k.columns * k.rows === k.count) || !(splitRow(c) > 0 && splitRow(c) < k.rows) || !['half', 'third'].includes(k.cut) || !(k.busbars >= 0)) out.push(`${at}: cells`);
    if (NUM(lW) && NUM(lL) && (k.columns * k.cell_mm?.[0] > lW || k.rows * k.cell_mm?.[1] > lL)) out.push(`${at}: cells do not fit the laminate`);
    const j = c?.junction_boxes || {};
    if (!(j.count === j.positions?.length) || !j.positions.every(p => p.every(x => x >= 0 && x <= 1))) out.push(`${at}: junction boxes`);
    if (!(c?.cable?.plus_mm > 0 && c.cable.minus_mm > 0)) out.push(`${at}: cable lengths`);
    if (!Array.isArray(c?.holes) || !c.holes.every(h => h.t_mm.every(t => Math.abs(t) < L / 2))) out.push(`${at}: holes`);
    const b = c?.electrical?.bins || [];
    if (!b.length || !b.every(x => ['pmax', 'vmp', 'imp', 'voc', 'isc'].every(q => NUM(x[q])) && x.voc > x.vmp && x.isc > x.imp
      && Math.abs(x.vmp * x.imp - x.pmax) / x.pmax < 0.02)) out.push(`${at}: electrical bins`);
    if (!b.some(x => x.pmax === c?.electrical?.nominal_W)) out.push(`${at}: nominal_W is not one of the bins`);
    if (!['pmax', 'voc', 'isc'].every(q => NUM(c?.temp_coeff?.[q]))) out.push(`${at}: temperature coefficients`);
    if (!(c?.bifaciality >= 0 && c.bifaciality <= 1)) out.push(`${at}: bifaciality`);
  }
  return out;
}

export const classOf = (doc, id) => doc.classes.find(c => c.id === id) || null;
export const nominal = c => c.electrical.bins.find(b => b.pmax === c.electrical.nominal_W);
/** The bin with the highest open-circuit voltage: any bin may be delivered, so string sizing uses this one. */
export const highestVoc = c => c.electrical.bins.reduce((a, b) => (b.voc > a.voc ? b : a));
/** Cell rows below the split line (from the low edge): the half-cut centre, or the row a class states. */
export const splitRow = c => c.cells.split_row ?? Math.ceil(c.cells.rows / 2);

/** Module size in metres: length (up the table), width (along the row), frame depth. */
export const sizeM = c => c.size_mm.map(v => v / 1000);

/**
 * The cell grid of a class in module fractions: cells as [s0, t0, s1, t1] (s across the width, t along the length),
 * the split line between the two halves (t), and the busbar lines (s positions per column).
 */
export function cellGrid(c) {
  const [L, W] = c.size_mm, [lL, lW] = c.laminate_mm, { columns, rows, cell_mm: [cw, ch], busbars } = c.cells;
  const splitGap = 6, gapS = (lW - columns * cw) / (columns + 1), half = splitRow(c);
  const gapT = (lL - rows * ch - splitGap) / (rows + 1);
  const s0 = (W - lW) / 2, t0 = (L - lL) / 2, cells = [];
  const tOf = r => t0 + gapT * (r + 1) + ch * r + (r >= half ? splitGap : 0);
  for (let r = 0; r < rows; r++) for (let q = 0; q < columns; q++) {
    const s = s0 + gapS * (q + 1) + cw * q, t = tOf(r);
    cells.push([s / W, t / L, (s + cw) / W, (t + ch) / L]);
  }
  const split = (tOf(half) - splitGap / 2 - gapT / 2) / L;
  const bus = [];
  for (let q = 0; q < columns; q++) for (let b = 0; b < busbars; b++) bus.push((s0 + gapS * (q + 1) + cw * q + cw * (b + 0.5) / busbars) / W);
  return { cells, split, bus, laminate: [s0 / W, t0 / L, 1 - s0 / W, 1 - t0 / L] };
}

/** Open-circuit voltage of one module at a cell temperature (coefficient in % per kelvin). */
export const vocAt = (c, tC, bin = nominal(c)) => bin.voc * (1 + c.temp_coeff.voc / 100 * (tC - 25));

// The cold open-circuit voltage used for string sizing, two ways, the stricter wins (owner's rule, 27 Sept): the module at
// the coldest cell temperature (temperature coefficient), and the datasheet Voc x 1.15 (a fixed factor for when the site
// temperature is not trusted; IEC 62548-1 allows either approach). One function, so the block, the plant and the module
// panel give one answer.
export const VOC_FACTOR = 1.15;
export function coldVocOf({ voc, coeffPctPerK, tC }) {
  const byTemp = voc * (1 + coeffPctPerK / 100 * (tC - 25)), byFactor = voc * VOC_FACTOR;
  return { v: Math.max(byTemp, byFactor), byTemp, byFactor, rule: byFactor >= byTemp ? `Voc × ${VOC_FACTOR}` : `coldest cell ${tC} °C` };
}
/** The sizing cold Voc of one module of a class (one bin; the highest-Voc bin by default). */
export const coldVoc = (c, tC, bin = highestVoc(c)) => coldVocOf({ voc: bin.voc, coeffPctPerK: c.temp_coeff.voc, tC }).v;

/** The most modules in series whose sizing cold Voc (highest bin, stricter of the two ways) stays under the system voltage. */
export const modulesPerString = (c, coldC, systemV = 1500) => Math.floor(systemV / coldVoc(c, coldC) + 1e-9);

/** Modules that fit a table face: columns along the row, rows up the slope, and the gap between them. Portrait (the
 * default) stands the module's length up the slope; landscape lays it along the row (the 3L-6L tables). */
export function faceFit(c, spanM, runM, gapM = 0.02, orient = 'portrait') {
  const [L0, W0] = sizeM(c), land = orient === 'landscape', L = land ? W0 : L0, W = land ? L0 : W0;
  const fit = (a, b) => Math.max(0, Math.floor((a + gapM) / (b + gapM) + 1e-9)); // 1e-9: a face sized for n modules fits n
  return { columns: fit(spanM, W), rows: fit(runM, L), gapM };
}

/** Counts a class gives over a list of faces ({ span, run }): modules, whole strings (a string may turn onto the next row), DC kWp. */
export function countsFor(c, faces, coldC, systemV = 1500) {
  const mps = modulesPerString(c, coldC, systemV);
  let modules = 0, strings = 0;
  for (const f of faces) { const { columns, rows } = faceFit(c, f.span, f.run, undefined, f.orient); modules += columns * rows; strings += Math.floor(columns * rows / mps); }
  return { modulesPerString: mps, modules, strings, stringed: strings * mps, kWp: Math.round(modules * c.electrical.nominal_W) / 1000 };
}
