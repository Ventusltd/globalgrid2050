// Public solar records adapted to the Generator's typed rendering buffers.
// The numeric block slot is a rendering shape, not a claim that REPD IDs are code blocks.
import { PAL, REL } from '../202609142225/core.js';
export { PAL, REL };
export const SEED_RE = /^[a-f0-9]{64}$/;
export const STATUS_COLOURS = ['#8eb7db','#d9b9e8','#9ccbc8','#e7c995','#b4bcea','#c2cbd6','#caacd0','#a4cddd','#d2c4a4','#b7c5df','#c9b7a5','#abc5bf'];
export function unit(seed, key) {
  // FNV-1a, then the Generator's mulberry32 mixing; no clock-dependent inputs.
  let h = 2166136261;
  for (const c of `${seed}:${key}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  let t = h + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function makeCore(pack) {
  if (!Array.isArray(pack.projects) || !pack.projects.length) throw new Error('No public project records');
  const rec = [...pack.projects].sort((a,b) => a.repd_ref < b.repd_ref ? -1 : a.repd_ref > b.repd_ref ? 1 : 0);
  const statuses = [...new Set(rec.map(p => p.status))].sort();
  if (statuses.length > 13) throw new Error('Status palette needs an explicit update');
  const byKey = new Map();
  for (const [i,p] of rec.entries()) {
    if (typeof p.repd_ref !== 'string' || !/^\d+$/.test(p.repd_ref) || byKey.has(p.repd_ref)) throw new Error('Invalid or duplicate REPD key');
    if (p.capacity_mw !== null && (!Number.isFinite(p.capacity_mw) || p.capacity_mw < 0)) throw new Error('Invalid capacity');
    const missing = p.latitude === null && p.longitude === null;
    const valid = Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
    if (!(missing || valid) || p.geometry_status !== (missing ? 'missing' : 'valid')) throw new Error('Inconsistent geometry');
    byKey.set(p.repd_ref, i);
  }
  const cat = Uint8Array.from(rec, p => statuses.indexOf(p.status));
  const core = { N:rec.length, rec, byKey, statuses, cat, cls:new Uint8Array(rec.length).fill(2),
    keyStr:rec.map(p=>p.repd_ref), mass:Float32Array.from(rec,p=>p.capacity_mw ?? 0),
    range:{block:[0,rec.length]}, U:{cats:statuses.slice(0,12).map((title,i)=>({title,colour:STATUS_COLOURS[i]}))}, PAL, REL,
    resolve:key=>byKey.get(key) ?? -1,
    label:i=> i < 0 ? 'No project selected' : `${rec[i].repd_ref} · ${rec[i].name}`,
    colour:i=>i < 0 ? PAL.muted : STATUS_COLOURS[cat[i]] || PAL.muted,
  };
  return core;
}
export function readState(search, defaultSeed, core) {
  if (!SEED_RE.test(defaultSeed)) throw new Error('Invalid snapshot seed');
  const q = new URLSearchParams(search), notes = [];
  let seed = q.get('seed') || defaultSeed;
  if (!SEED_RE.test(seed)) { seed = defaultSeed; notes.push('Malformed seed; snapshot seed restored.'); }
  const lens = ['ring','table'].includes(q.get('lens')) ? q.get('lens') : 'ring';
  if (q.has('lens') && q.get('lens') !== lens) notes.push('Unknown lens; ring restored.');
  let key = q.get('repd_ref') || '';
  if(key&&!/^\d+$/.test(key)){key='';notes.push('Malformed REPD key removed.');}
  const focus = core.resolve(key);
  if (key && focus < 0) notes.push(`REPD ${key.slice(0,80)} is not in this published snapshot.`);
  return {seed,lens,key,focus,notes};
}
export function queryFor(s) {
  const q = new URLSearchParams({lens:s.lens,seed:s.seed});
  if (s.key) q.set('repd_ref',s.key);
  return `?${q}`;
}
export function projectURL(ref) {
  if (!/^\d+$/.test(ref)) throw new Error('Invalid REPD link');
  return `https://globalgrid2050.com/pipelinenews_intelligence/202609050309/?repd_ref=${ref}`;
}
export function seriesLight(series) {
  if (!Array.isArray(series) || !series.length) throw new Error('Missing PV series');
  const values = series.map(p=>p.generation_mw);
  if (values.some(x=>!Number.isFinite(x)||x<0)) throw new Error('Invalid PV generation');
  const peak = Math.max(...values);
  return values.map(x=>peak ? x/peak : 0);
}
