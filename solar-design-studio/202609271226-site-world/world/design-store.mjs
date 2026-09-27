// design-store.mjs: the versioned design document for everything drawn in the world.
// Pure: no imports, no DOM. Browser facilities (crypto.subtle, CompressionStream, localStorage)
// are reached through globalThis or passed in, and every one of them may be missing.
//
// THE DOCUMENT
//   { schema: 'world.design.v1', generation, site: { name, origin_e, origin_n },
//     items: [{ id, kind, params, points_bng: [[e, n] | [e, n, z], ...] }] }
//   Every coordinate is British National Grid metres, rounded to the millimetre. Local metres
//   never enter the document: the viewer's origin moves (see origin.mjs) and a design stored in
//   local metres would move with it. `kind` is open (trench, cable, road, pad, fence, hdd, pile,
//   or anything later); `params` is any plain JSON object the kind needs.
//   site.origin_e / origin_n record where the site was set up; they do not move the items.
//
// WHAT IT GUARANTEES
//   Canonical JSON (sorted keys, no spaces, -0 written as 0) so the SHA-256 is the same on any
//   machine. Import refuses an unknown schema by name and never guesses. Undo and redo keep
//   whole snapshots; generation only ever goes up, so no two states share a generation.

export const SCHEMA = 'world.design.v1';
export const KNOWN_SCHEMAS = Object.freeze([SCHEMA]);
export const LINK_KEY = 'design';
export const LINK_VERSION = '1';
export const LIMITS = Object.freeze({
  // points and fileBytes agree: 200,000 points of three coordinates export to well under 8 MB.
  items: 20000, pointsPerItem: 100000, points: 200000, paramsDepth: 8,
  fileBytes: 8 * 1024 * 1024, linkChars: 8000, linkInflatedBytes: 2 * 1024 * 1024, history: 200
});
// National Grid extent with a margin: anything outside is a local-metre mistake, not a design.
const BNG = { eMin: -10000, eMax: 710000, nMin: -10000, nMax: 1310000 };
const KIND = /^[a-z][a-z0-9_-]{0,39}$/;
const ID = /^[A-Za-z0-9_.:-]{1,64}$/;

const mm = v => { const r = Math.round(v * 1000) / 1000; return r === 0 ? 0 : r; };
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// ---------- canonical JSON and hash ----------

export function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonical JSON cannot hold a non-finite number');
    return JSON.stringify(value === 0 ? 0 : value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (isObj(value)) {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  throw new Error(`canonical JSON cannot hold a ${typeof value}`);
}

export async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 is not available here (no crypto.subtle)');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash of the whole document, generation included.
export const hashDoc = doc => sha256Hex(canonicalJson(doc));

// ---------- building and validating ----------

export function createDoc({ name = 'untitled', origin_e, origin_n } = {}) {
  const doc = { schema: SCHEMA, generation: 0, site: { name: String(name), origin_e: mm(origin_e), origin_n: mm(origin_n) }, items: [] };
  const v = validateDoc(doc);
  if (!v.ok) throw new Error(v.errors.join('; '));
  return doc;
}

const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
function checkParams(p, depth, path, errors) {
  if (depth > LIMITS.paramsDepth) { errors.push(`${path} nests deeper than ${LIMITS.paramsDepth}`); return; }
  if (typeof p === 'number') { if (!Number.isFinite(p)) errors.push(`${path} is not a finite number`); return; }
  if (p === null || typeof p === 'string' || typeof p === 'boolean') return;
  if (Array.isArray(p)) { p.forEach((v, i) => checkParams(v, depth + 1, `${path}[${i}]`, errors)); return; }
  if (isObj(p)) {
    for (const k of Object.keys(p)) {
      if (FORBIDDEN_KEYS.includes(k)) { errors.push(`${path} uses the reserved key "${k}"`); continue; }
      checkParams(p[k], depth + 1, `${path}.${k}`, errors);
    }
    return;
  }
  errors.push(`${path} is not plain JSON`);
}

function checkPoints(pts, path, errors) {
  if (!Array.isArray(pts)) { errors.push(`${path} is not a list`); return 0; }
  if (pts.length > LIMITS.pointsPerItem) { errors.push(`${path} has ${pts.length} points, over ${LIMITS.pointsPerItem}`); return pts.length; }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!Array.isArray(p) || (p.length !== 2 && p.length !== 3) || !p.every(Number.isFinite)) {
      errors.push(`${path}[${i}] is not [e, n] or [e, n, z] in metres`); return pts.length;
    }
    if (p[0] < BNG.eMin || p[0] > BNG.eMax || p[1] < BNG.nMin || p[1] > BNG.nMax) {
      errors.push(`${path}[${i}] (${p[0]}, ${p[1]}) is outside the National Grid; local metres are never stored`);
      return pts.length;
    }
  }
  return pts.length;
}

