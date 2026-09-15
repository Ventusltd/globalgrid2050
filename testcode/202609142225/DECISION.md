# DECISION.md — Star Generator GPU modelling run (measurements only; the owner decides)

Everything below was measured by `proof/bench.mjs` (puppeteer-core 25.10.0, headless Chrome `new`) on 2026-09-14 23:39–23:42 UTC
against `http://127.0.0.1:8884/testcode/202609142225/` served by `python -m http.server` from the repository root. Raw results:
`proof/bench.json` (every number, all samples), `proof/bench-table.md` (the raw table), `proof/bench.log`, screenshots
`proof/bench-<lens>-<width>.png` (after load) and `proof/bench-<lens>-<width>-after.png` (after 4 s of panning/tapping),
`proof/coord-<lens>-<width>.png`, `proof/compose-430.png`, `proof/compose-sheet-430.png`. Nothing outside
`testcode/202609142225/` was written; no git.

## Set-up (what the numbers were taken on)

- Chrome/153.0.8010.37, flags `--enable-gpu --use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist --no-first-run --enable-precise-memory-info`
  (the last flag only makes `performance.memory` exact). Desktop = viewport 1440×900, devicePixelRatio 1, mouse. Phone = viewport
  430×900, `isMobile`, `hasTouch`, devicePixelRatio 2 (the page caps `dpr` at 2, so 2 is what any phone gets); all phone input was
  sent through the touchscreen emulation (`touchStart/touchMove/touchEnd/tap`), never the mouse.
- WebGL renderer string, identical in all 12 runs: `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti (0x00002C05) Direct3D11 vs_5_0 ps_5_0, D3D11)`, `WebGL 2.0 (OpenGL ES 3.0 Chromium)`.
- The GPU is the desktop's, shared with other processes. `nvidia-smi` at 1 Hz, 182 samples: **10.5 s before Chrome**: utilisation mean
  17.7 %, max 49 %, memory 3,055 MiB mean / 3,152 MiB max of 16,303 MiB (other processes were active in that window);
  **Chrome open on a blank page, 5.5 s**: 4.5 % mean / 6 % max, 3,019 / 3,040 MiB. An earlier run of the same script (it stopped at the
  compose test; its log was overwritten, the figures are from its console) measured 2.5 % / 3 %, 2,900 / 2,910 MiB before Chrome and
  1.8 % / 8 % with Chrome blank. So "GPU util %" below is whole-GPU with a floor of roughly 2–5 % from the desktop.
