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
runs `scripts/repd_q3_2026_ingest.py`. The script:
1. Downloads official July 2026 Q2 and October 2026 Q3 CSV/Excel source pairs.
2. Verifies old Q2 CSV and Excel SHA-256 hashes and preserves both old raw files.
3. Requires unique and identical Q3 REPD Ref IDs in both government publications.
4. Reconciles authoritative planning fields, dates and Excel capacity precision with CSV rounding tolerance.
5. Produces Q2→Q3 added/removed/retained reference totals, status changes, technology changes, capacity changes and new threshold counts.
6. Saves the original four official source documents, canonical Q3 candidate, audit log, and validation report to an Actions artifact (90 days).
7. Fails the job instead of promoting questionable data.

**No webpage, live GridAtlas state, homepage owner, older REPD output or PipelineNews release is written.** The ingestion does not automatically update `repd.csv`. Once checks succeed, the next separate reviewed change can pin the new source hashes and rebuild the two PipelineNews/Atlas consumers.

## Reproduce locally

```sh
python -m pip install 'pandas>=2,<3' 'openpyxl>=3.1,<4'
python scripts/repd_q3_2026_ingest.py
```

Outputs: `.repd-staging/2026-10/` (ignored/untracked; do not commit the generated data or personal data by accident). Compare `Q3_RECONCILIATION.json`, `INGESTION-LOG.txt`, the full canonical CSV and the retained source hashes. For GitHub, use the Actions workflow run artifacts.

## Promotion conditions

Do not publish or repoint PipelineNews, GridAtlas or GlobalGrid2050 until the source/download gates, row identity, changes, browser MAP routes, all-technology coverage, and user acceptance have passed. Follow `AGENTS.md` and each product owner's release procedures.
