import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {reportData} from '../report-model.mjs';
import {buildA4Pdf} from '../report-pdf.mjs';

const edition = new URL('../', import.meta.url).pathname.split('/').at(-2);
globalThis.location = {pathname: `/uk_renewables_pipeline/${edition}/`};
const directory = new URL('../data/v9.1/projects/', import.meta.url);
const seen = new Set();
let missingGeometry = 0;
let example;

for (const file of await readdir(directory)) {
  if (!/^part-\d+\.json$/.test(file)) continue;
  const {projects} = JSON.parse(await readFile(new URL(file, directory), 'utf8'));
  for (const project of projects) {
    const ref = project.repd_ref;
    const legal = new URL(reportData(project, '').legalEvidenceUrl);
    assert.equal(legal.origin + legal.pathname, 'https://ventusltd.github.io/legislation/legal-evidence/');
    assert.equal(legal.searchParams.get('repd_ref'), ref);
    assert.equal(legal.searchParams.get('source_release'), edition);
    assert.equal(legal.searchParams.get('project'), project.name.trim() || null);
    assert.ok(!seen.has(ref));
    seen.add(ref);
    if (project.geometry_status === 'missing') {
      missingGeometry++;
      example = project;
    }
  }
}
assert.equal(seen.size, 7775);
assert.equal(missingGeometry, 26);
const noMap = reportData(example, '');
assert.equal(noMap.mapUrl, '');
assert.equal((Buffer.from(buildA4Pdf(noMap)).toString().match(/\/Subtype \/Link/g) || []).length, 1);
for (const invalid of [{...example, technology:'interconnector'}, {...example, gg_project_id:'mismatch'}]) {
  const model = reportData(invalid, '');
  assert.equal(model.legalEvidenceUrl, null);
  assert.ok(!Buffer.from(buildA4Pdf(model)).toString().includes('/Subtype /Link'));
}
console.log(`PASS ${seen.size} project identities, including ${missingGeometry} without mapped locations; unsupported identities have no legal action.`);
