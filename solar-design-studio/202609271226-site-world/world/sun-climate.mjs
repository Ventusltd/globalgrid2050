// Sun mode, measured-climate data: readers for a site's precomputed sun files (gw-lidar sun-data/src/sun_data.py
// and sun_cells.py). Pure: no DOM, no fetching. The page fetches each file through the substrate's hash check.
// Every value keeps its source and licence; nothing is shown without them.
//
// <site>/sun/sun-climate.json  format "sun-climate/1": PVGIS 5.3 typical meteorological year at the site centre.
//   { source: { radiation_db, meteo_db, years }, licence: { name, text, url }, attribution: "...",
//     monthly: { sunshine_hours: [12], ghi_kwh_m2: [12], bhi_kwh_m2: [12], ... }, hourly: { file, sha256, ... } }
//   (tmy-hourly.bin, the 8760 hourly values, is not needed by the page and is not fetched.)
// <site>/sun/cells/sun-cells.json  format "gsc1": { tile_m: 256, cell_m: 4, scale: 250, nodata: 255,
//   base: { <quantity>: [12 open-sky monthly values] }, attribution: [..], tiles: [ { key, file, sha256, e0, n0 } ] }
// <site>/sun/cells/tiles/<ix>_<iy>.gsc  little-endian, 32-byte header:
//   0 "GSC1" | 4 u16 version=1 | 6 u16 samples=65 | 8 u16 spacing_mm | 10 u16 months=12 | 12 i32 e0 | 16 i32 n0 (SW)
//   | 20 u16 quantities=4 | 22 u16 scale | 24 u32 nodata_cells | 28 u32 reserved; then u8[samples^2 * 12 * 4],
//   rows south to north, each west to east; per sample 12 months x 4 quantities; value / scale = share of the
//   open-sky monthly base; 255 = unknown. Samples sit on the 4 m grid and share the tile edges.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
export const QUANTITIES = ['clear_beam_hours', 'clear_direct_kwh_m2', 'sunshine_hours', 'tmy_direct_kwh_m2'];
export const SHORT_CREDIT = 'Sun: PVGIS, EU JRC';
export const HADUK_SHORT = 'Sunshine: Met Office HadUK-Grid, OGL v3.0';
export const HADUK_DOI = '10.5285/789b3065d74a4c948ab05d33556c86d0';

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = v => (typeof v === 'string' && v.trim() ? v.trim() : '');
const twelve = a => (Array.isArray(a) && a.length === 12 ? a.map(num) : Array(12).fill(null));

// Sunshine hours: the file's "preferred" block names the source. HadUK-Grid (Met Office station observations,
// gridded, 1991-2020 monthly averages; Open Government Licence v3.0) is used when it is preferred and complete;
// otherwise PVGIS's typical-year count (hours with beam >= 120 W/m2). Irradiance is always PVGIS.
// -> { credit, licence, source, short, sunshineSource: 'haduk' | 'pvgis', sunshine: [12] h, pvgisSunshine: [12] h,
//      direct: [12] kWh/m2 (horizontal beam), global: [12] kWh/m2, haduk: { credit, licence, doi } | null }
export function readClimate(j) {
  if (!j || typeof j !== 'object') throw Error('sun-climate.json is not an object');
  if (j.format !== 'sun-climate/1') throw Error(`sun-climate.json format ${j.format} is not sun-climate/1`);
  const credit = text(j.attribution), licence = text(j.licence?.name) || text(j.licence);
  if (!credit || !licence) throw Error('sun-climate.json must carry its attribution and licence');
  const s = j.source || {}, m = j.monthly || {};
  const source = [s.radiation_db, s.meteo_db].filter(Boolean).join(' + ') + (Array.isArray(s.years) ? ` ${s.years.join('-')}` : '');
  const pvgisSunshine = twelve(m.sunshine_hours);
  const out = { credit, licence, source, short: SHORT_CREDIT, sunshineSource: 'pvgis', sunshine: pvgisSunshine, pvgisSunshine,
    direct: twelve(m.bhi_kwh_m2), global: twelve(m.ghi_kwh_m2), haduk: null };
  const hk = j.haduk_grid, hkHours = twelve(hk?.monthly_sunshine_hours);
  const hkCredit = text(hk?.attribution), hkLicence = text(hk?.licence?.name) || text(hk?.licence);
  if (j.preferred?.sunshine_hours === 'haduk_grid' && hkHours.every(v => v !== null) && hkCredit && hkLicence) {
    out.sunshine = hkHours; out.sunshineSource = 'haduk';
    out.haduk = { credit: hkCredit, licence: hkLicence, doi: text(hk.source?.doi) || HADUK_DOI };
    out.short = `${HADUK_SHORT} · ${SHORT_CREDIT}`;
  }
  if (!out.sunshine.some(v => v !== null)) throw Error('sun-climate.json has no monthly sunshine');
  return out;
}

