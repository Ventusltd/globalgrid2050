// pack-loader.mjs: loads layer packs into a world, contract world.pack.v1 (see CONTRACT.md beside this folder).
// Dependency-free ES module; runs in a browser page and in Node 20+ (tests). No globals are read or written
// except fetch, crypto.subtle, URL, Blob and structuredClone, all of which can be passed in.
//
// A pack is a folder (served from the world's own site or from another URL) holding pack.json and one
// self-contained entry module. The world pins each pack in its manifest with the entry's SHA-256; that pin is
// the trust. The hash inside pack.json is only a consistency check between the pack and its own description.
//
//   manifest.packs: [{ id, from, version, sha256, config?, on? }]
//
// const host = createPackHost({ api, reserved, clock, importText, fetchImpl });
// await host.add(pin)            reads pack.json, validates it, checks the pin; loads now unless budget.lazy
// host.toggle(id, on)            switches a pack on or off; a lazy pack is fetched, checked and started on first use
// host.frame(ctx)                -> { lines, solids, hud } from every pack that is on, within its budget
// host.step(realDt, ctx)         fixed-step simulation: whole FIXED_DT steps, at most MAX_SUBSTEPS per call
// host.active()                  true while any pack asks for frames (the world draws 0 fps when this is false)
// host.command(line, io)         runs a pack command typed on the command line (loads a lazy pack first)
// host.key(key, io)              runs the command a pack bound to a key
// host.panel()                   rows for the Layers panel: { id, label, group, on, status, illustrative }
// host.help()                    every pack command with its usage and plain words
// host.dispose(id) / disposeAll()

// Split for the world: the checks and parts are in pack-check.mjs (re-exported here); the host is below.

import { API, FIXED_DT, MAX_SUBSTEPS, OVER_BUDGET_FRAMES, LIMITS, HEX, isObj, str, getText, readPack, apiRefusal, importRefusal,
  normalise, sha256Text, importText, createBus, advance, shapeRefusal } from './pack-check.mjs';
export * from './pack-check.mjs'; // the checks and parts live there (split only for the 400-line rule)

// ---------------------------------------------------------------- the host

