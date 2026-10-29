// COPIED UNCHANGED from the v12 world (web/world/connect-here.mjs) at v12 commit 3adcee9 (file last changed 0562d4f). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// connect-here.mjs: the third step of the journey (owner direction 8.3): "connect here solar 50 at 132" drops a site where
// you stand and plans an illustrative cable back to the nearest substation at that voltage: route length, current, cable
// size, voltage drop and losses, each check cited by clause only. Pure: no DOM, no WebGL.
//
// Reuses, never rewrites: routeCable (cable-route.mjs) for the length, sizeFor / rating / impedance / dropPercent
// (cable-rating.mjs, the IEC 60287 steady-state rating) for the cable, and kvForMW (sld-connect.mjs) when no voltage is
// typed. Star families: no family found for an MV connection sizer; the parts above are the existing ones.
//
// What it is NOT: the route is a straight line from here to the substation's fence landing (the road and field-edge
// route is the next step), the cable build above 33 kV is scaled from the 33 kV one (own estimate), and the network
// operator decides the real connection. Every figure is early-design and says so.

import { routeCable } from './cable-route.mjs';
import { sizeFor, rating, dropPercent, RATING_DEFAULTS } from './cable-rating.mjs';
import { kvForMW } from './sld-connect.mjs';

export const CONNECT_KV = [11, 33, 66, 132, 275, 400];
export const CONNECT_PF = 0.95;           // assumed plant power factor at the point of connection (own assumption)
export const DROP_TARGET_PCT = 3;         // own early-design target, not a limit from any standard
export const MAX_CIRCUITS = 6;
export const CONNECT_LABEL = 'Illustrative early design: straight-line route, estimated cable build; the network operator decides the real connection.';
// Clauses cited, never copied.
export const CLAUSES = Object.freeze({
  rating: 'IEC 60287-1-1 cl. 2.1 (conductor a.c. resistance), IEC 60287-2-1 cl. 2.2 (external thermal resistance)',
  drop: 'ESQCR 2002 reg. 27(3) (declared voltage tolerance)',
  conductor: 'IEC 60228 (conductor classes; resistance estimated, not tabled)',
  lv: 'BS 7671 Reg. 525 applies at 1 kV and below only; not used for this MV/HV cable'
});
// Insulation thickness by voltage, own illustrative scaling from the 33 kV build (8 mm); a maker's data replaces it.
const INSULATION_MM = { 11: 3.4, 33: 8.0, 66: 11.0, 132: 18.0 };
const TECH = ['solar', 'bess', 'battery', 'load'];

const refuse = (msg, line) => ({ ok: false, error: msg, line: String(line || '').trim() });

// Pure: a typed line -> { ok, act: 'connect', arg: { tech, mw, kv } } | { ok: false, error } | null (not a connect line).
// connect here · connect here 132 · connect here solar 50 · connect here bess 40 at 132 kv · connect here 50 mw 33 kv
export function parseConnect(line) {
  const text = String(line || '').toLowerCase().replace(/#.*$/, '').replace(/\s+/g, ' ').trim();
  const m = text.match(/^connect(?: here)?(?: (.*))?$/);
  if (!m) return null;
  let rest = (m[1] || '').replace(/(\d)\s*(mw|kv)\b/g, '$1 $2').replace(/\bat\b/g, ' ').trim();
  const arg = { tech: null, mw: null, kv: null };
  const ws = rest.split(/\s+/).filter(Boolean);
  const nums = [];
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (TECH.includes(w)) { arg.tech = w === 'battery' ? 'bess' : w; continue; }
    if (/^\d+(\.\d+)?$/.test(w)) {
      const v = Number(w), unit = ws[i + 1];
      if (unit === 'kv') { arg.kv = v; i++; } else if (unit === 'mw') { arg.mw = v; i++; } else nums.push(v);
      continue;
    }
    return refuse(`connect here does not know "${w}": try connect here solar 50 at 132`, line);
  }
  // Bare numbers: with a technology the first is MW (connect here solar 50 132); a lone voltage word is kV.
  for (const v of nums) {
    if (arg.tech && arg.mw == null) arg.mw = v;
    else if (arg.kv == null && CONNECT_KV.includes(v)) arg.kv = v;
    else if (arg.mw == null) arg.mw = v;
    else return refuse(`connect here has one MW and one kV, not ${v} as well`, line);
  }
  if (arg.kv != null && !CONNECT_KV.includes(arg.kv)) return refuse(`${arg.kv} kV is not a connection voltage here (${CONNECT_KV.join(', ')})`, line);
  if (arg.mw != null && !(arg.mw > 0 && arg.mw <= 5000)) return refuse(`${arg.mw} MW is out of range`, line);
  if (arg.kv == null && arg.mw == null) return refuse('connect here takes a voltage or a size: connect here 132, or connect here solar 50', line);
  return { ok: true, verb: 'connect', act: 'connect', set: {}, line: String(line).trim(), arg };
}

/** The voltage to use: the typed one, else by plant size (sld-connect kvForMW). */
export const connectKv = ({ kv, mw }) => kv ?? kvForMW(mw);

