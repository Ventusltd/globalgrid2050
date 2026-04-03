Here's the fully updated ARCHITECTURE.md:

---

# GlobalGrid2050 | Ventus Core — Architecture

*Last updated: 2026-04-03 | REPD v5.10 | Q4 2025 data live*

---

## System 1 — Grid Topology Pipeline

### 1a. Grid Data Fetcher (`scripts/fetch_grid_data.py`)

A Python script that queries the **OpenStreetMap Overpass API** for UK power lines (`power=line` and `power=cable`).

Fetches 400kV, 275kV, and 132kV transmission lines sequentially.

Includes 60-second `time.sleep(60)` pauses between requests to prevent Overpass API rate-limiting.

### 1b. Grid Topology Automation (`.github/workflows/update-grid-data.yml`)

GitHub Action set to `workflow_dispatch` — manual trigger only.

Spins up Ubuntu, installs Python/Requests, runs the fetcher script, commits updated `*.geojson` files to main. Jekyll auto-deploys on commit.

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

**Version:** v5.10

Transforms the UK Government REPD CSV into a clean master GeoJSON for the map frontend.

**Dynamic URL discovery** — scrapes DESNZ Gov.uk page via BeautifulSoup to find the latest REPD CSV. No hardcoded URLs.

**Change detection** — compares discovered URL against `source_url` in manifest. Exits immediately if unchanged. No wasted compute.

**To force re-sync:** blank `dist/manifest_v4.json` `source_url` to `""` then trigger **Ventus REPD Master Sync** manually from Actions tab.

**Schema validation** — fails fast on missing required columns. Full column list printed on error.

**Technology classification** — driven by `Technology Type` + `Mounting Type for Solar`. All matching uses `in tl` substring method — immune to CSV encoding artifacts. Hydrogen must be checked **before** hydro to avoid substring collision.

| Tech ID | REPD Source Terms |
|---|---|
| `solar` | Solar Photovoltaics (ground/floating) |
| `solar_roof` | Solar Photovoltaics (Mounting Type = Roof) |
| `wind` | Wind Onshore, Wind Offshore |
| `bess` | Battery, Battery Storage |
| `biomass` | Biomass, EfW Incineration, Anaerobic Digestion, Landfill Gas, Sewage Sludge Digestion |
| `hydrogen` | Hydrogen, Fuel Cell (Hydrogen) — **classify before hydro** |
| `hydro` | Large Hydro, Small Hydro, Pumped Storage Hydroelectricity |
| `tidal` | Tidal Stream, Tidal Lagoon, Shoreline Wave |
| `flywheel` | Flywheels |
| `act` | Advanced Conversion Technologies |
| `geothermal` | Geothermal, Hot Dry Rocks (HDR) |
| `caes` | Compressed Air Energy Storage, Liquid Air Energy Storage |

**Data hardening:**
- Zero/null coordinate filter
- `isfinite()` on all transformed coordinates
- UK bounding box: lon (-9.0 to 2.5), lat (49.0 to 61.0)
- Unit sanity: `solar_roof > 50MW` → ÷1000 (kW mislabelled as MW), `biomass > 100MW` → ÷1000
- Case-safe status filter: strip + lowercase

**Status tiers:**
- Tier 1: Operational, Under Construction, Awaiting Construction
- Tier 2: Consented, Planning Permission Granted, Planning Approved
- Tier 3: Application Submitted, Pre-Construction

**Expected asset distribution after clean sync:**
```
solar: ~2773, solar_roof: ~3084, wind: ~1530, bess: ~2020,
biomass: ~818, hydro: ~150, hydrogen: ~58, tidal: ~18,
act: ~38, geothermal: ~7, caes: ~4, flywheel: ~1
```

**Output:** `dist/repd_master.json` + `dist/manifest_v4.json` (10,501 assets total)

### 2b. REPD Automation (`.github/workflows/repd_sync.yml`)

