// COPIED UNCHANGED from world/v12 journey.mjs at v12 commit 3adcee9 (file last changed f0fe9c2). Modular star family: public #133195 cardText.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// journey.mjs: the first step of the journey (owner direction 8): "go substation 132" goes to the nearest substation that
// works at 132 kV (or 400, 275, 66, 33, 11) and stands you outside its real compound fence (the footprints, lib.compound),
// looking in; "next substation" goes on to the next nearest at the same voltage. The place card says what it is: its
// levels, its network tier and where the outline came from. No names: the national index holds none, and the card shows
// voltages and the tier only. Levels come from OSM voltage tags (surveyed 27 Sept, ODbL); where a substation was not
// surveyed only the index's top voltage is known, and the card says so.

import { gridRef } from './bng.mjs';

export const STAND_BACK_M = 20;   // stand this far outside the fence point, looking in
export const STAND_PITCH = -0.3;  // radians below level: about 6 m eye height at 20 m back
export const KV_WORDS = [400, 275, 220, 132, 66, 33, 22, 11];
const CONF_WORDS = {
  measured: 'outline confirmed by LiDAR', operator: 'outline from the network operator', osm: 'outline from OpenStreetMap',
  'os-building': 'outline from an OS building only (weak)', assumed: 'size assumed for the voltage'
};

// Pure: a typed line -> { kv } | { next: true } | { error } | null (not a journey line).
export function parseJourney(line) {
  const t = String(line || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^next (substation|sub)$/.test(t)) return { next: true };
  const m = t.match(/^(?:go|go to|fly to|goto) (?:substation|sub)(?: (\d+(?:\.\d+)?) ?(kv)?)?$/);
  if (!m) return null;
  if (!m[1]) return { error: `go substation takes a voltage in kV: ${KV_WORDS.join(', ')} (e.g. go substation 132)` };
  const kv = Number(m[1]);
  return kv > 0 && kv < 1000 ? { kv } : { error: `${m[1]} is not a voltage in kV` };
}

// Pure: where to stand for substation s (s.e, s.n, s.fp) given the landing on its fence (lib.compound landing(), or the
// index point where there is no outline): flyTo(e, n, opts) looks at the fence point from STAND_BACK_M outside it.
export function standAt(s, land) {
  const lx = land?.e ?? s.e, ly = land?.n ?? s.n;
  let dx = s.e - lx, dy = s.n - ly;
  if (Math.hypot(dx, dy) < 0.5) { dx = 0; dy = 1; }         // no fence point: look north at the index point
  const yaw = Math.atan2(dx, dy);                             // heading from the fence point to the centre
  return { e: lx, n: ly, opts: { yaw, back: STAND_BACK_M, pitch: STAND_PITCH },
    eye: { e: lx - STAND_BACK_M * Math.sin(yaw), n: ly - STAND_BACK_M * Math.cos(yaw) } };
}

const kvText = v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));

// Pure: the card's two lines for substation s reached at kv: { name, detail }.
export function cardText(s, kv, d, land) {
  const lv = Array.isArray(s.levels) && s.levels.length ? s.levels : null;
  const name = lv && lv.length > 1 ? `${kvText(kv)} kV substation (${lv.map(kvText).join('/')} kV)` : `${kvText(kv)} kV substation`;
  let ref = '';
  try { ref = gridRef(s.e, s.n, 8); } catch { /* off the national grid */ }
  const bits = [ref, s.tier ? `${s.tier} tier` : '', lv ? 'levels from OSM voltage tags' : 'top voltage only (not surveyed)',
    s.fp ? (CONF_WORDS[s.fp.conf] || 'outline') + (land?.fence ? `, at the ${land.side ? land.side + ' ' : ''}fence` : '') : 'no outline: at the index point',
    Number.isFinite(d) ? `${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'} from where you were` : '',
    '© OpenStreetMap contributors, ODbL'];
  return { name, detail: bits.filter(Boolean).join(' · ') };
}

// deps: { world (window.world), grid () -> the live grid layer, doc }. Keeps the voltage and the substations visited, so
// "next substation" moves on without going back.
export function createJourney({ world, grid, doc = globalThis.document }) {
  let kv = null, seen = [], last = null;
  const here = () => { const s = world.state(), o = world.origin(); return { e: o.e + s.pos[0], n: o.n + s.pos[1] }; };
  const $ = id => doc?.getElementById?.(id);
  function show(card) {
    if (!$('place')) return;
    $('place-name').textContent = card.name; $('place-grid').textContent = card.detail; $('place-terrain').textContent = '';
    $('place').hidden = false;
  }
  async function goTo(v, fresh) {
    const G = grid();
    if (!G?.substationsAtKv) return 'The grid layer is not loaded here: turn on Grid in Layers, then try again.';
    const from = here();
    const [hit] = await G.substationsAtKv(from.e, from.n, v, { skip: fresh ? [] : seen });
    if (!hit) return fresh ? `No ${kvText(v)} kV substation in the national index.` : `No more ${kvText(v)} kV substations to visit.`;
    const s = hit.s, C = G.compoundLib?.();
    const land = C && s.fp ? C.landing(s, from.e, from.n) : null;
    const st = standAt(s, land);
    kv = v; seen = fresh ? [s.id] : [...seen, s.id];
    last = { id: s.id, e: s.e, n: s.n, kv: v, levels: s.levels || null, tier: s.tier, conf: s.fp?.conf || null,
      fence: !!land?.fence, side: land?.side || null, stand: st, d: hit.d };
    world.flyTo(st.e, st.n, st.opts);
    const card = cardText(s, v, hit.d, land);
    show(card);
    return `${card.name}: ${card.detail}.`;
  }
  return {
    go: v => goTo(v, true),
    next: () => (kv == null ? 'Type go substation 132 (or 400, 275, 66, 33, 11) first.' : goTo(kv, false)),
    last: () => (last ? { ...last } : null), visited: () => [...seen]
  };
}
