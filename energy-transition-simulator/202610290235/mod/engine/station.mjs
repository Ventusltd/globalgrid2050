// COPIED UNCHANGED from the v12 world (web/world/station.mjs) at v12 commit 3adcee9 (file last changed e22776b). Modular star family: public #145809 tableShape.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// Solar station library: paired tables, pole inverters, DC home cables in ducts, AC trenches, 2 x 5 MVA.
// The world draws it through block-build.mjs (Design > Solar block): placed on the measured ground, built in sequence.
//
// Source: graphics-engines-open-source, web/explore.mjs at commit 826c0df4e94b46d9b96c5fb9bfcffab52851f03a
// (branch improve/20260926, 26 Sept 2026; the explorer file there equals the working tree). Lifted lines:
//   L82  dcLayout / blockLayout defaults       L87  stationTableOrigin      L88 defaultInverterSite
//   L92  blockPosition                         L93  blockStrings (stationMode branch: index < 672, 24 per inverter)
//   L95  dcOrder (sequential / leapfrog)       L96  ridgeHeight             L97 dcDucts (4 per inverter)
//   L101 drawPoleInverter (box and pole)       L100 drawTransformer (4 x 4 x 3 m, 12 x 10 m pad)
//   L118 acLayout (28 inverters, 14 per transformer, trefoil, 0.9 m)      L120-121 collectorX / acRoute, L123 acTrenches
//   L127-128 compoundBox / drawCompound (12 m margin, 2.4 m fence)        L143 stationInventory
//   L8   stationTransformers [[155,320,1.5],[155,345,1.5]]
// The same functions sit at L68-74 and L106-108 on origin/main 037e2f79a1493a3ef422807b274c6c22ef7dc9a7.
//
// Pure functions, no globals. Geometry is local east/north/up metres. station() places it relative to a
// placement point and a heading (radians, compass: 0 = the station's +y points north, pi/2 = east).
// Labels are the source's own: equipment positions, cable routes and duct size are assumed/illustrative,
// not surveyed, and no isolators are modelled.

const RAD = Math.PI / 180;

export const STATION_DEFAULTS = Object.freeze({
  // startStation() settings (explorer L142)
  height: 1.2, tilt: 10, tables: 23, columns: 90, rows: 5, moduleWidth: 1.303, moduleLength: 2.384, moduleGap: 0.02,
  // blockLayout (L82)
  rowGap: 8, aisleGap: 10, ridgeGap: 0.5,
  // electrical (L80, L143)
  moduleW: 660, modulesPerString: 30, stringsPerInverter: 24, inverters: 28, invertersPerTransformer: 14,
  inverterKVA: 352, transformerMVA: 5, transformers: [[155, 320, 1.5], [155, 345, 1.5]],
  // dcLayout (L82); duct diameter is flagged as assumed by the source (dcWiring: ductDiameterAssumed)
  wiring: 'sequential', dcDepth: 0.6, ductDiameter: 0.09, ductsPerInverter: 4, ductSpacing: 0.12,
  // acLayout (L118); cable 400 mm2 Al, 800 V (acRoute labels)
  acDepth: 0.9, formation: 'trefoil', acDiameter: 0.0374, acAreaMm2: 400, acVolts: 800, collectorOffset: 15,
  // world-only: the underside of a table solid. Assumed, not from the source: the lowest module edge sits
  // at `height`; purlins and rails are taken to hang 0.3 m below it. A drone flies under, a walker does not.
  tableUnderside: 0.9
});

const cfg = p => ({ ...STATION_DEFAULTS, ...(p || {}) });

// Table cross-section: the run of one face up the slope, its plan depth, span along y, ridge height.
export function tableShape(params) {
  const s = cfg(params), run = s.rows * (s.moduleLength + s.moduleGap) - s.moduleGap;
  return {
    run, depth: run * Math.cos(s.tilt * RAD), span: s.columns * (s.moduleWidth + s.moduleGap) - s.moduleGap,
    ridge: s.height + run * Math.sin(s.tilt * RAD), halfRidgeGap: s.ridgeGap / 2
  };
}

