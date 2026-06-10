# Generation charts and Analytics 
## energy units, generation, pipeline, electrification strategy 

https://globalgrid2050.com/uk_energy_tracking_v6/generation_history/

Current focus is to validate solar and UI then fetch other data sources for other energy types such as wind biomass etc from this connections to the Solar and battery storage pipeline becomes important datacentre impact should also be considered because of AI trends and once electricity generation sources are complete, the focus and comparison should turn to primary energy and fossil fuels which are not necessarily electricity. Look at the ONS papers for this.

# Plan: Headroom Intelligence Layer — Fault Level, Thermal and Firm Capacity, with Heat Maps

The objective is a single Atlas V8-compatible layer set that shows, per primary and grid substation, the three numbers that decide whether a connection is viable: thermal/firm capacity headroom (spare MW under normal and N-1 conditions), fault level headroom (the gap between existing short-circuit current and switchgear rating, which often kills inverter-heavy projects before MW does), and demand vs generation headroom direction. The method follows existing doctrine: first a study phase reading each DNO’s published sources — Embedded Capacity Registers, network capacity heat maps and Long Term Development Statements from UKPN, NGED, SSEN, SPEN, NPg and ENWL — documenting exact field names, units and licence terms in a markdown source register before any code; then one Python ingestion script per DNO (starting with a single DNO, likely UKPN as the data is cleanest) converting registers to a common GeoJSON schema keyed by substation name and coordinates; then one new map layer at a time into Atlas V8 using the proven layer-loading pattern, rendered as a heat map gradient (green = headroom, red = constrained) with a popup showing the raw figures, source and publication date; each step shipped via a dedicated GridBot workflow, browser-tested before the next. Education and lead generation are the outputs — every popup teaches what fault level headroom means in one sentence, and the layer becomes the page a developer screenshots when asking VENTUS where their project can actually connect. Confidentiality risk is nil by construction: only DNO-published datasets are ingested, attributed and dated, with no connection-offer or customer data ever included.

 
# Claude AI
# Build Next

Status: active planning file
Owner: Vikram
Doctrine: read `AI_START_HERE.md` and the latest diary note before acting on anything below.

-----

## Standing gate before any app-patch work

Per diary note `260522-0115-v7-rollback-and-working-method.md`:

The V7 GIS SLD app (`solar-bess-topology-v7/gis-sld-financial-sandbox/`) was rolled back to commit `14379fa9` after the Energy Users mega-feature broke layer loading and mobile layout.

- [ ] Confirm the V7 rollback is stable in the browser (cache-busted URL, desktop and mobile, console clean)
- Only after confirmation does new V7 development resume
- Energy Users, if reintroduced, goes one layer at a time using Atlas V8 exact proven paths: Data Centres first, then EV Rapid 100 kW plus, then Major Industrial Sites

-----

## Track 1: Generation Charts and Analytics

Energy units, generation, pipeline, electrification strategy.

Live page: <https://globalgrid2050.com/uk_energy_tracking_v6/generation_history/>

Type of work: GridBot data pipelines. One script per source, one workflow per pipeline, browser-validate each before the next.

Sequence:

1. **Validate solar and UI first.** This is the gate. The solar pattern must be proven end to end in the browser before any other fuel type is fetched, so a structural defect is not multiplied across six sources.
1. **Fetch remaining electricity generation sources** one at a time: wind, biomass, gas, nuclear, hydro, imports. Same pipeline pattern as solar.
1. **Once electricity generation sources are complete**, turn to the primary energy comparison: fossil fuels and total energy use that are not electricity. Source: ONS papers and DUKES. This comparison is the electrification argument itself — electricity is only a fraction of UK final energy, and the gap is the story.

-----

## Bridge: Pipeline and demand context (spatial, Atlas-adjacent)

These connect Track 1 generation data to Track 2 grid geography:

- Solar and battery storage pipeline connections become important once generation history is solid — link REPD pipeline layers to the generation story.
- Datacentre impact should be considered because of AI demand trends — datacentre layer already exists in Atlas V8 (`repd_grid_atlasv8/data/datacentres.geojson`); the work is analysis and narrative, not new ingestion.

-----

## Track 2: Headroom Intelligence Layer — Fault Level, Thermal and Firm Capacity, with Heat Maps

The objective is a single Atlas V8-compatible layer set that shows, per primary and grid substation, the three numbers that decide whether a connection is viable: thermal/firm capacity headroom (spare MW under normal and N-1 conditions), fault level headroom (the gap between existing short-circuit current and switchgear rating, which often kills inverter-heavy projects before MW does), and demand vs generation headroom direction.

Type of work: phase one is reading and documentation only — zero code. Suits sessions away from the keyboard.

Method, following existing doctrine:

1. **Study phase first.** Read each DNO’s published sources — Embedded Capacity Registers, network capacity heat maps and Long Term Development Statements from UKPN, NGED, SSEN, SPEN, NPg and ENWL — and document exact field names, units and licence terms in a markdown source register before any code is written.
1. **One Python ingestion script per DNO**, starting with a single DNO (likely UKPN as the data is cleanest), converting registers to a common GeoJSON schema keyed by substation name and coordinates.
1. **One new map layer at a time into Atlas V8** using the proven layer-loading pattern, rendered as a heat map gradient (green = headroom, red = constrained) with a popup showing the raw figures, source and publication date.
1. **Each step ships via a dedicated GridBot workflow**, browser-tested before the next.

Outputs: education and lead generation. Every popup teaches what fault level headroom means in one sentence, and the layer becomes the page a developer screenshots when asking VENTUS where their project can actually connect.

Confidentiality: nil risk by construction. Only DNO-published datasets are ingested, attributed and dated. No connection-offer or customer data is ever included.

-----

## Session selection rule

Pipeline-building energy available: work Track 1.
Reading-on-a-train energy available: work Track 2 phase one (source register).
Neither track touches V7 until the standing gate is cleared.

