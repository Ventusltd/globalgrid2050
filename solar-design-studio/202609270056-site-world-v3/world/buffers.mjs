// Buffers: offset zones around features in the world data, and a clash check for drawn items.
// Pure: no DOM. Every distance carries its source and a kind:
//   statutory  set by law or regulation (often a permit trigger rather than a ban; the note says which)
//   guidance   a published standard or regulator's guidance, followed in practice and often made binding by conditions
//   typical    common practice with no single rule; confirm with the authority named in the note
//   assumed    a value this tool supplies where the data has none (a width, a stem size); replace it when known
// A zone's distance is measured from the feature's line or outline in the data; parts[] break it into cited pieces.
// England and Wales rules. Scotland and Northern Ireland have their own regimes: check before relying on these.

import { offset, cleanPath } from './offset.mjs';

export const SOURCES = {
  GS6: 'HSE Guidance Note GS6 (fourth edition, 2013), Avoiding danger from overhead power lines: ground-level barriers '
    + 'at least 6 m horizontally from the nearest wire of a wood-pole line and 10 m from a steel-tower line',
  ESQCR: 'Electricity Safety, Quality and Continuity Regulations 2002 (SI 2002/2665), regulation 17 and Schedule 2: minimum '
    + 'height of overhead conductors above ground; clearances applied as in ENA Technical Specification 43-8, Overhead line clearances',
  EPR: 'Environmental Permitting (England and Wales) Regulations 2016, Schedule 25 (flood risk activities); GOV.UK guidance '
    + '"Flood risk activities: environmental permits": a permit is needed for work within 8 m of the bank of a main river, 16 m if tidal',
  EA_BYELAWS: 'Environment Agency regional land drainage byelaws: consent for works near a main river, commonly within 8 m; the '
    + 'distance varies by region',
  IDB: 'Internal drainage board byelaws (model land drainage byelaws): consent needed within 9 m of a board-maintained watercourse; '
    + 'the distance varies by board',
  BS5837: 'BS 5837:2012 Trees in relation to design, demolition and construction, clause 4.6: root protection area radius '
    + '12 x stem diameter measured at 1.5 m above ground, capped at 707 m2 (15 m radius)',
  ROAD: 'No single national setback. The highway boundary and any building or improvement line are set by the local highway authority',
  ASSUMED: 'Assumed by this tool where the data gives no value; replace with a measured or surveyed figure',
  USER: 'Set by the designer on the drawn item'
};

// Overhead lines. Half-spread: centreline to outermost conductor at rest (ASSUMED typical cross-arm geometry,
// not measured). Support: wood poles for 33 kV and below, steel towers above (ASSUMED; some 66 and 132 kV lines
// are on wood poles, so a line may say support: 'pole' | 'tower'). Heights: statutory minimum above ground.
export const OVERHEAD = {
  '33kV': { halfSpread: 1.0, support: 'pole', minHeight: 5.2 },
  '66kV': { halfSpread: 2.5, support: 'tower', minHeight: 6.0 },
  '132kV': { halfSpread: 4.0, support: 'tower', minHeight: 6.7 },
  '275kV': { halfSpread: 6.0, support: 'tower', minHeight: 7.0 },
  '400kV': { halfSpread: 6.5, support: 'tower', minHeight: 7.3 }
};
export const GS6_BARRIER = { pole: 6, tower: 10 };
export const WATER = { main: 8, tidal: 16, idb: 9, halfWidth: 1 }; // halfWidth: ASSUMED centreline to bank
export const ROAD_SETBACK = 3;                                     // TYPICAL, from the carriageway edge
export const ROAD_WIDTH = { motorway: 11, A: 7.3, B: 6.5, minor: 5.5, local: 4.8, track: 3 }; // ASSUMED, as the ways layer
export const RPA = { perMm: 0.012, cap: 15 };                        // 12 x stem diameter; 707 m2 cap = 15 m radius
export const DEFAULT_STEM_MM = { tree: 300, hedge: 200 };             // ASSUMED where the data gives no stem

