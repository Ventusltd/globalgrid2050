# GRAMMAR.md — Star Generator: one grammar, six lenses

Build instructions for one builder, one night, WebGL2 + plain JS, no framework, no build step. The winner is design 1 (journey-first: vocabulary, count sentence, URL grammar, panel contents, honesty rules). Grafted from design 0: the entity model (11,825 GPU entities, lines stay on the CPU), the two-buffer position tween, the CPU spatial-grid picking, the ambiguity chooser, the context sheet, the 44 px / 22 px mobile rules. Grafted from design 2: the edge-class mask (hidden / faint / lit), one segments program that also draws lens geometry (arcs, bands, tile outlines), the `Open in ▾` menu on every panel, keyboard shortcuts.

Everything below is a rule. Where a rule quotes a number it is the number measured on 2026-09-14 and it must be computed from the live data at run time, never typed into the page.

---

## 0. Vocabulary (fixed; the acceptance test is `grep`)

**Classes of key** (five on the picture, one off it):

| class | key string | example | where it comes from |
|---|---|---|---|
| category | `cat:<id>` | `cat:solar` | `blocks.json.categories[].id` (12) |
| repository | `repo:<name>` | `repo:gridatlas` | `blocks[].repos` with `Ventusltd/` stripped (31) |
| block | `block:<Sym>` | `block:Pn` | `blocks.json.blocks[].symbol` (210 on the table: kind named or auto) |
| group | `group:<sym>` | `group:x618` | a symbol in `families.json` with no block record (587 off the table) |
| family | `family:<n>` | `family:8285` | the permanent function number `#n` (10,985) |
| line | `line:<n>` | `line:34201` | a permanent numbered line (not a picture entity; resolves to its families) |

**Display form** (`core.label(key)`), the only label used anywhere — picture, trail, panel, chips, tray:
- block: `Pn · Pipeline News app`; group: `x618 · <name>` or `x618 · (not yet named)`; family: `#8285 <name>` or `#8285 (name not yet known)`; line: `line 34,201 · #8285 <name>`; category: its title; repository: its name.
- Retired forms: `BLOCK 22`, bare `8285`, `Sym · title` as a URL value, uppercase `DEPENDS-ON`, `FOUND-IN`, `CONTAINS`.

**Relationship words** (legend order, hex from `core.js REL`, never any other word for the same edge):

| word | hex | stored direction | reversed reading |
|---|---|---|---|
| contains | `#8b93a7` | container → member | `contained in` |
| depends on | `#ffd54a` | block → block | `used by` (block level) |
| uses | `#00e5ff` | family → family | `used by` (family level) |
| used by | `#ff7ab6` | (a reading, not a second edge) | — |
| shared line | `#39d353` | family ↔ family, symmetric | — |
| random link | `#8b93a7` dotted | family ↔ family from `random.json` | — |
| entangled | `#b8ccff` dashed | family → repository from `entangled.json` | — |

The first five chips are the legend the brief fixes; chips six and seven appear only after their files load and are otherwise shown at 35 % with `title="not loaded"`. Retired words: `dependents`, `depended on by`, `dependencies` (as a count), `REPO` chip on non-repositories, any status dot, any red/green/amber that means a verdict.

**Section headings** (panels and column cards, exact): `→ depends on (N)`, `← used by (N)`, `→ uses (N)`, `◂ contained in`, `▸ found in (N)`, `≡ shared line (N)`, `Numbered lines (permanent keys)`, `? random link (p = 0.xx)`, `↔ entangled (N)`.

**Lens words** = URL words = tab words: `ring · particle · chord · river · table · column`. No second vocabulary (no "360°", no "Stars").

**The count sentence**, one string built by `core.countsLine()`, identical on every lens, en-GB grouping, never appended to by a lens:

`210 blocks on the table (63 named · 147 found automatically) · 587 groups off the table · 10,985 function families · 250,174 unique numbered lines · 31 repositories · data 2026-09-14 19:56 UTC`

- 210 = `blocks.length`; 63 = records with `kind !== 'auto'`; 147 = `kind === 'auto'`; 587 = `U.unnamed.length`; 10,985 = `index.families`; 250,174 = `index.lines`; 31 = distinct repositories; date = `blocks.json.generated_utc`.
- When the pack (§1.3) has loaded, the number 250,174 gets `title="250,174 per code/index.json · 664,940 line instances · 128,369 distinct numbers in this pack"`. The two figures are never blended and never reconciled silently.

**Palette** (core.js, exact): body `#0b0d12`, text `#d8dee9`, accent `#00e5ff`, panel `#0f1218` border `#2a3140`, chip `#12151c` border `#385464` hover `#00e5ff`, code box `#07090d`, line key `#ffd54a`, muted `#8b93a7`, counts `#7da0c8`, footer `#566079`, monospace `ui-monospace, Menlo, Consolas`. Category colours from `blocks.json.categories[].colour` (12), fallback `#8b93a7`. Repositories are drawn muted `#8b93a7` (they have no category). The only red on the page is the `.u-fail` load-error box (`#ff5c5c` / `#ffb3b3`), because that is an error, not a verdict.

**Light** is the only state encoding for a node: focus 1.0, neighbour (1 hop over enabled kinds) 0.8, on trail 0.7, in recipe 0.9 plus a 1 px `#d8dee9` ring, everything else 0.35. Alpha = 0.18 + 0.82 · light. Colour never changes with state.

---

## 1. Core data model and GPU buffers

### 1.1 Files (`core.js` ≈ 400 lines; descends from `testcode/202609141522/core.js`, keeps its exported names)

Tier 1, loaded before first paint, exactly `loadUniverse()` today (`Promise.all`, `fetch(url, {cache:'default'})`, `Error("<url> returned HTTP <status>")`, `fail()` box text `Could not load live data: <msg>. Check the internet connection and reload.`):

- `https://ventusltd.github.io/stars/blocks/blocks.json` — categories, blocks (`symbol, number, title, category, kind, functions, repos[], files[{repo,commit,path,live}], depends_on[{symbol,title,via[]}], used_by[Sym], needs[{name,meaning}], inside[n], state, live[]`).
- `…/stars/blocks/families.json` — family → groups.
- `…/stars/code/index.json` — `families, lines, elements, bucket_size, generated_utc`.
- `…/stars/code/names.json` — search only (lazy after first paint is acceptable).

Tier 2, after first paint, from the page's own `data/` folder (copied from `testcode/202609142202/data` with its `provenance.json`; sha256 shown in the footer): `families.json` (names, kind, block, category, lineOffset, lineCount, repos, standalone), `lines.bin` (Uint32, 664,940), `random.json`, `entangled.json`. Until tier 2 lands: family labels read `#n`, line search says `line index still loading`, chips six and seven are at 35 %.

Lazy forever (as core.js `family(n)` and `familyLines(rec)`): `code/f/<bucket>.json` per family (uses, used_by, places, lines, names) cached in `U.buckets`; source text from `raw.githubusercontent.com/<repo>/<commit>/<path>` cached by `repo@commit:path`. Text is never in the core; the core holds keys.

### 1.2 Entities (index order is a range test on class)

```
idx  0 .. 11       categories   (blocks.json order)
    12 .. 42       repositories (alphabetical, 31)
    43 .. 252      blocks       (210, category order then number ascending — THE ordinal: ring angle, chord arc, tile order)
   253 .. 839      groups       (587, by symbol)
   840 .. 11824    families     (by #n ascending)
N = 11,825 (computed; core.range.<class> = [lo, hi))
```

