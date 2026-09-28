// COPIED UNCHANGED from world/v12 string-design.mjs at v12 commit 3adcee9 (file last changed 8903e78). Modular star family: public #148079 stringDesign.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// string-design.mjs: the string voltage of the solar block, worked out in the open. Owner's instruction (27 Sept): show
// the truth, don't expose people. Modules in series and the site's coldest cell temperature are the owner's to change
// (typed "string 28", "temp min -10", or the block panel); the cold open-circuit voltage is worked out for every power
// bin of the module class (any bin may be delivered, so the string is judged on the highest), with the headroom under
// the system voltage said in volts. Illustrative: early design, no warranty; the advisory below always goes with it.
// Pure: no DOM, no fetch.

import { coldVocOf, highestVoc, VOC_FACTOR } from './module-catalogue.mjs';

export const STRING_ADVICE = 'Study string voltages in detail: get module-maker and inverter-maker sign-off, or a chartered engineer\'s '
  + 'review if borderline, or use fewer modules in series for over-voltage headroom.';
export const ILLUSTRATIVE = 'Illustrative — early design, no warranty; confirm with a qualified engineer.';
export const BORDERLINE_PCT = 3; // headroom under this share of the system voltage is called borderline (an assumption, editable)

const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));

/**
 * stringDesign({ cls, cat, mps, tempMinC, systemV }) -> { mps, tempMinC, systemV, bins, worst, stringV, headroomV, ok, borderline, most }
 * cls: a module class (module-catalogue.mjs); cat: the catalogue (coldest_cell_C, system_voltage_V are its defaults).
 */
export function stringDesign({ cls, cat = {}, mps, tempMinC, systemV } = {}) {
  if (!cls || !(mps > 0)) return null;
  const t = Number.isFinite(num(tempMinC)) ? num(tempMinC) : cat.coldest_cell_C ?? -10, V = num(systemV) > 0 ? num(systemV) : cat.system_voltage_V || 1500;
  // Each bin two ways (the coldest cell, and Voc x 1.15); the stricter is the sizing value (module-catalogue.mjs coldVocOf).
  const bins = cls.electrical.bins.map(b => { const c = coldVocOf({ voc: b.voc, coeffPctPerK: cls.temp_coeff.voc, tC: t });
    return { pmax: b.pmax, voc: b.voc, vocCold: c.v, byTemp: c.byTemp, byFactor: c.byFactor, rule: c.rule, stringV: c.v * mps }; });
  const hi = highestVoc(cls), worst = bins.find(b => b.pmax === hi.pmax && b.voc === hi.voc), stringV = worst.stringV, headroomV = V - stringV;
  return { mps, tempMinC: t, systemV: V, bins, worst, stringV, headroomV, ok: stringV <= V, borderline: stringV <= V && headroomV < V * BORDERLINE_PCT / 100,
    most: Math.floor(V / worst.vocCold + 1e-9), rule: worst.rule };
}

/** The HUD line: red when over, neutral with the headroom when under. */
export function stringLine(d) {
  const v = Math.round(d.stringV), tail = `@ ${d.rule === `Voc × ${VOC_FACTOR}` ? `VOC × ${VOC_FACTOR} (STRICTER THAN ${d.tempMinC}°C)` : `${d.tempMinC}°C`}`
    + ` · ${d.worst.pmax} W BIN · ${d.mps} MOD`;
  return d.ok ? `STRING VOC ${v} V · ${Math.floor(d.headroomV)} V HEADROOM${d.borderline ? ' (BORDERLINE)' : ''} ${tail}`
    : `STRING VOC ${v} V > ${d.systemV} V ${tail}`;
}

/** The block readout's words: every bin's cold Voc, the string, the headroom, the most in series. */
export function stringWords(d) {
  const bins = d.bins.map(b => `${b.pmax} W ${b.vocCold.toFixed(1)} V`).join(' · ');
  return {
    bins: `one module, the stricter of ${d.tempMinC} °C and Voc × ${VOC_FACTOR} (${d.rule} governs): ${bins}`,
    string: `${d.mps} in series: ${Math.round(d.stringV)} V (highest bin, ${d.worst.pmax} W) against ${d.systemV} V · `
      + (d.ok ? `${Math.floor(d.headroomV)} V headroom${d.borderline ? ', borderline' : ''}` : `OVER by ${Math.ceil(-d.headroomV)} V`)
      + ` · at most ${d.most} in series on this rule`
  };
}

/** A one-bin module class from typed values (a plant with a typed module Voc and power), for stringDesign. */
export const typedClass = ({ wp, voc, coeffPctPerK }) => ({ id: 'typed', electrical: { bins: [{ pmax: wp, voc }], nominal_W: wp }, temp_coeff: { voc: coeffPctPerK } });

/** Strings and inverters for a count of modules: whole strings, modules left over, inverters to connect every string. */
export function stringCounts({ modules, mps, stringsPerInverter = 24, inverters = null }) {
  const strings = Math.floor(modules / mps), need = Math.ceil(strings / stringsPerInverter);
  return { strings, leftover: modules - strings * mps, invertersNeeded: need, spare: inverters === null ? null : Math.max(0, strings - inverters * stringsPerInverter) };
}
