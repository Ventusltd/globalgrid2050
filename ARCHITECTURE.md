# GlobalGrid2050 | Ventus Core — Architecture

*Last updated: 2026-04-05 | REPD v5.10 | Ventus OS Modular Pipeline*

> **⚠️ DIRECTIVE FOR FUTURE HUMANS AND AI AGENTS (Gemini, ChatGPT, Claude):**
> If you are reading this, you are tasked with maintaining, debugging, or expanding GlobalGrid2050.
>
> 1. **Do not regress.** This system has evolved from monolithic HTML files into a modular "Operating System" (`ventus-core.js` and `ventus.css`). Do not put logic back into the HTML data cartridges.
> 2. **Respect the geometry.** We snap lines using physical geodesic meters (Haversine), not distorted coordinate degrees.
> 3. **Defend the browser.** Scale horizontally by creating new regional HTML pages (e.g., `spain.html`) that pull from the root OS.
> 4. **Reconstruct if lost.** Systems 1 and 2 detail the Python/YAML logic for the data pipeline. Systems 3 and 4 detail the OS and CSS/DOM geometry. You have everything you need to rebuild this from scratch.
>
> Load this document into your context window before suggesting structural code changes. Pick up exactly where we left off. Ensure resilience.

---

## I. Origin and Philosophy

