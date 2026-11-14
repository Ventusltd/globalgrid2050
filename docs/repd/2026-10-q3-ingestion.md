# REPD October 2026 Q3 — controlled ingestion

Status: **INGESTION CANDIDATE ONLY — NOT AN ACCEPTED PRODUCTION RELEASE**

The Department for Energy Security and Net Zero published October 2026 REPD on **13 November 2026**. Source:
https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract

## Backup first

The dated, preserved Q2 script/manifest/reconciliation files and recovery log are at:
`backups/repd/2026-11-13-pre-october-ingestion/`.

The old root `repd.csv` remains unchanged at baseline commit
`73cbdec10bbd3fe2f8313b60b1acc2d22d31b517` (Git blob
`01fe17ae9531d3504490a1418a68350262b06f86`).
The Q2 source is pinned by official CSV/Excel SHA-256 in the log.
No V1–V6 asset has been overwritten.

## GitHub intake

The branch-only staging workflow `.github/workflows/repd-2026-q3-ingestion.yml`
runs `scripts/repd_q3_2026_ingest.py`. It downloads and preserves the original
July-labelled and October-labelled government CSV/XLSX pairs, verifies identities,
compares 53 columns, retains original precision from Excel, and archives the
legacy root and derived REPD CSV/GeoJSON files in the run artifact.

**Original source verification (13 November 2026, run 43511657630 and Claude's independent readback at 22:07 UTC):**

- Q3 CSV: 5,219,160 bytes; SHA-256 `48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862`.
- Q3 XLSX: 5,378,656 bytes; SHA-256 `87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea`.
- Both original sources contain 14,968 rows, 14,967 unique Ref IDs and 53 columns. Ref ID 7679 occurs twice identically at source rows 7112 and 7113; only the staged candidate is deduplicated to 14,967 rows.
- Claude's 22:07 UTC [independent QA finding](https://github.com/Ventusltd/neural-link-between-agents/issues/12#issuecomment-6866106908) revealed **25** month-first CSV planning-submission cells (not merely five ambiguous cells). Nineteen unambiguous cells had been retained in month-first text, five were blanked, and one (09/09/2026) happened to be identical in either interpretation. The earlier staging candidate therefore **FAILED date validation** even though source checks passed.
- The candidate script now explicitly checks the 25 affected refs, month-first CSV interpretation, true typed Excel date, and the record-update chronology; it writes provisional `dd/mm/yyyy` values from the Excel dates and records both raw representations and the correction decision in `Q3_RECONCILIATION.json`. The verifier now requires **zero** non-`dd/mm/yyyy` date cells across all eight canonical date fields. The source CSV and XLSX are never edited. **New CI and independent Claude sign-off must pass before this is considered corrected.** The source publisher has not confirmed the locale error.
- The July-labelled download URLs currently return bytes **identical** to the Q3 sources, not the pinned July/Q2 hashes. The original Q2 bytes are not available from those URLs; the 14,657-row July 2026 snapshot is evidenced by the validated V6 manifest and hashes, but a true Q2-to-Q3 record-level delta cannot yet be calculated. The reported additions/removals compare Q3 against the **historical root repd.csv**, not Q2.
- Both source and candidate CSVs have complete 53-field final records, end with a newline and contain no detected formula-leading cells. These checks were independently performed on the retained staging artifact.

Git history at baseline commit `73cbdec1` is the durable restoration point for existing live files. The 90-day Actions artifact provides convenient copies, **not** a permanent archive. Do not modify live `repd.csv`, V1–V6 assets, PipelineNews, GridAtlas, homepage or any release pointer as part of this intake.

## Remaining release blockers

1. Claude's independent review and reproducible regression tests must be addressed; its QA notes are in [NL-012](https://github.com/Ventusltd/neural-link-between-agents/issues/12).
2. Recover the original July/Q2 official bytes from a verifiable archive matching both pinned SHA-256 hashes before claiming a Q2-to-Q3 per-record delta.
3. Obtain independent confirmation of the 25-cell provisional date normalisation (including five formerly disputed cells), and document treatment of the identical duplicate government record. Seek publisher clarification before production.
4. Build and verify separate downstream PipelineNews and GridAtlas candidates, including MAP identity, browser checks and all-technology coverage.
5. Obtain explicit owner acceptance before any merge or production promotion.

## Reproduce locally

```sh
python -m pip install 'pandas>=2,<3' 'openpyxl>=3.1,<4'
python scripts/repd_q3_2026_ingest.py
```

Outputs: `.repd-staging/2026-10/` (ignored/untracked; do not commit the generated data or personal data by accident). Compare `Q3_RECONCILIATION.json`, `INGESTION-LOG.txt`, the full canonical CSV and the retained source hashes. For GitHub, use the Actions workflow run artifacts.

## Promotion conditions

Do not publish or repoint PipelineNews, GridAtlas or GlobalGrid2050 until the source/download gates, row identity, changes, browser MAP routes, all-technology coverage, and user acceptance have passed. Follow `AGENTS.md` and each product owner's release procedures.
