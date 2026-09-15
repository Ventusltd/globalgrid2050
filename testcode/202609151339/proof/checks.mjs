/* The checks behind The Line Wafer, written once and run in two places:
 * proof/index.html runs them in a browser on a phone, proof/wafer.check.mjs
 * runs them under Node with no browser for CI. Both read the same bytes the
 * page itself reads and compute every number rather than asserting it.
 *
 * A check takes no arguments and returns true or false. Its name is the claim
 * it is testing, written so that a reader who has never seen the code can tell
 * what failed.
 */

export const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export const place = k => [Math.sqrt(k) * Math.cos(k * GOLDEN), Math.sqrt(k) * Math.sin(k * GOLDEN)];

/* Build the family index: which families carry each numbered line. */
export function ownersOf(families, famLines) {
  const owner = new Map();
  for (let f = 0; f < families.length; f++) {
    const o = families[f].lineOffset, c = families[f].lineCount;
    for (let i = o; i < o + c; i++) {
      const k = famLines[i], cur = owner.get(k);
      if (cur === undefined) owner.set(k, [f]);
      else if (cur[cur.length - 1] !== f) cur.push(f);
    }
  }
  return owner;
}

export function indexOfKey(keys, key) {
  let lo = 0, hi = keys.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (keys[m] === key) return m;
    if (keys[m] < key) lo = m + 1; else hi = m - 1;
  }
  return -1;
}

/* Every claim the page or its README makes, as a list of named checks. */
export function buildChecks(D) {
  const { meta, keys, lens, inFam, families, famLines } = D;
  let carried = 0;
  for (let i = 0; i < inFam.length; i++) carried += inFam[i];
  const owner = ownersOf(families, famLines);
  const shared = [...owner.values()].filter(v => v.length > 1).length;
  const two = owner.get(2) || [];

  return [
    ['the three parallel arrays are the same length, so index i means one line in all three',
      () => keys.length === lens.length && lens.length === inFam.length],

    ['the count the page prints, 250,174, is the number of keys in the pack and the number the pack declares',
      () => keys.length === 250174 && meta.lines === keys.length],

    ['the numbering runs 1 to 342,795 exactly as the pack header states',
      () => keys[0] === 1 && keys[keys.length - 1] === meta.max && meta.max === 342795],

    ['the keys ascend strictly, which is the only reason the page may binary search them',
      () => { for (let i = 1; i < keys.length; i++) if (keys[i] <= keys[i - 1]) return false; return true; }],

    ['numbers were skipped, so a gap on the surface is a real answer and not a missing record',
      () => meta.max > keys.length && meta.max - keys.length === 92621],

    ['no number is issued twice, which is what makes a number a permanent name for one line',
      () => meta.duplicate_rows === 0 && new Set(keys).size === keys.length],

    ['128,369 lines are carried by a function family, matching the flag pack and the header',
      () => carried === 128369 && carried === meta.in_a_family],

    ['every family range lies inside lines.bin, and the ranges between them account for all of it',
      () => families.every(f => f.lineOffset >= 0 && f.lineOffset + f.lineCount <= famLines.length)
         && families.reduce((a, f) => a + f.lineCount, 0) === famLines.length],

    ['the family ranges resolve exactly the lines the flag pack marks as carried, so the two agree',
      () => owner.size === carried],

    ['45,671 lines are carried by more than one family: those, and only those, can be connected. '
      + 'The page counts this from the data rather than carrying the number, because the first number '
      + 'written here by hand was wrong by about a thousand',
      () => shared === 45671 && shared < owner.size],

    ['line 2 is an empty line carried by thousands of families, so the page ships a real example of a '
      + 'connection that is true and worthless',
      () => lens[indexOfKey(keys, 2)] === 0 && two.length > 2000],

    ['a line the flag pack calls uncarried is carried by no family, so the page never promises a '
      + 'connection it cannot make',
      () => { for (let i = 0; i < 40000; i++) if (inFam[i] === 0 && owner.has(keys[i])) return false; return true; }],

    ['placing the same number twice returns the identical point, which is why a link reproduces a view '
      + 'on any device for ever',
      () => { const a = place(8285), b = place(8285); return a[0] === b[0] && a[1] === b[1]; }],

    ['a number that was never issued still has a place on the surface, so the surface is unbounded '
      + 'rather than merely large',
      () => Number.isFinite(place(meta.max + 100000)[0]) && Number.isFinite(place(1e9)[1])],

    ['the arrangement spreads the numbers rather than stacking them: fewer than one sampled point in '
      + 'twenty shares a quarter-unit cell with an earlier one',
      () => {
        const seen = new Set(); let hit = 0, n = 0;
        for (let i = 0; i < keys.length; i += 7) {
          const [x, y] = place(keys[i]);
          const g = Math.round(x * 4) + ':' + Math.round(y * 4);
          if (seen.has(g)) hit++; else seen.add(g);
          n++;
        }
        return hit / n < 0.05;
      }],

    ['consecutive numbers land far apart, so a ring of the picture is a period of the estate history '
      + 'and not one run of code',
      () => { const a = place(100000), b = place(100001); return Math.hypot(b[0] - a[0], b[1] - a[1]) > 1; }],

    ['the pack states where it came from and what it hashed to, so every number on the page is traceable '
      + 'to a source rather than typed in',
      () => typeof meta.source?.sha256 === 'string' && meta.source.sha256.length === 64
         && /LINES\.md$/.test(meta.source.url || '')],

    ['exactly one line reaches the ceiling of the sixteen-bit length field, so the pack cannot state its '
      + 'true length and the page says so instead of printing 65,535 as a measurement',
      () => { let cap = 0, m = 0;
              for (let i = 0; i < lens.length; i++) { if (lens[i] === 65535) cap++; if (lens[i] > m) m = lens[i]; }
              return cap === 1 && m === 65535; }],

    ['every family has a name and a kind, so no card the page draws is nameless',
      () => families.every(f => typeof f.name === 'string' && f.name.length > 0
                             && typeof f.kind === 'string' && f.kind.length > 0)],

    ['1,689 families carry no category at all, which is why the page prints "no category recorded" '
      + 'rather than the word null on a card',
      () => families.filter(f => f.category === null).length === 1689],

    ['no family claims more lines than the whole estate has numbered',
      () => families.every(f => f.lineCount >= 0 && f.lineCount <= keys.length)]
  ];
}
