# Ventus OS V7 | Architecture Document

**Version:** 7.2.0
**Last Updated:** 2026-05-01
**Status:** Experimental Sandbox — Innovation Platform
**Maintained by:** Ventus Ltd

---

## Directive

This document is the authoritative architecture reference for `repd_grid_atlasv8`.

If you are an AI agent or human engineer reading this: V7 is the experimental frontier of Ventus OS. V5 is frozen production — never touch it. V6 is frozen stable release — never touch it. All innovation happens here.

**The core philosophy inherited from the platform:**
> Perfect data is not required. Structured data reveals reality.
> Early constraint visibility prevents late-stage engineering failure.
> Build forward. Do not simplify.

---

## I. What V7 Is

V7 is the experimental sandbox clone of V6, created to receive new features without risking the stable production chain. It runs its own isolated engine, stylesheet, and data pipeline.

| Version | Engine | Status | Rule |
|---------|--------|--------|------|
| V5 | ventus-core.js | Frozen production | NEVER MODIFY |
| V6 | ventus-corev6engine.js | Frozen stable | NEVER MODIFY |
| V7 | ventus-corev8engine.js | Experimental | All new features go here |

**URL:** `https://www.globalgrid2050.com/repd_grid_atlasv8/`

---

## II. Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Map renderer | MapLibre GL JS v3.6.2 (CDN) | WebGL, GPU-accelerated |
| Styling | ventusv8.css | Dark-mode SCADA aesthetic, monospace |
| Engine | ventus-corev8engine.js | ~1,350 lines, config-driven |
| Layer config | repd_grid_atlasv8/index.html | HTML data cartridge — source of truth for all layers |
| Data | /dist/repd_master.json | Shared with V5/V6, pre-baked by Python ETL |
| Hosting | GitHub Pages | Zero server, pure static |
| CI/CD | GitHub Actions | Auto-deploy on push to main |
| ETL | Python scripts in scripts/ | pandas, pyproj, requests |

---

## III. Engine Architecture

### Config-Driven Design Goal

The engine is designed so that new layers can be added purely by editing `index.html` — the engine itself should never need to change for a new data layer. This is the primary architectural goal of V7 and beyond.

### Engine Boot Sequence

```
1. index.html defines GRID_CONFIG (layer config cartridge)
2. Engine parses GRID_CONFIG → builds RUNTIME_STATE, layerConfigById Map
3. map.on('load') fires:
   a. buildDOM() — renders sidebar checkboxes from GRID_CONFIG
   b. All MapLibre sources and layers added (initially empty, visibility: none)
   c. _rebuildVisibleCache() — seeds _visibleInteractiveIds from visible layers
4. User ticks a layer checkbox → handleLayerToggle(id, true)
   a. Sets MapLibre layer visibility
   b. Updates _visibleInteractiveIds and _visibleHoverIds caches
   c. Calls hydrateLayer(id)
5. hydrateLayer(id):
   a. Checks RUNTIME_STATE — skips if already loaded or loading
   b. Fetches GeoJSON from layerConfig.url via networkQueue
   c. Calls source.setData(features)
   d. For REPD layers: sets allREPDFeatures, buildSearchIndex(), runs evalFilter() stats
   e. Calls updateUIState(id, 'OK', stats)
6. map.on('click') → queryRenderedFeatures(_visibleInteractiveIds) → openPopup()
```

### Key Internal Systems

**`_visibleInteractiveIds` cache**
Array of currently-visible MapLibre layer IDs. Rebuilt on load, updated on every toggle. The click and hover handlers query only this cache — zero per-event property lookups.

**`networkQueue`**
Serial async queue for GeoJSON fetches. Prevents thundering-herd on initial load when multiple layers are toggled on simultaneously.

**`RUNTIME_STATE`**
Dictionary keyed by layer ID. Tracks `{ status, loading, loaded }` for every layer. Prevents duplicate fetches and drives the UI badge states (WAIT / LOAD / OK / EMPTY / FAIL).

**`evalFilter(filter, props)`** *(V7-only)*
Evaluates a MapLibre filter expression against a feature's properties. Supports `==`, `all`, `>=` operators. Used by `hydrateLayer()` to compute accurate count/MW stats for operational sub-layers whose IDs don't match the `tech` field.

