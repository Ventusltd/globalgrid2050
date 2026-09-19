// kuiper-weigh.mjs — join the measured copy count onto every station of kuiper-network.json.
//
// Law, printed with the run: one body per distinct blob SHA. The station's third element is that
// blob SHA and it is the key; the fourth element is `copies`, the number of tracked paths in the
// estate whose bytes hash to that SHA. `copies` is read from the estate run's own estate-bodies.json
// and joined on the blob SHA, never on position and never on order. A station whose SHA is not in
// the run gets no fourth element at all and stays base dust: no intensity is invented for it.
//
// Usage: node kuiper-weigh.mjs [<path to estate-bodies.json>] [<path to bodies.json>]
// Nothing outside this folder is written.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUN = process.argv[2] || 'C:/Users/vikra/Documents/GitHub/Kuiper-belt/data/20260919T001154Z/estate-bodies.json';
const SUM = process.argv[3] || path.join(path.dirname(RUN), 'bodies.json');
const NET = path.join(HERE, 'kuiper-network.json');

const bodies = JSON.parse(fs.readFileSync(RUN, 'utf8')).bodies;
const summary = JSON.parse(fs.readFileSync(SUM, 'utf8'));
const net = JSON.parse(fs.readFileSync(NET, 'utf8'));

const copiesOf = new Map();
for (const b of bodies) if (Number.isInteger(b.copies) && b.copies > 0) copiesOf.set(b.id, b.copies);

let joined = 0, unmeasured = 0, dup = 0, uniq = 0, paths = 0, maxCopies = 0, maxId = null;
const stations = net.stations.map(s => {
  const [x, y, id] = s;
  const c = copiesOf.get(id);
  if (c == null) { unmeasured++; return [x, y, id]; }           // base dust: nothing invented
  joined++; paths += c;
  if (c > 1) dup++; else uniq++;
  if (c > maxCopies) { maxCopies = c; maxId = id; }
  return [x, y, id, c];
});

const homes = new Set(bodies.map(b => b.home));

net.stations = stations;
net.law = net.law.replace(/; the station's fourth element[\s\S]*$/, '') +
  "; the station's fourth element is copies, the measured number of tracked paths whose bytes hash to that blob SHA, joined on the SHA and never on order; a station with no measured copy count carries no fourth element and stays base dust";
net.counts = {
  run: summary.run,
  bodies: stations.length,
  measured: joined,
  unmeasured,
  duplicated: dup,
  unique: uniq,
  tracked_paths: paths,
  repositories: summary.repositories,
  home_repositories: homes.size,
  max_copies: maxCopies,
  max_copies_id: maxId,
  source_file: path.basename(RUN),
  source_run_tracked_paths: summary.tracked_paths
};

const text = JSON.stringify(net);
fs.writeFileSync(NET, text);

const digest = crypto.createHash('sha256').update(text).digest('hex');
console.log('kuiper-network.json rewritten');
console.log('  bytes          ', text.length);
console.log('  sha256         ', digest);
console.log('  stations       ', stations.length);
console.log('  measured copies', joined, ' unmeasured (base dust):', unmeasured);
console.log('  duplicated     ', dup, ' unique:', uniq);
console.log('  tracked paths  ', paths, '(run summary says', summary.tracked_paths + ')');
console.log('  repositories   ', summary.repositories, ' distinct home repositories:', homes.size);
console.log('  max copies     ', maxCopies, 'at', maxId);
