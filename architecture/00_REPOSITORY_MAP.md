# GlobalGrid2050 Repository Map

**Generated:** 2025-01-21  
**Purpose:** Complete inventory of what exists in this repository

---

## Summary Statistics

- **Live Pages:** 23 public-facing tools/atlases
- **Data Files:** 49 GeoJSON + 5 CSV
- **Python Scripts:** 30 data ingestion scripts
- **GitHub Workflows:** 18 automated update workflows
- **Atlas Versions:** 4 (V1, V3, V5, V6)
- **Core Engine:** ventus-core.js (1,170+ lines)
- **Styling:** ventus.css (139 lines)

---

## Live Site Structure (www.globalgrid2050.com)

### Interactive Atlases (MapLibre-based)
- `repd_atlas_grid_model/` - UK Energy Atlas V1 (Grid Overlay)
- `repd_grid_atlasv3/` - UK Energy Atlas V3 (Grid Overlay)
- `repd_grid_atlasv5/` - UK Energy Atlas V5 (Grid Overlay) - **CURRENT STABLE**
- `repd_grid_atlasv6/` - UK Energy Atlas V6 (Grid Overlay) - **EXPERIMENTAL SANDBOX**
- `atlas/` - UK Energy Atlas (REPD base)
- `uk_grid-batteries/` - BESS Atlas
- `repd-uk-operational-solar/` - Operational utility scale solar atlas
- `uk_offshore_wind_atlas/` - Offshore wind atlas
- `uk_onshore_wind_atlas/` - Onshore wind atlas
- `uk_operating_large_solar_farms/` - Large solar farms (>4MWp)
- `repd_solar_pipeline/` - Solar pipeline (1-50MW)

### Tools & Calculators
- `33kv_uk_dap_price_estimator/` - 33 kV UK DAP Price Estimator
- `lv_ac_dc_price_estimator/` - LV AC and DC Distribution Cables Price Estimator
- `cable_geometry/` - Cable Geometry Visualiser V2
- `solar-bess-topology/` - Cable Geometry Visualiser V1
- `cable_selection/` - Cable selection tool

### Knowledge Base Pages
- `ac_cables_knowledge/` - AC Cables Knowledge
- `dc_cables_knowledge/` - DC Cables Knowledge
- `conductor_resistances/` - Conductor Resistances
- `definitions/` - Definitions
- `mv_and_hv_components/` - MV and HV Components
- `solar_components/` - Solar Components
- `power_systems_studies/` - Power Systems Studies
- `sld_single_diagrams_diagrams_and_grids/` - Single Line Diagrams And Grids
- `employers_requirements/` - Employer Requirements Notes
- `employers_requirements_BESS/` - Employer Requirements BESS Notes
- `nsip_solar_farms/` - NSIP Solar Farms

### Data & Trends
- `copper_and_aluminium_prices_historic_trends/` - Copper and Aluminium Historic Prices & Trends
- `solar_deployment_statistics/` - Solar Deployment Statistics
- `uk_macro_energy_trends/` - UK Macro Energy Consumption Trends (ONS)

### Marketing & Showcase
- `marketing/earth.html` - Earth (showcase page)
- `marketing/showcase.html` - VENTUS Global Data Backbone (3D WebGL Engine)
- `blog/` - Blog
- `podcast_transcripts/` - Podcast Transcripts

---

## Core Technical Stack

### Frontend Engine
- **ventus-core.js** (1,170+ lines) - Stable atlas engine used by V3/V5/V6
- **ventus.css** (139 lines) - Global presentation layer
- **MapLibre GL JS v3.6.2** - Map rendering (via CDN)
- **PapaParse** - CSV parsing (embedded in some atlases)

