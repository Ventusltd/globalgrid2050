# 202609152203 — numbered code database pack, refreshed

A data-only publication: the same eleven `data/` files as `testcode/202609142202/data/`, in the same formats, rebuilt
from the current public sources by the same scripts. No page lives here and no page has been repointed to it;
`testcode/202609142202` is unchanged.

## How it was built (in this order, from this folder)

1. `node build_state.mjs` — copied byte-for-byte from 202609142202. Writes `lines.bin`, `families.json`, `blocks.json`,
   `electron.json`, `random.json`, `entangled.json`, `provenance.json` from `https://ventusltd.github.io/stars/`
   (code/index.json, code/names.json, blocks/blocks.json, blocks/families.json, 167 buckets code/f/*.json,
   spider/graphs/random.json) and star-maker at the commit pinned in the script (c5bf5f6). Log: `proof/build_state.stdout.txt`.
2. `node amend_pack.mjs` — copied byte-for-byte; re-verified its three sources against the build's sha256 (all matched).
3. `node build_all_lines.mjs` — the builder that made the previous all-lines pack, now kept in the stamp. Only change: it
   reads `data/lines.bin` and writes `data/` next to itself. Writes `all-lines.bin`, `all-lines.len.bin`,
   `all-lines.family.bin`, `all-lines.meta.json` from `https://ventusltd.github.io/stars/LINES.md`.
4. `node proof/add_all_lines.mjs` — copied; paths made relative. Records LINES.md and the four outputs in `provenance.json`.
5. `publication.json` by `python scripts/make_publication.py testcode/202609152203 --rev ""`.

## Old vs new

| | 202609142202 | 202609152203 |
|---|---|---|
| unique numbered lines (LINES.md) | 250,174 | 282,551 |
| max key | 342,795 | 383,219 |
| LINES.md generated | 2026-09-14T19:56:58Z | 2026-09-15T21:44:58Z |
| families (index.json) | 10,985 | 13,187 |
| family-line entries (lines.bin) | 664,940 | 700,342 |
| unique lines inside a family | 128,369 | 149,457 |

## Rebuilt vs copied

Every data file was rebuilt; none is a copy. `entangled.json` comes out byte-identical and `electron.json` has identical
content (only key order differs, because `build_state.mjs` now emits `focus_default` and the conduction band itself
instead of `amend_pack.mjs` appending them) — both read star-maker at the commit pinned in `build_state.mjs`, so they
cannot move until that pin does. `random.json` changed in its stars half; the star-maker half is pinned likewise.

## Proofs (run 2026-09-15)

- `proof/key_permanence.mjs` → PASS: all 250,174 old keys are present, all 250,174 shared keys have the same length in
  `all-lines.len.bin`; 32,377 new keys, all above the old max.
- `proof/pack_check.mjs` → PASS: the no-browser checks of the previous stamp's proofs (provenance hashes match disk,
  binaries agree with meta, bucket distinct numbers = in-family unique lines = 149,457, index.json lines = LINES.md count,
  families tile lines.bin). 10,967 of the 10,985 old family numbers are still present (reported, not failed).
- `proof/prng_check2.mjs` → identical output to the previous stamp.
- Not run: the headless-Chrome proofs (gen2, verify-*, review*) — they drive the Quantum Twin Star page, which is not part
  of this data-only stamp.

Recorded mismatches in `provenance.checks.mismatches` are the same kinds as before: shipped bytes over the script's
3.5 MB limit, SOUL.md 40 listed vs 69 stated entanglements, index.json lines not reproducible from buckets alone, and
the script's hard-coded 250,174 "task figure" no longer equalling index.json.