CPU arrays (`core.*`): `keyStr[N]`, `cls: Uint8[N]` (0 cat, 1 repo, 2 block, 3 group, 4 family), `cat: Uint8[N]` (255 = none), `parent: Int32[N]` (family → block/group, block/group → category, repo → −1), `mass: Float32[N]` (family lineCount, block/group family count, repo blocks carried, category blocks), `famOff/famCount` per block or group (families sorted so each container is a contiguous range), `byKey: Map<string, idx>`, `resolve(str) → idx | -1`, `label(idx) → string`, `colour(idx) → hex`.

Lines: `lineKey: Uint32[664,940]`, `lineFam: Uint32[664,940]` from `lines.bin` + pack `families.json` ranges; `lineIndex: Uint32[]` of distinct keys sorted (128,369) with `lineFirst[]` pointing at the first (key, fam) pair, so `core.familiesOfLine(n)` is a binary search. Without tier 2, `familiesOfLine` returns `null` and callers print `not yet known`.

### 1.3 Edges (CSR per kind, both directions)

`core.edges = { a: Uint32Array, b: Uint32Array, kind: Uint8Array, w: Float32Array, out: CSR, in: CSR }`, grown with a doubling buffer; `core.edgesOf(idx, kind) → Uint32Array` of neighbour indexes.

