# Claude AI Deep Audit and Survey — GlobalGrid2050 (Ventus Ltd)

> **Document status.** Living orientation-and-audit file for the repository root. Written for two readers at once: a future AI assistant (Claude or similar) that needs to orient in seconds, and the human maintainer at Ventus Ltd. Last substantive review: 31 May 2026. **This document is allowed to go stale.** The repository moves fast — an automation system (“GridBot”) commits live data roughly every half hour, and the maintainer reshapes apps daily. Where this document and the live code disagree, **the live code is authoritative.** Verify before you act.

-----

# PART A — FAST ORIENTATION MAP

## A.1 What this repo is (one paragraph)

`Ventusltd/globalgrid2050` is the complete source of **GlobalGrid2050** (live at `globalgrid2050.com`), an open “infrastructure intelligence” platform for the electrification of the energy system. It is a **static site** deployed via **GitHub Pages with Jekyll**, with **no backend** — all logic runs client-side in the browser, and all heavy data work is pre-computed by **Python ETL scripts** run through **GitHub Actions** and committed by the automation system. The repository combines (1) interactive **geospatial atlases** of UK energy infrastructure built from the Renewable Energy Planning Database (REPD) and OpenStreetMap; (2) a **GIS + single-line-diagram + financial sandbox** for solar/BESS project screening; (3) a **live UK grid tracker** showing electricity demand, price, carbon intensity, generation mix and commodity signals; (4) **engineering estimators and a technical knowledge base**; and (5) a substantial **governance/doctrine layer** describing how humans and AI should jointly maintain the system. It is licensed under **CERN-OHL-S v2 (strongly reciprocal)**. The repository is public, had 1,271+ commits at the time of review, and is roughly 39% HTML, 32% Python, 25% JavaScript and 4% CSS by language share. 

## A.2 Repository topology (top-level)

The root is large and partly flat (many GeoJSON/CSV data files sit at the root alongside folders). Key locations:

- **Governance / doctrine docs (root):** `AI_START_HERE.md` (read first), `ARCHITECTURE.md`, `README.md`, `REPO_STRUCTURE.txt`, `DEV_NOTES.md`, plus a generated `REPOSITORY_SIZE_REPORT.md`. The README points all contributors at `AI_START_HERE.md` before editing.  (Note: `REPO_STRUCTURE.txt` is itself a *stale snapshot* — it predates the `uk_energy_tracking_*`, `repd_grid_atlasv8`, and several governance files now in the tree. Treat it as illustrative, not current — it is a concrete example of why this very document is “allowed to go stale.”)
- **Licence:** `LICENSE.txt` — full CERN-OHL-S v2 text plus a Ventus “Additional Notice”.
- **Apps (each its own folder):**
  - `repd_grid_atlasv3` … `repd_grid_atlasv8` — the REPD Grid Atlas / UK Energy Atlas line.
  - `solar-bess-topology`, `-v2`, `-v4`, `-v5`, `-v6`, `-v7`, `-v8` — the GIS SLD Financial Sandbox / BESS line.
  - `uk_energy_tracking`, `_v2`, `_v3`, `_v5`, `_v6` — the UK Live Grid Tracker line.
  - `uk_renewables_pipeline` — the renewables-pipeline analytics dashboard.
  - `33kv_uk_dap_price_estimator`, `lv_ac_dc_price_estimator`, `cable_geometry`, `cable_selection` — estimators/visualisers.
  - Knowledge base folders: `ac_cables_knowledge`, `dc_cables_knowledge`, `conductor_resistances`, `mv_and_hv_components`, `solar_components`, `power_systems_studies`, `employers_requirements`, `definitions`, `podcast_transcripts`, `nsip_solar_farms`, `solar_deployment_statistics`, `sld_single_diagrams_diagrams_and_grids`, `blog`, `marketing`.
- **Data (root + per-app `data/` folders):** 200+ `.geojson` files (grid lines by voltage, substations, ports, roads, rail, supermarkets, datacentres, etc.), REPD `.csv` extracts (`repd.csv`, `repd-solar-operational.csv`, `repd-grid-batteries.csv`, …), `ons-energy-fuels-clean.csv`, and JSON manifests. Newer atlas versions (v6/v7/v8) keep their own `data/` subfolder so the app is self-contained.
- **Python scripts:** root `scripts/` (the shared ETL + `gridbot_feature_installer.py` + `track_repository_size.py`) and per-app `scripts/` folders inside `repd_grid_atlasv6/7/8` (the `fetch_*v6.py` / `fetch_*v8.py` families). Each `scripts/` carries its own `requirements.txt`.
- **Workflows / automation:** `.github/workflows/` holds the GitHub Actions YAML (the GridBot scheduled-refresh and feature-install workflows). `feature_requests/NNN_name/manifest.yml` holds queued feature installs; `gridbot_reports/` holds time-stamped install reports.
- **Shared core:** root `ventus-core.js` and `ventus.css`; per-version engine variants `ventus-corev6engine.js` / `ventusv6.css`, `ventus-corev7engine.js` / `ventusv7.css`, `ventus-corev8engine.js` / `ventusv8.css`.
- **Site plumbing:** `index.html` / `index.md`, `_layouts/default.html`, `CNAME`, `config/registry.yaml`, `dist/` (`manifest_v4.json`, `repd_master.json`).

## A.3 THE VERSION MAP (critical — read before editing anything)

Versioned folders are **deliberate rollback protection**, not clutter. `ARCHITECTURE.md` says it verbatim: “Versioned folders are not waste. They are rollback protection… Keep at least 5 stable versions before deleting older versions.”  Three product lines run in parallel:

