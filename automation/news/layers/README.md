# Pipeline layers: existing data, small independent views

This is an additive source module for the existing Pipeline plugin host. It is
not a release, a new collector, a map engine or a replacement for the REPD table.
ROOT integrates accepted modules into the next formal edition; published folders
and the V9.28 release branch are unchanged here.

## What was studied and reused

Inspected GridAtlas commit `1de35f9eca360a5d80d81542230fef546917f5c5`:

- `atlas/index.html` and `atlas/current.json`: stable shell, ordered named slots,
  immutable sources and SHA-256 before composition.
- `atlas/releases/202608300453-atlas-v9/ventus-corev8engine.js`: registry-generated
  layer controls, stable `data-layer-id`, per-layer state and first-use hydration.
- `atlas/modules/202611132345-uk-offtakers-overlay.js`: existing source pins,
  distinct source classes, deliberate DC overlap, 30/30/30 vicinity screening and
  the explicit distinction between proximity and a declared connection.
- Homepage-owner `assets/versioned-homepage.css`: existing development strip's
  repeated track, pause on hover/focus, keyboard scroll and reduced-motion pattern.
  The adapted ticker is locally scoped and uses red rather than the homepage theme.
- Existing Pipeline `plugin.v1.json` / `scripts/core/plugin-host.js`: startup
  ownership and dependency order remain there. This registry adds optional views.

Unlike GridAtlas's map composer, this host does not inject scripts or copy the
immutable application. The release explicitly imports trusted renderers. A
registry entry names a renderer, pinned dataset, schema, expected count and byte
budget. Changing a dataset requires a reviewed composition; a payload cannot
repin itself. Unknown modules, failed fetches, changed bytes and invalid counts
leave just that view unavailable. Late responses cannot replace a newer tab.

## Views

- **Grid → Substations:** all 5,800 existing GridAtlas source features, not only
  the 886 ETYS transmission points. Exactly 4,460 have a source name; the other
  1,340 remain unnamed. Search, bounded 100-row pages, full filtered CSV, optional
  2D source-coordinate schematic and descriptive count charts.
- **Grid → Grid Projects:** explicit empty/unconnected state until the existing
  `automation/news/engine.py` output has independently approved records. No
  fixture promotion or new collector. This module is a host boundary, not an
  implemented live news-to-grid feed.
- **Offtakers:** the current GridAtlas filtered feed (1,568 features), with its
  original properties, per-record source/licence attribution and intentional
  Data Centre overlap retained. These are screening candidates, not contracts.
- **Prices:** links and opt-in embedding of the original
  `https://globalgrid2050.com/uk_energy_tracking_v6/` workspace. Existing graphs
  and their data owner are unchanged. Frame compatibility must be browser tested.
- **Headline ticker:** ten newest distinct dated HTTPS headlines supplied by the
  existing source owner. Red-on-dark scoped CSS, publisher links, pause, focus
  handling and reduced-motion behavior. “Latest available” never means a stale
  snapshot was freshly collected.

`pipeline-layers.css` is scoped to `.pn-layers` and `.pn-ticker`. No global theme,
homepage styles, outer blocks, REPD data, historical edition or GridAtlas code is
modified. Catalogue size is extensible; each browser product and active view is
bounded. Hundreds of thousands of articles belong in the data-owner Parquet /
DuckDB pipeline, not a single browser download.

MAP links currently use the existing coordinate-only GridAtlas arrival parameters
(`longitude`, `latitude`, `zoom`, `project`, `technology`). No REPD ID is invented.
They mean **source location**, not an ETYS identity match or a known electrical
connection. Exact substation/offtaker arrival and mobile behavior require separate
live receiver proof before ROOT accepts this link adapter. Live browser inspection
at 390/1440 confirmed camera movement and a computation receipt with entity kind
`location` and `ARRIVAL_LINK` provenance. The receiver does not recognize
`technology=substation` as a typed project layer: this is location screening,
not automatic substation identity resolution. Missing geometry has
no MAP link. DNO associations, project crosswalks, headroom and behind-the-meter
eligibility are not inferred from point distance or identical names.

## Local review and checks

From repository root, with Node 24:

```sh
node --test automation/news/layers/tests/contracts.test.mjs
node automation/news/layers/tests/browser.mjs
node automation/news/layers/serve.mjs
```

The browser harness serves `demo/index.html`, injects only byte-identical pinned
source files for deterministic offline UI checks and records its limits. Live
MAP receivers and original Prices embedding are separate checks. In normal use
the demo reads immutable source URLs directly and the existing headline data
branch; it does not create a scheduler.

Separate live inspection confirmed that the original Prices page embeds without
frame-policy errors. It did **not** confirm current actual-price data: its default
9–15 November electricity chart says no actual data and shows an indicative
seasonal baseline, while the displayed live/frequency observation dates were
18 June 2026. The host preserves those graphs and exposes their date/data limitation.
The iframe's technical success must not be reported as actual-price-series acceptance.

The data repository chosen by the owner for future shared intelligence is
`Ventusltd/data-grid-gb`. Existing GridAtlas products remain with their current
owners until a separately tested migration is implemented. Preserve original
licences and source dates. More articles improve coverage only when identity,
deduplication, source quality and evaluation improve as well.
