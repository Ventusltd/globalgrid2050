# 202609142202 — Quantum Twin Star (testcode lab page) — generation 2

A read-only lab page: `index.html` + `quantum.js` (one ES module, WebGL2, no CDN, no framework, no build step).
It must be served over HTTP (the page fetches `data/*`; `file://` blocks fetch). It is not linked from any
corporate page and uses the owner's metaphor vocabulary only here, in testcode.

Vocabulary: the star-maker's 'soul' records are called states here; the file names are unchanged.

Generation 2 fixes every finding of the three round-2 verdicts (`_tools/qts-verdicts-round2.json`: GPU run,
physics critic, adversarial code review) and adds all 250,174 unique numbered lines of the estate as a second GPU
buffer. The section "Round-2 findings" below says what changed for each.

## What it is

- **The family sea.** `data/lines.bin` (664,940 little-endian Uint32 entries, grouped by family) is uploaded to
  **one** GPU buffer once (664,940 × 12 bytes = 7,979,280 bytes) and drawn every frame with
  `gl.drawArraysInstanced(POINTS, 0, 664940, 2)`: instance 0 is the principal star (left, or top on a phone),
  instance 1 the twin (every point reflected through the centre: angle + π, same radius, the within-family spiral
  offset reflected too; 40 % brightness). Positions are computed in the vertex shader from attributes (key, family
  index, occurrence index, block, category, seed), one square RGBA32F family texture and uniforms; the CPU does no
  per-point work per frame. Category sectors and block arcs follow `data/blocks.json` order with arc width ∝
  `blocks[].families`; families whose block symbol is off the table sit in a grey band at 1.04–1.12 R. This buffer
  is the family structure and is unchanged from generation 1.
