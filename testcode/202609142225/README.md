# 202609142225 — Star Generator: one grammar, six lenses (testcode lab page)

A read-only lab page: `index.html` + `style.css` + `core.js` + `gl.js` + `ui.js` + `lenses/*.js` (ES modules, WebGL2,
no CDN, no framework, no build step). Serve it over HTTP from the repository root
(`python -m http.server <port> --bind 127.0.0.1` in `globalgrid2050/`, then open
`http://127.0.0.1:<port>/testcode/202609142225/`); `file://` blocks `fetch`. It is not linked from any corporate page.

The rules it is built to are in **GRAMMAR.md** (the owner's spec, verbatim, followed by the deviations made in this
build and why). This README says what is here, where the numbers come from and how to run the proof.

## What is on the page

One entity index of 11,825 keys — 12 categories, 31 repositories, 210 blocks, 587 groups off the table, 10,985
function families — held once on the GPU; six `layout()` functions (the lenses) give the same entities positions:

| lens | from | what it shows |
|---|---|---|
| ring | v08-ring-journey | blocks on the outer ring in table order, the open block's families on the inner ring |
| particle | v03-particle-universe | blocks as stars in 12 category sectors, the open block's families orbiting it |
| chord | v05-chord-dependencies | 210 arcs, every `depends on` chord through the centre |
| river | v07-flow-repos | repositories → categories → blocks as bands; a focus family's numbered lines as a ribbon |
| table | stars/table.html + v04-periodic-arrows | the periodic table of tiles, `depends on` / `used by` arrows over it |
| column | ventus-grid-engine column view + v10 single-line diagram | one column of cards on a busbar; `spider` fan on desktop |

Switching lens keeps the key, the trail, the recipe and the legend (they live in the URL; the legend's per-lens dim
state is re-rendered on every switch) and tweens the same entities from one position to the next. The 664,940 numbered-line instances of the pack are resident on the GPU once and drawn
as dust around whichever families a lens has positioned (shared lines in the `shared line` green).

Four verbs, one implementation each: **Navigate** (tap, search chip, crumb, tile, card, Back/Forward), **Measure**
(long-press, tap the focus again, right-click, panel button: fetches the family's bucket and the text at its pinned
commit), **Compose** (`Add to recipe`, swipe-right on a tile or card, `+`), **Hand off** (opens
`code-generator/?blocks=<Sym,…>`; `Copy recipe` puts the JSON of §6 on the clipboard, `Copy command` the picker's
`gh workflow run` line). The tray says what will travel — in numerals where a phone is narrow (`2 blocks · 1 note`)
and in full words on the title of the count and of every chip, and in full in the recipe sheet (`2 blocks will travel
(Ss, Vd) · #511 pinned as a note`); the chips scroll sideways, so the newest key and its `×` stay reachable at 430 px.
A family's block wears a dashed recipe outline. A line carried by more than one family is a note until you pick one in
the recipe sheet (`line 17 · carried by 686 families · pick one`): the star never guesses. The panel's `✕` closes the
panel; the root crumb `GLOBALGRID2050` is home.

## Where every number comes from

- Tier 1, before first paint: `https://ventusltd.github.io/stars/blocks/blocks.json` (categories, blocks,
  `depends_on`, `repos`, `files`, `needs`, `inside`), `…/stars/blocks/families.json` (block or group → family numbers),
  `…/stars/code/index.json` (10,985 families, 250,174 unique lines, generated_utc). `…/stars/code/names.json` after
  first paint, for search.
- Tier 2, after first paint, by relative path from `../202609142202/data/` (the packed state vector of 2026-09-14
  22:14 UTC, pinned in its `provenance.json`): `families.json` (names, kinds, lineOffset/lineCount), `lines.bin`
  (664,940 Uint32 line instances, 128,369 distinct numbers), `random.json` (300 edges), `entangled.json` (40 listed,
  69 stated), `provenance.json` (the sha256 shown in the footer, `5a0c365…` for lines.bin).
- Lazy forever: `…/stars/code/f/<n/500>.json` per family (uses, used_by, places, lines), and the text of a family's lines
  from `raw.githubusercontent.com/<repo>/<commit>/<path>` at the commit the bucket records.

