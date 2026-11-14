# 202611140216 (V9.17)

Parent: `202611140156` (V9.16), tree `b0d94bc0d814285b675467ed59b6c0804aaa2400`.

The register, every data byte and every existing runtime script are the parent's. The MAP link of every
row is the parent's, character for character (checked for all 7,775 rows). What changes:

1. **Register changes, July to October 2026 REPD.** A new section below the data-centre panel lists the
   twelve highest-scored changes found by comparing the two official REPD releases (consents, construction
   starts, new large applications, refusals, capacity and operator changes and others), each with a
   SHOW IN TABLE button that searches the table for that REPD Ref ID. Every project with a change also
   carries it in its PROJECT RECORD. These are register events, labelled as such, not news stories: each
   line is generated from REPD fields only, and a status change is dated by the register.
2. **Data.** `events/register_changes.json`: the 308 events (on 274 projects) of
   `dist/news/repd_events_2026q3.json` whose REPD Ref ID is in this page's list, in the feed's own order,
   with the source sha256. Nothing is rescored or reworded.
3. **Labels and runner.** V9.17 labels; `tests/run_v9_17.sh` + `tests/check_v9_17.mjs` replace the parent's pair.

Known limits: the section lists twelve changes; the rest are reached through the table. The score is the
feed's rule-based relevance score and is used only for ordering.
