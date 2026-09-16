/* laws.check.mjs — a law may only run on facts the page actually has.
 *
 * Vikram asked for twenty variations. A variation is a LAW over the same estate, and
 * testcode/202609151413/physics.mjs already holds ten of them. The temptation is to
 * ship all ten and call it ten variations. Three of them read facts this page has no
 * source for, and JavaScript will not stop you: hand a law `undefined` and the
 * arithmetic still runs, a picture still appears, and it is a plausible lie.
 *
 * That is the failure this estate spent the night cataloguing, one level up. So this
 * proof asserts that the classification is real, derived from the laws' own source,
 * and that a refused law is refused BY NAME rather than quietly run on zeros.
 *
 * Run:  node proof/laws.check.mjs
 *       node proof/laws.check.mjs --mutate
 */
import fs from 'node:fs';
import path from 'node:path';
import { requirementsOf, catalogue, classify, ALL, FROM_PACK, FROM_BAND, ABSENT, READY, ON_BAND, REFUSED }
  from '../laws.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const PHYSICS = path.resolve(SURF, '..', '202609151413', 'physics.mjs');
const MUTATE = process.argv.includes('--mutate');

const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });

const src = fs.readFileSync(PHYSICS, 'utf8');
const reqs = requirementsOf(src);
const cat = catalogue(reqs);
const tier = (t) => cat.filter((c) => c.tier === t);

/* 1. The requirements are PARSED FROM THE LAWS, not restated. A hand-written table
      would drift from physics.mjs the first time a law changed, and nothing would
      say so — the same reason the header count reads NATURE_NAME[NOISE] rather than
      typing "dust" a second time. */
const waferNeeds = reqs.wafer || [];
check('requirements are read from physics.mjs, not retyped',
  waferNeeds.length === 1 && waferNeeds[0] === 'key' && Object.keys(reqs).length >= 10,
  Object.keys(reqs).length + ' laws parsed · wafer needs [' + waferNeeds.join(', ') + ']');

/* 2. Every fact a law asks for is classified somewhere. An unclassified field would
      fall through as available and be handed undefined at runtime. */
const known = new Set([...FROM_PACK, ...FROM_BAND, ...ABSENT]);
const unclassified = [...new Set(Object.values(reqs).flat())].filter((f) => !known.has(f));
check('every fact a law reads is classified', unclassified.length === 0,
  unclassified.length ? 'UNCLASSIFIED: ' + unclassified.join(', ') +
    ' — these would be handed undefined and drawn anyway'
    : [...known].length + ' facts classified across ' + Object.keys(reqs).length + ' laws');

/* 3. A law needing an absent fact is REFUSED, and names what it wants. */
const refused = tier(REFUSED);
const unnamed = refused.filter((c) => !c.missing.length);
check('every refused law names the fact it lacks', refused.length > 0 && unnamed.length === 0,
  refused.map((c) => c.id + ' needs ' + c.missing.join(', ')).join(' · ') || 'nothing refused');

/* 4. No refused law is silently runnable. This is the assertion that stops twenty
      variations being twenty plausible lies. */
const leaked = refused.filter((c) => classify(c.needs).tier !== REFUSED);
check('no refused law can be run', leaked.length === 0,
  leaked.length ? 'LEAK: ' + leaked.map((c) => c.id).join(', ') :
    refused.length + ' refused and unrunnable: ' + refused.map((c) => c.id).join(', '));

/* 5. The honest count, stated rather than rounded up to ten. */
const honest = tier(READY).length + tier(ON_BAND).length;
check('the honest law count is stated',
  MUTATE ? honest === ALL.length : honest === 8 && ALL.length === 11,
  honest + ' honest of ' + ALL.length + ' — ready: ' + tier(READY).map((c) => c.id).join(', ') +
  ' · on-band: ' + tier(ON_BAND).map((c) => c.id).join(', '));

/* 6. An ON_BAND law is correct only where a band has loaded, so the page must not
      present it as covering the whole estate. Recorded here so the claim is explicit
      rather than something a reader has to infer from the tier name. */
check('on-band laws are marked as partial, not whole-estate',
  tier(ON_BAND).every((c) => c.banded.length > 0),
  tier(ON_BAND).map((c) => c.id + ' via ' + c.banded.join('+')).join(' · '));

/* 7. Every law is a pure function of what it reads: same entity, same point. */
const e = { key: 4242, chars: 60, inFamily: 1, family: 7, fanout: 3, ageDays: 10, famCount: 5, cat: 1, catCount: 4 };
const impure = ALL.filter((l) => {
  const a = l.place(e), b = l.place(e);
  return !(Number.isFinite(a[0]) && a[0] === b[0] && a[1] === b[1]);
});
check('every law is a pure function of its entity', impure.length === 0,
  impure.length ? 'impure or non-finite: ' + impure.map((l) => l.id).join(', ')
    : ALL.length + ' laws give the same point twice for the same entity');

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.n + '\n        ' + r.d);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: check 5 must fail — it asserts ten honest laws where there are eight)' : ''));
process.exit(MUTATE ? 0 : failed ? 1 : 0);