// Returns { ok, errors }. Checks shape, not meaning: the store does not know what a trench is.
export function validateDoc(doc) {
  const errors = [];
  if (!isObj(doc)) return { ok: false, errors: ['the design is not a JSON object'] };
  if (typeof doc.schema !== 'string') errors.push('the design has no schema name');
  else if (!KNOWN_SCHEMAS.includes(doc.schema)) {
    errors.push(`unknown schema "${doc.schema}"; this viewer reads ${KNOWN_SCHEMAS.join(', ')} only`);
    return { ok: false, errors };
  }
  if (!Number.isInteger(doc.generation) || doc.generation < 0) errors.push('generation is not a whole number from 0');
  const s = doc.site;
  if (!isObj(s)) errors.push('site is missing');
  else {
    if (typeof s.name !== 'string' || s.name.length > 200) errors.push('site.name is not a short text');
    if (!Number.isFinite(s.origin_e) || s.origin_e < BNG.eMin || s.origin_e > BNG.eMax) errors.push('site.origin_e is not a National Grid easting');
    if (!Number.isFinite(s.origin_n) || s.origin_n < BNG.nMin || s.origin_n > BNG.nMax) errors.push('site.origin_n is not a National Grid northing');
  }
  if (!Array.isArray(doc.items)) errors.push('items is not a list');
  else {
    if (doc.items.length > LIMITS.items) errors.push(`${doc.items.length} items, over the limit of ${LIMITS.items}`);
    const seen = new Set();
    let total = 0;
    doc.items.forEach((it, i) => {
      const at = `items[${i}]`;
      if (!isObj(it)) { errors.push(`${at} is not an object`); return; }
      if (typeof it.id !== 'string' || !ID.test(it.id)) errors.push(`${at}.id is not a short id`);
      else if (seen.has(it.id)) errors.push(`${at}.id "${it.id}" is used twice`);
      else seen.add(it.id);
      if (typeof it.kind !== 'string' || !KIND.test(it.kind)) errors.push(`${at}.kind is not a lower-case name`);
      if (!isObj(it.params)) errors.push(`${at}.params is not an object`);
      else checkParams(it.params, 1, `${at}.params`, errors);
      total += checkPoints(it.points_bng, `${at}.points_bng`, errors);
    });
    if (total > LIMITS.points) errors.push(`${total} points in all, over the limit of ${LIMITS.points}`);
  }
  const extra = isObj(doc) ? Object.keys(doc).filter(k => !['schema', 'generation', 'site', 'items'].includes(k)) : [];
  if (extra.length) errors.push(`unexpected fields: ${extra.join(', ')}`);
  return { ok: errors.length === 0, errors };
}

// A clean copy: points rounded to the millimetre, params deep-copied through JSON.
function normaliseItem(it) {
  return {
    id: it.id, kind: it.kind,
    params: JSON.parse(canonicalJson(it.params ?? {})),
    points_bng: (it.points_bng ?? []).map(p => p.map(mm))
  };
}

