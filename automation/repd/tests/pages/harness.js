#!/usr/bin/env node
/*
 * REPD page harness: runs the real data-loading / row-processing JavaScript of the site pages
 * that read the root REPD datasets, in Node, without a browser.
 *
 *   node harness.js --pages <repo checkout> --set jan=<dir> --set oct=<dir> [--json out.json] [--md out.md]
 *
 * Each --set dir must hold repd.csv, repd-grid-batteries.csv, repd-solar-operational.csv,
 * repd-solar-operational-over-4mw.csv and dist/repd_master.json (missing files are reported).
 *
 * CSV pages (Leaflet / MapLibre + PapaParse): the page's inline <script> that calls Papa.parse is
 * extracted from the .md, '{{ site.baseurl }}' is replaced by '', and the script is executed in a vm
 * context with the real papaparse 5.4.1 and proj4 2.11.0 and stubbed L / $ / maplibregl / document.
 * Papa.parse(url, {download:true}) is served from the set's bytes decoded the way a browser XHR does
 * for a text/csv response (UTF-8, BOM stripped, invalid bytes -> U+FFFD). Captured: every circle
 * marker (lat/lng + popup), every DataTable row, every GeoJSON feature passed to setData.
 *
 * Atlas pages (repd_grid_atlasv3..v8): REPD layer definitions are extracted from index.html (every
 * object literal whose url is /dist/repd_master.json) and their MapLibre filter expressions are
 * evaluated against dist/repd_master.json parsed as UTF-8 JSON (what fetch().json() does).
 *
 * An independent classifier re-derives each CSV page's drop reasons; the harness asserts that its
 * "would render" count equals the number of markers the page code actually produced.
 *
 * Read-only: sha256 of every page and dataset file is taken before and after; any change fails the run.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const Papa = require('papaparse');
const proj4 = require('proj4');

const UK_BBOX = { lonMin: -9.0, lonMax: 2.5, latMin: 49.0, latMax: 61.0 };
const BAD_CHAR = '�';

// ---------------------------------------------------------------- page registry
const DEAD_OR_DONE = ['refused', 'abandoned', 'withdrawn', 'operational', 'decommissioned'];
const CSV_PAGES = [
  { file: 'repd-atlas.md', dataset: 'repd.csv', engine: 'leaflet', pre: () => true,
    statusCol: 'Development Status' },
  { file: 'uk_grid-batteries.md', dataset: 'repd-grid-batteries.csv', engine: 'leaflet', pre: () => true },
  { file: 'uk_operating_large_solar_farms.md', dataset: 'repd-solar-operational-over-4mw.csv', engine: 'leaflet', pre: () => true },
  { file: 'repd-uk-operational-solar.md', dataset: 'repd-solar-operational.csv', engine: 'leaflet', pre: () => true },
  { file: 'uk_offshore_wind_atlas.md', dataset: 'repd.csv', engine: 'leaflet', pre: r => r['Technology Type'] === 'Wind Offshore' },
  { file: 'uk_onshore_wind_atlas.md', dataset: 'repd.csv', engine: 'leaflet', pre: r => r['Technology Type'] === 'Wind Onshore' },
  { file: 'uk_solar_in-planning-1-50mw.md', dataset: 'repd.csv', engine: 'leaflet',
    pre: r => {
      const cap = parseFloat(r['Installed Capacity (MWelec)']) || 0;
      const st = (r['Development Status'] || 'Unknown').toLowerCase();
      return (r['Technology Type'] || '').toLowerCase().includes('solar') &&
        !DEAD_OR_DONE.some(w => st.includes(w)) && cap >= 1 && cap <= 50;
    } },
  { file: 'repd_atlas_grid_model.md', dataset: 'repd.csv', engine: 'maplibre', pre: () => true },
];
const ATLAS_PAGES = ['repd_grid_atlasv3/index.html', 'repd_grid_atlasv4/index.html', 'repd_grid_atlasv5/index.html',
  'repd_grid_atlasv6/index.html', 'repd_grid_atlasv7/index.html', 'repd_grid_atlasv8/index.html'];
const ATLAS_PROPS = ['name', 'capacity', 'status', 'tech', 'raw_tech', 'operator', 'mounting'];
const STATUS_COLOURS = ['operational', 'under construction', 'awaiting construction', 'consented',
  'planning permission granted', 'planning approved', 'application submitted', 'pre-construction'];
const DATASETS = ['repd.csv', 'repd-grid-batteries.csv', 'repd-solar-operational.csv',
  'repd-solar-operational-over-4mw.csv', 'dist/repd_master.json'];

// ---------------------------------------------------------------- encoding helpers
const CP1252_HIGH = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A,
  0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
function encodeCp1252(text) {
  const out = [];
  let unencodable = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (c < 0x80 || (c >= 0xA0 && c <= 0xFF)) out.push(c);
    else if (CP1252_HIGH[c] !== undefined) out.push(CP1252_HIGH[c]);
    else { out.push(0x3F); unencodable++; }
  }
  return { bytes: Buffer.from(out), unencodable };
}
/** What a browser XHR/fetch gives responseText for text/csv (charset utf-8 or absent): UTF-8, BOM stripped. */
function browserDecode(bytes, opts = {}) {
  return new TextDecoder('utf-8', { fatal: false, ignoreBOM: !!opts.keepBOM }).decode(bytes);
}
function describeBytes(bytes) {
  let utf8 = true;
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { utf8 = false; }
  return { size: bytes.length, bom: bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF, valid_utf8: utf8,
    crlf: bytes.includes(Buffer.from('\r\n')) };
}
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------- extraction
function inlineScripts(html) {
  const out = [];
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) if (!/\bsrc\s*=/.test(m[1] || '')) out.push(m[2]);
  return out;
}
function extractPapaScript(pageText) {
  const s = inlineScripts(pageText).filter(x => x.includes('Papa.parse'));
  if (s.length !== 1) throw new Error(`expected 1 inline script with Papa.parse, found ${s.length}`);
  return s[0].replace(/\{\{\s*site\.baseurl\s*\}\}/g, '');
}
function extractAtlasLayers(html) {
  const layers = new Map();
  for (const line of html.split('\n')) {
    if (!line.includes('/dist/repd_master.json')) continue;
    const m = line.match(/\{\s*id:[\s\S]*\}/);
    if (!m) continue;
    const obj = vm.runInNewContext('(' + m[0] + ')');
    if (!layers.has(obj.id)) layers.set(obj.id, obj);
  }
  return [...layers.values()];
}