### Data Layer (Root Directory)
**GeoJSON Files (49 total):**
- Grid infrastructure: `grid_400kv.geojson`, `grid_275kv.geojson`, `grid_220kv.geojson`, `grid_132kv.geojson`, `grid_66kv.geojson`
- 33kV regional: 10 files (Scotland North/South, England regions, Wales North/South, Yorkshire)
- 11kV distribution: `grid_11kv_ukpn.geojson`
- Substations: `grid_substations.geojson`
- Generation: `power_plants.geojson`
- Transport: `railways.geojson`, `hs2.geojson`, `london_underground.geojson`, `elizabeth_line.geojson`, `eurostar.geojson`, `uk_metros_trams.geojson`, `motorway_services.geojson`
- Marine: `subsea_data_cables.geojson`, `global_ports.geojson`, `deep_subsea_illustrative.geojson`
- Energy: `global_hydrocarbons.geojson`
- Supermarkets: 14 chains (Tesco, Sainsbury's, Asda, Morrisons, Waitrose, M&S, Lidl, Aldi, Co-op, Iceland, Spar, Costco, Booths, Farmfoods)
- Other: `airports.geojson`, `datacentres.geojson`, `industrial_offtakers.geojson`, `ev_chargers.geojson`, `stadiums.geojson`

**CSV Files (5 total):**
- `repd.csv` - Main renewable energy project database
- `repd-grid-batteries.csv` - Battery storage projects
- `repd-solar-operational.csv` - Operational solar projects
- `repd-solar-operational-over-4mw.csv` - Large operational solar
- `ons-energy-fuels-clean.csv` - Energy consumption trends

### Data Pipeline
**Python Scripts (30 files in `scripts/`):**
- **Grid data:** `fetch_grid_data.py`, `fetch_400kv_data.py`, `fetch_220kv_data.py`, `fetch_33kv_data.py`, `fetch_66kv_data.py`, `fetch_11kv_ukpn.py`, `fetch_substations.py`
- **Generation:** `fetch_power_plants.py`, `repd_updater.py`
- **Transport:** `fetch_railways.py`, `fetch_hs2.py`, `fetch_london_underground.py`, `fetch_metros_trams.py`, `fetch_elizabeth_line.py`, `fetch_eurostar.py`, `fetch_motorway_services.py`
- **Marine:** `fetch_subsea_data_cables.py`, `generate_deep_subsea.py`, `fetch_global_ports.py`, `fetch_tanker_density.py`
- **Energy:** `fetch_global_hydrocarbons.py`
- **Infrastructure:** `fetch_airports.py`, `fetch_datacentres.py`, `fetch_industrial_offtakers.py`, `fetch_ev_chargers.py`, `fetch_stadiums.py`
- **Retail:** `fetch_supermarkets.py`
- **Pricing:** `update_prices.py`, `update_prices_lv.py`, `update_metal_trends.py`
- **Generation:** `generate_unification_estimates.py`

**Dependencies (from `scripts/requirements.txt`):**
- pandas
- requests
- pyproj
- pyyaml

### Automation (GitHub Actions)
**18 Workflows in `.github/workflows/`:**
- `repd_sync.yml` - REPD data sync
- `update-grid-data.yml` - Grid infrastructure updates
- `update_11kv_ukpn.yml` - 11kV UKPN updates
- `update_ev_chargers.yml` - EV charger locations
- `update_metros_trams.yml` - Metro/tram updates
- `update_tube_stations.yml` - London Underground updates
- `update_prices.yml` - Price data updates
- `update_supermarkets.yml` - Supermarket location updates
- `fetch_elizabeth_line.yml` - Elizabeth Line updates
- `fetch_eurostar.yml` - Eurostar route updates
- `fetch_global_ports.yml` - Global port updates
- `fetch_motorway_services.yml` - Motorway service updates
- `fetch_stadiums.yml` - Stadium locations
- `fetch_subsea_data_cables.yml` - Subsea cable updates
- `generate_deep_subsea.yml` - Deep subsea generation
- `generate_global_hydrocarbons.yml` - Hydrocarbon data generation
- `generate_repo_structure.yml` - Repository structure documentation
- `jekyll-gh-pages.yml` - GitHub Pages deployment

### Configuration
**Config Registry (`config/registry.yaml`):**
- Version: 4.3
- Layer definitions with metadata
- Refresh schedules (monthly, manual)
- Script associations
- Data source URLs
- Tag system for categorization

---

## Architecture Documentation
**Location:** `architecture/` folder

- `ARCHITECTURE.md` - Original Ventus OS architecture
- `ARCHITECTURE_V2.md` - V2 blueprint (PARKED - see Section 17)
- `DEV_NOTES.md` - Development notes
- `VENTUS_CORE_V2_README.md` - Phase 1 foundation documentation

---

## Parked/Experimental Code

### ventus-core-v2/
**Status:** PARKED (see ARCHITECTURE_V2.md Section 17)
- 51 JavaScript files (23 implemented, 29 placeholders)
- 78 passing unit tests
- Phase 1 foundation complete but not integrated
- Kept as reference implementation

**Why parked:** After 7-hour session, decision made to iterate incrementally on V5→V6 rather than wholesale rebuild.

---

## Root Documentation Files

- `README.md` - Main repository README
- `LICENSE.txt` - License
- `CNAME` - Custom domain (globalgrid2050.com)
- `REPO_STRUCTURE.txt` - Generated repository structure
- Various `.md` files - Individual atlas/tool documentation

---

## Marketing Assets

- `50MW_BESS_to_PCS.jpg` - BESS diagram
- `Braintree-cables1.png` - Cable diagram
- `Braintree.jpg` - Braintree photo
- `hv_interface.jpg` - HV interface diagram

---

## How The System Works

1. **Data Ingestion:** Python scripts fetch data from external sources (OSM, government APIs, etc.)
2. **Data Storage:** Scripts output to root directory as GeoJSON or CSV
3. **Automation:** GitHub Actions run scripts on schedule or manually
4. **Configuration:** `config/registry.yaml` defines all layers, sources, refresh schedules
5. **Frontend:** Atlas HTML pages load `ventus-core.js` and `ventus.css`
6. **Rendering:** MapLibre GL renders GeoJSON on interactive maps
7. **Deployment:** GitHub Pages serves everything as static site

**Key principle:** The core engine (ventus-core.js) is stable. New features are added via data scripts and config, not by rewriting the core.

---

## Next Steps

This map should be used as index for creating detailed documentation:
- User manual for each public-facing page
- Data pipeline documentation
- Core engine specification
- Deployment guide
- Contribution guide