- **The unique-lines band (new).** `data/all-lines.bin` (250,174 little-endian Uint32 permanent line numbers,
  ascending, from the public `LINES.md` export of 2026-09-14 19:56 UTC), `all-lines.family.bin` (Uint8, 1 = the
  line sits inside a function family of the published buckets) and `all-lines.len.bin` (Uint16 code length) are
  uploaded to a **second** GPU buffer once (250,174 × 8 bytes = 2,001,392 bytes: key u32, first family u16 or
  0xFFFF, flag u8, category u8) and drawn every frame with `gl.drawArraysInstanced(POINTS, 0, 250174, 2)` as the
  outermost band of both stars. The 121,805 lines outside every family sit in a grey band at 1.20–1.25 R at an angle
  given by their rank in the numbering (`gl_VertexID / u_n`); the 128,369 lines inside a family sit at their family's
  angle (family texture) at 1.155–1.185 R in the family's category colour, dim. The per-line jitter is a hash of the
  key computed in the shader. No stride subset is drawn unless the full allocation fails, and then the HUD prints
  how many are drawn. The HUD's first count line reads, verbatim: `on GPU: 250,174 unique numbered lines (LINES.md
  2026-09-14 19:56 UTC) + 664,940 family-line entries · 128,369 unique lines sit inside a function family, 121,805
  do not`; the second says that the 128,369 distinct numbers in the buckets equal the in-family unique lines and
  that `index.json`'s 250,174 equals LINES.md's count (the buckets alone reproduce only the in-family part).
- **The qubit.** Built from one atom's shell census (`data/electron.json`, 500 of 7,607 atoms carry records):
  θ from its K/L/M caller counts, sin²(θ/2) = M/(K+L+M), read from the shell counts recorded for this atom in
  electron/atoms.json (star-maker @c5bf5f6, 2026-09-13); this page does not recompute them. |0⟩ HOME = the next
  caller sits in the atom's own repository (K+L shells); |1⟩ AWAY = the next caller sits in another repository
  (M shell), **whether or not that repository holds a copy**. A *tunnel* (a caller in a repository holding no copy)
  is the valence subset: 106 of the 500 shipped atoms have one (`tunnelling: true`, `valence ≥ 1`), 394 have
  valence 0; the word "tunnel" appears on the page only where the atom's valence field says one exists. M counts
  callers, valence counts repositories (valence = M for 45 atoms, valence < M for 455). The census spin flag
  (paired = a test or proof calls it) only sets whether φ precesses; φ never enters the Born probability. The state
  is parameterised on the Bloch sphere, so it is normalised by construction (the HUD says so instead of printing a
  computed 1.000). Drag the sphere to prepare θ, φ by hand (unitary, no collapse); release relaxes to the data state
  over 2 s unless *hold* is on (hold = no automatic re-preparation; φ still precesses for an unpaired spin).
- **Measurement — a real projective collapse.** Tap the sphere, press *measure*, press Enter a second time on the
  same search, or press a bare Enter when no control has focus: r comes from
  `mulberry32(hash(seedString, stateNumber, drawCount))` (seed string `2026-09-14`, overridable with `?seed=`;
  drawCount advances on every draw, counted or not), outcome AWAY if r < sin²(θ/2) else HOME, printed as an
  auditable line prefixed `last measurement (Born audit):` with the θ it was measured at. **After the measurement
  the state is the pole** (θ = 0 or π; φ is then a global phase and is not shown — the state line prints
  "φ — (global phase at the pole, not a state parameter)"): the HUD prints P(home)=1.000/0.000, and a repeat
  measurement inside the window compares r against 0 or 1 and reproduces the outcome; "certain" is derived from
  that probability (P = 0 or 1), and a collapsed state whose θ was moved is measured afresh and marked "not counted".
  The 8-second *re-prepare* ring, or the *re-prepare* button, restores θ to the data value. The histogram (printed
  after 20) counts only measurements made on the prepared data state. The dot snaps to the pole in 120 ms
  (smoothstep in the shader), losing shells dim, winning shells flash. An AWAY outcome on an atom with
  `valence_repos` lights one of them with probability 1/valence and the Born line names it as a tunnel (this
  repository holds no copy; index and r printed; the dot is red-orange with a line to the M ring); an AWAY outcome
  on an atom with valence 0 prints "AWAY, not a tunnel: valence 0 — every outside caller sits in a repository that
  holds a copy (electron.json tunnelling=false)"; a HOME dims all bond dots. In the same frame the twin collapses to
  one candidate drawn from the stated distribution. Every collapse adds a vertex to a journey strip (cap 4,096, CPU
  copy kept for a context restore) and a chip to the record strip (append-only, the DOM keeps the last 200 chips).
- **A click on a sea point steers only.** It sets the focus, highlights the entry in both stars and opens the lines
  panel; it never measures. Record chips re-steer (join line and message printed), they do not re-measure.
- **The twin distribution** (tier and rule printed in the HUD): (1) the state is in `data/entangled.json` → this
  page's rule, a lookup in the pack and not a correlation: on AWAY the twin is the *defining* repository (q=1, no
  draw); on HOME one of the `called_from` repositories, 1/N each, the index drawn with a printed r; when an AWAY
  also lights a valence repository the HUD says that two dots are lit and what each is; (2) else Random-star edges
  touching the state in `data/random.json` → maker-draw edges with their published p **renormalised to sum to 1
  (classical weights q = p/Σp, nothing squared)**, or uniform when only the stars draw (no p published) has edges;
  when an atom has edges in both draws only the maker edges are used and the HUD prints how many stars-draw edges
  were left out (39 shipped atoms have both); an ENTANGLED_MAYBE partner at weight p is taken with probability p,
  else an independent draw over all candidates, and the HUD prints the effective P(partner) = p + (1−p)·q;
  (3) else the atom's `valence_repos`, 1/valence each, labelled "valence: N repositories call it without holding a
  copy … M counts callers, valence counts repositories"; (4) else uniform over the 664,940 entries ("pure chance").
  Joins by "#N" between the state register (file SOUL.md) / random.json and the census are checked by name at load (36/36 entanglements,
  180/180 nodes agree in this pack; a disagreeing entanglement would not be joined) and the counts are printed.
- **The electron sibling.** Nucleus dot; K/L/M rings with the real electron counts drawn by
  `drawArraysInstanced(POINTS, 0, 512, 3)` (gl_InstanceID is the shell; if any shell exceeds 512 every k-th electron
  is drawn and a label says so); labels "K same dir", "L same repo", "M other repos" and a valence badge
  "valence N: repositories calling it that hold no copy" (the list is a HUD line); 23 repository dots on an arc,
  bonds from `electron.json.bonds` (which equal `valence_repos` for all 500 atoms), spin arrows, class badge with
  counts from `totals.classes_electron_md`, a red badge for unpaired-and-bonded atoms gated on valence ≥ 1.
- **Search** (`#N`, `line N` or a name) first matches a family key, then a permanent line number in LINES.md, then
  a shipped state number, then a family or atom name; `line N` forces the line-number path when N is also a family
  key (the message says so). A line number is lit in the unique band on both stars; inside a family the family is
  steered to as well (lines panel, fetch button as before); outside every family the panel says that no family
  record holds it, so no source place is known and nothing is fetched. Search steers; it never collapses. A second
  Enter measures only when the same search steered to a focus that has an electron record: `lastQuery` is set only
  by a search that steered, and cleared by a no-match, so a second Enter after a no-match cannot measure the
  previous focus. A bare Enter outside the search box measures only when no button, input, select or link has
  keyboard focus. Tapping a sea point runs a one-off pick pass into an RG32UI framebuffer (1×1 scissor on desktop,
  8×8 on phones); both stars are pickable, the unique band is not (search finds it).