**Triggers:**
- `schedule`: cron `0 0 1 * *` — 1st of every month
- `workflow_dispatch` — manual trigger

**Dependencies:** `pandas pyyaml requests pyproj beautifulsoup4`

Idempotent — self-terminates if source URL unchanged since last sync.

---

## System 3 — Map Frontend (`repd_grid_atlasv3/index.html`)

**Live URL:** `globalgrid2050.com/repd_grid_atlasv3/`

**Built with:** MapLibre GL JS v3.6.2 — GPU-accelerated WebGL rendering.

Both System 1 and System 2 data rendered in the same map canvas.

**Single shared `src-repd` source** — all REPD layers filter natively in MapLibre. No duplicate data loads.

**Layer groups:**
- Topology (System 1): transmission lines + substations
- Assets: Nuclear, Gas, Industry, Data Centres, Airports, Railways
- REPD (System 2): Solar PV, Solar Roof, Wind, BESS, Biomass, Tidal, Hydrogen, Hydro, Flywheel, ACT, Geothermal, CAES

**Rendering:**
- Solar PV: capacity-scaled circles + heat glow above 4MW (yellow → red at 200MW+)
- Solar Roof: zoom-scaled + amber glow above 1MW
- All other REPD: capacity-scaled circles

**UI Features:**

1. **Search bar** — top-right, below OSM attribution. Type 2+ chars, live dropdown, top 12 results by MW. Click to fly with 1.8s animation, popup auto-opens on landing.
2. **MW counter** — layer labels show `[count | MW]` after load e.g. `Solar PV [2773 | 47.8GW]`
3. **Status colour toggle** (`◑ Status Colours`) — switches all REPD dots to: green=operational, yellow=under construction, orange=consented, purple=applied
4. **Radius search** (`◎ Radius Search`) — pick 5/10/25/50km, click map, shows total assets + MW + tech breakdown + top 5 assets
5. **Export CSV** (`⬇ Export CSV`) — downloads all visible REPD layers as spreadsheet with coordinates
6. **News + Images buttons** — on popup for assets above threshold, targeted Google News + Images search, opens in new tab
7. **Status legend** — coloured dots above layer key
8. **Satellite basemap toggle**

**News/Images popup thresholds by tech:**

| Tech | Threshold |
|---|---|
| solar | 50MW |
| solar_roof | 0.5MW |
| wind | 50MW |
| bess | 50MW |
| biomass | 50MW |
| tidal | 10MW |
| hydrogen | 10MW |
| hydro | 10MW |
| flywheel | 1MW |
| act | 10MW |
| geothermal | 1MW |
| caes | 1MW |

**Network:** FetchQueue (4 concurrent), 15000ms timeout, `cache: 'no-cache'`

**Console verification test:**
```js
fetch('/dist/repd_master.json').then(r=>r.json()).then(d=>{
    const counts={};
    d.features.forEach(f=>{const t=f.properties.tech;counts[t]=(counts[t]||0)+1;});
    console.log(counts);
});
```
Expected: all 12 tech types present with non-zero counts.

---

## Hosting

**GitHub Pages** — globalgrid2050.com
**Repo:** Ventusltd/globalgrid2050
Auto-deploys on every commit to main.

---

## Licence

CERN OHL-S v2 — derivatives must stay open.

---

## Design Principles

- Open data only — REPD, OSM, public GeoJSON
- Knowledge freely given — no paywall, no login, no ads
- Test don't assume — every fix verified against real data
- Defensive programming — distrust the CSV, validate the schema
- Substring matching throughout — exact string matching fails on CSV encoding artifacts
- Leading `/` on all URLs — required for GitHub Pages
- `[OK]` means HTTP success not data presence — always console-verify tech distribution
- The human is the architect — AIs execute, human signs off
- 3 x AI + Human = AGI — Claude builds, ChatGPT audits, Gemini reviews architecture

---

*Built in the spirit of the Gita. One layer at a time.*