// blockPosition / stationTableOrigin (L87, L92): four paired tables across, then the next aisle.
export function tableOrigin(n, params) {
  const s = cfg(params), { depth, span } = tableShape(s);
  return [(n % 4) * (2 * depth + s.ridgeGap + s.rowGap), Math.floor(n / 4) * (span + s.aisleGap)];
}

export const stringsPerTable = params => { const s = cfg(params); return 2 * s.rows * Math.ceil(s.columns / s.modulesPerString); };

// blockStrings (L93), station branch: every face-row is cut into 30-module strings; the first
// inverters x stringsPerInverter strings in build order are connected, the rest are spare (assigned elsewhere).
export function tableStrings(params, { corners = true } = {}) {
  const s = cfg(params), t = s.tilt * RAD, { depth, halfRidgeGap: g } = tableShape(s), out = [];
  const connectedLimit = s.inverters * s.stringsPerInverter, groups = Math.ceil(s.columns / s.modulesPerString);
  for (let n = 0; n < s.tables; n++) {
    const [x, y] = tableOrigin(n, s);
    for (const side of [-1, 1]) for (let r = 0; r < s.rows; r++) for (let group = 0; group < groups; group++) {
      const modules = [];
      for (let c = group * s.modulesPerString; c < Math.min(s.columns, (group + 1) * s.modulesPerString); c++) {
        const v = (side === 1 ? s.rows - 1 - r : r) * (s.moduleLength + s.moduleGap), u = c * (s.moduleWidth + s.moduleGap);
        const p = (dv, du) => [x + side * (g + depth - (v + dv) * Math.cos(t)), y + u + du, s.height + (v + dv) * Math.sin(t)];
        const m = { terminal: p(s.moduleLength / 2, s.moduleWidth / 2), minus: p(s.moduleLength / 2, s.moduleWidth / 2 - 0.42), plus: p(s.moduleLength / 2, s.moduleWidth / 2 + 0.42) };
        if (corners) m.corners = [p(0, 0), p(s.moduleLength, 0), p(s.moduleLength, s.moduleWidth), p(0, s.moduleWidth)];
        modules.push(m);
      }
      const index = out.length, connected = index < connectedLimit;
      out.push({ index, table: n, side, row: r, group, connected, inverter: connected ? Math.floor(index / s.stringsPerInverter) : null, modules });
    }
  }
  return out;
}

// dcOrder (L95): the order modules are linked in series. Leapfrog runs out on evens, back on odds.
export function dcOrder(n, wiring = 'sequential') {
  if (wiring === 'sequential') return Array.from({ length: n }, (_, i) => i);
  const a = [];
  for (let i = 0; i < n; i += 2) a.push(i);
  for (let i = n % 2 ? n - 2 : n - 1; i >= 1; i -= 2) a.push(i);
  return a;
}

// Series links of one string as polylines (module + to next module -, dropped 8 cm onto a rail; L94).
export function seriesLinks(string, wiring = 'sequential') {
  const order = dcOrder(string.modules.length, wiring), links = [];
  for (let i = 1; i < order.length; i++) {
    const a = string.modules[order[i - 1]].plus, b = string.modules[order[i]].minus, dx = order[i] > order[i - 1] ? 0.05 : -0.05;
    links.push([a, [a[0] + dx, a[1], a[2] - 0.08], [b[0] + dx, b[1], b[2] - 0.08], b]);
  }
  return links;
}

// defaultInverterSite (L88): one pole per 24 strings, at the end (y - 1 m) of the table that feeds it;
// shifted 1.2 m when the inverter's first string starts 24 strings into a 30-string table. Top at ridge height.
export function inverterSite(k, params) {
  const s = cfg(params), spt = stringsPerTable(s), first = k * s.stringsPerInverter;
  const [x, y] = tableOrigin(Math.floor(first / spt), s);
  return [x + (first % spt === s.stringsPerInverter ? 1.2 : 0), y - 1, tableShape(s).ridge];
}

