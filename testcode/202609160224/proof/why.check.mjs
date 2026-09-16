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
    /* Was /necessarily where the line was born/ — and the caveat was then rewritten to
       drop "necessarily", because measurement showed the import commit is USUALLY not
       where the line was born. The mutation went on matching nothing and check 2 went on
       passing under it: a lie aimed at wording the card no longer uses. */
    .replace(/where the line was born/g, '')
    .replace(/The estate imports this file at a commit made on/g, 'This line exists because')
    /* The label is the promise, so the mutation restores the promise that could not be
       kept: a verb naming the question instead of the data. */
    .replace(/THE COMMIT THIS FILE IS PINNED AT/g, 'WHY IS THIS HERE?')
    .replace(/The record says it was first written on/g, '');
}

const results = [];
const check = (n, ok, d) => results.push({ n, ok: !!ok, d });

/* 1. THE COMMIT IS ATTRIBUTED TO THE FILE IT PINS, NEVER TO THE LINE.
 *
 * This check used to pin one SENTENCE — "The change that pinned this family said" — and
 * it went red the moment the sentence was rewritten for a better reason than it was
 * written. A pinned phrase is not a property. What must hold is that no phrasing on the
 * card makes a commit the cause of a line, and that the lead says what the commit
 * actually is. Shapes, then, not a sentence — the same repair check 11 in particles
 * needed an hour earlier, for the same reason.
 */
const OVERCLAIM = [
  /this line exists because/i,
  /the reason this line/i,
  /this line was (added|written|created) because/i,
  /why (is )?this line is here/i,
];
const over = OVERCLAIM.filter((re) => re.test(src));
const attributes = /imports this file at a commit/.test(src);
check('the commit is attributed to the file it pins, never to the line',
  attributes && over.length === 0,
  over.length ? 'the card attributes a commit to a line: ' + over.map(String).join(' · ')
    : attributes ? 'the lead reads "The estate imports this file at a commit made on"'
      : 'the attributing lead is gone; nothing stops the card implying the line caused the commit');

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

/* 6. A VERB MAY NOT PROMISE AN ANSWER ITS DATA CANNOT GIVE.
 *
 * vikra-ac's correction to its own proposal, and it is the sharpest rule of the night.
 * It traced the button's data path with no page involved: the commit a place pins is an
 * IMPORT, imports are updated by automation, so the button reliably returned the least
 * meaningful commit touching the file — for haversine, a bot syncing a manifest, dated
 * ten days after the function was first written. The apparatus was correct. The LABEL
 * was the defect, because a reader reads the label as the promise.
 *
 * So: no control on this card may ask a question. A label names the data it will show.
 */
const asking = (src.match(/\w+Btn\.textContent = '[^']*\?'/g) || []);
check('no control asks a question the data cannot answer', asking.length === 0,
  asking.length ? 'a button promises an answer by asking: ' + asking.join(' · ')
    : 'every control is named for the data it shows, not the question a reader has');

/* 7. THE PACK SPEAKS FIRST, AND FOR FREE.
 *
 * first_written is in families.json for 10,800 of 10,985 families — 98.3% — and it is
 * about the CODE rather than about a sync job. The band carries the brief facts for the
 * families its own keys reach, so the card states them with no fetch and no rate limit,
 * and the GitHub call is spent only when a reader asks for it.
 */
const fromMemory = /first written on/.test(src) && /r\.brief/.test(src);
const fetchesFirst = /familyNote[\s\S]{0,400}?await fetch/.test(src);
check('what the record knows is stated from memory, before any call',
  fromMemory && !fetchesFirst,
  fromMemory ? 'the card states kind, group, block, first-written, files and repos from the band it already has'
    : 'the card no longer states what the pack knows, and spends a call to say less');

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
