/* THE WRITTEN FORM — one line a person and a model both write.
 *
 * WHY. Everything the estate shipped tonight flows outward. A non-coder can
 * point at a line, read it, see what carries it, gather some lines and name the
 * set. The set then exists as a URL and nowhere else: it cannot go in a commit
 * message, be quoted in a stone, be grepped, be diffed, or be written by a model
 * that has no browser. The estate can be READ by a non-coder and it cannot HEAR
 * one.
 *
 * A vocabulary is not a language until it has a notation that survives outside
 * its editor. This is that notation:
 *
 *     ventus:set/04f1205b6eee "how far apart" 2,1416,192067,192068,192069
 *
 * THE THREE PARTS, AND ONLY ONE OF THEM IS AN IDENTITY.
 *   id       SHA-256 of the members, sorted ascending and comma-joined, first
 *            twelve hex characters. DERIVED, so it cannot drift from what it
 *            names, and reproducible anywhere:
 *              printf '2,1416,192067,192068,192069' | sha256sum
 *   label    free text. A COMMENT. It carries no authority and nothing may key
 *            on it, index by it, resolve through it or deduplicate on it.
 *   members  permanent line keys. They resolve for ever, and under any placement
 *            law, because a key's identity was never its coordinate.
 *
 * THE LABEL RULE IS NOT ADVICE, IT IS TESTED. Five times in one night this
 * estate mistook a name for an identity: the family `state` acquired 369
 * impossible callers; stemming invented wells named after fragments of
 * repositories nobody wrote; the token `string` sent a CRM stylesheet to the
 * solar topology engine; six generated law names collided with laws computing
 * different arithmetic; and a declared storage quota of 100,000,000,000 bytes
 * was read as measured mass. Designing a notation after writing that rule and
 * then keying on its name would be indefensible. So the proof asserts BOTH
 * halves directly: changing the label must NOT invalidate a line, and changing
 * one member MUST.
 *
 * EVERY LINE IS VERIFIED, NOT MERELY VERIFIABLE. A hand-edited line lies, and it
 * lies in the worst place — a commit message, a stone, an issue — where it reads
 * as authoritative and nobody has the site open to check it. Verification costs
 * one hash, so parse() refuses a line whose id does not match its members rather
 * than offering a check the caller may skip.
 *
 * WHAT IT DOES NOT VERIFY, said plainly because a check that does not name its
 * domain is the defect this estate spent a night cataloguing. A verified line is
 * INTACT: its id matches its members, and nobody has edited it in transit. It is
 * not TRUE: nothing here says those keys were ever issued, that they sit
 * together in any file, that the set means anything, or that the label describes
 * it. Resolving members to code needs LINES.md and the reader. An id that checks
 * out is a claim that arrived unaltered, not a claim that is right.
 */

const PREFIX = 'ventus:set/';
const LINE = /^ventus:set\/([0-9a-f]{12})\s+"([^"]*)"\s+([0-9][0-9,\s]*)$/;

/* Sorted ascending, comma-joined: the one arrangement everyone agrees on, so
   two people who chose the same lines in different orders produce one id. */
export const canonical = keys => [...new Set(keys.map(Number))].sort((a, b) => a - b).join(',');

export async function idOf(keys) {
  const s = canonical(keys);
  if (!s) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

/* The line. Members are written in the order the maker chose, because order is
   the one thing about a set its maker decided; only the hash sorts. */
export async function format({ label = '', keys = [] } = {}) {
  const members = [...keys].map(Number).filter(Number.isInteger);
  if (!members.length) throw new Error('a set with no members has nothing to name');
  const id = await idOf(members);
  const clean = String(label).replace(/["\r\n]/g, ' ').trim();
  return `${PREFIX}${id} "${clean}" ${members.join(',')}`;
}

/* Parse and VERIFY. Returns { ok: true, id, label, keys } or { ok: false, why }.
   There is no unverified path: a caller cannot obtain the members of a line
   whose id does not match them. */
export async function parse(line) {
  const text = String(line ?? '').trim();
  const m = LINE.exec(text);
  if (!m) return { ok: false, why: `not a set line — expected ${PREFIX}<12 hex> "<label>" <keys>` };
  const [, id, label, rawKeys] = m;
  const keys = rawKeys.split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0);
  if (!keys.length) return { ok: false, why: 'no usable line numbers in the members' };
  const expect = await idOf(keys);
  if (expect !== id) {
    return { ok: false, id, expect, keys,
      why: `this line has been altered: its members hash to ${expect}, and it claims ${id}. ` +
           `The members or the id were edited after it was written, so nothing in it can be trusted. ` +
           `Check for yourself:  printf '${canonical(keys)}' | sha256sum` };
  }
  return { ok: true, id, label, keys,
    note: 'intact, not true: the id matches the members, which says the line arrived unaltered. ' +
          'It says nothing about whether those keys exist, sit together, or mean what the label claims.' };
}

/* For a receiver — an intake reading commit messages, stones or issues. Keyed by
   HASH. The label is carried along and never looked at, which is the rule made
   structural rather than remembered. */
export async function collect(text) {
  const byId = new Map();
  const refused = [];
  for (const raw of String(text ?? '').split('\n')) {
    if (!raw.includes(PREFIX)) continue;
    const at = raw.indexOf(PREFIX);
    const r = await parse(raw.slice(at));
    if (r.ok) {
      /* Same members under two labels is ONE proposal wearing two coats. The
         first label seen is kept only so a human has something to read; it is
         not part of the key and a different label never makes a new entry. */
      if (!byId.has(r.id)) byId.set(r.id, { id: r.id, keys: r.keys, labels: [] });
      byId.get(r.id).labels.push(r.label);
    } else refused.push({ line: raw.trim().slice(0, 80), why: r.why });
  }
  return { sets: [...byId.values()], refused };
}
