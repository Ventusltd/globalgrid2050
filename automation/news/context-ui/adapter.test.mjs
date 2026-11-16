import test from 'node:test';
import assert from 'node:assert/strict';
import {readContext, MAX_BYTES, sourceUrl} from './adapter.mjs';
import {buildViewModel, raw, report, pins, encode, sha} from './test-support.mjs';
const options = {expectedSha256: pins.fixture_sha256, buildViewModel};
test('actual composer export: complete native record and receipt preservation', async () => {
  const actual = await readContext(raw, options);
  assert.deepEqual(actual, report);
  assert.deepEqual(actual.coverage.families, {policy: 8, grid: 2, solar: 4});
  assert.equal(actual.coverage.numeric_claims, 3);
  assert.equal(actual.coverage.linked_projects, 0);
  const policy = actual.records.filter(r => r.family === 'policy');
  assert.equal(policy.filter(r => r.evaluation_state === 'UNKNOWN').length, 7);
  assert.equal(policy.filter(r => r.evaluation_state === 'REPORTED_PROGRESS').length, 1);
  const cop = actual.input_receipts[0].native_metadata.documents.find(d => d.id.startsWith('unfccc:cop31'));
  assert.equal(cop.document_state, 'IN_PROGRESS'); assert.equal(cop.content_sha256, null); assert.equal(cop.retrieved_at, null);
  assert.ok(actual.records.some(r => r.source_state === 'REJECTED'));
  assert.ok(actual.records.some(r => r.scope.kind === 'portfolio' && r.scope.native_scope === 'issuer'));
});
test('pin required, changed bytes rejected, bounded UTF-8 input', async () => {
  await assert.rejects(readContext(raw, {buildViewModel}));
  await assert.rejects(readContext(raw, {...options, expectedSha256: '0'.repeat(64)}));
  await assert.rejects(readContext(new Uint8Array(MAX_BYTES + 1), options));
  const bad = new Uint8Array([0xff]);
  await assert.rejects(readContext(bad, {...options, expectedSha256: sha(bad)}));
});
const mutations = {
  'coverage overstatement': r => r.coverage.records++,
  'missing family': r => {r.records = r.records.filter(x => x.family !== 'solar');},
  'duplicate row': r => r.records.push(r.records[0]),
  'scope inflated to site binding': r => r.records[0].scope.canonical_project_id = 'site:123',
  'scope changed to issuer': r => r.records[0].scope.kind = 'issuer',
  'native scope disagrees': r => r.records[0].scope.native_scope = 'issuer',
  'rejected amendment converted to delivery': r => r.records[0].source_state = 'DELIVERED',
  'unknown evaluation promoted': r => r.records[0].evaluation_state = 'EVIDENCE_SUPPORTED_RESULT',
  'source clock rewritten': r => r.records[0].source_links[0].published_date = '2026-11-16',
  'source URL executable': r => r.records[0].source_links[0].url = 'javascript:alert(1)',
  'qualifier stripped': r => r.records.find(x => x.numeric_claims.some(f => f.qualifier === 'upper_bound')).numeric_claims[0].qualifier = 'stated',
  'numeric scalar coerced': r => {const f = r.records[0]; f.numeric_claims[0].claim.value = 480; f.native_record.numeric_claims[0].value = 480;},
  'figure scope reassigned': r => {const f = r.records[0]; f.numeric_claims[0].claim.entity.scope = 'issuer'; f.native_record.numeric_claims[0].entity.scope = 'issuer';},
  'source receipt replaced': r => r.records[0].source_links[0].receipt.sha256 = '0'.repeat(64),
  'duplicate input family': r => r.input_receipts[1] = r.input_receipts[0],
  'source bytes marked verified': r => r.input_receipts[0].source_byte_validation = 'VERIFIED',
  'COP31 source executable': r => r.input_receipts[0].native_metadata.documents[2].url = 'data:text/html,evil',
};
for (const [name, mutate] of Object.entries(mutations)) test(name, async () => {
  const changed = structuredClone(report); mutate(changed); const bytes = encode(changed);
  await assert.rejects(readContext(bytes, {...options, expectedSha256: sha(bytes)}));
});
for (const url of ['http://example.org/a', 'https://127.0.0.1/', 'https://[::1]/', 'https://localhost/',
  'https://example.org@evil.org/', 'https://evil.org:444/', 'https://evil.local/', 'https://evil.org\\@good.org/', ' javascript:alert(1)']) {
  test(`unsupported URL ${url}`, () => assert.throws(() => sourceUrl(url)));
}
test('copied input prevents changes during asynchronous digest', async () => {
  const bytes = raw.slice(); const pending = readContext(bytes, options); bytes.fill(0);
  assert.deepEqual(await pending, report);
});
