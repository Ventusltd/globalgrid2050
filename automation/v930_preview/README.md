# V9.30 isolated host acceptance

From the product repository root, with Node 24 and an existing Playwright installation:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='<existing browser cache>'
$env:V930_PLAYWRIGHT='<existing playwright/index.mjs>'
$env:V930_OUT='<private proof directory>'
node --test automation/v930_preview/contracts.test.mjs
node automation/v930_preview/invariants.mjs
node automation/v930_preview/browser.mjs
```

`V930_CANDIDATE` defaults to `uk_renewables_pipeline/202611170147`.
`V930_BASE_SHA` defaults to current `origin/main`; the frozen product baseline
is V9.29 `202611162354`. `V930_DATA_SOURCE` may identify an existing data-owner
GeoJSON instead of fetching its immutable HTTPS URL. Either transport must match
the actual 183,561-byte SHA-256 pin, and the receipt discloses fixture replay.
`GRIDATLAS_SOURCE` optionally supplies exact older pinned owner files if their
immutable HTTPS transport is unavailable. No collector or schedule is created.

The ten native tests are the exact producer `83e7c36d08ef98f3665f7f35b8637405391dc4be`
tests with only their runtime import adapted to the versioned cartridge cache.
Invariants compare both cached runtime files directly with immutable donor Git
objects, validate manifest/host hash/CSS SRI and actual source counts/100 IDs,
and preserve the inherited layer pins, 18 MiB bound, complete REPD/MAP/Solar-1000,
saved news and historical editions.

Real Chromium exercises the actual host at 390/915/1440, comparing full REPD
and Data Centre CSV output and original map/source links with frozen V9.29.
It checks all 38 address-bearing records/39 statements, including foreign and
null-geometry records, 34 GB-only Screen actions, 25 approximate postcode labels,
one footnote and source/accuracy disclosure, exact credits, filters, rerenders,
and an Android-UA/touch-emulated portrait-landscape-portrait transition. Changed
manifest, cached module and source bytes must each leave the original DC UI and
all REPD rows usable, with no optional address/action fragments.

The browser replays exact source bytes and blocks other external requests. It
does not establish a native Android handset, live new source collection, source
rights approval, global grid coverage, actual fresh Prices, public GridAtlas
execution or served-byte publication. Those remain separate ROOT gates.