- **Only 983 of 10,985 families can be measured.** An atom is joined to a family by name only (state numbers and
  family keys are different numberings), and only 500 atoms ship shells. A family with no name-matched atom — e.g.
  `#80299 haversine` — is steered to, its keys are listed, and the HUD says "shells not shipped … nothing to
  measure"; θ is never synthesised. A measurable example: `renderTable` (family #1284, 6 atoms carry the name, state
  #3859 shown first). The count 983 is computed by the page from the pack and printed in the caveats line.
- **External requests.** After load the page makes **no** external request unless (a) the *cable* toggle is on —
  then after a measurement the family's bucket JSON is fetched from the URL recorded in `data/provenance.json`,
  **once per bucket, retried only after a failure** (a rejected fetch is dropped from the cache), the received bytes
  are hashed with `crypto.subtle` and compared with `provenance.sources[].sha256`; **a bucket whose hash does not
  match, or cannot be computed, is not used**: the HUD prints "record not used, nothing fetched further", no number
  from it reaches the page and the line-text button fetches nothing — or (b) the *fetch line text* button is
  pressed, which uses the same verified bucket record and then fetches the source from
  `raw.githubusercontent.com/<repo>/<commit>/<path>` (`places[0]`) at the pinned commit. Line text is never shown
  unless fetched this way. The cable toggle defaults to **off**.
- **WebGL context loss.** `webglcontextlost` is handled (preventDefault, nothing drawn, the HUD prints "WebGL
  context lost: 0 entries on GPU, nothing drawn"); on `webglcontextrestored` every GL object is rebuilt from the
  CPU-side data (both VBOs, the family texture, the pick framebuffer, the journey strip) and the HUD prints
  "context restored after N s: buffers re-uploaded".
- **Phone and rotation.** The phone layout (stars stacked, HUD below the canvas) is decided by
  `matchMedia('(max-width:430px)')` re-read on every resize, so a rotation switches layouts live; a short
  side-by-side canvas (a rotated phone, canvas height < 520 px) uses a smaller sphere and a sparse label set. On a
  phone the class, valence and red badges and the band caption are printed in the HUD ("atom:" and "bands:" lines)
  because the ring's hole has no room for them; DPR is fixed at load. Table sizes (blocks, categories, family count,
  family-texture size) are read from the pack and asserted against the GPU layouts (u8 block/category with one
  off-table slot, u16 family index with 0xFFFF = none, a power-of-two square texture); a pack that exceeds them
  fails at load with a message rather than mis-colouring.