- Live data at run time (the page's own count sentence): `214 blocks on the table (63 named · 151 found automatically) · 591 groups off
  the table · 11,060 function families · 252,114 unique numbered lines · 31 repositories · data 2026-09-14 23:26 UTC`; its title:
  `252,114 per code/index.json · 664,940 line instances · 128,369 distinct numbers in this pack`. Entities N = 11,908. The pack is the
  one in `../202609142202/data/` (built 2026-09-14 22:14:00 UTC, `lines.bin` sha256 `5a0c365…`, 0 orphan families). The builder's
  report was taken against the 19:56 UTC index (210 blocks, 10,985 families, 250,174 lines); the public index moved at 23:25 UTC.
  664,940 is a count of line *instances* (a line shared by several families is listed under each); the unique figure is 252,114.
- State loaded for every lens run: `?lens=<lens>&key=family:80299&trail=block:Gc,family:80299` — a family focus (#80299 haversine)
  with its block Gc open and a one-segment journey. Idle = 4 s with no input after the tween settled. Active = 4 s during which the
  script did, per cycle, one 180-px drag across the stage (10 move steps), on desktop one wheel tick of 240 px, then one tap 300 ms+
  clear of the previous tap; 4 cycles (12 actions on desktop, 8 on phone). Taps land on real entities, so the focus can change (last column of table B).

## Table A — rendering, lens × width

fps and frame-time are `requestAnimationFrame` deltas over the window. "G.frame() CPU ms" is the time the page's own draw routine spends on
the CPU (JS + GL command submission), patched in by the bench; it is not vsync-capped. "instances / frame" is what the page submits to
the GPU per frame (the shaders move unplaced entities off-clip, so the number on screen is smaller and was not measured):
664,940 line instances + 11,908 points + edge instances + geometry instances + 1 journey segment. "first GL draw" is the first
`drawArrays*` call, from navigation start. Ring at 1440 was the first page of the browser (cold HTTP cache for the public JSON);
every later row ran with a warm cache.

| lens | width | first GL draw ms | pack loaded ms | instances / frame (edges + geometry) | draw calls / frame | idle fps / p95 ms | active fps / p95 ms (max) | frames > 24 ms idle / active | G.frame() CPU ms mean / p95 idle | same, active | GPU util % mean / max idle | GPU util % mean / max active | GPU mem MiB max during run | canvas device px |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ring | 1440 | 431.7 (cold) | 543.9 (cold) | 676,900 (3 + 48) | 5 | 60 / 16.8 | 60 / 16.8 (16.9) | 0 / 0 | 0.07 / 0.2 | 0.05 / 0.1 | 19 / 25 | 23.3 / 25 | 3,103 | 1082×630 |
| particle | 1440 | 71.1 | 134.6 | 676,859 (10 + 0) | 4 | 60 / 16.8 | 60 / 16.8 (17.0) | 0 / 0 | 0.06 / 0.1 | 0.05 / 0.1 | 23.3 / 26 | 22.2 / 24 | 3,023 | 1082×630 |
| chord | 1440 | 71.7 | 138.2 | 677,250 (1 + 400) | 5 | 60 / 16.8 | 60 / 16.8 (16.9) | 0 / 0 | 0.06 / 0.1 | 0.05 / 0.1 | 23 / 24 | 23 / 25 | 3,027 | 1082×630 |
| river | 1440 | 73.4 | 141.4 | 677,465 (0 + 616) | 4 | 60 / 16.8 | 60 / 16.8 (17.0) | 0 / 0 | 0.06 / 0.1 | 0.05 / 0.1 | 24.5 / 29 | 24.4 / 28 | 3,037 | 1082×630 |
| table | 1440 | 83.7 | 162.4 | 676,849 (0 + 0) | 3 | 60 / 16.8 | 59.5 / 16.8 (33.3) | 0 / 2 | 0.06 / 0.2 | 0.05 / 0.1 | 21.5 / 23 | 22.5 / 24 | 3,043 | 1082×630 |
| column | 1440 | 68.9 | 137.7 | 676,862 (0 + 13) | 4 | 60 / 16.8 | 60 / 16.8 (16.9) | 0 / 0 | 0.07 / 0.2 | 0.07 / 0.2 | 20.8 / 24 | 5 / 6 | 3,069 | 1082×630 |
| ring | 430 | 76.2 | 138.0 | 676,900 (3 + 48) | 5 | 60 / 16.8 | 60 / 16.8 (17.0) | 0 / 0 | 0.06 / 0.2 | 0.05 / 0.1 | 21 / 25 | 24.5 / 30 | 3,058 | 812×1116 |
| particle | 430 | 66.0 | 133.8 | 676,859 (10 + 0) | 4 | 60 / 16.8 | 60 / 16.8 (16.9) | 0 / 0 | 0.06 / 0.1 | 0.06 / 0.1 | 25.3 / 32 | 23.3 / 25 | 3,067 | 812×1116 |
| chord | 430 | 66.0 | 131.6 | 677,250 (1 + 400) | 5 | 60 / 16.8 | 60 / 16.8 (17.0) | 0 / 0 | 0.06 / 0.1 | 0.05 / 0.1 | 17.5 / 24 | 24.5 / 29 | 3,056 | 812×1116 |
| river | 430 | 80.3 | 150.7 | 677,465 (0 + 616) | 4 | 60 / 16.9 | 60 / 16.9 (17.0) | 0 / 0 | 0.06 / 0.2 | 0.06 / 0.1 | 7.8 / 12 | 23.3 / 26 | 3,067 | 812×1116 |
| table | 430 | 79.1 | 150.4 | 676,849 (0 + 0) | 3 | 60 / 16.8 | 60 / 16.9 (16.9) | 0 / 0 | 0.05 / 0.1 | 0.06 / 0.1 | 4.3 / 5 | 16.2 / 23 | 3,073 | 812×1116 |
| column | 430 | 71.9 | 138.7 | 676,862 (0 + 13) | 4 | 60 / 16.8 | 60 / 16.8 (17.0) | 0 / 0 | 0.06 / 0.1 | 0.05 / 0.1 | 5 / 6 | 9.6 / 14 | 3,053 | 812×1116 |

Other timings on the cold first page (ring 1440): count sentence at 433.6 ms, names.json at 596.1 ms. Warm pages: count sentence
65.7–89.8 ms, names 87.1–113.3 ms. The line buffer resident on the GPU is 5,984,460 bytes in every run; the frame-time guard
(`litOnly`) never tripped. GPU idle utilisation from the earlier, overwritten run for comparison: 1440 — ring 13.8, particle 14.8, chord 11.8,
river 13.8, table 13.5, column 12.0 %; 430 — ring 14.5, particle 13.5, chord 7.3, river 14.3, table 3.0, column 6.3 %.

## Table B — page, hit areas, memory, errors, lens × width

"smallest tap target" is the smaller side of the smallest visible element among the key hit areas (search box, trail crumbs, legend chips,
lens tabs, panel buttons, panel entity chips, tray buttons, tiles, cards, column segment buttons, repository chips, category headings,
fold summaries, "show 40 more"). The canvas itself has no DOM target: `ui.js` picks the nearest entity within 22 layout px ÷ zoom
(a 44-px-wide tap circle at zoom 1) — read from the code, not measured. JS heap = `performance.memory.usedJSHeapSize` after load
(after the 4 s of interaction in brackets); CDP `JSHeapUsedSize` in the next column uses a different accounting.

| lens | width | scrollWidth / innerWidth | smallest tap target px (area, w×h) | other key targets px (search / crumb / legend / lens tab / panel button / panel chip / tile or card / other) | JS heap MB perf.memory (after interaction) | CDP JS heap MB | DOM nodes | console errors / page errors / failed requests | focus after 4 s of input (view) |
|---|---|---|---|---|---|---|---|---|---|
| ring | 1440 | 1440 / 1440 | 32 (crumb, 96×32) | 44 / 32 / 32 / 38 / 48 / 32 / – | 21.3 (23.6) | 9.4 | 487 | 0 / 0 / 0 | family:80299 (zoom 0.98, rotate 1.11 rad) |
| particle | 1440 | 1440 / 1440 | 32 (crumb, 96×32) | 44 / 32 / 32 / 38 / 48 / 32 / – | 23.8 (18.2) | 9.2 | 296 | 0 / 0 / 0 | family:80299 (zoom 0.98) |
| chord | 1440 | 1440 / 1440 | 32 (crumb, 96×32) | 44 / 32 / 32 / 38 / 48 / 32 / – | 21.8 (24.2) | 7.7 | 268 | 0 / 0 / 0 | family:80299 (zoom 0.98, rotate 1.11 rad) |
| river | 1440 | 1440 / 1440 | 32 (crumb, 96×32) | 44 / 32 / 32 / 38 / 48 / 32 / – | 25.0 (18.3) | 11.3 | 354 | 0 / 0 / 0 | family:80299 (zoom 0.98) |
| table | 1440 | 1440 / 1440 | 22 (category heading, 1064×22) — pre-repair (23:42 UTC) | 44 / 32 / 32 / 38 / 48 / 32 / tile 64 (112×64) / repo chip 32, "show 40 more" 32 | 21.8 (24.5) | 7.7 | 2,669 | 0 / 0 / 0 | block:Ra (overlay scrolled 484 px) |
| column | 1440 | 1440 / 1440 | 32 (crumb, 96×32) | 44 / 32 / 32 / 38 / 48 / 32 / card 64 (1028×64) / segment buttons 44 | 21.5 (26.5) | 7.4 | 306 | 0 / 0 / 0 | family:47 |
| ring | 430 | 430 / 430 | 32 (crumb, 96×32) | 44 / 32 / 32 / 56 (72×56) / 48 (117×48) / 32 / – | 21.5 (24.1) | 7.8 | 271 | 0 / 0 / 0 | family:80299 (rotate 1.11 rad) |
| particle | 430 | 430 / 430 | 32 (crumb, 96×32) | 44 / 32 / 32 / 56 / 48 / 32 / – | 23.6 (20.2) | 9.4 | 530 | 0 / 0 / 0 | block:Gn |
| chord | 430 | 430 / 430 | 32 (crumb, 96×32) | 44 / 32 / 32 / 56 / 48 / 32 / – | 21.4 (23.5) | 7.7 | 696 | 0 / 0 / 0 | family:80299 (rotate 1.11 rad) |
| river | 430 | 430 / 430 | 32 (crumb, 96×32) | 44 / 32 / 32 / 56 / 48 / 32 / – | 23.8 (26.0) | 9.9 | 454 | 0 / 0 / 0 | family:80299 |
| table | 430 | 430 / 430 | 22 (category heading, 388×22) — pre-repair (23:42 UTC) | 44 / 32 / 32 / 56 / 48 / 32 / tile 56 (96×56) / repo chip 32, "show 40 more" 32 | 21.3 (23.9) | 7.6 | 2,668 | 0 / 0 / 0 | repo:chatgpt-audits |
| column | 430 | 430 / 430 | 32 (crumb, 96×32) | 44 / 32 / 32 / 56 / 48 / 32 / card 64 (352×64) / segment buttons 44 | 21.3 (23.4) | 7.6 | 305 | 0 / 0 / 0 | family:80299 |

Console warnings: 0 in every run. The tray's chip-remove buttons (44×44 in `style.css`) were not on screen during the lens runs
(empty recipe) and were not measured.

Every row above is the page **as measured at 23:42 UTC**, before the repair round and before the review round of 2026-09-15.
The rows are kept as they were measured. The table below is the same measurement repeated after the four fixes of the review round
(`proof/final-check.mjs` → `proof/final-check.json`, same machine, same headless Chrome, 430×900, dpr 2, `isMobile`/`hasTouch`,
key `block:Gc` on every lens). Nothing in it is typed by hand: the numbers are read from `getBoundingClientRect()` and from
`window.__star.G` on the live page.

### Table B (post-repair, 2026-09-15) — tap-target heights at 430 px and the segments each lens has on screen

| lens | width | scrollWidth | smallest tap target px (what) | search / crumb / legend / lens tab / panel button / panel chip | tile or card | fold summary | category heading | column segment | geometry segments | edge segments | key |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ring | 430 | 430 | 32 (crumb) | 44 / 32 / 32 / 56 / 48 / 32 | – | – | – | – | 48 | 2 | block:Gc |
| particle | 430 | 430 | 32 (crumb) | 44 / 32 / 32 / 56 / 48 / 32 | – | – | – | – | 0 | 0 | block:Gc |
| chord | 430 | 430 | 32 (crumb) | 44 / 32 / 32 / 56 / 48 / 32 | – | – | – | – | 400 | 0 | block:Gc |
| river | 430 | 430 | 32 (crumb) | 44 / 32 / 32 / 56 / 48 / 32 | – | – | – | – | 610 | 0 | block:Gc |
| table | 430 | 430 | 32 (crumb) | 44 / 32 / 32 / 56 / 48 / 32 | tile 56 | 44 | 45 | – | 0 | 0 | block:Gc |
| column | 430 | 430 | 32 (crumb) | 44 / 32 / 32 / 56 / 48 / 32 | card 64 | – | – | 44 | 16 | 0 | block:Gc |

- **The 22 px category heading is gone**: the table lens's headings now measure 45 px and its one fold summary 44 px, so the smallest
  tap target on every one of the six lenses is the 32 px trail crumb — the same as the five non-table lenses measured before the repair.
  The 21 px figure the review round found was the **repositories fold** (430 only), which the rule `.tb-cat details summary` never
  matched: that `<details>` *is* the `.tb-cat` element, so its own `<summary>` was never styled. The rule is now `.tb-cat summary`.
- On the data of 2026-09-14 19:56 UTC no category produces a "found automatically" fold (every automatically-found block with fewer
  than 8 functions is either open, lit or in the recipe), so the repositories fold is the only `<summary>` on the page at 430 and there
  is none at 1440. Both cases are covered by the one rule; only the first can be measured today.
- **Six lens segments on screen with the same key**: all six lenses drew `block:Gc` at 430 with 0 console errors and `scrollWidth`
  430. Geometry segments differ by lens, as they should: river 610 (bands and ticks), chord 400 (210 block arcs + 186 idle
  `depends on` chords + gaps), ring 48 (core disc and group band), column 16 (busbar and feeders), particle and table 0 (particle
  draws points only; table's picture is its DOM overlay).
- **The `depends on` legend chip now moves the geometry**: chord geometry 400 with the chip on → 214 with it off → 400 on again
  (`proof/final-check.json` `measurements.f2`). Before the fix the chip changed only the edge list and the 186 idle chords stayed drawn.
- **The category chip's dim now reaches the GPU**: 0 entities carrying the dim bit before the click → 11,853 while the category
  "Constants and vocabularies" is chosen → 0 again after un-clicking (`measurements.f1`; the count is of `G.meta[4i+2] & 32`, read from
  the buffer the shell uploads, over the `G.N` entities of the live index of this run).
- **The newest recipe chip is reachable at 430**: with two keys in the recipe the second chip's remove button measures 44×44, lies
  inside the chips box and `document.elementFromPoint` at its centre returns that button (`measurements.f4`). The tray count is now
  numerals (`2 blocks`) with the full sentence (`2 blocks will travel (Si, At)`) on the title of the chips and of the count.

## Coordination test — search `#80299` in ring, then every other lens

Search hits for `#80299` (both widths, after the pack loaded): `#80299 haversine`, `line 80,299 · #8796 at`. The first hit was tapped
(touch at 430, mouse at 1440). Result in ring: key `family:80299`, panel head `#80299 haversine · family`,
URL `?lens=ring&key=family:80299&trail=family:80299&data=202609142326`. Then each lens tab was tapped in turn and, 1.6 s later,
the key, the URL, the panel head, the focus entity's screen position on the canvas, the focused tile/card in the overlay lenses and
the `#80299` label were read. Screenshots `proof/coord-<lens>-<width>.png`.

| width | lens | key kept in URL and state | panel head | focus on canvas at (x, y) of stage w×h | inside stage | overlay focus element | `#80299` label shown |
|---|---|---|---|---|---|---|---|
| 1440 | ring | yes | #80299 haversine | (700, 254) of 1082×630 | yes | – | yes |
| 1440 | particle | yes | #80299 haversine | (614, 208) | yes | – | yes |
| 1440 | chord | yes | #80299 haversine | (541, 88) | yes | – | yes |
| 1440 | river | yes | #80299 haversine | (931, 165) | yes | – | yes |
| 1440 | table | yes | #80299 haversine | (64, 456) | yes | tile `13 Gc Distance and bearing`, top 425 px, inside | yes |
| 1440 | column | yes | #80299 haversine | (44, 238) | yes | card `#80299 haversine · family · uses 0 · used by 2`, top 191 px, inside | yes |
| 430 | ring | yes | #80299 haversine | (305, 240) of 406×558 | yes | – | yes |
| 430 | particle | yes | #80299 haversine | (250, 210) | yes | – | yes |
| 430 | chord | yes | #80299 haversine | (203, 133) | yes | – | yes |
| 430 | river | yes | #80299 haversine | (155, 530) | yes (see note) | – | yes |
| 430 | table | yes | #80299 haversine | (56, 902) | **no** | tile `13 Gc Distance and bearing`, top 875 px in a 558-px stage, **outside**; overlay scrollTop 0 of 6,664 | **no** |
| 430 | column | yes | #80299 haversine | (44, 238) | yes | card, top 191 px, inside | yes |

Notes. (1) At 430 the page scrolls the stage to the top when a key opens (page scrollY 420–436, stage top at 63–79 px) and the
panel is a fixed sheet, `bottom: 104px; height: 40vh` = 360 px at 900 tall, so its top edge sits at viewport 436 px: the lower
≈ 200 px of the 558-px stage are under the sheet (derived from the measured stage top and the CSS, not measured as a pixel test).
River's focus at stage y = 530 is inside the canvas but under that sheet; ring (240), particle (210), chord (133) and column (238) are
above it. (2) In the table lens the family focus is placed at its block's tile (`lenses/table.js` `layout`), and `scrollTo(idx)` looks the
family index up in the tile map, which holds blocks, groups, repositories and categories only, so no scroll happens
(read from the code; the measurement is the unscrolled overlay). At 1440 the Gc tile happened to lie at 425 px, within the 630-px stage.
(3) The URL in every step carried `key=family:80299&trail=family:80299&data=202609142326`; the lens switch never lost the key.
(4) Repair round: `scrollTo` now resolves a family to its block tile and scrolls it into the band above the sheet; measured
`?lens=table&key=family:80299` at 430 → overlay scrollTop 240, tile Gc at 160 px of a 374-px visible band (`proof/repair-check.json`, M4).

## Compose test at 430, by touch

Fresh browser context (empty `localStorage`, so no stored recipe). Every tap went through the touchscreen; the script scrolled a target
into view before tapping it, as a person would. Screenshots `proof/compose-430.png`, `proof/compose-sheet-430.png`.

1. Tap the search box (top at 97 px), type `#80299`, tap the first hit `#80299 haversine`, wait for the panel foot, tap `Add to recipe`
   (117×48 px). State: recipe `["family:80299"]`; tray `#80299 × · 1 family · Hand off →`;
   URL `?lens=ring&key=family:80299&trail=family:80299&recipe=family:80299&data=202609142326`; panel `#80299 haversine · family`.
2. The search box was now at −339 px (above the viewport, because opening the key scrolled the stage to the top); scrolled into view,
   tapped, typed `Vd`, tapped the hit `Vd · Voltage drop`, tapped `Add to recipe`. State: recipe `["family:80299","block:Vd"]`;
   tray `#80299 × Vd × · 1 block · 1 family · Hand off →`;
   URL `?lens=ring&key=block:Vd&trail=family:80299,block:Vd&recipe=family:80299,block:Vd&data=202609142326`; panel `Vd · Voltage drop · block`.
3. Tap the tray count to open the recipe sheet. Sheet text: `Recipe 1 block · 1 family`, rows `#80299 haversine` and `Vd · Voltage drop`,
   `needs: 0`, `pinned files (2)`: `ventus-grid-engine/engine/geo-core.js @ 2e36dbf`, `ventus-grid-engine/engine/voltage-drop.js @ 2e36dbf`,
   and the hand-off URL in plain text:
   `https://ventusltd.github.io/code-generator/?blocks=Gc,Vd&families=80299&from=star-generator&data=202609142326`
   (identical to `__star.handOffURL()`). It contains both keys: `Vd` in `blocks=` and `80299` in `families=`; Gc is the family's block,
   placed first as the sheet's rule says. No commit travels in the URL (the sheet says so).
4. Tap `Copy recipe` (clipboard `writeText` intercepted by the bench; the button read `copied` afterwards is not recorded, the text is):
   1,179 characters of JSON, schema `star-generator.recipe.v1`, `keys: ["family:80299","block:Vd"]`,
   `blocks: [Gc #13 geodesy → Ventusltd/ventus-grid-engine @ 2e36dbf4d7963619a55606f97b1054f429ea2f9d engine/geo-core.js,
   Vd #31 network → Ventusltd/ventus-grid-engine @ 2e36dbf4d7963619a55606f97b1054f429ea2f9d engine/voltage-drop.js]`,
   `families: [80299 haversine, block Gc, place Ventusltd/ventus-grid-engine @ 2e36dbf4d79… engine/geo-core.js L82–L87]`,
   `lines: []`, `needs: []`, `trail: ["family:80299","block:Vd"]`,
   `data: { blocks_json 2026-09-14T23:26:35.390Z, index_json 2026-09-14T23:25:29.936Z, pack 2026-09-14T22:14:00.499Z }`.
   Every block and the family carry a 40-hex pinned commit. Console errors during the test: 0.

## What each lens is, on a phone, by the numbers

**ring.** 430 px: first GL draw 76 ms, 676,900 instances a frame in 5 draw calls, 60 fps with p95 16.8 ms idle and while rotating
and tapping, GPU 21 % idle / 24.5 % active, 21.5 MB JS heap, 0 errors, no horizontal scroll. The searched key stayed selected and its
label visible at (305, 240) of a 406×558 stage after every lens switch. Drag rotates the ring (rotation 1.11 rad after the input), the
inner ring of families of the open block is capped at 60 on a phone by the lens's `simplify`. Smallest tap target on the page is the
32-px crumb; the canvas tap circle is 44 px.

**particle.** 430 px: first draw 66 ms, 676,859 instances, 4 draw calls, 60 fps / 16.8 ms idle and active, GPU 25.3 % idle (the
highest idle figure of the twelve, the orbit animation runs every frame) / 23.3 % active, 23.6 MB heap, 0 errors. Key kept and label
visible at (250, 210) after switching. The taps during the active window moved the focus to block Gn, i.e. stars are hit at phone size.

**chord.** 430 px: first draw 66 ms, 677,250 instances (400 geometry arcs), 5 draw calls, 60 fps / 16.8 ms, GPU 17.5 % idle /
24.5 % active, 21.4 MB heap, 0 errors, 696 DOM nodes. Key kept and label visible at (203, 133). Drag rotates; the faint idle chords are
drawn at 0.12 alpha on a phone (0.28 on desktop, from `ui.js`).

**river.** 430 px: first draw 80 ms, 677,465 instances (616 band segments, the most geometry of the six), 4 draw calls, 60 fps /
16.9 ms, GPU 7.8 % idle / 23.3 % active, 23.8 MB heap, 0 errors. Key kept and label shown; the focus lies at stage y = 530 of 558, which is
under the fixed panel sheet on a 900-px-tall phone (sheet top at 436 px of the viewport). The block row is `blocks · 14 + 40` layout px wide on
a phone (3,036 px with the 214 blocks of the 23:26 UTC index this run used; 2,980 with 210) and pans sideways; the camera starts at pan 0.

**table.** 430 px: first draw 79 ms, 676,849 instances (no edges or geometry drawn for a family focus), 3 draw calls, 60 fps /
16.8 ms idle, 16.9 ms active, GPU 4.3 % idle / 16.2 % active (the lowest idle figure of the twelve; the overlay is DOM),
21.3 MB heap, 2,668 DOM nodes (nine times the other lenses), 0 errors. Tiles are 96×56 px; the category headings, which navigate, are
22 px tall — the smallest hit area measured anywhere (**pre-repair, 23:42 UTC**; re-measured after the repair the headings are 45 px,
the one fold summary 44 px and the smallest hit area on the table lens is the 32 px trail crumb, as everywhere else). After the lens switch the key and panel were kept but the focused tile (Gc) sat at
875 px inside an unscrolled 6,664-px overlay, 317 px below the bottom of the 558-px stage, and no label was shown. The taps in the
active window landed on the repository strip (focus became `repo:chatgpt-audits`).

**column.** 430 px: first draw 72 ms, 676,862 instances (13 busbar segments), 4 draw calls, 60 fps / 16.8 ms, GPU 5 % idle /
9.6 % active (the lowest active figure of the twelve), 21.3 MB heap, 305 DOM nodes, 0 errors. Cards are 352×64 px, the segment
buttons 44 px. Key kept, panel kept, focused card at 191 px from the top of the stage and inside it; the focus did not change during
the active window's taps. The spider fan is desktop only (`simplify` at ≤ 600 px turns it off), so on a phone the wiring is the busbar
geometry and no edge instances are drawn.

**Across all six**: fps and p95 do not separate the lenses (headless Chrome paces `requestAnimationFrame` at 60 Hz and every lens
holds it; the page's own draw routine costs 0.05–0.07 ms a frame on the CPU). The numbers that differ are GPU utilisation
(4–25 % idle, 5–24.5 % active on a shared RTX 5070 Ti), DOM size (268–2,669 nodes), first draw (66–84 ms warm, 432 ms cold), the
smallest hit area (22 px in table, 32 px elsewhere — **pre-repair, 23:42 UTC**; 32 px on all six after the repair), and whether the
focused key was on screen after a lens switch at 430 (five of six).

## Not verified / limits

- No physical phone; 430×900 with touch emulation and dpr 2 on a desktop GPU. A phone GPU, thermal state and 120-Hz display are not modelled.
- GPU utilisation and memory are whole-GPU (`nvidia-smi`), shared with other desktop processes that were using 2.9–3.15 GB and 2–18 %
  before Chrome; Chrome's own share is at most the differences shown (≈ 20–100 MiB above the blank-page reading, within the noise).
- One measurement per cell (plus the partial earlier run quoted for idle GPU); 4-s windows; nvidia-smi gives 4–5 samples per window.
- fps is capped by the headless compositor at 60 Hz; the CPU draw time is measured but GPU frame time is not (no timer query).
- First-draw numbers after the first page are with a warm HTTP cache; only ring 1440 is cold.
- "instances / frame" counts what is submitted; the shaders discard unplaced entities, so the on-screen count is smaller and unmeasured.
- The panel-sheet overlap on the phone is derived from the measured stage top and the CSS, not from a pixel test; the table lens's
  missing scroll is explained from the code and measured only as "overlay scrollTop 0".
- Long-press, pinch, two-finger swipe, the 2D fallback and the real clipboard were not exercised; the hand-off URL was not opened in the
  public picker in this run (the builder's proof did that with a different recipe).
- The tray remove buttons and the recipe-sheet reorder buttons were not measured as tap targets.
