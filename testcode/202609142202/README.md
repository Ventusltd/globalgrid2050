# 202609142202 — Quantum Twin Star (testcode lab page) — repair round 1

A read-only lab page: `index.html` + `quantum.js` (one ES module, WebGL2, no CDN, no framework, no build step).
It must be served over HTTP (the page fetches `data/*`; `file://` blocks fetch). It is not linked from any
corporate page and uses the owner's metaphor vocabulary only here, in testcode.

## What it is

- **The sea.** `data/lines.bin` (664,940 little-endian Uint32 entries, grouped by family) is uploaded to **one**
  GPU buffer once (664,940 × 12 bytes = 7,979,280 bytes) and drawn every frame with
  `gl.drawArraysInstanced(POINTS, 0, 664940, 2)`: instance 0 is the principal star (left, or top on a phone),
  instance 1 the twin (every point reflected through the centre: angle + π, same radius, the within-family spiral
  offset reflected too; 40 % brightness). Positions are computed in the vertex shader from attributes (key, family
  index, occurrence index, block, category, seed), one 128×128 RGBA32F family texture and uniforms; the CPU does no
  per-point work per frame. 12 category sectors and 210 block arcs follow `data/blocks.json` order with arc width ∝
  `blocks[].families`; 1,689 families whose block symbol is off the table sit in a grey outer band.
- **The qubit.** The spin of one atom from `data/electron.json` (500 of 7,607 atoms carry records).
  |0⟩ HOME = answered from its own repository (K+L shells), |1⟩ TUNNEL = answered from a repository holding no
  copy (M shell). θ is fixed by the census, sin²(θ/2) = M/(K+L+M); φ is 0 for a paired spin and precesses for an
  unpaired one (decorative). The state is parameterised on the Bloch sphere, so it is normalised by construction
  (the HUD says so instead of printing a computed 1.000). Drag the sphere to prepare θ, φ by hand (unitary, no
  collapse); release relaxes to the data state over 2 s unless *hold* is on.
- **Measurement — a real projective collapse.** Tap the sphere, press *measure*, or press Enter a second time on the
  same search: r comes from `mulberry32(hash(seedString, soulNumber, drawCount))` (seed string `2026-09-14`,
  overridable with `?seed=`; drawCount advances on every draw, counted or not), outcome TUNNEL if r < sin²(θ/2)
  else HOME, printed as an auditable line with the θ it was measured at. **After the measurement the state is the
  pole** (θ = 0 or π, φ kept): the HUD prints P(home)=1.000/0.000, and a repeat measurement inside the window
  compares r against 0 or 1 and reproduces the outcome with certainty (printed as "repeat … again (certain)", not
  counted). The 8-second *re-prepare* ring, or the *re-prepare* button, restores θ to the data value. The histogram
  (printed after 20) counts only measurements made on the prepared data state; draws made by hand, during relaxation
  or as repeats are counted separately as "not counted". The dot snaps to the pole in 120 ms (smoothstep in the
  shader), losing shells dim, winning shells flash. A TUNNEL lights one `valence_repos` entry with probability
  1/valence (the index and r are printed; the lit repo dot is drawn red-orange with a line to the M ring); a HOME
  dims all bond dots. In the same frame the twin collapses to one candidate drawn from the stated distribution.
  Every collapse adds a vertex to a journey strip (cap 4,096) drawn on both stars and a chip to the record strip
  (append-only, the DOM keeps the last 200 chips; chips re-steer, they do not re-measure).
- **The twin distribution** (tier and rule printed in the HUD): (1) the soul is in `data/entangled.json` → on TUNNEL
  the twin is the *defining* repository (q=1, no draw); on HOME one of the `called_from` repositories, 1/N each, the
  index drawn with a printed r; (2) else Random-star edges touching the soul in `data/random.json` → maker-draw edges
  with their published p **renormalised to sum to 1 (classical weights q = p/Σp, nothing squared)**, or uniform when
  only the stars draw (no p published) has edges; an ENTANGLED_MAYBE partner at weight p is taken with probability p,
  else an independent draw over all candidates (which still includes the partner), and the HUD prints the effective
  P(partner) = p + (1−p)·q; (3) else the atom's `valence_repos`, 1/valence each, labelled with the atom's K/L/M
  counts; (4) else uniform over the 664,940 entries ("pure chance").
- **The electron sibling.** Nucleus dot; K/L/M rings with the real electron counts drawn by
  `drawArraysInstanced(POINTS, 0, 512, 3)` (gl_InstanceID is the shell; if any shell exceeds 512 every k-th electron
  is drawn and a label says "1 in k electrons drawn"); 23 repository dots on an arc, bonds from `electron.json.bonds`,
  spin arrows (paired two opposed, unpaired one), class badge with counts from `totals.classes_electron_md`, red badge
  for unpaired-and-bonded atoms.
