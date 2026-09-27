// build-cmd.mjs: the typed side of build mode. Every click in build mode has a line, and every line can be typed:
//   build table [at E N] · build inverter [at E N] · build undo · build clear · build done · build (status)
//   build string N (modules in series) · build mppt N (MPPT inputs an inverter) · build trench W (DC trench, m) · build slope N (%)
// parseBuild(line) -> null when the line is not a build line (the command line's own grammar takes it), else
// { ok: true, act, kind?, at?, key?, value? } or { ok: false, why }. Values are guarded by cmd-grammar.mjs's own table,
// so a slip reads the same ("trench width must be a number from 0.25 to 3 m; you typed 45. Did you mean 0.45 m?").
// Pure: no DOM.

import { guard } from './cmd-grammar.mjs';

export const BUILD_USAGE = ['build table', 'build table at 399121 208440', 'build inverter at 399160 208430', 'build undo', 'build clear',
  'build done', 'build string 28', 'build mppt 12', 'build trench 0.55', 'build slope 15'];
const SETTINGS = { string: ['mps', 'modules in series'], mppt: ['mppt', 'MPPT inputs an inverter'], trench: ['width', 'DC trench width'], slope: ['slope', 'slope limit'] };
const no = why => ({ ok: false, why: `${why} Nothing was changed.` });

export function parseBuild(line) {
  const t = String(line || '').toLowerCase().replace(/#.*$/, '').replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (t[0] !== 'build' && t[0] !== 'place') return null;
  const [, w, ...rest] = t;
  if (!w || w === 'status') return { ok: true, act: 'status' };
  if (['undo', 'clear', 'done', 'off'].includes(w)) return rest.length ? no(`build ${w} takes nothing after it.`) : { ok: true, act: w === 'off' ? 'done' : w };
  if (w === 'table' || w === 'tables' || w === 'inverter' || w === 'inverters') {
    const kind = w.startsWith('table') ? 'table' : 'inverter';
    if (!rest.length) return { ok: true, act: 'place', kind, at: null };
    const nums = rest[0] === 'at' ? rest.slice(1).map(Number) : [];
    if (nums.length !== 2 || !nums.every(Number.isFinite)) return no(`build ${kind} takes "at" and an easting and northing in metres, e.g. build ${kind} at 399121 208440.`);
    const [e, n] = nums;
    if (!(e > 0 && e < 700000 && n > 0 && n < 1300000)) return no('the easting and northing are national-grid metres (easting 0 to 700000).');
    return { ok: true, act: 'place', kind, at: { e, n } };
  }
  if (SETTINGS[w]) {
    const [key, label] = SETTINGS[w], m = String(rest.find(x => x !== 'width' && x !== 'min' && x !== 'max') || '').match(/^(-?\d+(?:\.\d+)?)(m|cm|mm|%)?$/);
    if (!m) return no(`build ${w} needs a number (${label}), e.g. ${BUILD_USAGE.find(u => u.startsWith('build ' + w))}.`);
    let v = Number(m[1]);
    if (key === 'width' && (m[2] === 'cm' || m[2] === 'mm')) v /= m[2] === 'cm' ? 100 : 1000;
    if (key === 'mppt') { if (!(Number.isInteger(v) && v >= 1 && v <= 24)) return no(`MPPT inputs an inverter must be a whole number from 1 to 24; you typed ${v}.`); }
    else { const g = guard(key, v); if (g) return no(g.replace('trench width', 'DC trench width') + '.'); }
    return { ok: true, act: 'set', key: { mps: 'mps', mppt: 'mppt', width: 'trenchW', slope: 'slopePct' }[key], value: v };
  }
  return no(`build does not read "${w}". Try ${BUILD_USAGE.slice(0, 3).join(', ')}, build undo.`);
}

/** The typed lines for settings that differ from the defaults (a saved design replays them first). */
export function settingLines(P, D) {
  const out = [];
  if (P.mps !== D.mps) out.push(`build string ${P.mps}`);
  if (P.mppt !== D.mppt) out.push(`build mppt ${P.mppt}`);
  if (P.trenchW !== D.trenchW) out.push(`build trench ${P.trenchW}`);
  if (P.slopePct !== D.slopePct) out.push(`build slope ${P.slopePct}`);
  return out;
}
