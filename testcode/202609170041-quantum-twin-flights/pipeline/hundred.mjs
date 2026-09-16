// THE HUNDRED: ten families of ten, fastest first, all against real app code. Families 1–6 run here (machine);
// 7–10 run in Chrome in front of Vikram through window.__probe / window.__pilot (see hundred-browser list at the end).
// Every test can fail. None reads its own comments. One line per test. usage: node pipeline/hundred.mjs
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url))); const J = f => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));
const SRV = 'http://127.0.0.1:8791'; const results = []; let n = 0;
async function t(family, name, fn) { n++; const t0 = performance.now(); let ok = false, note = ''; try { const r = await fn(); ok = r === true || (r && r.ok === true); note = (r && r.note) || ''; } catch (e) { note = e.message; } const ms = (performance.now() - t0).toFixed(0); const line = `${String(n).padStart(3)} ${ok ? 'PASS' : 'FAIL'} ${String(ms).padStart(5)}ms ${family} · ${name}${note ? ' · ' + note : ''}`; results.push({ n, family, name, ok, ms: +ms, note }); console.log(line); }
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const post = async (p, body) => { const r = await fetch(SRV + p, { method: 'POST', body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const engine = async (module, fn, args) => post('/engine/run', { module, fn, args });

// 1 · keys
const K = J('keys.json'); const fam = J('route-gridatlas.json'); const E = J('entangle.json'); const R = J('routes.json'); const ER = J('engine-route.json'); const A = J('apps.json'); const Q = J('qubit.json');
await t('keys', 'count is 128,369', () => K.count === 128369 && K.keys.length === 128369);
await t('keys', 'no duplicate key', () => new Set(K.keys).size === K.keys.length);
await t('keys', 'max key ≤ 342,795', () => K.max_key <= 342795);
await t('keys', 'every key is a positive integer', () => K.keys.every(k => Number.isInteger(k) && k > 0));
await t('keys', 'every place index valid', () => K.place.every(p => p >= 0 && p < K.places.length));
await t('keys', 'every line ≥ 1', () => K.line.every(l => l >= 1));
await t('keys', 'every name index valid or -1', () => K.name.every(i => i === -1 || (i >= 0 && i < K.names.length)));
await t('keys', 'every family id has an atom', () => { const miss = K.family.filter(f => !Q.atoms[String(f)]).length; return { ok: miss === 0, note: `${miss} keys without atom` }; });
await t('keys', 'keys.json under 12 MB', () => fs.statSync(path.join(HERE, 'keys.json')).size < 12e6);
await t('keys', 'places count 1,736', () => K.places.length === 1736);
// 2 · engine
await t('engine', 'voltageDropVolts 120A 250m 0.32 pf0.95 = 15.796', async () => { const r = await engine('voltage-drop', 'voltageDropVolts', { currentA: 120, lengthM: 250, resistanceOhmPerKm: 0.32, powerFactor: 0.95, phases: 'three' }); return near(r.json?.result?.value, 15.796, 0.001); });
await t('engine', 'missing powerFactor is refused', async () => (await engine('voltage-drop', 'voltageDropVolts', { currentA: 120, lengthM: 250, resistanceOhmPerKm: 0.32 })).status === 422);
await t('engine', 'powerFactor 1.2 is refused', async () => (await engine('voltage-drop', 'voltageDropVolts', { currentA: 120, lengthM: 250, resistanceOhmPerKm: 0.32, powerFactor: 1.2 })).status === 422);
await t('engine', 'negative length is refused', async () => (await engine('voltage-drop', 'voltageDropVolts', { currentA: 120, lengthM: -5, resistanceOhmPerKm: 0.32, powerFactor: 0.9 })).status === 422);
await t('engine', 'dropPercent(15.796, 400) = 3.95', async () => { const r = await engine('voltage-drop', 'dropPercent', { dropVolts: 15.796, nominalVolts: 400 }); const v = r.json?.result?.value ?? r.json?.result?.percent ?? r.json?.result; return { ok: near(+v, 3.949, 0.01), note: String(JSON.stringify(r.json?.result)).slice(0, 60) }; });
await t('engine', 'lossesWatts finite', async () => { const r = await engine('voltage-drop', 'lossesWatts', { currentA: 120, lengthM: 250, resistanceOhmPerKm: 0.32, phases: 'three' }); return Number.isFinite(r.json?.result?.value); });
await t('engine', 'diversifiedDemandKw(900, 3, 0.4) = 1080', async () => near((await engine('diversified-demand', 'diversifiedDemandKw', { unitCount: 900, perUnitKw: 3, coincidenceFactor: 0.4 })).json?.result?.value, 1080, 0.001));
await t('engine', 'currentA(100 kVA, 400 V, three) ≈ 144.3', async () => { const r = await engine('current-from-power', 'currentA', { apparentPowerVa: 100000, voltageV: 400, phases: 'three' }); return near(r.json?.result?.value, 144.34, 0.1); });
await t('engine', 'apparentPowerMva(10 MW, 0.9) ≈ 11.11', async () => near((await engine('firm-capacity', 'apparentPowerMva', { mw: 10, powerFactor: 0.9 })).json?.result?.value, 11.111, 0.01));
await t('engine', 'unknown function returns the list', async () => { const r = await engine('voltage-drop', 'nope', {}); return r.status === 404 && Array.isArray(r.json?.functions); });
// 3 · routes
await t('routes', 'atlas unique keys 10,415', () => fam.keys.length === 10415);
await t('routes', 'atlas families 357', () => fam.families.length === 357);
await t('routes', 'five atlas files carry keys (4 cartridges + atlas index.html)', () => Object.keys(fam.files).length === 5 && Object.values(fam.files).every(f => f.keys.length > 0));
await t('routes', 'every atlas key is on the wafer', () => { const s = new Set(K.keys); return fam.keys.every(k => s.has(k)); });
await t('routes', 'per-file sums exceed unique by 207 (shared)', () => Object.values(fam.files).reduce((a, f) => a + f.keys.length, 0) - fam.keys.length === 207);
await t('routes', 'engine modules on wafer 15 of 22', () => Object.keys(ER.modules).length === 22 && Object.values(ER.modules).filter(m => m.keys.length).length === 15);
await t('routes', 'the 7 missing are named', () => Object.entries(ER.modules).filter(([, m]) => !m.keys.length).map(([k]) => k).sort().join() === ['compute-observer', 'corridor-estimate', 'current-from-power', 'electrical-distance', 'electrification-model', 'rating-envelope', 'v9-geodesy'].join());
await t('routes', '84 versions, all with keys', () => R.versions.length === 84 && R.versions.every(v => v.keys > 0));
await t('routes', '19 apps qualify', () => A.apps.filter(a => a.app).length === 19);
await t('routes', 'pipelinenews flagged as no index', () => A.apps.find(a => a.name === 'pipelinenews')?.app === false);
// 4 · twin
await t('twin', 'entangle rate 1.0', () => E.rate === 1);
await t('twin', '1,736 places', () => E.places === 1736);
await t('twin', 'zero broken', () => E.broken === 0 && E.broken_keys.length === 0);
await t('twin', 'per-repo resolved = keys', () => Object.values(E.per_repo).every(r => r.keys === r.resolved));
await t('twin', 'every hash is 10 hex', () => E.hash.every(h => /^[0-9a-f]{10}$/.test(h)));
await t('twin', 'key 39885 reads event.stopPropagation();', async () => { const r = await (await fetch(SRV + '/line?key=39885')).json(); return { ok: (r.text || '').trim() === 'event.stopPropagation();', note: (r.text || '').trim().slice(0, 40) }; });
await t('twin', 'lowest key (2) reads a real line', async () => { const lowest = K.keys.reduce((a, b) => a < b ? a : b); const r = await (await fetch(SRV + '/line?key=' + lowest)).json(); return { ok: typeof r.text === 'string', note: r.text === '' ? 'line 130 is an empty line, which is a real line' : '' }; });
await t('twin', 'commit hashes are hex', () => K.places.every(p => /^[0-9a-f]{7,40}$/.test(String(p[1]))));
await t('twin', 'no path starts with "-"', () => K.places.every(p => !String(p[2]).startsWith('-')));
await t('twin', 'unknown key → 404', async () => (await fetch(SRV + '/line?key=999999999')).status === 404);
// 5 · server
await t('server', 'foreign Origin → 403', async () => (await fetch(SRV + '/gpu', { headers: { origin: 'https://evil.example' } })).status === 403);
await t('server', 'wrong Host → 403', () => new Promise(res => { import('node:http').then(h => { const q = h.request({ host: '127.0.0.1', port: 8791, path: '/gpu', headers: { Host: 'evil.example' } }, r => res(r.statusCode === 403)); q.on('error', () => res(false)); q.end(); }); }));
await t('server', '70 KB body refused', async () => { const r = await post('/signal', { pad: 'x'.repeat(70000) }); return r.status >= 400; });
await t('server', 'bad JSON body refused', async () => (await fetch(SRV + '/engine/run', { method: 'POST', body: '{nope' })).status >= 400);
await t('server', 'unknown module → 404', async () => (await engine('no-such', 'f', {})).status === 404);
await t('server', 'module name with path chars refused', async () => (await engine('../serve', 'f', {})).status === 400);
await t('server', '/engine/list has 22', async () => Object.keys(await (await fetch(SRV + '/engine/list')).json()).length === 22);
await t('server', '/gpu names the card', async () => /RTX/.test((await (await fetch(SRV + '/gpu')).json()).name || ''));
await t('server', '/wafer/ serves the Line Wafer', async () => /THE LINE WAFER/.test(await (await fetch(SRV + '/wafer/')).text()));
await t('server', 'wafer database reachable', async () => (await fetch(SRV + '/testcode/202609142202/data/all-lines.meta.json')).status === 200);
// 6 · planner
const { plan } = await import('file://' + path.join(HERE, 'pilot-rules.js')); const ctx = { appNames: A.apps.filter(a => a.app).map(a => a.name), dies: ['sld-sandbox', 'substation-intelligence', 'place-global-search', 'streaming-parquet-bridge'] };
const P = s => plan(s, ctx).commands;
await t('planner', 'voltage drop sentence → engine call', () => P('voltage drop for 120 amps over 250 metres at 0.32 ohm per km pf 0.95 three phase')[0]?.startsWith('run voltage-drop.voltageDropVolts'));
await t('planner', 'missing pf → refused with names', () => plan('voltage drop for 120 amps over 250 metres at 0.32 ohm', ctx).commands.length === 0);
await t('planner', 'houses sentence → diversified demand', () => P('diversified demand for 900 houses at 3 kw each coincidence 0.4')[0]?.startsWith('run diversified-demand'));
await t('planner', 'substation + floorplan', () => P('show me the substation die arranged as a cpu floorplan').join() === 'die substation,arrange floorplan');
await t('planner', 'plasma', () => P('send a plasma through my apps').includes('plasma'));
await t('planner', 'lightning gridatlas', () => P('lightning through gridatlas')[0] === 'lightning gridatlas');
await t('planner', 'read 39885', () => P('read 39885').includes('read 39885'));
await t('planner', 'versions', () => P('show me the versions').includes('versions'));
await t('planner', 'seed keeps the words', () => P('seed milky way')[0] === 'seed milky way');
await t('planner', 'nonsense → no command', () => P('purple monkey dishwasher').length === 0);

const pass = results.filter(r => r.ok).length; const out = path.join(HERE, 'probe', `HUNDRED-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}.json`); fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ machine: results, pass, total: results.length, browser_pending: 40 }, null, 1));
console.log(`\nmachine families 1–6: ${pass}/${results.length} pass · ${out}`); if (pass !== results.length) process.exitCode = 1;
