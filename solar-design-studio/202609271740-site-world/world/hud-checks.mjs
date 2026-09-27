// hud-checks.mjs: the design checks the check HUD shows (hud-ui.mjs), one line per FAILED check. Owner's instruction
// (27 Sept): a failed check is shown, in small red HUD text; this replaces the earlier "no red verdict" rule for the HUD
// only. Every figure is illustrative and every assumption editable; nothing here is a design for any site.
//
// Public checks: generic physics and published standards, worked out from the placed solar block and its staged cable
// schedule. Private checks: an owner's rules file (schema spec-rules.v1, checks[]) loaded LOCALLY by the viewer; never
// fetched from the server, never staged, never shipped (tools/prepush.mjs refuses *.rules.json). Pure: no DOM, no fetch.

import { stringDesign, stringLine, typedClass, STRING_ADVICE, ILLUSTRATIVE } from './string-design.mjs';
import { structureChecks } from './structures.mjs';
import { fmtQ, fmtPct, fmtVolt } from './measure-format.mjs';

export const HUD_NOTE = `Illustrative, assumptions editable. ${ILLUSTRATIVE}`;
export const HUD_TITLE = 'Illustrative checks at the assumptions shown, not a design assessment';
export const QUALIFIED = 'Check with a qualified engineer.';
export const LV_DROP_LIMIT_PCT = 3; // a common design limit for LV cables (BS 7671 Appendix 12 gives 3 % / 5 % from the origin)
export const DC_DROP_LIMIT_PCT = 3; // an assumed design limit for a DC string circuit (IEC 62548-1 leaves it to the designer)
// Single changes that bring a continuously loaded cable back under its rating, each on its own (said behind [i]; the
// trench designer rates each one: type it, then trench design).
export const AC_OPTIONS = ['load solar-day: the daily cycle of a solar day instead of full current all day', 'a larger conductor (500 mm² Al)',
  'copper instead of aluminium', 'wider spacing between circuits, or more trenches side by side (trench split collector N)'];
export const TRENCH_OPTIONS = ['trenches side by side (trench split collector N): narrower trenches, a wider corridor', 'two layers in one trench',
  'a duct bank (ducts in cement-bound sand)', 'type trench design to compare the arrangements the rating allows'];
const pctOf = u => Math.round(u * 100);

