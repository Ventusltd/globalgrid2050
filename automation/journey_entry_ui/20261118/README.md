# Shared Pipeline Journey entry

Additive sender prototype, not yet attached to a release. The original MAP hrefs,
existing asset models and collectors remain unchanged. No new GridAtlas URL
consumer is installed here: the accepted Vicinity bootstrap owns that contract.

`buildJourneyUrl(mapHref, origin, {radiusKm: 10})` accepts only the canonical
GridAtlas HTTPS receiver, matching original coordinates, integer radius 1–50 and
an explicit source identity. REPD uses `origin_type=repd`, `origin_id=repd:2470`
plus unchanged `repd_ref=2470` and technology/coordinates. Data centres retain
`DC-WD-Q…` IDs and substations retain the pinned source's `grid_substations:…`
IDs. These are source-record identities, not independently certified physical
connections. Missing or mismatched points return null, never an invented point.
The optional source display name is carried as `name` for the Vicinity panel;
the original receiver's `project` label stays intact.

The view places JOURNEY beside REPD MAP, source-backed Data Centre Screen and
substation MAP actions, plus a Grid Journeys navigation entry for manual origin
selection. Unknown Data Centre locations and unlocated REPD records show an
unavailable reason. Keyboard semantics are native anchors; the V9.42 atlaslink
controller owns touch current-tab navigation and source-filter recovery. This
module records category/Data Centre state and publishes origin context only.

On an explicit asset Journey click, `pipeline-journey-origin` carries the checked
origin. News can use it as topic context, never an asset-to-story verification.

A later accepted news component may call
`window.pipelineJourneyEntry.setNewsContextUrl(base)` after checking the API or
listening for `pipeline-journey-ready`. The optional base must be exactly
`https://globalgrid2050.com/uk_renewables_pipeline/<12 digits>/` (or index.html),
without incoming query, fragment, credentials or custom port. Only the edition
that actually implements contextual news may opt in. This sender prototype
supplies no unpublished or arbitrary return destination.

Validation: `node --test automation/journey_entry_ui/20261118/model.test.mjs` and
`node automation/journey_entry_ui/20261118/view.browser.mjs`. The latter uses real
local HTTP fixture pages with the existing V9.42 navigation module; it proves
sender placement/identity/targets and refuses unlocated records, not public
receiver acceptance. Set PLAYWRIGHT_MODULE_ROOT to the existing browser package.

`entry.browser.mjs` exercises the real Pipeline host and existing pinned remote
Data Centre/substation inputs at 393/1440. Before an edition is attached,
PN_JOURNEY_HOST_PREVIEW=1 explicitly composes these modules into the local HTTP
host only; this is not published-edition acceptance. Without that flag the
actual candidate must load the entry itself. Missing sparse-checkout assets
fail explicitly. The inherited external evidence pointer may return 404 and is
recorded separately; no same-origin failures or page errors are accepted.
