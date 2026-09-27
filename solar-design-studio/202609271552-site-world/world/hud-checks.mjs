// hud-checks.mjs: the design checks the check HUD shows (hud-ui.mjs), one line per FAILED check. Owner's instruction
// (27 Sept): a failed check is shown, in small red HUD text; this replaces the earlier "no red verdict" rule for the HUD
// only. Every figure is illustrative and every assumption editable; nothing here is a design for any site.
//
// Public checks: generic physics and published standards, worked out from the placed solar block and its staged cable
// schedule. Private checks: an owner's rules file (schema spec-rules.v1, checks[]) loaded LOCALLY by the viewer; never
// fetched from the server, never staged, never shipped (tools/prepush.mjs refuses *.rules.json). Pure: no DOM, no fetch.

import { stringDesign, stringLine, STRING_ADVICE, ILLUSTRATIVE } from './string-design.mjs';

export const HUD_NOTE = `Illustrative, assumptions editable. ${ILLUSTRATIVE}`;
export const LV_DROP_LIMIT_PCT = 3; // a common design limit for LV cables (BS 7671 Appendix 12 gives 3 % / 5 % from the origin)

// facts: { mps, tempMinC, spareStrings, cls, cat, ac: acChecks(...) result, choice, acTrenchWidthM }. Any missing input skips its check.
export function publicChecks(f = {}) {
  const out = [], add = (id, failed, line, inputs, standard) => out.push({ id, failed: !!failed, line, working: { inputs, standard, note: HUD_NOTE } });
  // The string voltage is always shown (owner, 27 Sept: show the truth): red when over the system voltage, neutral with the
  // headroom when under; the advisory goes under it either way. Modules in series and the coldest cell are editable.
  const sd = f.cls && f.cat && f.mps ? stringDesign({ cls: f.cls, cat: f.cat, mps: f.mps, tempMinC: f.tempMinC }) : null;
  if (sd) {
    add('string-voc', !sd.ok, stringLine(sd),
      [['Modules in series', f.mps], ['Module Voc, highest bin', `${sd.worst.voc} V (${sd.worst.pmax} W)`], ['β Voc', `${f.cls.temp_coeff.voc} %/K`],
        ['Coldest cell', `${sd.tempMinC} °C (editable: temp min)`], ...sd.bins.map(b => [`Cold Voc, ${b.pmax} W bin`, `${b.vocCold.toFixed(1)} V`]),
        ['String Voc', `${sd.stringV.toFixed(1)} V`], ['System voltage', `${sd.systemV} V`], ['Headroom', `${sd.headroomV.toFixed(1)} V`],
        ['Most in series here', sd.most]],
      'IEC 62548-1 (array maximum voltage at the lowest expected cell temperature); IEC 61730-1 (module maximum system voltage)');
    Object.assign(out.at(-1), { always: true, advice: STRING_ADVICE, headroomV: sd.headroomV });
  }
  const A = f.ac;
  if (A?.summary?.loading_pct) {
    const L = A.summary.loading_pct.max, c = f.choice || {};
    add('ac-load', L > 100, `AC CABLE 3×${c.size ?? '?'} ${String(c.mat || '').toUpperCase()} LOAD ${Math.round(L)}% · ${c.nper ?? '?'} GROUPED`,
      [['Design current / rating', `${L.toFixed(1)} %`], ['Rating, this case', `${Number(A.rating_A).toFixed(1)} A`], ['Circuits grouped', c.nper],
        ['Installation', c.inst], ['Soil thermal resistivity', `${c.rho} K·m/W`], ['Depth', `${c.depth} m`]],
      'IEC 60287-1-1 and IEC 60287-2-1 (current rating; thermal resistance and grouping)');
  }
  if (Number.isFinite(A?.width_m) && Number.isFinite(f.acTrenchWidthM)) {
    add('collector-trench', f.acTrenchWidthM < A.width_m - 1e-9, `COLLECTOR TRENCH ${f.acTrenchWidthM.toFixed(1)} M < ${A.width_m.toFixed(1)} M REQUIRED`,
      [['Trench as drawn', `${f.acTrenchWidthM} m`], ['Width the rated case needs', `${A.width_m.toFixed(2)} m`], ['Circuits', (f.choice || {}).nper],
        ['Spacing between circuits', `${(f.choice || {}).spacing} m`]], 'IEC 60287-2-1 (spacing between circuits in the thermal model)');
  }
  if (Number.isFinite(f.spareStrings)) {
    add('unconnected', f.spareStrings > 0, `${f.spareStrings} STRINGS UNCONNECTED`, [['Strings built', f.strings], ['Connected', f.connectedStrings],
      ['Unconnected', f.spareStrings]], 'IEC 62446-1 (every string tested and connected at commissioning)');
  }
  if (A?.summary?.vd_pct) {
    const d = A.summary.vd_pct.max, lim = f.lvDropLimitPct ?? LV_DROP_LIMIT_PCT;
    add('lv-drop', d > lim, `LV DROP ${d.toFixed(2)}% > ${lim}%`, [['Worst AC circuit', `${d.toFixed(2)} % of line volts`], ['Limit', `${lim} % (assumed)`]],
      'BS 7671:2018+A2 Appendix 12 (voltage drop in consumers\' installations)');
  }
  return out;
}

