/* Run from repository root: node --test automation/news/datacentre-ui/tests/*.test.cjs */
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('../model.js');
const ROOT = path.resolve(__dirname, '../../../..');
const current = path.join(ROOT, 'uk_renewables_pipeline/202611161757/global-datacentres');
const older = path.join(ROOT, 'uk_renewables_pipeline/202611161747/global-datacentres');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const source = {
  projects: read(path.join(current,'projects.json')),
  official: read(path.join(current,'official-projects.json')),
  groups: read(path.join(current,'project-groups.json')),
  audit: read(path.join(current,'selection-audit.json')),
  baseline: read(path.join(older,'projects.json'))
};
const clone = () => JSON.parse(JSON.stringify(source));
function reject(name, update) {
  test('REJECT: ' + name, () => {
    const b = clone();
    update(b);
    assert.throws(() => m.validateBundle(b), /rejected/);
  });
}
test('validated actual source-pinned cohort and sidecars', () => assert.equal(m.validateBundle(source), source));
test('real counts are separate evidence grains, not 103 facilities', () => {
  assert.deepEqual(m.summary(source),{
    leads:100,uk_leads:54,countries:22,quarantined:38,baseline:12,
    official_source_records:3,groups_provisional:3,groups_unlinked:3,verified_facilities:0
  });
});
test('UK-first sorting and 54 default UK records', () => {
  const uk = m.selectRows(source.projects.records,{scope:'uk'});
  assert.equal(uk.length,54);
  assert.ok(uk.every(m.isUK));
  const all = m.selectRows(source.projects.records,{scope:'global'});
  assert.ok(all.slice(0,54).every(m.isUK));
  assert.ok(all.slice(54).every(x=>!m.isUK(x)));
});
test('original twelve identities preserved in the successor cohort', () => {
  const ids = new Set(source.projects.records.map(x => x.id));
  source.baseline.records.forEach(x => assert.ok(ids.has(x.id)));
});
test('no presumed MW, grid connection, or current operation', () => {
  for (const x of source.projects.records) {
    assert.equal(x.operating_status,'not_assessed');
    assert.equal(x.capacity.it_load_mw,null);
    assert.equal(x.capacity.site_demand_mw,null);
    assert.equal(x.capacity.grid_connection_mw,null);
  }
});
test('unknown geometries stay unmappable', () => {
  assert.equal(source.projects.records.filter(x=>x.location===null).length,61);
  assert.equal(m.mapUrl(source.projects.records.find(x=>x.location===null)),null);
});
test('source filtering and no implicit REPD binding', () => {
  assert.equal(m.selectRows(source.projects.records,{scope:'uk',query:'no such source'}).length,0);
  assert.ok(m.selectRows(source.projects.records,{scope:'uk',query:'CyrusOne'}).length>0);
  assert.equal(Object.keys(source.projects.records[0]).includes('repd_id'),false);
});
test('CSV quotes formula-like values; keeps null MW empty', () => {
  const x = structuredClone(source.projects.records[0]);
  x.name = '=HYPERLINK("https://evil.example")';
  const csv = m.csv([x]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"IT load MW"'));
  assert.ok(csv.includes('""'));
});
test('HTTPS-only original evidence links', () => {
  assert.equal(m.safeUrl('javascript:alert(1)'),null);
  assert.equal(m.safeUrl('http://example.org'),null);
  assert.ok(m.safeUrl(source.projects.records[0].source.revision_url));
});
reject('duplicate source ID', x => x.projects.records[1].id=x.projects.records[0].id);
reject('invented VERIFIED status', x => x.projects.records[0].verification_status='VERIFIED');
reject('invented operational status', x => x.projects.records[0].operating_status='operational');
reject('unsourced MW', x => x.projects.records[0].capacity.it_load_mw=100);
reject('negative MW', x => x.projects.records[0].capacity.it_load_mw=-10);
reject('invented country count', x => x.projects.country_count=999);
reject('unsafe source URL', x => x.projects.records[0].source.revision_url='javascript:alert(1)');
reject('invalid geometry', x => x.projects.records[0].location={latitude:91,longitude:0,precision_degrees:1});
reject('quarantine without reason', x => x.audit.quarantined[0].reason='');
reject('quarantine overlapping selected', x => x.audit.quarantined[0].id=x.projects.records[0].id);
reject('quarantine arithmetic mismatch', x => x.audit.quarantined_count=1);
reject('official record duplicated', x => x.official.projects.push(x.official.projects[0]));
reject('document converted to operating facility', x => x.official.projects[0].current_lifecycle='OPERATIONAL');
reject('provisional legal group mislabelled verified', x => x.groups.records[0].legal_ownership_verified=true);
reject('group link promoted to VERIFIED', x => x.groups.records[0].status='VERIFIED');
reject('group split changed', x => x.groups.provisional_count++);
reject('baseline source identity lost', x => x.baseline.records[0].id='DC-WD-Q999999999');
reject('source rights removed', x => x.projects.records[0].source.licence='UNKNOWN');
reject('timestamp fabricated', x => x.projects.records[0].source.retrieved_at='unknown');
reject('official source mutated to bad URL', x => x.official.projects[0].source_document.url='https://user:pass@example.org/');
