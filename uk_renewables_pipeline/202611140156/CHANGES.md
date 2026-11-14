# 202611140156 (V9.16)

Parent: `202611140136` (V9.15), tree `9eae71204ef1e70057cc81ec49d1e765137f36d2`.

The register, every data byte and every existing runtime script are the parent's. The MAP link of every
row is the parent's, character for character (checked for all 7,775 rows). What changes:

1. **Nearest data centre in each PROJECT RECORD.** `scripts/plugins/nearest-datacentre.js` adds one entry to
   the PROJECT RECORD of every REPD row: the nearest site in the UK data-centre register, its status, the
   straight-line distance, the register's own id and MW fields (IT load, grid connection, or the
   register's unlabelled figure; "MW not stated" when blank), and the number of register sites within 10,
   25 and 50 km. Where the register point is precise enough, a link opens GridAtlas on that site, where the
   Offtakers layer lists the substations, REPD projects and power stations around it. A second link opens
   the data-centres page. The 31 rows without a usable REPD point say so.
2. **Data.** New folder `convergence/`: `nearest_datacentre.json` is a byte copy of
   `dist/convergence/2026q3/pipelinenews/pipelinenews_datacentre_context.json` (7,744 rows keyed by REPD Ref
   ID); `datacentres.json` is the 226 register sites reduced to the fields shown; `manifest.json` names
   sources and sha256. Nothing is computed in this version.
3. **Wording.** One line under STATUS DISCIPLINE states that the distance is screening context between two
   published points, not a grid connection, and that data-centre MW is demand, never REPD capacity.
4. **GridAtlas data state re-measured.** GridAtlas released its October 2026 register (generation
   202611132345) on 14 November 2026. `gridatlas/map_link_state.json` is re-measured against it: of 5,334
   rows with an active REPD status, 5,331 are in the GridAtlas register by REPD Ref ID (97 were missing
   against the July register in the parent). The 3 that are not (REPD 2484, 6483 and 20218, the Norfolk
   Vanguard East and West and Norfolk Boreas offshore records, all published at 52.62 N, 2.55 E) lie east
   of the area GridAtlas compiles (longitude below 2.5). The 2,441 rows with any other status are outside
   the register GridAtlas keeps. `scripts/plugins/gridatlas-state.js` now shows each marked row its own
   reason from the file and no longer says the card will follow. The MAP link is untouched.
5. **Labels and runner.** V9.16 labels; `tests/run_v9_16.sh` + `tests/check_v9_16.mjs` replace the parent's pair.

Known limits: the GridAtlas state is measured from GridAtlas's published files, not on the live map. Only the single nearest site is named per project (the convergence file carries one). MW is
stated for few register sites. The GridAtlas link for a data centre opens a general location card there;
the data-centre card itself needs the Offtakers layer switched on by the reader.
