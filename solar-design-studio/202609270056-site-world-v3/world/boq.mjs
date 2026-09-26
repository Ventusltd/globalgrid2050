// boq.mjs: a bill of quantities from a design document.
//
// buildBoq(doc, { sections, cables, rates, currency }) -> { rows, skipped, total }
//   doc       { items: [{ id, kind, ...parameters, results }] }, kind one of
//             cable, trench, road, pad, fence, hdd, piles. `results` holds what
//             the design tools computed: routeCable / cableSummary for a cable,
//             trenchSummary for a trench, cutFillForPlatform for a pad, and
//             { length2d, length3d, area } style numbers for the rest.
//   sections  parsed web/world/data/trench-sections.json (needed for trenches)
//   cables    parsed web/world/data/cables.json (optional, resolves cableId)
// A cable is billed on its identity: cableId, or else voltageKv + csaMm2 + conductor + armoured all given.
// A cable with neither is skipped with a reason, never summed into an assumed row. A cable item may carry
// trench: { sectionId, results } for the trench cut for it; that trench is billed as a trench item.
//   rates     optional { [code]: number | { rate, unit } } supplied by the user.
//             With no rates, no money appears anywhere in the output.
//
// Every row: { code, description, unit, quantity, status, basis, sources }.
// status is one of
//   computed   measured from design geometry and values the design supplied
//   estimated  derived from design results by a stated simplification
//   assumed    rests on a default from boq-assumptions.mjs the design did not set
// Rows with the same code are summed; the merged status is the weakest one.
//
// toCsv(boq) -> CSV text: the disclaimer line, then the column header. Pure: no DOM, no fetch.

import { CABLE_DEFAULTS, CABLE_ALLOWANCES, ROAD_BUILD_UPS, FENCE_DEFAULTS, BEDDING_DEFAULTS, BASIS, DISCLAIMER } from './boq-assumptions.mjs';

const GROUND = `ground ${BASIS.ground}, levels in ${BASIS.datum}`;

export const STATUSES = ['computed', 'estimated', 'assumed'];
const RANK = { computed: 0, estimated: 1, assumed: 2 };
const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const fmt = (x, dp = 2) => Number(x.toFixed(dp)).toString();

function planLength(path) {
  let s = 0;
  for (let k = 1; k < (path || []).length; k++) s += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
  return s;
}

function bendCount(path) {
  let n = 0;
  for (let i = 1; i < (path || []).length - 1; i++) {
    const [a, b, c] = [path[i - 1], path[i], path[i + 1]];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
    if (Math.abs(Math.atan2(cr, dot)) > 1e-6) n++;
  }
  return n;
}

// Best length an item offers: true 3D first, then plan, then its own path.
function lengthOf(item) {
  const r = item.results || {};
  const l3 = num(r.length3d) ?? num(r.boreLength);
  if (l3 != null) return { value: l3, status: 'computed', basis: 'true 3D length from design results' };
  const l = num(r.length);
  if (l != null) return { value: l, status: 'computed', basis: 'length from design results' };
  const l2 = num(r.length2d);
  if (l2 != null) return { value: l2, status: 'estimated', basis: 'plan length; no ground model, slope not included' };
  if (Array.isArray(item.path) && item.path.length > 1) {
    return { value: planLength(item.path), status: 'estimated', basis: 'plan length of the drawn path; slope not included' };
  }
  return null;
}

const weakest = (...s) => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'computed');

// ---------------------------------------------------------------- by kind

const armouredOf = (id) => /armour/i.test(id || '') && !/unarmour/i.test(id || '');

