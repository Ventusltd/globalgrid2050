// pack-check.mjs: the checks and parts of the layer pack loader (contract world.pack.v1): validation of pack.json,
// the api, import and shape refusals, hashing and importing, the event bus, fixed steps and reading a pack folder.
// Split from the pack loader (Apache-2.0, the packs' own _loader) only to keep each world file under 400 lines;
// pack-loader.mjs re-exports all of it, so code and tests import the loader as before. No logic is changed.

export const CONTRACT = 'world.pack.v1';
export const API = Object.freeze({ major: 1, minor: 0 });
export const KINDS = Object.freeze(['layer', 'body', 'vehicle', 'lens', 'sim']);
export const HOOKS = Object.freeze(['init', 'lines', 'solids', 'heightAt', 'step', 'active', 'commands', 'hud', 'setEnabled', 'dispose']);
export const FIXED_DT = 1 / 60;          // seconds per simulation step
export const MAX_SUBSTEPS = 8;           // a slow frame never runs more than this many steps (the rest is dropped and counted)
export const OVER_BUDGET_FRAMES = 30;    // consecutive frames over budget before a pack is switched off
export const LIMITS = Object.freeze({ maxVertices: 2000000, maxMsPerFrame: 8, hudLines: 4, hudChars: 80 });
export const TOP_KEYS = Object.freeze(['$schema', 'contract', 'id', 'version', 'kind', 'title', 'description', 'entry', 'sha256', 'requires', 'provides', 'budget', 'licence', 'illustrative', 'data']);
export const WORLD_EVENTS =Object.freeze(['world/pose', 'world/origin', 'world/toggle', 'world/ground']);

const ID = /^[a-z][a-z0-9-]{1,39}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
export const HEX = /^[0-9a-f]{64}$/;
const API_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const VERB = /^[a-z][a-z0-9-]{0,23}$/;
const EVENT = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;
const KEY = /^(?:[a-z0-9]|Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Space|Shift\+[a-z0-9])$/;

// ---------------------------------------------------------------- validation

export const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const str = (v, max = 200) => typeof v === 'string' && v.length > 0 && v.length <= max;
// A path inside the pack: relative, forward slashes, no parent steps, no drive letters, no scheme.
export const safePath = p => str(p, 200) && !/^[/\\]|\\|^[a-z][a-z0-9+.-]*:|(^|\/)\.\.(\/|$)|^~/i.test(p);

