/* why.check.mjs — the WHY card may not outlive its own caveats.
 *
 * The card now shows the commit message for the commit a family's place pins. It is the
 * one artifact in this estate already written for a human, and it is also the easiest
 * thing here to over-read: a commit describes a CHANGE, and the card is attached to a
 * LINE. Every mechanism that went wrong tonight went wrong the same way — trusted past
 * its domain — and the only thing standing between this one and that is four sentences
 * of caveat that a later edit could delete without any test noticing.
 *
 * So the caveats are load-bearing and this holds them. It checks the SOURCE, not the
 * network: running it must never spend from GitHub's 60-an-hour unauthenticated budget,
 * because a proof that consumes the resource it is protecting is its own defect.
 *
 * WHAT IT CANNOT DO, and the chair states it rather than implying otherwise: this has
 * never been run in a browser. The chair has none — the Chrome extension is not
 * connected and puppeteer-core is absent, which is exactly the six kind-A failures in
 * _board/PROOF-FAILURES.md. The API call was verified with curl and the button was not.
 * vikra-ac has CDP and the browser verification is owed.
 *
 * Run:  node proof/why.check.mjs
 *       node proof/why.check.mjs --mutate
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const MUTATE = process.argv.includes('--mutate');

/* STRIP COMMENTS FIRST, AND THE CHAIR HAD TO LEARN THIS TWICE IN TWO HOURS.
   siblings.check.mjs counted a constant as READ because the comment describing its bug
   mentioned it. This file then failed its own honest run by finding the forbidden phrase
   "this line exists because" inside THE COMMENT THAT FORBIDS IT. Same defect, new file,
   within the hour, by the seat that had just written the fix. A check must read the code,
   not the prose about the code — including its own. */
const stripComments = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(new RegExp('(^|[^:])//[^' + String.fromCharCode(10) + ']*', 'g'), '$1 ');

let src = stripComments(fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8'));
if (MUTATE) {
  /* The lie: strip the caveats and promote the claim, which is exactly the edit a
     later hand would make to "tidy" the card. */
  src = src
    .replace(/A commit describes a CHANGE, not a line/g, '')
    /* 'not ' + 'necessarily where the line was born' — the card concatenates two string
       literals, so the phrase never appears contiguously in the source. The first lie
       targeted the joined sentence a reader sees and matched nothing, and the mutation
       reported 1-of-2 biting while claiming 2. Target what is written, not what is read. */
    .replace(/necessarily where the line was born/g, '')
    .replace(/The change that pinned this family said/g, 'This line exists because');
}

const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });

/* 1. The label must attribute the message to the CHANGE, never to the line. */
const attributes = /The change that pinned this family said/.test(src);
const overclaims = /this line exists because/i.test(src);
check('the card attributes the message to the change, not the line',
  attributes && !overclaims,
  overclaims ? 'the card says "this line exists because" — a commit covers everything in it, not one line'
    : attributes ? 'reads "The change that pinned this family said"'
      : 'the attributing phrase is gone; nothing stops the card implying the line caused the commit');

/* 2. The provenance caveat: this is where the estate IMPORTS from. */
check('the card says the commit may not be where the line was born',
  /where the line was born/.test(src),
  /where the line was born/.test(src)
    ? 'the import-versus-origin limit is stated on the card'
    : 'missing — a reader would take the pinned commit for the line\'s origin');

/* 3. The budget caveat, and the refusal. A blank is indistinguishable from "no message
      was written"; the difference has to be said. */
const statesRefusal = /this is a refusal, not an absence of a message/i.test(src);
check('a spent budget is stated as a refusal, not a blank', statesRefusal,
  statesRefusal ? 'exhausted budget reports a refusal in words'
    : 'missing — a rate-limited card would look like a commit with no message');

/* 4. On demand, not on open. One call per card against 60 an hour means the reader
      spends it deliberately; an automatic fetch would exhaust the budget browsing. */
const onDemand = /whyBtn|WHY IS THIS HERE/.test(src);
const auto = /whyOf\([^)]*\)\s*;\s*$/m.test(src) && !onDemand;
check('the commit is fetched on demand, not on open', onDemand && !auto,
  onDemand ? 'a button the reader presses; one call per card, cached by sha'
    : 'no button found — if this fetches on open, 60 cards exhausts the hour');

/* 5. The check itself must not spend the budget it protects. */
const network = /fetch\(|api\.github\.com/.test(
  stripComments(fs.readFileSync(path.join(HERE, 'why.check.mjs'), 'utf8')).replace(/'[^']*'/g, "''"));
check('this proof makes no network call', !network,
  network ? 'this file would spend from the budget it exists to protect'
    : 'source-only; running it costs nothing from GitHub\'s 60 an hour');

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.n + '\n        ' + r.d);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: the caveats are stripped and the claim promoted — 1, 2 must fail)' : ''));
console.log('NOT CHECKED HERE: that the button works in a browser. The chair has none.');
console.log('END OF REPORT - ' + results.length + ' checks');
process.exit(MUTATE ? 0 : failed ? 1 : 0);