- **Search** (`#N` or a name) first matches a family key, then a permanent line number, then a shipped soul number,
  then a family or atom name. Search steers (highlights, re-targets, re-samples); it never collapses. A second Enter
  measures only when the same search steered to a focus that has an electron record; if the focus changed by any other
  means (tap, band, record chip) Enter steers again. Tapping a sea point runs a one-off pick pass into an RG32UI
  framebuffer (1×1 scissor on desktop, 8×8 on phones); both stars are pickable and a twin hit is prefixed "twin star:".
- **Only 983 of 10,985 families can be measured.** An atom is joined to a family by name only (soul numbers and family
  keys are different numberings), and only 500 atoms ship shells. A family with no name-matched atom — e.g. `#80299
  haversine` — is steered to, its keys are listed, and the HUD says "shells not shipped … tap steers, nothing to
  measure"; θ is never synthesised. The count 983 is computed by the page from the pack and printed in the caveats
  line, not typed.
- **External requests.** After load the page makes **no** external request unless (a) the *cable* toggle is on — then
  after a measurement the family's bucket JSON is fetched from the URL recorded in `data/provenance.json`, at most once
  per bucket for the life of the page, the received bytes are hashed with `crypto.subtle` and compared with
  `provenance.sources[].sha256`, and the HUD prints match/mismatch, byte count and round-trip time — or (b) the
  *fetch line text* button is pressed, which uses the same cached bucket record and then fetches the source from
  `raw.githubusercontent.com/<repo>/<commit>/<path>` (`places[0]`) at the pinned commit. Line text is never shown
  unless fetched this way. The cable toggle defaults to **off**.
- **No WebGL2:** a 2D canvas draws the focus atom's sphere and shells and says the sea needs WebGL2 (not exercised in
  a browser without WebGL2).

## Numbers that used to be code literals and are now read from the pack

