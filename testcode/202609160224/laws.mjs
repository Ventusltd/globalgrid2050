/* laws.mjs — which placement laws the Wafer Galaxy can honestly run, and why not the rest.
 *
 * REUSED, NOT REINVENTED. testcode/202609151413/physics.mjs already defines ten laws as
 * pure functions with a declared shape — {id, title, borrows, reads, note, place(e)} — and
 * states the rule they all obey: "A position is a pure function of the entity's own
 * permanent key and of published facts about it." This file imports them. Writing an
 * eleventh copy of the golden angle would be the estate's own disease.
 *
 * THE PROBLEM THIS FILE EXISTS TO SOLVE. A law reads fields off an entity. The Wafer
 * Galaxy draws all 250,174 numbered lines from three binary packs — 7 bytes a line — so
 * it can supply `key`, `chars` and `inFamily` and nothing else until a resolution band
 * loads. Hand a law a field the page does not have and JavaScript hands it `undefined`:
 * the arithmetic still runs, a picture still appears, and it is a plausible lie.
 *
 * That is exactly the failure this estate spent the night cataloguing — a check, or here
 * a law, that describes only what it looks at. So every law is classified against what
 * the page can actually supply, and a law whose inputs are absent is REFUSED BY NAME
 * rather than run on zeros. Vikram asked for twenty variations; eight honest ones and a
 * stated reason for the other three is the better answer, and the reason is the useful part.
 *
 * WHAT THE PAGE CAN SUPPLY, and where each fact comes from:
 *
 *   PACK   key        all-lines.bin          4 bytes   the permanent number
 *          chars      all-lines.len.bin      2 bytes   characters in the line
 *          inFamily   all-lines.family.bin   1 byte    does any family carry it
 *
 *   BAND   family     p/<n>.json                       the family that carries it
 *          fanout     p/<n>.json                       how many places it is used in
 *          (present only for the radial bands the camera has actually loaded)
 *
 *   ABSENT ageDays    when the line was first written — the pack carries no date
 *          famCount   how many families exist in its neighbourhood
 *          cat        a category for the line
 *          catCount   how many categories exist
 *
 * The ABSENT four are not unobtainable in principle — the modular star knows some of
 * them — they are simply not in anything this page reads. If a future pack carries them,
 * move the name from ABSENT to PACK and the law becomes runnable with no other change.
 */

import { LAWS, byId, GOLDEN_ANGLE } from '../202609151413/physics.mjs';

export const FROM_PACK = ['key', 'chars', 'inFamily'];
export const FROM_BAND = ['family', 'fanout'];
export const ABSENT = ['ageDays', 'famCount', 'cat', 'catCount'];

/* Read each law's real requirements out of physics.mjs rather than restating them here.
   A second copy of a fact is a second thing that can drift — the same reason the header
   count now reads NATURE_NAME[NOISE] instead of typing "dust" twice. The proof checks
   this parse against the source it parsed. */
export function requirementsOf(source) {
  const out = {};
  const ids = [...source.matchAll(/export const (\w+) = \{/g)]
    .map((m) => m[1]).filter((i) => i !== 'LAWS' && i !== 'byId');
  for (const id of ids) {
    const start = source.indexOf('export const ' + id + ' = {');
    const next = source.indexOf('export const', start + 10);
    const block = source.slice(start, next > 0 ? next : source.length);
    out[id] = [...new Set([...block.matchAll(/e\.([a-zA-Z_]\w*)/g)].map((m) => m[1]))].sort();
  }
  return out;
}

/* Three tiers, and the page must treat them differently:
   READY     drawable the moment the packs land, for every one of the 250,174 lines.
   ON_BAND   correct only where a band has loaded; elsewhere the fact is unknown, so
             the page must draw those lines by the fallback law rather than invent a
             position for them.
   REFUSED   an input the page has no source for. Never drawn, named in the UI. */
export const READY = 'ready', ON_BAND = 'on-band', REFUSED = 'refused';

export function classify(needs) {
  const missing = needs.filter((f) => ABSENT.includes(f));
  if (missing.length) return { tier: REFUSED, missing };
  const banded = needs.filter((f) => FROM_BAND.includes(f));
  if (banded.length) return { tier: ON_BAND, missing: [], banded };
  return { tier: READY, missing: [], banded: [] };
}

/* CORE is this surface's own law and is declared in the same shape as the ten, so it is
   classified by the same rule rather than exempted from it. Vikram: "the code which is
   most used must go towards the centre as that is the CORE, the densest part of the
   star." It reads fanout, so it is ON_BAND by the same test that bands `collapse`. */
export const core = {
  id: 'core',
  title: 'Core',
  borrows: 'gravitational collapse — the densest material falls to the middle',
  reads: 'how many places the line is used in',
  note:
    'Radius is usage: r = R_MAX x (1 - radiation) plus a shell offset from the key, so '
    + 'the most-copied code lands at the centre and dust sits at the rim, drawn rather '
    + 'than hidden. Usage changes as bands load and as the estate grows, so a radius '
    + 'here is not a permanent address. The key is, under every law.',
  place: (e) => {
    const R_MAX = 585.5, CORE_BAND = 22;
    const shell = (((e.key * 2654435761) >>> 0) % 1000) / 1000 * CORE_BAND;
    const rad = e.fanout === undefined ? 0 : Math.min(1, Math.log2(1 + e.fanout) / 7);
    const r = R_MAX * (1 - rad) + shell, t = e.key * GOLDEN_ANGLE;
    return [r * Math.cos(t), r * Math.sin(t)];
  },
};

export const ALL = [...LAWS, core];
export const index = { ...byId, core };

/* The catalogue the page and the generator both read: every law, its tier, and — when it
   is refused — exactly which fact is missing. A refusal that does not name what it wants
   is indistinguishable from a bug. */
export function catalogue(requirements) {
  return ALL.map((law) => {
    const needs = requirements[law.id] || (law.id === 'core' ? ['fanout', 'key'] : []);
    const c = classify(needs);
    return {
      id: law.id, title: law.title, borrows: law.borrows, reads: law.reads,
      needs, tier: c.tier, missing: c.missing, banded: c.banded || [],
    };
  });
}
