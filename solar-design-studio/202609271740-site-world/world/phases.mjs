// phases.mjs: construction sequence over the design document.
// Pure logic: no imports, no DOM. Items are the things that get built (roads,
// pads, trenches, cables, fences, HDD bores, piles, equipment, deliveries);
// phases are named, ordered groups of tasks that move items through their
// lifecycle. A timeline turns a slider step into the state of every item, and
// validation flags orders that cannot happen on site (a cable laid before its
// trench is dug, a trench backfilled over an empty bed, a delivery with no road).
//
// Time is measured in abstract steps. A phase's `steps` is a user input (default
// 1) and means "slider units", not days: nothing here asserts how long any
// activity takes.

export const STATES = Object.freeze(['planned', 'dug', 'laid', 'backfilled', 'complete']);

// Lifecycle per kind: the states an item passes through, in order.
export const LIFECYCLES = Object.freeze({
  road: ['planned', 'complete'],
  pad: ['planned', 'complete'],
  fence: ['planned', 'complete'],
  pile: ['planned', 'complete'],
  delivery: ['planned', 'complete'],
  equipment: ['planned', 'complete'],
  trench: ['planned', 'dug', 'backfilled', 'complete'],
  hdd: ['planned', 'dug', 'complete'],
  cable: ['planned', 'laid', 'complete']
});
export const KINDS = Object.freeze(Object.keys(LIFECYCLES));

// Default sequence. Names and order are a generic template, not a programme;
// `steps` are placeholders for the user to replace.
export const DEFAULT_PHASES = Object.freeze([
  { id: 'access', name: 'Access roads', tasks: [{ kind: 'road', to: 'complete' }] },
  { id: 'fencing', name: 'Security fencing', tasks: [{ kind: 'fence', to: 'complete' }] },
  { id: 'piling', name: 'Piling', tasks: [{ kind: 'pile', to: 'complete' }] },
  { id: 'pads', name: 'Pads and foundations', tasks: [{ kind: 'pad', to: 'complete' }] },
  { id: 'deliveries', name: 'Deliveries', tasks: [{ kind: 'delivery', to: 'complete' }] },
  { id: 'setting', name: 'Equipment setting', tasks: [{ kind: 'equipment', to: 'complete' }] },
  { id: 'trenching', name: 'Trenching and drilling', tasks: [{ kind: 'trench', to: 'dug' }, { kind: 'hdd', to: 'dug' }, { kind: 'hdd', to: 'complete' }] },
  { id: 'cabling', name: 'Cable laying', tasks: [{ kind: 'cable', to: 'laid' }] },
  { id: 'backfill', name: 'Backfill', tasks: [{ kind: 'trench', to: 'backfilled' }] },
  { id: 'reinstate', name: 'Reinstatement and testing', tasks: [{ kind: 'trench', to: 'complete' }, { kind: 'cable', to: 'complete' }] }
].map((p, i) => Object.freeze({ ...p, order: i + 1, steps: 1, tasks: Object.freeze(p.tasks.map(t => Object.freeze(t))) })));

const rank = (kind, state) => (LIFECYCLES[kind] || []).indexOf(state);
const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

function issue(severity, code, message, extra = {}) {
  return { severity, code, message, ...extra };
}

// Normalise items; flag bad kinds and duplicate ids. A reference to an item that is missing (or of the wrong kind)
// is dropped from the item and noted as a warning: the rest of the sequence still runs, and no rule ever follows it.
function readItems(items, issues) {
  const byId = new Map();
  for (const raw of list(items)) {
    if (!raw || typeof raw.id !== 'string' || !raw.id) { issues.push(issue('error', 'BAD_ITEM', 'An item has no string id.')); continue; }
    if (!LIFECYCLES[raw.kind]) { issues.push(issue('error', 'UNKNOWN_KIND', `Item ${raw.id} has unknown kind "${raw.kind}".`, { item: raw.id })); continue; }
    if (byId.has(raw.id)) { issues.push(issue('error', 'DUPLICATE_ID', `Item id ${raw.id} is used twice.`, { item: raw.id })); continue; }
    byId.set(raw.id, { ...raw, via: list(raw.via), after: list(raw.after) });
  }
  const skip = (it, what) => issues.push(issue('warning', 'BAD_REF', `Item ${it.id} names ${what}; that link is skipped.`, { item: it.id }));
  for (const it of byId.values()) {
    for (const key of ['trench', 'hdd', 'pad']) {
      if (it[key] == null) continue;
      if (byId.get(it[key])?.kind !== key) { skip(it, `${key} "${it[key]}", which is not a ${key} in this design`); delete it[key]; }
    }
    it.via = it.via.filter(r => byId.get(r)?.kind === 'road' || (skip(it, `via "${r}", which is not a road in this design`), false));
    it.after = it.after.map(a => (typeof a === 'string' ? { item: a } : a)).filter(a => {
      const t = byId.get(a?.item);
      if (t && rank(t.kind, a.state || 'complete') >= 0) return true;
      skip(it, `a wait on "${a?.item}" reaching "${a?.state || 'complete'}", which does not exist`);
      return false;
    });
  }
  return byId;
}