// dcDucts (L97): four ducts per inverter, 0.12 m apart, 2 m run at DC depth then up the pole to top - 0.9 m.
// Each duct carries up to 6 strings, a + and a - home cable each (dcWiring: L112 of origin/main).
export function dcDucts(sites, params) {
  const s = cfg(params), per = Math.ceil(s.stringsPerInverter / s.ductsPerInverter);
  return sites.flatMap((p, i) => Array.from({ length: s.ductsPerInverter }, (_, d) => {
    const x = p[0] + (d - (s.ductsPerInverter - 1) / 2) * s.ductSpacing, strings = Math.min(per, Math.max(0, s.stringsPerInverter - d * per));
    return { inverter: i + 1, duct: d + 1, diameter: s.ductDiameter, diameterAssumed: true, strings, positiveCables: strings, negativeCables: strings,
      points: [[x, p[1] - 2, -s.dcDepth], [x, p[1], -s.dcDepth], [x, p[1], p[2] - 0.9]] };
  }));
}

// updateBlockRoutes (explorer, station branch): each connected string's two home cables, in string order. From the
// end module's terminal onto the rail (8 cm down), along the rail to the table end (y - 1), down to DC depth, along
// to the inverter's duct (6 strings a duct, 4 ducts), 2 m past the pole and back, up the pole to top - 0.9 m.
export function dcHomeRoutes(strings, sites, params) {
  const s = cfg(params), count = new Map(), out = [];
  strings.filter(x => x.connected).forEach((string, i) => {
    const slot = count.get(string.inverter) || 0;
    count.set(string.inverter, slot + 1);
    if (slot >= s.stringsPerInverter || string.modules.length > s.modulesPerString) throw Error('too many strings for one inverter');
    const order = dcOrder(string.modules.length, s.wiring), dest = sites[string.inverter], duct = Math.floor(slot / 6);
    const [, ty] = tableOrigin(string.table, s), ductX = dest[0] + (duct - 1.5) * s.ductSpacing, d = s.dcDepth;
    for (const end of [0, 1]) {
      const p = end ? string.modules[order.at(-1)].plus : string.modules[order[0]].minus;
      const offset = ((slot % 6) * 2 + end - 5.5) * 0.004, railZ = p[2] - 0.08, x = ductX + offset, y = dest[1];
      const points = [p, [p[0] + offset, p[1], railZ], [p[0] + offset, ty - 1, railZ], [p[0] + offset, ty - 1, -d], [x, ty - 1, -d],
        [x, y - 2, -d], [x, y, -d], [x, y, dest[2] - 0.9], [dest[0], y, dest[2] - 0.9]]
        .filter((q, j, a) => !j || Math.hypot(q[0] - a[j - 1][0], q[1] - a[j - 1][1], q[2] - a[j - 1][2]) > 1e-8);
      out.push({ id: `S${String(i + 1).padStart(2, '0')}-${end ? 'POS' : 'NEG'}`, string: string.index, inverter: string.inverter, slot,
        duct: duct + 1, polarity: end ? '+' : '-', points });
    }
  });
  return out;
}

// collectorX / acRoute (L120-121): down the pole, east in a branch trench to the collector 15 m west of the
// transformer, along the main trench, then in. Three phases, trefoil or flat.
export function acRoute(p, t, id, label, params) {
  const s = cfg(params), d = s.acDiameter, cx = t[0] - s.collectorOffset;
  return [0, 1, 2].map(phase => {
    const o = s.formation === 'flat' ? (phase - 1) * d : phase === 0 ? -d / 2 : phase === 1 ? d / 2 : 0;
    const z = -s.acDepth + 0.05 + d / 2 + (s.formation === 'trefoil' && phase === 2 ? Math.sqrt(3) * d / 2 : 0);
    const points = [[p[0] + o, p[1], p[2] - 0.9], [p[0] + o, p[1], z], [cx + o, p[1], z], [cx + o, t[1], z], [t[0] + o, t[1], z], [t[0] + o, t[1], 1]]
      .filter((q, j, a) => !j || Math.hypot(q[0] - a[j - 1][0], q[1] - a[j - 1][1], q[2] - a[j - 1][2]) > 1e-8);
    return { id: `${id}-L${phase + 1}`, label, areaMm2: s.acAreaMm2, volts: s.acVolts, points };
  });
}

