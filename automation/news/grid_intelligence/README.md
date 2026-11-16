# Grid intelligence: reuse the estate

This is a read-only consumer index for NEWS, PROSPECTING and DC context. It
does not collect a new network dataset, replace the canonical Spider ownership
graph, bind projects by distance, publish a release, or run a power-flow model.
No historical application or official REPD file is changed.

`catalogue.json` is reproducible from the 32 Git-object SHA-256 pins in
`sources.json`. Git objects are used instead of working-copy bytes, so local
edits and Windows line-ending conversion cannot silently change the inputs.
Inputs are bounded at 32 MiB per object and require full immutable commits.

## Actual coverage

| Owner | Pinned input and useful result |
| --- | --- |
| GridAtlas | Composition `202611132345` / v9.189 at `76653e40`: six cartridge hashes; all 60 immutable-shell layer declarations. These are declarations, not a new browser acceptance run. |
| data-gridatlas | Immutable release `202608291237-data-gridatlas` at `8bf88da9`: actual `sources.parquet` read with DuckDB; 56 source rows, 541,282 source feature rows; all 60 layers joined to owner Parquet partition hashes. Features are not unique physical assets or project counts. |
| data-grid-gb | `5181de34`: existing NESO ETYS 2025 normalized product and connection-points.v3, 886 transmission sites, 489 located, 605 with published fault-current data, 629 with planned-change context. Geometry remains separately sourced. |
| Ventus Grid Engine | `d9a6234a`: all 15 package exports hashed and linked. Read-only reuse of the existing distance, topology, rating, fault-level, site-tile and deep-link owners. |
| GlobalGrid2050 podcast | `e2568fa9`: 21 episode headings and 1,348 timestamped speaker turns indexed; topic hits provide line and timestamp locators, not quotations or verified project evidence. |
| Spiders | `b47609b9`: canonical `master-plan.geojson` retained as a planned graph. Proposed paths are not treated as implemented owner contracts. |

The data owner retains `UNVERIFIED` authority/licence fields and candidate
dispositions in its source catalogue even where its historical release marks a
layer available. Both states are preserved. Availability is **not** new source
rights approval. Runtime payload delivery, current public hashes, upstream
licences and browser/mobile behavior are outside this index's acceptance claim.
Unknown source update times/licences stay null; no date is inferred from a Git
commit. Large drawing payloads remain browser-native; DuckDB is used here only
for the existing small source catalogue. No GPU workload was introduced.

## Build and verify

Install the existing estate dependency lock:

```text
python -m pip install -r automation/news/acquisition/requirements.txt
python -m pytest automation/news/tests/test_grid_intelligence.py -q
python -m automation.news.grid_intelligence.index --repos repos.local.json --output rebuilt-grid-index.json
```

`repos.local.json` maps each repository name in `sources.json` to an existing
checkout containing its pinned commit. Keep that machine-specific file outside
Git. For example, keys include `Ventusltd/gridatlas`, `Ventusltd/data-gridatlas`,
`Ventusltd/data-grid-gb`, `Ventusltd/ventus-grid-engine`,
`Ventusltd/globalgrid2050` and `Ventusltd/spiders`. This command fetches nothing,
does not modify owner repositories, validates every input hash and emits
canonical JSON. Two builds must produce identical bytes. Output is not an
operative evidence pointer or a rights-cleared publication artifact.

For real planned-upgrade context at an exact electrical node:

```text
python -m automation.news.grid_intelligence.index --repos repos.local.json --node ABHA41 --output node-changes.json
```

That source-backed example returns one 2028 circuit-change row in ETYS sheet
`B-2-2c`, with a published winter equipment rating of 2,423 MVA. The output
retains `publication_vintage=ETYS 2025`, the planned year, sheet, source-row
digest, owner commit and PROVISIONAL review state. It explicitly leaves actual
commissioning date, available capacity and project binding null. Ratings are
individual equipment MVA, never summed or converted into available MW. A node
prefix such as `ABHA` will not match `ABHA41`.

The owner product contains 2,230 **change rows**, including 336 occurrences of
identical repeated rows. Their original table/row locators are preserved; this
reader does not decide that they are distinct assets or duplicates to delete.
The three-row `etys_sample.json` is a minimal real excerpt from that pinned
product, with its full input provenance, for offline contract tests.

## Boundaries and follow-up

- The podcast reference guide described by the owner has not been located in
  the bounded estate filename/text and public LinkedIn searches. The claimed
  206k-word guide summary is not treated as a measured count. Existing
  transcript locators are useful while that source is unresolved.
- This slice does not claim to read all estate history, every grid report, or
  any global 2050 forecast dataset. Future forecast intake must keep publication
  vintage, scenario, horizon, geography and units separate from actuals.
- Podcast/interview topic signals are context for further research. They do not
  increment verified evidence counts or prove a connection or financing event.
- Primary operator/regulator/government/institution/issuer sources take
  precedence. Credited Bloomberg, Reuters or FT metadata can remain discovery
  clues or valuable original reporting; no paywall bypass or body copying is
  implemented here.
- Reuse existing owner collectors and source policies for any later refresh.
  No new collector, schedule, UI block or competing ownership registry exists
  in this package.

## Validation receipt (bounded local checkpoint)

- 24 pytest cases pass: real-node selection, nulls, units, repeated rows,
  schema/count/size/hash rejection, dirty-working-copy isolation, safe pins,
  missing/tampered input failure, Parquet source caveats and podcast locators.
- Complete index rebuilt twice from pinned objects with identical bytes.
- Existing data-grid-gb verifier passes for normalized product SHA-256
  `40f0aa1cbdcb35d9f62e9c87e89d8230b93faa4e45d0e08e6ecd18cf287010d0`.
- Existing Ventus Grid Engine `node verify.mjs` passes: 23 proofs / 571 checks
  at tree-equivalent `2dce44aea6a1008ef390a69afa2d410b5dd8fe7a` and pinned merge
  `d9a6234a5ec262844e7ef5172e938fcefd2396a1`; no engine source was modified.
- No new CI result, browser result, public promotion or global coverage is
  claimed by this local receipt. Integrator must run the added tests in CI.
