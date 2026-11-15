# GlobalGrid2050 UK Renewables Pipeline 202611151300 (V9.22 staging candidate)

Built on 15 November 2026 from the unchanged V9.21 Git tree `0c56d3a81d7e3abaec164ab689b0f4c8a38e7129`.

Parent: `202611141017` (V9.21). The canonical DESNZ REPD Q3 2026 register remains unchanged: 7,775 displayed solar, battery and wind projects; original IDs, maps, CSV and core assets are inherited byte-for-byte.

**Staging only:** This directory is not the operative website. The published V9.21 directory, its current homepage pointer and the V9.20 rollback are unchanged. Source receipts, rights, independent browser/CSV/MAP acceptance and served SHA checks remain release gates.

New behaviour: valid empty RSS collection is healthy-empty rather than unavailable; partial collections identify failed feeds while retaining available headlines; collection time is distinguished from article date. Collector deduplication is implemented separately in `automation/news/pipeline_headlines.py` on Agent7's branch.

Verify candidate offline from a full repository checkout:

    bash tests/run_v9_22.sh

This branch does **not** incorporate producer PR #112 automatically: it is stacked on `acid/team1` and must be separately integrated and independently accepted.
