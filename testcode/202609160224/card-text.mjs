/* card-text.mjs — every sentence the card can say about a line, as a pure function.
 *
 * WHY THIS FILE EXISTS, and it is the board's one structural gap answered as far as it
 * can be answered from here.
 *
 * vikra-ac, 06:47Z, charter rule 23: an assertion about the words a reader gets must be
 * made against what the page RENDERS, never against the module that composes them. Its
 * argument is the night's record in one sentence — a surface drew nothing while passing
 * 6/6; two surfaces rendered the same picture while each passed 12/12; a card denied a
 * family the pack records; a control was built, deployed, correct in source, and had
 * never appeared to a visitor. The proofs were green throughout, and every one of those
 * was found by eyes.
 *
 * THE CATEGORY IT NAMES: source contains text that never reaches a reader, and omits text
 * a reader sees, because sentences are COMPOSED AT RUN TIME FROM DATA. Grepping a module
 * for what it will say is guessing. particles check 12 proved it from the other side —
 * its first run extracted 28 fragments of comment prose, because an apostrophe in a
 * comment opens a string literal.
 *
 * A full answer needs a browser. The chair has none — measured this cycle, not inherited:
 * tabs_context_mcp returns "Browser extension is not connected". So this closes the half
 * that can be closed without one. The composition moves OUT of the page and becomes a
 * pure function of the pack's own bytes, so a proof can run the REAL sentences over the
 * REAL estate, in both load states, and compare every family claim against
 * all-lines.family.bin.
 *
 * WHAT THIS STILL CANNOT SEE, stated rather than implied: whether the element is
 * appended, whether it is visible, whether CSS hides it, whether the card re-renders when
 * the band lands. Every one of those failed tonight and every one needs eyes. This is a
 * floor under the prose, not a substitute for a press.
 */
import { NATURE_NAME, NOISE } from './derive.mjs';

/* The subheader's family clause — three states, never two. `r` is falsy in TWO
   situations (the line is in no family, and the band has not loaded) and this said the
   first in both until vikra-ac found it on the published page: key 192,067 is haversine's
   first line, in_a_family = 1 in the very pack the card names, and the card read "in no
   function family" while its own next sentence read "Reading this band." */
export function familyClause({ inFamily, r }) {
  if (inFamily) return r ? ' · family ' + r.family + ' ' + r.name : ' · in a family — reading which';
  return ' · in no function family';
}

/* The plain-English box. Pure in its arguments: the page passes what it has read, and a
   proof passes what the pack holds. */
export function plainEnglish({ len, nat, inFamily, r, meta }) {
  const nm = NATURE_NAME[nat];
  /* FOURTH SITE OF THE SAME DEFECT, and the only one no reader reported — found by
     widening the DETECTOR, not the fix. nature() returns NOISE on LENGTH ALONE, three
     characters or fewer, so a closing brace inside a function is dust AND in a family.
     Measured against the pack: 36 of the estate's 80 dust lines are in a family — 45% of
     every line this sentence spoke to. It told them "belongs to no function" while the
     very next sentence, currency, correctly guarded, told the same reader "still part of
     a named function". Key 2 is one of the 36, at the centre of the wafer. */
  const what = nat === NOISE
    ? 'This line holds ' + len + ' characters, too few to carry a statement, so the wafer draws it as ' + NATURE_NAME[NOISE] +
      (inFamily
        ? ' — dark, and carried by a named function all the same: dust is where a function opens and closes, not only where it has nothing.'
        : ' — present, dark, and not yet part of anything.') +
      ' Dust is not waste here: it is the material stars form from, and a universe that hid its dust would be lying about its own mass.'
    : r
      ? 'This line is ' + nm + ' code inside the function ' + r.name +
        ', which the numbered database records at ' + r.place[2].split('/').pop() + ' line ' + r.line + '.'
      /* Same three states as the header. The second branch said "no function family
         claims it" whenever the band had not loaded — asserting about the estate what was
         only true of this page's downloads so far. inFamily settles it with no fetch. */
      : inFamily
        ? 'This line is ' + nm + ' code holding ' + len + ' characters. A function family ' +
          'does carry it in this build; which one, and the file it sits in, arrive when ' +
          'this band finishes loading.'
        : 'This line is ' + nm + ' code holding ' + len + ' characters. No function family claims it, so the estate records no file for it — one of the ' +
          (meta.lines - meta.in_a_family).toLocaleString() + ' lines in that position.';
  /* Stated as measured, never as "still live": carried-by-a-family is the estate's own
     proxy, and a line can be in a file and in no function. No expiry, no warning colour,
     no threshold: the decay is 0.15% a day, so any threshold would be arbitrary and would
     train a reader to ignore it. Report it and let them decide. */
  const currency = inFamily
    ? ' As of this build it is still part of a named function.'
    : ' In this build it is part of no named function — which is not the same as not being in a file.';
  const rad = r
    ? (r.also
      ? ' RADIATION: it is used in ' + (r.also + 1).toLocaleString() +
        ' places across the estate, so changing it here changes one copy of ' +
        (r.also + 1).toLocaleString() + '.'
      : ' RADIATION: the estate records exactly one use of it.')
    /* Third state here too. This branch made the pack's claim for it on r alone, so it
       read "the pack knows only that no family claims it" for a line the pack says IS in
       a family. The guard check found the other two sites and not this one, because its
       pattern was written from the two phrasings already in hand. */
    : inFamily
      ? ' RADIATION: how many places carry it arrives with this band. The pack states only that a family does carry it.'
      : ' RADIATION: unknown until this band loads — the pack records no family for it, and that is the whole of what it knows.';
  /* Same length-alone trap: dust a family carries relates to that family, so it takes the
     ordinary branch. */
  const rel = nat === NOISE && !inFamily
    ? ' RELATIONAL FIELD: none yet. Dust relates to nothing so far — that is a state, not a verdict, and it is where new stars come from.'
    : ' RELATIONAL FIELD: the ten lines above and ten below, shown here' +
      (r ? ', and the computation ' + r.name + ' that carries it' : '') + '.';
  return what + currency + rad + rel;
}