- **No WebGL2:** a 2D canvas draws the focus atom's sphere and shells and says the sea needs WebGL2 (not exercised in
  a browser without WebGL2).

## Round-2 findings and what changed

1. |1⟩ pole renamed **AWAY** everywhere (labels, HUD, Born line, record chips, twin rule, about panel, README);
   "tunnel" only where gated on `valence`/`tunnelling` (`RED_BADGE`, the lit-repo step, the state line's
   "a TUNNEL is possible only where valence ≥ 1 … this atom has valence N" / "no tunnel possible: valence 0").
2. The false "census ships tunnelling atoms only" sentence replaced by numbers computed in `loadData`
   (`atomsTunnelling`, `atomsValence0`, `atomsValence0M`, `distinctTriples`) and printed in the caveats line and the
   about panel.
3. Shell label "M other repos" plus a valence badge from `a.valence` / `a.valence_repos`; the VALENCE tier label
   reworded ("M counts callers, valence counts repositories").
4. θ attributed, not vouched: "θ from the shell counts recorded for this atom in electron/atoms.json (star-maker
   @c5bf5f6, 2026-09-13); this page does not recompute them" (commit and date read from `electron.json`).
5. Cable: `cableFetch` and `fetchLineText` refuse a bucket unless `sha` is present and matches (`verified(b)`).
6. `webglcontextlost` / `webglcontextrestored` handled (`onContextLost`, `onContextRestored`, `allocPick`); the
   frame loop draws nothing while lost.
7. `doSearch` sets `lastQuery` only on a steer and clears it on a no-match; the window keydown handler returns when
   a control has focus.
8. φ at the poles printed as a global phase, not a number; φ wording derived from the actual condition (frozen /
   by hand / precessing / still); "certain" derived from P = 0 or 1; "hold" wording corrected.
9. `G.phone` re-evaluated in `resize()`; phone label set re-laid (no overlaps at 430 px, none outside the canvas);
   compact set for a rotated phone; explicit widths for wrapping captions.
10. `D.NB`, `D.NC`, `D.texW` derived from the pack and injected into the shader sources; load-time assertions.
11. This README rewritten to match the code ("once per bucket, retried only after a failure", bare Enter, stars-draw
    exclusion, click steers only, the entangled-states rule as a picture).
12. HUD line prefixed "last measurement (Born audit):"; a click on a point steers only (kept).
Also: chip re-steer prints its join line and a message; the entangled-states HOME twin note names one of the called_from
repositories (no "local copy or dead"); "two dots lit" sentence after an AWAY in the entangled-states tier; the entangled-states
"correlation" sentence moved to the picture list and reworded; name-agreement check on the "#N" joins; the
acceptance example is a measurable family (`renderTable`), since haversine has no shipped atom and θ is never
synthesised.

## Data sources (all public; pinned in `data/provenance.json`)