|Product line                         |Versions present                               |**CURRENT / canonical**                                                                                                |Legacy / experimental                                                                               |
|-------------------------------------|-----------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
|**REPD Grid Atlas → UK Energy Atlas**|v3, v4, v5, v6, v7, v8                         |**v8 — “UK Energy Atlas — Grid Overlay V8”** (`repd_grid_atlasv8/`, engine `ventus-corev8engine.js`)                   |v3–v5 older; v6 modular baseline; v7 workspace/captain’s-log build                                  |
|**BESS GIS SLD Financial Sandbox**   |v1 (base), v2, v4, v5, v6, v7, v8              |**v8 (in development)** is the leading edge; **v5 is the most complete proven finance build** (`gis-sld-v5-finance.js`)|v1/v2/v4 older; v6 “testing phase”; v7 “workspace”                                                  |
|**UK Live Grid Tracker**             |v1 (base `uk_energy_tracking/`), v2, v3, v5, v6|**V5 is the LIVE, auto-updating data spine (by design)**                                                               |v1 original protected; v2 transport-energy clone; v3 experimental; **V6 modular dev/proving ground**|

**The single most important operational fact in this repository:**

> **V5 of the energy tracker is the live, auto-updating data spine by design. V6 is the modular development / proving-ground build.** The live auto price-updating pipeline will **NOT** be switched from V5 to V6 until (a) the whole structure has been ported into modular V6 files and (b) V6’s chart interface is proven better than V5’s. **Therefore V6’s live snapshot being ~1 day stale is EXPECTED, not a bug.** V6’s own page states it plainly: “V6 modular development build. V5 remains the protected reference while this page runs the same tracker through modular V6 files.” Do not “fix” V6 staleness by repointing the live feed; that would regress the proving-ground discipline.

## A.4 KNOWN TRAPS AND BUGS (named, so future-Claude does not rediscover them)

These are maintainer-documented gotchas. **Verify each against live code before acting** — line counts and function names drift, and the JavaScript-level claims below are documented from maintainer knowledge rather than re-derived in this review.