// facts: { mps, tempMinC, spareStrings, strings, connectedStrings, cls, cat, plan: { summary, env } (the built trench plan),
//   drops: { dc, ac } (hud-drops.mjs), plant: plantFacts(result), plantString: { cls, cat, mps, tempMinC } }. Missing inputs skip.
export function publicChecks(f = {}) {
  const out = [], add = (id, failed, line, inputs, standard, extra = {}) => out.push({ id, failed: !!failed, line,
    working: { inputs, standard, note: `${QUALIFIED} ${HUD_NOTE}` }, ...extra });
  // The string voltage is always shown (owner, 27 Sept: show the truth): red when over the system voltage, neutral with the
  // headroom when under; the advisory goes under it either way. Modules in series and the coldest cell are editable. The
  // plant's line is worked out the same way from the plant's own module (one class, one rule).
  const voc = (id, pre, S) => {
    const sd = S?.cls && S.mps ? stringDesign({ cls: S.cls, cat: S.cat || {}, mps: S.mps, tempMinC: S.tempMinC }) : null;
    if (!sd) return;
    add(id, !sd.ok, pre + stringLine(sd),
      [['Modules in series', S.mps], ['Module Voc, highest bin', `${sd.worst.voc} V (${sd.worst.pmax} W)`], ['β Voc', `${S.cls.temp_coeff.voc} %/K`],
        ['Coldest cell', `${sd.tempMinC} °C (editable: temp min)`], ['Rule', `the stricter of the coldest cell and Voc × 1.15: ${sd.rule} governs`],
        ...sd.bins.map(b => [`Cold Voc, ${b.pmax} W bin`, `${fmtQ(b.vocCold, 'V')} (cell ${fmtQ(b.byTemp, 'V')}, × 1.15 ${fmtQ(b.byFactor, 'V')})`]),
        ['String Voc', fmtVolt(sd.stringV)], ['System voltage', `${sd.systemV} V`], ['Headroom', fmtQ(sd.headroomV, 'V')], ['Most in series here', sd.most]],
      'IEC 62548-1 (array maximum voltage at the lowest expected cell temperature); IEC 61730-1 (module maximum system voltage)',
      { always: true, advice: STRING_ADVICE, headroomV: sd.headroomV, stringV: sd.stringV });
  };
  voc('string-voc', '', f.cls && f.cat && f.mps ? f : null);
  voc('plant-string-voc', 'PLANT ', f.plantString);
  // Voltage drops of the placed block with the typed series length (hud-drops.mjs, the way Follow works them): always shown.
  const D = f.drops || {};
  if (D.dc) add('dc-drop', D.dc.pct > DC_DROP_LIMIT_PCT, `DC DROP ${D.dc.pct.toFixed(2)} % WORST STRING · ${D.dc.mps} IN SERIES`,
    [['Worst string', `${D.dc.string + 1}: ${fmtQ(D.dc.lengthM, 'm')} of series loop and home cables`], ['Limit', `${DC_DROP_LIMIT_PCT} % (assumed)`]],
    'IEC 62548-1 (DC voltage drop left to the designer); cable resistance by IEC 60228 method', { always: true });
  if (D.ac) add('ac-drop', D.ac.pct > LV_DROP_LIMIT_PCT, `AC DROP ${D.ac.pct.toFixed(2)} % WORST INVERTER CABLE`,
    [['Worst AC cable', `${D.ac.id}, ${fmtQ(D.ac.lengthM, 'm')}`], ['Limit', `${LV_DROP_LIMIT_PCT} % (assumed)`]],
    'BS 7671:2018+A2 Appendix 12 (voltage drop)', { always: true });
  // The AC cables and the collector trench as BUILT: the rated trench plan (trench-plan.mjs) at its stated soil and load.
  const P = f.plan, A = P?.summary?.ac, env = P?.env;
  if (A && env) {
    const pct = pctOf(A.worst), tight = A.worst >= (env.tight ?? 0.95), soil = `SOIL ${env.soilKmW} K·m/W`;
    add('ac-load', A.worst > 1 + 1e-9 || A.notOk > 0, `AC CABLE LOAD ${pct}% OF RATING · ${String(env.load).toUpperCase()} LOAD · ${soil}`,
      [['Worst AC cable, as built', `${pct} % of its rating`], ['Load', env.load === 'continuous' ? 'continuous: full current all day (conservative)' : env.load],
        ['Soil thermal resistivity', `${env.soilKmW} K·m/W (moist ground, assumed; a soil thermal survey sets it)`],
        ...AC_OPTIONS.map((o, i) => [`Option ${i + 1}`, o])], 'IEC 60287-1-1 and IEC 60287-2-1 (current rating; grouping)',
      { always: tight, advice: tight ? `Runs at ${pct} % at ${env.soilKmW} K·m/W: no margin if the ground dries out.` : undefined });
    add('collector-trench', A.notOk > 0, `COLLECTOR TRENCH ${A.corridor.toFixed(1)} M · ${A.split} SIDE BY SIDE · RATED AT ${soil}`,
      [['Corridor as built', `${A.corridor} m (${A.split} trench${A.split > 1 ? 'es' : ''}, widest ${A.widest} m)`], ['Runs not rated', A.notOk],
        ...TRENCH_OPTIONS.map((o, i) => [`Option ${i + 1}`, o])], 'IEC 60287-2-1 (spacing between circuits in the thermal model)', { always: true });
  }
  // The block's trenches rated by trench-plan.mjs: every design fault it names is a red line, the full words in the working.
  (f.trenchFaults || []).forEach((t, i) => add(`trench-fault-${i + 1}`, true, `TRENCH: ${t.split(/[.:]/)[0].toUpperCase().slice(0, 56)}`,
    [['Fault', t], ['Basis', 'trench plan sized by rating, own code (indicative)']], 'IEC 60287-1-1 and IEC 60287-2-1 method (current rating of the grouped circuits)'));
  if (Number.isFinite(f.spareStrings)) {
    add('unconnected', f.spareStrings > 0, `${f.spareStrings} STRINGS UNCONNECTED`, [['Strings built', f.strings], ['Connected', f.connectedStrings],
      ['Unconnected', f.spareStrings]], 'IEC 62446-1 (every string tested and connected at commissioning)');
  }
  // Structure checks of the laid-out plant (structures.mjs): posts over the height limit, tracker cross slope, the MPPT cap.
  for (const c of f.plant ? structureChecks(f.plant) : []) add(c.id, c.failed, c.line, c.inputs, c.standard);
  return out;
}
/** The plant's string facts from its template (plant-template.mjs): its module as a one-bin class, its string length and
 * coldest cell, for the same string check the block uses; null without a plant. */