// ---- private rules (spec-rules.v1) ----
const FAIL_STATUS = /^(X|DOES NOT COMPLY)$/i;
export function parsePrivateRules(doc) {
  if (!doc || doc.schema !== 'spec-rules.v1' || !Array.isArray(doc.checks)) throw Error('not a private rules file (spec-rules.v1 with checks[])');
  return { label: String(doc.label || 'private rules'), checks: doc.checks.filter(c => c && typeof c.id === 'string') };
}
const compare = (v, op, lim) => {
  if (op === 'between' && Array.isArray(lim)) return v >= lim[0] && v <= lim[1];
  if (op === 'in' && Array.isArray(lim)) return lim.includes(v);
  if (typeof v === 'number' && typeof lim === 'number') return { '<=': v <= lim, '>=': v >= lim, '<': v < lim, '>': v > lim, '==': Math.abs(v - lim) < 1e-9 }[op];
  if (op === '==') return String(v) === String(lim);
  return undefined;
};
/** Each private check: worked out from the facts where it names one, else from its design value, else as the file states. */
export function evaluatePrivate(rules, facts = {}) {
  return rules.checks.map(c => {
    const key = c.value || c.subject || c.metric, v = key != null && facts[key] !== undefined ? facts[key] : c.design_value ?? c.desk_value;
    const worked = v !== undefined && c.limit !== undefined ? compare(v, c.op, c.limit) : undefined;
    const failed = worked === undefined ? FAIL_STATUS.test(String(c.status ?? c.status_at_defaults ?? '')) : !worked;
    const what = String(c.topic || c.requirement || c.id).toUpperCase().slice(0, 48);
    const lim = Array.isArray(c.limit) ? c.limit.join('–') : c.limit;
    const line = `${c.id} ${what}${worked !== undefined ? ` · ${v} ${c.op} ${lim}${c.units || c.unit ? ' ' + (c.units || c.unit) : ''}` : ''}`;
    return { id: c.id, private: true, failed, line, working: { inputs: [['Requirement', c.requirement], ['Value', v ?? 'as stated in the file'],
      ['Test', c.op ? `${c.op} ${lim ?? ''}` : 'as stated'], ['Note', c.note || '']], standard: c.source || 'private rules', note: HUD_NOTE } };
  });
}

/** The HUD's lines: the failed checks, public first, private after (only when a local rules file is loaded), and the lines
 * always shown (the string voltage, neutral while it passes). A fixed check clears. */
export function hudLines(publicList, privateList = []) {
  return [...publicList, ...privateList].filter(c => c.failed || c.always);
}