// ---------------------------------------------------------------- stubs for CSV pages
function makeSandbox(datasetText) {
  const cap = { markers: [], table: null, tableCreated: false, geojson: null, papa: null, handlers: {}, fetches: [],
    consoleErrors: [] };
  const chain = (extra = {}) => { const o = Object.assign({}, extra); o.addTo = () => o; return o; };
  const mapObj = { setView() { return mapObj; }, addLayer() { return mapObj; }, on(ev, fn) { cap.handlers['map:' + ev] = fn; return mapObj; },
    getZoom: () => 6 };
  const cluster = () => ({ addLayer(m) { cap.markers.push(m); }, clearLayers() { cap.markers = []; } });
  const L = {
    map: () => mapObj, tileLayer: () => chain(), markerClusterGroup: cluster, layerGroup: () => chain(),
    control: { layers: () => chain() }, geoJSON: () => chain(),
    circleMarker: (latlng, options) => {
      const m = { latlng, options, popup: null };
      m.bindPopup = h => { m.popup = h; return m; };
      m.setRadius = r => { m.radius = r; };
      return m;
    },
  };
  const tableApi = { clear() { cap.table = []; return tableApi; }, rows: { add(d) { cap.table = d.slice(); return tableApi; } },
    draw() { return tableApi; } };
  const $ = sel => ({
    on(ev, fn) { cap.handlers[sel + ':' + ev] = fn; return this; }, val() { return 0; }, text() { return this; },
    DataTable(cfg) { cap.tableCreated = true; cap.table = (cfg.data || []).slice(); return tableApi; },
  });
  $.fn = { DataTable: { isDataTable: () => cap.tableCreated } };
  const sources = {};
  const maplibregl = { Map: function () {
    this.on = (ev, fn) => { cap.handlers['map:' + ev] = fn; };
    this.addSource = (id, def) => { sources[id] = { def, setData(d) { cap.geojson = d; } }; };
    this.addLayer = () => {}; this.getSource = id => sources[id];
  } };
  const el = () => ({ innerHTML: '', innerText: '' });
  const papaStub = {
    parse(url, cfg) {
      if (!cfg || !cfg.download) return Papa.parse(url, cfg);
      cap.papa = { url, config: Object.assign({}, cfg, { complete: undefined }) };
      const res = Papa.parse(datasetText, Object.assign({}, cfg, { download: false, complete: undefined }));
      cap.papa.results = res;
      cfg.complete(res);
    },
  };
  const ctx = {
    L, $, jQuery: $, Papa: papaStub, proj4, maplibregl, console: { log() {}, warn() {}, error: (...a) => cap.consoleErrors.push(a.join(' ')) },
    document: { getElementById: el, querySelector: () => null }, setInterval: () => 0, setTimeout: () => 0,
    fetch: url => { cap.fetches.push(url); return Promise.resolve({ ok: false, json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }) }); },
    Date, Math, JSON, parseFloat, parseInt, Number, String, Array, Object, isNaN, isFinite,
  };
  ctx.window = ctx;
  return { ctx: vm.createContext(ctx), cap };
}

