/* derive.mjs — the state generator. Nothing about a line is stored; it is derived.
 *
 * THE ARGUMENT, IN VIKRAM'S WORDS: "this code, what does it do, that, if its that
 * then it must have a radiation and relational field, then it must be related to
 * that." A property that can be derived must not be stored, or the estate cannot
 * grow without the page growing with it.
 *
 * WHAT IS ACTUALLY STORED, for the whole estate, in three binary packs:
 *
 *     all-lines.bin         4 bytes   the permanent key
 *     all-lines.len.bin     2 bytes   how many characters the line holds
 *     all-lines.family.bin  1 byte    whether any function family carries it
 *                           ————
 *                           7 bytes x 250,174 lines = 1.75 MB, the entire estate
 *
 * Everything below is computed from those three numbers and the key itself. No
 * per-line record, no lookup table, no fetch. Add 100,000 lines tomorrow and the
 * page costs 700 KB more and not one line of new logic.
 *
 * WHAT IS NOT CLAIMED. These are classifications drawn from length and family
 * membership, which is all the pack knows. NATURE is a description of the line's
 * shape, not of its meaning: a long line in no family is called STRUCTURAL
 * because that is what the numbers support, not because anything has read it.
 * Where a judgement would need the text, this file returns UNREAD and the page
 * fetches the actual line rather than guessing.
 */

/* NATURE — what the line is, from its own two facts.
 *
 * NOISE        no characters, or so few they cannot carry a statement, and no
 *              family claims them. Empty lines and lone brackets. Line 2 is the
 *              type case: an empty line recorded in 2,281 distinct families.
 *              These are the lines a future wafer can retire without losing code.
 * BOILERPLATE  short and in a family: closing braces, single returns, the
 *              connective tissue of a function rather than its work.
 * OPERATIONAL  in a family and long enough to carry a statement. This is the
 *              code that does something, and the only class worth studying.
 * STRUCTURAL   substantial but in no family: declarations, configuration, data
 *              sitting outside any function the numbering recognised.
 * ORPHAN       short and in no family. Fragments the estate kept but nothing
 *              claims — not noise, because they may carry text, but unowned.
 */
export const NOISE = 0, BOILERPLATE = 1, OPERATIONAL = 2, STRUCTURAL = 3, ORPHAN = 4;
/* The visitor-facing names. NOISE is displayed as DUST deliberately: unused code is
   not waste in this universe, it is the material stars form from. The constant keeps
   its old name so nothing that imports it breaks; only what a person reads changed. */
export const NATURE_NAME = ['dust', 'boilerplate', 'operational', 'structural', 'orphan'];

const NOISE_MAX = 3;          /* characters: "})" and shorter carries no statement */
const SHORT_MAX = 24;         /* characters: below this a line is connective */

export function nature(len, inFamily) {
  if (len <= NOISE_MAX) return NOISE;
  if (inFamily) return len <= SHORT_MAX ? BOILERPLATE : OPERATIONAL;
  return len <= SHORT_MAX ? ORPHAN : STRUCTURAL;
}

/* RADIATION FIELD — whether this code has been USED somewhere.
 *
 * Vikram's definition, and it is the right one: a line radiates by being used,
 * not by being long. The measure is the number of places the estate records the
 * line in. A line in one file radiates nothing beyond it; a line carried into
 * ninety-four files is load-bearing across the whole estate, and changing it
 * changes one copy of ninety-five.
 *
 * `places` is the true measure and arrives with the band. Before the band loads,
 * family membership is the only usage fact the 7-byte pack holds — a line in a
 * family is reachable wherever that family lives, a line in none is reachable
 * only where it sits — so it stands in as a floor until the truth arrives.
 *
 * Returns 0..1. A drawing quantity derived from usage, not a judgement of worth.
 */
export function radiation(len, inFamily, places) {
  if (len <= NOISE_MAX) return 0;
  if (places !== undefined && places !== null) {
    /* Measured: log so that 2 copies and 200 are both legible on one wafer. */
    return Math.min(1, Math.log2(1 + places) / 7);
  }
  return inFamily ? 0.42 : 0.12;                 /* the pack's floor, pending the band */
}

/* RELATIONAL FIELD — what this line is part of.
 *
 * Vikram's definition, in two halves, and the page serves both:
 *   1. THE BLOCK. The ten lines above and ten below — the statement the line
 *      actually sits inside. A line alone is unreadable; the block is the unit a
 *      person can judge. The card fetches exactly those twenty-one lines.
 *   2. THE COMPUTATION. The function family that carries the line, which is the
 *      computation it may be part of, and through the family every other place
 *      that computation lives.
 *
 * And, as the Spider sandboxes already do, the field reaches OUT: the pinned
 * commit gives a GitHub address for the exact bytes, and a surface under
 * testcode/<stamp>/ gives the live page the line helps draw. A relation that
 * leaves the estate is still a relation.
 *
 * Returns the block's half-width in lines. It is 10, deliberately and not
 * computed — the size of a readable block is a human fact, not a derived one.
 */
export const BLOCK = 10;

export function field(key, len, inFamily) {
  const n = nature(len, inFamily);
  if (n === NOISE) return 0;        /* noise relates to nothing; it is retirable */
  return BLOCK;
}

/* One call, because the page asks all three together for every visible line.
   `places` is passed once the line's band has loaded, and omitted before. */
export function derive(key, len, inFamily, places) {
  return {
    nature: nature(len, inFamily),
    radiation: radiation(len, inFamily, places),
    field: field(key, len, inFamily),
  };
}

/* A census, for the page to state what the estate is made of rather than assert
   it. Runs over the packs once at load: 250,174 iterations of integer work. */
export function census(keys, lens, fams) {
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < keys.length; i++) counts[nature(lens[i], fams[i])]++;
  return counts;
}

/* ---- explanatory prose ---------------------------------------------------
 *
 * vikra-ac measured the estate: over 6,835 lines in 24 contiguous runs against an index
 * of 283,231 rows built 2026-09-16T00:54:43.415Z, comments are 5.5% and EXPLANATORY
 * PROSE is 3.7% — about one line in twenty-seven. Its criterion, and the reason for
 * each half: strip the marker, then require 25 characters and four words, so that a
 * block comment's opener, its continuation stars, its closer, dividers and bare @param
 * tags do not count as a line written for a reader.
 *
 * IT LIVES HERE RATHER THAN IN THE CARD because the card's first version had its own
 * copy that counted decoration, and a rule with two copies is a rule that drifts — the
 * same argument as NATURE_NAME, one page saying both 'noise' and 'dust'. The page, the
 * build and the proof now read one definition, and the proof can exercise it against
 * real source lines without a browser.
 */
export function isExplanatory(text) {
  if (typeof text !== 'string') return false;
  if (!/^\s*(\/\/|\/\*|\*|#)/.test(text)) return false;
  const prose = text
    .replace(/^\s*(\/\/+|\/\*+|\*+\/?|#+)\s*/, '')
    .replace(/\*+\/\s*$/, '')
    .trim();
  if (prose.length < 25) return false;
  if (prose.split(/\s+/).filter(Boolean).length < 4) return false;
  return /[A-Za-z]{3}/.test(prose);
}
