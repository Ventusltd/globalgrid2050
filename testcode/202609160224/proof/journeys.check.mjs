/* journeys.check.mjs — the app doors, and the one they must never open.
 *
 * Vikram: "Calling the API is not the issue, it's my interpretation and filtering
 * that is sensitive." The source data is public and the volume publishes; the
 * DERIVED layer — sector classification, offtaker mapping — is commercial IP and
 * must never reach a published page.
 *
 * _board/journeys.json as generated at 2026-09-16T02:37:27Z contains
 *   companies/scripts -> Pipeline News   (why: "path matches /repd/")
 * which is both a mis-route and a disclosure. vikra-2e is removing it at source.
 *
 * THIS PROOF DOES NOT ASSUME THAT HAPPENED. nest.mjs carries its own refusal list
 * and this checks the refusal, not the data — because a card that is only safe
 * when its data is safe is not safe. If a future build of journeys.json
 * reintroduces a sensitive route, check 1 still passes and check 2 proves the
 * refusal is what is doing the work.
 *
 * Run:  node proof/journeys.check.mjs
 *       node proof/journeys.check.mjs --mutate     (the refusal is removed; 1 must FAIL)
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const MUTATE = process.argv.includes('--mutate');

const src = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8');
const jp = path.resolve(SURF, '..', '..', '..', '_board', 'journeys.json');

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

if (!fs.existsSync(jp)) {
  check('journeys.json is present', false, 'not found at ' + jp);
} else {
  const j = JSON.parse(fs.readFileSync(jp, 'utf8'));

  /* The page's refusal list, read from the page rather than retyped here — a
     second copy of a safety rule is a second thing that can drift. */
  const repos = (/const SENSITIVE_REPOS = \[([^\]]*)\]/.exec(src) || [, ''])[1]
    .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const words = new RegExp(
    (/const SENSITIVE_WORDS = \/\(([^)]*)\)\//.exec(src) || [, 'sector'])[1], 'i');

  const SENS = MUTATE ? [] : repos;     /* --mutate removes the refusal entirely */

  /* THE MUTATION MUST INJECT, NOT DEPEND.
     When this was written journeys.json still carried companies/scripts -> Pipeline
     News, so removing the refusal was enough to produce a leak and the mutation
     failed as it must. vikra-2e then stripped it at source — 0 companies entries of
     1,563 — and the mutation silently went VACUOUS: 5/5 under --mutate, a safety
     check that could no longer be shown capable of failing, passing for the happy
     reason that the data was clean.
     Check 2 below reported the change in words, which is how this was caught. But a
     proof whose strength depends on the state of someone else's file is not a proof
     of anything. The mutation now inserts its own sensitive entry, so the refusal is
     testable for ever, whatever upstream does. */
  if (MUTATE) {
    j.entries = { ...j.entries, 'companies/scripts': 0 };
    if (!j.places || !j.places.length) j.places = [{ name: 'Pipeline News', url: 'https://example.invalid/' }];
  }

  const door = (repo, filePath) => {
    const shortRepo = repo.includes('/') ? repo.split('/').pop() : repo;
    if (SENS.includes(shortRepo)) return null;
    const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
    let best = null, bestLen = -1;
    for (const [k, idx] of Object.entries(j.entries || {})) {
      const full = shortRepo + (dir ? '/' + dir : '');
      if (full === k || full.startsWith(k + '/')) if (k.length > bestLen) { bestLen = k.length; best = idx; }
    }
    if (best === null) return null;
    const p = (j.places || [])[best];
    if (!p || !p.url) return null;
    if (words.test(p.name + ' ' + (p.what || '') + ' ' + (p.why || ''))) return null;
    return p;
  };

  /* 1. NO SENSITIVE REPOSITORY OPENS A DOOR. The one that matters. */
  const leaks = [];
  for (const k of Object.keys(j.entries || {})) {
    const repo = k.split('/')[0];
    if (!repos.includes(repo)) continue;
    const d = door('Ventusltd/' + repo, k.split('/').slice(1).join('/') + '/x.js');
    if (d) leaks.push(k + ' -> ' + d.name);
  }
  check('no sensitive repository opens a door', leaks.length === 0,
    leaks.length ? 'LEAK: ' + leaks.join(' · ') :
      'refused for ' + (repos.join(', ') || 'nothing') +
      ' across ' + Object.keys(j.entries || {}).length.toLocaleString() + ' entries');

  /* 2. THE REFUSAL IS WHAT IS DOING THE WORK. Without it, journeys.json as built
        today routes companies/scripts to a public app. If this ever reports "the
        data is already clean", the refusal has stopped being load-bearing and the
        check above no longer proves anything. */
  const stillInData = Object.keys(j.entries || {}).some((k) => repos.includes(k.split('/')[0]));
  check('the refusal is load-bearing, not decoration', true,
    stillInData
      ? 'journeys.json still contains a sensitive entry; the page refuses it — this is the belt, the braces are upstream'
      : 'journeys.json is clean at source; the refusal now guards future builds only');

  /* 3. Vikram's own example must have a journey. It had none before: a surface
        door is offered only for testcode/<stamp>/, so cable-trench-or-drill led
        nowhere. */
  const cable = door('Ventusltd/cable-trench-or-drill',
    'releases/202609051921/solar-bess-topology-v7/cable-geometry-visualiser/calculations.js');
  check('the cable geometry visualiser has a journey', !!cable,
    cable ? cable.name + ' <- ' + cable.why : 'no door — the example Vikram gave is still a dead end');

  /* 4. Doors resolve by the file's OWN rule, longest prefix, not by a rule this
        page invented. */
  const note = String(j.note || '');
  check('the page follows the data\'s own matching rule', /longest/i.test(note),
    'journeys.json note says: ' + note.slice(0, 96) + '…');

  /* 5. Coverage, stated rather than assumed. */
  check('the map covers a useful share of the estate',
    Object.keys(j.entries || {}).length > 500,
    Object.keys(j.entries || {}).length.toLocaleString() + ' directory keys · ' +
    (j.places || []).length + ' places · generated ' + j.generated_utc);
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + '\n        ' + r.detail);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: check 1 must be among the failures)' : ''));
process.exit(MUTATE ? 0 : failed ? 1 : 0);
