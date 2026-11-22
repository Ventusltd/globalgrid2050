/* Offline checks of the production sample and its defensive browser model. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('node:vm').runInThisContext(fs.readFileSync(path.join(__dirname, '../scripts/plugins/global-datacentres-v925.js'), 'utf8'));
const api = globalThis.GlobalDatacentres;
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'projects.json'), 'utf8'));
assert.equal(api.validate(data), data);
assert.equal(data.record_count, 12);
assert.equal(data.country_count, 10);
assert.equal(api.filter(data.records, 'utah', '').length, 1);
assert.equal(api.filter(data.records, '', 'Q30').length, 3);
assert.equal(api.filter(data.records, 'utah', 'Q17').length, 0);
assert.equal(api.filter(data.records, 'DC-WD-Q11236058', '')[0].name, 'NTT Telepark Dojima');
assert.equal(api.filter(data.records, 'there is no such record', '').length, 0);
const utah = data.records.find(p => p.id === 'DC-WD-Q12857142');
assert.ok(api.mapUrl(utah).startsWith('https://www.openstreetmap.org/?mlat=40.43153&mlon=-111.933092'));
const yotta = data.records.find(p => p.id === 'DC-WD-Q142068471');
assert.equal(api.mapUrl(yotta), null);
assert.deepEqual(api.capacityLabels(yotta), ['IT load: not reported', 'Site demand: not reported', 'Grid connection: not reported']);
const coarse = data.records.find(p => p.id === 'DC-WD-Q520438');
assert.ok(api.mapUrl(coarse).includes('#map=8/'));
[
  d => { d.records[0].id = '1018'; },
  d => { d.records[0].location = {latitude: 200, longitude: 0, precision_degrees: 1}; },
  d => { d.records[0].source.revision_url = 'javascript:alert(1)'; },
  d => { d.records[0].source.licence = 'UNKNOWN'; },
  d => { d.records[0].verification_status = 'VERIFIED'; },
  d => { d.records[0].capacity.it_load_mw = 100; },
  d => { d.country_count = 11; },
  d => { d.records[1].id = d.records[0].id; },
].forEach(mutate => { const bad = structuredClone(data); mutate(bad); assert.throws(() => api.validate(bad)); });
const separated = structuredClone(data);
separated.records[0].capacity.it_load_mw = 10;
separated.records[0].capacity.site_demand_mw = 15;
separated.records[0].capacity.grid_connection_mw = 20;
Object.keys(separated.records[0].capacity_sources).forEach(k => { separated.records[0].capacity_sources[k] = 'https://fixtures.example/capacity-test'; });
api.validate(separated);
assert.deepEqual(api.capacityLabels(separated.records[0]), ['IT load: 10 MW', 'Site demand: 15 MW', 'Grid connection: 20 MW']);
console.log('Global data-centre model: PASS (production source records plus synthetic negative cases)');