**`buildSearchIndex()`**
Builds a flat search index from `allREPDFeatures` for the site search tool. Called every time the REPD source is hydrated.

---

## IV. Layer Architecture

### Source Model

All REPD layers (generation assets) share a single MapLibre source: `src-repd`.

This means the GeoJSON is fetched **once**, regardless of how many REPD sub-layers are enabled. Each sub-layer applies its own MapLibre filter expression to render only matching features from the shared source.

```
src-repd (single GeoJSON source, ~all UK generation assets)
    ├── l-solar              filter: tech=solar
    ├── l-solar_operational  filter: tech=solar AND status=operational
    ├── l-solar_roof         filter: tech=solar_roof
    ├── l-wind               filter: tech=wind
    ├── l-wind_onshore_operational  filter: raw_tech='Wind Onshore' AND status=operational
    ├── l-wind_offshore_operational filter: raw_tech='Wind Offshore' AND status=operational
    ├── l-bess               filter: tech=bess
    ├── l-bess_operational   filter: tech=bess AND status=operational
    └── ... (biomass, tidal, hydrogen, hydro, flywheel, act, geothermal, caes)
```

**Critical:** `REPD_IDS` array in the engine must list every REPD layer ID. When any one REPD layer is first hydrated, ALL REPD layers are marked loaded simultaneously — because they share the same source data.

### Operational Layer Pattern

Each operational sub-layer follows this pattern:

1. **Filter** — `['all', ['==', ['get', 'tech'], 'solar'], ['==', ['get', 'status'], 'operational']]`
   - Wind layers use `raw_tech` field (`'Wind Onshore'` / `'Wind Offshore'`) not `tech` field
2. **Radius interpolation** — capacity-proportional, range 0→500 MW
3. **Colour gradient** — light (small) → dark (large), distinct per technology
4. **Glow layer** — soft blur halo for assets >10 MW capacity
5. **Stats** — computed via `evalFilter()`, displayed as `N sites | X GW`

### Operational Layer Colour Palette

| Layer | Small (0 MW) | Large (500 MW) |
|-------|-------------|----------------|
| solar_operational | #66ff99 | #004411 |
| bess_operational | #ffccee | #660044 |
| wind_onshore_operational | #ccfff5 | #004433 |
| wind_offshore_operational | #cce5ff | #001166 |

### Non-REPD Layers

Each non-REPD layer gets its own dedicated source (`src-{id}`) and fetches its own GeoJSON URL independently. Examples: grid lines (400kV, 275kV, 132kV, 66kV, 33kV, 11kV), substations, EV chargers, transit (Elizabeth line, London Underground, metros, HS2), supermarkets, stadiums, airports, datacentres.

---

## V. Data Architecture

### REPD Master

**Path:** `/dist/repd_master.json`
**Shared with:** V5, V6, V7
**Built by:** `scripts/repd_updater.py` → GitHub Actions `repd_sync.yml`

Key fields used by V7:

| Field | Description |
|-------|-------------|
| `tech` | Technology category: `solar`, `bess`, `wind`, `biomass`, etc. |
| `raw_tech` | Raw REPD string: `'Wind Onshore'`, `'Wind Offshore'`, `'Solar'` etc. |
| `status` | Operational status: `operational`, `under construction`, `planning permission granted` etc. |
| `capacity` | Installed capacity in MW |
| `name` | Site name |
| `operator` | Operator name |
| `mounting` | Mounting type (ground/roof) — may be pandas `'nan'` string, always guard |

### NAEI Point Sources *(pipeline active, layers pending)*

**Path:** `/dist/naei_point_sources.json` *(not yet wired into V7 map)*
**Built by:** `scripts/fetch_naei_point_sourcesv8.py` → GitHub Actions `fetch_naei_point_sources.yml`
**Schedule:** 1 October annually + manual trigger
**Source:** naei.energysecurity.gov.uk (96MB Excel)
**Coordinates:** OSGB36 Easting/Northing → converted to WGS84 lon/lat

Key fields: Site, Operator, Sector, Pollutant_Name, Emission, Unit