function cableRows(item, ctx, add, skip) {
  if (item.trench) trenchRows({ id: `${item.id ?? 'cable'}-trench`, kind: 'trench', ...item.trench }, ctx, add, skip);
  let { voltageKv, csaMm2, conductor, armoured } = item;
  let code, name;
  if (item.cableId) {
    const c = ctx.cables ? (ctx.cables.cables || []).find((k) => k.id === item.cableId) : null;
    if (ctx.cables && !c) return skip(item, `unknown cableId ${item.cableId}`);
    if (c) { voltageKv ??= c.voltage_kv; csaMm2 ??= c.csa_mm2; conductor ??= c.conductor; }
    armoured ??= armouredOf(item.cableId);
    code = `CAB-${item.cableId}`;
    name = item.cableId;
  } else {
    if (voltageKv == null || csaMm2 == null || !conductor || typeof armoured !== 'boolean') {
      return skip(item, 'no cable identity: give cableId, or voltageKv, csaMm2, conductor and armoured');
    }
    code = `CAB-${voltageKv}KV-${conductor}-${csaMm2}-${armoured ? 'ARM' : 'UNARM'}`.toUpperCase();
    name = code.slice(4);
  }
  const r = item.results || {};
  const circuits = num(item.circuits) ?? 1;
  const cores = Array.isArray(r.cores) && r.cores.every((c) => num(c.length3d) != null) ? r.cores : null;
  const perCircuit = num(item.coresPerCircuit) ?? (cores ? cores.length : null);
  const nCores = perCircuit ?? CABLE_DEFAULTS.coresPerCircuit;
  const coreNote = perCircuit != null ? `${nCores} cores per circuit` : `${nCores} cores per circuit (assumed)`;
  let laid, status, basis;
  if (cores && perCircuit === cores.length) {
    laid = cores.reduce((s, c) => s + c.length3d, 0) * circuits;
    status = 'computed';
    basis = `sum of true 3D core axis lengths x ${circuits} circuit(s)`;
  } else {
    const L = lengthOf(item);
    if (!L) return skip(item, 'no route length in results');
    laid = L.value * nCores * circuits;
    status = weakest(L.status, perCircuit != null ? 'computed' : 'assumed');
    basis = `${L.basis} x ${coreNote} x ${circuits} circuit(s)`;
  }
  const kv = voltageKv != null ? `${voltageKv} kV` : 'voltage not given';
  const size = csaMm2 != null ? `${csaMm2} mm²` : 'size not given';
  const kind = `${kv} ${conductor || 'conductor not given'} ${size} ${armoured ? 'armoured' : 'unarmoured'} (${name})`;
  add({ code, description: `Cable ${kind}, laid length`, unit: 'm', quantity: laid, status, basis, rateKey: code }, item);

  const a = item.allowances || {};
  const slackPct = num(a.slackPct) ?? CABLE_DEFAULTS.slackPct;
  const { snakingPct: S, terminationM: T } = CABLE_ALLOWANCES;
  const termM = num(a.terminationM) ?? CABLE_DEFAULTS.terminationM;
  const given = num(a.slackPct) != null && num(a.terminationM) != null;
  const allowance = laid * slackPct / 100 + termM * 2 * nCores * circuits;
  add({
    code: `${code}-ALLOW`, description: `Cable ${kind}, allowances`, unit: 'm', quantity: allowance,
    status: given ? status : 'assumed', rateKey: code,
    basis: `slack ${slackPct} % of laid length${num(a.slackPct) != null ? '' : ` (assumed ${S.unit})`} + ${termM} m tail per core per end`
      + `${num(a.terminationM) != null ? '' : ' (assumed)'}; same allowances as the drum schedule`,
  }, item);
}

function trenchRows(item, ctx, add, skip) {
  const sec = (ctx.sections?.sections || []).find((s) => s.id === item.sectionId);
  if (!sec) return skip(item, item.sectionId ? `unknown sectionId ${item.sectionId}` : 'no sectionId');
  const r = item.results || {};
  const L = lengthOf(item);
  if (!L) return skip(item, 'no trench length in results');
  const width = num(r.width) ?? sec.trench_width_m;
  const depth = num(r.depth) ?? sec.trench_depth_m;
  const tag = `TR-${sec.id}`;
  add({ code: `${tag}-LEN`, description: `Trench ${sec.id} (${sec.voltage_class}), length`, unit: 'm', quantity: L.value, status: L.status, basis: L.basis }, item);

  const spoil = num(r.spoil) ?? num(r.spoilVolumeM3);
  add(spoil != null
    ? { code: `${tag}-SPOIL`, description: `Trench ${sec.id}, excavated spoil (bank volume)`, unit: 'm³', quantity: spoil,
        status: 'computed',
        basis: `cut volume against the ground model (${GROUND}); ${BASIS.spoil}` }
    : { code: `${tag}-SPOIL`, description: `Trench ${sec.id}, excavated spoil (bank volume)`, unit: 'm³', quantity: L.value * width * depth,
        status: 'estimated',
        basis: `length x ${width} m wide x ${depth} m deep; vertical walls; ${BASIS.spoil}` }, item);

  const t = num(sec.bedding?.thickness_mm);
  if (t != null) {
    const trefoil = /trefoil/i.test(sec.formation || '');
    const unit = num(sec.duct_od_mm) ?? num(sec.phase_spacing_mm);
    const env = unit != null ? (trefoil ? unit * (1 + Math.sqrt(3) / 2) : unit) : BEDDING_DEFAULTS.envelopeMm;
    const envNote = unit != null ? `${fmt(env, 0)} mm ${trefoil ? 'trefoil' : 'single layer'} envelope` : `${env} mm envelope (assumed)`;
    add({
      code: `${tag}-BED`, description: `Trench ${sec.id}, bedding: ${sec.bedding.material}`, unit: 'm³',
      quantity: L.value * width * (2 * t + env) / 1000, status: unit != null ? 'estimated' : 'assumed',
      basis: `length x ${width} m x (${t} mm bed + ${envNote} + ${t} mm above); gross, cable and duct volume not deducted`,
    }, item);
  }
  const m = sec.marker?.type || '';
  if (m) {
    const count = /each/i.test(m) ? (num(sec.circuits) ?? 1) : 1;
    const tape = /tape/i.test(m);
    add({
      code: `${tag}-${tape ? 'TAPE' : 'TILE'}`, description: `Trench ${sec.id}, ${tape ? 'warning tape' : 'protection tile'}`,
      unit: 'm', quantity: L.value * count, status: L.status,
      basis: `trench length x ${count} run(s): ${m}`,
    }, item);
  }
}

