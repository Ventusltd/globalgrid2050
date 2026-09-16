// Version control for CPU WORLD, two layers:
//  1. git: every snapshot is a local commit (never pushed from here).
//  2. versions/<UTC stamp>/ : a stamped copy of the state files with SHA-256 of each, restorable.
// usage: node pipeline/snapshot.mjs snapshot "what changed"   |   node pipeline/snapshot.mjs list   |   node pipeline/snapshot.mjs restore 20260916T2045
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STATE = ['console.html', 'supernova.html', 'serve.mjs', 'route-gridatlas.json', 'routes.json', 'keys.json', 'files/index.json', 'pipeline', 'reviews', 'probe', 'harness'];
const [cmd = 'list', ...rest] = process.argv.slice(2);
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const walk = (p, out = []) => { const s = fs.statSync(p); if (s.isDirectory()) fs.readdirSync(p).forEach(n => walk(path.join(p, n), out)); else out.push(p); return out; };
const git = (...a) => { try { return execFileSync('git', a, { cwd: HERE, encoding: 'utf8', windowsHide: true }).trim(); } catch (e) { return ''; } };

if (cmd === 'snapshot') {
  const note = rest.join(' ') || 'snapshot'; const s = stamp(); const dir = path.join(HERE, 'versions', s); fs.mkdirSync(dir, { recursive: true });
  const manifest = { stamp: s, note, files: {} };
  for (const rel of STATE) { const src = path.join(HERE, rel); if (!fs.existsSync(src)) continue;
    for (const f of walk(src)) { if (f.includes(`${path.sep}node_modules${path.sep}`) || f.endsWith('.png')) continue; const r = path.relative(HERE, f); const dst = path.join(dir, r); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(f, dst); manifest.files[r.replace(/\\/g, '/')] = sha(f); } }
  fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 1));
  if (!fs.existsSync(path.join(HERE, '.git'))) { git('init'); fs.writeFileSync(path.join(HERE, '.gitignore'), 'node_modules/\nkeys.json\nprobe/*.png\nfiles/*.txt\nserve.log\n'); }
  git('add', '-A'); const out = git('commit', '-q', '-m', `${s} ${note}`); const head = git('rev-parse', '--short', 'HEAD');
  console.log(JSON.stringify({ step: 'snapshot', stamp: s, files: Object.keys(manifest.files).length, commit: head, note }));
} else if (cmd === 'list') {
  const vdir = path.join(HERE, 'versions'); const vs = fs.existsSync(vdir) ? fs.readdirSync(vdir).sort() : [];
  for (const v of vs) { const m = JSON.parse(fs.readFileSync(path.join(vdir, v, 'MANIFEST.json'), 'utf8')); console.log(`${v}  ${Object.keys(m.files).length} files  ${m.note}`); }
  console.log(git('log', '--oneline', '-10') || '(no git history yet)');
} else if (cmd === 'restore') {
  const want = rest[0]; const vdir = path.join(HERE, 'versions'); const v = fs.readdirSync(vdir).sort().find(x => x.startsWith(want || ''));
  if (!v) { console.error('FAIL: no such version'); process.exit(1); }
  const m = JSON.parse(fs.readFileSync(path.join(vdir, v, 'MANIFEST.json'), 'utf8')); let n = 0, bad = 0;
  for (const [rel, h] of Object.entries(m.files)) { const src = path.join(vdir, v, rel); if (sha(src) !== h) { bad++; continue; } const dst = path.join(HERE, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); n++; }
  console.log(JSON.stringify({ step: 'restore', version: v, restored: n, hash_mismatch: bad }));
  if (bad) process.exit(1);
} else { console.error('usage: snapshot <note> | list | restore <stamp>'); process.exit(1); }
