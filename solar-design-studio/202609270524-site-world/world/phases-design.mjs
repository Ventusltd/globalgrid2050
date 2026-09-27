// phases-design.mjs: derive construction items from a design. Pure: no imports, no DOM.
// itemsFromStore reads the viewer's own saved design (world.design.v1, design-store.mjs);
// itemsFromDesign reads an imported layout (the output of importDesign in design-import.mjs).
//
// What the design carries becomes items directly:
//   each cable run        -> a trench and the cable laid in it
//   each equipment solid  -> a pad and the equipment set on it
//   solar tables          -> one pile item per table
//   array boundary rings  -> a fence per outer ring
// What the design does not carry (roads, HDD bores, deliveries) is passed in
// by the caller as `roads`, `hdd` and `extra`; nothing is invented.

const EQUIPMENT_TYPES = new Set(['skid', 'inverter', 'transformer_compound', 'bess_container']);
const PHASE_KINDS = new Set(['road', 'pad', 'fence', 'pile', 'delivery', 'equipment', 'trench', 'hdd', 'cable']);
const LINKS = ['trench', 'hdd', 'pad', 'via', 'after'];

// A world.design.v1 document -> phases items. Links live in each item's params (trench, hdd, pad, via, after)
// and are lifted to the top level, so the ordering rules run on real designs. A cable with neither a trench nor
// a bore is laid in a trench of its own route ("<id>-trench"), as the viewer draws it. Kinds the phases do not
// sequence (a measurement, a note) are left out; opts.extra items are appended as given.
export function itemsFromStore(doc, opts = {}) {
  if (!doc || doc.schema !== 'world.design.v1' || !Array.isArray(doc.items)) {
    throw new Error('itemsFromStore: expected a world.design.v1 document');
  }
  const items = [];
  for (const it of doc.items) {
    if (!it || typeof it !== 'object') continue; // a damaged entry is left out, never a TypeError
    const kind = it.kind === 'piles' ? 'pile' : it.kind; // the Design panel stores pile rows as 'piles'
    if (!PHASE_KINDS.has(kind)) continue;
    const p = it.params || {}, item = { id: it.id, kind, geometry: it.points_bng };
    for (const k of LINKS) if (p[k] != null) item[k] = p[k];
    if (it.kind === 'cable' && item.trench == null && item.hdd == null) {
      items.push({ id: `${it.id}-trench`, kind: 'trench', geometry: it.points_bng });
      item.trench = `${it.id}-trench`;
    }
    items.push(item);
  }
  items.push(...(opts.extra || []));
  return items;
}

// opts.roads: [{ id?, points }]; opts.hdd: [{ id?, points, cables?: [cable index] }]
// (cables that pass through a bore are drawn in the bore instead of a trench);
// opts.extra: items in the phases.mjs shape, appended as given.
export function itemsFromDesign(design, opts = {}) {
  if (!design || typeof design !== 'object') throw new Error('itemsFromDesign: expected the importDesign result');
  const items = [];
  const roads = (opts.roads || []).map((r, i) => ({ id: r.id || `road-${i + 1}`, kind: 'road', geometry: r.points || null }));
  items.push(...roads);

  const boreOf = new Map();
  (opts.hdd || []).forEach((h, i) => {
    const id = h.id || `hdd-${i + 1}`;
    items.push({ id, kind: 'hdd', geometry: h.points || null });
    for (const c of h.cables || []) boreOf.set(c, id);
  });

  (design.outlines || []).filter(o => o.type === 'array_boundary' && !o.hole)
    .forEach((o, i) => items.push({ id: `fence-${i + 1}`, kind: 'fence', geometry: o.points }));

  (design.cables || []).forEach((c, i) => {
    const n = i + 1, bore = boreOf.get(i);
    const cable = { id: `cable-${n}`, kind: 'cable', role: c.role, geometry: c.points, lengthM: c.lengthM };
    if (bore) cable.hdd = bore;
    else {
      items.push({ id: `trench-${n}`, kind: 'trench', geometry: c.points, lengthM: c.lengthM });
      cable.trench = `trench-${n}`;
    }
    items.push(cable);
  });

  let e = 0;
  for (const s of design.solids || []) {
    if (!EQUIPMENT_TYPES.has(s.type)) continue;
    e++;
    items.push({ id: `pad-${e}`, kind: 'pad', geometry: s.quad || null, forType: s.type });
    items.push({ id: `equipment-${e}`, kind: 'equipment', pad: `pad-${e}`, type: s.type, geometry: s.quad || null });
  }

  (design.tables?.solids || []).forEach((t, i) => items.push({ id: `piles-${i + 1}`, kind: 'pile', geometry: t.quad || null }));

  items.push(...(opts.extra || []));
  return items;
}
