/* particles.check.mjs — the checks the code wafer must pass.
 *
 * The wafer claims three things that are easy to assert and easy to get wrong:
 * that every band named in the head exists and holds what it says, that a key
 * resolves to the line the numbered database actually recorded, and that the
 * derived state is a pure function of the key. Each check below is a way for
 * those claims to be false.
 *
 * --mutate corrupts the head in memory and checks 1-3 must fail. Check 4 cannot
 * be falsified that way — a pure function is not made impure by a bad manifest —
 * and that is stated rather than papered over with an artificial mutation.
 *
 * Run:  node proof/particles.check.mjs
 *       node proof/particles.check.mjs --mutate
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { derive, nature, radiation, isExplanatory, NATURE_NAME, NOISE } from '../derive.mjs';
import { plainEnglish, familyClause } from '../card-text.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SURF = path.resolve(HERE, '..');
const PACK = path.resolve(SURF, '..', '202609142202', 'data');
const MUTATE = process.argv.includes('--mutate');

const head = JSON.parse(fs.readFileSync(path.join(SURF, 'particles.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(PACK, 'all-lines.meta.json'), 'utf8'));
const buckets = head.buckets.map(([b, n]) => [b, n]);

if (MUTATE) {
  buckets.push([999999, 7]);                 /* a band that does not exist   -> 1 */
  if (buckets[2]) buckets[2][1] += 5;        /* a band with a wrong count    -> 2 */
  /* This lie was wrong the first time it was written: it replaced a place with
     'Ventusltd/not-a-repo' and forty zeros, which IS well formed — a repository
     that does not exist is not a malformed place, and check 3 correctly passed.
     The check tests shape, so the lie must break shape: a truncated commit is
     what actually reaches a browser as a silent 404. */
  head.places[0] = ['Ventusltd/globalgrid2050', 'deadbeef', 'engine/geo-core.js'];  /* -> 3 */
}

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

/* THE CARD'S PROSE IS WHEREVER THE CARD'S PROSE IS.
 *
 * Extracting the sentences into card-text.mjs broke two checks that named nest.mjs, and
 * that is the lesson rather than the inconvenience: a check anchored to a FILE holds a
 * file, not the thing it claims to hold. One of them then reported "0 sentences" with the
 * hash of the empty string — it failed only because the pin disagreed, and a check that
 * can pass on nothing is one edit away from passing on nothing.
 *
 * So the prose is read from every file that composes it, and cardProse() FAILS LOUDLY if
 * a named file is missing rather than quietly returning less text to search. */
function cardProse() {
  const parts = ['nest.mjs', 'card-text.mjs'].map((f) => {
    const p = path.join(SURF, f);
    if (!fs.existsSync(p)) throw new Error('card prose file missing: ' + f);
    return fs.readFileSync(p, 'utf8');
  });
  return parts.join('\n/* --- file boundary --- */\n');
}

/* 1. Every band the head names exists on disk. */
const missing = buckets.filter(([b]) => !fs.existsSync(path.join(SURF, 'p', b + '.json'))).map(([b]) => b);
check('every band named in the head exists', missing.length === 0,
  missing.length ? 'absent: ' + missing.join(', ') : buckets.length + ' bands, all present');

/* 2. Every band holds exactly the number of keys the head promises, and its keys
      fall inside the band's own range. A band whose keys stray is a band the
      page will fetch for the wrong ring. */