**GlobalGrid2050** was originated by [Ventus Ltd](https://www.ventusltd.com), the UK agent for Studer Cables AG Switzerland (formerly LEONI AG).

This platform is not a software experiment; it is the strict codification of two decades of hard-won physical engineering experience into a digital twin. The architecture is grounded in:

- 20 years of cable engineering, manufacturing, and technical sales.
- 14 years of utility-scale solar and High Voltage (HV) grid connection expertise.
- 3+ GWp of delivered large-scale solar projects, commercial rooftop PV systems, and landmark infrastructure (e.g., Braintree EV Forecourt).

### The Geopolitical Catalyst

This project was accelerated in response to successive global energy shocks: the supply chain fractures of COVID-19, the European energy crisis triggered by the Ukraine-Russia conflict, and subsequent market volatilities. These events highlighted the existential need for a resilient, transparent, and rapidly expanding electrified grid to achieve Net Zero.

### Human-Machine Codification

This repository is a live demonstration of human-machine collaboration. It represents the deliberate transfer of deep physical domain expertise into a scalable, automated architecture built alongside LLMs.

| Role | Responsibility |
|------|---------------|
| **Ventus (Architect)** | Provides physical engineering truth, defines strict real-world constraints (e.g., geodesic snapping), and orchestrates evolution to ensure the digital model mirrors physical reality. |
| **ChatGPT (Strategist)** | Identifies optimal CI/CD and deployment environments (GitHub Pages/Actions) to ensure a serverless, zero-decay foundation. |
| **Gemini (Backend Engineer)** | Authors the complex Python ETL pipelines, Overpass API query scripts, and data-fetching automation to keep the intelligence live. |
| **Claude (Frontend Engineer)** | Executes structural DOM improvements, refines the SCADA UI/UX, and optimizes the JavaScript WebGL rendering engine. |

---

## II. Architectural Evolution: The Path to V5

To maintain the current system, you must understand the bottlenecks we abandoned.

| Version | Status | Description |
|---------|--------|-------------|
| **V3 (The Monolith)** | Deprecated | Original MVP. A 1,000+ line monolithic `index.html` containing CSS, map logic, state, and UK data. Proved the concept but failed to scale. Topological snapping used a flawed decimal degree tolerance (creating 5km+ distortion zones). |
| **V4 (The Interim)** | **Do not use** | Transitional sandbox. Exists purely as a historical fallback. |
| **V5 (Ventus Core OS)** | ✅ Current | Engine extracted to root. Regional maps are lightweight Data Cartridges (< 150 lines). Introduced true geodesic snapping, `requestAnimationFrame` throttling, and asynchronous hydration. |

### Engineering Challenges Conquered — Do Not Revert

#### 1. The Spatial Distortion Problem
Early versions snapped power lines using a fixed decimal degree tolerance. Because longitude converges at the poles, this created massively distorted snapping zones (up to 5.5km wide), causing false topological connections.

**Solution:** Rewrote the engine to use true geodesic mathematics, enforcing a strict `100 meter` tolerance regardless of latitude.

#### 2. Browser Thread Blocking
Loading large GeoJSON arrays directly into the DOM froze the browser's main thread, rendering the UI unresponsive.

**Solution:** Implemented a JS `FetchQueue` (concurrency limit: 4). Data layers hydrate asynchronously; UI transitions gracefully from `[WAIT]` to `[OK]`.

#### 3. Mobile Memory Panics
iOS Safari crashed when loading Pan-European and UK infrastructure simultaneously due to strict mobile RAM limits.

**Solution:** Horizontal Sharding. The frontend is split into the OS Engine and regional Data Cartridges.

#### 4. Pointer Event Thrashing
Querying MapLibre features on every pixel of mouse movement destroyed framerates.

**Solution:** Wrapped `mousemove` in `requestAnimationFrame`, aligning hover calculations with the GPU's paint cycles.

---

## III. Core Systems Architecture

### System 1 — Infrastructure Overpass Pipeline

*The Ghost in the Machine*

Python scripts (`scripts/fetch_*.py`) automatically query the OpenStreetMap (OSM) Overpass API, format data into GeoJSON, and commit it to the repository.

| Feature | Detail |
|---------|--------|
| **Area Filtering** | Queries restricted via `area(3600062149)->.uk;` |
| **Tag Filtering** | Nodes, ways, and relations queried via specific tags (e.g., `["power"="substation"]["voltage"~"400000|275000|..."]`) |
| **Centroid Generation** | Appends `out center;` to force the API to calculate exact centre points for large polygons, saving client-side compute |
| **Rate Limit Defence** | 3-attempt retry loop; executes `time.sleep(60)` on `429` status codes |

**Automation** — `.github/workflows/update-grid-data.yml`

| Setting | Value |
|---------|-------|
| **Trigger** | `workflow_dispatch` (manual only) |
| **Execution Sequence** | Grid → 220kV → 66kV → Substations → Data Centres → Airports → Railways → Industry → Power Plants → HS2 |
| **Commit Logic** | Stages `*.geojson`, commits as `gridbot`, pushes to `main`, triggering Jekyll rebuild |

**Static GeoJSON files (repo root)**

```
grid_400kv.geojson
grid_275kv.geojson
grid_220kv.geojson
grid_132kv.geojson
grid_66kv.geojson
grid_substations.geojson
```

---

### System 2 — REPD Asset Intelligence Pipeline

The ETL pipeline (`scripts/repd_updater.py`) transforms the UK Government REPD CSV into a clean master GeoJSON (`dist/repd_master.json`).

| Feature | Detail |
|---------|--------|
| **Dynamic Discovery** | Scrapes DESNZ Gov.uk page via BeautifulSoup. No hardcoded URLs. |
| **Idempotency** | Compares discovered URL against `source_url` in manifest. Exits immediately if unchanged. No wasted compute. |
| **Force re-sync** | Blank `dist/manifest_v4.json` `source_url` to `""` then trigger *Ventus REPD Master Sync* manually from the Actions tab. |
| **Schema Validation** | Fails fast on missing required columns. |
| **Technology Classification** | Driven by `Technology Type` + `Mounting Type` for Solar. Uses substring matching (`in tl`) to avoid CSV encoding artifacts. `Hydrogen` is strictly parsed before `hydro` to prevent substring collision. |
| **Data Hardening** | Filters zero/null coordinates, enforces UK bounding box. Unit sanity checks (e.g., converting mislabelled kW to MW). Case-safe status filter strips and lowercases string inputs. |

**Automation** — `.github/workflows/repd_sync.yml`

| Setting | Value |
|---------|-------|
| **Triggers** | `schedule: cron 0 0 1 * *` (1st of every month) and `workflow_dispatch` |
| **Dependencies** | `pandas` `pyyaml` `requests` `pyproj` `beautifulsoup4` |

---

### System 3 — Ventus Core OS (Frontend Engine)

The core engine (`/ventus-core.js` & `/ventus.css`) built on **MapLibre GL JS v3.6.2** for hardware-accelerated WebGL rendering.

| Feature | Detail |
|---------|--------|
| **Geodesic Snapping** | Lines snapped to substations via Haversine formula with `0.1 km` (100 metre) tolerance. **Never revert to decimal degree tolerances.** |
| **Single shared source** | All REPD layers filter natively in MapLibre. No duplicate data loads. |
| **Concurrency** | `FetchQueue` (max 4 concurrent, 15,000ms timeout) to prevent browser network lockup. |
| **Performance** | `requestAnimationFrame` throttles `mousemove` events. |

#### Mathematical Integrity

All spatial calculations use real-world physics. These must never be replaced with coordinate shortcuts.

**Distance & Snapping — Haversine Formula**

Calculates the great-circle distance between two points on a sphere:

```
a = sin²(Δlat/2) + cos(lat₁) · cos(lat₂) · sin²(Δlon/2)
d = 2R · arcsin(√a)
```

Where `R = 6371 km` (Earth's mean radius). Enforced tolerance: **100 metres**.

**Area Measurement — Shoelace Formula**

Applied to projected planar coordinates for dynamic polygon area calculations:

```
A = ½ |Σ(xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ)|
```

Coordinates are first projected from geodesic (lat/lon) to planar (metres) before the formula is applied.

#### The Data Cartridges

Lightweight HTML files containing zero styling or engine logic. They import the OS, define a specific `GRID_CONFIG` array, and boot the map via `window.initVentusMap()`.

---

### System 4 — SCADA UI/UX Design System

> If `ventus.css` is lost, the UI must be rebuilt according to these strict aesthetic and DOM principles. The interface mimics a high-performance, dark-mode engineering terminal (SCADA).

#### 4a. Aesthetic & Typography

| Element | Specification |
|---------|--------------|
| **Base theme** | Dark mode strict. Backgrounds: `#000000`, `#050505`, `#0a0a0a`, `#111111`. Borders: `#222`, `#333`, `#444`. |
| **Accent — Primary** | Neon Cyan `#00ffff` (interactive) |
| **Accent — Highlight** | Amber `#ffae00` (MW capacity) |
| **Status — Operational** | `#00ff88` |
| **Status — Construction** | `#ffcc00` |
| **Status — Consented** | `#ff8800` |
| **Status — Applied** | `#8888ff` |
| **Data / readouts font** | `Courier New, monospace` |
| **Corporate branding font** | `-apple-system, sans-serif` (VENTUS header only) |
| **Solar PV rendering** | Capacity-scaled circles + heat glow above 4MW (yellow → red at 200MW+) |
| **Solar Roof rendering** | Zoom-scaled + amber glow above 1MW |

#### 4b. Viewport & Layout Geometry (Flexbox)

```css
/* Root container */
display: flex;
flex-direction: column;
height: 100dvh;
width: 100vw;
padding: 4px;
gap: 4px;
box-sizing: border-box;
```

| Zone | Behaviour | Content |
|------|-----------|---------|
| **HUD Header (top)** | `flex-shrink: 0` | Left: Live System Time/Date · Centre: VENTUS branding · Right: 2050 TARGET countdown |
| **Map Container (middle)** | `flex-grow: 1; min-height: 0; position: relative` | MapLibre canvas and absolute overlays |
| **SCADA Wrapper (bottom)** | `flex-shrink: 0; max-height: 38vh; overflow-y: auto` | CSS Grid (`grid-template-columns: 1fr 1fr`) for layer toggles |

#### 4c. Interactive Components & Overlays

| Component | Specification |
|-----------|--------------|
| **Layer Toggles** | Labels dynamically update to append `[WAIT]`, `[OK]`, or `[Count \| MW]` |
| **Map Controls** | Stacked column (`bottom: 30px; left: 10px; z-index: 20`). Hover → neon cyan border. Active → faint cyan background tint. |
| **Popups** | Dark background (`#000`), monospace font. Format: Title (Cyan, bold) → Tech/Mounting (Grey) → Capacity (Amber) → Status → Operator |
| **Search Bar** | Type 2+ chars for live dropdown, top 12 results by MW. Click to fly with 1.8s animation. |
| **Radius Tool** | Absolute-positioned near controls. Input box for km radius. Renders dynamic GeoJSON polygon circle via Haversine. Shows total assets, MW, tech breakdown, and top 5 assets. |
| **Measure Display** | `bottom: 30px; left: 50%; transform: translateX(-50%)`. Updates line length, perimeter, and area dynamically using Shoelace formula and Haversine math. |

#### 4d. News/Images Popup Thresholds by Technology

Dual CSS-styled buttons (`NEWS` / `IMAGES`) targeting Google search queries, rendered only above these capacity thresholds:

| Technology | Threshold |
|-----------|-----------|
| `solar` | 50 MW |
| `solar_roof` | 0.5 MW |
| `wind` | 50 MW |
| `bess` | 50 MW |
| `biomass` | 50 MW |
| `tidal` | 10 MW |
| `hydrogen` | 10 MW |
| `hydro` | 10 MW |
| `flywheel` | 1 MW |
| `act` | 10 MW |
| `geothermal` | 1 MW |
| `caes` | 1 MW |

---

## IV. Deploying Ventus OS Globally (Developer Guide)

To scale horizontally, the OS handles all rendering; you only supply the regional data.

### Step 1: Gather Local Data

Use the System 1 scripts to query OpenStreetMap for your country's power lines and substations (change the `area` parameter in the Overpass query). Convert your local government's energy asset data into GeoJSON.

### Step 2: Create a Data Cartridge

1. Create a new file in your repository (e.g., `spain.html`).
2. Copy the HTML skeleton from `repd_grid_atlasv5/index.html`.
3. Ensure `<script>` and `<link>` tags point to the root OS files (`../ventus.css` and `../ventus-core.js`).

### Step 3: Define the `GRID_CONFIG`

```javascript
const localConfig = [
  {
    group: "Spanish Topology",
    layers: [
      {
        id: "400es",
        label: "400kV Red Eléctrica",
        color: "#0054ff",
        type: "line",
        width: 2.5,
        url: "/data/spain_400kv.geojson",
        snap: true,
        preload: true
      }
    ]
  }
];
```

### Step 4: Boot the OS

```javascript
window.initVentusMap({
  config: localConfig,
  center: [-3.7038, 40.4168], // Madrid
  zoom: 5.5
});
```

---

## V. Validation & Principles

### Console Verification Test

To verify the engine is reading the REPD payload without UI errors, run in the browser console. All 12 tech types must return non-zero counts.

```javascript
fetch('/dist/repd_master.json')
  .then(r => r.json())
  .then(d => {
    const counts = {};
    d.features.forEach(f => {
      const t = f.properties.tech;
      counts[t] = (counts[t] || 0) + 1;
    });
    console.table(counts);
  });
```

### Immutable Design Principles

- **Open data only** — REPD, OSM, public GeoJSON.
- **Knowledge freely given** — no paywalls, no logins, no ads.
- **Test, don't assume** — every fix verified against real data.
- **Defensive programming** — distrust the CSV, validate the schema.
- **Physical accuracy over computational shortcuts** — snap in metres, measure in Haversine.
- **The human is the architect** — AIs execute, human signs off.
- **3 × AI + Human = AGI** — Claude builds, ChatGPT audits, Gemini reviews architecture.

### Hosting & Licence

| Item | Detail |
|------|--------|
| **Hosting** | GitHub Pages (`globalgrid2050.com`). Auto-deploys on commit. |
| **Licence** | [CERN OHL-S v2](https://ohwr.org/cern_ohl_s_v2.txt) — derivatives must remain open. |

---

Actions guided by truth outlive the actor. 