// acTrenches (L123): branch 0.35 m wide, main 2.6 m wide, depth acDepth.
export function acTrenches(sites, transformers, params) {
  const s = cfg(params), out = [];
  sites.forEach((p, i) => {
    const t = transformers[Math.floor(i / s.invertersPerTransformer)], cx = t[0] - s.collectorOffset;
    out.push({ from: [p[0], p[1]], to: [cx, p[1]], width: 0.35, depth: s.acDepth, kind: 'branch' },
      { from: [cx, p[1]], to: [cx, t[1]], width: 2.6, depth: s.acDepth, kind: 'main' },
      { from: [cx, t[1]], to: [t[0], t[1]], width: 2.6, depth: s.acDepth, kind: 'main' });
  });
  return out;
}

// compoundBox (L127): 12 m round the transformers; drawCompound fence 2.4 m high.
export function compoundBox(transformers) {
  const xs = transformers.map(p => p[0]), ys = transformers.map(p => p[1]);
  return [Math.min(...xs) - 12, Math.min(...ys) - 12, Math.max(...xs) + 12, Math.max(...ys) + 12];
}

// Solids in station-local metres, before placement: { min, max, kind, id }.
export function stationSolids(params, sites, transformers) {
  const s = cfg(params), { depth, span, ridge, halfRidgeGap: g } = tableShape(s), out = [];
  for (let n = 0; n < s.tables; n++) {
    const [x, y] = tableOrigin(n, s);
    out.push({ kind: 'table', id: n + 1, min: [x - g - depth, y, s.tableUnderside], max: [x + g + depth, y + span, ridge + 0.05] });
  }
  sites.forEach((p, i) => {
    out.push({ kind: 'inverter', id: i + 1, min: [p[0] - 0.5, p[1] - 0.25, p[2] - 1], max: [p[0] + 0.5, p[1] + 0.25, p[2]] },
      { kind: 'pole', id: i + 1, min: [p[0] - 0.06, p[1] + 0.24, 0], max: [p[0] + 0.06, p[1] + 0.36, p[2]] });
  });
  transformers.forEach((p, i) => out.push({ kind: 'transformer', id: i + 1, min: [p[0] - 2, p[1] - 2, 0], max: [p[0] + 2, p[1] + 2, 3] }));
  const [x0, y0, x1, y1] = compoundBox(transformers), w = 0.05, h = 2.4;
  out.push({ kind: 'fence', id: 1, min: [x0, y0 - w, 0], max: [x1, y0 + w, h] }, { kind: 'fence', id: 2, min: [x0, y1 - w, 0], max: [x1, y1 + w, h] },
    { kind: 'fence', id: 3, min: [x0 - w, y0, 0], max: [x0 + w, y1, h] }, { kind: 'fence', id: 4, min: [x1 - w, y0, 0], max: [x1 + w, y1, h] });
  return out;
}

// stationInventory (L143), computed rather than typed, so it moves with the parameters.
export function stationInventory(params, strings = tableStrings(params, { corners: false })) {
  const s = cfg(params), connected = strings.filter(x => x.connected), tableModules = s.rows * s.columns * 2;
  const connectedModules = connected.reduce((n, x) => n + x.modules.length, 0);
  const perInverter = Array.from({ length: s.inverters }, (_, i) => connected.filter(x => x.inverter === i).length);
  return {
    illustrative: true, tables: s.tables, modulesPerTable: tableModules, stringsPerTable: stringsPerTable(s),
    tableKwp: tableModules * s.moduleW / 1000, installedModules: strings.reduce((n, x) => n + x.modules.length, 0),
    connectedModules, totalStrings: strings.length, connectedStrings: connected.length, spareStrings: strings.length - connected.length,
    modulesPerString: s.modulesPerString, stringKwp: s.modulesPerString * s.moduleW / 1000,
    maxInverterDCKwp: s.stringsPerInverter * s.modulesPerString * s.moduleW / 1000, connectedDCKwp: connectedModules * s.moduleW / 1000,
    seriesLinks: connected.reduce((n, x) => n + x.modules.length - 1, 0),
    inverters: s.inverters, stringsPerInverter: perInverter, inverterKVA: s.inverterKVA, aggregateInverterMVA: s.inverters * s.inverterKVA / 1000,
    dcHomeCables: connected.length * 2, ductsPerInverter: s.ductsPerInverter, ducts: s.inverters * s.ductsPerInverter,
    acPhaseCables: s.inverters * 3, acAreaMm2: s.acAreaMm2, invertersPerTransformer: s.invertersPerTransformer,
    transformers: s.transformers.length, transformerMVA: s.transformerMVA, aggregateTransformerMVA: s.transformers.length * s.transformerMVA,
    wiring: s.wiring, dcDepth: s.dcDepth, ductDiameter: s.ductDiameter, ductDiameterAssumed: true, acDepth: s.acDepth, formation: s.formation
  };
}

