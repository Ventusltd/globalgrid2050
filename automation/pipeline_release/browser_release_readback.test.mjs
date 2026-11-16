import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, sep, extname} from 'node:path';
import {validateOptions, sourceContract, assertServedBytes, safeMap, parseCsv, assertInventory,
  networkVerdict, POINTER, runReadback} from './browser_release_readback.mjs';

const commit = 'f4d222844915438fba9323daba1808ce31c375a0';
const release = '202611161734';
const source = () => sourceContract(release, commit);
const goodMap = {href: 'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=1018&technology=solar', target: '_blank', rel: 'noopener'};
const clean = () => ({responses: [], failures: [], consoleErrors: [], pageErrors: 0, evidenceText: ''});

test('explicit release, exact commit, public HTTPS or loopback only', () => {
  assert.equal(validateOptions({release, sourceCommit: commit, origin: 'http://127.0.0.1:4173/'}).origin, 'http://127.0.0.1:4173');
  for (const override of [{release: '../latest'}, {sourceCommit: 'main'}, {origin: 'http://example.org'},
    {origin: 'https://user:secret@example.org'}, {origin: 'https://example.org/subpath/'}, {origin: 'https://example.org/?token=secret'}]) {
    assert.throws(() => validateOptions({release, sourceCommit: commit, origin: 'https://example.org', ...override}));
  }
});
test('real source contract binds frozen 1000 and declared data-centre inventory', () => {
  const s = source(); assert.equal(s.seed.ids.length, 1000); assert.equal(s.seed.ids[0], '1018');
  assert.equal(s.seed.ids.at(-1), '2325'); assert.equal(s.dc.records.length, s.dc.record_count);
  assert.match(s.tree, /^[a-f0-9]{40}$/);
});
test('same identity text cannot hide byte drift', () => {
  const s = source(); assertServedBytes(s.index, s.index);
  assert.throws(() => assertServedBytes(Buffer.concat([s.index, Buffer.from(' ')]), s.index), /served_bytes_differ/);
});
test('MAP rejects substituted host, identity, target and opener access', () => {
  assert.equal(safeMap(goodMap), true);
  for (const override of [{href: goodMap.href.replace('ventusltd.github.io', 'evil.example')},
    {href: goodMap.href.replace('1018', '1019')}, {href: 'javascript:alert(1)'}, {target: '_self'}, {rel: ''},
    {href: goodMap.href.replace('https://', 'https://user:password@')}]) assert.equal(safeMap({...goodMap, ...override}), false);
});
test('CSV parser handles quoted records without confusing embedded newlines for projects', () => {
  assert.deepEqual(parseCsv('\uFEFF"name","id"\r\n"a,b\n\"\"c\"\"","1018"'), [['name', 'id'], ['a,b\n"c"', '1018']]);
  for (const bad of ['"unterminated', '"a"bad,b', 'a,b\n1', 'a"x,b']) assert.throws(() => parseCsv(bad));
});
test('7775 rows with a duplicate or substituted project fail membership', () => {
  const ids = Array.from({length: 7775}, (_, i) => String(i + 1));
  assertInventory([...ids].reverse(), ids);
  const duplicate = [...ids]; duplicate[1] = duplicate[0]; assert.throws(() => assertInventory(duplicate, ids));
  const replaced = [...ids]; replaced[1] = '999999'; assert.throws(() => assertInventory(replaced, ids));
  assert.throws(() => assertInventory(ids.slice(1), ids));
});
test('missing evidence pointer is allowed only with actual 404 and truthful unavailable DOM', () => {
  const state = {...clean(), responses: [{url: POINTER, status: 404}],
    consoleErrors: [{url: POINTER, text: 'Failed to load resource: the server responded with a status of 404 ()'}],
    evidenceText: 'Evidence unavailable - no validated snapshot is available. Manual review required.'};
  assert.equal(networkVerdict(state).pass, true);
  assert.equal(networkVerdict({...state, evidenceText: 'Evidence snapshot: 1000 VERIFIED'}).pass, false);
  assert.equal(networkVerdict({...state, responses: [{url: POINTER, status: 503}]}).pass, false);
  assert.equal(networkVerdict({...state, pageErrors: 1}).pass, false);
  assert.equal(networkVerdict({...state, failures: ['unexpected failure']}).pass, false);
  assert.equal(networkVerdict({...state, consoleErrors: [{url: POINTER, text: 'Uncaught TypeError'}]}).pass, false);
  assert.equal(networkVerdict({...state, responses: [...state.responses, {url: 'https://example.org/other', status: 404}]}).pass, false);
});
test('only an undeclared browser default favicon404 is incidental', () => {
  const state = {...clean(), implicitFavicon: 'https://example.org/favicon.ico',
    consoleErrors: [{url: 'https://example.org/favicon.ico', text: 'Failed to load resource: the server responded with a status of 404 (Not Found)'}]};
  assert.equal(networkVerdict(state).pass, true);
  assert.equal(networkVerdict({...state, implicitFavicon: null}).pass, false);
  assert.equal(networkVerdict({...state, consoleErrors: [{url: state.implicitFavicon, text: 'Uncaught TypeError'}]}).pass, false);
  assert.equal(networkVerdict({...state, responses: [{url: state.implicitFavicon, status: 503}]}).pass, false);
});

// Opt-in real-browser counterexamples. Only this local negative server substitutes bytes;
// the production helper never intercepts, rewrites or suppresses browser requests.
const root = fileURLToPath(new URL('../../', import.meta.url));
async function negativeServer(mode) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = resolve(root, '.' + path);
      if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) throw Error();
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      let body = await readFile(file);
      if (mode === 'index' && path.endsWith('/index.html')) body = Buffer.concat([body, Buffer.from('<!-- deliberate readback counterexample -->')]);
      if (mode === 'asset' && path.endsWith('/scripts/plugins/pipeline-tabs-v925.js')) body = Buffer.concat([body, Buffer.from('\n// deliberate asset counterexample\n')]);
      const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml'};
      res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream'}); res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return {origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => { server.closeAllConnections(); server.close(r); })};
}
for (const [mode, error] of [['index', /served_bytes_differ/], ['asset', /loaded_release_assets_match_commit/]]) {
  test(`actual Chrome rejects served ${mode} drift`, {skip: process.env.BROWSER_READBACK_NEGATIVES !== '1', timeout: 120000}, async () => {
    const server = await negativeServer(mode);
    try { await assert.rejects(runReadback({release, sourceCommit: commit, origin: server.origin}), error); }
    finally { await server.close(); }
  });
}
