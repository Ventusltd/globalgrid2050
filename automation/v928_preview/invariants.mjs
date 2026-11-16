/** Independent preservation gate. Imports the established MAP contract; no network. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CANDIDATE = resolve(ROOT, process.env.V928_CANDIDATE || 'uk_renewables_pipeline/202611161757');
const BASELINE = resolve(ROOT, 'uk_renewables_pipeline/202611161244');
const BASE_SHA = process.env.V928_BASE_SHA || '65bcc01e0d7e4dc073e759345727e53cf7a95752';
const OUT = process.env.V928_OUT ? resolve(process.env.V928_OUT) : null;
assert.ok(CANDIDATE.startsWith(ROOT + sep), 'candidate must be inside this repository');
const bytes = p => readFileSync(p);
const json = p => JSON.parse(bytes(p).toString('utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const receipt = { status: 'RUNNING', utc: new Date().toISOString(), head: git(['rev-parse', 'HEAD']),
  preservation_base: BASE_SHA, candidate: relative(ROOT, CANDIDATE).replaceAll('\\', '/'),
  baseline: relative(ROOT, BASELINE).replaceAll('\\', '/'), checks: [], limitations: [
    'Offline gate proves original link construction, not execution of the public GridAtlas receiver.',
    'Preserved records and fixture source states are not live-source or publication acceptance.'] };
function pass(name, details) { receipt.checks.push({ name, status: 'PASS', ...details }); console.log('PASS:', name); }
async function population(folder) {
  const manifest = json(resolve(folder, 'data/v9.1/build_manifest.json'));
  const rows = [];
  for (const part of manifest.project_partitions) {
    const raw = bytes(resolve(folder, part.path));
    assert.equal(sha(raw), part.sha256, `${folder}/${part.path} pinned bytes`);
    const doc = JSON.parse(raw.toString('utf8'));
    assert.equal(doc.projects.length, part.record_count, `${part.path} declared count`);
    rows.push(...doc.projects);
  }
  for (const part of manifest.atlas_partitions) {
    const raw = bytes(resolve(folder, part.path));
    assert.equal(sha(raw), part.sha256, `${part.path} atlas pinned bytes`);
    assert.equal(JSON.parse(raw).features.length, part.feature_count, `${part.path} atlas count`);
  }
  assert.equal(rows.length, 7775, 'canonical REPD universe');
  assert.equal(rows.filter(r => r.technology === 'solar').length, 3604, 'canonical solar universe');
  assert.equal(new Set(rows.map(r => String(r.repd_ref))).size, 7775, 'unique canonical REPD identities');
  return {manifest, rows};
}
try {
  const originalRegistry = JSON.parse(execFileSync('git',['show',BASE_SHA+':automation/pipeline_release/registry.json'],{cwd:ROOT,encoding:'utf8'}));
  const currentRegistry = json(resolve(ROOT,'automation/pipeline_release/registry.json'));
  assert.deepEqual(currentRegistry.versions.slice(0,originalRegistry.versions.length),originalRegistry.versions,
    'all pre-existing release records, Unicode and probes must retain their exact meanings');
  for (const key of Object.keys(originalRegistry).filter(key=>!['versions','release_candidate'].includes(key))) {
    assert.deepEqual(currentRegistry[key],originalRegistry[key], 'unrelated registry metadata '+key);
  }
  pass('prior release registry records and unrelated metadata preserved, including Unicode');
  function directoryBytes(folder) {
    return readdirSync(folder).reduce((total, name) => {
      if (name === '__pycache__') return total;
      const file = resolve(folder, name);
      return total + (statSync(file).isDirectory() ? directoryBytes(file) : statSync(file).size);
    }, 0);
  }
  const editionBytes = directoryBytes(CANDIDATE);
  assert.ok(editionBytes <= 18 * 1024 * 1024, 'actual working candidate must fit 18 MiB, including newly staged/untracked assets');
  pass('actual complete candidate fits unchanged 18 MiB budget', {bytes: editionBytes, limit: 18 * 1024 * 1024});
  const snapshot = bytes(resolve(CANDIDATE, 'news/pipeline_headlines.snapshot.json'));
  const snapshotReceipt = json(resolve(CANDIDATE, 'news/snapshot-provenance.json'));
  const originalSnapshot = execFileSync('git', ['show', snapshotReceipt.source_commit + ':' + snapshotReceipt.source_path], {cwd:ROOT});
  assert.deepEqual(snapshot, originalSnapshot, 'saved headline snapshot must retain exact existing owner-feed bytes');
  assert.equal(sha(snapshot), snapshotReceipt.sha256);
  assert.equal(JSON.parse(snapshot).items.length, snapshotReceipt.items);
  pass('source-attributed headline snapshot equals pinned existing feed', {items:snapshotReceipt.items,source_commit:snapshotReceipt.source_commit,sha256:snapshotReceipt.sha256});
  const [candidate, baseline] = await Promise.all([population(CANDIDATE), population(BASELINE)]);
  assert.deepEqual(candidate.rows, baseline.rows, 'every official row and its order must equal frozen V9.24');
  pass('canonical 7,775 rows / 3,604 solar with complete V9.24 record parity', {record_count:7775, solar_count:3604});
  for (const rel of ['solar1000/manifest.json', 'solar1000/candidates.json']) {
    assert.deepEqual(bytes(resolve(CANDIDATE, rel)), bytes(resolve(BASELINE, rel)), `${rel} frozen bytes`);
  }
  const selected = json(resolve(CANDIDATE, 'solar1000/manifest.json'));
  assert.equal(selected.selection, 'numeric-repd-ref-ascending');
  assert.equal(selected.ids.length, 1000);
  assert.deepEqual(selected.ids, candidate.rows.filter(r => r.technology === 'solar')
    .map(r => String(r.repd_ref)).sort((a,b) => Number(a)-Number(b)).slice(0,1000));
  assert.equal(selected.independently_verified, 0);
  assert.equal(selected.not_researched, 998);
  const leads = json(resolve(CANDIDATE, 'solar1000/candidates.json'));
  assert.equal(leads.length, 2);
  assert.ok(leads.every(r => r.rights_basis === 'unknown' && r.verification === 'provisional_candidate_only'));
  pass('ordered Solar-1000 identities, seed/provenance bytes and provisional source states preserved',
    {selection_sha256:sha(bytes(resolve(CANDIDATE,'solar1000/manifest.json'))), first:selected.ids[0], last:selected.ids.at(-1)});
  const candidateReceiver = await import(pathToFileURL(resolve(CANDIDATE,'scripts/core/atlas-receiver-v9-7.js')));
  const baselineReceiver = await import(pathToFileURL(resolve(BASELINE,'scripts/core/atlas-receiver-v9-7.js')));
  let located = 0;
  for (let i=0; i<candidate.rows.length; i++) {
    const row = candidate.rows[i];
    const original = baselineReceiver.buildAtlasDeepLinkV9_7(baseline.rows[i]);
    const href = candidateReceiver.buildAtlasDeepLinkV9_7(row);
    assert.equal(href, original, `REPD ${row.repd_ref}: original MAP route/parameters`);
    const url = new URL(href);
    assert.equal(url.searchParams.get('repd_ref'), String(row.repd_ref));
    assert.equal(url.searchParams.get('technology'), row.technology);
    if (candidateReceiver.atlasCentresOnRepdPointV9_7(row)) located++;
  }
  const legacy = execFileSync(process.execPath,[resolve(CANDIDATE,'tests/check_map_contract_all_rows.mjs')],
    {cwd: ROOT, encoding:'utf8'}).trim();
  pass('all 7,775 original MAP routes and established all-row contract', {located, ref_only:7775-located, legacy});
  const changed = new Set([
    ...git(['diff','--name-only',BASE_SHA,'--']).split(/\r?\n/),
    ...git(['ls-files','--others','--exclude-standard']).split(/\r?\n/),
  ].filter(Boolean));
  const candidateRel = receipt.candidate + '/';
  const restoreFiles = new Set(['homepage_versions/homepage_v142.html','homepage_versions/homepage_v142-metrics.json']);
  for (const path of restoreFiles) {
    assert.equal(git(['ls-tree', BASE_SHA, '--', path]), '', 'restore point must be additive, never overwrite old bytes');
  }
  const oldRestoreReadme = execFileSync('git',['show',BASE_SHA+':homepage_versions/README.md'],{cwd:ROOT,encoding:'utf8'});
  assert.ok(bytes(resolve(ROOT,'homepage_versions/README.md')).toString('utf8').replaceAll('\r\n','\n').startsWith(oldRestoreReadme.replaceAll('\r\n','\n')),
    'restore-point ledger retains its entire prior history');
  const forbidden = [...changed].filter(p =>
    !restoreFiles.has(p) && p !== 'homepage_versions/README.md' && (
    (/^uk_renewables_pipeline\/\d{12}\//.test(p) && !p.startsWith(candidateRel)) ||
    /^(?:index\.html|catalogue\/homepage-owner\.json|homepage-shell\/|homepage_versions\/|homepage_v\d+\.html)/.test(p)));
  assert.deepEqual(forbidden, [], 'historical editions and operative homepage bytes must remain unchanged');
  pass('historical editions and operative homepage preserved against source base');
  receipt.source_sha256 = Object.fromEntries(['index.html','data/v9.1/build_manifest.json','solar1000/manifest.json']
    .map(p=>[p,sha(bytes(resolve(CANDIDATE,p)))]));
  receipt.status = 'PASS';
} catch(error) {
  receipt.status = 'FAIL'; receipt.failure = error.stack || String(error); throw error;
} finally {
  if (OUT) { mkdirSync(OUT,{recursive:true}); writeFileSync(resolve(OUT,'invariants.json'),JSON.stringify(receipt,null,2)+'\n'); }
}