export function plantStringFacts(r, cat = null) {
  const p = r?.template?.params, mps = r?.template?.counts?.modulesPerString;
  if (!p || !(mps > 0)) return null;
  // The catalogue class the template's module came from (same highest-bin Voc and β), else a one-bin class of the typed values.
  const hi = c => Math.max(...c.electrical.bins.map(b => b.voc));
  const cls = (cat?.classes || []).find(c => hi(c) === p.moduleVoc && Math.abs(c.temp_coeff.voc - p.vocCoeffPerK * 100) < 1e-9)
    || typedClass({ wp: p.moduleWp, voc: p.moduleVoc, coeffPctPerK: p.vocCoeffPerK * 100 });
  return { cls, cat: { ...(cat || {}), system_voltage_V: p.systemV },
    mps, tempMinC: p.minCellC };
}
/** The structure facts of a plant layout result (plant-layout.mjs), or null. */
export function plantFacts(r) {
  if (!r) return null;
  return { piles: r.piles?.summary || null, rules: r.piles?.rules || null, tracker: !!r.table?.tracker, skipped: r.skipped, crossReview: r.crossReview || 0,
    crossReviewPct: r.params?.trackerCrossReviewPct, crossMaxPct: r.params?.trackerCrossMaxPct, counts: r.template?.counts, params: r.template?.params,
    tiltDeg: r.table?.south ? r.params?.tiltSouthDeg : null };
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
const dotted = (o, k) => (o && /^[\w.]+$/.test(k) ? k.split('.').reduce((a, p) => (a == null ? undefined : a[p]), o) : undefined) ?? undefined;
/** Each private check: worked out from the facts where it names one, else from its design value, else as the file states. */
export function evaluatePrivate(rules, facts = {}) {
  return rules.checks.map(c => {
    // A live fact wins (by name, or a dotted path into facts.$design); a null/absent value is "unknown", never a pass or a fail.
    const key = c.value || c.subject || c.metric, live = key == null ? undefined : facts[key] ?? dotted(facts.$design, key);
    const v = live ?? c.design_value ?? c.desk_value ?? undefined;
    const worked = v != null && c.limit != null ? compare(v, c.op, c.limit) : undefined;
    const failed = worked === undefined ? FAIL_STATUS.test(String(c.status ?? c.status_at_defaults ?? '')) : !worked;
    const what = String(c.topic || c.requirement || c.id).toUpperCase().slice(0, 48);
    const lim = Array.isArray(c.limit) ? c.limit.join('–') : c.limit;
    const line = `${c.id} ${what}${worked !== undefined ? ` · ${v} ${c.op} ${lim}${c.units || c.unit ? ' ' + (c.units || c.unit) : ''}` : ''}`;
    return { id: c.id, private: true, failed, live: live != null && worked !== undefined, line, working: { inputs: [['Requirement', c.requirement], ['Value', v ?? 'as stated in the file'],
      ['Test', c.op ? `${c.op} ${lim ?? ''}` : 'as stated'], ['Note', c.note || '']], standard: c.source || 'private rules', note: HUD_NOTE } };
  });
}

/** The HUD's lines: the failed checks, public first, private after (only when a local rules file is loaded), and the lines
 * always shown (the string voltage, neutral while it passes). A fixed check clears. */
export function hudLines(publicList, privateList = []) {
  return [...publicList, ...privateList].filter(c => c.failed || c.always);
}
