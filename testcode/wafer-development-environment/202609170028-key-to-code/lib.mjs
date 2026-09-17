/* lib.mjs — the logic of The Line Wafer, with no DOM and no fetch.
 *
 * WHY IT IS A SEPARATE FILE. The first version of this page kept its logic
 * inside app.mjs and its checks in a second file that reimplemented the same
 * ideas. A reviewer pointed out the obvious consequence: the checks were
 * proving a copy, not the page. Everything a claim is made about now lives
 * here, and both the page and the proofs import it, so a check that passes is
 * a check on the code that ships.
 */

export const GOLDEN = Math.PI * (3 - Math.sqrt(5));   /* the golden angle, 2.39996… rad */
export const SPACING = 1.0;

/* The addressing scheme. A number's place on the surface is a pure function of
   the number, so the same key is the same point on every device. A number that
   was never issued still has a place: that is what makes the surface unbounded
   rather than merely large. */
export function place(key) {
  const r = SPACING * Math.sqrt(key), t = key * GOLDEN;
  return [r * Math.cos(t), r * Math.sin(t)];
}

export function placeAll(keys) {
  const n = keys.length, p = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const k = keys[i], r = SPACING * Math.sqrt(k), t = k * GOLDEN;
    p[i * 2] = r * Math.cos(t);
    p[i * 2 + 1] = r * Math.sin(t);
  }
  return p;
}

/* One strict parser for every number that enters this page, from a form field
   or from the URL. parseInt would accept "12abc" as 12 and would silently
   truncate a number too large to be exact, landing the beam on a different
   line than the one that was typed. */
export const MAX_SAFE_KEY = Number.MAX_SAFE_INTEGER;
export function parseKey(raw) {
  if (typeof raw !== 'string') raw = String(raw ?? '');
  const s = raw.trim().replace(/[ ,_]/g, '');
  if (!/^[0-9]+$/.test(s)) return { ok: false, why: 'a line number is digits only' };
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return { ok: false, why: 'that number is too large to be held exactly' };
  if (n < 1) return { ok: false, why: 'the numbering starts at 1' };
  return { ok: true, key: n };
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

/* Which families carry each numbered line. */
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

/* TWO RELATIONS, AND THEY ARE NOT THE SAME RELATION.
 *
 * FANOUT is one line number appearing in several families. The same text sits
 * in several places. That is duplication.
 *
 * CO-MEMBERSHIP is two different line numbers appearing in the same family.
 * They are two different lines of one function. That is not duplication and it
 * is emphatically not the same text; it is neighbourhood.
 *
 * The page's first version confused them, and claimed that a line carried by
 * only one family had nothing to join to. That was wrong: two lines each
 * carried by the same single family join through it perfectly well, and the
 * page could be shown doing it. Both relations are answered here, separately,
 * and named separately wherever they are printed.
 */
export function fanoutCount(owner) {
  let n = 0;
  for (const v of owner.values()) if (v.length > 1) n++;
  return n;
}

/* The whole answer to "connect a to b", with no DOM and no wording, so the
   proofs can assert on the decision rather than on a sentence. */
export function connectAnswer(a, b, { keys, owner }) {
  const absent = [];
  if (indexOfKey(keys, a) < 0) absent.push(a);
  if (b !== a && indexOfKey(keys, b) < 0) absent.push(b);
  if (absent.length) return { verdict: 'absent', absent, both: [] };
  if (a === b) return { verdict: 'same-line', absent: [], both: owner.get(a) || [] };
  const A = owner.get(a) || [], B = owner.get(b) || [];
  if (!A.length || !B.length) {
    return { verdict: 'no-family', absent: [], both: [],
             without: [...(A.length ? [] : [a]), ...(B.length ? [] : [b])], A, B };
  }
  const setB = new Set(B);
  const both = A.filter(f => setB.has(f));
  return { verdict: both.length ? 'joined' : 'disjoint', absent: [], both, A, B };
}

/* Dataset text is data. A function family is named by whatever was in the
   source, and a code catalogue can legitimately contain < and &. Everything
   that reaches the page goes through here or through textContent. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const fmt = n => Number(n).toLocaleString('en-GB');
