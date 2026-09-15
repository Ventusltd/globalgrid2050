// Writes ../publication.json: bytes + sha256 of every file shipped in testcode/202609150125
// (except publication.json itself), plus the build, leak-check and headless-check summaries.
//   node proof/publish.mjs
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..').replace(/\\/g, '/');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { return { error: String(e) }; } };

const onDisk = walk(ROOT).map(f => f.replace(/\\/g, '/')).filter(f => !f.endsWith('/publication.json')).sort();
let ignored = new Set();
try {
  const out = execSync('git check-ignore --stdin', { cwd: ROOT, input: onDisk.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  ignored = new Set(out.split('\n').map(s => s.trim()).filter(Boolean).map(s => path.resolve(ROOT, s).replace(/\\/g, '/')));
} catch (e) { /* git check-ignore exits 1 when nothing is ignored */ }

const entry = f => ({ file: f.slice(ROOT.length + 1), bytes: fs.statSync(f).size, sha256: sha(f) });
const files = onDisk.filter(f => !ignored.has(f)).map(entry);
const notPublished = onDisk.filter(f => ignored.has(f)).map(entry);

const prov = read('data/provenance.json');
const leak = read('proof/leak-check.json');
const head = read('proof/headless-check.json');

const out = {
  page: 'testcode/202609150125 — Sector Star: real-economy energy users by sector and district',
  url: 'https://globalgrid2050.com/testcode/202609150125/',
  built_utc: new Date().toISOString(),
  node: process.version,
  what: 'Aggregates only. No company name, registration number, address line, full postcode, telephone, e-mail, web address, Companies House link or per-company row appears in any shipped file.',
  population: prov.counts ? prov.counts.rows_read_from_source : null,
  suppression: prov.suppression || null,
  deterministic_techniques: prov.deterministic_techniques || null,
  links: prov.links || null,
  leak_check: { pass: leak.pass, files_checked: leak.files_checked, findings: (leak.findings || []).length, names_tested: leak.company_name_test && leak.company_name_test.names_tested, run_utc: leak.run_utc },
  headless_check: { pass: head.pass, run_utc: head.run_utc, loads: (head.loads || []).map(l => ({ name: l.name, width: l.width, errors: l.errors, scrollWidth: l.scrollWidth, innerWidth: l.innerWidth, tap_heights: l.tap_heights, pass: l.pass })), count_sentence: head.loads && head.loads[0] ? head.loads[0].count_sentence : null },
  file_count: files.length,
  total_bytes: files.reduce((a, f) => a + f.bytes, 0),
  files,
  not_published: { reason: 'on disk in this folder but excluded by the repository .gitignore: never committed, therefore never served', count: notPublished.length, files: notPublished },
};
fs.writeFileSync(path.join(ROOT, 'publication.json'), JSON.stringify(out, null, 1) + '\n');
console.log('publication.json', files.length, 'files,', out.total_bytes, 'bytes | leak', out.leak_check.pass, '| headless', out.headless_check.pass);
for (const f of files) console.log(' ', f.file.padEnd(28), String(f.bytes).padStart(9), f.sha256.slice(0, 12));