function roadRows(item, ctx, add, skip) {
  const r = item.results || {};
  const custom = Array.isArray(item.buildUp) && item.buildUp.length ? item.buildUp : null;
  const surface = item.surface || 'unbound';
  const std = ROAD_BUILD_UPS[surface];
  if (!custom && !std) return skip(item, `unknown surface ${surface}; supply buildUp`);
  let area = num(r.area), aStatus = 'computed', aBasis = 'plan area from design results';
  if (area == null) {
    const L = lengthOf(item), w = num(item.widthM) ?? num(r.width);
    if (!L || w == null) return skip(item, 'no road area, or length and widthM');
    area = L.value * w; aStatus = L.status; aBasis = `${L.basis} x ${w} m wide`;
  }
  const tag = `RD-${surface.toUpperCase()}`;
  add({ code: `${tag}-AREA`, description: `Road, ${custom ? surface : std.label}, area`, unit: 'm²', quantity: area, status: aStatus, basis: aBasis }, item);
  const layers = custom || std.layers;
  layers.forEach((ly, i) => {
    const key = ly.key || `L${i + 1}`;
    const assumed = !custom || ly.assumed === true;
    add({
      code: `${tag}-${key}`, description: `Road, ${ly.material}`, unit: 'm³', quantity: area * ly.thicknessMm / 1000,
      status: assumed ? 'assumed' : aStatus,
      basis: `area x ${ly.thicknessMm} mm${assumed ? ' (assumed build-up, as road.mjs draws it)' : ' (design build-up)'}; compacted volume`,
    }, item);
  });
  const lvl = `formation under the finished road; ${GROUND}`;
  if (num(r.cutM3) != null) add({ code: `${tag}-CUT`, description: 'Road, cut to formation', unit: 'm³', quantity: num(r.cutM3),
    status: 'computed', basis: `cut against the ground model to the ${lvl}; ${BASIS.spoil}; batters at assumed slopes` }, item);
  if (num(r.fillM3) != null) add({ code: `${tag}-FILL`, description: 'Road, fill to formation', unit: 'm³', quantity: num(r.fillM3),
    status: 'computed', basis: `fill against the ground model to the ${lvl}; compacted, no shrinkage factor; batters at assumed slopes` }, item);
  if (!custom && std.geotextile) {
    add({ code: `${tag}-GEOTEX`, description: 'Road, separation geotextile', unit: 'm²', quantity: area, status: 'assumed', basis: 'area, no laps (assumed build-up)' }, item);
  }
}

