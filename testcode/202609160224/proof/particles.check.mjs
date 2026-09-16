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
import { derive, nature, radiation, NATURE_NAME, NOISE } from '../derive.mjs';

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
  const src = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8')
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
  const raw = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8');
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
  const scan = MUTATE ? code.split('fams[').join('FAMS_REMOVED(') : code;
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
    const guarded = lines.slice(Math.max(0, i - 8), i + 1)
      .some((w) => /fams\[/.test(w) && !/;\s*$/.test(w));
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
  const raw = fs.readFileSync(path.join(SURF, 'nest.mjs'), 'utf8');
  /* Comments FIRST, and this bit on the very first run: an apostrophe inside a comment
     ("true of this page's downloads") opens a string literal, and the extractor returned
     28 fragments of COMMENT PROSE as though they were the card's sentences. Pinning that
     would have pinned the wrong text and called it classified. The fifth time tonight a
     check read a comment as evidence. */
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const from = src.indexOf('function english(');
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
  const all = (scan.match(/textContent = '[^']*\d{1,3},\d{3}[^']*'/g) || []);
  check('no label carries a typed count',
    all.length === 0,
    all.length
      ? all.length + ' typed count(s) in labels: ' + all.slice(0, 3).join(' · ') +
        ' — correct until the estate changes, and unable to know when it has'
      : 'every count in a label is read from the pack or the head · ' +
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
  const scan = MUTATE ? code.split("row.addEventListener('click'").join('row.noHandler(') : code;
  const lights = /row\.classList\.add\('live'\)/.test(scan);
  const opens = /row\.addEventListener\('click'/.test(scan);
  const darkens = /row\.classList\.add\('dark'\)/.test(scan);
  const styled = /\.cl\.live/.test(css) && /\.cl\.dark/.test(css);
  const counts = /numbered and open/.test(scan);
  const missing = [];
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

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + '\n        ' + r.detail);
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed' +
  (MUTATE ? '   (--mutate: checks 1-3 must be among the failures)' : ''));
process.exit(MUTATE ? 0 : failed ? 1 : 0);