---

## VI. Click and Interaction System

### Click Handler Flow

```
map.on('click', e)
  → if tool mode active (measure/draw/radius): route to tool handler, return
  → if _visibleInteractiveIds empty: return (no-op)
  → queryRenderedFeatures(e.point, { layers: _visibleInteractiveIds })
  → if no features: return
  → read features[0].properties
  → branch on p.type (supermarket / elizabeth_line_station / stadium / REPD default)
  → openPopup()
```

### Critical Rule — Variable Declarations in Click Handler

The click handler popup block contains a dense single-line variable declaration block immediately before `openPopup()`. This block declares: `tech, rawTech, voltage, capacity, powerKw, connectors, status, operator, mounting, capStr, statusCol, searchBtns, evFields`.

**Never replace this line partially.** Always read the full line with `get_file` and replace the complete line. Partial replacement of `mounting` within it caused BUG-004 (all operational layers not clickable).

### Hover System

`_visibleHoverIds` mirrors `_visibleInteractiveIds`. The mousemove handler throttles hover hit-testing to ~100ms cadence using RAF + timestamp guard to prevent GPU thrash.

---

## VII. V7-Specific Innovations (Beyond V6)

| Feature | Description | Commit |
|---------|-------------|--------|
| `evalFilter()` | Per-layer stats using MapLibre filter evaluation | e8e45bc |
| `nan` guard | Pandas null string suppression in popups | 7614ef3 |
| NAEI pipeline | Annual emissions point source ingestion | c3d0bfd |
| Bug tracker | captains_log/bug_tracker.md | this session |

---

## VIII. Rules for Future Engineers and AI Agents

1. **V5 and V6 are frozen.** Never modify ventus-core.js or ventus-corev6engine.js under any circumstances.

2. **One source of truth for layer config.** All layer definitions live in `index.html`. The engine reads config — it does not hardcode layers except for the `REPD_IDS` array (which must be kept in sync manually).

3. **REPD_IDS must be complete.** Every REPD sub-layer ID must appear in the `REPD_IDS` array in the engine. Missing entries mean the layer never gets hydrated or marked loaded.

4. **No blank lines inside script/style/div blocks in .md files.** Jekyll/Kramdown terminates HTML block parsing at blank lines, causing build crashes. This is a site-wide critical rule.

5. **Read before replacing.** Always `get_file` before any `replace_string_in_file`. For dense single-line blocks, replace the entire line — never a substring fragment.

6. **Check for duplicate consts.** After any engine edit, verify there is exactly one `ZONE_DRAW_DEFAULT_KM` declaration. A duplicate causes a fatal SyntaxError blank screen.

7. **V5 is the reference.** When debugging V7 click/hover/toggle behaviour, compare line-by-line against `ventus-core.js`. If V5 works and V7 doesn't, the delta is the bug.

8. **Commit messages must be descriptive.** Future engineers and AI agents use git history to understand what changed and why. Reference bug IDs from bug_tracker.md where applicable.

9. **pandas `'nan'` is not null.** Any field from a pandas-generated JSON may contain the string `'nan'`. Always guard optional display fields with `!== 'nan'`.

10. **The config-driven goal.** The long-term target is that adding a new layer requires only an `index.html` edit — zero engine changes. V7 is the platform where this architecture matures. Resist the temptation to hardcode layer-specific logic into the engine for new layers.

---

## IX. File Inventory (V7)

```
repd_grid_atlasv8/
├── index.html                          — Layer config cartridge + map shell
├── ventus-corev8engine.js              — V7 engine (~1,350 lines)
├── ventusv8.css                        — V7 stylesheet
├── captains_log/
│   ├── version_control.md              — Changelog
│   ├── bug_tracker.md                  — Bug log with root cause analysis
│   └── ARCHITECTURE_V8.md              — This document
└── scripts/
    └── fetch_naei_point_sourcesv8.py   — NAEI emissions annual fetcher
```

**Shared data (root `/dist/`):**
```
dist/
├── repd_master.json                    — All REPD generation assets (shared V5/V6/V7)
└── naei_point_sources.json             — NAEI emissions point sources (V7 pipeline, pending wiring)
```