// Steps are slider units, so they are whole numbers; anything else is reported and rounded (at least 1).
function wholeSteps(p, idx, issues) {
  if (p.steps === undefined) return 1;
  if (Number.isInteger(p.steps) && p.steps > 0) return p.steps;
  issues.push(issue('error', 'BAD_STEPS', `Phase "${p.name || idx + 1}" has ${p.steps} steps; steps are whole numbers from 1.`, { phase: p.id }));
  return Math.max(1, Math.round(Number(p.steps)) || 1);
}

// Expand each phase's tasks to one operation per item, in sequence order.
function expand(phases, byId, issues) {
  const sorted = list(phases).map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.order ?? a.i) - (b.p.order ?? b.i) || a.i - b.i)
    .map(({ p }, idx) => ({ id: p.id ?? `phase-${idx + 1}`, name: p.name || `Phase ${idx + 1}`, order: p.order ?? idx + 1,
      steps: wholeSteps(p, idx, issues), tasks: list(p.tasks) }));
  const ops = [];
  sorted.forEach((ph, pi) => {
    for (const t of ph.tasks) {
      const ids = t.item != null ? list(t.item) : [...byId.values()].filter(it => it.kind === t.kind).map(it => it.id);
      for (const id of ids) {
        const it = byId.get(id);
        if (!it) { issues.push(issue('error', 'UNKNOWN_ITEM', `Phase "${ph.name}" moves unknown item "${id}".`, { phase: ph.id, item: id })); continue; }
        if (rank(it.kind, t.to) < 1) {
          const msg = `Phase "${ph.name}" moves ${it.kind} ${id} to "${t.to}", which a ${it.kind} never reaches.`;
          issues.push(issue('error', 'BAD_STATE', msg, { phase: ph.id, item: id }));
          continue;
        }
        ops.push({ phase: pi, item: id, to: t.to });
      }
    }
  });
  return { phases: sorted, ops };
}

// Physical rules checked when `op` is applied to the current `state` map.
function rules(op, it, byId, state, allRoads) {
  const out = [];
  const at = id => state.get(id);
  const kindOf = id => byId.get(id).kind;
  const reached = (id, s) => rank(kindOf(id), at(id)) >= rank(kindOf(id), s);
  // A missing item is already reported as BAD_REF by readItems; the rule is skipped, never a TypeError.
  const need = (id, s, code, why) => { if (byId.has(id) && !reached(id, s)) out.push([code, `${why} (${id} is ${at(id)}).`]); };
  const roadsFor = x => (x.via.length ? x.via : allRoads);
  if (it.kind === 'cable' && op.to === 'laid') {
    if (it.trench) {
      need(it.trench, 'dug', 'CABLE_BEFORE_TRENCH', `Cable ${it.id} is laid before trench ${it.trench} is dug`);
      if (byId.has(it.trench) && rank('trench', at(it.trench)) >= rank('trench', 'backfilled')) out.push(['CABLE_AFTER_BACKFILL', `Cable ${it.id} is laid after trench ${it.trench} was backfilled.`]);
    }
    if (it.hdd) need(it.hdd, 'dug', 'CABLE_BEFORE_BORE', `Cable ${it.id} is pulled before bore ${it.hdd} is drilled`);
  }
  if (it.kind === 'trench' && op.to === 'backfilled') {
    for (const c of byId.values()) if (c.kind === 'cable' && c.trench === it.id) need(c.id, 'laid', 'BACKFILL_BEFORE_CABLE', `Trench ${it.id} is backfilled before cable ${c.id} is laid`);
  }
  if ((it.kind === 'equipment' || it.kind === 'delivery') && op.to === 'complete') {
    for (const r of roadsFor(it)) need(r, 'complete', 'DELIVERY_BEFORE_ROAD', `${it.kind === 'delivery' ? 'Delivery' : 'Equipment'} ${it.id} arrives before road ${r} is built`);
  }
  if (it.kind === 'equipment' && op.to === 'complete' && it.pad) need(it.pad, 'complete', 'EQUIPMENT_BEFORE_PAD', `Equipment ${it.id} is set before pad ${it.pad} is complete`);
  if (it.kind === 'pad' && op.to === 'complete') {
    for (const r of roadsFor(it)) need(r, 'complete', 'PAD_BEFORE_ROAD', `Pad ${it.id} is built before road ${r} gives access`);
  }
  for (const a of it.after) if (byId.has(a.item)) need(a.item, a.state || 'complete', 'WAITS_ON', `${it.id} moves before ${a.item} reaches ${a.state || 'complete'}`);
  return out;
}

