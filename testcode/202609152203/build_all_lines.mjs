// Every unique numbered line of the estate, from stars LINES.md (the modular star's own export).
// Output: all-lines.bin (Uint32 LE permanent numbers, ascending), all-lines.len.bin (Uint16 LE code length in bytes, capped 65535),
//         all-lines.meta.json (counts, min/max, sha256 + bytes of LINES.md, generated line from its header, family membership counts).
import { createHash } from 'node:crypto'; import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
// Copied into this stamp from the builder that made testcode/202609142202's all-lines pack; the only change is that it reads and
// writes ./data next to this file (the original wrote to its working directory and read lines.bin from the old stamp). Run after build_state.mjs.
const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const url = 'https://ventusltd.github.io/stars/LINES.md';
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
const sha = createHash('sha256').update(buf).digest('hex');
const text = buf.toString('utf8');
const header = text.slice(0, text.indexOf('```'));
const body = text.slice(text.indexOf('```text') + 7, text.lastIndexOf('```'));
const nums = [], lens = [];
for (const row of body.split('\n')) { const t = row.indexOf('\t'); if (t <= 0) continue; const n = Number(row.slice(0, t)); if (!Number.isInteger(n) || n <= 0) continue; nums.push(n); lens.push(Math.min(65535, Buffer.byteLength(row.slice(t + 1)))); }
const order = nums.map((n, i) => i).sort((a, b) => nums[a] - nums[b]);
const u32 = new Uint32Array(order.map(i => nums[i])), u16 = new Uint16Array(order.map(i => lens[i]));
// family membership from the Quantum Twin Star pack (which lines sit inside a function family)
const packLines = path.join(DATA, 'lines.bin');
let inFamily = null, famDistinct = 0;
if (existsSync(packLines)) { const fb = readFileSync(packLines); const fam = new Uint32Array(fb.buffer, fb.byteOffset, fb.length / 4); const set = new Set(fam); famDistinct = set.size; inFamily = new Uint8Array(u32.length); for (let i = 0; i < u32.length; i++) inFamily[i] = set.has(u32[i]) ? 1 : 0; }
writeFileSync(path.join(DATA, 'all-lines.bin'), Buffer.from(u32.buffer)); writeFileSync(path.join(DATA, 'all-lines.len.bin'), Buffer.from(u16.buffer)); if (inFamily) writeFileSync(path.join(DATA, 'all-lines.family.bin'), Buffer.from(inFamily.buffer));
const uniq = new Set(u32).size, dup = u32.length - uniq;
const meta = { schema: 'all-lines.v0', source: { url, bytes: buf.length, sha256: sha, header: header.trim().split('\n').slice(2, 3)[0]?.slice(0, 300) }, built_utc: new Date().toISOString(),
  lines: u32.length, distinct: uniq, duplicate_rows: dup, min: u32[0], max: u32[u32.length - 1], in_a_family: inFamily ? inFamily.reduce((s, v) => s + v, 0) : null, family_pack_distinct: famDistinct || null,
  files: { 'all-lines.bin': u32.length * 4, 'all-lines.len.bin': u16.length * 2, 'all-lines.family.bin': inFamily ? inFamily.length : 0 } };
writeFileSync(path.join(DATA, 'all-lines.meta.json'), JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta, null, 1));