// Placement: rotate station-local (x, y) by the compass heading, then add the placement point.
export function placer(at = [0, 0, 0], heading = 0) {
  const c = Math.cos(heading), s = Math.sin(heading), z0 = at[2] || 0;
  const point = ([x, y, z = 0]) => [at[0] + x * c + y * s, at[1] - x * s + y * c, z0 + z];
  const box = b => {
    const q = [[b.min[0], b.min[1]], [b.max[0], b.min[1]], [b.max[0], b.max[1]], [b.min[0], b.max[1]]].map(([x, y]) => point([x, y, 0]));
    const xs = q.map(p => p[0]), ys = q.map(p => p[1]);
    return { ...b, min: [Math.min(...xs), Math.min(...ys), z0 + b.min[2]], max: [Math.max(...xs), Math.max(...ys), z0 + b.max[2]], quad: q.map(p => [p[0], p[1]]) };
  };
  return { point, box };
}

// The whole station, placed. opts.corners = false skips the 4 corners of each of the 20,700 modules.
export function station(params, { at = [0, 0, 0], heading = 0, corners = true } = {}) {
  const s = cfg(params), P = placer(at, heading), pts = a => a.map(P.point);
  const localSites = Array.from({ length: s.inverters }, (_, k) => inverterSite(k, s));
  const localTx = s.transformers.map(p => [...p]);
  const strings = tableStrings(s, { corners });
  const inventory = stationInventory(s, strings);
  const { depth, span, ridge, halfRidgeGap: g } = tableShape(s);
  const tables = Array.from({ length: s.tables }, (_, n) => {
    const [x, y] = tableOrigin(n, s);
    return { id: n + 1, faces: [-1, 1].map(side => pts([[x + side * (g + depth), y, s.height], [x + side * g, y, ridge],
      [x + side * g, y + span, ridge], [x + side * (g + depth), y + span, s.height]])) };
  });
  const placedStrings = strings.map(x => ({ ...x, modules: x.modules.map(m => {
    const o = { terminal: P.point(m.terminal), minus: P.point(m.minus), plus: P.point(m.plus) };
    if (m.corners) o.corners = pts(m.corners);
    return o;
  }) }));
  const acCables = localSites.flatMap((p, i) => {
    const t = localTx[Math.floor(i / s.invertersPerTransformer)];
    return acRoute(p, t, `ST-INV-${i + 1}`, `Inverter ${i + 1} to transformer ${Math.floor(i / s.invertersPerTransformer) + 1}; ${s.acAreaMm2} mm2 Al; ${s.acVolts} V; illustrative`, s)
      .map(c => ({ ...c, points: pts(c.points) }));
  });
  return {
    note: 'Illustrative station geometry: equipment positions, cable routes and duct size assumed, not surveyed; no isolators modelled.',
    at: [...at], heading, params: s, tables, strings: placedStrings,
    inverters: localSites.map((p, i) => ({ id: i + 1, point: P.point(p), transformer: Math.floor(i / s.invertersPerTransformer) + 1,
      kva: s.inverterKVA, label: 'pole-mounted; port positions illustrative' })),
    transformers: localTx.map((p, i) => ({ id: i + 1, point: P.point(p), mva: s.transformerMVA })),
    compound: (([x0, y0, x1, y1]) => pts([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]))(compoundBox(localTx)),
    ducts: dcDucts(localSites, s).map(d => ({ ...d, points: pts(d.points) })),
    acCables,
    acTrenches: acTrenches(localSites, localTx, s).map(t => ({ ...t, from: P.point(t.from).slice(0, 2), to: P.point(t.to).slice(0, 2) })),
    solids: stationSolids(s, localSites, localTx).map(P.box),
    inventory
  };
}
