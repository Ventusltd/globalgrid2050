# GlobalGrid2050 | Ventus Core — Architecture

*Last updated: 2026-04-03 | REPD v5.7 | Q4 2025 data live*

---

## System 1 — Grid Topology Pipeline

### 1a. Grid Data Fetcher (`scripts/fetch_grid_data.py`)

A Python script that queries the **OpenStreetMap Overpass API** for UK power 
lines (`power=line` and `power=cable`).

Fetches 400kV, 275kV, and 132kV transmission lines sequentially.

Includes 60-second `time.sleep(60)` pauses between requests to prevent 
Overpass API rate-limiting.

### 1b. Grid Topology Automation (`.github/workflows/update-grid-data.yml`)

GitHub Action set to `workflow_dispatch` — manual trigger only.

Spins up Ubuntu, installs Python/Requests, runs the fetcher script, commits 
updated `*.geojson` files to main. Jekyll auto-deploys on commit.

### 1c. Grid GeoJSON files (repo root)

Static GeoJSON files for:
- `grid_400kv.geojson`
- `grid_275kv.geojson`
- `grid_220kv.geojson`
- `grid_132kv.geojson`
- `grid_66kv.geojson`
- `grid_substations.geojson`

---

## System 2 — REPD Asset Intelligence Pipeline

### 2a. REPD ETL Pipeline (`scripts/repd_updater.py`)

**Version:** v5.7

Transforms the UK Government REPD CSV into a clean master GeoJSON for the 
map frontend.

**Dynamic URL discovery** — scrapes DESNZ Gov.uk page via BeautifulSoup 
to find the latest REPD CSV. No hardcoded URLs.

**Change detection** — compares discovered URL against `source_url` in 
manifest. Exits immediately if unchanged. No wasted compute.

**Schema validation** — fails fast on missing required columns. Full column 
list printed on error.

**Technology classification** — driven by `Technology Type` + 
`Mounting Type for Solar`:
- `solar_roof` — Mounting Type == 'roof' only
- `solar` — ground, floating, ground & roof, blank
- `wind` — all wind unified
- `bess` — battery / storage
- `biomass` — biomass, EfW, AD, landfill gas, sewage sludge, co-firing, 
  gasification, pyrolysis
- `hydro` — hydro and pumped storage
- `tidal` — tidal and wave
- `hydrogen` — hydrogen
- `flywheel` — flywheel

**Data hardening:**
- Zero/null coordinate filter
- `isfinite()` on all transformed coordinates
- UK bounding box: lon (-9.0 to 2.5), lat (49.0 to 61.0)
- Unit sanity: solar_roof >50MW → ÷1000, biomass >100MW → ÷1000
- Case-safe status filter: strip + lowercase

**Status tiers:**
- Tier 1: Operational, Under Construction, Awaiting Construction
- Tier 2: Consented, Planning Permission Granted, Planning Approved
- Tier 3: Application Submitted, Pre-Construction

**Output:** `dist/repd_master.json` + `dist/manifest_v4.json`

### 2b. REPD Automation (`.github/workflows/repd_sync.yml`)

**Triggers:**
- `schedule`: cron `0 0 1 * *` — 1st of every month
- `workflow_dispatch` — manual trigger

**Dependencies:** `pandas pyyaml requests pyproj beautifulsoup4`

Idempotent — self-terminates if source URL unchanged since last sync.

---

## System 3 — Map Frontend (`repd_grid_atlasv4/index.html`)

**Built with:** MapLibre GL JS v3.6.2 — GPU-accelerated WebGL rendering.

Both System 1 and System 2 data rendered in the same map canvas.

**Single shared `src-repd` source** — all REPD layers filter natively in 
MapLibre. No duplicate data loads.

**Layer groups:**
- Topology (System 1): transmission lines + substations
- Assets: Nuclear, Gas, Industry, Data Centres, Airports, Railways
- REPD (System 2): Solar PV, Solar Roof, Wind, BESS, Biomass, Tidal, 
  Hydrogen, Flywheel, Hydro

**Popup intelligence:**
- REPD assets ≥50MW → 📰 NEWS + 🖼 IMAGES buttons
- Solar Roof threshold: 0.5MW
- Targeted Google News + Images search, opens in new tab

**Network:** FetchQueue (4 concurrent), 15000ms timeout, `cache: 'no-cache'`

---

## Hosting

**GitHub Pages** — globalgrid2050.com
**Repo:** Ventusltd/globalgrid2050
Auto-deploys on every commit to main.

---

## Design Principles

- Open data only — REPD, OSM, public GeoJSON
- Knowledge freely given — no paywall, no login
- Test don't assume — every fix verified against real data
- Defensive programming — distrust the CSV, validate the schema
- The human is the architect — AIs execute, human signs off

---

*Built in the spirit of the Gita. One layer at a time.*
