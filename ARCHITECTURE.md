GlobalGrid2050 Map Architecture 3rd April 2026 19:42 Claude AI Summary 

# GlobalGrid2050 | Ventus Core — Architecture

*Last updated: 2026-04-03 | v5.7 | Q4 2025 REPD data live*

---

## 1. Map Frontend (`repd_grid_atlasv4/index.html`)

Built using **MapLibre GL JS v3.6.2** — GPU-accelerated WebGL rendering.

Single-page dashboard with HUD header (system time, 2050 countdown), full-screen map canvas, and SCADA-style layer control panel.

All REPD technology layers share a **single `src-repd` GeoJSON source**. MapLibre filters natively per tech type — no manual JS filtering, no duplicate data loads.

Non-REPD layers (topology, assets) each have their own source, loaded on-demand via checkbox.

**Layer architecture:**
- Topology: 400kV, 275kV, 220kV, 132kV, 66kV transmission lines + substations
- Assets: Nuclear, Gas, Industry, Data Centres, Airports, Railways
- REPD: Solar PV, Solar Roof, Wind, BESS, Biomass, Tidal/Wave, Hydrogen, Flywheel, Hydro

**Rendering:**
- Capacity-scaled circle radius for all REPD layers (interpolate expression)
- Solar Roof uses zoom-based radius — every asset visible at national zoom regardless of MW
- Satellite basemap toggle (ArcGIS World Imagery)

**Popup intelligence:**
- Click any REPD asset ≥ 50MW → 📰 NEWS + 🖼 IMAGES buttons
- Solar Roof threshold lowered to 0.5MW
- Buttons open targeted Google News + Images searches in new tab
- Zero API calls, zero ToS risk

**Network:**
- All fetches via `FetchQueue` (max 4 concurrent)
- 15000ms timeout with AbortController
- `cache: 'no-cache'` on all fetches
- URL-level caching prevents duplicate downloads
- All URLs require leading `/` prefix for GitHub Pages

---

## 2. REPD ETL Pipeline (`scripts/repd_updater.py`)

**Version:** v5.7

Python pipeline that transforms the UK Government REPD CSV into a clean GeoJSON master file for the map frontend.

**Dynamic URL discovery:**
Scrapes the official DESNZ REPD publication page at Gov.uk using BeautifulSoup to find the latest CSV href. Falls back to registry URL if scrape fails. No hardcoded stale URLs.

**Change detection:**
Compares discovered URL against `source_url` stored in `manifest_v4.json`. If identical, pipeline exits immediately — no wasted compute, no redundant commits.

**Schema validation:**
Validates all required columns on load. Fails fast with full column list if required columns missing. Warns on missing optional columns without crashing.

**Technology classification:**
Driven by `Technology Type` field with `Mounting Type for Solar` column used to split solar:
- `Mounting Type for Solar == 'roof'` → `solar_roof`
- All other solar → `solar`
- `'Ground & Roof'`, `'Floating'`, blank → `solar`

Full tech family groupings:
- `solar` / `solar_roof` — Solar Photovoltaics split by mounting
- `wind` — all wind (onshore and offshore unified)
- `bess` — battery / storage
- `biomass` — biomass, EfW incineration, anaerobic digestion, landfill gas, sewage sludge, co-firing, gasification, pyrolysis
- `hydro` — hydro and pumped storage
- `tidal` — tidal and wave
- `hydrogen` — hydrogen
- `flywheel` — flywheel

**Data hardening:**
- Coordinate sanity: zero/null eastings/northings skipped
- `isfinite()` check on all transformed coordinates
- UK bounding box enforcement: lon (-9.0 to 2.5), lat (49.0 to 61.0) — Atlantic outliers dropped
- Unit sanity: `solar_roof > 50MW` → divide by 1000 (kW mislabelled as MW). `biomass > 100MW` → same
- Case-safe status filter: strip + lowercase before `.isin()` — trailing spaces and case variants handled

**Status tiers included:**
- Tier 1: Operational, Under Construction, Awaiting Construction
- Tier 2: Consented, Planning Permission Granted, Planning Approved
- Tier 3: Application Submitted, Pre-Construction

**Debug output every run:**
- Mounting type values found
- Tech type sample
- Row count after status filter
- Final tech distribution counts
- Unmapped `other` features with raw tech values listed

**Output:** `dist/repd_master.json` — GeoJSON FeatureCollection
**Manifest:** `dist/manifest_v4.json` — includes `last_sync`, `source_url`, `status`

---

## 3. Automation (`.github/workflows/repd_sync.yml`)

**Name:** Ventus REPD Master Sync

**Triggers:**
- `schedule`: cron `0 0 1 * *` — 1st of every month at midnight
- `workflow_dispatch` — manual trigger from Actions tab

**Steps:**
1. Checkout repository
2. Setup Python 3.10 with pip cache
3. Install dependencies: `pandas pyyaml requests pyproj beautifulsoup4`
4. Execute `scripts/repd_updater.py` with `PYTHONPATH: .`
5. Commit `dist/repd_master.json` and `dist/manifest_v4.json` only — no repo bloat

**Idempotency:** Pipeline self-terminates if source URL unchanged since last sync.

**Jekyll auto-deploy:** Triggered automatically on every commit to main via standard GitHub Pages workflow.

---

## 4. Data Source

**REPD — Renewable Energy Planning Database**
Published by DESNZ (Department for Energy Security and Net Zero)
Quarterly release. Dynamic URL discovered at runtime.
Current data: Q4 2025

**Grid topology GeoJSON** — OpenStreetMap contributors
**Basemap** — CARTO Dark Matter + ArcGIS World Imagery (satellite)

---

## 5. Hosting

**GitHub Pages** — free, global CDN, auto-deploys on commit to main
**Repo:** Ventusltd/globalgrid2050
**Live:** globalgrid2050.com

---

## 6. Design Principles

- Knowledge freely given — no paywall, no login, no ads
- Open data only — REPD, OSM, public GeoJSON
- Defensive programming — distrust the CSV, validate the schema, enforce physical reality
- Test don't assume — every fix verified against real data before commit
- Persistence over perfection — ship working code, iterate fast
- The human is the architect — AIs execute, human signs off

---

*Built in the spirit of the Gita. One layer at a time. One dataset at a time.*


GlobalGrid2050 Map Architecture

1. The Map Frontend (repd_atlas_grid_model.md)

Built using Leaflet.js, Leaflet MarkerCluster, and Proj4js (for OSGB36 to WGS84 coordinate translation).

Reads project data from repd.csv and scales marker sizes based on MW capacity.

Uses interactive Layer Controls to overlay National Grid infrastructure (400kV, 275kV, 132kV) pulled from local GeoJSON files.

2. The Data Fetcher (scripts/fetch_grid_data.py)

A Python script that queries the OpenStreetMap Overpass API for UK power lines (power=line and power=cable).

It fetches 400kV, 275kV, and 132kV data sequentially.

Crucial: It includes 60-second time.sleep(60) pauses between requests to prevent the Overpass API from blocking our IP for rate-limiting.

3. The Automation (.github/workflows/update-grid-data.yml)

A GitHub Action set to workflow_dispatch (Manual trigger).

Spins up a virtual Ubuntu server, installs Python/Requests, runs the fetcher script, and commits any updated *.geojson files directly back to the main branch.

Committing these files automatically triggers the Jekyll build to update the live GitHub Pages site.


