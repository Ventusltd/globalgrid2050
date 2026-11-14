# 202611140136 (V9.15)

Parent: `202611140128` (V9.14), tree `227f2c9edc9440489fc7122cbd222fe991071a65`.

The register, every data byte and every existing runtime script are the parent's. The MAP link of every
row is the parent's, character for character (checked for all 7,775 rows); nothing is placed in front of
it and its behaviour is unchanged. What changes:

1. **GridAtlas data state, on the rows it concerns.** GridAtlas (the map the MAP link opens) currently holds
   the July 2026 register. Of the 5,334 rows here with an active REPD status (Operational, Under
   Construction, Awaiting Construction, Application Submitted), 5,237 are in it by REPD Ref ID and 97 are
   not yet. `gridatlas/map_link_state.json` lists those 97 with the GridAtlas data generation they were
   measured against. `scripts/plugins/gridatlas-state.js` adds one line of text below the actions of those
   rows, and one sentence under STATUS DISCIPLINE: the MAP link opens the map on the project point; the
   project card there follows when GridAtlas takes the October data. Before showing anything the script
   reads GridAtlas's published composition; if GridAtlas has moved to a newer project-search generation the
   notes are not shown. Rows with a status outside the four active ones (2,441) are not expected in
   GridAtlas, which keeps the active register only; they are not marked.
2. **Smaller folder.** `fixtures/v5`, `fixtures/v6` and `fixtures/v7.2` (30 MB, never read by the page) are
   not copied. They remain in every earlier version. This folder is about 16 MB.
3. **Labels and runner.** V9.15 labels; `tests/run_v9_15.sh` + `tests/check_v9_15.mjs` replace the parent's pair.

Known limits: the 97 are measured from the files, not on the live map. The note is shown only when the
GridAtlas composition can be read from the reader's browser and still names the measured generation.
