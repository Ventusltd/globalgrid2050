# Formal V9.29 local acceptance

Run from the product root with Node 24 and the existing Playwright installation:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='<installed browser cache>'
$env:V929_PLAYWRIGHT='<installed playwright/index.mjs>'
$env:V929_OUT='<explicit private artifact directory>'
node automation/v929_preview/invariants.mjs
node --test automation/v929_preview/contracts.test.mjs
node automation/v929_preview/browser.mjs
```

Optional variables: `V929_PLAYWRIGHT` identifies the installed Playwright
`index.mjs`; `GRIDATLAS_SOURCE` identifies the existing owner checkout;
`V929_CANDIDATE` defaults to `uk_renewables_pipeline/202611162354` and
`V929_BASE_SHA` defaults to the local current `origin/main`.

The invariant gate compares all eight runtime imports directly with immutable
`git show <source_commit>:<path>` bytes, not only their manifest claims. It also
preserves the original snapshot-provenance receipt bytes, the unchanged
18 MiB edition bound, all 7,775 REPD records/3,604 solar, ordered Solar-1000,
all original MAP constructions, source-headline bytes and historical editions.
The browser gate compares complete CSV output with frozen V9.28, exercises the
actual integrated six-tab page at 390/393/1440, and checks lazy pinned assets,
source names/unknowns, search/pagination/CSV attribution, generic-location MAP,
optional schematic/charts, empty approved Grid projects, opt-in Prices,
source-attributed ticker/pause/reduced motion and independent failure fallback.

It also requires zero sidebar/aside markup and a full-width main pane beginning
at viewport x=0. Android Pixel 7 UA/touch emulation rotates through
412x839 → 915x412 → 412x839, plus 393x851 and 390x844 narrow profiles and their
landscape/return sizes. Each orientation checks hit-testable painted header,
REPD rows and Grid assets, native document touch scrolling, confined horizontal
table touch scrolling when needed, and retained search/MAP identity. Screenshots
cover header and Grid content in both orientations. Layout/visual viewport scale
is recorded separately from requested physical screen dimensions; unexpected
shrink-to-fit from intrinsic overflow fails acceptance rather than forcing zoom.
Rotation screenshots use CDP directly and assert actual PNG orientation/size;
Playwright's screenshot helper would restore its cached portrait viewport and
invalidate a synthetic landscape test. Native touch drags use trusted CDP
touchStart/move/end events; programmatic scroll only establishes the initial
position and is never counted as a successful user gesture.
Grid touch selection is exercised before panning on a companion rotation page;
post-pan compatibility-click suppression is recorded as an emulation limitation,
not replaced with JavaScript or mouse activation. These are Chromium CDP
screen/viewport orientation and touch simulations, not a native Android device.
The source-byte replay does not certify return from the actual public MAP app.
`V929_ROTATION_ONLY=1` runs the focused rotation/failure-isolation subset during
diagnosis; leave it unset for full integrated acceptance and hosted CI.

Immutable HTTPS source fetches are SHA-256 checked before deterministic browser
replay. If network access fails, byte-identical pinned existing GridAtlas files
are used and the receipt discloses that transport. Browser source requests use
these exact checked bytes; other external requests are blocked and recorded.

This establishes local integrated execution only. It does not establish source
rights, a fresh asset census, current actual Prices, native-phone behavior,
typed substation identity, electrical connection or public deployment. Prices
iframe URL wiring and its limitation text are checked; original graphs and
observed dates must still be independently inspected. Public GridAtlas receiver
execution and exact served-byte acceptance remain separate release gates.
