/* The checks behind The Line Wafer, written once and run in two places:
 * proof/index.html runs them in a browser on a phone, proof/wafer.check.mjs
 * runs them under Node with no browser for CI. Both read the same bytes the
 * page itself reads and compute every number rather than asserting it.
 *
 * A check takes no arguments and returns true or false. Its name is the claim
 * it is testing, written so that a reader who has never seen the code can tell
 * what failed.
 */

/* These are the page's own functions, not copies of them. The first version of
   this file reimplemented the logic it was meant to be checking, so a check
   could pass while the page was wrong. It imports from lib.mjs now. */
import { GOLDEN, place, ownersOf, indexOfKey, parseKey, connectAnswer, fanoutCount, esc } from '../lib.mjs';
export { GOLDEN, place, ownersOf, indexOfKey, parseKey, connectAnswer, fanoutCount, esc };

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

    ['the family ranges resolve exactly the same LINES the flag pack marks as carried - every row is '
      + 'checked, not merely the same total, because two different sets can share one size',
      () => { if (owner.size !== carried) return false;
              for (let i = 0; i < keys.length; i++) {
                const has = owner.has(keys[i]) ? 1 : 0;
                if (has !== inFam[i]) return false;
              } return true; }],

    ['every family offset and count is a non-negative integer and the ranges tile lines.bin exactly '
      + 'once, end to end, with no gap and no overlap',
      () => { const sorted = [...families].sort((a, b) => a.lineOffset - b.lineOffset);
              let at = 0;
              for (const f of sorted) {
                if (!Number.isInteger(f.lineOffset) || !Number.isInteger(f.lineCount)) return false;
                if (f.lineOffset < 0 || f.lineCount < 0) return false;
                if (f.lineOffset !== at) return false;
                at += f.lineCount;
              }
              return at === famLines.length; }],

    ['45,671 lines are carried by more than one family: those, and only those, can be connected. '
      + 'The page counts this from the data rather than carrying the number, because the first number '
      + 'written here by hand was wrong by about a thousand',
      () => shared === 45671 && shared < owner.size],

    ['line 2 is an empty line carried by thousands of families, so the page ships a real example of a '
      + 'connection that is true and worthless',
      () => lens[indexOfKey(keys, 2)] === 0 && two.length > 2000],

    ['CONNECT, the rule this page exists to meet: two DIFFERENT lines that share one single family join '
      + 'through it. The page first claimed a line in only one family had nothing to join to. That was '
      + 'wrong, and this fixture is the proof it was wrong',
      () => { const a = connectAnswer(3, 4, { keys, owner });
              return a.verdict === 'joined' && a.both.length >= 1
                && (owner.get(3) || []).length === 1 && (owner.get(4) || []).length === 1; }],

    ['CONNECT: two lines whose families do not overlap are refused rather than joined',
      () => { let x = -1, y = -1;
              for (let i = 0; i < keys.length && y < 0; i++) {
                const o = owner.get(keys[i]);
                if (!o || o.length !== 1) continue;
                if (x < 0) { x = keys[i]; continue; }
                if (!owner.get(x).includes(o[0])) y = keys[i];
              }
              if (x < 0 || y < 0) return false;
              return connectAnswer(x, y, { keys, owner }).verdict === 'disjoint'; }],

    ['CONNECT: a number that was never issued is refused and named, rather than silently drawn',
      () => { let gap = -1;
              for (let k = meta.max; k > meta.max - 5000 && gap < 0; k--) if (indexOfKey(keys, k) < 0) gap = k;
              if (gap < 0) return false;
              const a = connectAnswer(3, gap, { keys, owner });
              return a.verdict === 'absent' && a.absent.includes(gap); }],

    ['CONNECT: a line no family carries is refused and named as the one without a family',
      () => { let k = -1;
              for (let i = 0; i < keys.length; i++) if (inFam[i] === 0) { k = keys[i]; break; }
              if (k < 0) return false;
              const a = connectAnswer(3, k, { keys, owner });
              return a.verdict === 'no-family' && a.without.includes(k); }],

    ['CONNECT: joining a line to itself is answered explicitly rather than reported as a discovery',
      () => connectAnswer(3, 3, { keys, owner }).verdict === 'same-line'],

    ['FANOUT and CO-MEMBERSHIP are different relations and the page keeps them apart: fanout is one '
      + 'number in several families, co-membership is two numbers in one family, and a line with no '
      + 'fanout is still connectable',
      () => fanoutCount(owner) === shared && shared < owner.size
         && (owner.get(3) || []).length === 1
         && connectAnswer(3, 4, { keys, owner }).verdict === 'joined'],

    ['a line the flag pack calls uncarried is carried by no family - every one of the 250,174 rows is '
      + 'checked, not the first forty thousand',
      () => { for (let i = 0; i < keys.length; i++) if (inFam[i] === 0 && owner.has(keys[i])) return false; return true; }],

    ['the number parser refuses what parseInt would have accepted: trailing letters, a number too large '
      + 'to hold exactly, zero, a negative and empty text; and it accepts a number typed with separators',
      () => !parseKey('12abc').ok && !parseKey('9007199254740993').ok && !parseKey('0').ok
         && !parseKey('-5').ok && !parseKey('').ok && !parseKey(' 1e5 ').ok
         && parseKey(' 8,285 ').ok && parseKey(' 8,285 ').key === 8285],

    ['dataset text is escaped before it reaches the page, because a code catalogue may legitimately '
      + 'contain markup characters in a function name',
      () => esc('<img src=x onerror=1>') === '&lt;img src=x onerror=1&gt;'
         && esc('a&b') === 'a&amp;b'
         && !esc('<b>').includes('<')],

    ['placing the same number twice in this process returns the identical point. That is determinism of '
      + 'the function, not a measurement of every device: it is double arithmetic, and the claim beyond '
      + 'this process is an argument rather than a test',
      () => { const a = place(8285), b = place(8285); return a[0] === b[0] && a[1] === b[1]; }],

    ['a number beyond those issued still has a finite place, and beyond the safe integer range the '
      + 'parser refuses rather than the arithmetic quietly losing precision',
      () => Number.isFinite(place(meta.max + 100000)[0]) && Number.isFinite(place(1e9)[1])
         && !parseKey(String(Number.MAX_SAFE_INTEGER + 2)).ok],

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