function runCsvPage(page, script, datasetText) {
  const { ctx, cap } = makeSandbox(datasetText);
  vm.runInContext(script, ctx, { filename: page.file, timeout: 120000 });
  if (cap.handlers['map:load']) cap.handlers['map:load']();      // MapLibre pages parse inside map.on('load')
  return cap;
}

// ---------------------------------------------------------------- independent classifier (CSV pages)
function classify(page, rows, fields) {
  const r = { input_rows: rows.length, after_page_filter: 0, would_render: 0,
    dropped: { blank_coordinate: 0, non_numeric_coordinate: 0, zero_coordinate: 0, projection_failed: 0 },
    rendered_outside_uk_bbox: [], rendered_blank_capacity_as_0: 0, rendered_non_numeric_capacity_as_0: 0,
    rendered_capacity_with_comma: 0, rendered_status_unknown: 0, rendered_with_U_FFFD: 0, U_FFFD_examples: [],
    dropped_examples: [] };
  for (const row of rows) {
    if (!page.pre(row)) continue;
    r.after_page_filter++;
    const xs = row['X-coordinate'], ys = row['Y-coordinate'];
    const x = parseFloat(xs), y = parseFloat(ys);
    let reason = null;
    if (!(x && y)) {
      if ((xs || '').trim() === '' || (ys || '').trim() === '') reason = 'blank_coordinate';
      else if (Number.isNaN(x) || Number.isNaN(y)) reason = 'non_numeric_coordinate';
      else reason = 'zero_coordinate';
    }
    let lonlat = null;
    if (!reason) {
      try { lonlat = proj4('EPSG:27700', 'WGS84', [x, y]); if (!lonlat.every(Number.isFinite)) reason = 'projection_failed'; }
      catch (e) { reason = 'projection_failed'; }
    }
    if (reason) {
      r.dropped[reason]++;
      if (r.dropped_examples.length < 8) r.dropped_examples.push({ ref: row['Ref ID'], name: row['Site Name'], reason, x: xs, y: ys });
      continue;
    }
    r.would_render++;
    const [lon, lat] = lonlat;
    if (!(lon > UK_BBOX.lonMin && lon < UK_BBOX.lonMax && lat > UK_BBOX.latMin && lat < UK_BBOX.latMax))
      r.rendered_outside_uk_bbox.push({ ref: row['Ref ID'], name: row['Site Name'], x: xs, y: ys, lon: +lon.toFixed(4), lat: +lat.toFixed(4) });
    const capRaw = (row['Installed Capacity (MWelec)'] || '').trim();
    if (capRaw === '') r.rendered_blank_capacity_as_0++;
    else if (Number.isNaN(parseFloat(capRaw))) r.rendered_non_numeric_capacity_as_0++;
    else if (capRaw.includes(',')) r.rendered_capacity_with_comma++;
    if (!row['Development Status']) r.rendered_status_unknown++;
    const shown = ['Site Name', 'Technology Type', 'County', 'Development Status', 'Operator (or Applicant)'].map(k => row[k] || '').join(' | ');
    if (shown.includes(BAD_CHAR)) {
      r.rendered_with_U_FFFD++;
      if (r.U_FFFD_examples.length < 5) r.U_FFFD_examples.push({ ref: row['Ref ID'], shown });
    }
  }
  return r;
}