// The stored form of a valid document: fields in order, coordinates to the millimetre.
export const normaliseDoc = doc => ({
  schema: doc.schema, generation: doc.generation,
  site: { name: doc.site.name, origin_e: mm(doc.site.origin_e), origin_n: mm(doc.site.origin_n) },
  items: doc.items.map(normaliseItem)
});

// ---------- local metres <-> grid metres ----------
// `origin` is the viewer's live origin { e, n } (origin.mjs), which may differ from site.origin.

export const pointsFromLocal = (origin, pts) => pts.map(([x, y, z]) =>
  z === undefined ? [mm(origin.e + x), mm(origin.n + y)] : [mm(origin.e + x), mm(origin.n + y), mm(z)]);

export const pointsToLocal = (origin, pts) => pts.map(([e, n, z]) =>
  z === undefined ? [e - origin.e, n - origin.n] : [e - origin.e, n - origin.n, z]);

// Every item with points in local metres around `origin`, ready to draw.
export const itemsToLocal = (doc, origin) =>
  doc.items.map(it => ({ id: it.id, kind: it.kind, params: it.params, points: pointsToLocal(origin, it.points_bng) }));

// Item from a tool working in local metres: { id, kind, params, points } -> stored item.
export const itemFromLocal = (origin, { id, kind, params = {}, points }) =>
  ({ id, kind, params, points_bng: pointsFromLocal(origin, points) });

// ---------- edits and history ----------

// Pure edit. op: { op: 'add', item } | { op: 'update', id, params?, points_bng? } |
// { op: 'remove', id } | { op: 'site', site: { name?, origin_e?, origin_n? } }. Throws on a bad edit.
export function applyOp(doc, op) {
  let items = doc.items, site = doc.site;
  const at = id => { const i = items.findIndex(it => it.id === id); if (i < 0) throw new Error(`no item "${id}"`); return i; };
  if (op?.op === 'add') items = [...items, normaliseItem(op.item ?? {})];
  else if (op?.op === 'update') {
    const i = at(op.id), cur = items[i];
    const next = normaliseItem({ ...cur, ...(op.params ? { params: op.params } : {}), ...(op.points_bng ? { points_bng: op.points_bng } : {}) });
    items = items.map((it, j) => (j === i ? next : it));
  } else if (op?.op === 'remove') { const i = at(op.id); items = items.filter((_, j) => j !== i); }
  else if (op?.op === 'site') {
    const s = { ...site, ...op.site };
    site = { name: String(s.name), origin_e: mm(s.origin_e), origin_n: mm(s.origin_n) };
  } else throw new Error(`unknown edit "${op?.op}"`);
  const next = { schema: doc.schema, generation: doc.generation + 1, site, items };
  const v = validateDoc(next);
  if (!v.ok) throw new Error(v.errors.join('; '));
  return next;
}