// -> { size, cell, nodata, base: { quantity: [12] }, credit, tiles: [{ key, path, e0, n0, sha256 }] }
export function readCellIndex(j, indexPath = '') {
  if (!j || j.format !== 'gsc1' || !Array.isArray(j.tiles)) throw Error('sun-cell index is not gsc1 with a tiles list');
  const size = num(j.tile_m), cell = num(j.cell_m);
  if (!(size > 0 && cell > 0)) throw Error('sun-cell index needs tile_m and cell_m');
  const base = {};
  for (const q of QUANTITIES) {
    base[q] = twelve(j.base?.[q]);
    if (base[q].some(v => v === null)) throw Error(`sun-cell index has no open-sky base for ${q}`);
  }
  const dir = indexPath.includes('/') ? indexPath.slice(0, indexPath.lastIndexOf('/') + 1) : '';
  const credit = Array.isArray(j.attribution) ? text(j.attribution[0]) : text(j.attribution);
  return { size, cell, nodata: num(j.nodata) ?? 255, base, credit,
    tiles: j.tiles.filter(t => t && t.file && /^[0-9a-f]{64}$/i.test(t.sha256 || '') && Number.isFinite(t.e0) && Number.isFinite(t.n0))
      .map(t => ({ key: String(t.key ?? `${t.e0}_${t.n0}`), path: dir + t.file, e0: t.e0, n0: t.n0, sha256: t.sha256 })) };
}

// Distance in metres from (e, n) to an index tile's square (0 inside).
export const tileDistance = (index, t, e, n) =>
  Math.hypot(Math.max(t.e0 - e, 0, e - t.e0 - index.size), Math.max(t.n0 - n, 0, n - t.n0 - index.size));

// The index tile holding national-grid point (e, n), or null.
export const tileFor = (index, e, n) =>
  index.tiles.find(t => e >= t.e0 && n >= t.n0 && e < t.e0 + index.size && n < t.n0 + index.size) || null;

// Parses a .gsc tile (ArrayBuffer or Uint8Array) -> { e0, n0, samples, spacing, months, quantities, scale, values }.
export function readCellTile(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length < 32) throw Error('sun-cell tile is too short');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'GSC1' || v.getUint16(4, true) !== 1) throw Error('sun-cell tile is not GSC1 v1');
  const samples = v.getUint16(6, true), spacing = v.getUint16(8, true) / 1000, months = v.getUint16(10, true);
  const quantities = v.getUint16(20, true), scale = v.getUint16(22, true);
  if (months !== 12 || quantities !== QUANTITIES.length || !(samples > 1 && spacing > 0 && scale > 0)) throw Error('sun-cell tile header is not as expected');
  if (bytes.length !== 32 + samples * samples * months * quantities) throw Error('sun-cell tile has the wrong size');
  return { e0: v.getInt32(12, true), n0: v.getInt32(16, true), samples, spacing, months, quantities, scale, values: bytes.subarray(32) };
}

// One quantity for month 1-12 at national-grid point (e, n), nearest 4 m sample, in the base's units (h or kWh/m2);
// null outside the tile or where the horizon is unknown.
export function cellValue(tile, index, e, n, month, quantity) {
  const q = QUANTITIES.indexOf(quantity);
  const i = Math.round((e - tile.e0) / tile.spacing), j = Math.round((n - tile.n0) / tile.spacing);
  if (q < 0 || i < 0 || j < 0 || i >= tile.samples || j >= tile.samples || !(month >= 1 && month <= 12)) return null;
  const raw = tile.values[((j * tile.samples + i) * tile.months + (month - 1)) * tile.quantities + q];
  if (raw === index.nodata) return null;
  return (raw / tile.scale) * index.base[quantity][month - 1];
}

const fix = v => (v >= 10 ? String(Math.round(v)) : v.toFixed(1));

// The readout lines for a month: [] without data. here = { sunshine, direct, open? } on this spot (horizon-shaded;
// open = the open-sky direct base the cells were computed against) or null.
export function climateLines(climate, month, here = null) {
  if (!climate) return [];
  const k = month - 1, name = MONTHS[k], out = [];
  const hrs = climate.sunshine[k], dir = climate.direct[k], glob = climate.global[k];
  const station = climate.sunshineSource === 'haduk' ? ' (Met Office 1991-2020)' : '';
  if (hrs !== null) out.push(`Typical ${name}: ${Math.round(hrs)} h of sunshine${station}` + (glob !== null ? `, ${fix(glob)} kWh/m² on open ground` : ''));
  if (here && here.direct !== null) {
    // The cells give sunshine as PVGIS hours times the share the horizon leaves; with station sunshine preferred,
    // the same share is applied to the station figure for the month.
    const pv = climate.pvgisSunshine?.[k], sun = here.sunshine === null || here.sunshine === undefined ? null
      : climate.sunshineSource === 'haduk' && pv > 0 && hrs !== null ? here.sunshine * (hrs / pv) : here.sunshine;
    out.push(`This spot in ${name}, horizon-shaded: ` + (sun !== null ? `${Math.round(sun)} h of sunshine, ` : '')
      + `${fix(here.direct)} kWh/m² direct` + ((here.open ?? dir) !== null ? ` (open ground ${fix(here.open ?? dir)})` : ''));
  }
  return out;
}