The count sentence under the title is computed from those files at run time; its `title` (after the pack loads) gives
the second line figure with its source: `250,174 per code/index.json · 664,940 line instances · 128,369 distinct
numbers in this pack`. The two figures are never blended.

Two joins are made by name, because `random.json` and `entangled.json` number souls, not families: a `#N name` key is
matched to the lowest-numbered family of that name. Measured: 79 of 300 random edges and 30 of 40 entanglements
resolve; the legend chip titles say so. Unjoined records are not drawn.

## URL grammar

`?lens=<word>&key=<class>:<id>&trail=<key>,…&recipe=<key>,…&m=<key>&edges=cdubsre&cat=<id>&data=<yyyymmddhhmm>`
— see GRAMMAR.md §5. Inbound: `#family=<n>`, `#block=<Sym>`, `?block=<Sym>` (table.html), `?family=<n>` (code.html),
`?graph=periodic-table&focus=<Sym · title>` (dashboard), `?blocks=Si,Vn` (picker) are rewritten once with
`replaceState`.

## Proof

`proof/build-proof.mjs` (puppeteer-core, headless Chrome with `--enable-gpu --use-gl=angle --use-angle=d3d11
--ignore-gpu-blocklist`) loads every lens at 1440 and at 430 (touch emulation), reads the count sentence, legend,
`scrollWidth`, tap-target sizes, console errors and footer, walks the six lens tabs on one page, replays the inbound
grammars, builds a recipe and reads its hand-off URL and JSON, opens the hand-off in the public picker, and reads the
GPU facts (`linesCount`, `linesBytes`, edge and geometry instance counts, layout ms). Results: `proof/build-proof.json`
and `proof/build-*.png`. `proof/grep-tests.sh` runs the §10.5 grep tests. `proof/repair-check.mjs` is the repair
round's self-test (one check per review finding; `proof/repair-check.json`, `proof/repair-*.png`).
`proof/review2-check.mjs` is the second review round's refutation harness (`proof/review2-report.json`).
`proof/final-check.mjs` is the self-test of the four fixes of that round plus the post-repair Table B measurements
(`proof/final-check.json`, `proof/final-*.png`): the category chip's dim bit read back out of `G.meta`, the chord
lens's geometry count with the `depends on` chip on and off, the fold summary heights at 430 px, and the newest recipe
chip's `×` hit-tested with `document.elementFromPoint`. `proof/bench.mjs` is the benchmark (`proof/bench.json`,
`proof/bench-table.md`, `proof/bench-*.png`), whose figures are Table A and Table B of DECISION.md. `proof/publish.mjs`
is run last: it writes the footer's build stamp into `index.html` from the clock, then writes `publication.json` with
bytes and sha256 of every file in the folder plus the pack's provenance reference.

## What is not claimed, and what is not verified

The star does not generate code, run workflows, choose commits or show any verdict; the picker reads only `?blocks=`
today. GRAMMAR.md §9 and its deviations section list the rest. What has **not** been verified, plainly:

- **No physical phone.** Every "430 px" number on this page and in DECISION.md is headless Chrome with
  `isMobile`/`hasTouch` emulation at 430×900. No real handset, no real finger, no on-screen keyboard, no browser
  chrome taking viewport height, no iOS Safari at all.
- **Desktop emulation at device-pixel-ratio 2.** The 430 px runs set `deviceScaleFactor: 2` on a desktop window; that
  is a desktop GPU and a desktop compositor rendering at phone size, not a phone's GPU, thermal budget or 120 Hz panel.
- **The software renderer was never measured.** Every run used ANGLE/D3D11 on an RTX 5070 Ti
  (`--enable-gpu --use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist`). SwiftShader — and therefore what a machine
  without a usable GPU sees — was not benchmarked. The page's 2D fallback (`draw2D`, no tween, its own footer
  sentence) is implemented and reachable but was not exercised, because the proof machine always had WebGL2.
- Touch gestures (two-finger lens swipe, pinch zoom, double-tap home, long-press measure) are implemented and their
  URL and DOM effects were read headless; they were not driven with synthetic multi-touch events.
- The 600 ms tween was not filmed frame by frame, and `Copy recipe` / `Copy command` were read back through
  `__star.recipeJSON()` rather than from the system clipboard.