- Pack built 2026-09-14T22:14:00Z by `build_state.mjs` from `https://ventusltd.github.io/stars/` (code/index.json,
  code/names.json, blocks/blocks.json, blocks/families.json, 160 bucket files code/f/*.json, spider/graphs/random.json)
  and `raw.githubusercontent.com/Ventusltd/star-maker/c5bf5f6518feba594bb057988e8e99ca81044952/…`
  (electron/graph.json, electron/atoms.json, random/graph.json, soul/graph.json, SOUL.md, ELECTRON.md); amended
  2026-09-14T22:57:08Z by `amend_pack.mjs` (focus_default, conduction band, bucket size — see generation 1).
- **Generation 2 adds** `https://ventusltd.github.io/stars/LINES.md` (22,142,736 bytes, sha256
  `406c929e76e0ae79853fe486b8f4de328268648ee1e9bfe737b6d2855fc30abb`, fetched 2026-09-14T22:44:05Z by
  `_tools/all-lines/build_all_lines.mjs`; header: "250,174 unique lines, numbered 1 to 342,795. Generated
  2026-09-14T19:56:58.242Z by the modular star"), recorded in `provenance.sources`, and its derived binaries recorded
  in `provenance.outputs` by `proof/add_all_lines.mjs` (which also re-derives the counts from the copied files):
  - `all-lines.bin` 1,000,696 bytes `8291d2680e43506fd5bda23428bc9906458ed38413fc2c206d32c4b9952b2762`
  - `all-lines.len.bin` 500,348 bytes `2481540d45540a6963efb17c95ff8e9c9bd61359043d4e1ebd31f4742721e118`
  - `all-lines.family.bin` 250,174 bytes `8bfa485b45f849dccebefd3da33f2ecf4ca14c740487ec47f598bcc4e448c2a8`
  - `all-lines.meta.json` 812 bytes `ca2b6af2539c43fb93ac4d7e7d834b6c38b51779b81ce1975782edd78520556a`
  - `provenance.checks`: all_lines 250,174 (distinct 250,174, ascending, min 1, max 342,795), in a family 128,369,
    outside 121,805, lines_md_generated_utc 2026-09-14T19:56:58.242Z.
- Generation-1 outputs unchanged (sha256 in `provenance.json → outputs`): `lines.bin` 2,659,760 bytes
  `5a0c3659…`, `families.json` 2,221,286 bytes `f055ef68…`, `blocks.json` 54,861 bytes `245b741a…`,
  `electron.json` 221,272 bytes `2ade7197…`, `random.json` 120,639 bytes `2163aa56…`, `entangled.json` 7,229 bytes
  `dd605adb…`.
- **The pack's own ship-limit check still fails:** `provenance.checks.mismatches` records shipped data over the
  3,500,000-byte limit; generation 2 adds 1,752,030 bytes more. The full binaries were kept rather than changing
  their semantics; the page loads them whole.
- The *prove it* button hashes both binaries in memory with `crypto.subtle` and prints each next to its provenance
  hash, plus both VBO byte lengths, the two draw calls and a CPU checksum (sum of all family-sea keys).

## What is exact and what is a picture

Exact: one normalised qubit with θ from the shell counts recorded for the atom (attributed to star-maker, not
recomputed); the Born rule with an auditable r; a collapse that leaves the state at the pole so a repeat reproduces
the outcome; measurements on the prepared data state converge to cos²/sin²; the twin is sampled from a stated,
seeded distribution whose tier, rule and probabilities are printed; every line entry the buckets publish and every
unique line in LINES.md is resident on the GPU and drawn every frame.

Picture / caveats: the twin star is the same buffers drawn reflected through the centre — a deterministic mirror image
that pictures the singlet's antipodal correlation; no second qubit is modelled, no measurement is made on the twin and
no correlation is computed; Entangled states are one definition called from other repositories and the twin rule
for them is this page's lookup, not a correlation, with no signal because nothing is transmitted; φ is decorative and a
global phase at the poles; shells are directory/repo layers; "tunnelling" is electron.json's valence subset; the 8 s
timer is re-preparation, not decoherence; no Bell test exists here (one qubit, one measurement basis, no second party
— nothing on this page tests quantum mechanics); Random-star edges are prompts, not findings; only 500 atoms and 40 of
69 entanglements are shipped; all 500 shipped atoms have M>0 and 48 have K+L=0 (every shipped atom has a caller
outside its home directory and repository, so no pure |0⟩ data state can appear); 151 of the 500 atoms share the
shell triple 27/60/61 (142 distinct triples), and how star-maker counts shells is not verified here; entries in large
families are drawn fainter (alpha × √(40/lineCount), floor 0.12).

## Verified (headless Chrome, `proof/gen2.mjs` → `proof/gen2.json`, `proof/gen2.stdout.txt`, run 2026-09-15 local)

- `node --check quantum.js`: ok. Server `python -m http.server 8875 --bind 127.0.0.1` from the repo root, stopped
  with `taskkill /T /F` afterwards; no LISTENING socket on 8875 after the run.
- Renderer (unmasked, page's `S.renderer` and a fresh context): `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti
  (0x00002C05) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- 1440×1000: HUD count line verbatim as above and equal to the string rebuilt from the files on disk; VBOs
  7,979,280 + 2,001,392 bytes; 11 draw calls idle; fps 59.7 over 3 s of rAF (181 frames; vsync-capped); scrollWidth 1440;
  0 console messages, 0 page errors, 0 failed requests; the only external request of the run was the forged bucket,
  answered locally by the probe (see below); 12 DOM labels, no pairwise overlap, none outside the canvas.
- Enter after a no-match (`#999999999`): `lastQuery` is "", the second Enter measured nothing (0 → 0).
- `line 1` steers to a line outside every family (key lit, famIdx −1, panel says nothing to fetch); `#2` steers to
  family #2 and points at `line 2`; `line 2` steers to the line (inside 36,545 families, family #10 shown).
- A click on a visible point steered (message "#N · family #…") and left the Born line unchanged.
- `renderTable` + Enter steered to state #3859; a second Enter measured (0 → 1): `last measurement (Born audit):
  measured #3859 renderTable: AWAY · r=0.395 < sin²(θ/2)=0.435 at θ=82.5° (prepared data state, counted) · seed
  169826742 = hash("2026-09-14", 3859, 0) · AWAY, not a tunnel: valence 0 — every outside caller sits in a repository
  that holds a copy (electron.json tunnelling=false)`; the state line then read "φ — (global phase at the pole, not a
  state parameter)" and "φ frozen at the collapse".
- Bare Enter with the *hold* button focused: hold toggled, nothing measured; with the body focused: one measurement.
- Forged bucket (the bucket URL answered locally with 3 lines / 3 repos and an ACAO header, raw.githubusercontent
  answered with dummy text): the cable line read "live bucket differs from the pack (sha256 mismatch …): record not
  used, nothing fetched further", `S.liveRec` null, the line-text button printed the same refusal, showed no dummy
  line and made no request to raw.githubusercontent.com.
- Context loss via `WEBGL_lose_context`: while lost the HUD read "WebGL context lost: 0 entries on GPU, nothing
  drawn" (no "on GPU" line, `seaDrawn` 0); after `restoreContext()` the count line was back verbatim, both buffers
  re-uploaded, the journey strip kept its 3 vertices, 116 lit pixels in a 64×64 patch around the sphere, 0 errors.
- *prove it*: in-memory sha256 of `lines.bin` and `all-lines.bin` both match provenance.
- 430×900 (touch): count line verbatim; fps 59.9; scrollWidth 430 (body 430); HUD `position: static`; 6 labels, no
  overlap, none outside the canvas; full VBOs (no stride); 0 console errors.
- Rotation 430×900 → 900×430 in the same page: `G.phone` false, HUD `position: absolute`, canvas 866×387 css,
  stars side by side (c0 260,194 · c1 658,194 · R 132 · sphere 62), 6 labels, no overlap, none outside the canvas,
  sphere handle inside the canvas, scrollWidth 900, fps 59.9, 0 console errors; the HUD is narrower and starts
  collapsed there (tap to expand) so it does not cover the atom badge.
- Screenshots: `proof/gen2-1440.png`, `proof/gen2-430.png`, `proof/gen2-900x430.png`.

## Not verified

- A real phone (touch, DPR 2, GPU budget) — only the 430 px emulation in headless Chrome (DPR 1 this round; DPR 2
  was verified in round 2 on generation 1).
- fps above 60 (headless Chrome is vsync-capped); the phone ≥30 fps target.
- The 7,107 atoms and 29 entanglements not shipped in the pack; how star-maker computes the K/L/M counts.
- The WebGL2-unavailable fallback was not exercised in a browser without WebGL2.
- A live (network) sha256 mismatch on the cable path — only the locally forged one.
