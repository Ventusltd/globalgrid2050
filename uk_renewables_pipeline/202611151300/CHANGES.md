# V9.22 — 202611151300 — STAGING ONLY

Parent V9.21 `202611141017`, exact parent Git tree `0c56d3a81d7e3abaec164ab689b0f4c8a38e7129`.

**Changed:** `index.html`, `scripts/plugins/live-news.js`, `README.md`, `CHANGES.md`, and new `styles/v9-22.css` (44px desktop MAP tap targets, partial/failed health styling), V9.22 regression, real Chromium staging preflight and runner files.

**Unchanged by inheritance:** 7,775 Q3 2026 REPD rows, source fixtures, canonical REPD IDs, spine partitions, CSS, all MAP deep links, CSV export, existing news archive and GridAtlas integration. Inherited files must remain byte-identical to V9.21.

1. Accept a schema-valid empty `items: []` collection, displaying **“No headlines currently meet the feed criteria.”** Never display unavailable solely because zero items passed filters.
2. Distinguish `status: partial` and feed success/failure counts. Retain usable articles; do not pretend all feeds succeeded.
3. Present the last feed **collection time**, not a claim the articles or planning events are new. Publisher article dates remain separate from first-collected fallback dates.
4. Identify a failed collection separately and label fallback as a saved snapshot. Invalid source schema remains unavailable, not healthy-empty.
5. Add focused synthetic regression checks; source receipts, independent rights review, real click-to-engine, actual public served hashes and rollback are **not certified** by these checks.
6. Correct RSS title-only deduplication in `automation/news/pipeline_headlines.py` (branch code, not a rewrite of the immutable old edition), keeping different-year events, distinct REPD projects and distinct decisions separate.

**Additional staging integration:** exact 22-file SHA-pinned producer/Claude stack from PR112 at `f9f98bb`, with its workflows, logic and tests. An evidence proposal ledger is separately staged under `automation/news/evidence_ledger.py`, where even structurally complete synthetic records require independent external acceptance. 

**No new verified project-news claims** are approved or created by this edition. A possible REPD match is not a verified project binding; general data-centre RSS headlines are not UK DC-register records.

**Public release: HOLD** until required independent acceptance. No homepage or production pointer modified.
