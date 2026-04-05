# GlobalGrid2050 | Ventus Core — Architecture

*Last updated: 2026-04-05 | REPD v5.10 | Ventus OS Modular Pipeline*

> **⚠️ DIRECTIVE FOR FUTURE HUMANS AND AI AGENTS (Gemini, ChatGPT, Claude):**
> If you are reading this, you are tasked with maintaining, debugging, or expanding GlobalGrid2050.
>
> 1. **Do not regress.** This system has evolved from monolithic HTML files into a modular "Operating System" (`ventus-core.js` and `ventus.css`). Do not put logic back into the HTML data cartridges.
> 2. **Respect the geometry.** We snap lines using physical geodesic meters (Haversine), not distorted coordinate degrees.
> 3. **Defend the browser.** Scale horizontally by creating new regional HTML pages (e.g., `spain.html`) that pull from the root OS.
> 4. **Reconstruct if lost.** System 1 and 2 detail the Python/YAML logic for the data pipeline. Systems 3 and 4 detail the OS and CSS/DOM geometry. You have everything you need to rebuild this from scratch.
>
> Load this document into your context window before suggesting structural code changes. Pick up exactly where we left off. Ensure resilience.

---

## Origin and Philosophy

**GlobalGrid2050** was originated by [Ventus Ltd](https://www.ventusltd.com), the UK agent for Studer Cables AG Switzerland (formerly LEONI AG).

This platform is not a software experiment; it is the codification of two decades of hard-won physical engineering experience. The architecture is grounded in:

- 20 years of cable engineering, manufacturing, and technical sales.
- 14 years of utility-scale solar and High Voltage (HV) grid connection experience.
- The successful delivery of over 3 GWp of large-scale solar projects, major commercial rooftop PV systems, and landmark infrastructure like the Braintree EV Forecourt.

### The Geopolitical Catalyst

This project was accelerated in response to successive global energy shocks: the supply chain fractures of COVID-19, the European energy crisis triggered by the Ukraine-Russia conflict, and the subsequent market volatilities following the US-Iran war. These events highlighted the urgent, existential need for a resilient, transparent, and rapidly expanding electrified grid to achieve Net Zero.

### Human-Machine Codification

This repository serves as a live demonstration of human-machine collaboration in the AI era. It represents the deliberate transfer of deep, physical domain expertise into a scalable, automated digital architecture built in real-time alongside LLMs. The workload was strictly divided:

| Role | Responsibility |
|------|---------------|
| **Ventus (The Architect)** | Provided physical engineering truth, defined strict real-world constraints (e.g., geodesic snapping over decimal degrees), and orchestrated the system's evolution to ensure the digital model perfectly mirrors physical reality. |
| **ChatGPT (The Strategist)** | Identified and recommended GitHub Pages and Actions as the ultimate, serverless, low-maintenance platform — the most stable foundation to immortalize this experience without infrastructure decay or server costs. |
| **Gemini (The Backend Engineer)** | Authored the complex Python ETL pipelines, Overpass API query scripts, and robust data-fetching automation required to keep the intelligence live. |
| **Claude (The Frontend Engineer)** | Executed critical structural improvements, refined the SCADA UI/UX, and optimized the JavaScript rendering engine for maximum mobile and desktop performance. |

---

## Architectural Evolution: The Path to V5

To understand the current system, you must understand what we left behind.

| Version | Status | Description |
|---------|--------|-------------|
| **V3 (The Monolith)** | Deprecated | Original MVP. A 1,000+ line monolithic `index.html` containing CSS, map logic, state management, and UK-specific data. Proved the concept but unscalable. Topological snapping used a flawed `0.05` decimal degree tolerance (creating 5km+ distortion zones). |
| **V4 (The Interim Backup)** | **Do not build upon** | Transitional sandbox and backup state. Exists purely as a historical fallback. |
| **V5 (Ventus Core OS)** | ✅ Current production | Engine (`ventus-core.js`, `ventus.css`) extracted to root. Regional maps are lightweight Data Cartridges (< 150 lines). Introduced geodesic snapping (100m true distance), `requestAnimationFrame` throttling, and Measure Undo. |

**V5 Deployment Success:** By decoupling the engine from the payload, the platform now loads flawlessly on mobile (iOS/Android Safari & Chrome) with zero browser crashing. The hardware-accelerated WebGL canvas handles thousands of topological lines and asset bubbles effortlessly on mobile processors. Data layers hydrate asynchronously via a concurrency queue, transitioning gracefully from `[WAIT]` to `[OK]` with zero main-thread UI blocking.

---

## Engineering Challenges Conquered

The following bottlenecks were solved to reach V5. **Do not undo these solutions.**

### 1. The Spatial Distortion Problem
Early versions snapped power lines to substations using a fixed decimal degree tolerance (`0.05`). Because longitude lines converge at the poles, this created varying, massively distorted snapping zones (up to 5.5km wide), causing false topological connections.

**Solution:** Rewrote the snapping engine to use the Haversine formula, enforcing a strict, physical `100 meter` geodesic tolerance regardless of latitude.

### 2. Browser Thread Blocking
Loading large GeoJSON arrays directly into the DOM froze the browser's main thread, rendering the UI unresponsive.

**Solution:** Implemented a JavaScript `FetchQueue` with a concurrency limit of 4, allowing the UI to remain responsive while data layers hydrate asynchronously in the background.

### 3. Mobile Memory Panics
Loading European + UK infrastructure simultaneously caused iOS Safari to crash due to strict mobile RAM limits.

**Solution:** Abandoned the global monolith in favour of "Horizontal Sharding." The frontend was split into an OS Engine and regional Data Cartridges.

### 4. Pointer Event Thrashing
Querying MapLibre's rendered features on every pixel of mouse movement crashed performance.

**Solution:** Wrapped the `mousemove` event in `requestAnimationFrame`, ensuring the browser only calculates hover states when the GPU is ready to paint the next frame.

---

## Deploying Ventus OS Globally (Developer Guide)

Future developers and infrastructure analysts can deploy the Ventus OS to monitor their own country's grid. The OS handles all heavy lifting (rendering, UI, tools). You only need to provide the data.

### Step 1: Gather Local Data

Use the Python scripts in System 1 to query OpenStreetMap for your country's power lines and substations (change the `area` parameter in the Overpass query). Convert your local government's energy asset data into GeoJSON.

### Step 2: Create a Data Cartridge

1. In your repository, create a new file (e.g., `spain.html`).
2. Copy the HTML skeleton from `repd_grid_atlasv5/index.html`.
3. Ensure the `<script>` and `<link>` tags point to the root OS files (`../ventus.css` and `../ventus-core.js`).

### Step 3: Define the `GRID_CONFIG`

Inside your new HTML file, construct your configuration array. Map your local GeoJSON files to the OS using this structure:

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

At the bottom of your script, initialize the map by passing your config, the country's centre coordinates, and the starting zoom level into the Engine:

```javascript
window.initVentusMap({
  config: localConfig,
  center: [-3.7038, 40.4168], // Madrid
  zoom: 5.5
});
```

---

## System 1 — Infrastructure Overpass Pipeline

*The Ghost in the Machine*

The map relies on a suite of Python scripts that automatically query the OpenStreetMap (OSM) Overpass API, format the data into GeoJSON, and commit it directly to the repository.

### 1a. The Python Fetcher Blueprint (`scripts/fetch_*.py`)

Every infrastructure fetcher follows the same structural DNA using the `requests` library:

| Feature | Detail |
|---------|--------|
| **Area Filtering** | Restrict queries to the UK using `area(3600062149)->.uk;` |
| **Tag Filtering** | Nodes, ways, and relations queried via specific tags (e.g., `["power"="substation"]["voltage"~"400000\|275000\|..."]`) |
| **Centroid Generation** | Query ends with `out center;` — forces the API to calculate exact centre points for large polygon infrastructures |
| **Rate Limit Defence** | 3-attempt retry loop. On `429` status, executes `time.sleep(60)` |

### 1b. Grid Topology Automation (`.github/workflows/update-grid-data.yml`)

| Setting | Value |
|---------|-------|
| **Trigger** | `workflow_dispatch` (manual only) |
| **Execution Sequence** | Grid → 220kV → 66kV → Substations → Data Centres → Airports → Railways → Industry → Power Plants → HS2 |
| **Commit Logic** | Stages `*.geojson`, commits as `gridbot`, pushes to `main`, triggering Jekyll rebuild |

### 1c. Grid GeoJSON Files (repo root)

Static GeoJSON files generated by the fetchers:

```
grid_400kv.geojson
grid_275kv.geojson
grid_220kv.geojson
grid_132kv.geojson
grid_66kv.geojson
grid_substations.geojson
```

---

## System 2 — REPD Asset Intelligence Pipeline

### 2a. REPD ETL Pipeline (`scripts/repd_updater.py`)

Transforms the UK Government REPD CSV into a clean master GeoJSON (`dist/repd_master.json`).

| Feature | Detail |
|---------|--------|
| **Dynamic URL discovery** | Scrapes DESNZ Gov.uk page via BeautifulSoup. No hardcoded URLs. |
| **Idempotent / Change Detection** | Compares discovered URL against `source_url` in manifest. Exits immediately if unchanged. No wasted compute. |
| **Force re-sync** | Blank `dist/manifest_v4.json` `source_url` to `""` then trigger *Ventus REPD Master Sync* manually from the Actions tab. |
| **Schema validation** | Fails fast on missing required columns. |
| **Technology classification** | Driven by `Technology Type` + `Mounting Type` for Solar. Uses substring matching (`in tl`) to avoid CSV encoding artifacts. `Hydrogen` must be checked before `hydro` to avoid substring collision. |
| **Data hardening** | Filters zero/null coordinates, enforces UK bounding box. Unit sanity checks (e.g., converting mislabelled kW to MW). Case-safe status filter strips and lowercases string inputs. |

### 2b. REPD Automation (`.github/workflows/repd_sync.yml`)

| Setting | Value |
|---------|-------|
| **Triggers** | `schedule: cron 0 0 1 * *` (1st of every month) and `workflow_dispatch` |
| **Dependencies** | `pandas` `pyyaml` `requests` `pyproj` `beautifulsoup4` |

---

## System 3 — Ventus Core OS (Frontend Architecture)

### 3a. The Engine (`/ventus-core.js` & `/ventus.css`)

Located in the repository root. Built with **MapLibre GL JS v3.6.2** for GPU-accelerated WebGL rendering.

| Feature | Detail |
|---------|--------|
| **Geodesic Snapping** | Lines snapped to substations via Haversine formula with `0.1 km` (100 metre) tolerance. **Never revert to decimal degree tolerances.** |
| **Single shared source** | All REPD layers filter natively in MapLibre. No duplicate data loads. |
| **Concurrency** | `FetchQueue` (max 4 concurrent, 15,000ms timeout) to prevent browser network lockup. |
| **Performance** | `requestAnimationFrame` throttles `mousemove` events. |

### 3b. The Data Cartridges

Lightweight HTML files containing zero styling or engine logic. They import the OS, define a specific `GRID_CONFIG` array, and boot the map via `window.initVentusMap()`.

---

## System 4 — UI/UX Design System & SCADA Interface

> If `ventus.css` is lost, the UI must be rebuilt according to these strict aesthetic and DOM principles. The interface mimics a high-performance, dark-mode engineering terminal (SCADA).

### 4a. Aesthetic & Typography

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

### 4b. Viewport & Layout Geometry (Flexbox)

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

### 4c. Interactive Components & Overlays

| Component | Specification |
|-----------|--------------|
| **Layer Toggles** | Labels dynamically update to append `[WAIT]`, `[OK]`, or `[Count \| MW]` |
| **Map Controls** | Stacked column (`bottom: 30px; left: 10px; z-index: 20`). Hover → neon cyan border. Active → faint cyan background tint. |
| **Popups** | Dark background (`#000`), monospace font. Format: Title (Cyan, bold) → Tech/Mounting (Grey) → Capacity (Amber) → Status → Operator |
| **Search Bar** | Type 2+ chars for live dropdown, top 12 results by MW. Click to fly with 1.8s animation. |
| **Radius Tool** | Absolute-positioned near controls. Input box for km radius. Renders dynamic GeoJSON polygon circle via Haversine. Shows total assets, MW, tech breakdown, and top 5 assets. |
| **Measure Display** | `bottom: 30px; left: 50%; transform: translateX(-50%)`. Updates line length, perimeter, and area dynamically using Shoelace formula and Haversine math. |

### 4d. News/Images Popup Thresholds by Technology

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

### 4e. Console Verification Test

To verify the engine is successfully reading the REPD payload without UI rendering issues, run in the browser console:

```javascript
fetch('/dist/repd_master.json')
  .then(r => r.json())
  .then(d => {
    const counts = {};
    d.features.forEach(f => {
      const t = f.properties.tech;
      counts[t] = (counts[t] || 0) + 1;
    });
    console.log(counts);
  });
```

**Expected:** All 12 tech types present with non-zero counts.

---

## Hosting & Licence

| Item | Detail |
|------|--------|
| **Hosting** | GitHub Pages (`globalgrid2050.com`). Auto-deploys on commit. |
| **Licence** | [CERN OHL-S v2](https://ohwr.org/cern_ohl_s_v2.txt) — derivatives must remain open. |

---

## Design Principles

- **Open data only** — REPD, OSM, public GeoJSON.
- **Knowledge freely given** — no paywall, no login, no ads.
- **Test, don't assume** — every fix verified against real data.
- **Defensive programming** — distrust the CSV, validate the schema.
- **Physical accuracy over computational shortcuts** — snap in metres, measure in Haversine.
- **The human is the architect** — AIs execute, human signs off.
- **3 × AI + Human = AGI** — Claude builds, ChatGPT audits, Gemini reviews architecture.

---

*Actions guided by truth outlive the actor. Built in the spirit of the Gita. One layer at a time.*