function padRows(item, ctx, add, skip) {
  const r = item.results || {};
  const area = num(r.polygonArea) ?? num(r.area);
  if (area == null && num(r.cut) == null) return skip(item, 'no pad results');
  const tag = `PAD-${item.id}`;
  if (area != null) add({ code: `${tag}-AREA`, description: `Pad ${item.id}, plan area`, unit: 'm²', quantity: area, status: 'computed', basis: 'polygon area' }, item);
  const lvl = num(r.level) != null ? ` to level ${fmt(r.level, 3)} m above Ordnance Datum Newlyn` : '';
  if (num(r.cut) != null) add({ code: `${tag}-CUT`, description: `Pad ${item.id}, cut`, unit: 'm³', quantity: r.cut,
      status: 'computed',
      basis: `cut against the ground model${lvl} (${GROUND}); ${BASIS.spoil}` }, item);
  if (num(r.fill) != null) add({ code: `${tag}-FILL`, description: `Pad ${item.id}, fill`, unit: 'm³', quantity: r.fill,
      status: 'computed',
      basis: `fill against the ground model${lvl} (${GROUND}); compacted, no shrinkage factor` }, item);
  const th = num(item.thicknessM);
  if (th != null && area != null) {
    const mat = item.material || 'pad construction';
    // The thickness is a design choice the tools assume (pad.mjs stone depth); billed as assumed unless the
    // item says thicknessAssumed: false.
    const given = item.thicknessAssumed === false;
    add({ code: `${tag}-SLAB`, description: `Pad ${item.id}, ${mat}`, unit: 'm³', quantity: area * th, status: given ? 'computed' : 'assumed',
      basis: `area x ${th} m thick${given ? ' (design thickness)' : ' (assumed thickness)'}` }, item);
  }
}

function fenceRows(item, ctx, add, skip) {
  const L = lengthOf(item);
  if (!L) return skip(item, 'no fence length');
  const spacing = num(item.postSpacingM) ?? FENCE_DEFAULTS.postSpacingM;
  const runs = num(item.runs) ?? 1;
  const bends = num(item.results?.bends?.length) ?? bendCount(item.path);
  const tag = `FEN-${item.fenceType || 'STD'}`.toUpperCase();
  add({ code: `${tag}-LEN`, description: `Fence${item.fenceType ? ` ${item.fenceType}` : ''}, length`, unit: 'm', quantity: L.value, status: L.status, basis: L.basis }, item);
  // The fence tool's own counts win: they are what the readout shows (code review 4).
  const c = item.results?.counts;
  if (c && num(c.posts) != null) {
    add({ code: `${tag}-POST`, description: 'Fence, posts (all)', unit: 'nr', quantity: c.posts, status: 'computed',
      basis: `counted by the fence tool: ${num(c.cornerPosts) ?? 0} corner, ${num(c.gatePosts) ?? 0} gate` }, item);
    if (num(c.strainers)) add({ code: `${tag}-STRAIN`, description: 'Fence, straining posts', unit: 'nr', quantity: c.strainers, status: 'computed', basis: 'counted by the fence tool' }, item);
    if (num(c.struts)) add({ code: `${tag}-STRUT`, description: 'Fence, struts', unit: 'nr', quantity: c.struts, status: 'computed', basis: 'counted by the fence tool' }, item);
    const g = num(item.gates);
    if (g) add({ code: `${tag}-GATE`, description: 'Fence, gates', unit: 'nr', quantity: g, status: 'computed', basis: 'count from design' }, item);
    return;
  }
  const perRun = Math.ceil(L.value / runs / spacing - 1e-9) + 1;
  add({
    code: `${tag}-POST`, description: 'Fence, line posts', unit: 'nr', quantity: perRun * runs,
    status: num(item.postSpacingM) != null ? L.status : 'assumed',
    basis: `ceil(length / ${spacing} m) + 1 per run, ${runs} run(s)${num(item.postSpacingM) != null ? '' : ' (assumed spacing)'}`,
  }, item);
  add({
    code: `${tag}-STRAIN`, description: 'Fence, straining posts', unit: 'nr', quantity: 2 * runs + bends,
    status: 'assumed', basis: `one at each run end and each of ${bends} bend(s); counted among the line posts (assumed practice)`,
  }, item);
  const gates = num(item.gates);
  if (gates) add({ code: `${tag}-GATE`, description: 'Fence, gates', unit: 'nr', quantity: gates, status: 'computed', basis: 'count from design' }, item);
}

function hddRows(item, ctx, add, skip) {
  const L = lengthOf(item);
  if (!L) return skip(item, 'no bore length');
  add({ code: 'HDD-BORE', description: 'Horizontal directional drill, bore length', unit: 'm', quantity: L.value, status: L.status, basis: L.basis }, item);
  const ducts = num(item.ducts);
  if (ducts) {
    const od = num(item.ductOdMm);
    add({ code: `HDD-DUCT${od ? `-${od}` : ''}`, description: `HDD duct${od ? ` ${od} mm OD` : ''}`, unit: 'm', quantity: L.value * ducts,
        status: L.status,
        basis: `bore length x ${ducts} duct(s)` }, item);
  }
}