// Snapshot history. Undo and redo give the earlier or later content a new, higher generation.
export function createHistory(doc, { limit = LIMITS.history } = {}) {
  const v = validateDoc(doc);
  if (!v.ok) throw new Error(v.errors.join('; '));
  let current = doc;
  const past = [], future = [];
  const bump = d => ({ ...d, generation: current.generation + 1 });
  return {
    get doc() { return current; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    apply(op) {
      const next = applyOp(current, op);
      past.push(current); if (past.length > limit) past.shift();
      future.length = 0; current = next; return current;
    },
    undo() { if (!past.length) return null; future.push(current); current = bump(past.pop()); return current; },
    redo() { if (!future.length) return null; past.push(current); current = bump(future.pop()); return current; },
    // Replace everything (an import): undoable back to what was there.
    replace(d) {
      const r = validateDoc(d); if (!r.ok) throw new Error(r.errors.join('; '));
      past.push(current); if (past.length > limit) past.shift();
      future.length = 0; current = { ...d, generation: Math.max(d.generation, current.generation + 1) }; return current;
    }
  };
}

// ---------- export and import ----------

// The file: canonical JSON of the document plus "sha256" of the document without it.
export async function exportFile(doc) {
  const v = validateDoc(doc);
  if (!v.ok) throw new Error(v.errors.join('; '));
  doc = normaliseDoc(doc);
  const sha256 = await hashDoc(doc);
  const safe = doc.site.name.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'design';
  const text = canonicalJson({ ...doc, sha256 }) + '\n', bytes = new TextEncoder().encode(text).length;
  if (bytes > LIMITS.fileBytes) throw new Error(`the design file would be ${bytes} bytes, over the limit of ${LIMITS.fileBytes}`);
  return { filename: `${safe}-g${doc.generation}.design.json`, mime: 'application/json', text, sha256 };
}

// Browser helper; the DOM pieces are passed in so this file stays pure.
export async function downloadFile(doc, { document = globalThis.document, URL = globalThis.URL, Blob = globalThis.Blob } = {}) {
  const f = await exportFile(doc);
  const url = URL.createObjectURL(new Blob([f.text], { type: f.mime }));
  const a = document.createElement('a');
  a.href = url; a.download = f.filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return f;
}

// Returns { ok: true, doc, sha256 } or { ok: false, errors }. Never throws on bad input.
// A file must carry its sha256; only this viewer's own copies (autosave, share links with their own checksum) may omit it.
export async function importText(text, { maxBytes = LIMITS.fileBytes, unsigned = false } = {}) {
  if (typeof text !== 'string') return { ok: false, errors: ['nothing to import'] };
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > maxBytes) return { ok: false, errors: [`the file is ${bytes} bytes, over the limit of ${maxBytes}`] };
  let raw;
  try { raw = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { return { ok: false, errors: [`not valid JSON: ${e.message}`] }; }
  if (!isObj(raw)) return { ok: false, errors: ['the design is not a JSON object'] };
  const { sha256: claimed, ...doc } = raw;
  const v = validateDoc(doc);
  if (!v.ok) return { ok: false, errors: v.errors };
  const clean = normaliseDoc(doc);
  const sha256 = await hashDoc(clean);
  if (claimed === undefined && !unsigned) {
    return { ok: false, errors: ['the file has no sha256 checksum, so it cannot be shown to be unaltered; export it again from the viewer'] };
  }
  if (claimed !== undefined && claimed !== sha256) {
    return { ok: false, errors: [`the file says sha256 ${String(claimed).slice(0, 12)}… but its content hashes to ${sha256.slice(0, 12)}…; it has been altered or damaged`] };
  }
  return { ok: true, doc: clean, sha256 };
}

// ---------- share link (URL fragment) ----------
// #design=1.<first 12 hex of sha256>.<base64url of deflate-raw canonical JSON>

const b64url = bytes => {
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = s => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

async function pump(bytes, stream, cap) {
  const out = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const parts = []; let n = 0;
  for (;;) {
    const { done, value } = await out.read();
    if (done) break;
    n += value.length;
    if (n > cap) { await out.cancel(); throw new Error(`the link expands past ${cap} bytes; refused`); }
    parts.push(value);
  }
  const all = new Uint8Array(n); let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return all;
}

// Returns { ok: true, fragment, chars } or { ok: false, errors } saying why (too long, no compression).
export async function makeShareLink(doc, { maxChars = LIMITS.linkChars } = {}) {
  const v = validateDoc(doc);
  if (!v.ok) return { ok: false, errors: v.errors };
  if (typeof CompressionStream !== 'function') return { ok: false, errors: ['this browser cannot compress; export the .json instead'] };
  const text = canonicalJson(normaliseDoc(doc)), sha = await sha256Hex(text);
  const packed = await pump(new TextEncoder().encode(text), new CompressionStream('deflate-raw'), Infinity);
  const fragment = `#${LINK_KEY}=${LINK_VERSION}.${sha.slice(0, 12)}.${b64url(packed)}`;
  if (fragment.length > maxChars) {
    return { ok: false, chars: fragment.length, errors: [`the share link would be ${fragment.length} characters, over the limit of ${maxChars}; export the .json file instead`] };
  }
  return { ok: true, fragment, chars: fragment.length };
}

// Accepts a whole URL, a fragment or the bare value. Returns { ok, doc, sha256 } or { ok: false, errors }.
export async function readShareLink(link, { maxChars = LIMITS.linkChars, maxBytes = LIMITS.linkInflatedBytes } = {}) {
  const s = String(link ?? '');
  const hash = s.includes('#') ? s.slice(s.indexOf('#') + 1) : s;
  const value = new URLSearchParams(hash).get(LINK_KEY);
  if (!value) return { ok: false, errors: ['no design in this link'] };
  if (value.length > maxChars) return { ok: false, errors: [`the link is ${value.length} characters, over the limit of ${maxChars}; refused`] };
  const parts = value.split('.');
  if (parts.length !== 3) return { ok: false, errors: ['the link is damaged or cut short'] };
  const [ver, short, body] = parts;
  if (ver !== LINK_VERSION) return { ok: false, errors: [`unknown link version "${ver}"; this viewer reads version ${LINK_VERSION} only`] };
  if (!/^[0-9a-f]{12}$/.test(short ?? '') || !/^[A-Za-z0-9_-]+$/.test(body ?? '')) return { ok: false, errors: ['the link is damaged or cut short'] };
  if (typeof DecompressionStream !== 'function') return { ok: false, errors: ['this browser cannot decompress links'] };
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(await pump(unb64url(body), new DecompressionStream('deflate-raw'), maxBytes)); }
  catch (e) {
    const cap = /expands past/.test(e?.message ?? '');
    if (!cap) console.warn('share link:', e);
    return { ok: false, errors: [cap ? e.message : 'the link is damaged or incomplete; ask for it to be sent again'] };
  }
  const r = await importText(text, { maxBytes, unsigned: true }); // the link carries its own checksum, checked below
  if (!r.ok) return r;
  if (r.sha256.slice(0, 12) !== short) return { ok: false, errors: ['the link content does not match its checksum; it has been altered'] };
  return r;
}

// ---------- local autosave ----------
// Storage can be missing, full, blocked or cleared; every call is wrapped and none of them throws.

// Keyed on where the site is (its origin), not its display name: two sites never share a save, and a rename keeps it.
export const storageKey = site => `world.design:${mm(Number(site?.origin_e))},${mm(Number(site?.origin_n))}`;
const BLOCKED = 'local storage is blocked in this browser';
const pickStorage = s => {
  if (s) return { st: s };
  try { return { st: globalThis.localStorage ?? null }; } catch { return { st: null, blocked: true }; }
};
const noStorage = p => ({ ok: false, reason: p.blocked ? BLOCKED : 'no local storage here' });

export function autosave(doc, { storage, key = storageKey(doc?.site) } = {}) {
  try {
    const p = pickStorage(storage), st = p.st;
    if (!st) return noStorage(p);
    st.setItem(key, canonicalJson(normaliseDoc(doc)));
    return { ok: true, key };
  } catch (e) { return { ok: false, reason: `autosave failed: ${e?.message ?? e}` }; }
}

// site: { origin_e, origin_n } (a document's site). Returns { ok: true, doc } | { ok: false, reason }.
export async function loadAutosave(site, { storage, key = storageKey(site) } = {}) {
  let text;
  try {
    const p = pickStorage(storage), st = p.st;
    if (!st) return noStorage(p);
    text = st.getItem(key);
  } catch (e) { return { ok: false, reason: `local storage blocked: ${e?.message ?? e}` }; }
  if (text == null) return { ok: false, reason: 'nothing saved' };
  const r = await importText(text, { unsigned: true });
  return r.ok ? { ok: true, doc: r.doc } : { ok: false, reason: `saved copy refused: ${r.errors.join('; ')}` };
}

export function clearAutosave(site, { storage, key = storageKey(site) } = {}) {
  try { const { st } = pickStorage(storage); if (!st) return false; st.removeItem(key); return true; } catch { return false; }
}