1. **The “two `draw()` functions” trap in V5.** `price-history-render.js` exposes a public `V5PriceHistoryRender.draw` — but that renderer has **no high/low event boxes**. The renderer that actually produces the live chart is a **private `draw()` inside the IIFE in `price-history-ui.js`**. Editing the public one wastes turns because it isn’t what renders. **If you need to change the live chart, edit the private `draw()` in `price-history-ui.js` (or, preferably, move the work to the V6 module).**
1. **V5’s chart files are hand-minified, not truncated.** `price-history-ui.js` is only ~78 lines but ~27,767 bytes, with single lines up to ~2,554 characters. When pasted or viewed it *looks* truncated; it is not — the data is all there on very long lines. **Pretty-print/reformat before editing**, or hand the change to the V6 modular files instead of wrestling the minified V5 file.
1. **The V6 forecast feature is BUILT BUT UNWIRED.** `load_price_history_data.js` defines `forecastPoint()` and `loadForecastWindow()` (a 7-day seasonal baseline that prefers published actuals and falls back to a 10-year same-calendar-day / month+weekday average). `render_price_chart.js` still contains `drawForecast()`, `drawHealthBar()` and `forecastHealth()`. **But nothing calls `loadForecastWindow()`** — `control_price_history.js` only calls `loadWindow()`, which hardcodes `forecastRows:[]`. Result: the dashed forecast line and the health bar do not render, even though all the code exists.
1. **Latent `ReferenceError` if you reconnect the forecast.** `forecastHealth()` references `actualValue(...)`, which was **lost in a revert and is no longer defined** in `render_price_chart.js`. If forecast rows are ever supplied, this will throw a `ReferenceError`. **Reconnecting the forecast therefore requires restoring `actualValue()` first**, then wiring `loadForecastWindow()` into the control flow.
1. **Feature/claim mismatch in V6 copy.** The V6 `index.md` mechanism text still advertises an “indicative 7 day seasonal baseline” as a live feature (it appears in both the “Mechanism” list and the “Forecast baseline” paragraph) even though the forecast does not currently render (see #3). **Either finish wiring the forecast or remove/soften the claim** so the page does not over-state what it does. (This is verifiable on the live V6 page, which carries both the “indicative 7 day seasonal baseline” mechanism line and a “Forecast baseline: the dashed line is an indicative 7 day seasonal baseline” paragraph.)
1. **Data duplication and large binaries in git history.** Large GeoJSON files are byte-identical across multiple atlas version folders (e.g. `global_ports.geojson` ≈ 9.8 MB duplicated in v6/v7/v8 `data/`). Road/rail GeoJSON files of ~50–80 MB are committed directly to git history. **These are candidates for Git LFS and/or a shared data folder** — they bloat clones and every historical checkout.
1. **No dependency manifests at the repository root** (no root `requirements.txt` / `package.json`). Python dependencies live only inside per-`scripts/` `requirements.txt` files; JavaScript libraries are loaded by CDN `<script>` tags. A new contributor cannot `pip install -r requirements.txt` or `npm install` from the root.
1. **Duplicated TODO.** The note “migrate config into the shared GISSLD namespace at feature 007” is duplicated ~12 times across version config files — a single tracked task fragmented across the tree.

**Recently added governance (use it):** a **V6 guardrail preflight checker** (`scripts/v6_guardrail_preflight.py` plus its workflow), an auto-generated **`V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md`**, and a generated **`uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md`**. Run/read these before structural V6 work.

## A.5 “Where to look first for task X” quick-reference

|If your task is…                              |Go to…                                                                                                                             |
|----------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
|Edit the **live price chart**                 |`uk_energy_tracking_v5/price-history-ui.js` (private `draw()` — see Trap #1). Prefer porting to V6.                                |
|Work on the **modular price chart / forecast**|`uk_energy_tracking_v6/`: `load_price_history_data.js`, `render_price_chart.js`, `control_price_history.js`                        |
|Reconnect the **forecast / health bar**       |Restore `actualValue()` in `render_price_chart.js`, then wire `loadForecastWindow()` into `control_price_history.js` (Traps #3, #4)|
|Touch the **map / atlas rendering**           |`repd_grid_atlasv8/` + `ventus-corev8engine.js`; shared `ventus-core.js`, `ventus.css`                                             |
|Change the **live data pipeline / cadence**   |`scripts/update_prices*.py`, `scripts/fetch_*.py`, and `.github/workflows/*.yml` (GridBot)                                         |
|Work on **BESS/solar finance**                |`solar-bess-topology-v5/gis-sld-v5-finance.js` (rigorous model) and the v5 sandbox HTML                                            |
|Understand **governance / change rules**      |`AI_START_HERE.md`, `ARCHITECTURE.md`, `V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md`                                                    |
|Check **repo-size policy**                    |`REPOSITORY_SIZE_REPORT.md` + `scripts/track_repository_size.py`                                                                   |
|Run **V6 structural checks**                  |`scripts/v6_guardrail_preflight.py`; read `uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md`                                       |
|Confirm the **licence**                       |`LICENSE.txt` (CERN-OHL-S v2 + Ventus Additional Notice)                                                                           |
|Add a **feature via automation**              |`feature_requests/NNN_name/manifest.yml` + `scripts/gridbot_feature_installer.py`                                                  |

## A.6 Licence one-liner

**CERN-OHL-S v2 — strongly reciprocal (copyleft for hardware/designs/source).** Ventus framing, verbatim from `LICENSE.txt`: *“Built on public knowledge. Ventus contribution is the architecture. Licensed to the world. Misrepresentation is not permitted… Derivatives must be released under the same licence. Notices must be retained.”* If you build on it, your derivative and (for a conveyed Product) the **Complete Source** must be made available under CERN-OHL-S v2. **Do not reproduce the author’s personal name** — attribute to **Ventus Ltd**. (See Part B §B.7 for full obligations.)

## A.7 Maintenance note (keep this current; expect it to drift)

This document is a **map, not the territory.** GridBot commits roughly every 30 minutes and the maintainer reshapes apps daily, so file names, line counts, version numbers and even “current” designations *will* drift. Future-Claude must: (1) re-list the tree and re-read `AI_START_HERE.md` at the start of any session; (2) treat the **live code as authoritative** wherever it conflicts with this file; (3) update this document when a structural fact here is found to be wrong. Going stale is acceptable; silently trusting a stale claim is not.

-----

# PART B — DEEP SURVEY

## B.1 Mission, and what “Open Infrastructure Intelligence” means

GlobalGrid2050 describes itself on the live site as “an open grid development, engineering, procurement, construction and operations platform dedicated to documenting, analysing and improving the world’s electrical energy systems as they undergo rapid electrification.”  The GitHub tagline is terser — “Open infrastructure for electrification”  — and the README expands it to “a data platform and engineering intelligence repository dedicated to documenting and analyzing the physical behavior of electrical energy systems.” 

“Open Infrastructure Intelligence” is best understood as the intersection of three commitments. First, **open**: the platform is built entirely on public data (government planning registries, OpenStreetMap, public market and grid feeds), it is published under a strongly reciprocal open licence, and its architecture and reasoning are exposed rather than hidden behind a SaaS wall. Second, **infrastructure**: the subject matter is the physical electricity system — transmission and distribution lines by voltage class, substations, generation and storage assets, ports, cable corridors, and the demand centres (datacentres, industry, supermarkets, transport) that pull on them. Third, **intelligence**: the platform’s stated ambition is not merely to display data but to turn it into *constraint-aware reasoning* for early-stage decisions. The architecture document states the governing principle bluntly: **“Early constraint visibility prevents late stage engineering failure,”**  and it frames the platform as “a Serverless Spatial Digital Twin and Constraint First Design Engine”  rather than “a map,” “a dashboard,” or “a viewer.”

The deeper thesis is that real infrastructure failure usually begins *before* construction — when land, grid capacity, cable routes, losses, access, substations, revenue assumptions and delivery risk are analysed in separate silos. GlobalGrid2050 exists to bring those assumptions into one spatial and technical reasoning environment so the conflicts become visible early, when they are cheap to fix. The maintainer’s stance, recorded in `ARCHITECTURE.md`, is that “perfect data is not required; structured data reveals reality”  — an explicitly screening-grade, directional ambition rather than a claim to survey-grade truth.

## B.2 Full platform architecture

**Deployment model.** The site is a static site served by **GitHub Pages** and built with **Jekyll** (the deployed pages carry a `Jekyll v3.10.0` generator tag). A `CNAME` file binds the custom domain `globalgrid2050.com`; `_layouts/default.html` provides the shared page chrome;  many app pages are plain `index.html` files that bypass templating entirely. There is **no application backend, no database server, and no server-side rendering.** This is a deliberate architectural choice: it removes backend latency and operating cost, makes the whole system trivially forkable, and means every page either works as flat files or doesn’t work at all.

**Client-side stack.** The README enumerates the core browser dependencies, all loaded client-side:

- **Leaflet.js** — geospatial visualisation, marker clustering and layer rendering.  
- **Proj4js** — client-side coordinate transformation, specifically **OSGB36 → WGS84**,  because UK source data frequently arrives in the British National Grid easting/northing system and must be reprojected to lat/long for web mapping.
- **PapaParse** — high-speed in-browser CSV parsing, used to ingest the government datasets  (REPD extracts, ONS series) directly.
- **DataTables** — client-side DOM filtering, pagination, sorting and search over the tabular views. 

**The shared core.** The rendering and interaction logic is centralised in **`ventus-core.js`** with styling in **`ventus.css`**. As the platform versioned forward, the core was forked into engine variants — **`ventus-corev6engine.js`**, **`ventus-corev7engine.js`**, **`ventus-corev8engine.js`** — each paired with a matching stylesheet (`ventusv6.css`, `ventusv7.css`, `ventusv8.css`)  and bundled inside the corresponding atlas version folder. The architecture document describes the core as a WebGL-capable rendering engine that consumes GeoJSON, applies GPU filters, and splits layers by asset and constraint type to keep the browser responsive; the visual language is a deliberate “dark-mode SCADA aesthetic” with monospace typography and operational colour coding (red/magenta for hard constraints, cyan/white for corridor intelligence, yellow for electrical nodes, green for viable connection logic, blue for project boundary).

**The geometry doctrine.** This is one of the most important and explicitly defended design rules. The architecture document mandates that **all distance calculations use geodesic metres via Haversine logic** — “Respect the geometry. All calculations must use geodesic metres via Haversine logic… No shortcuts permitted… Mathematics controls location. Manual drawing is secondary.” The Haversine great-circle formula treats the Earth as a sphere  of mean radius; it is accurate to roughly half a percent (the error stems from the Earth being an oblate ellipsoid whose equatorial and polar radii differ by ~21 km),  which is more than sufficient for screening-grade infrastructure distances. Where the system departs from pure geodesy is a **documented, deliberate planar grid-snapping performance trade-off**: for laying out and snapping array geometry to a grid, the system uses a planar approximation because snap-rounding and re-layout on a projected plane is far cheaper computationally than repeatedly solving ellipsoidal geodesics, and over the small spatial extent of a single site the curvature error is negligible. The key governance point is that this trade-off is *acknowledged and bounded* rather than hidden — geodesic Haversine for real-world distances, planar maths only for local grid-snapping where the error is immaterial.

**Scaling philosophy.** Because there is no server, the architecture “defends the browser” by scaling horizontally with regional HTML “cartridges,” modular assets and pre-processed data, and “defends the repository” by pushing all large/repeatable file operations into Python + YAML + GitHub Actions rather than manual editing. Large files are explicitly tolerated (“Huge files are not the enemy. Uncontrolled editing is the enemy”)  provided they remain structured, versioned and script-maintained.

## B.3 The major applications, in depth

### B.3.1 REPD Grid Atlas → UK Energy Atlas (Grid Overlay V8)

This is the platform’s flagship geospatial product: an interactive Leaflet map that overlays the UK electricity network (lines coded by voltage — 11 kV, 33 kV by DNO region, 66 kV, 132 kV, 220 kV, 275 kV, 400 kV — plus `grid_substations.geojson`) with renewable and storage assets drawn from the REPD, and with a deep stack of contextual and constraint layers: ports, airports, datacentres, industrial off-takers, heavy emitters, railways, the Underground/metros/trams, HS2, motorway services, subsea cables and a long list of supermarket estates (Aldi, Asda, Tesco, Sainsbury’s, Lidl, Morrisons, Co-op, Waitrose, M&S, Iceland, Costco, Booths, Farmfoods, Spar). The current canonical line is **V8 — “UK Energy Atlas — Grid Overlay V8”** (`repd_grid_atlasv8/`), with V6 and V7 retained as the modular baseline and the workspace/“captain’s log” build respectively. From V6 onward, each atlas version carries its own self-contained `data/` folder and `scripts/` fetcher set, so the app can be reasoned about and deployed as a unit. The atlas is the clearest expression of the “constraint-first” thesis: the value is in seeing, simultaneously, where the grid is, where assets cluster, and what physical features would obstruct or compress a new connection.

### B.3.2 BESS GIS SLD Financial Sandbox

The architecture document calls this “a breakthrough application”  and treats it as the seed of a future full “infrastructure operating system.” It is neither just a map nor just a calculator: it combines location search, substation/grid-node selection, indicative solar array layout generation, string-vs-central inverter topology comparison, module-count and DC/AC capacity estimation, gross site-area and container/packing logistics, BESS sizing, baseline CAPEX and revenue assumptions, degradation and electrical-loss assumptions, and GeoJSON export that preserves the assumptions inside the exported data. The line runs `solar-bess-topology` (base) → v2 → v4 → v5 → v6 (testing) → v7 (workspace) → v8 (in development, the leading edge on the live index).

Crucially, the sandbox contains **two distinct finance models**, and a future editor must not confuse them:

1. A **naïve payback model** — a simple revenue-minus-cost / payback-period calculation suitable for the very first cut.
1. A **more rigorous model in `gis-sld-v5-finance.js`** that incorporates **net present value (NPV), degradation over time, and development-stage** logic — a materially more defensible screening tool. V5 is therefore the most complete *proven* finance build even as V8 leads on overall sandbox development.

The architecture document is emphatic that this application must not be trivialised or “broken through cosmetic refactoring,” and that its engineering, GIS, SLD, financial and export logic must not be removed without a documented replacement.

### B.3.3 UK Renewables Pipeline dashboard

`uk_renewables_pipeline/dashboard.html` is an analytics dashboard over the REPD pipeline — renewable and storage projects tracked from planning application through consent, construction and operation. Where the atlas is spatial, this view is analytical: capacity by technology, by development status, and by trend, built on the same REPD `.csv` extracts. It complements the atlas by answering “how much, at what stage” rather than “where.”

### B.3.4 UK Live Grid Tracker (V5 live spine; V6 modular proving ground)

The tracker is the platform’s real-time face: “GB Electricity, Price, Carbon, Oil and Transport Energy Monitor.” **V5 is the live, auto-updating spine by design** (see Part A §A.3). Its documented sections include:

- **Live electricity snapshot** — demand (GW), market price (£/MWh) and carbon intensity (g/kWh). The page states generation mix refreshes every 5 minutes; price and carbon update every half hour at their native cadence; commodity prices update daily through GridBot.
- **Generation mix** — the live fuel breakdown.
- **Electricity price history chart** — Elexon half-hourly settlement price in £/MWh, with selectable year/start/period windows that lazy-load the relevant annual Elexon CSV, a red line marking £0/MWh, and **seasonal colour bands**; high/low event markers; full-screen mobile controls.
- **Grid frequency 24-hour trace** — the system frequency around 50 Hz.
- **Weekly grid health.**
- **Oil price 25-year trend** — Brent and WTI in USD/bbl over windows up to 25 years (FRED historic series).
- **Road fuel & EV charging** — DESNZ weekly petrol/diesel averages with an explicit pump-price build-up logic (product cost proxy from Brent + FX + ~159 litres/bbl, then refining spread, wholesale and retail margin, duty and VAT), plus an EV-charging comparison block.
- **Commodity signals** — Brent, WTI, copper and aluminium.
- **Full data-source attribution** block.

**V6** runs the same tracker through **modular files** (`load_price_history_data.js`, `render_price_chart.js`, `control_price_history.js`, etc.) and is the development/proving ground. Its page explicitly notes “V5 remains the protected reference while this page runs the same tracker through modular V6 files.” Sections V6 has **not yet ported** from V5 include the **grid frequency 24-hour trace, the oil-price history, the road fuel / EV charging block, and the full attribution section** — V6 currently shows the snapshot, generation mix, price history, and commodity signals, with a trimmed attribution. This is the expected state of an in-progress port, not breakage. (The live V6 page corroborates this: it carries the snapshot, generation mix, price-history chart, and commodity signals, and a short attribution paragraph, with no frequency/oil/road-fuel sections yet.)

## B.4 The data layer

**Scale and shape.** The repository ships on the order of **200+ GeoJSON datasets** (the documented structure snapshot counts hundreds of files across root and per-app `data/` folders), plus REPD CSV extracts and ONS series. Datasets fall into three buckets: the **electricity network** (lines by voltage class, substations); **assets** (power plants, batteries, solar, hydrocarbons); and **constraint/context** (ports, airports, rail, roads, datacentres, heavy emitters, supermarkets, subsea cables, transit lines). The architecture document is careful to label external infrastructure layers as **“Reference Constraint Layer”** intelligence — “treat as constraint intelligence input, not ground truth”  — and to bar their use for final engineering, survey-grade validation, legal boundary confirmation, grid-offer confirmation or construction approval. 

**Sources and licence obligations** (these matter for the reciprocal licence and the anti-misrepresentation stance):

- **REPD** — the Renewable Energy Planning Database, published quarterly via `data.gov.uk` / GOV.UK and managed by Barbour ABI on behalf of DESNZ. Licensed under the **Open Government Licence v3.0**; the required attribution is “Contains public sector information licensed under the Open Government Licence v3.0.”   REPD tracks UK renewable and storage projects through the planning system; per GOV.UK, “the minimum threshold for installed capacity was 1MW until 2021, at which point it was lowered to 150kW”  (so projects below 1 MW before 2021 may be absent).
- **OpenStreetMap via the Overpass API** — the source for most context layers (roads, rail, ports, supermarkets, etc.), under the **Open Database Licence (ODbL)**. Obligations: attribute “© OpenStreetMap contributors,” make clear the data is available under the ODbL (e.g. link to openstreetmap.org/copyright), and note that substantial derivative *databases* must themselves be offered under ODbL.
- **Elexon BMRS Insights** — generation mix, demand and the settlement/system price series. Free public API (no key) under the **BMRS Data Licence Terms**; required attribution: “Contains BMRS data © Elexon Limited copyright and database right [year],”  with an explicit condition that you must **not mislead others or misrepresent the data or its source**, nor suggest Elexon endorsement.
- **NESO Carbon Intensity API** — GB carbon intensity (developed by the National Energy System Operator with the Environmental Defense Fund Europe, the University of Oxford Department of Computer Science and WWF, with Met Office weather data).  Licensed **CC BY 4.0**  — attribution required.
- **Sheffield Solar PV_Live** — half-hourly GB solar generation estimates (University of Sheffield, funded by NESO).  Licensed **CC BY 4.0** (“PV_Live by Sheffield Solar is licensed under CC BY 4.0”). 
- **ONS** — macro energy-consumption series (`ons-energy-fuels-clean.csv`, the UK macro energy trends page).
- **Commodity / oil feeds** — Brent/WTI/copper/aluminium from public market endpoints (the V5 page names Yahoo Finance live-chart endpoints and FRED historic oil series), with UK pump prices read from DESNZ weekly road-fuel statistics. The tracker explicitly flags these as “best effort public page read… indicative only.”

The tracker’s own attribution block models the right behaviour: it names each source, its licence, and states “Indicative near real time values for screening and situational awareness only. No representation is made that the data is accurate or complete.”

## B.5 The automation / GridBot pipeline

The repository’s most distinctive feature is its **operating model for change**, codified in `ARCHITECTURE.md` and `AI_START_HERE.md`. The pipeline is:

> **Human strategic intent → AI reasoning → Feature manifest (YAML) → Python installer → GitHub Action → GridBot commit → Reviewable report → Human approval.**

Concretely: the **Python ETL layer** (the root `scripts/` plus per-atlas `scripts/` folders — on the order of ~147 Python scripts across the tree, the `fetch_*`, `update_*`, `generate_*`, `repd_updater*` families) does all heavy and repeatable work: pulling from Overpass/Elexon/NESO/REPD, computing Haversine geometry, generating and de-duplicating GeoJSON, editing large files deterministically, and producing reports. **GitHub Actions workflows** in `.github/workflows/` (on the order of ~169 YAML workflows) provide the compute and scheduling; the scheduled refresh jobs are what give the live tracker its **roughly 30-minute data cadence** for the fast-moving series (generation mix every ~5 minutes, price/carbon every half hour, commodities daily). **GridBot** is the automation identity that commits the results, preserving traceability through time-stamped install reports in `gridbot_reports/`.

The **feature-manifest install system** is the controlled path for *code* changes: a feature lives in `feature_requests/NNN_name/` with a `manifest.yml` describing operations (`replace`, `insert_after`, `insert_before`, `regex_replace`, `assert_contains`) and an optional `files/` overlay tree; `scripts/gridbot_feature_installer.py` applies it and writes a report. The documented discipline (“one feature, one manifest, one controlled change, one GridBot run, one browser test, then continue”) and the recorded lessons (e.g. one-time replacement features must be converted to assertion-only checks after they succeed, or they fail on re-run) show this is a battle-tested workflow, not aspiration. The doctrine’s division of labour is explicit: **AI reasons and drafts; Python executes deterministically; YAML defines the instruction set; GitHub Actions runs it; GridBot commits; humans retain design authority and final approval.**

## B.6 Governance and operating doctrine

GlobalGrid2050 carries an unusually heavy governance layer for a project of its size, which is itself a deliberate response to the risks of fast, AI-assisted development:

- **`AI_START_HERE.md`** — the mandatory first read; the README routes all contributors to it before any modification.
- **`ARCHITECTURE.md`** — the long-form constitution: the eight core systems, the geometry doctrine, the huge-file maintenance/modularisation rules, the versioning-as-rollback policy, and the “do not regress / build forward / do not simplify” directives.
- **`PHILOSOPHY.md`** — the “why”: constraint-first design, structured-data-reveals-reality, engineering truth over appearance.
- **`LAUNCH_FREEZE.md`** — the change-control posture around launch (keep data in-repo, don’t split into a data repo or undertake risky refactors during launch prep unless explicitly approved).
- **`WORKFLOW_REGISTRY.md`** — the catalogue of GitHub Actions workflows and what each does.
- **`OPERATOR_MANUAL_V1.md`** — the human operator’s runbook.
- **Repository-size governance** — `scripts/track_repository_size.py` generates `REPOSITORY_SIZE_REPORT.md` (run monthly or via the “Track Repository Size” workflow); current policy keeps data in-repo until size or workflow performance creates a real reason to separate it, with a possible future `globalgrid2050-data` repository deferred until after launch. 
- **AI-proposes / human-approves change control** — AI agents must not blindly rewrite whole files; humans originate intent and approve outcomes; workflows are manually triggered and validated. 
- **Versioning-as-rollback-protection** — never destroy a working version during experimentation; create new versions before structural refactors; keep ≥5 stable versions before deletion.
- **Newly added V6 guardrail layer** — `scripts/v6_guardrail_preflight.py` and its workflow run pre-flight integrity checks before V6 structural work; `V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md` is the auto-generated protocol the checker enforces; `uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md` is a generated diff of what V6 has and has not yet ported from V5. This guardrail layer is the most recent maturation of the doctrine: it operationalises “don’t regress” as an automated check rather than a hope.

The throughline of the doctrine is **disciplined velocity**: the maintainer wants to move fast with AI assistance but has built versioning, manifests, reports, size tracking and pre-flight guardrails precisely so that speed does not become uncontrolled regression.

## B.7 CERN-OHL-S v2 in practical depth

The repository is licensed under the **CERN Open Hardware Licence Version 2 – Strongly Reciprocal (CERN-OHL-S-2.0)**, copyright CERN 2020, OSI-approved. Although it was written for open *hardware*, version 2 was deliberately broadened to cover artistic, mechanical, electronic and even software designs, so it applies coherently to a data/design platform like this one. The `LICENSE.txt` reproduces the full CERN text and appends a Ventus “Additional Notice.”

**What “strongly reciprocal” means.** Reciprocal (a.k.a. copyleft) licences require that those who use the work “give back” their changes. The *strong* variant goes further than the *weak* one: when CERN-OHL-S–covered source is incorporated into a larger Product, the **Complete Source for the whole Product** must be made available, not merely the modified covered portion. The Free Software analogy is GPL (strong) vs LGPL (weak). CERN ships three variants — permissive (CERN-OHL-P), weakly reciprocal (CERN-OHL-W) and strongly reciprocal (CERN-OHL-S) — and this project chose the strongest.

**Key defined terms (from the licence text in `LICENSE.txt`):**

- **Source** — design materials or digital code that can be used to make, test or prepare a Product, in any medium.
- **Covered Source** — Source explicitly made available under this Licence.
- **Complete Source** — *all* Source necessary to make a Product, in the preferred form for modification, including installation and interfacing information; if a proprietary format is used it must also be provided in an FSF/OSI-viewable format.
- **Available Component** — a part/library/code either already licensed as Complete Source under a Compatible Licence, or generally available with enough rights/information to make or source it (or part of a normal design/make tool). Available Components may stay under their own licences and need not be re-licensed.
- **Product** — any device, component or work arising from using/processing Covered Source.
- **Make** — to create/configure by manufacture, assembly, compiling, loading or applying source.
- **Convey** — to communicate to the public or distribute. 

**Obligations by audience:**

- **You just use the live site** (`globalgrid2050.com`). You are not Conveying anything and incur essentially no licence obligations beyond ordinary law. The platform’s own disclaimers (screening-grade, not engineering advice) still apply to how you should *rely* on it.
- **You fork or reuse the code or data.** You may copy and Convey verbatim copies provided you **retain all Notices** (copyright, licence references, source-location and disclaimer notices). If you **modify** Covered Source, you must: add a notice stating you modified it (with date and brief description); license the modified Covered Source **as a whole under CERN-OHL-S v2**; and, if you Convey it where the recipient doesn’t otherwise get the modified source, provide a **Source Location** that you reasonably expect to stay accessible for at least three years. Note the licence’s own caution: *including Covered Source in a larger work is itself a modification, and the larger work becomes modified Covered Source.*
- **You build a commercial product on top.** Permitted — CERN-OHL-S is not non-commercial — **but** when you Make and Convey a Product, you must give each recipient either a copy of the **Complete Source** or notice of its Source Location, and that Complete Source is itself Covered Source subject to all the section 3.3 obligations. There is a royalty-free patent grant (section 7), but instituting patent litigation over the Covered Source terminates your rights.  Breach terminates the licence immediately, with a 30-day cure path for first breaches.  You also may not use the Licensor’s or CERN’s name/logo to imply endorsement (section 8.2).

**The anti-misrepresentation stance.** The Ventus “Additional Notice” sharpens the licence into the project’s ethic: the platform is “built entirely on public knowledge… no proprietary, confidential, or commercially sensitive data has been used,” the “Ventus contribution is the architecture,” and **“Derivatives must be released under the same licence. Notices must be retained. Misrepresentation is not permitted.”**  It also disclaims liability for incidental disclosures inside third-party public datasets and directs that any such findings be reported to the original data publisher for correction. Operationally for future-Claude: **keep attribution honest, keep claims matched to what the code actually does (see Trap #5), and attribute authorship/stewardship to “Ventus Ltd” — do not reproduce the personal name that appears in the licence header.**

## B.8 Context: the ENTSO-E final report on the 28 April 2025 Iberian blackout

The motivating real-world backdrop for honest, open grid intelligence is the **Iberian blackout of 28 April 2025** — the loss of power across mainland Spain and Portugal, Europe’s most severe power-system incident in over two decades. ENTSO-E convened an Expert Panel under the Incident Classification Scale (ICS) methodology — a **49-member Panel including representatives from Transmission System Operators (TSOs), Regional Coordination Centres (RCCs), ACER and National Regulatory Authorities (NRAs), chaired by experts from two unaffected TSOs.** The Panel released a **factual report on 3 October 2025**  and its **final report on 20 March 2026** (covered widely from 20–23 March 2026).

**What the report actually found.** The final report’s own conclusion is that **“the blackout resulted from a combination of many interacting factors, including oscillations, gaps in voltage and reactive power control, differences in voltage regulation practices, rapid output reductions and generator disconnections in Spain, and uneven stabilisation capabilities”**   (ENTSO-E, 20 March 2026). The report **identified exactly fifteen factors** that contributed to the incident. The core themes:

- **Voltage control and reactive-power management failures.** Damián Cortinas, Chair of the ENTSO-E Board of Directors, stated at the 20 March 2026 media briefing: **“The problem is not renewable energy, but voltage control, regardless of the type of generation.”** Key voltage-control equipment (e.g. shunt reactors) was connected/disconnected **manually**, slowing response; several conventional generators failed to meet the system operator’s reactive-power set-points (the report notes several missed the reactive-power reference in at least 75% of the hourly samples that form the compliance rule); and operators lacked real-time monitoring of the gap between reactive power required and supplied.
- **Fixed-power-factor inverters.** A key factor was that renewable energy power plants were set to follow a fixed-power-control mode; units operating in fixed-power-factor mode “injected a proportional and rapid reactive-power ramp, and therefore a corresponding voltage ramp, into the system whenever a fast active-power change occurred, such as during a schedule adjustment” — limiting their ability to counter voltage swings.
- **Overvoltage-driven generation tripping.** PV inverters tripped on overvoltage during parts of the day, some with protection thresholds set **below regulatory limits**  and measured away from the point of connection;  the reconnection behaviour of **non-observable** small PV played an important role in the lost generation.
- **Oscillations.** The event involved oscillatory instability — a ~0.63 Hz local mode and a ~0.2 Hz inter-area mode — against a backdrop of a low-damped inter-area mode in the Continental Europe Synchronous Area.
- **Loss of synchronism.** The cascade was extraordinarily fast: between 12:32:00 and 12:32:48 output from large (>5 MW) Spanish renewables fell ~500 MW; by 12:33:16 disconnections around Badajoz removed 727 MW of PV/CSP; a further 928 MW dropped across five provinces within two seconds; with >2.5 GW lost and voltages exceeding 435 kV, at **12:33:19 the Spanish and Portuguese systems lost synchronism** with the European grid, and defence/load-shedding between 12:33:19 and 12:33:22 could not stop the collapse. **Restoration took 12–16 hours**, which (per the GO15 summary of the final report) “revealed gaps in real-time monitoring, cross-border coordination, and DSO-TSO communication.” 
- **Poor real-time observability.** The investigation was itself **hampered by incomplete data** — DSOs lacked access to actual production from generators below 1 MW (mostly rooftop solar), and several owners lacked fault records — and the report stresses that **limited observability** of system behaviour was both a contributing condition and an investigatory obstacle. Its 22 recommendations (across voltage/reactive power, oscillatory stability, disconnection behaviour, and defence/restoration) repeatedly call for **improved real-time visibility, standardised data collection, and closer coordination and data exchange among operators**, alongside a shift from fixed-power-factor schemes to active voltage control and harmonised European voltage ranges (380–420 kV).

**Why this is the motivating backdrop.** The single most transferable lesson is the **observability argument**: a modern, inverter-rich grid failed in part because the people running it could not see, in real time, what reactive power was being supplied versus needed, and investigators afterwards could not fully reconstruct events because the data did not exist or was not shared. GlobalGrid2050’s bet — open, honest, public-data grid intelligence that makes constraints and system state visible early and transparently — is precisely a bet on the value of observability. The blackout also validates the platform’s insistence on honesty about limits: the report is a case study in how *unhelpful speculation* (here, premature blame on renewables) fills the vacuum when transparent data is missing, and how an honest multi-factor analysis is more useful than a tidy single cause.

## B.9 Honest assessment: strengths, weaknesses, and societal value

**Strengths.**

- **Genuinely open and forkable.** Static-site + public-data + strongly-reciprocal-licence is a coherent, principled stack.  Anyone can clone, inspect, and run it; the reciprocal licence keeps derivatives open.
- **Constraint-first framing is the right one.** Co-locating grid, land, assets and obstructions in one view addresses a real failure mode (siloed early-stage analysis) that the industry genuinely suffers from.
- **Unusually disciplined for its size.** The governance layer — versioning-as-rollback, feature manifests, GridBot reports, size tracking, and now V6 pre-flight guardrails — is more mature than most solo/small projects, and it is honest about being a fast-moving, AI-assisted build.
- **Honesty about limits is built into the product**, not bolted on: “Reference Constraint Layer,” “indicative… for screening and situational awareness only,” and explicit exclusions from survey-grade/legal/grid-offer use.
- **Two-tier finance modelling** (naïve payback *and* NPV/degradation/development-stage) shows awareness that a quick estimate and a defensible estimate are different things.

**Weaknesses.**

- **Reach.** The repository currently shows minimal external traction (0 stars, 0 forks and 0 watchers on GitHub at the time of review).  The societal value of open intelligence is only realised if people use it.
- **Feature/claim drift.** The unwired V6 forecast advertised as live (Trap #5) is exactly the kind of small dishonesty the project’s own ethic forbids; small mismatches erode the credibility that is the project’s main asset.
- **Repository hygiene.** Multi-megabyte GeoJSON duplicated across version folders and 50–80 MB files in git history (Trap #6), no root dependency manifests (Trap #7), and a fragmented duplicated TODO (Trap #8) raise the cost of contribution and clones.
- **Finishing the port.** V6’s value is contingent on completing the modular port (frequency, oil, fuel/EV, attribution) and proving the chart interface superior before the live spine moves — until then the platform carries two parallel trackers.
- **Over-trust risk.** A polished screening map can be mistaken for survey-grade truth. The disclaimers are good, but the more credible the UI looks, the more a user may lean on a constraint layer (“reference intelligence, not ground truth”) to make a decision it cannot support. This is the platform’s central ethical risk and the gap between its potential and realised value.

**Does it add societal value?** On balance, **yes — conditionally.** The case *for* is strong and is sharpened by the Iberian blackout: democratising grid and connection intelligence, exposing constraints early, and modelling honesty about data limits all push in the direction of a more observable, better-understood system, which is exactly what the ENTSO-E report says the grid needs. The case *against* is the over-trusted-tool risk and the gap between potential and realised value (limited reach, an unfinished port, and claims that occasionally outrun the code). The net is positive **so long as** the project keeps its claims matched to its code, finishes what it advertises, and never lets a good-looking screen masquerade as engineering truth. The platform’s value is real but currently more *potential* than *realised*; closing that gap is a matter of reach, finishing, and honesty rather than of architecture.

## B.10 Staged recommendations roadmap

**Stage 0 — Honesty hygiene (do first; cheap, high-trust-yield).**

1. Resolve Trap #5: either wire the V6 forecast (Stage 1) or remove/soften the “indicative 7 day seasonal baseline” live claim in V6 `index.md` now.
1. Audit every “Mechanism/Outputs” claim across apps against what the code actually does; fix mismatches. This directly protects the anti-misrepresentation ethic.
1. Confirm every data source’s attribution string is present and correct (OGL v3.0 for REPD, ODbL for OSM, BMRS terms for Elexon, CC BY 4.0 for NESO and PV_Live).

**Stage 1 — Finish the V6 tracker port (unblocks the live-spine migration).**

1. Restore `actualValue()` in `render_price_chart.js` (Trap #4) before touching the forecast.
1. Wire `loadForecastWindow()` into `control_price_history.js` so `forecastRows` is populated; verify `drawForecast()`/`drawHealthBar()` render; browser-test (Trap #3).
1. Port the missing V5 sections to V6: grid frequency 24h trace, oil-price history, road fuel/EV, full attribution. Update `V5_V6_COMPARISON_REPORT.md`.
1. **Benchmark/threshold to flip the live spine to V6:** V6 reaches feature parity with V5, the forecast renders without errors, the chart interface is demonstrably better (define the metric — e.g. interaction latency, mobile usability, code maintainability), and `v6_guardrail_preflight.py` passes. Until then, V6 staleness stays expected.

**Stage 2 — Repository hygiene (lowers contribution and clone cost).**

1. Migrate large/duplicated GeoJSON (e.g. `global_ports.geojson`, 50–80 MB road/rail files) to **Git LFS** and/or a single shared data path referenced by versions; measure the effect via `REPOSITORY_SIZE_REPORT.md`.
1. Add **root dependency manifests** (a top-level `requirements.txt` aggregating the per-script ones; document the CDN-loaded JS libraries and their versions).
1. Consolidate the duplicated “feature 007 GISSLD namespace” TODO into one tracked issue.

**Stage 3 — Consolidation and reach.**

1. Decide and document the canonical version per line (V8 atlas, V8 sandbox, V5→V6 tracker) and prune toward the ≥5-stable-versions policy once replacements are proven.
1. Complete the “migrate config into the shared GISSLD namespace” refactor via the manifest pipeline.
1. Grow reach deliberately: a short “how to use responsibly (and what it is *not*)” explainer, a methodology page per app, and outreach to the analyst/developer/educator audience that comparable open grid dashboards serve. Reach is the binding constraint on realised societal value.

**Stage 4 — Standing discipline (ongoing).**

1. Keep using the human-intent → AI-reasoning → manifest → Python → Actions → GridBot → review loop; never let AI wholesale-rewrite working files.
1. Run `v6_guardrail_preflight.py` before structural V6 work; keep `REPOSITORY_SIZE_REPORT.md` monthly.
1. Keep this audit document current; re-verify its structural claims against the live tree each major session and correct it when it drifts.

-----

*Prepared as a root-level orientation-and-audit document for review by Ventus Ltd. Authorship and stewardship of GlobalGrid2050 are attributed to Ventus Ltd; live operations to the automation system (“GridBot”); and design decisions to the maintainer. Cross-check every specific file name, line count and “current version” claim against the live repository before relying on it — the code is authoritative.*