const PAGE_COLUMNS = ['Site Name', 'Technology Type', 'Installed Capacity (MWelec)', 'Development Status', 'County',
  'X-coordinate', 'Y-coordinate'];

function analyseCsvPage(page, script, bytes, opts = {}) {
  const text = browserDecode(bytes, opts);
  const cap = runCsvPage(page, script, text);
  const res = cap.papa.results;
  const fields = res.meta.fields || [];
  const errs = {};
  for (const e of res.errors) errs[e.code] = (errs[e.code] || 0) + 1;
  const cls = classify(page, res.data, fields);
  const rendered = page.engine === 'maplibre' ? (cap.geojson ? cap.geojson.features.length : 0) : cap.markers.length;
  const out = {
    dataset_bytes: describeBytes(bytes), decoded_has_U_FFFD: (text.match(/�/g) || []).length,
    first_header_key: JSON.stringify(fields[0]), parsed_rows: res.data.length, papa_errors: errs,
    papa_error_examples: res.errors.slice(0, 5).map(e => ({ code: e.code, row: e.row, message: e.message })),
    missing_page_columns: PAGE_COLUMNS.filter(c => !fields.includes(c)),
    rendered_markers: rendered, table_rows: cap.table ? cap.table.length : (page.engine === 'maplibre' ? 'not populated by page' : 0),
    classifier: cls, classifier_agrees: cls.would_render === rendered,
    status_values_rendered: {},
    console_errors: cap.consoleErrors.slice(0, 5),
  };
  // Status split as the page colours it (Operational -> cyan, else orange); uses long 'Development Status'.
  for (const row of res.data) if (page.pre(row)) {
    const s = row['Development Status'] || 'Unknown';
    out.status_values_rendered[s] = (out.status_values_rendered[s] || 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------- atlas pages
function evalExpr(e, p) {
  if (!Array.isArray(e)) return e;
  const [op, ...a] = e;
  switch (op) {
    case 'get': return p[a[0]] === undefined ? null : p[a[0]];
    case 'has': return Object.prototype.hasOwnProperty.call(p, a[0]);
    case '==': return evalExpr(a[0], p) === evalExpr(a[1], p);
    case '!=': return evalExpr(a[0], p) !== evalExpr(a[1], p);
    case '!': return !evalExpr(a[0], p);
    case 'all': return a.every(x => evalExpr(x, p));
    case 'any': return a.some(x => evalExpr(x, p));
    case 'in': { const n = evalExpr(a[0], p), h = evalExpr(a[1], p); return h == null ? false : String(h).includes(n); }
    case 'coalesce': for (const x of a) { const v = evalExpr(x, p); if (v != null) return v; } return null;
    default: throw new Error('unsupported filter op ' + op);
  }
}
function analyseAtlas(file, html, bytes) {
  const layers = extractAtlasLayers(html);
  if (!bytes) return { layers: layers.map(l => l.id), error: 'dist/repd_master.json missing' };
  const gj = JSON.parse(new TextDecoder('utf-8').decode(bytes));   // fetch().json(): UTF-8, BOM stripped
  const feats = Array.isArray(gj.features) ? gj.features : [];
  const per = {};
  for (const l of layers) per[l.id] = l.filter ? feats.filter(f => evalExpr(l.filter, f.properties || {})).length : feats.length;
  const drawnTech = new Set(layers.filter(l => l.filter).flatMap(l => JSON.stringify(l.filter).match(/"tech"\],"([a-z_]+)"/g) || [])
    .map(s => s.match(/"([a-z_]+)"$/)[1]));
  const res = { features: feats.length, layers: per, undrawn_tech: {}, bad_geometry: 0, outside_uk_bbox: 0,
    missing_props: {}, unknown_status: {}, capacity_zero: 0, name_U_FFFD: 0, top_level_keys: Object.keys(gj) };
  for (const f of feats) {
    const p = f.properties || {};
    if (!drawnTech.has(p.tech)) res.undrawn_tech[p.tech] = (res.undrawn_tech[p.tech] || 0) + 1;
    const c = f.geometry && f.geometry.coordinates;
    if (!f.geometry || f.geometry.type !== 'Point' || !Array.isArray(c) || !c.every(Number.isFinite)) res.bad_geometry++;
    else if (!(c[0] > UK_BBOX.lonMin && c[0] < UK_BBOX.lonMax && c[1] > UK_BBOX.latMin && c[1] < UK_BBOX.latMax)) res.outside_uk_bbox++;
    for (const k of ATLAS_PROPS) if (!(k in p)) res.missing_props[k] = (res.missing_props[k] || 0) + 1;
    const s = String(p.status ?? '').trim().toLowerCase();
    if (!STATUS_COLOURS.includes(s)) res.unknown_status[s] = (res.unknown_status[s] || 0) + 1;
    if (!(Number(p.capacity) > 0)) res.capacity_zero++;
    if (String(p.name || '').includes(BAD_CHAR) || String(p.operator || '').includes(BAD_CHAR)) res.name_U_FFFD++;
  }
  return res;
}

// ---------------------------------------------------------------- stale text scan
function staleText(text) {
  const hits = [];
  const re = /(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? 20\d\d\b|\bQ[1-4][ _-]?20\d\d\b|\b20\d\d-\d\d(?:-\d\d)?\b|\b\d{1,2}\/\d{1,2}\/20\d\d\b|\b\d{1,3}(?:,\d{3})+ (?:projects|sites|assets|records|features|rows)\b|\b\d{3,} (?:projects|sites|assets|records|features|rows)\b|last (?:updated|sync)[^<"\n]{0,40}|data as (?:of|at)[^<"\n]{0,30})/gi;
  text.split('\n').forEach((line, i) => {
    let m;
    while ((m = re.exec(line))) hits.push({ line: i + 1, text: m[0] });
  });
  return hits;
}

// ---------------------------------------------------------------- main
function hashTree(files) { const h = {}; for (const f of files) if (fs.existsSync(f)) h[f] = sha256(fs.readFileSync(f)); return h; }

function main(argv) {
  const args = { sets: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pages') args.pages = argv[++i];
    else if (a === '--set') { const [k, v] = argv[++i].split('='); args.sets.push({ name: k, dir: v }); }
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--md') args.md = argv[++i];
    else if (a === '--no-encoding-variants') args.noVariants = true;
    else throw new Error('unknown arg ' + a);
  }
  if (!args.pages || !args.sets.length) throw new Error('usage: --pages DIR --set name=DIR [--set ...] [--json F] [--md F]');
  const pageFiles = [...CSV_PAGES.map(p => p.file), ...ATLAS_PAGES].map(f => path.join(args.pages, f));
  const dataFiles = args.sets.flatMap(s => DATASETS.map(d => path.join(s.dir, d)));
  const before = hashTree([...pageFiles, ...dataFiles]);

  const report = { generated_utc: new Date().toISOString(), pages_root: args.pages, sets: {}, csv_pages: {}, atlas_pages: {},
    stale_text: {}, read_only_check: null };
  for (const s of args.sets) {
    report.sets[s.name] = { dir: s.dir, files: {} };
    for (const d of DATASETS) { const f = path.join(s.dir, d);
      report.sets[s.name].files[d] = fs.existsSync(f) ? Object.assign({ sha256: before[f] }, describeBytes(fs.readFileSync(f))) : 'MISSING'; }
  }
  for (const page of CSV_PAGES) {
    const text = fs.readFileSync(path.join(args.pages, page.file), 'utf8');
    report.stale_text[page.file] = staleText(text);
    const script = extractPapaScript(text);
    const entry = { dataset: page.dataset, engine: page.engine, runs: {} };
    for (const s of args.sets) {
      const f = path.join(s.dir, page.dataset);
      if (!fs.existsSync(f)) { entry.runs[s.name] = { error: 'dataset missing' }; continue; }
      const bytes = fs.readFileSync(f);
      entry.runs[s.name] = analyseCsvPage(page, script, bytes);
      if (!args.noVariants) {
        // Same content in the other encodings the pipeline could emit.
        const txt = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        const valid = describeBytes(bytes).valid_utf8;
        if (valid) {
          const cp = encodeCp1252(txt.replace(/^﻿/, ''));
          const v = analyseCsvPage(page, script, cp.bytes);
          entry.runs[s.name + '@cp1252'] = { rendered_markers: v.rendered_markers, table_rows: v.table_rows, parsed_rows: v.parsed_rows,
            rendered_with_U_FFFD: v.classifier.rendered_with_U_FFFD, U_FFFD_examples: v.classifier.U_FFFD_examples, unencodable_chars: cp.unencodable };
          const bom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(txt.replace(/^﻿/, ''), 'utf8')]);
          const b1 = analyseCsvPage(page, script, bom);
          const b2 = analyseCsvPage(page, script, bom, { keepBOM: true });
          entry.runs[s.name + '@utf8bom'] = { rendered_markers: b1.rendered_markers, first_header_key: b1.first_header_key,
            if_bom_not_stripped: { rendered_markers: b2.rendered_markers, first_header_key: b2.first_header_key, missing_page_columns: b2.missing_page_columns } };
        } else {
          // cp1252 source: show what a correct UTF-8 transcode would render instead.
          const fixed = Buffer.from(new TextDecoder('windows-1252').decode(bytes), 'utf8');
          const v = analyseCsvPage(page, script, fixed);
          entry.runs[s.name + '@as_utf8'] = { rendered_markers: v.rendered_markers, table_rows: v.table_rows,
            rendered_with_U_FFFD: v.classifier.rendered_with_U_FFFD };
        }
      }
    }
    report.csv_pages[page.file] = entry;
  }
  for (const file of ATLAS_PAGES) {
    const html = fs.readFileSync(path.join(args.pages, file), 'utf8');
    report.stale_text[file] = staleText(html);
    const entry = { runs: {} };
    for (const s of args.sets) {
      const f = path.join(s.dir, 'dist/repd_master.json');
      entry.runs[s.name] = analyseAtlas(file, html, fs.existsSync(f) ? fs.readFileSync(f) : null);
    }
    report.atlas_pages[file] = entry;
  }
  const after = hashTree([...pageFiles, ...dataFiles]);
  const changed = Object.keys(before).filter(k => before[k] !== after[k]);
  report.read_only_check = { files_hashed: Object.keys(before).length, changed };
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(report, null, 2) + '\n');
  const md = toMarkdown(report, args.sets.map(s => s.name));
  if (args.md) fs.writeFileSync(args.md, md);
  process.stdout.write(md);
  const disagreements = Object.entries(report.csv_pages).flatMap(([f, e]) =>
    Object.entries(e.runs).filter(([, r]) => r.classifier_agrees === false).map(([n]) => `${f}@${n}`));
  if (changed.length) { console.error('READ-ONLY VIOLATION: ' + changed.join(', ')); process.exit(2); }
  if (disagreements.length) { console.error('CLASSIFIER DISAGREES WITH PAGE: ' + disagreements.join(', ')); process.exit(3); }
}