function pileRows(item, ctx, add, skip) {
  const r = item.results || {};
  const count = num(r.count) ?? num(item.count) ?? (Array.isArray(item.points) ? item.points.length : null);
  if (count == null) return skip(item, 'no pile count');
  const type = item.pileType || 'STD';
  add({ code: `PIL-${type}`.toUpperCase(), description: `Piles${item.pileType ? ` ${item.pileType}` : ''}, count`, unit: 'nr', quantity: count,
    status: 'computed', basis: 'count from design' }, item);
  const emb = num(r.totalEmbedmentM) ?? (num(item.embedmentM) != null ? count * item.embedmentM : null);
  if (emb != null) add({ code: `PIL-${type}-EMB`.toUpperCase(), description: 'Piles, total embedded length', unit: 'm', quantity: emb,
      status: 'computed',
      basis: num(r.totalEmbedmentM) != null ? 'sum from design results' : `count x ${item.embedmentM} m` }, item);
}

const KINDS = { cable: cableRows, trench: trenchRows, road: roadRows, pad: padRows, fence: fenceRows, hdd: hddRows, piles: pileRows };

// ---------------------------------------------------------------- build

function rateOf(rates, code, unit) {
  if (!rates || !(code in rates)) return null;
  const v = rates[code];
  const rate = typeof v === 'object' && v !== null ? num(v.rate) : num(v);
  if (rate == null) throw new Error(`boq: rate for ${code} is not a number`);
  if (typeof v === 'object' && v.unit && v.unit !== unit) throw new Error(`boq: rate for ${code} is per ${v.unit}, row is in ${unit}`);
  return rate;
}

export function buildBoq(doc, { sections = null, cables = null, rates = null, currency = null } = {}) {
  if (!doc || !Array.isArray(doc.items)) throw new Error('buildBoq: doc.items must be an array');
  const byCode = new Map(), skipped = [];
  const skip = (item, reason) => skipped.push({ id: item.id ?? null, kind: item.kind ?? null, reason });
  const add = (row, item) => {
    const prev = byCode.get(row.code);
    const id = item.id ?? `(${item.kind})`;
    if (!prev) { byCode.set(row.code, { ...row, rateKey: row.rateKey || row.code, sources: [id], bases: [row.basis] }); return; }
    if (prev.unit !== row.unit) throw new Error(`boq: ${row.code} mixes ${prev.unit} and ${row.unit}`);
    prev.quantity += row.quantity;
    prev.status = weakest(prev.status, row.status);
    if (!prev.sources.includes(id)) prev.sources.push(id);
    if (!prev.bases.includes(row.basis)) prev.bases.push(row.basis);
  };
  const ctx = { sections, cables };
  for (const item of doc.items) {
    const fn = KINDS[item?.kind];
    if (!fn) { skip(item || {}, `unknown kind ${item?.kind}`); continue; }
    fn(item, ctx, add, skip);
  }
  const rows = [...byCode.values()].map(({ bases, rateKey, ...r }) => {
    const row = { ...r, basis: bases.join('; ') };
    if (rates) {
      const rate = rateOf(rates, r.code, r.unit) ?? rateOf(rates, rateKey, r.unit);
      row.rate = rate;
      row.amount = rate == null ? null : rate * r.quantity;
    }
    return row;
  });
  const out = { rows, skipped };
  if (rates) {
    out.currency = currency;
    out.total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
    out.unrated = rows.filter((r) => r.rate == null).map((r) => r.code);
  }
  return out;
}

// ---------------------------------------------------------------- CSV

const DP = { m: 1, 'm²': 1, 'm³': 2, nr: 0 };
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(boq) {
  const priced = 'total' in boq;
  const head = ['code', 'description', 'unit', 'quantity', 'status', 'basis', 'sources'];
  if (priced) head.push(`rate${boq.currency ? ` (${boq.currency})` : ''}`, `amount${boq.currency ? ` (${boq.currency})` : ''}`);
  const lines = [cell(DISCLAIMER), head.map(cell).join(',')];
  for (const r of boq.rows) {
    const line = [r.code, r.description, r.unit, (r.quantity).toFixed(DP[r.unit] ?? 2), r.status, r.basis, r.sources.join(' ')];
    if (priced) line.push(r.rate == null ? 'no rate' : r.rate, r.amount == null ? '' : r.amount.toFixed(2));
    lines.push(line.map(cell).join(','));
  }
  if (priced) lines.push(['TOTAL', 'Total of rated rows only', '', '', '', '', '', '', boq.total.toFixed(2)].map(cell).join(','));
  return lines.join('\r\n') + '\r\n';
}
