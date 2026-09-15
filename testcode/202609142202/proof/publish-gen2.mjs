// publish-gen2.mjs — writes publication.json: bytes and sha256 of every shipped file in the folder (recursively), .log files excluded,
// publication.json itself excluded (it cannot carry its own hash). Run after the self-test so the proof files are final.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const DIR = 'C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202';
const files = {};
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const rel = path.relative(DIR, p).split(path.sep).join('/'); if (rel === 'publication.json' || rel.endsWith('.log')) continue; const b = fs.readFileSync(p); files[rel] = { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') }; } } };
walk(DIR);
const prev = JSON.parse(fs.readFileSync(DIR + '/publication.json', 'utf8'));
const pub = {
  stamp: prev.stamp, name: prev.name,
  generation: 'generation 2: round-2 findings fixed; all 250,174 unique lines added',
  previous_generation: { generation: prev.generation, published_utc: prev.published_utc },
  published_utc: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
  data_provenance: 'data/provenance.json',
  self_test: 'proof/gen2.mjs → proof/gen2.json',
  files,
  note: 'Every shipped file with bytes and sha256; logs are not shipped. Numbers on the page come from data/ only: 250,174 unique numbered lines (LINES.md 2026-09-14 19:56 UTC; 128,369 inside a function family, 121,805 not) and 664,940 family-line entries (128,369 distinct numbered lines) in the published buckets; index.json states 250,174.'
};
fs.writeFileSync(DIR + '/publication.json', JSON.stringify(pub, null, 1));
console.log(Object.keys(files).length, 'files listed;', Object.values(files).reduce((s, f) => s + f.bytes, 0).toLocaleString('en-GB'), 'bytes; generation:', pub.generation);
