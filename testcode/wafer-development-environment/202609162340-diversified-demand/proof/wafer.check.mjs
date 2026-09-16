/* The same checks proof/index.html runs in a phone browser, run under Node with
 * no browser at all, so CI can gate on them.
 *
 * Run: node proof/wafer.check.mjs   (from testcode/202609151339)
 */
import fs from 'node:fs';
import { buildChecks } from './checks.mjs';

const D = new URL('../../202609142202/data/', import.meta.url);
const buf = n => fs.readFileSync(new URL(n, D));
const arr = (n, K) => { const b = buf(n); return new K(b.buffer, b.byteOffset, b.byteLength / K.BYTES_PER_ELEMENT); };

const D0 = {
  meta: JSON.parse(buf('all-lines.meta.json').toString('utf8')),
  keys: arr('all-lines.bin', Uint32Array),
  lens: arr('all-lines.len.bin', Uint16Array),
  inFam: arr('all-lines.family.bin', Uint8Array),
  families: JSON.parse(buf('families.json').toString('utf8')),
  famLines: arr('lines.bin', Uint32Array)
};

const checks = buildChecks(D0);
const failures = [];
let passed = 0;
for (const [name, fn] of checks) {
  let ok = false;
  try { ok = fn() === true; } catch (e) { failures.push(name + ' — threw: ' + e.message); continue; }
  if (ok) passed++; else failures.push(name);
}

if (failures.length) {
  console.error('wafer proof FAILED (' + failures.length + ' of ' + checks.length + '):\n- '
    + failures.join('\n- '));
  process.exit(1);
}
console.log('wafer proof PASS — ' + passed + ' checks');
export default { status: 'PASS', checks: passed };