// Nominal kV -> class. Bands: >= 345 is 400 kV, >= 220 is 275 kV, >= 100 is 132 kV, >= 50 is 66 kV, else 33 kV.
export function voltageClass(kv) {
  const v = Number(kv);
  if (!(v > 0)) return '33kV';
  return v >= 345 ? '400kV' : v >= 220 ? '275kV' : v >= 100 ? '132kV' : v >= 50 ? '66kV' : '33kV';
}

const part = (what, m, kind, source) => ({ what, m, kind, source });
const sum = parts => parts.reduce((s, p) => s + p.m, 0);

// Pure: the rule for one overhead line -> { rule, kind, distance, parts, note }.
export function overheadRule(line) {
  const cls = voltageClass(line.voltage_kv), o = OVERHEAD[cls];
  const support = line.support === 'pole' || line.support === 'tower' ? line.support : o.support;
  const parts = [
    part('centreline to outermost conductor', o.halfSpread, 'assumed', SOURCES.ASSUMED),
    part(`barrier distance from the nearest wire (${support === 'pole' ? 'wood poles' : 'steel towers'})`, GS6_BARRIER[support], 'guidance', SOURCES.GS6)
  ];
  return { rule: `overhead-${cls}`, kind: 'guidance', distance: sum(parts), parts,
    note: `${cls} line. No work, storage or plant within the zone without the network operator's agreement. Conductors must stay `
      + `at least ${o.minHeight} m above ground (statutory: ${SOURCES.ESQCR}). Conductor swing in wind is not included.` };
}

// Pure: the rule for one watercourse. main: true | false | undefined (unknown), tidal, idb, width_m.
export function waterRule(w) {
  const half = w.width_m > 0 ? w.width_m / 2 : WATER.halfWidth;
  const halfPart = part('centreline to bank', half, w.width_m > 0 ? 'typical' : 'assumed', w.width_m > 0 ? 'Width from the data' : SOURCES.ASSUMED);
  if (w.main === false) {
    const parts = [halfPart, part('from the bank of a board-maintained watercourse', WATER.idb, 'typical', SOURCES.IDB)];
    return { rule: 'water-ordinary', kind: 'typical', distance: sum(parts), parts,
      note: 'Ordinary watercourse. Consent from the drainage board or lead local flood authority applies where it has byelaws.' };
  }
  const tidal = !!w.tidal, m = tidal ? WATER.tidal : WATER.main;
  const parts = [halfPart, part(`from the bank of a ${tidal ? 'tidal ' : ''}main river`, m, 'statutory', SOURCES.EPR)];
  return { rule: tidal ? 'water-main-tidal' : 'water-main', kind: 'statutory', distance: sum(parts), parts,
    note: (w.main === true ? 'Main river. ' : 'Main river status not in the data: treated as a main river until the Environment Agency '
      + 'main rivers map says otherwise. ') + `A permit trigger, not a ban. Byelaws may also apply: ${SOURCES.EA_BYELAWS}.` };
}

// Pure: the rule for one road (class and width_m as in the ways files).
export function roadRule(r) {
  const w = r.width_m > 0 ? r.width_m : ROAD_WIDTH[r.class] || ROAD_WIDTH.local;
  const parts = [part('centreline to carriageway edge', w / 2, r.width_m > 0 ? 'typical' : 'assumed', r.width_m > 0 ? 'Width from the data' : SOURCES.ASSUMED),
    part('setback from the carriageway edge', ROAD_SETBACK, 'typical', SOURCES.ROAD)];
  return { rule: 'road-setback', kind: 'typical', distance: sum(parts), parts, note: `${r.class || 'Road'}: a typical setback only. ${SOURCES.ROAD}.` };
}