/** The IEC 60287 rating options for a voltage: the 33 kV build with insulation scaled (own estimate). */
export function cableOpts(kv, extra = {}) {
  return { ...RATING_DEFAULTS, kv, u0Kv: kv / Math.sqrt(3), insulationMm: INSULATION_MM[kv] ?? RATING_DEFAULTS.insulationMm, ...extra };
}

const fmtLen = m => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

/**
 * planConnection({ from: {e,n}, to: {e,n}, kv, mw?, pf?, groundAt?, circuitGroupFactor? }) ->
 * { length, route, kv, mw, amps, cable: { area, circuits, amps, utilisation } | null, dropPct, lossKw, lossPct,
 *   checks: [{ id, pass, text, clause }], lines: [text], label }
 * The route runs from the site (here) to the substation's landing on its fence.
 */
export function planConnection({ from, to, kv, mw = null, pf = CONNECT_PF, groundAt = () => 0, circuitGroupFactor = 0.8 }) {
  if (!from || !to || ![from.e, from.n, to.e, to.n].every(Number.isFinite)) throw Error('planConnection needs two points in metres');
  if (!CONNECT_KV.includes(kv)) throw Error(`no connection voltage of ${kv} kV`);
  const ox = from.e, oy = from.n;       // work local to the site so the route keeps its precision
  const r = routeCable({ points: [[0, 0], [to.e - ox, to.n - oy]], depthBelowGround: 1.0, groundAt: (x, y) => groundAt(x + ox, y + oy), step: 25 });
  const length = r.length3d ?? r.length2d ?? Math.hypot(to.e - ox, to.n - oy);
  const out = { length, route: 'straight line (roads and field edges not yet followed)', kv, mw, pf, amps: null, cable: null,
    dropPct: null, lossKw: null, lossPct: null, checks: [], lines: [], label: CONNECT_LABEL };
  out.lines.push(`${kv} kV connection, ${fmtLen(length)} to the substation (straight line; a real route is longer)`);
  if (!(mw > 0)) { out.lines.push('Add a size to rate the cable: connect here solar 50 at ' + kv); return out; }
  const mva = mw / pf;
  out.amps = mva * 1e6 / (Math.sqrt(3) * kv * 1000);
  if (kv >= 275) {
    out.lines.push(`${Math.round(out.amps)} A at ${kv} kV: transmission cable sizing is not modelled here (a bay by ducted, unjointed cable)`);
    return out;
  }
  // Size: one circuit if one carries it, else parallel circuits with a stated grouping factor (own assumption).
  let pick = null;
  for (let n = 1; n <= MAX_CIRCUITS && !pick; n++) {
    const opts = cableOpts(kv, n > 1 ? { groupFactor: circuitGroupFactor } : {});
    const s = sizeFor(mva / n, opts);
    if (s) pick = { ...s, circuits: n, opts };
  }
  if (!pick) {
    out.checks.push({ id: 'rating', pass: false, clause: CLAUSES.rating, text: `No ${kv} kV cable here carries ${Math.round(out.amps)} A in ${MAX_CIRCUITS} circuits: connect at a higher voltage` });
    out.lines.push(out.checks[0].text);
    return out;
  }
  const { area, circuits, opts } = pick;
  const rr = rating(area, opts);
  out.cable = { area, circuits, amps: rr.amps, utilisation: pick.utilisation, metal: 'Al', insulation: 'XLPE', formation: 'trefoil' };
  out.dropPct = dropPercent(area, length, mva / circuits, { ...opts, pf });
  const iC = out.amps / circuits;
  out.lossKw = 3 * iC * iC * rr.R * length * circuits / 1000;     // I^2 R at the rated conductor temperature (upper bound)
  out.lossPct = out.lossKw / (mw * 1000) * 100;
  const statutory = kv >= 132 ? 10 : 6;
  out.checks.push(
    { id: 'rating', pass: pick.utilisation <= 1, clause: CLAUSES.rating,
      text: `${Math.round(iC)} A per circuit on ${circuits} x ${area} mm² Al XLPE trefoil rated ${Math.round(rr.amps)} A (${Math.round(pick.utilisation * 100)}%)` },
    { id: 'drop', pass: out.dropPct <= DROP_TARGET_PCT, clause: 'own early-design target',
      text: `voltage drop ${out.dropPct.toFixed(2)}% against a ${DROP_TARGET_PCT}% design target` },
    { id: 'statutory', pass: out.dropPct <= statutory, clause: CLAUSES.drop,
      text: `drop ${out.dropPct.toFixed(2)}% against the ±${statutory}% declared-voltage tolerance at ${kv} kV` });
  out.lines.push(
    `${mw} MW at pf ${pf}: ${Math.round(out.amps)} A; illustrative cable ${circuits > 1 ? circuits + ' x ' : ''}${area} mm² Al XLPE, trefoil, direct buried`,
    `voltage drop ${out.dropPct.toFixed(2)}% · losses ${out.lossKw.toFixed(0)} kW (${out.lossPct.toFixed(2)}%) at full output`,
    ...out.checks.filter(c => !c.pass).map(c => `FAIL ${c.text} (${c.clause})`));
  if (circuits > 1) out.lines.push(`grouping factor ${circuitGroupFactor} assumed for ${circuits} circuits (own assumption, not a tabled value)`);
  return out;
}
