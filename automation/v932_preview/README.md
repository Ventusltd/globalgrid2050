# V9.32 primary-note host acceptance

Run from the repository root with Node 24 and an existing Playwright installation:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='<existing Chromium cache>'
$env:V932_PLAYWRIGHT='<existing playwright/index.mjs>'
$env:V932_OUT='<private proof directory>'
$env:V932_BASE_SHA='<exact frozen pre-V9.32 main commit>'
node --test automation/v932_preview/contracts.test.mjs
node automation/v932_preview/invariants.mjs
node automation/v932_preview/browser.mjs
```

Candidate defaults to `uk_renewables_pipeline/202611170324`; frozen comparison
is V9.31 `202611170243`. The optional `V932_PRICE_SOURCE`, `V932_DATA_SOURCE`
and `GRIDATLAS_SOURCE` fixtures work like the earlier acceptance harnesses:
only exact bytes matching the immutable owner pins are replayed. Otherwise
their immutable HTTPS source URLs are fetched. Receipts disclose transport.

The native suite preserves seventeen exact `b5eed3d` donor tests with adapted
cache imports and adds actual 7,775-row canonical, mutation, date and rights
checks. Invariants compare all three runtime files directly with the immutable
donor, and independently bind ROOT's renderer to its accepted bytes/SHA/blob.
They verify the manifest, JSON import assertion, unique REPD 12588 association,
all dated receipts, source-specific submission dates, narrow government rights,
unknown final capacity and zero VERIFIED/Solar-1000 delta. Earlier DC/Prices/
layer pins, 18 MiB package limit, official population, original MAP/CSV bytes,
saved news clock and every frozen historical edition remain checked.

Actual host Chromium checks 390/393/1440 and Android-UA/touch-emulated rotation.
It opens the physically visible existing row-note button and existing dialog,
keeps the primary section separate from the original headline section, retains
the frozen Application Submitted status and original MAP, closes by Escape,
restores focus, and survives filters/paging. All 7,775 legacy `headline.has`
booleans stay unchanged; homonyms 10529/18174 gain no primary association.
Corrupt manifest/model/catalogue/JSON/renderer bytes, valid JSON with the wrong
MIME type, and evaluation before curation must each leave the original
headline-only brief and REPD/DC/Prices usable. Existing DC/Prices/optional-layer
acceptance runs alongside the new seam.

The reviewed primary document is not fetched again by this consumer harness.
It checks accepted receipt identities and scope, not a fresh rights review.
Source date, decision date, retrieval/review clocks, headline provenance and
provisional project binding remain separate. This is local source acceptance,
not publication, a native Android handset, public GridAtlas receiver execution,
a new verified prospect, blanket government/publisher rights or a current
capacity/connection/judicial-review claim.
