# GlobalGrid2050 UK Renewables Pipeline 202610290230 (V9.11)

## Status

Candidate dated 29 October 2026. Parent `202609082224` (V9.10) is the exact
frozen parent. Every file except those named in `CHANGES.md` is carried byte
for byte, and `tests/run_v9_11.sh` proves it.

**V9.11 pins Chart.js** to `chart.js@4.5.1/dist/chart.umd.min.js` with a
SHA-384 Subresource Integrity hash. The unversioned URL it replaces ran
whatever npm called `latest`. Nothing else about the page changes.

## Validate

    bash tests/run_v9_11.sh
    # optional: recompute the SRI hash from the npm bytes
    npm pack chart.js@4.5.1 && tar xzf chart.js-4.5.1.tgz
    CHARTJS_PKG_DIR="$PWD/package" node tests/check_v9_11.mjs

The browser smokes inherited from V9.8 (`V9_BROWSER_SMOKE=1 bash
tests/run_v9_8.sh`) stub `cdn.jsdelivr.net` and `window.Chart`, so they do not
exercise the real library. Before accepting this release, open it in a browser
and confirm that the four gauges draw and that the console shows no
integrity error.

## Third parties this page contacts

- On every visit: `cdn.jsdelivr.net` (Chart.js, pinned and SRI-checked),
  `raw.githubusercontent.com` (the news file) and `ventusltd.github.io` (the
  deep-link contract).
- Only when you click a link: Google News, publishers' sites, gov.uk,
  github.com and GridAtlas.
- Nothing is stored on your device, and there are no cookies and no analytics.

## Inherited unchanged

Everything described in the V9.10 README of `../202609082224/`: the
interconnector tab, the bounded ACTIONS column, the regional news pipeline and
its ledger, the twenty-row window, and the 7,680-row MAP contract.