// Compile items + phases into a checked sequence.
// Returns { items: Map, phases, ops, issues, ok, totalSteps }.
export function compilePlan(items, phases = DEFAULT_PHASES) {
  const issues = [];
  const byId = readItems(items, issues);
  const { phases: ph, ops } = expand(phases, byId, issues);
  const allRoads = [...byId.values()].filter(i => i.kind === 'road').map(i => i.id);
  const state = new Map([...byId.keys()].map(id => [id, 'planned']));
  for (const op of ops) {
    const it = byId.get(op.item), from = state.get(op.item);
    const where = { phase: ph[op.phase].id, item: op.item };
    const lc = LIFECYCLES[it.kind], r0 = lc.indexOf(from), r1 = lc.indexOf(op.to);
    if (r1 <= r0) { issues.push(issue('error', 'STATE_REGRESSION', `${it.id} is moved to ${op.to} but is already ${from}.`, where)); op.skip = true; continue; }
    if (r1 > r0 + 1) issues.push(issue('error', 'SKIPPED_STATE', `${it.id} jumps from ${from} to ${op.to}, skipping ${lc.slice(r0 + 1, r1).join(', ')}.`, where));
    for (const [code, message] of rules(op, it, byId, state, allRoads)) issues.push(issue('error', code, message, where));
    op.from = from;
    state.set(op.item, op.to);
  }
  for (const [id, s] of state) if (s !== 'complete') issues.push(issue('warning', 'INCOMPLETE', `${id} ends the sequence ${s}, not complete.`, { item: id }));
  const totalSteps = ph.reduce((n, p) => n + p.steps, 0);
  return { items: byId, phases: ph, ops: ops.filter(o => !o.skip), issues, ok: !issues.some(i => i.severity === 'error'), totalSteps };
}

export function validatePlan(items, phases = DEFAULT_PHASES) {
  const { ok, issues } = compilePlan(items, phases);
  return { ok, errors: issues.filter(i => i.severity === 'error'), warnings: issues.filter(i => i.severity === 'warning') };
}

// Timeline over a compiled plan. Step 0 is before any work; step totalSteps is
// the end. Inside a phase spanning several steps its operations complete in
// listed order, spread evenly across the span.
export function createTimeline(items, phases = DEFAULT_PHASES) {
  const plan = compilePlan(items, phases);
  const starts = [];
  let acc = 0;
  for (const p of plan.phases) { starts.push(acc); acc += p.steps; }
  const opsBy = plan.phases.map((_, i) => plan.ops.filter(o => o.phase === i));
  const clamp = s => Math.min(plan.totalSteps, Math.max(0, Number.isFinite(+s) ? +s : 0));

  function phaseAt(step) {
    const s = clamp(step);
    for (let i = 0; i < plan.phases.length; i++) {
      if (s < starts[i] + plan.phases[i].steps) return { index: i, ...plan.phases[i], start: starts[i], fraction: (s - starts[i]) / plan.phases[i].steps };
    }
    return null; // finished
  }

  function stateAt(step) {
    const s = clamp(step);
    const state = new Map([...plan.items.keys()].map(id => [id, 'planned']));
    const active = new Map();
    plan.phases.forEach((p, i) => {
      const done = s >= starts[i] + p.steps ? opsBy[i].length : Math.floor(Math.max(0, s - starts[i]) / p.steps * opsBy[i].length + 1e-9);
      opsBy[i].forEach((o, k) => {
        if (k < done) state.set(o.item, o.to);
        else if (s >= starts[i] && !active.has(o.item)) active.set(o.item, o.to);
      });
    });
    const out = [...plan.items.values()].map(it => ({
      id: it.id, kind: it.kind, state: state.get(it.id), exists: state.get(it.id) !== 'planned',
      next: active.get(it.id) || null
    }));
    const counts = Object.fromEntries(STATES.map(st => [st, out.filter(o => o.state === st).length]));
    return { step: s, phase: phaseAt(s), items: out, counts };
  }

  function label(step) {
    const s = clamp(step), p = phaseAt(s);
    if (s === 0) return `Step 0 of ${plan.totalSteps}: nothing started`;
    if (!p) return `Step ${s} of ${plan.totalSteps}: sequence finished`;
    return `Step ${s} of ${plan.totalSteps}: ${p.name} (phase ${p.index + 1} of ${plan.phases.length})`;
  }

  return { plan, totalSteps: plan.totalSteps, phaseAt, stateAt, label, clamp };
}