function toMarkdown(rep, names) {
  const L = [];
  L.push('# REPD page harness results', '', `generated ${rep.generated_utc}`, '');
  L.push('## Datasets', '', '| set | file | bytes | BOM | valid UTF-8 | CRLF |', '|---|---|---|---|---|---|');
  for (const n of names) for (const [d, i] of Object.entries(rep.sets[n].files))
    L.push(i === 'MISSING' ? `| ${n} | ${d} | MISSING | | | |` : `| ${n} | ${d} | ${i.size} | ${i.bom} | ${i.valid_utf8} | ${i.crlf} |`);
  L.push('', '## CSV pages', '');
  const hdr = ['page', 'dataset', ...names.flatMap(n => [`${n} parsed`, `${n} markers`, `${n} table`, `${n} dropped (blank/non-num/zero)`, `${n} outside UK`, `${n} blank cap shown 0`, `${n} U+FFFD rows`])];
  L.push('| ' + hdr.join(' | ') + ' |', '|' + hdr.map(() => '---').join('|') + '|');
  for (const [f, e] of Object.entries(rep.csv_pages)) {
    const cells = [f, e.dataset];
    for (const n of names) {
      const r = e.runs[n];
      if (!r || r.error) { cells.push(r ? r.error : '-', '', '', '', '', '', ''); continue; }
      const c = r.classifier, d = c.dropped;
      cells.push(r.parsed_rows, r.rendered_markers, r.table_rows, `${d.blank_coordinate}/${d.non_numeric_coordinate}/${d.zero_coordinate}`,
        c.rendered_outside_uk_bbox.length, c.rendered_blank_capacity_as_0, c.rendered_with_U_FFFD);
    }
    L.push('| ' + cells.join(' | ') + ' |');
  }
  L.push('', '### Encoding variants (same content re-encoded)', '', '| page | variant | markers | U+FFFD rows | note |', '|---|---|---|---|---|');
  for (const [f, e] of Object.entries(rep.csv_pages)) for (const [n, r] of Object.entries(e.runs)) {
    if (!n.includes('@')) continue;
    if (n.endsWith('@cp1252')) L.push(`| ${f} | ${n} | ${r.rendered_markers} | ${r.rendered_with_U_FFFD} | unencodable chars ${r.unencodable_chars} |`);
    else if (n.endsWith('@utf8bom')) L.push(`| ${f} | ${n} | ${r.rendered_markers} | 0 | first key ${r.first_header_key}; if BOM kept: markers ${r.if_bom_not_stripped.rendered_markers}, key ${r.if_bom_not_stripped.first_header_key}, missing cols ${JSON.stringify(r.if_bom_not_stripped.missing_page_columns)} |`);
    else L.push(`| ${f} | ${n} | ${r.rendered_markers} | ${r.rendered_with_U_FFFD} | transcoded to UTF-8 |`);
  }
  L.push('', '### Papa errors / missing columns', '');
  for (const [f, e] of Object.entries(rep.csv_pages)) for (const n of names) {
    const r = e.runs[n]; if (!r || r.error) continue;
    if (Object.keys(r.papa_errors).length || r.missing_page_columns.length || r.classifier.rendered_outside_uk_bbox.length)
      L.push(`- ${f} [${n}]: papa_errors=${JSON.stringify(r.papa_errors)} missing=${JSON.stringify(r.missing_page_columns)} outside_uk=${JSON.stringify(r.classifier.rendered_outside_uk_bbox.slice(0, 4))}`);
  }
  L.push('', '## Atlas pages (dist/repd_master.json)', '');
  for (const [f, e] of Object.entries(rep.atlas_pages)) {
    L.push(`### ${f}`, '', '| layer | ' + names.join(' | ') + ' |', '|---|' + names.map(() => '---').join('|') + '|');
    const ids = [...new Set(names.flatMap(n => Object.keys((e.runs[n] || {}).layers || {})))];
    for (const id of ids) L.push(`| ${id} | ` + names.map(n => { const v = (e.runs[n].layers || {})[id]; return v === undefined ? '-' : v; }).join(' | ') + ' |');
    for (const n of names) { const r = e.runs[n];
      if (r.error) { L.push(`| features (${n}) | ${r.error} | |`); continue; }
      L.push(`| features (${n}) | ${r.features} | bad geom ${r.bad_geometry}, outside UK ${r.outside_uk_bbox}, undrawn ${JSON.stringify(r.undrawn_tech)}, missing props ${JSON.stringify(r.missing_props)}, unknown status ${JSON.stringify(r.unknown_status)}, capacity<=0 ${r.capacity_zero}, U+FFFD ${r.name_U_FFFD} |`); }
    L.push('');
  }
  L.push('## Hard-coded date / count text', '');
  for (const [f, h] of Object.entries(rep.stale_text)) L.push(`- ${f}: ${h.length ? h.map(x => `L${x.line} "${x.text}"`).join('; ') : 'none'}`);
  L.push('', `Read-only check: ${rep.read_only_check.files_hashed} files hashed before/after, changed: ${JSON.stringify(rep.read_only_check.changed)}`, '');
  return L.join('\n');
}

module.exports = { extractPapaScript, extractAtlasLayers, runCsvPage, analyseCsvPage, analyseAtlas, classify, evalExpr,
  encodeCp1252, browserDecode, staleText, CSV_PAGES, ATLAS_PAGES };
if (require.main === module) main(process.argv);
