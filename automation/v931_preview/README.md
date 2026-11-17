# V9.31 historical daily-price host acceptance

Run from the product repository root with Node 24 and an existing Playwright installation:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='<existing Chromium cache>'
$env:V931_PLAYWRIGHT='<existing playwright/index.mjs>'
$env:V931_OUT='<private proof directory>'
$env:V931_BASE_SHA='<frozen pre-V9.31 main commit>'
node --test automation/v931_preview/contracts.test.mjs
node automation/v931_preview/invariants.mjs
node automation/v931_preview/browser.mjs
```

`V931_CANDIDATE` defaults to `uk_renewables_pipeline/202611170243`.
The frozen product comparison is V9.30 `202611170147`. `V931_BASE_SHA`
defaults to current `origin/main`; CI supplies the exact pre-edition baseline.
`V931_PRICE_SOURCE` may name an existing owner's `derived/price-daily-browser`
directory and `V931_DATA_SOURCE` an existing DC-location GeoJSON. Otherwise,
the harness fetches their immutable HTTPS source URLs. All source transports
must match the accepted byte counts and SHA-256 pins. `GRIDATLAS_SOURCE`
optionally supplies the exact existing owner files when HTTPS is unavailable.

The native suite retains the eleven producer `78d5360` contracts, with only
their import adapted to the versioned cache, plus independent checks against
actual owner data for immutable nested pins/rows, corrupted annual retry,
negative values, missing/partial days and source-date bounds.

Invariants compare the four runtime files directly with immutable donor Git
objects, hashes and sizes. They validate the actual index, annual JSON, source
manifest and Parquet byte pins and reconcile all 3,957 source dates: 3,919
complete source days, 25 partial, 13 missing, 189,270 available prices and
106,668 stored UTC disagreements. This is consumer validation of pinned owner
products, not a rebuild or fresh collection of the 188 original source parts.
The DC cartridge, eight earlier layers, 18 MiB edition budget, all REPD/MAP
identities, Solar-1000, saved news clocks and historical editions are retained.

Chromium tests the actual host at 390/393/1440 and Android-UA/touch-emulated
portrait/landscape/portrait. It checks lazy index/annual requests, actual
Canvas2D colored paths and pixels, negative GBP annotations, no bridges across the
13-day gap, hollow partial-day markers, year controls, source-date clamping,
source disclosures and the independent original V6 workspace link. Because
the UI's shortest window is 30 days, the all-missing chart is a direct probe
of the imported renderer using the thirteen actual missing owner rows.
Changed manifest, module, index and annual bytes must withhold price results
while preserving REPD and DC controls/maps. DC source-corruption checks also
exercise the newly shared bounded-hash transport.

Browser requests replay byte-identical source fixtures; other external feeds,
Chart.js and V6 navigation are blocked. This establishes no public served-byte
deployment, native handset, public GridAtlas receiver execution, fresh quote,
forecast, rights approval or certification of inherited stored UTC clocks.
Source-declared daily coverage and UTC alignment remain separate facts.