// Pure: BS 5837 stem diameter for one or several stems (mm). Two to five stems combine as sqrt(sum of squares).
export function stemDiameterMm(t, fallback) {
  const s = Array.isArray(t.stems_mm) ? t.stems_mm.filter(v => v > 0) : t.stem_mm > 0 ? [t.stem_mm] : [];
  if (!s.length) return { mm: fallback, assumed: true };
  return { mm: s.length === 1 ? s[0] : Math.sqrt(s.reduce((a, v) => a + v * v, 0)), assumed: false, stems: s.length };
}

// Pure: root protection area rule for a tree or hedge.
export function rootRule(t, what) {
  const st = stemDiameterMm(t, DEFAULT_STEM_MM[what]);
  const r = Math.min(RPA.cap, st.mm * RPA.perMm);
  const parts = [part(`root protection radius (stem ${Math.round(st.mm)} mm${st.assumed ? ', assumed' : ''})`, r, st.assumed ? 'assumed' : 'guidance',
    st.assumed ? `${SOURCES.BS5837}. Stem size: ${SOURCES.ASSUMED}` : SOURCES.BS5837)];
  const note = (st.stems > 5 ? 'More than five stems: BS 5837 uses a different combination; check the survey. ' : '')
    + (what === 'hedge' ? 'Measured from the hedge line. ' : '') + 'A tree survey to BS 5837 replaces these figures.';
  return { rule: what === 'hedge' ? 'hedge-rpa' : 'tree-rpa', kind: st.assumed ? 'assumed' : 'guidance', distance: sum(parts), parts, note };
}

// Pure: the rule for a drawn item that carries its own buffer_m.
export function drawnRule(item) {
  const parts = [part(`clearance around the drawn ${item.kind || 'item'}`, +item.buffer_m, 'typical', SOURCES.USER)];
  return { rule: 'drawn-clearance', kind: 'typical', distance: sum(parts), parts, note: 'A clearance chosen by the designer.' };
}

const ptsOf = f => f.points || f.pts || (f.at ? [f.at] : Number.isFinite(f.x) ? [[f.x, f.y]] : Number.isFinite(f.e) ? [[f.e, f.n]] : []);
const AREA_KINDS = new Set(['pad', 'table']);

// Pure: zones for the world. world: { overhead, water, roads, trees, hedges, drawn } lists (any may be missing).
// origin { e, n }: subtracted from every point, so national-grid data becomes local metres (drawn items are
// already local and are never shifted). Returns [{ id, layer, feature, rule, kind, distance, parts, note, geometry, rings }].
export function buildZones(world = {}, { origin = null, segments } = {}) {
  const zones = [], shift = (pts, local) => (origin && !local ? pts.map(p => [p[0] - origin.e, p[1] - origin.n]) : pts.map(p => [p[0], p[1]]));
  const add = (layer, list, ruleFor, shape) => (Array.isArray(list) ? list : []).forEach((f, i) => {
    if (!f) return;
    const r = ruleFor(f);
    if (!r || !(r.distance > 0)) return;
    const pts = cleanPath(shift(ptsOf(f), layer === 'drawn'), shape(f).closed);
    if (!pts.length) return;
    const geometry = { pts, ...shape(f) };
    const { rings } = offset(pts, r.distance, { ...geometry, segments });
    zones.push({ id: `${layer}/${f.id ?? i}`, layer, feature: f.id ?? i, ...r, geometry, rings });
  });
  const line = () => ({ closed: false, area: false });
  add('overhead', world.overhead, overheadRule, line);
  add('water', world.water, waterRule, line);
  add('roads', world.roads, roadRule, line);
  add('trees', world.trees, t => rootRule(t, 'tree'), t => ({ closed: false, area: ptsOf(t).length > 2 }));
  add('hedges', world.hedges, h => rootRule(h, 'hedge'), line);
  add('drawn', world.drawn, d => (d.buffer_m > 0 ? drawnRule(d) : null), d => ({ closed: AREA_KINDS.has(d.kind), area: AREA_KINDS.has(d.kind) }));
  return zones;
}

export { offset };
export { checkClashes, itemGeometry, distToGeometry, geometryDistance, ITEM_WIDTH } from './clash.mjs';
