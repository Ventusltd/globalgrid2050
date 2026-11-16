# 202611161734 (V9.26)

Parent: `202611161630` (V9.25), tree `6eb586d58f886dcaffcfc8983e3c5b3922c67e96`.

This edition adds source-aware editorial priority to the existing News block. Relevant government and institutional items can appear ahead of newer general-market headlines; publisher repetition receives a diminishing weight. Every retained headline keeps its original title, publisher and link. Ranking is a research aid, not verification or a project association.

The new consumer accepts priority only when its separate sidecar matches the exact headline bytes, collection timestamp, item identities, profile and counts. Missing, stale, malformed or mismatched priority data produces an explicitly labelled date-order fallback. Publication dates remain distinct from collection times; saved snapshots retain their saved-copy label.

The existing headlines workflow generates both files after its normal collection and deduplication, then commits them together to its existing data branch. Old release clients and the v1 headline schema remain unchanged. A successful refresh is required after deployment before live priority appears.

The official 7,775 records, 3,604 solar records, ordered Solar-1000, UK CSV export, MAP links and 12-lead Global Data Centres view are preserved. The solar evidence source remains disabled while rights are unknown; no matched article, verified project event or published evidence snapshot is claimed.

Component verification: 123 pytest checks, eight inherited Node checks and 54 Chrome browser cases at phone, tablet and desktop widths passed before integration. Whole-release CI and public readback are separate release gates. Native Android remains unavailable.