// Every problem with a pack.json, in words; an empty list means it meets the contract.
export function validatePack(p) {
  const bad = [];
  const need = (ok, why) => { if (!ok) bad.push(why); };
  if (!isObj(p)) return ['pack.json is not an object'];
  need(p.contract === CONTRACT, `contract must be "${CONTRACT}"`);
  for (const k of Object.keys(p)) need(TOP_KEYS.includes(k), `${k} is not a pack.json field (a new field needs a new contract minor)`);
  if (p.description !== undefined) need(typeof p.description === 'string' && p.description.length <= 400, 'description must be at most 400 characters');
  need(typeof p.id === 'string' && ID.test(p.id), 'id must be 2-40 characters: lower-case letters, digits, hyphens, starting with a letter');
  need(typeof p.version === 'string' && SEMVER.test(p.version), 'version must be semantic (1.2.3)');
  need(KINDS.includes(p.kind), `kind must be one of ${KINDS.join(', ')}`);
  need(str(p.title, 60), 'title must be 1-60 characters');
  need(safePath(p.entry) && /\.mjs$/.test(p.entry), 'entry must be a relative .mjs path inside the pack');
  need(typeof p.sha256 === 'string' && HEX.test(p.sha256), 'sha256 must be 64 lower-case hex characters (the entry, normalised)');
  need(typeof p.licence === 'string' && /^[A-Za-z0-9.+-]{2,40}$/.test(p.licence), 'licence must be an SPDX identifier');
  need(typeof p.illustrative === 'boolean', 'illustrative must be true or false');
  if (p.kind === 'sim') need(p.illustrative === true, 'a sim pack must be labelled illustrative');

  const r = p.requires;
  if (!isObj(r)) bad.push('requires must be an object');
  else {
    need(typeof r.api === 'string' && API_RE.test(r.api), 'requires.api must be "major.minor"');
    if (r.lib !== undefined) need(Number.isInteger(r.lib) && r.lib > 0, 'requires.lib must be a positive integer');
    if (r.packs !== undefined) {
      if (!isObj(r.packs)) bad.push('requires.packs must map pack ids to major versions');
      else for (const [k, v] of Object.entries(r.packs)) need(ID.test(k) && Number.isInteger(v) && v >= 0, `requires.packs.${k} must be a major version number`);
    }
  }

  const b = p.budget;
  if (!isObj(b)) bad.push('budget must be an object');
  else {
    need(Number.isInteger(b.maxVertices) && b.maxVertices >= 0 && b.maxVertices <= LIMITS.maxVertices, `budget.maxVertices must be an integer 0-${LIMITS.maxVertices}`);
    need(typeof b.maxMsPerFrame === 'number' && b.maxMsPerFrame > 0 && b.maxMsPerFrame <= LIMITS.maxMsPerFrame, `budget.maxMsPerFrame must be above 0 and at most ${LIMITS.maxMsPerFrame}`);
    need(typeof b.lazy === 'boolean', 'budget.lazy must be true or false');
  }

  const v = p.provides;
  if (!isObj(v)) bad.push('provides must be an object');
  else {
    const verbs = new Set();
    for (const [i, c] of (Array.isArray(v.commands) ? v.commands : []).entries()) {
      if (!isObj(c) || !VERB.test(c.verb ?? '')) { bad.push(`provides.commands[${i}].verb must be a lower-case word`); continue; }
      need(!verbs.has(c.verb), `provides.commands: ${c.verb} is listed twice`);
      verbs.add(c.verb);
      need(str(c.usage, 120) && c.usage.split(/\s+/)[0] === c.verb, `provides.commands.${c.verb}.usage must start with the verb`);
      need(str(c.words, 200), `provides.commands.${c.verb}.words must be plain search words`);
    }
    if (v.commands !== undefined) need(Array.isArray(v.commands), 'provides.commands must be a list');
    for (const [i, h] of (Array.isArray(v.hud) ? v.hud : []).entries()) need(isObj(h) && VERB.test(h.id ?? '') && str(h.label, 40), `provides.hud[${i}] needs an id and a label`);
    if (v.hud !== undefined) need(Array.isArray(v.hud) && v.hud.length <= LIMITS.hudLines, `provides.hud must be a list of at most ${LIMITS.hudLines}`);
    if (v.toggle !== undefined) {
      need(isObj(v.toggle) && str(v.toggle.label, 40), 'provides.toggle.label must be 1-40 characters');
      if (isObj(v.toggle)) {
        need(typeof v.toggle.on === 'boolean', 'provides.toggle.on must say whether the pack starts on');
        if (v.toggle.group !== undefined) need(str(v.toggle.group, 40), 'provides.toggle.group must be 1-40 characters');
      }
    }
    for (const [i, k] of (Array.isArray(v.keys) ? v.keys : []).entries()) {
      if (!isObj(k)) { bad.push(`provides.keys[${i}] must be an object`); continue; }
      need(typeof k.key === 'string' && KEY.test(k.key), `provides.keys[${i}].key must be a single key name (a, KeyB, Digit3, F2, ArrowUp, Space, Shift+j)`);
      need(str(k.command, 120) && verbs.has(k.command.split(/\s+/)[0]), `provides.keys[${i}].command must run one of this pack's commands`);
      need(str(k.summary, 80), `provides.keys[${i}].summary must say what the key does`);
    }
    if (v.keys !== undefined) need(Array.isArray(v.keys), 'provides.keys must be a list');
    const ev = v.events;
    if (ev !== undefined) {
      if (!isObj(ev)) bad.push('provides.events must be an object');
      else {
        for (const e of ev.emits ?? []) need(EVENT.test(e) && typeof p.id === 'string' && e.startsWith(p.id + '/'), `provides.events.emits: ${e} must be "${p.id}/<topic>"`);
        for (const e of ev.listens ?? []) need(EVENT.test(e), `provides.events.listens: ${e} must be "<pack>/<topic>"`);
      }
    }
  }

  if (p.data !== undefined) {
    if (!Array.isArray(p.data)) bad.push('data must be a list');
    else for (const [i, d] of p.data.entries()) {
      need(isObj(d) && safePath(d.path), `data[${i}].path must be a relative path inside the pack`);
      need(isObj(d) && typeof d.sha256 === 'string' && HEX.test(d.sha256), `data[${i}].sha256 must be 64 hex characters`);
      need(isObj(d) && str(d.licence, 60), `data[${i}].licence must name the data's licence`);
      need(isObj(d) && str(d.source, 200), `data[${i}].source must say where the data came from`);
    }
  }
  return bad;
}

