# 202611132345

Parent: `202609082224` (V9.10, the operative page; tree `6247a0c3c00e8e88324d9ea55b22d67dbbb1be90`).
One change: **the REPD spine is rebuilt from the DESNZ October 2026 (Q3 2026) publication.**
No JavaScript, stylesheet, newspaper or interconnector byte changes.

## The register moves to Q3 2026

| | Q2 2026 (parent) | Q3 2026 (this release) |
|---|---|---|
| REPD source records | 14,657 | 14,967 (14,968 published rows; ref 7679 is an identical duplicate) |
| Spine records, solar/BESS/wind >= 1 MW | 7,680 | 7,775 |
| Capacity | 356,474.09 MW | 365,474.49 MW |
| Largest single site | 4,100 MW | 4,100 MW |
| Solar / BESS / onshore / offshore | 3,563 / 1,609 / 2,399 / 109 | 3,604 / 1,644 / 2,417 / 110 |
| With valid geometry / without | 7,652 / 28 | 7,749 / 26 |

Built with the existing builders, nothing re-implemented:

1. `fixtures/2026q3/project_identity_2026q3.json` - the repo's
   `scripts/build_project_identity_v6.py` (`read_official_rows` + `build_registry`, unchanged)
   run on the reconciled October canonical CSV (official CSV values, official Excel capacity
   precision and planning reference, 25 month-first CSV dates restored from typed Excel dates,
   the identical duplicate of ref 7679 removed).
2. `fixtures/2026q3/repd_2026q3_coordinates.json` - `scripts/data/build_v7_2_spine.py --repd-xlsx`
   on the official October workbook (sha256 `87811e24...`); Ref-ID set, technology, capacity and
   site name reconcile exactly with the identity fixture. Its V7.2 by-products were written to a
   scratch directory, never to `uk_renewables_pipeline/v7`.
3. `data/v9.1/*` - `scripts/data/build_v9_1_spine.py`, with one line changed so it reads this
   folder's contract and writes this folder's `data/v9.1` instead of `uk_renewables_pipeline/v9`
   (the same builder with that line reproduces the parent's 35 spine files byte for byte).
4. `contracts/release.v9.1.json` - dataset label, the two fixture paths and sha256s, the workbook
   sha256 and the seven `expected` figures. `contracts/release.v9.5.1.json` - its `expected`
   block. Every other key is the parent's.

The inherited Q2 fixtures (`fixtures/v6`, `fixtures/v7.2`) are kept byte for byte as lineage
evidence; this release's builder no longer reads them.

## The newspaper is unchanged

The page still reads the repo-root `dist/major_project_news_v9_5_1.json` (sha256 `cea104c3...`),
which is not rebuilt. News binds to projects only by exact `repd_ref` (PRIMARY_MATCH); all 29
refs it binds resolve in the Q3 spine, and Beacon Fen (REPD 13599) is still 400 MW. The
international ledger `data/v9.7` and the 16 interconnectors `data/v9.8` are the parent's.

## Known source issue carried, not corrected

REPD 18561 and 18562 (Salters Lane, Tyne and Wear) carry the published coordinates
E 492983 / N 188837, which resolve near High Wycombe. They are inside the validity box, so they
map there. Correcting them would be inventing data; it is left to DESNZ or an owner decision.

## What this release changes, one file at a time

- `index.html` - states its own identity and the Q3 register figures.
- `README.md`, `CHANGES.md` - this text.
- `contracts/release.v9.1.json`, `contracts/release.v9.5.1.json` - as above.
- `scripts/data/build_v9_1_spine.py` - line 12 only.
- `fixtures/2026q3/*` - new.
- `data/v9.1/*` - rebuilt (16 project parts, 18 atlas parts, manifest).
- `tests/run_v9_12.sh`, `tests/check_v9_12.mjs` - new runner and check; `tests/run_v9_10.sh` and
  `tests/check_v9_10.mjs` are removed (they assert the Q2 spine and the parent's identity).