// api: the world's layer api (base, fetchVerified, fetchJSON, invalidate, origin, lib, ...).
// reserved: verbs the world's own command line already uses. worldApi: { major, minor } this world offers.
// libVersion: the shared library version the world serves (null when it serves none).
export function createPackHost({
  api = {}, base = api.base, reserved = [], worldApi = API, libVersion = api.lib?.version ?? null,
  fetchImpl = (u, o) => fetch(u, o), importer = importText, subtle = globalThis.crypto?.subtle,
  clock = () => (globalThis.performance?.now?.() ?? Date.now()), onError = () => {}, fixedDt = FIXED_DT
} = {}) {
  const items = new Map(), verbs = new Map(), keys = new Map();
  const bus = createBus({ onError: (name, e) => onError(`event ${name}: ${e?.message || e}`) });
  const taken = new Set(reserved);
  let acc = 0, stats = { steps: 0, dropped: 0 };

  const off = (item, why) => {
    const was = item.module;
    item.on = false; item.module = null; item.status = why;
    try { was?.dispose?.(); } catch { /* already failing; the status says why */ }
    item.events?.offAll();
    api.invalidate?.({ ground: false });
  };
  const guard = (item, hook, fn) => {
    try { return fn(); } catch (e) { off(item, `switched off: ${hook}() threw: ${e?.message || e}`); onError(`${item.id}.${hook}: ${e?.message || e}`); return undefined; }
  };

  async function add(pin) {
    if (!isObj(pin) || !str(pin.from) || !HEX.test(pin.sha256 ?? '')) throw Error('a pack pin needs { from, sha256 } (the entry hash)');
    const { folder, pack, problems } = await readPack(pin.from, { base, fetchImpl });
    const id = pack?.id ?? pin.id ?? pin.from;
    const item = { id, folder, pack, pin, on: false, module: null, status: 'loading', loading: null, over: 0, events: null, overs: { vertices: 0, ms: 0 } };
    // A refused pack stays listed (the Layers panel names it and says why) but never replaces one already loaded.
    const refuse = why => { item.status = 'refused: ' + why; items.set(items.has(id) ? `${id}#refused-${items.size}` : id, item); return item; };
    if (problems.length) return refuse(problems.join('; '));
    if (items.has(id)) return refuse(`a pack with id ${id} is already loaded`);
    if (pin.id && pin.id !== pack.id) return refuse(`the world pinned id ${pin.id}, pack.json says ${pack.id}`);
    if (pin.version && pin.version !== pack.version) return refuse(`the world pinned version ${pin.version}, pack.json says ${pack.version}`);
    if (pin.sha256 !== pack.sha256) return refuse(`pack.json gives entry hash ${pack.sha256.slice(0, 12)}, the world pinned ${pin.sha256.slice(0, 12)}`);
    const api_ = apiRefusal(pack.requires.api, worldApi);
    if (api_) return refuse(api_);
    if (pack.requires.lib !== undefined && pack.requires.lib !== libVersion) return refuse(`it needs lib version ${pack.requires.lib}, the world serves ${libVersion ?? 'none'}`);
    for (const c of pack.provides.commands ?? []) if (taken.has(c.verb)) return refuse(`command ${c.verb} is already taken by ${verbs.get(c.verb) ?? 'the world'}`);
    for (const k of pack.provides.keys ?? []) if (keys.has(k.key)) return refuse(`key ${k.key} is already bound by ${keys.get(k.key).id}`);
    for (const c of pack.provides.commands ?? []) { taken.add(c.verb); verbs.set(c.verb, id); }
    for (const k of pack.provides.keys ?? []) keys.set(k.key, { id, command: k.command });
    items.set(id, item);
    const startOn = pin.on ?? pack.provides.toggle?.on ?? !pack.provides.toggle;
    if (pack.budget.lazy && !startOn) { item.status = 'ready: loads when switched on'; return item; }
    await load(id);
    if (item.module && startOn) setOn(item, true);
    return item;
  }

  function load(id) {
    const item = items.get(id);
    if (!item) return Promise.reject(Error(`no pack ${id}`));
    if (item.module || /^refused|^failed|^switched off/.test(item.status)) return Promise.resolve(item);
    return (item.loading ||= (async () => {
      const { pack, pin } = item;
      for (const [dep, major] of Object.entries(pack.requires.packs ?? {})) {
        const d = items.get(dep);
        if (!d || !d.pack || /^refused/.test(d.status)) { item.status = `refused: it needs pack ${dep} ${major}.x, which this world has not loaded`; return item; }
        if (Number(d.pack.version.split('.')[0]) !== major) { item.status = `refused: it needs pack ${dep} ${major}.x, the world has ${d.pack.version}`; return item; }
      }
      item.status = 'loading now';
      let text;
      try { text = normalise(await getText(fetchImpl, new URL(pack.entry, item.folder).href)); }
      catch (e) { item.status = 'failed: ' + e.message; return item; }
      const hash = await sha256Text(text, subtle);
      if (!hash) { item.status = 'refused: this browser cannot check hashes here (needs https)'; return item; }
      if (hash !== pin.sha256) { item.status = `refused: entry hash ${hash.slice(0, 12)} is not the pinned ${pin.sha256.slice(0, 12)}`; return item; }
      const imp = importRefusal(text);
      if (imp) { item.status = 'refused: ' + imp; return item; }
      let mod;
      try { mod = (await importer(text)).default; } catch (e) { item.status = 'failed: the entry did not import: ' + e.message; return item; }
      const shape = shapeRefusal(mod, pack);
      if (shape) { item.status = 'refused: ' + shape; return item; }
      item.events = bus.scoped(pack.id, pack.provides.events ?? {});
      const packApi = Object.freeze({
        ...api,
        config: pin.config ?? null,
        pack: Object.freeze({ id: pack.id, version: pack.version, kind: pack.kind, illustrative: pack.illustrative }),
        packApi: Object.freeze({ ...worldApi }),
        fixedDt,
        events: item.events,
        log: text => onError(`${pack.id}: ${String(text).slice(0, 200)}`)
      });
      item.module = mod;
      item.status = 'loaded, hash matches';
      try {
        const r = mod.init?.(packApi);
        if (r && typeof r.then === 'function') await r;
      } catch (e) { off(item, 'failed to start and switched off: ' + (e?.message || e)); return item; }
      if (item.module && typeof mod.commands === 'function') {
        const run = guard(item, 'commands', () => mod.commands()) ?? [];
        const want = new Set((pack.provides.commands ?? []).map(c => c.verb));
        const got = new Set(Array.isArray(run) ? run.filter(c => c && typeof c.run === 'function').map(c => c.verb) : []);
        const miss = [...want].filter(v => !got.has(v)), extra = [...got].filter(v => !want.has(v));
        const why = [miss.length ? 'missing ' + miss.join(', ') : '', extra.length ? 'undeclared ' + extra.join(', ') : ''].filter(Boolean).join('; ');
        if (miss.length || extra.length) { off(item, `refused: commands() does not match pack.json (${why})`); return item; }
        item.run = new Map(run.map(c => [c.verb, c.run]));
      } else if ((pack.provides.commands ?? []).length) { off(item, 'refused: pack.json lists commands but the entry has no commands()'); return item; }
      api.invalidate?.({ ground: typeof mod.heightAt === 'function' });
      return item;
    })().finally(() => { item.loading = null; }));
  }

  function setOn(item, on) {
    if (!item.module) return;
    item.on = !!on;
    if (typeof item.module.setEnabled === 'function') guard(item, 'setEnabled', () => item.module.setEnabled(item.on));
    bus.emit('world/toggle', { id: item.id, on: item.on });
    api.invalidate?.({ ground: typeof item.module?.heightAt === 'function' });
  }

  async function toggle(id, on) {
    const item = items.get(id);
    if (!item) throw Error(`no pack ${id}`);
    if (on && !item.module) await load(id);
    if (!item.module) return item;
    setOn(item, on);
    return item;
  }

  const live = () => [...items.values()].filter(i => i.on && i.module);

  function frame(ctx = {}) {
    const lines = [], solids = [], hud = [];
    for (const item of live()) {
      const { module: m, pack } = item, t0 = clock();
      const ls = typeof m.lines === 'function' ? guard(item, 'lines', () => m.lines(ctx)) : [];
      if (!item.module) continue;
      const sd = typeof m.solids === 'function' ? guard(item, 'solids', () => m.solids(ctx)) : [];
      if (!item.module) continue;
      const hd = typeof m.hud === 'function' ? guard(item, 'hud', () => m.hud(ctx)) : [];
      if (!item.module) continue;
      const ms = clock() - t0 + (item.stepMs || 0);
      item.stepMs = 0;
      let verts = 0;
      for (const b of Array.isArray(ls) ? ls : []) verts += (b?.positions?.length || 0) / 3;
      const overV = verts > pack.budget.maxVertices, overT = ms > pack.budget.maxMsPerFrame;
      item.over = overV || overT ? item.over + 1 : 0;
      item.last = { vertices: verts, ms };
      if (item.over >= OVER_BUDGET_FRAMES) {
        off(item, `switched off: over budget for ${OVER_BUDGET_FRAMES} frames (${Math.round(verts)} vertices, max ${pack.budget.maxVertices}; ${ms.toFixed(2)} ms, max ${pack.budget.maxMsPerFrame})`);
        continue;
      }
      if (overV) continue; // this frame's lines are left out; the pack keeps running until the limit above
      for (const b of Array.isArray(ls) ? ls : []) if (b && b.positions) lines.push({ ...b, key: `${pack.id}/${b.key ?? 'lines'}` });
      for (const s of Array.isArray(sd) ? sd : []) if (s && s.min && s.max) solids.push(s);
      const tag = pack.illustrative ? ' (illustrative)' : '';
      for (const h of (Array.isArray(hd) ? hd : []).slice(0, LIMITS.hudLines)) {
        if (h && typeof h.text === 'string') hud.push({ id: `${pack.id}/${h.id ?? 'hud'}`, text: (h.text.slice(0, LIMITS.hudChars) + tag) });
      }
    }
    return { lines, solids, hud };
  }

  function step(realDt, ctx = {}) {
    const r = advance(acc, realDt, fixedDt, MAX_SUBSTEPS);
    acc = r.acc; stats.steps += r.steps; stats.dropped += r.dropped;
    if (!r.steps) return r;
    for (const item of live()) {
      if (typeof item.module.step !== 'function') continue;
      const t0 = clock();
      for (let i = 0; i < r.steps && item.module; i++) guard(item, 'step', () => item.module.step(fixedDt, ctx));
      item.stepMs = (item.stepMs || 0) + clock() - t0;
    }
    return r;
  }

  const active = () => live().some(i => typeof i.module.active === 'function' && guard(i, 'active', () => !!i.module.active()));

  async function command(line, io = { say: () => {} }) {
    const w = String(line).trim().split(/\s+/), verb = w[0]?.toLowerCase();
    const id = verbs.get(verb);
    if (!id) return { ok: false, text: `no pack offers ${verb}` };
    const item = items.get(id);
    if (!item.module) await load(id);
    if (!item.module) return { ok: false, text: `${id}: ${item.status}` };
    if (!item.on) setOn(item, true);
    try {
      const out = await item.run.get(verb)(w.slice(1), io);
      api.invalidate?.({ ground: false });
      return { ok: true, text: typeof out === 'string' ? out : '' };
    } catch (e) { return { ok: false, text: `${verb}: ${e?.message || e}` }; }
  }

  const key = (k, io) => { const b = keys.get(k); return b ? command(b.command, io) : Promise.resolve(null); };

  const panel = () => [...items.values()].map(i => ({
    id: i.id, label: i.pack?.provides.toggle?.label ?? i.pack?.title ?? i.id, group: i.pack?.provides.toggle?.group ?? 'Packs',
    on: i.on, status: i.status, illustrative: !!i.pack?.illustrative, kind: i.pack?.kind ?? null
  }));

  const help = () => [...items.values()].flatMap(i => (i.pack?.provides.commands ?? []).map(c => ({ ...c, pack: i.id })));

  function dispose(id) {
    const item = items.get(id);
    if (!item) return;
    if (item.module) off(item, 'disposed');
    for (const [v, owner] of verbs) if (owner === id) { verbs.delete(v); taken.delete(v); }
    for (const [k, b] of keys) if (b.id === id) keys.delete(k);
    items.delete(id);
  }
  const disposeAll = () => { for (const id of [...items.keys()].reverse()) dispose(id); };

  return Object.freeze({
    add, load, toggle, frame, step, active, command, key, panel, help, dispose, disposeAll,
    bus, get: id => items.get(id), stats: () => ({ ...stats, acc })
  });
}
