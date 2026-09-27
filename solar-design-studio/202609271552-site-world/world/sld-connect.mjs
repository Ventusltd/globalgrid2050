// sld-connect.mjs: which grid connection a plant gets, from its size and what is near it. Editable, illustrative rules;
// the network operator decides the real connection. One connection object serves the solar block, the single-line
// diagram and Follow (user test H4).
//   The voltage follows the plant's size: up to smallMaxMW at 33 kV, up to dnoMaxMW at 132 kV, up to midMaxMW at 275 kV,
//   above that 400 kV (a block with its own grid transformer connects at 132 kV at least).
//   275 and 400 kV: only through a bay at a substation of that voltage (within transSearchM), by fully ducted, unjointed
//   HV cable; never a tee into a transmission line.
//   132 kV and below: a cable to the nearest network operator substation of that voltage (within dnoSearchM); else a
//   tee into a line of that voltage within teeM (teeMaxKv at most); else no nearby connection (an assumed landing that
//   says so).
// Pure.

export const CONNECT_RULES = Object.freeze({ smallMaxMW: 30, dnoMaxMW: 150, midMaxMW: 400, teeM: 3000, teeMaxKv: 132, dnoSearchM: 30000,
  transSearchM: 40000 });
export const CONNECT_LABEL = 'Connection chosen by illustrative rules (size and distance); the network operator decides the real one.';

const nearest = (list, at, ok) => list.filter(x => ok(x) && Number.isFinite(x.e) && Number.isFinite(x.n))
  .map(x => ({ ...x, d: Math.hypot(x.e - at[0], x.n - at[1]) })).sort((a, b) => a.d - b.d)[0] || null;
const km = m => `${(m / 1000).toFixed(1)} km`;

/** The connection voltage for a plant of mw: 33, 132, 275 or 400 kV; minKv raises it (132 for a block with its own grid transformer). */
export function kvForMW(mw, { minKv = 0, rules = {} } = {}) {
  const R = { ...CONNECT_RULES, ...rules };
  const kv = mw <= R.smallMaxMW ? 33 : mw <= R.dnoMaxMW ? 132 : mw <= R.midMaxMW ? 275 : 400;
  return [33, 132, 275, 400].find(v => v >= Math.max(kv, minKv)) || 400;
}

/**
 * chooseConnection({ mw, at: [e, n], subs: [{ e, n, kv }], towers: [{ e, n, kv }], kv?, minKv?, rules }) ->
 *   { rule, text, kv, connection: 'cable' | 'ohl-tee' | 'none', route: 'cable' | 'overhead line' | null,
 *     landing: { e, n, kv, real, kind: 'gis-bay' | 'dno-sub' | 'tower' } | null }
 * kv: the voltage already fixed (the placed block's grid transformer); else by size.
 */
export function chooseConnection({ mw, at, subs = [], towers = [], kv: fixed = null, minKv = 0, rules = {} }) {
  const R = { ...CONNECT_RULES, ...rules }, kv = fixed || kvForMW(mw, { minKv, rules });
  const size = `${Math.round(mw)} MW`;
  if (kv >= 275) {
    const s = nearest(subs, at, x => x.kv === kv);
    if (s && s.d <= R.transSearchM) return { rule: `bay-${kv}`, kv, connection: 'cable', route: 'cable',
      text: `${size} at ${kv} kV: ducted, unjointed HV cable to a bay at the ${kv} kV substation ${km(s.d)} away (no tee at transmission voltage)`,
      landing: { e: s.e, n: s.n, kv, real: true, kind: 'gis-bay' } };
    return { rule: 'none', kv, connection: 'none', route: null, landing: null,
      text: `${size} at ${kv} kV: no ${kv} kV substation within ${km(R.transSearchM)}; the landing shown is an assumed point, not a substation` };
  }
  const s = nearest(subs, at, x => x.kv === kv);
  if (s && s.d <= R.dnoSearchM) return { rule: `dno-${kv}`, kv, connection: 'cable', route: 'cable',
    text: `${size} at ${kv} kV: cable to the nearest ${kv} kV network operator substation, ${km(s.d)} away`,
    landing: { e: s.e, n: s.n, kv, real: true, kind: 'dno-sub' } };
  const t = kv <= R.teeMaxKv ? nearest(towers, at, x => x.kv === kv) : null;
  if (t && t.d <= R.teeM) return { rule: `tee-${kv}`, kv, connection: 'ohl-tee', route: 'overhead line',
    text: `${size} at ${kv} kV: no ${kv} kV substation within ${km(R.dnoSearchM)}; overhead tee into the ${kv} kV line ${km(t.d)} away (illustrative)`,
    landing: { e: t.e, n: t.n, kv, real: true, kind: 'tower' } };
  return { rule: 'none', kv, connection: 'none', route: null, landing: null,
    text: `${size} at ${kv} kV: no nearby connection at ${kv} kV; the landing shown is an assumed point, not a substation` };
}