`amend_pack.mjs` (run once, 2026-09-14T22:57:08Z) re-fetched three of the pack's public sources — `code/index.json`,
`electron/graph.json`, `ELECTRON.md` — verified their sha256 against `provenance.sources` (all three matched the
pack build byte for byte) and added: `electron.json.focus_default` (`"#2039 Number"`, verbatim from
electron/graph.json), `electron.json.conduction_band_electron_md` (the 7 conductors in ELECTRON.md's "## Conduction
band" order) and `provenance.checks.index_bucket_size` (500) / `index_buckets` (160 entries). `build_state.mjs` now
ships the same fields on a full rebuild. `quantum.js` reads the default focus, the band order, the bucket size and
`totals.atoms_shipped` from the pack; `index.html` no longer carries a hand-typed build time — the footer prints
`provenance.built_utc` and the amendment time.

## Data sources (all public; pinned in `data/provenance.json`)

- Pack built 2026-09-14T22:14:00Z by `build_state.mjs` from `https://ventusltd.github.io/stars/` (code/index.json,
  code/names.json, blocks/blocks.json, blocks/families.json, 160 bucket files code/f/*.json, spider/graphs/random.json)
  and `raw.githubusercontent.com/Ventusltd/star-maker/c5bf5f6518feba594bb057988e8e99ca81044952/…`
  (electron/graph.json, electron/atoms.json, random/graph.json, soul/graph.json, SOUL.md, ELECTRON.md).
  Each source URL's bytes, sha256 and fetch time are in `provenance.json → sources`; the amendment is in
  `provenance.json → amendments`.
- Pack outputs (sha256 from `provenance.json → outputs`, re-hashed from disk after the amendment, all match):
  - `lines.bin` 2,659,760 bytes `5a0c36595ccddfff5852fae262a3b69885d94981c83e683e0b4d9c0c7012c83a`
  - `families.json` 2,221,286 bytes `f055ef68089db83b0d7d3016b8dd704df46d6f24d377d43d6ec2f8b8d59dda54`
  - `blocks.json` 54,861 bytes `245b741afd2fb7ecb3cbbe844f0c655df69f88169ca51ac5fc9ae766030b6e3f`
  - `electron.json` 221,272 bytes `2ade71978b4502f0b7adee49aa5f6d4fb7a3d5f22efc34c6d8796e2a3ef5d9e3` (amended; was
    221,018 bytes `944f7fe0…`)
  - `random.json` 120,639 bytes `2163aa5662628470cb57d27f4fdb2e0b553550c07586cedf3e195bc03c959b3f`
  - `entangled.json` 7,229 bytes `dd605adbae674dbc4c377ac2de920dac42415e17978e43667eaf669ddab797e9`
- **The pack's own ship-limit check failed and still fails:** `provenance.checks.mismatches` records "shipped data
  5,284,793 bytes exceeds limit 3,500,000" (5,285,047 after the amendment). The full per-family `lines.bin` was kept
  rather than changing its semantics; the page loads it whole.
- The *prove it* button hashes the `lines.bin` bytes in memory with `crypto.subtle` and prints the hash next to the
  provenance hash, plus the VBO byte length, the draw call and a CPU checksum (sum of all keys).

## What is exact and what is a picture

Exact: one normalised qubit with θ from the real shell census; the Born rule with an auditable r; a collapse that
leaves the state at the pole so a repeat reproduces the outcome; measurements on the prepared data state converge to
cos²/sin²; the twin is sampled from a stated, seeded distribution whose tier, rule and probabilities are printed;
SOUL entanglements are one definition called from other repositories — perfect correlation by construction, no signal
needed; every line entry the buckets publish is resident on the GPU and drawn every frame.

Picture / caveats: the twin star is the same buffer drawn reflected through the centre — a deterministic mirror image
that pictures the singlet's antipodal correlation; no second qubit is modelled, no measurement is made on the twin and
no correlation is computed; φ is decorative; shells are directory/repo layers; "tunnelling" is a name; the 8 s timer is
re-preparation, not decoherence; no Bell test exists here (one qubit, one measurement basis, no second party — nothing
on this page tests quantum mechanics); Random-star edges are prompts, not findings; only 500 atoms and 40 of 69
entanglements are shipped; all 500 shipped atoms have M>0 and 48 have K+L=0 (the census ships tunnelling atoms only,
so no pure |0⟩ data state can appear); 250,174 is `index.json`'s figure for unique numbered lines and could not be
reproduced from the published buckets (664,940 entries, 128,369 distinct numbers) — both are printed, neither invented;
entries in large families are drawn fainter (alpha × √(40/lineCount), floor 0.12) so a 6,518-entry family does not
white out its neighbours.

## Verified (headless Chrome, `proof/proof2.mjs` → `proof/report2.json`, run 2026-09-15 local)

- Renderer string (unmasked): `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Ti (0x00002C05) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- HUD after 5 s at 1440×1000: 664,940 entries on GPU; VBO 7,979,280 bytes; `drawArraysInstanced(POINTS, 0, 664940, 2)`;
  fps 60 (1 s mean, vsync-capped in headless); 10 draw calls idle, 12 after a measurement; in-memory sha256 of
  `lines.bin` matches provenance; no console errors or page errors; no external request during load.
- `document.documentElement.scrollWidth` = 1440 at 1440 px and 430 at 430 px (DPR 1 and DPR 2); at 430 px the HUD is
  rendered below the canvas (`position: static`), no label overlaps it, all bar controls fit inside 430 px, a touch tap
  on the sphere measured; the full VBO allocated on the phone emulation (no 1-in-4 fallback).
- Electron shells: the shell draw is `drawArraysInstanced(POINTS, 0, 512, 3)` with `u_counts` = [0,40,20] for #2039 and
  [0,0,60] for #6554; bright pixels in the K/L/M annuli (no-atom baseline 43/79/0): #2039 → 85/231/78, #6554 →
  85/124/204 (final run; the L and M figures vary by ~10 between runs with the breathing jitter) — the L band gains
  ~150 bright pixels for the 40 L electrons and the M band ~200 for 60 M electrons.
- Collapse: after one measurement the state line reads `collapsed |0> HOME · θ=0.0° … P(home)=1.000 P(tunnel)=0.000`
  and 12 repeat clicks gave 12 identical outcomes, counted as 12 "not counted" draws; 25 × (re-prepare + measure) gave
  a histogram line on prepared states only. A hand-prepared measurement printed `measured at θ=149.0° (prepared by
  hand, not counted)` on both the state and Born lines. A TUNNEL named its lit valence repo in the Born line and one
  repo dot in the atom-dots buffer carried the lit colour. A resize during a collapse kept the chosen twin.
- Cable off: 0 external requests across 39 measurements. Cable on: exactly one request
  (`…/code/f/12.json`, 327,686 bytes, sha256 matches provenance) for the first measurement, none for the second (cache);
  the line-text button then fetched one file from `raw.githubusercontent.com` at the pinned commit and showed 5 lines
  with their permanent keys. Total external requests for the whole desktop run: 2.
- SOUL tier (#766 geometry, θ set to 90° by hand for the test): 3 TUNNEL outcomes all fixed the defining repository,
  5 HOME outcomes drew from `called_from` with a printed r.
- PRNG (`proof/prng_check2.mjs`): P(r < 1/3) over 20,000 consecutive draw counts = 0.332 / 0.333 / 0.336 for souls
  2039 / 766 / 6554.
- Search `#80299` steers to family haversine (block Gc, 6 entries) and a second Enter says it cannot be measured.
- Picks: a tap on the twin star returned `twin star: #1416 · family #815 geometry …`; the same entry on the principal
  star returned the same key without the prefix.
- The local server was stopped with `taskkill /T /F`; the port had no LISTENING socket afterwards.
- Screenshots: `proof/build-1440.png`, `proof/build-430.png` (DPR 1), `proof/build-430-dpr2.png`.

## Not verified

- A real phone (touch, DPR 2, GPU budget) — only the 430 px emulation in headless Chrome.
- fps above 60 (headless Chrome is vsync-capped); the phone ≥30 fps target.
- The 7,107 atoms and 29 entanglements not shipped in the pack; the 250,174 figure.
- The WebGL2-unavailable fallback was not exercised in a browser without WebGL2.
- A sha256 mismatch on the cable path was not provoked (the live bucket matched the pack).