| kind | built when | rule |
|---|---|---|
| 0 contains | tier 1 | category→block, category→group (by families' category), block/group→family, repo→block (`blocks[].repos`) |
| 1 depends on | tier 1 | `blocks[].depends_on[].symbol` (175 among table blocks + those to groups); `via[]` kept as edge label |
| 2 uses | lazy | from the focus family's bucket record `uses[]` / `used_by[]`, appended once per family, never duplicated; `used by` is `in` of kind 2 |
| 4 shared line | lazy / tier 2 | over loaded bucket records as core.js does today; when `lines.bin` is present, over the whole pack, at most 8 partners per line key; `w` = shared count |
| 5 random link | tier 2 | `random.json` edges, `w = p` or 0.25 when absent |
| 6 entangled | tier 2 | `entangled.json` (40 listed); chip title `69 stated · 40 listed · 29 not yet known` |

Kind 3 is not stored. Family-level `uses` edges stay lazy per focus tonight (their total is unmeasured); a precomputed CSR in the pack is a later optimisation, not a dependency.

### 1.4 State (the only mutable UI state; lenses read it, only actions write it)

```js
state = { lens:'ring', focus:-1, measure:-1, trail:Uint32Array|[], recipe:[idx…], kindsOn:0b1111111, cat:-1 }
view  = { ...state, lit:Uint8Array(N) /* 1 neighbour, 2 focus, 4 recipe, 8 trail */, w, h, mobile, dpr, params }
```

### 1.5 GPU buffers (WebGL2, one context, uploaded once; only `lit`, positions and the per-focus edge list are re-uploaded)

- `posA`, `posB`: `Float32 2N` vertex attributes (two position fields; `u_mix` tweens A→B, then roles swap). `NaN` = not drawn.
- `meta`: `Uint8 4N` = (cat, cls, lit, 0); `lit` rewritten by `bufferSubData` on navigate/compose (47 KB).
- `mass`: `Float32 N`.
- `edgeInst`: per-instance `(ax0, ay0, bx0, by0, ax1, ay1, bx1, by1, width, kindOrCat, light, cls, w)` gathered on the CPU for the current focus/lens (≤ 4,000 instances; a gather of that size is < 1 ms, so no position texture is needed).
- `geomInst`: the lens's `geometry()` output in the same layout (arcs, bands, tile outlines, trail polyline).
- Uniforms per frame only: `u_mix`, `u_time`, `u_view` (mat3 pan/zoom/rotate), `u_dpr`, `u_catColour[13]`, `u_relColour[7]`, `u_kindsOn[7]`, `u_orbit`, `u_bow`.

Two programs, shared by all lenses; a lens cannot add one:

1. **points** — `drawArraysInstanced(TRIANGLES, 0, 6, N)` over a unit quad. Vertex: `p = mix(posA, posB, ease(u_mix))`; when `u_orbit` is set and `cls == family` and `parent == focus`, `p += polar(16 + ring·18, phase(idx) + u_time·0.25/ring)`; `size = base[cls] + gain[cls]·sqrt(mass)` clamped 2..14, ×1.5 for focus, × dpr. Fragment: soft disc (families square, others round), colour `u_catColour[cat]` (repos muted), alpha `0.18 + 0.82·light`, 1 px `#d8dee9` ring when recipe bit set, dotted ring when trail bit set.
2. **segments** — instanced strip of 17 vertices (t = 0..1) per instance; vertex evaluates a quadratic Bézier from endpoints (tweened by `u_mix`) with control point = centre (ring, chord), 20 % bow (particle), 30 % bow (table), horizontal/vertical tangents (river, two stacked quadratics), straight (column, tile outlines); offset by the normal × width × dpr. Colour: `u_relColour[kind]` for edges, `u_catColour[cat]` for lens geometry. Alpha: class 1 faint = 0.12, class 2 lit = 0.9·light. Kinds 5 and 6 dashed via `fract(t·20)`. Arrowhead = last two vertices widened for kinds 1 and 2 (reversed when the reading is `used by`). Discarded when `u_kindsOn[kind] == 0`.

Labels: DOM `<span>` elements, ≤ 24 on mobile / ≤ 60 on desktop, positioned each frame from the CPU copy of the tweened positions; greedy rectangle rejection, focus and trail first; 11 px monospace `#d8dee9` (`#8b93a7` when not lit); never rotated.

Picking: CPU uniform grid 32×32 over the target positions, rebuilt after every `layout()`; nearest entity within 22 px CSS wins; if the second-nearest is within 6 px of the nearest, the shell opens a chooser sheet listing both (label + class) instead of guessing. Lenses with geometry (chord arcs, river bands, tiles, cards) supply `hit()` for that geometry; nodes are always the shell's grid.

Fallback: `getContext('webgl2') === null` → the same `layout()` output drawn on a 2D canvas, no tween, footer says `GPU not available: drawn without animation`.

---

## 2. Lens interface (exact)

A lens is one ES module. It owns positions, its geometry, its hint, its label choice, its mobile constants and (table, column) a DOM overlay. It owns nothing else. Acceptance: a lens module contains zero `fetch`, zero hex colour literals, zero `history.`, zero `state.` writes, zero legend words other than through `core.REL`.

```js
/** @typedef {{focus:number, measure:number, lit:Uint8Array, trail:Uint32Array, recipe:Uint32Array,
 *            kindsOn:number, cat:number, w:number, h:number, mobile:boolean, dpr:number, params:object}} View */

export default {
  id: 'ring',                       // 'ring'|'particle'|'chord'|'river'|'table'|'column' — URL word and tab word
  from: 'v08-ring-journey',         // provenance, printed in the footer as "lens ring from v08-ring-journey"
  wants: ['block','group','family','category','repo'],   // classes given a position; others are NaN (not drawn)
  draws: ['contains','depends on','uses','used by','shared line','random link','entangled'],  // kinds it can light; the legend dims the rest to 35 %, never hides them

  /** One sentence for the line under the picture; may use only legend words and labels; may not restate counts. */
  hint(core, view) { return 'Blocks on the outer ring; families of the open block on the inner ring.'; },

  /** REQUIRED, pure. Writes x,y in CSS px (stage origin top-left) for every wanted entity into out (Float32Array 2N), NaN otherwise.
   *  Called on lens enter, navigate, resize. Never per frame. Budget 16 ms for N = 11,825.
   *  Returns the camera home so double-tap / "home" is deterministic. */
  layout(core, view, out) { return { bounds:[x0,y0,x1,y1], home:{ pan:[0,0], zoom:1, rotate:0 } }; },

  /** REQUIRED. Edges to draw for this view. cls: 1 faint, 2 lit. Returns ≤ 4,000 instances. */
  edges(core, view) { return { a:Uint32Array, b:Uint32Array, kind:Uint8Array, cls:Uint8Array, w:Float32Array }; },

  /** Optional. Lens geometry (chord arcs, river bands, tile/card outlines) as quadratic segments, drawn by the shared segments program with category colour.
   *  Float32Array of [x0,y0,cx,cy,x1,y1,width,catIndex,cls] × k. Coordinates in the same space as layout(). */
  geometry(core, view) { return null; },

  /** REQUIRED. Entity indexes that may carry a DOM label this frame, ≤ max; the shell de-collides. */
  labels(core, view, max) { return new Uint32Array([...]); },

  /** Optional. Hit test for geometry only (arcs, bands, tiles, cards). Returns idx or -1. Nodes are always the shell's grid. */
  hit(core, view, x, y) { return -1; },

  /** Optional. Camera permissions. */
  camera(view) { return { pan:true, zoom:[0.5, 6], rotate:false }; },

  /** Optional. Constants for width ≤ 600 (radii, caps, rows). The shell stores the result in view.params. */
  simplify(width) { return {}; },

  /** Optional (table, column). Builds DOM inside host from core + view; positions must agree with layout() so the tween into and out of this lens starts from the tiles/cards.
   *  The overlay may call only shell.navigate(idx), shell.measure(idx), shell.compose(idx). */
  overlay(core, view, host) {},
  leave() {}
};
```

Shell sequence: `core.load()` → `lens.simplify(w)` → `lens.layout(core, view, posB)` → gather `lens.edges()` + `lens.geometry()` → tween `u_mix` 0→1 over 600 ms (ease-in-out cubic) → draw loop (uniforms only) → on pointer-up `lens.hit()` then the grid → `shell.navigate(idx)` → re-run `layout` into the off-screen buffer, tween again. Switching lens runs `layout` on the new lens with the SAME `view` (same focus, lit, trail, recipe): the same entity visibly travels from its ring angle to its tile, which is the whole demonstration that six lenses are one grammar. Registration fails loudly if `layout` leaves a wanted class unpositioned: `lens <id> left <k> <class> entities unanchored`.

---

## 3. Shared UI parts (one HTML file, one CSS file, one DOM order on every lens and both widths)

Vertical order at 430 px (desktop is the same DOM with the key panel docked right as a 320 px column and the stage larger):

1. **header** — `<h1>GLOBALGRID2050</h1>` (18 px) and the count sentence (11 px `#7da0c8`, wraps, never clips).
2. **#search** — one input, 44 px: placeholder `Search a name, #family, Sym, x-group or line number`. Resolver, in order: `^#?\d+$` → family; `^(L|line )\d+$` → line; `^[A-Z][a-z]$` → block; `^x\d+$` → group; else substring over `names.json`, ≥ 2 chars, shortest names first, 12 names × up to 3 families (core.js `mountSearch`). Empty → `No function name contains that text.` A bare number that is both a family and a line offers both chips.
3. **#trail** — `GLOBALGRID2050 › Ce · Cable corridor estimate › Pn · Pipeline News app › #8285 name`. It is visit history, not containment: `trailPush` dedupes consecutive repeats, each crumb truncates to that point and navigates, the root crumb is home. It lives in the shell, so it is the same array in every lens; on mobile it scrolls horizontally inside its own strip. Long-press a crumb shows `visited 3rd`.
4. **#legend** — seven chips, 14×3 px bar + word, fixed order and words from §0; chips a lens does not draw or whose data is not loaded at 35 % with a `title`. Tap a chip toggles that kind (`state.kindsOn`); long-press `used by` shows `the reversed reading of "uses" (families) and "depends on" (blocks)`. Below: 12 category chips; tap dims the others (`state.cat`).
5. **#stage** — the WebGL2 canvas + label layer + optional overlay. Width 100 %. Height `min(62vh, 640px)` mobile, `min(70vh, 760px)` desktop. `touch-action: none` on the stage only. Under it the hint sentence (11 px `#8b93a7`). The shell, not the lens, draws the journey polyline through every trail entity (cyan `#00e5ff` 1 px, dash 3 3, alpha 0.6) in every lens.
6. **#panel** — the key panel: bottom sheet on mobile (peek 40 vh, drag handle, drag up to 85 vh, swipe-down closes), docked right on desktop. Header = `core.label(key)` plus a class word (`block · group · family · line · category · repository`), never a `REPO` chip, never a dot. Provenance row (muted): `blocks.json <generated_utc> · index.json <generated_utc>` (+ `· pack <built_utc> sha256 <7>` when tier 2 loaded). Body by class:
   - block: eyebrow `<category title> · block <number>` in category colour; description; kind sentence (constant / engine / cartridge / layer / deeplink / app / tool / auto — table.html's text); `<functions> functions inside · lives in <repos> · first written <date>`; `· not agreed` when `state === 'UNSETTLED'`; chips `Block page ↗` (`stars/table.html?block=<Sym>`), `Live page ↗` (`live[0]`, only when recorded), `File at commit ↗` (`github.com/<files[0].repo>/blob/<commit>/<path>`), `Add to an app ↗` (`code-generator/?blocks=<Sym>`); sections `→ depends on (N)` (with `through <via>` when present), `← used by (N)`, `◂ contained in <category>`, `▸ found in (N)` repositories, `contains (N families)` paged 40 (`show 40 more (M left)`), `needs from elsewhere:` first 8 meanings in `#ffd54a`.
   - group: `x618 · (not yet named)` header, `off the table: the code-generator cannot pick it yet`, its families paged 40.
   - family: core.js `showFamilyPanel` verbatim (kind · N numbered lines · in R repositories · self-contained | needs context — as words, no dot; chips `◂ contained in <block>`, `Function page ↗`, `File at commit ↗ #L<first>-L<last>`, `Live page ↗` only when a place records one; `→ uses (N)`, `← used by (N)` paged 40; `Numbered lines (permanent keys)` rows `<key> │ <text>`, text lazy; `≡ shared line (N)` with the suffix `(loaded records only)` before tier 2 and `(whole pack · first 8 per line)` after) plus `? random link (p = 0.xx)` and `↔ entangled (N)` when present.
   - line: `line 34,201 · #8285 name · Pn`, the one line of text at its pinned place with the key in `#ffd54a`, the family's block quoted around it, `File at commit ↗ #L<n>`, `also in: #… (N others)` from `familiesOfLine`, and the sentence `128,369 distinct numbers in this pack · 250,174 unique per index.json`.
   - category: blurb, `contains (N blocks)`; repository: `contains (N blocks)` grouped by category.
   Missing data reads `not yet known` (never blank, never invented). Fixed footer with three 48 px buttons: `Navigate here`, `Measure` (loads text, expands to 85 vh), `Add to recipe`, and a fourth `Open in ▾` listing the other five lens words with the same key.
7. **#lensbar** — sticky bottom on mobile (56 px, six segments ≥ 71×56 px, word only), top-right on desktop; active segment has the cyan bottom rule. `[` / `]` and a two-finger horizontal swipe on the stage also switch lens.
8. **#tray** — the compose tray, 48 px, fixed directly above the lens bar: recipe chips in category colour with `×`, the count `3 blocks · 1 family · 1 line`, one button `Hand off →`. Empty: `Recipe: nothing yet · tap Add to recipe on any key`. Tap the tray to open the recipe sheet (§6).
9. **footer** — core.js `footer('<id>')`: `<id> · built <BUILT> UTC · live data: https://ventusltd.github.io/stars/blocks/, https://ventusltd.github.io/stars/code/, raw.githubusercontent.com · GLOBALGRID2050` + ` · lens <id> from <from>` + ` · pack <built_utc> sha256 <7>` when loaded.

---

## 4. Actions (four verbs, one implementation each in the shell, same gesture in every lens)

**NAVIGATE(idx)** — tap a drawn entity, a search chip, a trail crumb, a panel chip, a tile, a card; browser Back/Forward. Effect: `state.focus = idx`; `trailPush`; `lit` recomputed (1 hop over kinds in `kindsOn`); `history.pushState` (§5); `lens.layout` re-run and tweened; journey polyline redrawn. A family focus also makes its block the open block in every lens (v08 `openFam`). A line focus focuses its first family and lights the line row in the panel. Tapping empty stage does nothing (no accidental deselect); `✕` in the panel is home (`goHome`: focus −1, trail cleared, camera home).

**MEASURE(idx)** — long-press 450 ms on an entity, tap the focused entity again, right-click, or the panel's `Measure` button. Effect: `state.measure = idx`; the panel opens for that key and fetches its bucket / text; focus and trail do not move (Measure reads, Navigate moves). `replaceState`. Desktop hover shows a tooltip with the label only. The measured entity gets bit 16 in `lit` (no visual change beyond the panel).

**COMPOSE(idx)** — the panel's `Add to recipe` button, swipe-right on a tile or card, drag onto the tray on desktop, `+` key. Effect: append to `state.recipe` if absent; `lit` bit 4 set so the entity wears the recipe ring in every lens at once; tray chip; `replaceState`. `×` on a chip removes. Categories and repositories are not composable: the tray says `Compose takes blocks, groups, families and lines`.

**HAND OFF** — `Hand off →` in the tray: builds the URL in §6 and opens it in a new tab; also offers `Copy recipe` and `Copy command`. Nothing is built inside the star.

Context sheet (long-press 450 ms after Measure, or right-click): `Navigate here · Measure · Add to recipe · Open in: ring particle chord river table column · Copy link`.

Gestures: tap = pointer down/up within 6 px and 350 ms; one-finger drag = pan (rotate on ring and chord); pinch or wheel = zoom (0.5–6×) where `camera().zoom` allows; double-tap = home; two-finger horizontal swipe with < 10 % scale change = next/previous lens (else it is a pinch). Keyboard on desktop: `/` search, `1`–`6` lens, `Enter` measure focus, `+` add to recipe, `Backspace` pop trail, `Esc` close panel.

---

## 5. URL state

One page, query grammar (static hosting on GitHub Pages and globalgrid2050.com serves `index.html` for any query):

```
?lens=<ring|particle|chord|river|table|column>
&key=<class>:<id>                 the focus  (block:Pn · group:x618 · family:8285 · line:34201 · cat:news · repo:pipelinenews)
&trail=<key>,<key>,…              visit order, oldest first, ≤ 12 hops (older dropped from the URL, kept in memory)
&recipe=<key>,<key>,…             add order, ≤ 24 keys
&m=<key>                          measured key when the panel shows a key other than the focus
&edges=cdubsre                    legend toggles by initial (contains, depends on, uses, used by, shared line, random link, entangled); absent = all on
&cat=<id>                         category dim filter
&data=<yyyymmddhhmm>              blocks.json generated_utc the link was made against (e.g. 202609141956)
```

Rules:
- Written only by the shell, in that order, keys never encoded (ASCII, no spaces). Example: `?lens=column&key=family:8285&trail=block:Ce,block:Pn,family:8285&recipe=block:Si,block:Vn,family:8285&data=202609141956`.
- `pushState` on navigate and on lens switch (Back walks the journey and lens changes alike); `replaceState` on measure, compose, legend and category toggles (settings, not hops). `popstate` re-applies the whole query.
- Lens switch rewrites only `lens=`; key, trail, recipe survive — the lens tabs are literally links that differ in that one parameter.
- A key not in the published records: panel shows `Key <k> is not in the published records.` and the rest of the URL still applies. `data=` older than the live `generated_utc`: panel shows `link made against data of <date>`.
- Inbound compatibility, parsed once on load and rewritten with `replaceState`: `#family=<n>` → `key=family:<n>`; `#block=<Sym>` → `key=block:<Sym>`; `?block=<Sym>` (table.html) → `lens=table&key=block:<Sym>`; `?family=<n>` (code.html) → `lens=column&key=family:<n>`; `?graph=periodic-table&focus=<Sym · title>` (dashboard) → `lens=column&key=block:<Sym>` (matched by symbol first, then exact title, then case-insensitive title, table blocks only; unknown → home with `key not yet known`); `?blocks=Si,Vn` (picker) → `lens=table&recipe=block:Si,block:Vn`.
- Outbound links keep the other pages' own grammars unchanged: `stars/table.html?block=`, `stars/code.html?family=`, `ventus-grid-engine/?graph=periodic-table&focus=<Sym · title>`, `code-generator/?blocks=`, GitHub `blob/<commit>/<path>#L<a>-L<b>`.
- No names, no personal data in the URL; every token is a permanent number or symbol.

---

## 6. Compose mode and the hand-off to code-generator

A recipe is an ordered list of keys left behind by a walk. `state.recipe` mirrors to `recipe=` in the URL and, as a per-viewer convenience only, to `localStorage` in try/catch (never authoritative).

Resolution rule, printed in the tray: block → itself; group → itself, flagged `off the table: the code-generator cannot pick it yet`; family → its block (`famToGroup`) plus the family kept as a pinned family; line → its family → its block, the line kept as a highlight. Order is kept (the first block is the "main", as `presets.json` orders `substation-finder = Si,Vn,Ug,Ps,Dt`); reorder by drag on desktop, `▲▼` on mobile.

While composing: recipe entities wear the `#d8dee9` ring in every lens; a `depends on` edge between two recipe blocks is drawn lit so the recipe's own wiring is visible; `depends on` neighbours of recipe blocks are pre-lit at 0.8 so the likely next tap is obvious.

The recipe sheet (tap the tray): ordered chips; `needs from outside:` = union of `blocks[].needs[].name` over recipe blocks minus every name any recipe block's `inside` provides — the picker's own rule — worded `needs: 0` or `needs: 3 from outside · Blob, a web page, history` in `#ffd54a` text, never coloured green; then `pinned files`, one row per `files[]` entry of every recipe block: `repo/path @ commit7`, read from `blocks.json`, so what will leave the page is visible before it leaves; then three buttons.

`Hand off →` opens, in a new tab:
```
https://ventusltd.github.io/code-generator/?blocks=<Sym,Sym,…>&families=<n,n>&lines=<n,n>&from=star-generator&data=<yyyymmddhhmm>
```
`?blocks=` (table blocks only, recipe order) is the parameter the picker is proven to read (measured: `?blocks=Si,Vn` renders the cards). `families`, `lines`, `from`, `data` are proposals the picker ignores today; the sheet says so in the sentence `families and lines travel as notes until the picker reads them`. No commit travels in the URL: the picker takes commits from the same `blocks.json`, so none can be forged.

`Copy recipe` puts on the clipboard:
```json
{ "schema": "star-generator.recipe.v1", "made_utc": "...", "data": { "blocks_json": "<generated_utc>", "index_json": "<generated_utc>", "pack": "<built_utc or null>" },
  "keys": ["block:Si", "family:8285", "line:34201"],
  "blocks":   [{ "symbol":"Si", "number":22, "title":"…", "category":"…", "files":[{ "repo":"Ventusltd/gridatlas", "commit":"ece84811…", "path":"atlas/cartridges/…" }] }],
  "families": [{ "n":8285, "name":"…", "block":"Si", "place":{ "repo":"…", "commit":"…", "path":"…", "first":1, "last":40 } }],
  "lines":    [{ "key":34201, "family":8285, "repo":"…", "commit":"…", "path":"…" }],
  "needs":    [{ "name":"Blob", "meaning":"…" }],
  "trail":    ["block:Ce", "block:Pn", "family:8285"] }
```
Commits come from `blocks.json.files[].commit` and `code/f/<b>.json places[0].commit`; the star records them, it never chooses them.

`Copy command` copies the picker's own text verbatim: `gh workflow run generate.yml -R Ventusltd/code-generator -f name=<name> -f blocks=<Sym,Sym,…>` with the name normalised `[a-z0-9-]`.

Chemistry (`reactions.json`) is not shown in the star: verdict colours are forbidden here and the file was not fetched; the sheet links `pairs and apps that already mix these blocks ↗` to the picker.

---

## 7. Per-lens layout rules

All positions in CSS px of the stage, origin top-left; `S = min(w, h)`; `c = (w/2, h/2)`; `i` = block ordinal 0..209 (category order then number); mobile constants from `simplify(≤ 600)`.

### ring (from v08-ring-journey)
- Blocks at angle `(i + ½)·2π/210`, radius `RB = 0.42·S` (≈ 300 px at 700), rotated so the focus block is at 12 o'clock (rotate = camera, tweened). Categories at their sector mid-angles, radius `0.48·S`. Repositories off-picture (NaN). Groups: an outer faint band at `0.47·S`, evenly spaced, so every symbol has a place (labels on tap only).
- Families of the open block on the inner ring at `RF = 0.27·S`: all on desktop, ≤ 60 on mobile (`show 40 more` in the panel); families of other blocks NaN.
- Core disc `r = 0.15·S` drawn as geometry with the focus label inside.
- Edges: `depends on` out of the focus (yellow) and `used by` into it (pink) as quadratics through the centre with arrowheads; `contains` straight spokes from the block to its inner ring; `uses` / `used by` between inner-ring families; `shared line`, `random link`, `entangled` lit only; idle chords none. The v08 unlegended dashed teal line is gone: the only dashed cyan line is the shell's journey polyline.
- Sizes: block 3.2 / 6 (lit) / 9 (focus); family square 6 / 12. Labels: focus + lit + trail (≤ 12 on mobile). Camera: rotate + zoom, no pan.

### particle (from v03-particle-universe)
- Category `ci` gets sector `2π/12`; block `k` of `n` in it at radius `0.12 + 0.36·((k+1)/(n+1))^0.8` (unit), angle `a0 + span·(0.15 + 0.7·((k·0.618) mod 1))`, scaled by `1.05·S` (v03 formula verbatim). Groups as dim stars in an outer band at `0.52·S` in their sector; repositories as 31 muted points on the rim at `0.58·S`; categories at sector mid-angle `0.05·S`.
- Families of the focus block orbit on 4 rings (2 on mobile) at `rad + 16 + ring·18`, `0.25/ring` rad/s, computed in the vertex shader from `u_time` (`u_orbit = 1`); other families NaN.
- Star radius `2 + 0.55·√families` (+3 for focus); non-related stars dim to light 0.35.
- Edges: `depends on` / `used by` from the focus as 20 %-bowed quadratics; `uses` threads cross to other stars when a family is focused; `contains` not drawn (orbit is containment). The v03 unlabelled pink lattice is gone: `used by` threads run only to labelled stars.
- Camera: pan (6 px threshold) + zoom. Hit order: orbiting family before star. Labels: focus + lit + stars with `rad > 9`.

### chord (from v05-chord-dependencies)
- 210 arcs on `R = 0.40·S`, thickness 14 (18 on mobile so arcs are thumb targets), gap 0.004 rad, in ordinal order, as geometry in category colour; block node at the arc midpoint (`0.98R`); families NaN except the focus family (at its block); categories at sector mid-angle `1.08R`; groups and repos NaN.
- Edges: every `depends on` between table blocks (175) as quadratics through the centre, class faint (0.12, desktop 0.28) in the depending block's category colour when idle; on focus, chords out of the block lit `depends on` yellow 2 px, chords into it lit `used by` pink; family focus lights `uses` / `used by` chords between its block and the blocks of its uses/used-by families.
- Labels: focus + neighbours only (never the 210 rotated 5 px labels); on mobile a horizontal strip of the 210 symbols under the picture, in ordinal order, scrolls and navigates. Camera: rotate (drag brings any arc to the top) + zoom.
- Hint: `<N> depends-on chords between blocks on the table.` (the count moves here from the header).

### river (from v07-flow-repos + the idea of v09-line-river, without its 3,497 px)
- Desktop: three columns at `x = 0.15w / 0.50w / 0.71w` — repositories (31, alphabetical, evenly spaced), categories (12), blocks (all 210, evenly spaced over `H = max(stage, 210·14 + 40)`, page-scrolled). Mobile: three rows at `y = 0.12h / 0.50h / 0.85h`, bands vertical; the block row is paged 40 per screen with a `more` handle. Groups: a fourth thin band labelled `groups off the table (587)`, collapsed until tapped, so the block band is never mislabelled. Families NaN except the focus block's (a short fourth band below it).
- Geometry: bands as cubic curves (two stacked quadratics) with horizontal (desktop) or vertical (mobile) tangents; width `√n·2.2` for repo→category (`n` = blocks that repository carries into that category), 1.4 px category→block; category colour; faint until touched by the focus.
- Ribbon: when the focus is a family and its bucket has loaded, its numbered lines are drawn as ticks in key order on a rule under the band (green ticks where `familiesOfLine` says shared, grey otherwise, muted until tier 2).
- Edges: `contains` (the bands) plus `depends on` lit between the focus block and its neighbours. Tapping a repository or category is a NAVIGATE (trail + panel), not a highlight only. Camera: pan along the flow axis only.

### table (from stars/table.html + v04-periodic-arrows)
- DOM overlay: one section per category with the category rule in its colour; tiles `112×64` (`96×56`, 4 per row, at ≤ 600) in ordinal order; tile text = number (10 px muted), symbol (20 px bold), title, `<functions> functions` or `data only`, `· not agreed` when UNSETTLED; `border-top: 3px` category colour; focus tile cyan border + `0 0 0 1px rgba(0,229,255,.22)`; recipe tiles the white ring; auto blocks with `functions < 8` inside a collapsed `<details>` `found automatically (n)` per category as today. A final section `groups off the table (587)` paged 40. Repositories as a chip strip above the grid; categories are their section headers.
- `layout()` writes every tile's centre (measured after one reflow) so the tween in and out of the table starts from the tiles; families at their tile centre with NaN unless focused.
- Edges on the GL layer over the grid: `depends on` (yellow) and `used by` (pink) from the focus tile as 30 %-bowed quadratics, ≤ 30; `contains` hidden (the grid is containment); the recipe's own wiring between recipe tiles.
- The panel scrolls the focused tile into view above itself before opening (the table.html drawer that covered its own row is gone). `BLOCK 22` survives only as the small number on the tile and the panel eyebrow.

### column (from ventus-grid-engine column view + v10 single-line diagram)
- DOM overlay, native single column: the focus card (100 % × 96 px, cyan border) with the count line `depends on N · used by M · contains K · found in R` (only those words, only those edges); above it the section `→ depends on (N)` (for a family: `→ uses (N)`), below it `← used by (N)`; then `◂ contained in` (one card) at the very top and `▸ found in (N)` at the very bottom; for a family also `≡ shared line (N)`; for a line, the families carrying it. Cards 100 % × 64 px, left border 3 px in the legend colour of the edge that put them there, fill hint = category colour, one class word instead of a `REPO` chip, no dot. Segment `show: both · depends on · used by` (the grid-engine's Both/Outgoing/Incoming).
- Geometry: a 4 px busbar `#eef2fb` at x = 20 with one 30 px feeder per card in the legend colour and a 10×10 hollow square (v10's single-line diagram) — this IS the mobile drawing; on desktop a `spider` toggle lays the same cards out as a fan (focus centre, outgoing right, incoming left, straight spokes 1.8 px, drag-pan) from the same positions.
- Everything not on a card is NaN (no dust). `contains` always points container → member, in both the picture and the words, ending the flipped-direction fault. The breadcrumb is the shared trail, never a graph name.

---

## 8. Mobile rules (design width 430 px; measured profile Chrome 153, touch_points 1)

- Acceptance: `document.scrollWidth === innerWidth` at 430 on all six lenses (code.html's 473 and v09's 3,497 are the regression cases). No `overflow-x: auto` boxes with a `min-width` (v07's 720 px idiom is retired); every element `max-width: 100%`, `box-sizing: border-box`; text wraps (`overflow-wrap: anywhere`); the trail strip is the only horizontally scrolling element and it scrolls inside itself.
- Tap targets: every DOM control ≥ 44×44 px (lens segments 71×56, chips 32 px tall with 12 px gaps counted as target, panel buttons 48, `×` on tray chips 44); every stage hit resolved through the grid with radius ≥ 22 px, nearest wins, chooser sheet on ambiguity.
- Labels ≤ 24, 11 px, never rotated, never overlapping; everything else is revealed by zoom or tap.
- Panels are bottom sheets, never side panels; the picture stays visible above the sheet at peek height; swipe-down closes.
- Fixed bottom stack = lens bar 56 + tray 48 = 104 px; stage height `min(62vh, 640px)` so header, stage and the fixed stack fit a 900 px viewport without scrolling.
- Page scroll is never blocked outside the stage; `touch-action: none` only on the canvas.
- Per lens at 430: ring `RB 0.42·S`, inner ring ≤ 60, labels lit only; particle 2 orbit rings, no tooltip; chord arcs 18 px, labels focus + neighbours, symbol strip under the picture; river vertical, repo names truncated at 14 characters (full name on measure), block row paged 40; table 4 tiles per row at 96×56; column native single column, cards 64 px.
- Performance: first paint from tier 1 (blocks.json + families.json + index.json, ≈ 1 MB gzipped) before names.json and the pack; 60 fps target for 11,825 points and ≤ 4,000 segments; a frame-time guard (30 consecutive frames > 24 ms) drops faint-class edges first and says `edges drawn: lit only` in the footer.

---

## 9. What is claimed and what is not

Claimed:
- Every key is a permanent number or symbol already published by stars (`#n`, line numbers, block symbols, x-group symbols, category ids, repository names); a link written today resolves to the same key in any later pack, and `data=` records which pack made it.
- Every edge drawn exists in the data: `contains` from families.json/blocks.json, `depends on` from `blocks[].depends_on`, `uses` / `used by` from the family buckets, `shared line` from numbered-line keys, `random link` from random.json, `entangled` from entangled.json. Nothing is drawn that no file records; missing data reads `not yet known`.
- The six lenses are six `layout()` functions over one entity index; a lens switch keeps focus, trail, recipe and legend and tweens the same entities between positions.
- The hand-off puts block symbols in front of the code-generator picker through its proven `?blocks=` parameter; the pinned commits shown in the recipe sheet are the ones `blocks.json` records.
- Counts are computed from the live files; the two line figures (250,174 per index.json, 128,369 distinct / 664,940 instances per the pack) are both shown with their source.

Not claimed:
- The star does not generate code, run `gh workflow run`, write `apps/<name>/`, raise work orders, verify that a recipe builds, or choose commits.
- The picker does not read `families=`, `lines=`, `from=`, `data=` today; families, lines and off-table groups in a recipe travel as notes until it does, and the tray says so.
- Chemistry verdicts, RAG status and any red/green/amber judgement are not shown here.
- Entanglements: 69 stated, 40 listed, 29 not yet known. Random links are drawn but are not keys (they change with the daily seed) and no URL names one.
- The other pages (dashboard, table.html, code.html, the picker) keep their own vocabularies until they adopt this shell; the star only redirects their inbound grammars and links out with their outbound ones.
- Nothing has been measured on a physical phone; the 430 px evidence is desktop Chrome emulation.

---

## 10. Build order tonight and acceptance tests

1. `core.js`: loaders (tier 1), entity index, CSR edges (kinds 0, 1), `resolve/label/colour/countsLine`, lazy bucket edges (kind 2, 4), tier 2 pack loader behind a promise. Test: `countsLine()` equals the §0 sentence with live numbers; `resolve('family:2')` and `resolve('block:Cg')` return indexes; `edgesOf(block Cg, 1).length` equals `Cg.depends_on.length`.
2. `shell.js`: DOM skeleton §3, actions §4, URL §5, tween loop, grid picking, labels, the two programs. Test: one lens (`ring`) at 430 with `scrollWidth 430`; tap the first block writes `?lens=ring&key=block:At&trail=block:At` and the trail `GLOBALGRID2050 › At · Allowed technologies`; Back returns home.
3. Lenses in this order: ring, table (overlay pattern), column (overlay + geometry), chord (geometry + hit), particle (orbit uniform), river (paged band). Test after each: switching to and from `ring` keeps key, trail and recipe in the URL and tweens visibly.
4. Compose: tray, recipe sheet, needs rule, hand-off URL, copy JSON, copy command. Test: recipe `block:Si,block:Vn,block:Ug,block:Ps,block:Dt` opens `code-generator/?blocks=Si,Vn,Ug,Ps,Dt` and the picker renders five cards.
5. Grep tests over the lens modules: no `fetch(`, no `#[0-9a-f]{6}`, no `history.`, no `dependents`, no `REPO`. Grep over the whole page: the five legend words appear only with the hexes in §0.

---
---

# Deviations made in the build of 2026-09-14/15 (testcode/202609142225), and why

Everything above is the owner's spec, verbatim. Below is what the shipped page does differently, each with the reason. Nothing else deviates knowingly.

## Files
- **`shell.js` is `ui.js` + `gl.js`.** The task's file list names `ui.js` (header, search, legend, panel, tray, lens switcher) and `core.js` (data, WebGL2 buffers, hit testing, trail, URL state). The shell's DOM, actions, gestures and URL application live in `ui.js`; the WebGL2 programs and buffers live in `gl.js` (imported by `ui.js`) so `core.js` stays a pure data module that also runs under node (its §10.1 tests were run in node 24 against the live files). `core.js` holds the URL grammar (`readQuery`/`writeQuery`), the trail (`trailPush`) and the grid picking (`buildGrid`/`pick`); `ui.js` calls `history.*`. `core.js` is ≈ 300 lines, not 400, because the GPU code is in `gl.js`.
- **One extra file, `style.css`** — §3 says "one HTML file, one CSS file"; `index.html` links it.
- **Tier 2 data path is `../202609142202/data/`** (relative), not a copied `data/` folder — the owner's hard rule says to reuse that pack by relative path so the page works served from `globalgrid2050.com/testcode/`. The pack's `provenance.json` is read from there and its `lines.bin` sha256 (`5a0c365…`) is shown in the footer as the spec asks. Nothing was copied.
- `proof/` holds the puppeteer harness (`build-proof.mjs`, `grep-tests.sh`), its JSON report and the screenshots. Files already in `proof/` from an earlier session (`lens-grammar-proof.*`, `live-blocks.json`, `extract*.py`, `crops/`, other pages' screenshots) were left untouched.

## Data joins the spec did not know about
- **`random.json` and `entangled.json` number souls, not families.** Their `#N` keys are star-maker soul numbers (the pack's README documents that only 2 of 500 atoms share a number with a family of the same name). The spec's "family ↔ family from random.json" and "family → repository from entangled.json" are therefore made **by name**: the name part of the key (last path segment) is matched to the lowest-numbered family of that name in the pack's `families.json`. Measured on the shipped pack: random 300 edges → 79 drawn (both ends resolve to families); entangled 40 listed → 30 joined by name → 68 family→repository edges. The `random link` chip title states `300 random edges · 79 joined to families by name · seed 2026-09-14`; the `entangled` chip title states `69 stated · 40 listed · 29 not yet known` (from `entangled.json.soul_md`). Unjoined records are simply not drawn (nothing invented).
- **Groups have no category.** The pack's `families.json` gives `category: null` for every family whose block symbol is off the table, so `category → group` contains-edges do not exist and groups are drawn muted. They are placed by symbol order in every lens that shows them.
- **`depends_on` is 175 edges, all between table blocks** (none to groups) in the live `blocks.json` of 2026-09-14 19:56 UTC.
- **`familiesOfLine` shows how shared low line numbers are** (line 17 sits in 686 families). `shared line` therefore uses the spec's cap of 8 partners per line key, computed lazily per focus family and cached, not precomputed over the whole pack (that would be millions of pairs).

## GPU
- **A third program, `lines`, owned by the shell (not by any lens).** The acceptance item "(a) all lines resident on the GPU once (instanced)" contradicts §1's "lines stay on the CPU"; the acceptance item won. `gl.js` uploads all 664,940 line instances once (family index Uint32 + ordinal Float32 + shared flag Uint8 = 5,984,460 bytes) and draws them every frame as 1.5 px points in a golden-angle spiral around whichever families the current lens has positioned (family positions and lit bytes are read from two small textures updated with the position tween). Shared lines (a key carried by more than one family) are drawn in the `shared line` green; others in the family's category colour; alpha follows the family's light. Lenses cannot add a program; the two lens programs (points, segments) are as specified.
- **Geometry colour table has 21 entries, not 13**: 12 categories, muted, the 7 legend colours, the busbar `#eef2fb`. `core.GEOM = { muted:12, rel:13, shared:17, busbar:20 }` lets the column lens draw feeders in legend colours and the river ribbon draw green ticks without any hex literal in a lens (grep test passes).
- **Segment normals are computed in screen space** so widths stay in CSS px under the ring/chord rotation (a bug found in the proof run: with the layout-space normal, a −95° rotation made every arc a hairline).
- **Arrowhead = the last two vertices** (t = 15/16 widened to max(3·w, 5 px), t = 1 tapered), i.e. exactly the spec's "last two vertices"; an earlier three-vertex head read as a wedge on short chords.
- `u_bow` is not a uniform: the bow is a per-lens constant (`lens.curve = { mode:'centre'|'bow'|'straight', bow }`) applied on the CPU when control points are gathered, and geometry supplies its own control points.
- **Category dim (`state.cat`) is a lit bit (32)** that multiplies light by 0.4 in both shaders — light, never colour, as §0 requires.
- The frame-time guard, the 2D fallback (`draw2D`, no tween, footer sentence) and the label layer are as specified. The fallback was not exercised (the proof machine has WebGL2).

## Lens interface
- **`lens.always`** (new, optional) lists the classes a lens positions unconditionally; the registration check `lens <id> left <k> <class> entities unanchored` runs over `always`, not `wants`, because `wants` includes focus-dependent classes (families in every lens; every class in column, whose cards depend on the focus). Without this the spec's own ring rule "families of other blocks NaN" would fail its own check.
- **`overlay(core, view, host, shell)`** takes the shell as a fourth argument (`{ navigate, measure, compose }`); the spec listed those three calls but not how the overlay reaches them.
- **`view.pos`** (the positions the shell just laid out) and **`view.open`** (the open block: the focus block, or the focus family's block) are added to the view so `geometry()` can draw bands/feeders between positioned entities and every lens agrees on the open block.
- `layout()` may return `orbit: { parent, rings }`; the shell fills the per-family orbit attribute (ring, phase) so the particle orbit is computed in the vertex shader from `u_time` as specified.

## Per lens
- **ring**: the core disc is drawn as geometry; the "focus label inside" is not a separate DOM element (labels are placed only at entity positions); the focus label sits at the focus entity, and the hint sentence carries the state. The group band at 0.47·S is drawn as faint geometry with the 587 group nodes on it.
- **chord**: the 175 idle chords are drawn as **geometry** in the depending block's category colour (so they follow the category palette as the spec asks) and are omitted when the `depends on` legend chip is off; on focus, the chords touching the open block become legend-coloured edges. The mobile symbol strip is a lens overlay with `pointer-events:none` on the host so the canvas keeps its gestures.
- **river**: the mobile block row **pans** along the flow axis (camera `pan:'x'`) instead of paging 40 per screen with a `more` handle; the `groups off the table (587)` band is a fourth band drawn but not collapsed; repository names are not truncated at 14 characters (labels de-collide instead). The family ribbon draws up to 400 ticks. 
- **table**: the `groups off the table (587)` section is paged 40 with a `show 40 more` chip; the overlay rebuilds on every navigate (keeping its scroll position) rather than patching classes.
- **column**: the busbar, feeders and 10×10 hollow squares are geometry as specified; the desktop `spider` toggle exists and fans the same cards out (outgoing right, incoming left) with straight spokes drawn as legend-coloured edges. With no focus the column lists the 210 blocks in table order (so the lens is never empty).
- Mobile `simplify()` constants are as listed in §8 except the river paging noted above.

## Shell
- Navigate opens the key panel for the focus (without fetching text); Measure fetches the bucket and the text at the pinned commit and expands the sheet. This keeps §4's "Measure reads, Navigate moves" while giving the panel content the spec lists.
- On mobile the stage is scrolled to the top of the viewport when the sheet first opens, so the picture stays visible above the peek-height sheet (the header, search, trail and two legend rows are taller than the spec's budget assumed at 430×900).
- `Copy command` asks for the app name with a `prompt()` (normalised `[a-z0-9-]`); the spec did not say where the name comes from.
- The hover tooltip, chooser sheet, context sheet, keyboard shortcuts, two-finger lens swipe, pinch/wheel zoom, double-tap home, long-press measure are implemented but only the URL/DOM effects were measured headless; gestures were not exercised with synthetic touch events.
- `window.__star` exposes `core`, `state`, `G`, the current lens/view and three read-only helpers for the proof harness; it is inspection only.

## Repair round (review of 2026-09-15), what changed against the spec text above
- **A line key never picks a family for compose or hand-off (§6 "line → its family → its block").** `line:17` is carried by 686 families; the spec's rule is singular, the data is not. `core.resolveLine(n)` returns the family only when the line has exactly one, or when a person picked one in the sheet's chooser (`core.lineChoice`, memory only: the URL grammar has no slot for the choice and none was added). Until then the line stays in the recipe as a note, is excluded from `?blocks=`, and the tray, the sheet and `Copy recipe` say `line 17 · carried by 686 families · pick one` (`family: null, families_carrying: 686`). NAVIGATE to a line key still focuses its first family, as §4 says.
- **`shell.relayout(home)` is a fifth shell call an overlay may make** (§2 lists `navigate`, `measure`, `compose`): the column `show:` segment and `spider` toggle and the table's `show 40 more` chip redraw the lens through it, so a control is never a hop (no focus, trail or history change).
- **Count words in the tray are `2 blocks will travel (Ss, Vd) · #511 pinned as a note · line 17 · pick one`** instead of §3.8's `3 blocks · 1 family · 1 line`, so what leaves the page is said before it leaves; a recipe family's block wears the recipe ring in every lens (lit bit 4) and a dashed outline on tiles and cards (`derived`).
- **The panel's `✕` closes the panel** and keeps focus, trail and URL; home is the root crumb `GLOBALGRID2050` (title `home`). §3.6's "`✕` in the panel is home" made one glyph mean two things.
- **On a lens-tab tap on a phone the key panel closes**; on any other lens switch it drops from 85 vh to peek. A measured panel keeps its text across the switch (`panelMeasured`).
- **On phones the family panel puts `Numbered lines (permanent keys)` before `→ uses` / `← used by`**, and after Measure scrolls the panel body to the code box; long lines wrap with a hanging indent instead of a sideways scroll. Desktop keeps §3.6's order.
- **The table's repository strip is folded on phones** (`repositories (31)`, open when a repository is the focus): at 430 the 31 chips are 542 px tall, taller than the stage.
- **`[hidden] { display: none !important }`** in the stylesheet; the closed sheet had stayed a flex box over the stage.
- **`touch-action: pan-y` on tiles and cards** so swipe-right completes as compose on a phone (the browser no longer cancels the pointer).
- **The desktop panel spans from the search row** with `max-height: min(760px, calc(100vh − 130px))` so its foot buttons are never under the fixed tray (measured: the ✕ sat at y 897 of 900 before).
- The build stamp in the footer is written into `index.html` by `proof/publish.mjs` from the clock; `publication.json` is regenerated last and lists `DECISION.md`, `proof/bench.mjs` and `proof/repair-check.mjs` as shipped.

## Review round 2 (2026-09-15), the four fixes made before publishing

Each was found by reading the repaired page against this grammar, and each is now a check in `proof/final-check.mjs` (`proof/final-check.json`, 9 of 9 passing, 0 console errors, `scrollWidth` 430 at 430×900).

- **The category chip did not upload its dim.** §0 says the category filter is light, never colour, and the shell carries it as lit bit 32, set only inside `computeLit()`. The chip's click handler re-rendered the legend and re-laid out the lens but never called `computeLit()`, so the GPU kept whatever dim it last had: the first click dimmed nothing and un-clicking left the previous dim in place. The handler now calls `computeLit()` (which uploads through `G.setLit`) before the `replaceState`. Measured: 0 entities carrying bit 32 → 11,853 while a category is chosen → 0 again.
- **The legend kind chip did not refresh the lens geometry.** It called `computeLit(); gatherEdges();`, which rebuilds the edge list but not `view.kindsOn` and not `lens.geometry()`. The chord lens draws its 186 idle `depends on` chords as geometry gated on `view.kindsOn`, so they stayed on screen after the chip was switched off. The handler now calls `relayout('recipe')`, which rebuilds the view, the edges and the geometry and leaves the camera alone. Measured: chord geometry 400 with the chip on, 214 with it off, 400 on again.
- **The fold summary was 21 px, below the 44 px tap rule of §8.** The rule was written `.tb-cat details summary`, and the repositories fold *is* the `.tb-cat` element, so its own `<summary>` was never matched. The rule is now `.tb-cat summary { min-height: 44px; line-height: 44px }`, which covers the repositories fold and any "found automatically" fold. Measured 44 px at 430. DECISION.md keeps the pre-repair rows and adds the post-repair table beside them.
- **The newest recipe chip was clipped at 430 px** (the second chip showed 1.9 px and its `×` could not be tapped): `#tray .chips` was `overflow: hidden; flex: 0 1 auto`. It is now `overflow-x: auto; flex: 1 1 auto` with `height: 44px` (so the 44 px `×` fits whole inside it) and a hidden scrollbar (so the scrollbar takes none of that 44 px), and `renderTray()` scrolls the last chip into view. **The tray count is numerals** (`2 blocks · 1 note`), with the full sentence of the bullet above on the `title` of the count and of every chip, and in full in the recipe sheet — the narrow width forced the numerals; nothing that leaves the page is hidden, it is one hover or one tap away. Measured: the second chip's `×` is 44×44, inside the chips box, and `document.elementFromPoint` at its centre returns that button.

## Not verified
- Nothing on a physical phone; 430 px is Chrome 153 headless emulation (`isMobile`, `hasTouch`) at `deviceScaleFactor: 2` on a desktop GPU and a desktop compositor — a phone's GPU, thermal budget and 120 Hz panel are not modelled, and iOS Safari was not opened at all.
- SwiftShader was never measured: every run used ANGLE/D3D11 on an RTX 5070 Ti. What a machine without a usable GPU sees is unknown, and the 2D fallback (`draw2D`) was not exercised for the same reason.
- On the live data of 2026-09-14 19:56 UTC no category produces a "found automatically" fold, so the `.tb-cat summary` rule was measured on the repositories fold only; the other case is covered by the same rule but could not be measured today.
- The 600 ms tween is implemented (`u_mix` ease-in-out cubic, positions swapped after every layout) and the lens-switch screenshots show the same key, trail and recipe in every lens, but the tween was not filmed frame by frame.
- Frame time was not profiled beyond the guard (`G.frames`, `G.slow`, `G.litOnly` were read: the guard never tripped at 1440 or 430 in headless Chrome with the RTX 5070 Ti ANGLE/D3D11 renderer).
- `Copy recipe` / `Copy command` write to the clipboard; the JSON they would copy was read back through `__star.recipeJSON()` instead of the clipboard.
