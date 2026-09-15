// Writes ../publication.json: bytes + sha256 of every file in testcode/202609142225 (except publication.json itself),
// the data pack's provenance reference (path, built_utc, output hashes) and the proof summary.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execSync } from 'node:child_process';
const ROOT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142225';
const PACK = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/data';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
// the footer's build stamp is written here from the clock (never typed by hand), before index.html is hashed
const BUILT = new Date().toISOString().replace('T', ' ').slice(0, 16);
const html = fs.readFileSync(ROOT + '/index.html', 'utf8').replace(/window\.BUILT = '[^']*'/, `window.BUILT = '${BUILT}'`);
fs.writeFileSync(ROOT + '/index.html', html);
// A file .gitignore excludes is never committed and so is never served. It is listed apart from `files`, so that no digest in
// `files` claims bytes globalgrid2050.com does not have — the same reason .gitattributes pins the working copy to LF.
const onDisk = walk(ROOT).map(f => f.replace(/\\/g, '/')).filter(f => !f.endsWith('/publication.json')).sort();
let ignored = new Set();
try { const out = execSync('git check-ignore --stdin', { cwd: ROOT, input: onDisk.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }); ignored = new Set(out.split('\n').map(s => s.trim()).filter(Boolean).map(s => path.resolve(ROOT, s).replace(/\\/g, '/'))); } catch (e) { /* git check-ignore exits 1 when nothing is ignored */ }
const entry = f => ({ file: f.slice(ROOT.length + 1), bytes: fs.statSync(f).size, sha256: sha(f), mtime_utc: fs.statSync(f).mtime.toISOString() });
const files = onDisk.filter(f => !ignored.has(f)).map(entry);
const notPublished = onDisk.filter(f => ignored.has(f)).map(entry);
const prov = JSON.parse(fs.readFileSync(PACK + '/provenance.json', 'utf8'));
const packOutputs = prov.outputs.map(o => ({ ...o, sha256_now: sha(PACK + '/' + o.file), bytes_now: fs.statSync(PACK + '/' + o.file).size }));
let proof = null; try { const r = JSON.parse(fs.readFileSync(ROOT + '/proof/build-proof.json', 'utf8')); proof = { run_utc: r.run_utc, loads: r.loads.filter(l => l.scrollWidth !== undefined).map(l => ({ name: l.name, width: l.width, scrollWidth: l.scrollWidth, errors: l.errors, hint: l.hint })), gpu: r.loads.find(l => l.name === 'gpu-facts') || null, compose: r.loads.find(l => l.name === 'compose-1440') || null, picker: r.loads.find(l => l.name === 'picker-handoff') || null }; } catch (e) { proof = { error: String(e) }; }
const out = {
  page: 'testcode/202609142225 — Star Generator: one grammar, six lenses', built_utc: new Date().toISOString(), node: process.version,
  built_stamp_in_footer: BUILT + ' UTC',
  shipped: ['index.html', 'style.css', 'core.js', 'gl.js', 'ui.js', 'lenses/ring.js', 'lenses/particle.js', 'lenses/chord.js', 'lenses/river.js', 'lenses/table.js', 'lenses/column.js', 'GRAMMAR.md', 'README.md', 'DECISION.md', 'proof/build-proof.mjs', 'proof/bench.mjs', 'proof/repair-check.mjs', 'proof/review2-check.mjs', 'proof/final-check.mjs', 'proof/grep-tests.sh', 'proof/publish.mjs'],
  files,
  not_published: { reason: 'on disk in this folder but excluded by the repository .gitignore (*.log): never committed, therefore never served', count: notPublished.length, files: notPublished },
  data_pack: { path: '../202609142202/data/ (relative; not copied)', provenance: '../202609142202/data/provenance.json', built_utc: prov.built_utc, builder: prov.builder, star_maker_commit: prov.star_maker_commit, stars_base: prov.stars_base, outputs: packOutputs, checks: prov.checks },
  live_sources: ['https://ventusltd.github.io/stars/blocks/blocks.json', 'https://ventusltd.github.io/stars/blocks/families.json', 'https://ventusltd.github.io/stars/code/index.json', 'https://ventusltd.github.io/stars/code/names.json', 'https://ventusltd.github.io/stars/code/f/<bucket>.json (lazy)', 'https://raw.githubusercontent.com/<repo>/<commit>/<path> (lazy, on Measure)'],
  proof,
  note: 'Files in proof/ dated 2026-09-14 23:28–23:32 UTC+1 (lens-grammar-proof.*, live-blocks.json, extract*.py, crops/, the other pages\' screenshots, lens_mobile_evidence.json) were already in this folder from an earlier session and are listed, not authored, here.',
};
fs.writeFileSync(ROOT + '/publication.json', JSON.stringify(out, null, 1));
console.log('publication.json', files.length, 'files,', files.reduce((a, f) => a + f.bytes, 0), 'bytes;', notPublished.length, 'on disk but not published (gitignored)');
for (const f of files) if (out.shipped.includes(f.file)) console.log(f.file.padEnd(24), String(f.bytes).padStart(8), f.sha256.slice(0, 12));
