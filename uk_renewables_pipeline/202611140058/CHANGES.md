# 202611140058

Parent: `202611132345` (V9.12, REPD October 2026 candidate). Accepted parent trees, either of:
- `a3f76f610dff9da15090df56181fdbccc2e210fa` - the bytes at globalgrid2050 `f9ccd703`, which were
  served and hash-verified when the homepage was first pointed at 202611132345;
- `0c7a4ed5ea369e4a4e71a45cfa6fe9c186fae773` - the same folder after PR #63 (`d5de5a03`) changed three
  files in place (CHANGES.md, scripts/plugins/projects-v9-8.js, tests/run_v9_12.sh).

The register, every data byte and every runtime script are the parent's. What changes:

1. **Release label, not candidate label.** `index.html` title, brand, nav, h1 and meta line read
   `V9.13 ... RELEASE ... 14 November 2026` in the shape 202609082224 uses
   (`V<version> · <scope> · <state> · <date>`). The nav gains a link back to 202611132345.
2. **CSV source count from the start.** `scripts/plugins/projects-v9-8.js` is the corrected file
   (sha256 pinned in `tests/run_v9_13.sh`): the "Source Reconciliation" column reads
   `source_record_count` from `data/v9.1/build_manifest.json` (14,967) instead of the Q2 literal.
3. **Fixtures referenced, not copied.** `fixtures/2026q3/` (23 MB) is not in this folder.
   `contracts/release.v9.1.json` is byte-identical to the parent's and names
   `uk_renewables_pipeline/202611132345/fixtures/2026q3/...` with their sha256; the page never reads
   fixtures, and the spine rebuild resolves them from the repository root. No large-files allowlist
   change is needed.
4. **Runner.** `tests/run_v9_13.sh` + `tests/check_v9_13.mjs` replace `run_v9_12.sh` + `check_v9_12.mjs`
   (the parent's add/remove pattern). They check the parent's tree, byte parity, the spine and
   interconnector rebuilds, the page's own loader, every MAP href and the CSV source-count text.

Not changed: the newspaper (`dist/major_project_news_v9_5_1.json`, cea104c3), the data, the MAP
contract, the unpinned Chart.js CDN inherited from 202609082224.
