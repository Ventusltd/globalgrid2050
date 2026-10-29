// COPIED UNCHANGED from the v12 world (web/world/site-checks.mjs) at v12 commit 3adcee9 (file last changed a83209f). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// site-checks.mjs: two honesty checks on the data a plant is drawn from, raised as notes, never as refusals.
//
// SURVEY DATE  A ground survey (LiDAR) flown before a plant was planned or built shows the land, not the plant: its
//   surface has no rows, so it can never confirm what the layout draws. An open-data study of large operational UK
//   solar farms found this at most of them (the public 1 m survey predated the build). When the site's data gives the
//   survey date and a planning or commissioning date, a survey older than either is said: "Ground survey predates
//   this layout". Dates come from a data field (a site record or the terrain index); none given, nothing is said.
// CONFLICTING SOURCES  Two open sources that give one quantity (a capacity, a place) differently, beyond a tolerance,
//   are flagged with both values and the size of the gap, not settled by picking one.
// Pure: no DOM, no imports.

/** A date field as a sortable day number (ms since 1970); '2020', '2020-11' and '2020-11-05' are all read. */
export function dayOf(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(String(v).trim());
  return m ? Date.UTC(Number(m[1]), (Number(m[2]) || 1) - 1, Number(m[3]) || 1) : null;
}

/**
 * surveyCheck({ groundDate, planningDate, commissionedDate }) -> { checked, predates, against, line }
 * checked is false when the survey date or both plant dates are missing.
 */
export function surveyCheck(s = {}) {
  const g = dayOf(s.groundDate), plan = dayOf(s.planningDate), built = dayOf(s.commissionedDate);
  if (g == null || (plan == null && built == null)) return { checked: false, predates: false, against: null, line: '' };
  const later = [['planning', plan, s.planningDate], ['commissioning', built, s.commissionedDate]].filter(([, d]) => d != null && g < d);
  if (!later.length) return { checked: true, predates: false, against: null, line: `Ground survey ${s.groundDate} is after the plant's dates: it can show what was built.` };
  const [what, , when] = later.at(-1);
  return { checked: true, predates: true, against: what,
    line: `Ground survey predates this layout: flown ${s.groundDate}, before ${what} (${when}). The survey shows the land, not a plant; `
      + 'rows drawn here are illustrative and no plant in the survey confirms them.' };
}
/** The note a layout carries for its survey, or '' (no dates, or a survey after the plant). */
export const surveyNote = s => { const c = surveyCheck(s || {}); return c.predates ? c.line : ''; };

/**
 * sourceConflict([{ source, value }], { tolerance = 0.1, unit = '' }) -> null | { values, spread, line }
 * spread: (largest - smallest) / smallest. Flagged over the tolerance; both ends named by their generic source label.
 */
export function sourceConflict(values = [], { tolerance = 0.1, unit = '' } = {}) {
  const v = values.filter(x => Number.isFinite(x?.value) && x.value > 0);
  if (v.length < 2) return null;
  const lo = v.reduce((a, b) => (b.value < a.value ? b : a)), hi = v.reduce((a, b) => (b.value > a.value ? b : a)), spread = (hi.value - lo.value) / lo.value;
  if (spread <= tolerance + 1e-12) return null;
  return { values: v, spread, line: `Sources disagree: ${hi.source} gives ${hi.value}${unit ? ' ' + unit : ''}, ${lo.source} gives ${lo.value}${unit ? ' ' + unit : ''} `
    + `(${Math.round(spread * 100)} % apart). Both are kept; neither is picked.` };
}
