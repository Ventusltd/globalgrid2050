# V9.28 selected News and Grid integration evidence

This directory records exact component imports for the isolated Agent 1 preview.
It does not create a collector, scheduler, feed, rights registry or release.

`import-pins.json` identifies thirteen existing corrected source/test/document
files by donor commit, Git blob and SHA-256. Import those paths only. Keep the
already-owned `acquisition.match` runtime unchanged. Do not import either
feature branch wholesale or copy the News acceptance workflow into production.

Verify selected source bytes from the product root:

```text
python -B automation/v928_intelligence/verify_imports.py
python -B -m unittest discover -s automation/news/tests -p test_grid_watch.py -v
python -B -m pytest automation/news/tests/test_engine.py automation/news/tests/test_engine_independent.py -q
python -B -m automation.news.tests.news_engine_acceptance_demo
```

The Grid corrective commit is
`5649fca9ea5a5c7f25b1cb4f8f9b000d40201f89`. Its five executable fixture/source
blobs were reconstructed and Git-blob-verified, then independently executed on
CPython 3.13.18: **13/13 PASS**, including preservation of an explicit
`RESTRICTED` source licence while keeping `publishable=false`.

The News corrective commit is
`87b16162d4579862dd6d131f29e92c374b5353c2`. The exact-head hosted
[182-test receipt](https://github.com/Ventusltd/globalgrid2050/actions/runs/43966372840)
was independently read before integration. These execution receipts do not prove
source rights, project identity or public feature acceptance.

## Existing host boundaries

- Keep existing `live-news.js`, original attributed headline URLs and the
  `pipeline-feed-loaded` event. Keep `machine-notes-v923.js` and existing
  provisional-language/CSV/MAP behaviour.
- `pipeline_feeds.json` supplies acquisition labels, not a trusted rights
  catalogue. Do not invent approved source entries to satisfy the News adapter.
- Every News adapter output is withheld pending independent review. Until an
  independent approved receipt exists, add **no new engine rows** to HEADLINES
  or MACHINE READ NOTES, even if a title matches a REPD identifier.
- GRID may show the fourteen existing labelled official source-directory
  entries with their original URLs, operator role and unassessed rights state.
  This is a source directory, not fourteen developments or an active feed.
- Keep all three Grid manual fixtures out of the displayed project list.
  There are **zero publicly approved Grid project rows**. No connection,
  available-capacity or commissioning claims follow from directory discovery.
- Missing approved item data must yield unavailable/empty project state while
  preserving the rest of the tab. No substitute fixture or inferred licence.

The two-block V9.24 appearance, full REPD identity universe, actual browser
integration, item/source-rights review and release acceptance remain ROOT gates.
Homepage PR20 and production remain on HOLD.