// Why a pack needing api "M.m" cannot run on a world offering `world` ({ major, minor }); null when it can.
export function apiRefusal(need, world = API) {
  const m = API_RE.exec(String(need ?? ''));
  if (!m) return `it asks for api "${need}", which is not "major.minor"`;
  const [maj, min] = [Number(m[1]), Number(m[2])];
  if (maj !== world.major) return `it needs pack api ${maj}.x, this world offers ${world.major}.${world.minor}`;
  if (min > world.minor) return `it needs pack api ${maj}.${min}, this world offers ${world.major}.${world.minor}`;
  return null;
}

// Why an entry's text is not self-contained (it runs from a blob URL, so it cannot import); null when it is.
export function importRefusal(text) {
  if (/^\s*import\s*[\w{*'"]/m.test(text)) return 'the entry has an import statement; a pack entry must be self-contained';
  if (/^\s*export\s+(?:\*|\{[^}]*\})\s*from\s/m.test(text)) return 'the entry re-exports from another file; a pack entry must be self-contained';
  if (/\bimport\s*\(/.test(text)) return 'the entry calls import(); a pack entry must be self-contained';
  return null;
}

// ---------------------------------------------------------------- hashing and importing

// Same rule as the world's layer loader: a byte-order mark and CRLF line endings are normalised in code only.
export const normalise = text => text.replace(/^﻿/, '').replace(/\r\n/g, '\n');

export async function sha256Text(text, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return null;
  const d = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Imports checked module text. In a browser a blob URL (as the world's layers); in Node a data URL.
// Each call yields a fresh module instance, so a pack's module-level state is its own. Node would cache a data URL
// of the same text as one module, so each import there gets a numbered trailing comment (after the hash check).
let instances = 0;
export async function importText(text) {
  const node = typeof process !== 'undefined' && !!process.versions?.node;
  if (!node && typeof Blob === 'function' && URL.createObjectURL) {
    const u = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    try { return await import(u); } finally { URL.revokeObjectURL(u); }
  }
  const t = `${text}\n// pack instance ${++instances}\n`;
  const b64 = typeof Buffer === 'function' ? Buffer.from(t, 'utf8').toString('base64')
    : btoa(String.fromCharCode(...new TextEncoder().encode(t)));
  return import('data:text/javascript;base64,' + b64);
}

// ---------------------------------------------------------------- events

// One bus per world. Names are "<source>/<topic>". A pack emits only under its own id and only what it declared;
// it hears world/* and whatever it declared under listens. Payloads are cloned (data only, no functions), and a
// listener that throws is reported, never allowed to stop the others. Delivery is synchronous, in subscription order.
export function createBus({ onError = () => {}, clone = globalThis.structuredClone, maxDepth = 16 } = {}) {
  const subs = new Map();
  let depth = 0;
  const on = (name, fn) => {
    if (!subs.has(name)) subs.set(name, []);
    const list = subs.get(name), rec = { fn };
    list.push(rec);
    return () => { const i = list.indexOf(rec); if (i >= 0) list.splice(i, 1); };
  };
  const emit = (name, payload) => {
    if (depth >= maxDepth) { onError(name, Error(`events nested deeper than ${maxDepth}: ${name} dropped`)); return 0; }
    const list = subs.get(name);
    if (!list?.length) return 0;
    const data = payload === undefined ? undefined : clone ? clone(payload) : JSON.parse(JSON.stringify(payload));
    if (data && typeof data === 'object') deepFreeze(data);
    depth++;
    let n = 0;
    try { for (const rec of [...list]) { try { rec.fn(data, name); n++; } catch (e) { onError(name, e); } } } finally { depth--; }
    return n;
  };
  const scoped = (id, declared = {}) => {
    const emits = new Set(declared.emits || []), listens = new Set(declared.listens || []), offs = [];
    return Object.freeze({
      on(name, fn) {
        if (typeof fn !== 'function') throw TypeError('events.on needs a function');
        if (!name.startsWith('world/') && !listens.has(name)) throw Error(`${id} did not declare that it listens to ${name}`);
        const off = on(name, fn); offs.push(off); return off;
      },
      emit(topic, payload) {
        const name = `${id}/${topic}`;
        if (!emits.has(name)) throw Error(`${id} did not declare that it emits ${name}`);
        return emit(name, payload);
      },
      offAll() { while (offs.length) offs.pop()(); }
    });
  };
  return Object.freeze({ on, emit, scoped });
}

function deepFreeze(o) {
  if (ArrayBuffer.isView(o)) return o; // typed arrays cannot be frozen; they are copies, so a listener's change stays its own
  Object.freeze(o);
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return o;
}

// ---------------------------------------------------------------- fixed step

// Whole steps due after real time `dt` with carry `acc`: { steps, acc, dropped }. Pure and deterministic.
export function advance(acc, dt, fixed = FIXED_DT, max = MAX_SUBSTEPS) {
  const t = acc + (Number.isFinite(dt) && dt > 0 ? dt : 0);
  let steps = Math.floor(t / fixed + 1e-9);
  let rest = Math.max(0, t - steps * fixed);
  let dropped = 0;
  if (steps > max) { dropped = steps - max; steps = max; rest = 0; }
  return { steps, acc: rest, dropped };
}

// ---------------------------------------------------------------- reading a pack

export async function getText(fetchImpl, url) {
  const res = await fetchImpl(url, { cache: 'no-cache' });
  if (!res.ok) throw Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// Reads and validates <from>pack.json. `from` is a folder URL (a trailing slash is added) resolved against `base`.
export async function readPack(from, { base, fetchImpl = (u, o) => fetch(u, o) } = {}) {
  const folder = new URL(String(from).replace(/\/?$/, '/'), base).href;
  let pack;
  try { pack = JSON.parse(await getText(fetchImpl, new URL('pack.json', folder).href)); }
  catch (e) { return { folder, pack: null, problems: ['pack.json could not be read: ' + e.message] }; }
  return { folder, pack, problems: validatePack(pack) };
}

// Why a module's default export cannot run as this pack; null when it can.
export function shapeRefusal(mod, pack) {
  if (!isObj(mod) && typeof mod !== 'object') return 'the entry has no default export object';
  if (!mod) return 'the entry has no default export object';
  for (const h of HOOKS) if (h in mod && typeof mod[h] !== 'function') return `${h} must be a function`;
  if (mod.id !== undefined && mod.id !== pack.id) return `the entry says id ${mod.id}, pack.json says ${pack.id}`;
  if (typeof mod.step === 'function' && pack.illustrative !== true) return 'the entry simulates (step) but pack.json does not label it illustrative';
  if (typeof mod.heightAt === 'function' && pack.kind !== 'layer') return 'only a layer pack may offer ground (heightAt)';
  if (!HOOKS.some(h => typeof mod[h] === 'function')) return 'the entry offers none of the hooks';
  return null;
}