let wrong = [];
for (const [b, n] of buckets) {
  const f = path.join(SURF, 'p', b + '.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (d.key.length !== n) { wrong.push(b + ' says ' + n + ' holds ' + d.key.length); continue; }
  const lo = b * head.span, hi = lo + head.span;
  if (d.key.some((k) => k < lo || k >= hi)) wrong.push(b + ' holds a key outside its range');
}
check('every band holds what the head promises', wrong.length === 0,
  wrong.length ? wrong.slice(0, 3).join(' · ') : buckets.length + ' bands agree with the head');

/* 3. A resolution points at a real repository and a full commit. The page builds
      a raw.githubusercontent URL from these; a malformed one fails silently in a
      browser, which is the worst way for it to fail. */
const badPlace = head.places.filter(
  ([repo, commit, p]) => !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[0-9a-f]{40}$/.test(commit) || !p
);
check('every place is a real repo and a full commit', badPlace.length === 0,
  badPlace.length ? badPlace.length + ' malformed, first: ' + JSON.stringify(badPlace[0]).slice(0, 90)
    : head.places.length + ' places, all well formed');

/* 4. The derived state is a pure function of the key. Same input, same output,
      and a key that has not been issued yet already has one. NOT covered by
      --mutate: corrupting a manifest cannot make a pure function impure. */
const a = derive(4242, 60, 1, 3), b2 = derive(4242, 60, 1, 3);
const future = derive(meta.max + 100000, 60, 1);
check('derived state is pure and unbounded',
  a.nature === b2.nature && a.radiation === b2.radiation && a.field === b2.field &&
  Number.isFinite(future.radiation),
  'key 4242 -> ' + NATURE_NAME[a.nature] + ', radiation ' + a.radiation.toFixed(3) +
  ' ; unissued key ' + (meta.max + 100000) + ' already derives ' + NATURE_NAME[future.nature]);

/* 5. Radiation means "has this code been used somewhere" — so a line used in more
      places must radiate more, and noise must radiate nothing at all. */
check('radiation rises with use, and noise radiates nothing',
  radiation(60, 1, 2) < radiation(60, 1, 90) && radiation(2, 0) === 0 && nature(2, 0) === NOISE,
  '2 places ' + radiation(60, 1, 2).toFixed(3) + ' < 90 places ' + radiation(60, 1, 90).toFixed(3) +
  ' ; a 2-character line in no family is ' + NATURE_NAME[nature(2, 0)] + ' at radiation 0');

/* 6. The particle count matches the pack's own in_a_family. If these disagree the
      wafer is resolving lines the numbering does not think are resolvable. */
check('particles equal the pack\'s in_a_family', head.particles === meta.in_a_family,
  head.particles.toLocaleString() + ' particles vs pack in_a_family ' +
  meta.in_a_family.toLocaleString() + ' (pack built ' + meta.built_utc + ')');

/* 7. THE RASTER REACHES THE CANVAS.
 *
 * This file passed 6/6 honest and 3/6 mutated on a surface that drew NOTHING.
 * Every check above describes the data; none asked whether a pixel ever reached
 * the canvas. The pixel path wrote 250,174 particles into an ImageData buffer
 * and never blitted it, so the page was black at its default zoom while its own
 * counters reported every particle on screen — and it rendered correctly at
 * dpr 2, so it worked on a phone and failed on a desktop.
 *
 * Node has no canvas, so this cannot count pixels the way vikra-ac did in a
 * browser. It checks the invariant that actually broke instead: the default zoom
 * takes the pixel path, and the pixel path must end in a blit, positioned after
 * the buffer is written and before anything is composited over it.
 */
{
  const src = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8');
  const sizeAt = (zoom, dpr) => Math.max(1, 1.1 * dpr * Math.min(zoom, 2.4));
  const defaultIsPixelPath = sizeAt(1, 1) <= 1.5;

  const iWrite = src.lastIndexOf('buf32[o] =');
  const iBlit = MUTATE ? -1 : src.indexOf('putImageData');

  /* The blit overwrites rather than composites, so it must never run in a frame
     that also draws labels. Rather than guess that from where the calls sit in
     the file — the first version of this check did, and got the comparison
     backwards — assert the numeric invariant: at every zoom where labels are
     drawn, the pixel path must be off. LOD_NAMES is 8 in nest.mjs. */
  const LOD_NAMES = 8;
  let overlap = null;
  for (let z = LOD_NAMES; z <= 600; z += 0.5) {
    for (const dpr of [1, 2]) {
      if (sizeAt(z, dpr) <= 1.5) { overlap = 'zoom ' + z + ' dpr ' + dpr; break; }
    }
    if (overlap) break;
  }

  const ok = defaultIsPixelPath && iWrite >= 0 && iBlit > iWrite && overlap === null;
  check('the pixel path ends in a blit, and the default zoom uses it', ok,
    'default zoom size ' + sizeAt(1, 1).toFixed(2) + ' -> pixel path ' + defaultIsPixelPath +
    ' ; buffer written at ' + iWrite + ' ; putImageData at ' + iBlit +
    (iBlit < 0 ? '  <-- NOTHING REACHES THE CANVAS' : '') +
    ' ; labels never co-occur with the pixel path: ' + (overlap === null ? 'yes' : 'NO at ' + overlap));
}

/* 8. NO LOOP COUNTER IS SHADOWED INSIDE ITS OWN BODY.
 *
 * cdbade4c rewrote the particle loop to `for (let c = 0; ...)` so the render proof
 * could drive it in reverse. The body already held `const c = COLOUR[nat[i]]`, which
 * put the counter in that const's temporal dead zone — so the FIRST iteration threw
 * ReferenceError and draw() never drew anything. `node --check` passes it: it is
 * valid syntax and a runtime error.
 *
 * The irony is the point and it is recorded rather than tidied away: the commit that
 * added a proof of the picture broke the picture. vikra-2e wrote the charter line an
 * hour earlier — "the instrumentation I added to make a safety property observable
 * briefly broke the thing it was observing" — and the chair then did it independently.
 * Observing a thing means touching it, and touching it is the hazard.
 *
 * This is a pattern check, not a parser, and says so. It catches the exact shape that
 * shipped: a `for (let X …)` whose body redeclares X.
 */
{
  const src = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8');
  const shadowed = [];
  const loop = /for\s*\(\s*let\s+([A-Za-z_$][\w$]*)\s*=/g;
  let m;
  while ((m = loop.exec(src)) !== null) {
    const name = m[1];
    /* the block this loop opens: from its `{` to the matching depth-0 `}` */
    const open = src.indexOf('{', loop.lastIndex);
    if (open < 0) continue;
    let depth = 0, end = open;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const body = src.slice(open, end);
    if (new RegExp('\\b(const|let)\\s+' + name + '\\b').test(body)) {
      shadowed.push(name + ' at offset ' + m.index);
    }
  }
  const injected = MUTATE ? ['c at offset 0 (injected by --mutate)'] : [];
  const all = shadowed.concat(injected);
  check('no loop counter is shadowed inside its own body', all.length === 0,
    all.length ? 'temporal dead zone, throws on the first iteration: ' + all.join(' · ')
      : 'checked every `for (let X …)` in nest.mjs; none redeclares its counter');
}

/* 9. A STARTING DOOR MUST NOT BE DUST.
 *
 * The first attempt at "where to begin" ranked every resolvable line by how many
 * places record it and crowned KEY 2 — 142,863 places — which is the EMPTY LINE.
 * derive.mjs calls it dust; 1339's README said it plainly months ago: "the most-
 * shared line in the estate is line 2, an empty line". Technically the most-used
 * line in the estate, and the worst possible first click for the exact audience the
 * title names.
 *
 * It also won two categories at once, offering the visitor the same door twice.
 *
 * So: every door must resolve, must carry a statement rather than be dust, and must
 * be distinct. The threshold is derive.mjs's own SHORT_MAX, not one invented here.
 */
{
  const notable = head.notable || [];
  const packDir = path.resolve(SURF, '..', '202609142202', 'data');
  let lenOf = null;
  try {
    const kb = fs.readFileSync(path.join(packDir, 'all-lines.bin'));
    const lb = fs.readFileSync(path.join(packDir, 'all-lines.len.bin'));
    const ka = new Uint32Array(kb.buffer, kb.byteOffset, kb.byteLength / 4);
    const la = new Uint16Array(lb.buffer, lb.byteOffset, lb.byteLength / 2);
    lenOf = new Map();
    for (let i = 0; i < ka.length; i++) lenOf.set(ka[i], la[i]);
  } catch { /* no pack: the length half of this check cannot run, and says so */ }

  const SHORT_MAX = 24;
  const injected = MUTATE ? [{ key: 2, name: '(dust)', why: 'injected by --mutate', places: 142863 }] : [];
  const doors = notable.concat(injected);
  const dust = lenOf ? doors.filter((n) => (lenOf.get(n.key) || 0) <= SHORT_MAX) : [];
  const dupes = doors.filter((n, i, a) => a.findIndex((m) => m.key === n.key) !== i);

  check('every starting door is a line that carries a statement',
    doors.length >= 3 && dust.length === 0 && dupes.length === 0,
    dust.length ? 'DUST offered as a door: ' + dust.map((n) => 'key ' + n.key).join(', ')
      : dupes.length ? 'the same door twice: key ' + dupes[0].key
        : doors.length + ' doors, all operational, all distinct' +
          (lenOf ? '' : ' (length pack absent — only distinctness was checked)'));
}

/* 10. A FAMILY CLAIM NAMES THE BUILD IT IS TRUE OF.
 *
 * vikra-ac measured two packs 23.3 hours apart and the chair reproduced it exactly:
 *
 *   of pack 202609142202's 250,174 keys, measured against 202609152203
 *     absent entirely ............ 0        the permanence promise, OBSERVED
 *     lost their family ........ 198        0.154% in 23.3 hours
 *     gained a family ........... 49
 *
 * Zero keys vanished. Not one of 250,174 — so a set, a notation line, a composition
 * and an annotation are all safe for ever in the only sense that matters.
 *
 * But 198 lines stopped being part of any function in a day, and NOTHING SAID SO. The
 * key still resolves, the text still reads, and the thing it described is gone. A
 * proposal from last month that is 95% live looks byte-identical to one made this
 * morning, and the one thing that changed is the only thing a non-coder cannot check.
 *
 * So a family claim must name its build. Stated as measured, never as "still live":
 * carried-by-a-family is the estate's own proxy and a line can be in a file and in no
 * function. And no expiry, no warning colour, no threshold — at 0.15% a day any
 * threshold is arbitrary and would train a reader to ignore it.
 */
{
  const src = cardProse()
    .replace(/\/\*[\s\S]*?\*\//g, ' ');          /* code, not the prose about it */
  const namesBuild = /in pack.*built_utc|built_utc.*in pack|' · in pack '/.test(src) ||
    /in pack/.test(src) && /built_utc/.test(src);
  const overclaims = /still live|currently live/i.test(src);
  const hedged = /not the same as not being in a file/.test(src);
  check('a family claim names the build it is true of',
    !MUTATE && namesBuild && !overclaims && hedged,
    overclaims ? 'the card says "still live" — carried-by-a-family is a proxy, not liveness'
      : !namesBuild ? 'a family claim with no build named; 198 lines lost their family in a day'
        : !hedged ? 'the card does not distinguish "in no function" from "not in a file"'
          : 'the card names the pack’s built_utc and says what carried-by-a-family is not');
}

/* 11. A FAMILY CLAIM MAY NOT BRANCH ON THE BAND.
 *
 * Sites branched on `r`, the resolved place, which needs p/N.json fetched. So `r` is
 * falsy in TWO situations — the line has no family, and the band has not loaded — and the
 * card said the first in both. On the published page, key 192,067 (haversine's first line,
 * in_a_family = 1 in the pack the card names) read "in no function family" while its own
 * next sentence read "Reading this band."
 *
 * fams[i] answers it with zero fetches and is in memory from startup. The rule: any
 * sentence asserting the ABSENCE of a family must be reached only through fams[i].
 *
 * WIDENED. The first version of this check found TWO of FOUR sites and reported green.
 * Its pattern held exactly the two phrasings the fix in hand had just touched — "no
 * function family" and "in no family" — so it read straight over " RADIATION: the pack
 * knows only that no family claims it" and over "belongs to no function" in the dust
 * branch. A check that finds two of four is worse than one that finds none, because it is
 * then trusted. vikra-ac found the third by reading the published card. The fourth was
 * found by widening THIS, and no reader had ever reported it.
 *
 * So the detector is a list of SHAPES rather than the sentences in hand, its guard window
 * is eight lines, and its mutation removes the GUARD rather than injecting a finding the
 * check never made. What it still cannot do is notice a shape nobody has thought of —
 * that is check 12's job, and the two are only honest together.
 *
 * It reads the source with comments stripped: the fourth time tonight that mattered,
 * after siblings, why, and the chair's own live grep, which returned 0 for a phrase the
 * source splits across two concatenated lines. Test what is written.
 */
{
  const raw = cardProse();
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  /* Shapes, not sentences. Each is a way of telling a reader that no family carries this
     line, and all of them must sit under fams[]. */
  const DENIAL = [
    /no function family/i,
    /in no family/i,
    /no famil\w* claims?/i,
    /records? no family/i,
    /no named function/i,
    /belongs to no function/i,
    /relates to nothing/i,
  ];
  /* THE MUTATION REMOVES THE GUARD — the defect this check exists for — rather than
     appending a finding the check never made. Every denial then stands unguarded, and all
     of them must be reported. */
  const scan = MUTATE
    ? code.split('fams[').join('FAMS_REMOVED(').split('inFamily').join('IN_FAMILY_REMOVED')
    : code;
  const lines = scan.split('\n');
  const denials = [];
  lines.forEach((l, i) => {
    if (!DENIAL.some((re) => re.test(l))) return;
    /* A GUARD, NOT A MENTION. The first window asked only whether `fams[` appeared in the
       eight lines above, and `const d = derive(key, len, fams[i]);` — a plain statement
       two lines up — answered yes for the dust denial. Retro-run against the shipped file
       it therefore reported ONE of the two live sites and would have been believed about
       the other. A guard is a fams[] read inside a conditional, so a line that completes
       a statement does not count as one. */
    /* THE SYMBOL, NOT THE SPELLING — and this cost a green run. The composition moved to
       card-text.mjs, where the pack's in-family byte arrives as the parameter `inFamily`
       rather than as `fams[i]`. The rule was unchanged and every guard was in place, and
       this check reported FIVE unguarded denials, because it held a NAME.
       And the second half was worse: the first version rejected any line ending in `;`,
       to keep `const d = derive(key, len, fams[i]);` from counting as a guard. That also
       rejects `if (inFamily) return ...;` — a real guard, in one line, which is how the
       subheader now reads. A completed statement is not a guard UNLESS it is a
       conditional. */
    const guarded = lines.slice(Math.max(0, i - 8), i + 1)
      .some((w) => /(fams\[|inFamily)/.test(w) && (/\bif\s*\(/.test(w) || !/;\s*$/.test(w)));
    if (!guarded) denials.push('line ' + (i + 1) + ' "' + l.trim().replace(/\s+/g, ' ').slice(0, 52) + '"');
  });
  check('no family denial is reached without consulting fams[]',
    denials.length === 0,
    denials.length
      ? denials.length + ' denial(s) not guarded by fams[]: ' + denials.slice(0, 4).join(' · ') +
        ' — these assert about the estate what is true of what has downloaded'
      : 'every denial shape sits under a fams[] guard · ' + DENIAL.length + ' shapes searched · ' +
        (code.match(/fams\[/g) || []).length + ' fams[] reads in the code');
}

/* 12. THE CARD'S PROSE IS THE PROSE A PERSON CLASSIFIED.
 *
 * Check 11 can only find shapes it has been told about, and three of the four defects it
 * was written for were phrasings nobody had anticipated. This one makes no judgement about
 * prose at all: it pins every sentence the card can say about a line and fails when the set
 * changes.
 *
 * BOUNDARY, stated rather than implied: it cannot tell a true sentence from a false one.
 * It guarantees only that no sentence reaches a reader without a person having re-read it
 * against the fams[] rule and re-pinned it. That is the whole claim.
 *
 * Its mutation adds a sentence — not an artificial failure, but exactly the event it
 * exists to catch.
 */
{
  const raw = cardProse();
  /* Comments FIRST, and this bit on the very first run: an apostrophe inside a comment
     ("true of this page's downloads") opens a string literal, and the extractor returned
     28 fragments of COMMENT PROSE as though they were the card's sentences. Pinning that
     would have pinned the wrong text and called it classified. The fifth time tonight a
     check read a comment as evidence. */
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  /* IT FOUND function english( AND EXTRACTED NOTHING — 0 sentences, the hash of the
     empty string. english() is now a four-line wrapper and the prose moved to
     card-text.mjs, so the region this searched was real and empty. It failed loudly only
     because the pin disagreed; had the pin ever been taken from an empty region it would
     have passed on nothing for ever, which is why lits.length > 0 is part of the verdict
     and not a comment. */
  const from = src.indexOf('export function plainEnglish(');
  const to = src.indexOf('\n}', from);
  const body = from >= 0 && to > from ? src.slice(from, to) : '';
  const lits = (body.match(/'(?:[^'\\]|\\.)*'/g) || [])
    .map((t) => t.slice(1, -1))
    .filter((t) => /[A-Za-z]{3}/.test(t) && /\s/.test(t));   /* prose, not property names */
  const SEP = String.fromCharCode(1);
  const joined = lits.join(SEP) + (MUTATE ? SEP + ' an added sentence' : '');
  const h = crypto.createHash('sha256').update(joined).digest('hex').slice(0, 16);
  const PINNED = '59758bd034b8a62b';
  check("the card's prose is the prose a person classified",
    h === PINNED && lits.length > 0,
    h === PINNED
      ? lits.length + ' sentences in english(), unchanged since classification · ' + h
      : 'english() prose changed: ' + h + ' is not the pinned ' + PINNED +
        ' — re-read each of the ' + lits.length + ' sentences against the fams[] rule, then re-pin');
}

/* 13. NO SURFACE DOOR MAY LEAD TO A 404.
 *
 * Vikram's rule, in his own words: never give the user a broken journey, leave no dead
 * ends, the universe is endless. The card offered "OPEN THE SURFACE" for any place whose
 * path matched testcode/<stamp>/, and four of the 68 stamps the places reach hold code
 * and no index.html — 9 places, 9 doors straight to a 404.
 *
 * The manifest had been classifying those correctly as fragments for hours, and the FRONT
 * DOOR was fixed for exactly this defect at 05:37Z. The card was not. Twice in one night,
 * the same shape: a page offering what a manifest it does not consult already knows is
 * unopenable.
 *
 * This check measures the doors the card can actually build, from the head it actually
 * ships, against the directories that actually exist. Its mutation makes one openable
 * stamp unopenable, which is the event: a surface loses its page and the card keeps
 * linking to it.
 */
{
  const head = JSON.parse(fs.readFileSync(path.join(SURF, 'particles.json'), 'utf8'));
  const stamps = [...new Set(head.places
    .map((p) => (/testcode\/(\d{10,14})\//.exec(p[2]) || [])[1])
    .filter(Boolean))];
  const openable = new Set(head.openable || []);
  if (MUTATE && head.openable && head.openable.length) openable.add('202609110242');
  /* A door is offered only for a stamp the head calls openable. So the failure is a
     stamp the head calls openable that has no index.html on disk. */
  /* WHAT THE CARD WOULD OFFER, not what this check would prefer. With no openable list
     in the head the card falls back to offering EVERY stamp — which is the shipped
     behaviour, and the retro-run has to say so rather than report a tidy zero. */
  const carries = Array.isArray(head.openable) && head.openable.length > 0;
  const offered = carries ? [...openable] : stamps;
  const broken = offered.filter((st) => !fs.existsSync(path.join(SURF, '..', st, 'index.html')));
  const unlisted = stamps.filter((st) => !offered.includes(st));
  check('every surface door the card can offer actually opens',
    broken.length === 0 && carries,
    broken.length
      ? broken.length + ' door(s) lead to a 404: ' + broken.slice(0, 4).join(', ') +
        (carries ? '' : ' — the head carries no openability, so the card offers every stamp it sees') +
        ' — a dead end, and the estate’s one rule against them'
      : carries
        ? offered.length + ' of ' + stamps.length + ' stamps open · ' +
          unlisted.length + ' named without a door (code, no page) · no door 404s'
        : 'the head carries no openability list, so the card cannot tell a page from a fragment');
}

/* 14. NO LABEL MAY CARRY A TYPED COUNT.
 *
 * This file already argues it, six lines above the pack loader: a label typed twice is a
 * label that drifts. It was written after derive.mjs renamed NOISE's display to 'dust'
 * and one page went on saying 'noise', so the same page said both.
 *
 * The law strip then typed the estate's size anyway — "ALL 250,174 LINES" — and it was
 * correct tonight and could not have known when it stopped being. It is the same defect
 * as the front door that claimed ninety-seven surfaces when there were 119, and the front
 * door was hand-typed twice before it was generated. A number a page cannot check is a
 * claim it cannot retract.
 *
 * So: no textContent may contain a grouped number. Measured values arrive through
 * toLocaleString() on something the page read.
 */
{
  const raw = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  /* The mutation RESTORES THE DEFECT rather than injecting a finding: the label goes back
     to the typed count it shipped with, and the check must report it. */
  const scan = MUTATE
    ? code.replace("textContent = 'ALL LINES'", "textContent = 'ALL 250,174 LINES'")
    : code;
  /* textContent AND title. Within an hour of this check going green, the chair typed
     3,130,777 and 1,736 into a row.title — a tooltip a reader reads exactly as they read
     a label, in the one property this check did not look at.
     "A rule that holds one property holds one property" was the chair's sentence, and
     vikra-ac corrected it to the sharper form: the widening took it from one property to
     two, and WHAT IT STILL HOLDS IS ONE SYNTAX. A double-quoted string, a template
     literal, setAttribute('title', …), an aria-label, or a bare 3130777 with no comma all
     sit outside this regex, and ONE of them is already in the file: nest.mjs:1279,
     setAttribute('aria-label', …). It carries no number today; the check cannot know that
     and would not notice the day one does.
     THIS COMMENT SAID "TWO" FOR TWENTY MINUTES. vikra-ac counted setAttribute and
     aria-label separately and added them — 2 + 1 = 3 — and they are the same two lines,
     of which nest.mjs:1323 is setAttribute('aria-current', 'page'), a STATE and not a
     label a reader reads. It corrected itself to one. The chair then repeated the wrong
     figure into a commit message and a stone WITHOUT OPENING THE FILE, while the line
     directly below printed `beyond` = 1 from the file itself. The number was right and
     the prose beside it was not, because the number came out of the source and the prose
     came out of a message.
     NOT WIDENED AGAIN, deliberately: the next widening buys the next spelling and no
     more. There is no regex that closes this — the closure is to read the rendered
     attribute from the page, because a reader gets a tooltip and a tooltip has one value
     however it was assigned. Rule 23 again, arriving from the inside for the third time.
     WHAT IS ADDED INSTEAD IS THE DENOMINATOR, which is the cheapest honest thing: report
     how many label assignments were EXAMINED against how many exist by any construct, so
     the gap is visible at a glance instead of silent. vikra-ac and Seat C converged on the
     same missing word twenty minutes apart — state the denominator of what you examined,
     not only of what you asserted about. */
  const all = (scan.match(/(textContent|title) = '[^']*\d{1,3},\d{3}[^']*'/g) || []);
  const examined = (scan.match(/(textContent|title)\s*=\s*'/g) || []).length;
  const beyond =
    (scan.match(/(textContent|title)\s*=\s*"/g) || []).length +
    (scan.match(/(textContent|title)\s*=\s*`/g) || []).length +
    (scan.match(/setAttribute\(\s*'(title|aria-label)'/g) || []).length;
  check('no label carries a typed count',
    all.length === 0,
    all.length
      ? all.length + ' typed count(s) in labels: ' + all.slice(0, 3).join(' · ') +
        ' — correct until the estate changes, and unable to know when it has'
      : examined + ' of ' + (examined + beyond) + ' literal label assignments examined · ' +
        beyond + ' beyond this syntax could hide a typed count and are not read here · ' +
        (code.match(/toLocaleString\(\)/g) || []).length + ' measured numbers rendered');
}

/* 15. THE BLOCK IS A JOURNEY, NOT A DESTINATION.
 *
 * vikra-ac, as a visitor: "there is no clickable neighbour in the card — the lines render
 * as div.cl inside pre.code with no handler I could find — so I cannot reach a second line
 * in an already-cached band from the card itself." The wafer was navigable and the block
 * it opened was a dead end: twenty-one lines of real source and no way out except back to
 * the dots. That is the one rule Vikram gave in his own words, failing one level below
 * where it had been checked.
 *
 * His rule also decides HOW: every particle clickable, and the ones that are not go DARK
 * rather than absent — use light as your guide. So this requires both halves. A block line
 * with a numbered key must light and carry a handler; one without must be marked dark and
 * say why. A page that only lit the reachable ones would be quietly hiding the estate's
 * edges, which is the same defect as excluding a fragment instead of classifying it.
 *
 * BOUNDARY: this reads source. It proves a handler is attached to a lit row and that both
 * classes are styled. IT CANNOT PROVE A CLICK NAVIGATES — every defect of that kind
 * tonight was found by a person pressing something, twice on this very control.
 */
{
  const raw = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const css = fs.readFileSync(path.join(SURF, 'style.css'), 'utf8');
  /* The mutation removes the handler, which is exactly the shipped defect: rows rendered,
     classes maybe present, and nothing to press. */
  /* A LITERAL, BECAUSE THE FIRST MUTATION HERE BIT NOTHING. It was a lazy regex meant to
     delete the handler and it matched nothing, so the check reported PASS under mutation
     and would have counted as a harness that proves something. The vacuity gate exists
     for exactly this and it is the sixth time tonight. */
  let missingRegion = false;
  const whole = MUTATE ? code.split("row.addEventListener('click'").join('row.noHandler(') : code;
  /* SCOPED TO THE BLOCK RENDERER, and the first version was not.
   *
   * It searched the WHOLE file for row.addEventListener('click'. renderNeighbourhood --
   * the numbered-neighbours fallback for a line with no file -- has carried exactly that
   * since long before this check existed, with its own comment: "Every neighbour is
   * itself a door." So the handler assertion was satisfied by a DIFFERENT RENDERER and
   * could never fail for the block.
   *
   * Retro-run against the pre-change file it still reported FAIL, on the three other
   * signals -- which is the trap: the verdict was right and one of its four reasons was
   * vacuous, and nothing in the output said so. vikra-ac found it sideways while
   * searching the served file for strings it had invented, and named the same failure in
   * itself in the same message: the right answer from the wrong evidence.
   *
   * Seventh instance tonight of a check describing only what it looks at, and the second
   * inside a check written to hold a fix for that very thing. */
  const from = whole.indexOf("pre.className = 'code'");
  const end = whole.indexOf('holder.append(pre)', from);
  const scan = from >= 0 && end > from ? whole.slice(from, end) : '';
  const lights = /row\.classList\.add\('live'\)/.test(scan);
  const opens = /row\.addEventListener\('click'/.test(scan);
  const darkens = /row\.classList\.add\('dark'\)/.test(scan);
  const styled = /\.cl\.live/.test(css) && /\.cl\.dark/.test(css);
  const counts = /numbered and open/.test(whole);
  if (from < 0 || end <= from) missingRegion = true;
  const missing = [];
  if (missingRegion) missing.push('the block renderer was not found — this check cannot see what it claims to hold');
  if (!lights) missing.push('no row is lit');
  if (!opens) missing.push('no row carries a click handler — the block is a dead end');
  if (!darkens) missing.push('unreachable rows are not marked dark');
  if (!styled) missing.push('style.css does not distinguish .cl.live from .cl.dark');
  if (!counts) missing.push('the card does not say how many of the block opens');
  check('a block line that is numbered opens, and one that is not goes dark',
    missing.length === 0,
    missing.length ? missing.join(' · ')
      : 'lit rows open their key · unreachable rows dim and say why · both styled · the count is stated');
}

/* 16. THE PROSE SENTENCE MUST NOT FIRE ON A DIVIDER.
 *
 * vikra-ac's second owed check, and its own note on how to run it: "the second needs no
 * browser at all if you assert it over the rendered text rather than the source." So this
 * exercises the card's ACTUAL PREDICATE against REAL LINES from the estate, rather than
 * asserting that some regex appears in nest.mjs.
 *
 * It can do that because the predicate now has ONE definition, in derive.mjs, imported by
 * the card and by this file. The card's first version had its own copy and counted a
 * block comment's opener, its continuation stars and its closer as explanation — it would
 * have told a reader "3 of these lines are written for you" and shown them a divider.
 *
 * The cases are hand-written and named, because the estate's own text is what they stand
 * for: decoration must be rejected however it is spelled, and a sentence a person could
 * read must be accepted.
 */
{
  const ACCEPT = [
    ' * MBR: actual datasheet values where confirmed; 15xOD otherwise (Utility standard).',
    ' * Verify against manufacturer datasheet before any design or procurement.',
    '// Model coefficients (single core, fitted to Utility/Manufacturer data)',
    ' * so the order is asserted by proofs/geodesy.proof.mjs rather than trusted.',
    '# set the limit before the loop runs, or the last row is dropped',
  ];
  const REJECT = [
    '/**', ' *', ' */', ' * ----------------', ' * @param n', '// TODO',
    '  const x = 1;', '', '  return null;', '  }',
  ];
  /* The mutation widens the predicate to "any comment marker", which is exactly the
     shipped defect, and the dividers must then be accepted. */
  const test = MUTATE
    ? (t) => typeof t === 'string' && /^\s*(\/\/|\/\*|\*|#)/.test(t)
    : isExplanatory;
  const missedProse = ACCEPT.filter((t) => !test(t));
  const tookDecoration = REJECT.filter((t) => test(t));
  check('the prose sentence fires on a sentence and never on a divider',
    missedProse.length === 0 && tookDecoration.length === 0,
    missedProse.length || tookDecoration.length
      ? (tookDecoration.length ? tookDecoration.length + ' decoration(s) counted as explanation: ' +
          tookDecoration.map((t) => JSON.stringify(t)).join(' ') + ' ' : '') +
        (missedProse.length ? missedProse.length + ' real sentence(s) missed' : '')
      : ACCEPT.length + ' sentences accepted · ' + REJECT.length + ' decorations rejected · ' +
        'one definition, in derive.mjs, read by the card and by this check');
}

/* 17. NO CARD MAY ASSERT A FAMILY FACT THE PACK CONTRADICTS.
 *
 * vikra-ac's sentence, charter rule 23, and the one it said "is trivially checkable that
 * way and was not checkable any other way — which is exactly why it took a press to find
 * it." It was right that the source-side form could not do it. Every check above reads
 * what the module SAYS it will say; this one runs the composition and reads the sentence.
 *
 * It became possible this cycle because the sentences moved out of the page into
 * card-text.mjs as pure functions. So: take real keys, real lengths and the real
 * in-family byte from all-lines.family.bin, compose the ACTUAL text a reader would get,
 * and assert against the pack's own bytes — in BOTH load states, because the defect that
 * reached a reader existed only in one of them. With the band resolved the card had
 * always been right; with the band still loading it denied a family the pack records.
 *
 * WHAT IT STILL CANNOT SEE, and the chair has no browser to close it — measured this
 * cycle rather than inherited, tabs_context_mcp returns "Browser extension is not
 * connected": whether the element is appended, whether it is visible, whether CSS hides
 * it, whether the card re-renders when the band lands. Every one of those failed tonight.
 * This is a floor under the prose, not a substitute for a press.
 */
{
  const famBytes = fs.readFileSync(path.join(PACK, 'all-lines.family.bin'));
  const lenBytes = fs.readFileSync(path.join(PACK, 'all-lines.len.bin'));
  const keyBytes = fs.readFileSync(path.join(PACK, 'all-lines.bin'));
  const n = famBytes.length;

  /* Shapes that DENY a family, and shapes that ASSERT one. Both directions, because a
     card that claimed a family for a line the pack calls unclaimed is the same defect
     wearing the other face, and nothing had ever looked for it. */
  const DENIES = [
    /no function family/i, /in no family/i, /no famil\w* claims?/i, /records? no family/i,
    /no named function/i, /belongs to no function/i, /relates to nothing/i,
  ];
  const ASSERTS = [
    /a function family\s+does carry it/i, /still part of a named function/i,
    /carried by a named function/i, /a family does carry it/i, /code inside the function/i,
  ];
  const band46 = JSON.parse(fs.readFileSync(path.join(SURF, 'p', '46.json'), 'utf8'));
  const head = JSON.parse(fs.readFileSync(path.join(SURF, 'particles.json'), 'utf8'));

  /* A REAL resolution for a REAL key, so the loaded state is not a fiction. */
  const resolvedFor = (key) => {
    const j = band46.key.indexOf(key);
    if (j < 0) return null;
    return {
      place: head.places[band46.place[j]], line: band46.line[j],
      family: band46.family[j], name: head.names[band46.name_of[j]], also: band46.also[j],
    };
  };

  const wrong = [];
  const STEP = 37;                   /* a stride, so the sample is not one neighbourhood */
  let sampled = 0, withBand = 0;
  for (let i = 0; i < n; i += STEP) {
    const key = keyBytes.readUInt32LE(i * 4);
    const len = lenBytes.readUInt16LE(i * 2);
    const inFamily = famBytes[i];
    const nat = nature(len, inFamily);
    const r = resolvedFor(key);
    if (r) withBand++;
    sampled++;
    for (const state of [null, r]) {
      if (state === null && r === null && sampled > 1) { /* still test the unloaded state */ }
      const text = plainEnglish({ len, nat, inFamily, r: state, meta })
        + familyClause({ inFamily, r: state });
      const denies = DENIES.some((re) => re.test(text));
      const asserts = ASSERTS.some((re) => re.test(text));
      /* MUTATE flips the byte the card was handed, so the pack and the sentence disagree
         on purpose. That is the defect vikra-ac found, reproduced rather than injected. */
      const truth = MUTATE ? (inFamily ? 0 : 1) : inFamily;
      if (truth && denies) wrong.push('key ' + key + (state ? ' (band loaded)' : ' (band loading)') + ' denies a family the pack records');
      if (!truth && asserts) wrong.push('key ' + key + (state ? ' (band loaded)' : ' (band loading)') + ' asserts a family the pack does not record');
      if (wrong.length > 6) break;
    }
    if (wrong.length > 6) break;
  }
  check('no composed sentence contradicts the pack about a family',
    wrong.length === 0,
    wrong.length
      ? wrong.length + '+ contradiction(s) in the REAL text: ' + wrong.slice(0, 3).join(' · ')
      : sampled.toLocaleString() + ' keys of ' + n.toLocaleString() + ' sampled at stride ' +
        STEP + ', each composed in BOTH load states (' + withBand.toLocaleString() +
        ' with a real band 46 resolution) · no sentence contradicts all-lines.family.bin');
}

/* 18. A DARK ROW MAY BE UNLIT; IT MAY NOT BE A DEAD END.
 *
 * Vikram's two rules pull in opposite directions and both are right: every particle
 * clickable, and the ones that cannot be clicked go dark rather than absent — use light as
 * your guide; and, never give the user a broken journey, leave no dead ends.
 *
 * They resolve the same way the estate resolves everything else: classify, don't exclude.
 * A row with no key of its own stays DARK, because light means "this line has a key here".
 * It still carries a destination, because darkness is a state and not a verdict.
 *
 * WHAT THE DARK ROWS ACTUALLY ARE, measured over 300 blocks and 5,960 block-line slots in
 * band 46 rather than assumed:
 *
 *   in the band already loaded      4,019   67.4%     the lit rows
 *   in an adjacent band                 8    0.1%
 *   further away                       16    0.3%
 *   no (place, line) entry at all   1,917   32.2%
 *
 * The card had told every one of those 1,917 that "the numbering has not reached this
 * line, OR its band is not loaded yet". The second half accounts for 0.4%, and I was one
 * commit from building a band-widening fetch to win it. The 32.2% are neither unloaded nor
 * unnumbered: the key exists and the pack records it against a DIFFERENT file, because
 * particles.json collapses key-place pairs onto one canonical place per key.
 *
 * So the rule: if a block holds any numbered line, no row in it may be inert.
 */
{
  const raw = cardProse();
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const from = code.indexOf("pre.className = 'code'");
  const end = code.indexOf('holder.append(pre)', from);
  /* The mutation removes the dark row's destination and leaves the light one, which is
     exactly the shipped state: lit rows navigable, dark rows inert. */
  const region = from >= 0 && end > from
    ? (MUTATE ? code.slice(from, end).replace(/if \(i3 >= 0\) row\.addEventListener[^;]*;/, '') : code.slice(from, end))
    : '';
  const missing = [];
  if (!region) missing.push('the block renderer was not found — this check cannot see what it claims to hold');
  /* A destination for the unlit row, and an explanation that does not offer the false
     alternative the shipped card offered. */
  if (!/nearestNumbered\(/.test(region)) missing.push('a dark row has no nearest-numbered fallback');
  if (!/row\.classList\.add\('dark'\)/.test(region)) missing.push('unreachable rows are not marked dark');
  const handlers = (region.match(/row\.addEventListener\('click'/g) || []).length;
  if (handlers < 2) missing.push('only ' + handlers + ' click handler(s) in the block — the dark row is inert, which is a dead end');
  if (/numbering has not reached this line, or its band is not loaded/i.test(region))
    missing.push('the dark row still offers "or its band is not loaded yet", true of 0.4% and offered to all of them');
  check('a dark block row is unlit but never inert',
    missing.length === 0,
    missing.length ? missing.join(' · ')
      : 'dark rows keep a destination via nearestNumbered() · ' + handlers +
        ' click paths in the block · the false "band not loaded" alternative is gone');
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + '\n        ' + r.detail);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: checks 1-3 must be among the failures)' : ''));
process.exit(MUTATE ? 0 : failed ? 1 : 0);
