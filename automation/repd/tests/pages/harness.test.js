// node --test harness.test.js   (synthetic fixtures only; real pages are exercised if REPD_PAGES_ROOT is set)
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./harness.js');

const FIX = path.join(__dirname, 'fixtures');
const csvBytes = fs.readFileSync(path.join(FIX, 'mini.csv'));
const pageText = fs.readFileSync(path.join(FIX, 'mini_page.md'), 'utf8');
const ALL = { file: 'mini_page.md', engine: 'leaflet', pre: () => true };

test('extracts the single inline Papa script and strips the Liquid baseurl', () => {
  const s = H.extractPapaScript(pageText);
  assert.ok(s.includes("Papa.parse('/repd.csv'"));
  assert.ok(!s.includes('site.baseurl'));
});

test('runs page code: markers and table rows captured, drops classified', () => {
  const r = H.analyseCsvPage(ALL, H.extractPapaScript(pageText), csvBytes);
  assert.strictEqual(r.parsed_rows, 7);
  assert.strictEqual(r.rendered_markers, 4);          // rows 1,2,6,7
  assert.strictEqual(r.table_rows, 4);
  assert.ok(r.classifier_agrees);
  assert.deepStrictEqual(r.classifier.dropped, { blank_coordinate: 1, non_numeric_coordinate: 1, zero_coordinate: 1, projection_failed: 0 });
  assert.strictEqual(r.classifier.rendered_blank_capacity_as_0, 1);
  assert.strictEqual(r.classifier.rendered_outside_uk_bbox.length, 1);   // ref 6, lon 2.55
  assert.deepStrictEqual(r.missing_page_columns, []);
});

test('cp1252 bytes decoded as UTF-8 show U+FFFD; BOM is invisible to the page', () => {
  const script = H.extractPapaScript(pageText);
  const cp = H.encodeCp1252(new TextDecoder().decode(csvBytes));
  const r = H.analyseCsvPage(ALL, script, cp.bytes);
  assert.strictEqual(r.rendered_markers, 4);
  assert.strictEqual(r.classifier.rendered_with_U_FFFD, 1);   // Bishop's Wind (U+2019 -> 0x92 -> U+FFFD)
  const bom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), csvBytes]);
  for (const keepBOM of [false, true]) {
    const b = H.analyseCsvPage(ALL, script, bom, { keepBOM });
    assert.strictEqual(b.first_header_key, JSON.stringify('Old Ref ID'));
    assert.strictEqual(b.rendered_markers, 4);
  }
});

test('renamed column is reported missing and yields zero markers', () => {
  const renamed = Buffer.from(new TextDecoder().decode(csvBytes).replace('X-coordinate', 'X Coordinate'));
  const r = H.analyseCsvPage(ALL, H.extractPapaScript(pageText), renamed);
  assert.deepStrictEqual(r.missing_page_columns, ['X-coordinate']);
  assert.strictEqual(r.rendered_markers, 0);
});

test('MapLibre filter evaluator and atlas layer extraction', () => {
  const p = { tech: 'solar', status: 'operational', raw_tech: 'Wind Onshore', capacity: null };
  assert.ok(H.evalExpr(['all', ['==', ['get', 'tech'], 'solar'], ['==', ['get', 'status'], 'operational']], p));
  assert.ok(!H.evalExpr(['==', ['get', 'tech'], 'bess'], p));
  assert.strictEqual(H.evalExpr(['coalesce', ['get', 'capacity'], 0], p), 0);
  const html = '{ id: "solar", label: "S", url: "/dist/repd_master.json", filter: [\'==\', [\'get\', \'tech\'], \'solar\'], preload: false },\n' +
    '{ id: "bess", url: "/dist/repd_master.json", filter: [\'==\', [\'get\', \'tech\'], \'bess\'] }';
  const layers = H.extractAtlasLayers(html);
  assert.deepStrictEqual(layers.map(l => l.id), ['solar', 'bess']);
  const gj = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { name: 'a', capacity: 5, status: 'operational', tech: 'solar', raw_tech: 'Solar Photovoltaics', operator: 'X', mounting: 'ground' }, geometry: { type: 'Point', coordinates: [-1, 52] } },
    { type: 'Feature', properties: { name: 'b', capacity: 0, status: 'revised', tech: 'other' }, geometry: { type: 'Point', coordinates: [5, 52] } }] };
  const r = H.analyseAtlas('x', html, Buffer.from(JSON.stringify(gj)));
  assert.deepStrictEqual(r.layers, { solar: 1, bess: 0 });
  assert.deepStrictEqual(r.undrawn_tech, { other: 1 });
  assert.strictEqual(r.outside_uk_bbox, 1);
  assert.strictEqual(r.capacity_zero, 1);
  assert.deepStrictEqual(r.unknown_status, { revised: 1 });
});

test('stale text scanner finds dates and counts', () => {
  const hits = H.staleText('Data as of January 2026<br>1,234 projects\nnothing here');
  assert.deepStrictEqual(hits.map(h => h.text), ['Data as of January 2026', '1,234 projects']);
});

const ROOT = process.env.REPD_PAGES_ROOT;
test('every real CSV page extracts and runs on the synthetic CSV', { skip: !ROOT && 'REPD_PAGES_ROOT not set' }, () => {
  for (const page of H.CSV_PAGES) {
    const s = H.extractPapaScript(fs.readFileSync(path.join(ROOT, page.file), 'utf8'));
    const r = H.analyseCsvPage(page, s, csvBytes);
    assert.ok(r.classifier_agrees, page.file);
    assert.strictEqual(r.parsed_rows, 7, page.file);
  }
});
