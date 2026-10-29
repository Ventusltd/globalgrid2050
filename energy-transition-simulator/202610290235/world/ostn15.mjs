// OSTN15: the Ordnance Survey's definitive ETRS89 (GPS) <-> National Grid transformation, horizontal part.
// bng.mjs's Helmert is good to about 3.5 m; this is good to about 0.1 m (OS: OSTN15 reproduces the National Grid to
// 0.1 m r.m.s. and its NTv2 form agrees with it to a few mm at the check points), where a block is loaded.
//
// Data: OSTN15_NTv2_OSGBtoETRS (OS; PROJ data uk_os_OSTN15_NTv2_OSGBtoETRS.tif, BSD 2-Clause, derived from Ordnance
// Survey work), cut into 1-degree blocks over England by tools/ostn15/cut_ostn15.py: web/world/data/ostn15/.
// Each block is fetched only when a place inside it is converted, and hash-checked against ostn15.json.
// Nodes: 1' of longitude by 0.5' of latitude, OSGB36 latitude and longitude offsets (to ETRS89) in arc-seconds,
// bilinear between nodes (the NTv2 method). Outside the loaded blocks the Helmert answer is given, marked approx.
import { tmForward, tmInverse, bngToWgs84, wgs84ToBng } from './bng.mjs';

const RAD = Math.PI / 180, UNIT = 1e-5; // offsets are stored in 1e-5 arc-second steps
export const INDEX = 'data/ostn15/ostn15.json';
export const INDEX_SHA256 = 'da7893530d19f35b0253737cc9264d6b3fc364d0711f1aba3d2a0160e9b8f74e'; // tests/ostn15.test.mjs checks it against the file

// Pure: a block file -> { lat0, lon0, cols, rows, v: Int32Array (lat, lon offsets per node) }.
export function decodeBlock(buffer) {
  const dv = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'O15B' || dv.getUint16(4, true) !== 1) throw Error('not an OSTN15 block (O15B version 1)');
  const cols = dv.getUint16(6, true), rows = dv.getUint16(8, true);
  if (dv.byteLength !== 16 + cols * rows * 8) throw Error(`OSTN15 block is ${dv.byteLength} bytes, expected ${16 + cols * rows * 8}`);
  const v = new Int32Array(cols * rows * 2);
  for (let k = 0; k < v.length; k++) v[k] = dv.getInt32(16 + 4 * k, true);
  return { lat0: dv.getInt16(12, true), lon0: dv.getInt16(14, true), cols, rows, v };
}

export const blockKey = (lat, lon) => `${Math.floor(lat)}_${Math.floor(lon)}`;

// Pure: the offsets at an OSGB36 latitude and longitude (degrees), in arc-seconds, or null off the loaded blocks.
export function shiftAt(blocks, lat, lon) {
  const b = blocks.get(blockKey(lat, lon));
  if (!b) return null;
  const x = (lon - b.lon0) * 60, y = (lat - b.lat0) * 120;
  const i = Math.min(b.cols - 2, Math.floor(x)), j = Math.min(b.rows - 2, Math.floor(y)), fx = x - i, fy = y - j;
  const at = (c, r, k) => b.v[2 * (r * b.cols + c) + k];
  const bil = k => ((1 - fx) * (1 - fy) * at(i, j, k) + fx * (1 - fy) * at(i + 1, j, k) + (1 - fx) * fy * at(i, j + 1, k) + fx * fy * at(i + 1, j + 1, k)) * UNIT;
  return { dlat: bil(0), dlon: bil(1) };
}

// Pure: National Grid -> ETRS89 { lat, lon } (degrees), or null where no block is loaded.
export function bngToEtrs(blocks, e, n) {
  const g = tmInverse(e, n), lat = g.lat / RAD, lon = g.lon / RAD, s = shiftAt(blocks, lat, lon);
  return s ? { lat: lat + s.dlat / 3600, lon: lon + s.dlon / 3600 } : null;
}

// Pure: ETRS89 (GPS, WGS84 to a metre) -> National Grid { e, n }, or null where no block is loaded.
// The offsets are given at the OSGB36 position, so it is found by fixed-point iteration (converges in 3 to 4 steps).
export function etrsToBng(blocks, lat, lon) {
  let la = lat, lo = lon;
  for (let k = 0; k < 6; k++) {
    const s = shiftAt(blocks, la, lo);
    if (!s) return null;
    la = lat - s.dlat / 3600; lo = lon - s.dlon / 3600;
  }
  return tmForward(la * RAD, lo * RAD);
}

// Fetch a file beside this module and refuse it unless its SHA-256 is the one given.
async function getChecked(path, sha) {
  const res = await fetch(new URL(path, import.meta.url), { cache: 'no-cache' });
  if (!res.ok) throw Error(`${path}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer(), d = await globalThis.crypto.subtle.digest('SHA-256', buf);
  if ([...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('') !== sha) throw Error(`${path}: hash does not match`);
  return buf;
}

// The page's converter. get(path, sha) -> ArrayBuffer, hash-checked. Sync calls use whatever blocks are loaded and
// say whether the answer is OSTN15 or the Helmert fallback; need() loads a block.
export function createOstn15({ get = getChecked, indexSha = INDEX_SHA256 } = {}) {
  const blocks = new Map(), pending = new Map();
  let index = null;
  const loadIndex = () => (index ||= get(INDEX, indexSha).then(b => JSON.parse(new TextDecoder().decode(b))));
  async function need(lat, lon) {
    const key = blockKey(lat, lon);
    if (blocks.has(key)) return true;
    if (!pending.has(key)) {
      pending.set(key, loadIndex().then(ix => {
        const row = (ix.blocks || []).find(r => `${r.lat0}_${r.lon0}` === key);
        if (!row) return false; // outside England's blocks: Helmert stays
        return get(INDEX.replace(/[^/]+$/, row.file), row.sha256).then(buf => { blocks.set(key, decodeBlock(buf)); return true; });
      }).catch(() => false));
    }
    return pending.get(key);
  }
  return {
    need,
    needBng: (e, n) => { const g = bngToWgs84(e, n); return need(g.lat, g.lon); },
    toBng(lat, lon) { const p = etrsToBng(blocks, lat, lon); return p ? { ...p, ostn15: true } : { ...wgs84ToBng(lat, lon), ostn15: false }; },
    toLatLon(e, n) { const p = bngToEtrs(blocks, e, n); return p ? { ...p, ostn15: true } : { ...bngToWgs84(e, n), ostn15: false }; },
    blocks
  };
}
