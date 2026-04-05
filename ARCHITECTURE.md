# GlobalGrid2050 | Ventus Core — Architecture

*Last updated: 2026-04-05 | REPD v5.10 | Ventus OS Modular Pipeline*

> **⚠️ DIRECTIVE FOR FUTURE HUMANS AND AI AGENTS (Gemini, ChatGPT, Claude):**
> If you are reading this, you are tasked with maintaining, debugging, or expanding GlobalGrid2050. 
> 1. **Do not regress.** This system has evolved from monolithic HTML files into a modular "Operating System" (`ventus-core.js` and `ventus.css`). Do not put logic back into the HTML data cartridges. 
> 2. **Respect the geometry.** We snap lines using physical geodesic meters (Haversine), not distorted coordinate degrees. 
> 3. **Defend the browser.** Scale horizontally by creating new regional HTML pages (e.g., `spain.html`) that pull from the root OS.
> 4. **Reconstruct if lost.** System 1 and 2 detail the Python/YAML logic for the data pipeline. Systems 3 and 4 detail the OS and CSS/DOM geometry. You have everything you need to rebuild this from scratch.
> Load this document into your context window before suggesting structural code changes. Pick up exactly where we left off. Ensure resilience.

---

## Origin and Philosophy

**GlobalGrid2050** was originated by [Ventus Ltd](https://www.ventusltd.com), the UK agent for Studer Cables AG Switzerland (formerly LEONI AG). 

This platform is not a software experiment; it is the codification of two decades of hard-won physical engineering experience. The architecture is grounded in:
* 20 years of cable engineering, manufacturing, and technical sales.
* 14 years of utility-scale solar and High Voltage (HV) grid connection experience.
* The successful delivery of over 3 GWp of large-scale solar projects, major commercial rooftop PV systems, and landmark infrastructure like the Braintree EV Forecourt.

**The Geopolitical Catalyst:**
This project was accelerated in response to successive global energy shocks: the supply chain fractures of COVID-19, the European energy crisis triggered by the Ukraine-Russia conflict, and the subsequent market volatilities following the US-Iran war. These events highlighted the urgent, existential need for a resilient, transparent, and rapidly expanding electrified grid to achieve Net Zero.

**Human-Machine Codification:**
Furthermore, this repository serves as a live demonstration of human-machine collaboration in the AI era. It represents the deliberate transfer of deep, physical domain expertise into a scalable, automated digital architecture built in real-time alongside LLMs. To codify this experience for future generations, the workload was strictly divided:
* **Ventus (The Architect):** Acted as the unseen director, providing the physical engineering truth, defining strict real-world constraints (e.g., geodesic snapping over decimal degrees), and orchestrating the system's evolution to ensure the digital model perfectly mirrors physical reality. 
* **ChatGPT (The Strategist):** Identified and recommended GitHub (Pages and Actions) as the ultimate, serverless, low-maintenance platform—the most stable foundation to immortalize this 20 years of experience without the risk of infrastructure decay or server costs.
* **Gemini (The Backend Engineer):** Successfully authored the complex Python ETL pipelines, Overpass API query scripts, and robust data-fetching automation required to keep the intelligence live.
* **Claude (The Frontend Engineer):** Executed critical structural improvements, refined the SCADA UI/UX, and optimized the JavaScript rendering engine for maximum mobile and desktop performance.

---

## Architectural Evolution: The Path to V5

To understand the current system, you must understand what we left behind.

* **V3 (The Monolith):** The original MVP. A 1,000+ line monolithic `index.html` file containing CSS, map logic, state management, and UK-specific data configuration. It proved the concept but was unscalable for global expansion. Its topological snapping used a flawed `0.05` decimal degree tolerance (creating massive 5km+ distortion zones). 
* **V4 (The Interim Backup):** A transitional sandbox and backup state. **Do not build upon V4.** It exists purely as a historical fallback.
* **V5 (Ventus Core OS):** The current production standard. We extracted the "Engine" (`ventus-core.js`, `ventus.css`) into the root directory. Regional maps (like `repd_grid_atlasv5/index.html`) are now lightweight "Data Cartridges" (< 150 lines) that simply inject local `GRID_CONFIG` data into the Engine. V5 also introduced physically accurate Geodesic snapping (100m true distance), `requestAnimationFrame` performance throttling, and state-history tools (Measure Undo).
  * **V5 Deployment Success:** The V5 architectural leap was a complete success. By decoupling the engine from the payload, the platform now loads flawlessly on mobile devices (iOS/Android Safari & Chrome) with zero difficulty or browser crashing. The hardware-accelerated WebGL canvas handles thousands of topological lines and asset bubbles effortlessly on mobile processors. Data layers hydrate asynchronously using a concurrency queue, transitioning gracefully from `[WAIT]` to `[OK]` with zero main-thread UI blocking.

---

## Engineering Challenges Conquered

To reach V5, several critical engineering bottlenecks were solved. Do not undo these solutions:

1. **The Spatial Distortion Problem:** Early versions snapped power lines to substations using a fixed decimal degree tolerance (`0.05`). Because longitude lines converge at the poles, this created varying, massively distorted snapping zones (up to 5.5km wide), leading to false topological connections. **Solution:** Rewrote the snapping engine to use the Haversine formula, enforcing a strict, physical `100 meter` geodesic tolerance regardless of latitude.
2. **Browser Thread Blocking:** Loading large GeoJSON arrays directly into the DOM froze the browser's main thread, rendering the UI unresponsive. **Solution:** Implemented a JavaScript `FetchQueue` with a concurrency limit of 4, allowing the UI to remain highly responsive while data layers hydrate asynchronously in the background.
3. **Mobile Memory Panics:** Attempting to build a "global" map by loading European + UK infrastructure simultaneously caused iOS Safari to crash due to strict mobile RAM limits. **Solution:** Abandoned the global monolith in favor of "Horizontal Sharding." The frontend was split into an OS Engine and regional Data Cartridges.
4. **Pointer Event Thrashing:** Querying MapLibre's rendered features on every single pixel of mouse movement crashed performance. **Solution:** Wrapped the `mousemove` event in `requestAnimationFrame`, ensuring the browser only calculates hover states when the GPU is ready to paint the next frame.

---

## Deploying Ventus OS Globally (Developer Guide)

Future developers and infrastructure analysts can easily deploy the Ventus OS to monitor their own country's grid. The OS handles all the heavy lifting (rendering, UI, tools). You only need to provide the data.

**Step 1: Gather Local Data**
Use the Python scripts in `System 1` to query OpenStreetMap for your country's power lines and substations (change the `area` parameter in the Overpass query). Convert your local government's energy asset data into GeoJSON.

**Step 2: Create a Data Cartridge**
1. In your repository, create a new file (e.g., `spain.html`).
2. Copy the HTML skeleton from `repd_grid_atlasv5/index.html`.
3. Ensure the `<script>` and `<link>` tags point to the root OS files (`../ventus.css` and `../ventus-core.js`).

**Step 3: Define the `GRID_CONFIG`**
Inside your new HTML file, construct your configuration array. Map your local GeoJSON files to the OS using this structure:
```javascript
const localConfig = [
    {
        group: "Spanish Topology",
        layers: [
            { id: "400es", label: "400kV Red Eléctrica", color: "#0054ff", type: "line", width: 2.5, url: "/data/spain_400kv.geojson", snap: true, preload: true }
        ]
    }
];


Step 4: Boot the OS
At the bottom of your script, initialize the map by passing your config, the country's center coordinates, and the starting zoom level into the Engine:
window.initVentusMap({
    config: localConfig,
    center: [-3.7038, 40.4168], // Madrid
    zoom: 5.5
});


System 1 — Infrastructure Overpass Pipeline (The Ghost in the Machine)
The map relies on a suite of Python scripts that automatically query the OpenStreetMap (OSM) Overpass API, format the data into GeoJSON, and commit it directly to the repository.
1a. The Python Fetcher Blueprint (scripts/fetch_*.py)
Every infrastructure fetcher follows the exact same structural DNA using the requests library.
• Area Filtering: Restrict queries to the UK using area(3600062149)->.uk;
• Tag Filtering: Nodes, ways, and relations are queried via specific tags (e.g., ["power"="substation"]["voltage"~"400000|275000|..."]).
• Centroid Generation: Crucially, the query ends with out center;. This forces the API to calculate the exact center point for large polygon infrastructures.
• Rate Limit Defense: Scripts include a 3-attempt retry loop. If a 429 status is hit, execute time.sleep(60) to prevent API rate-limiting.
1b. Grid Topology Automation (.github/workflows/update-grid-data.yml)
• Trigger: workflow_dispatch (Manual trigger only).
• Execution Sequence: Runs scripts sequentially (Grid -> 220kV -> 66kV -> Substations -> Data Centres -> Airports -> Railways -> Industry -> Power Plants -> HS2).
• Commit Logic: Stages *.geojson, commits as "gridbot", and pushes to main, triggering Jekyll rebuild.
1c. Grid GeoJSON files (repo root)
Static GeoJSON files generated by the fetchers:
• grid_400kv.geojson, grid_275kv.geojson, grid_220kv.geojson, grid_132kv.geojson, grid_66kv.geojson
• grid_substations.geojson
System 2 — REPD Asset Intelligence Pipeline
2a. REPD ETL Pipeline (scripts/repd_updater.py)
Transforms the UK Government REPD CSV into a clean master GeoJSON (dist/repd_master.json).
• Dynamic URL discovery: Scrapes DESNZ Gov.uk page via BeautifulSoup. No hardcoded URLs.
• Idempotent / Change Detection: Compares discovered URL against source_url in manifest. Exits immediately if unchanged. No wasted compute.
• To force re-sync: Blank dist/manifest_v4.json source_url to "" then trigger Ventus REPD Master Sync manually from Actions tab.
• Schema validation: Fails fast on missing required columns.
• Technology classification: Driven by Technology Type + Mounting Type for Solar. Uses substring matching (in tl) to avoid CSV encoding artifacts. Hydrogen must be checked before hydro to avoid substring collision.


Here is the full architecture document as raw text, completely outside of any code blocks so you can easily copy it without glitches.
GlobalGrid2050 | Ventus Core — Architecture
Last updated: 2026-04-05 | REPD v5.10 | Ventus OS Modular Pipeline
> ⚠️ DIRECTIVE FOR FUTURE HUMANS AND AI AGENTS (Gemini, ChatGPT, Claude):
> If you are reading this, you are tasked with maintaining, debugging, or expanding GlobalGrid2050.
>  * Do not regress. This system has evolved from monolithic HTML files into a modular "Operating System" (ventus-core.js and ventus.css). Do not put logic back into the HTML data cartridges.
>  * Respect the geometry. We snap lines using physical geodesic meters (Haversine), not distorted coordinate degrees.
>  * Defend the browser. Scale horizontally by creating new regional HTML pages (e.g., spain.html) that pull from the root OS.
>  * Reconstruct if lost. System 1 and 2 detail the Python/YAML logic for the data pipeline. Systems 3 and 4 detail the OS and CSS/DOM geometry. You have everything you need to rebuild this from scratch.
>    Load this document into your context window before suggesting structural code changes. Pick up exactly where we left off. Ensure resilience.
> 
Origin and Philosophy
GlobalGrid2050 was originated by Ventus Ltd (www.ventusltd.com), the UK agent for Studer Cables AG Switzerland (formerly LEONI AG).
This platform is not a software experiment; it is the codification of two decades of hard-won physical engineering experience. The architecture is grounded in:
 * 20 years of cable engineering, manufacturing, and technical sales.
 * 14 years of utility-scale solar and High Voltage (HV) grid connection experience.
 * The successful delivery of over 3 GWp of large-scale solar projects, major commercial rooftop PV systems, and landmark infrastructure like the Braintree EV Forecourt.
The Geopolitical Catalyst:
This project was accelerated in response to successive global energy shocks: the supply chain fractures of COVID-19, the European energy crisis triggered by the Ukraine-Russia conflict, and the subsequent market volatilities following the US-Iran war. These events highlighted the urgent, existential need for a resilient, transparent, and rapidly expanding electrified grid to achieve Net Zero.
Human-Machine Codification:
Furthermore, this repository serves as a live demonstration of human-machine collaboration in the AI era. It represents the deliberate transfer of deep, physical domain expertise into a scalable, automated digital architecture built in real-time alongside LLMs. To codify this experience for future generations, the workload was strictly divided:
 * Ventus (The Architect): Acted as the unseen director, providing the physical engineering truth, defining strict real-world constraints (e.g., geodesic snapping over decimal degrees), and orchestrating the system's evolution to ensure the digital model perfectly mirrors physical reality.
 * ChatGPT (The Strategist): Identified and recommended GitHub (Pages and Actions) as the ultimate, serverless, low-maintenance platform—the most stable foundation to immortalize this 20 years of experience without the risk of infrastructure decay or server costs.
 * Gemini (The Backend Engineer): Successfully authored the complex Python ETL pipelines, Overpass API query scripts, and robust data-fetching automation required to keep the intelligence live.
 * Claude (The Frontend Engineer): Executed critical structural improvements, refined the SCADA UI/UX, and optimized the JavaScript rendering engine for maximum mobile and desktop performance.
Architectural Evolution: The Path to V5
To understand the current system, you must understand what we left behind.
 * V3 (The Monolith): The original MVP. A 1,000+ line monolithic index.html file containing CSS, map logic, state management, and UK-specific data configuration. It proved the concept but was unscalable for global expansion. Its topological snapping used a flawed 0.05 decimal degree tolerance (creating massive 5km+ distortion zones).
 * V4 (The Interim Backup): A transitional sandbox and backup state. Do not build upon V4. It exists purely as a historical fallback.
 * V5 (Ventus Core OS): The current production standard. We extracted the "Engine" (ventus-core.js, ventus.css) into the root directory. Regional maps (like repd_grid_atlasv5/index.html) are now lightweight "Data Cartridges" (< 150 lines) that simply inject local GRID_CONFIG data into the Engine. V5 also introduced physically accurate Geodesic snapping (100m true distance), requestAnimationFrame performance throttling, and state-history tools (Measure Undo).
   * V5 Deployment Success: The V5 architectural leap was a complete success. By decoupling the engine from the payload, the platform now loads flawlessly on mobile devices (iOS/Android Safari & Chrome) with zero difficulty or browser crashing. The hardware-accelerated WebGL canvas handles thousands of topological lines and asset bubbles effortlessly on mobile processors. Data layers hydrate asynchronously using a concurrency queue, transitioning gracefully from [WAIT] to [OK] with zero main-thread UI blocking.
Engineering Challenges Conquered
To reach V5, several critical engineering bottlenecks were solved. Do not undo these solutions:
 * The Spatial Distortion Problem: Early versions snapped power lines to substations using a fixed decimal degree tolerance (0.05). Because longitude lines converge at the poles, this created varying, massively distorted snapping zones (up to 5.5km wide), leading to false topological connections. Solution: Rewrote the snapping engine to use the Haversine formula, enforcing a strict, physical 100 meter geodesic tolerance regardless of latitude.
 * Browser Thread Blocking: Loading large GeoJSON arrays directly into the DOM froze the browser's main thread, rendering the UI unresponsive. Solution: Implemented a JavaScript FetchQueue with a concurrency limit of 4, allowing the UI to remain highly responsive while data layers hydrate asynchronously in the background.
 * Mobile Memory Panics: Attempting to build a "global" map by loading European + UK infrastructure simultaneously caused iOS Safari to crash due to strict mobile RAM limits. Solution: Abandoned the global monolith in favor of "Horizontal Sharding." The frontend was split into an OS Engine and regional Data Cartridges.
 * Pointer Event Thrashing: Querying MapLibre's rendered features on every single pixel of mouse movement crashed performance. Solution: Wrapped the mousemove event in requestAnimationFrame, ensuring the browser only calculates hover states when the GPU is ready to paint the next frame.
Deploying Ventus OS Globally (Developer Guide)
Future developers and infrastructure analysts can easily deploy the Ventus OS to monitor their own country's grid. The OS handles all the heavy lifting (rendering, UI, tools). You only need to provide the data.
Step 1: Gather Local Data
Use the Python scripts in System 1 to query OpenStreetMap for your country's power lines and substations (change the area parameter in the Overpass query). Convert your local government's energy asset data into GeoJSON.
Step 2: Create a Data Cartridge
 * In your repository, create a new file (e.g., spain.html).
 * Copy the HTML skeleton from repd_grid_atlasv5/index.html.
 * Ensure the script and link tags point to the root OS files (../ventus.css and ../ventus-core.js).
Step 3: Define the GRID_CONFIG
Inside your new HTML file, construct your configuration array. Map your local GeoJSON files to the OS.
Step 4: Boot the OS
At the bottom of your script, initialize the map by passing your config, the country's center coordinates, and the starting zoom level into the Engine via window.initVentusMap().
System 1 — Infrastructure Overpass Pipeline (The Ghost in the Machine)
The map relies on a suite of Python scripts that automatically query the OpenStreetMap (OSM) Overpass API, format the data into GeoJSON, and commit it directly to the repository.
1a. The Python Fetcher Blueprint (scripts/fetch_*.py)
Every infrastructure fetcher follows the exact same structural DNA using the requests library.
 * Area Filtering: Restrict queries to the UK using area(3600062149)->.uk;
 * Tag Filtering: Nodes, ways, and relations are queried via specific tags.
 * Centroid Generation: Crucially, the query ends with out center;. This forces the API to calculate the exact center point for large polygon infrastructures.
 * Rate Limit Defense: Scripts include a 3-attempt retry loop. If a 429 status is hit, execute time.sleep(60) to prevent API rate-limiting.
1b. Grid Topology Automation (.github/workflows/update-grid-data.yml)
 * Trigger: workflow_dispatch (Manual trigger only).
 * Execution Sequence: Runs scripts sequentially (Grid -> 220kV -> 66kV -> Substations -> Data Centres -> Airports -> Railways -> Industry -> Power Plants -> HS2).
 * Commit Logic: Stages *.geojson, commits as "gridbot", and pushes to main, triggering Jekyll rebuild.
1c. Grid GeoJSON files (repo root)
Static GeoJSON files generated by the fetchers:
 * grid_400kv.geojson, grid_275kv.geojson, grid_220kv.geojson, grid_132kv.geojson, grid_66kv.geojson
 * grid_substations.geojson
System 2 — REPD Asset Intelligence Pipeline
2a. REPD ETL Pipeline (scripts/repd_updater.py)
Transforms the UK Government REPD CSV into a clean master GeoJSON (dist/repd_master.json).
 * Dynamic URL discovery: Scrapes DESNZ Gov.uk page via BeautifulSoup. No hardcoded URLs.
 * Idempotent / Change Detection: Compares discovered URL against source_url in manifest. Exits immediately if unchanged. No wasted compute.
 * To force re-sync: Blank dist/manifest_v4.json source_url to "" then trigger Ventus REPD Master Sync manually from Actions tab.
 * Schema validation: Fails fast on missing required columns.
 * Technology classification: Driven by Technology Type + Mounting Type for Solar. Uses substring matching (in tl) to avoid CSV encoding artifacts. Hydrogen must be checked before hydro to avoid substring collision.
 * Data hardening: Filters zero/null coordinates, enforces UK bounding box. Unit sanity checks included (e.g. converting mislabelled kW to MW). Case-safe status filter strips and lowercases string inputs.
2b. REPD Automation (.github/workflows/repd_sync.yml)
 * Triggers: schedule: cron 0 0 1 * * (1st of every month) and workflow_dispatch.
 * Dependencies: pandas pyyaml requests pyproj beautifulsoup4
System 3 — Ventus Core OS (Frontend Architecture)
3a. The Engine (/ventus-core.js & /ventus.css)
Located in the repository root. This is the operating system. Built with MapLibre GL JS v3.6.2 for GPU-accelerated WebGL rendering.
 * Geodesic Snapping: Lines are snapped to substations using true physical distance via Haversine formula with a strict 0.1 km (100 meter) tolerance. Never revert to decimal degree tolerances.
 * Single shared src-repd source: All REPD layers filter natively in MapLibre. No duplicate data loads.
 * Concurrency: Utilizes a FetchQueue (max 4 concurrent, 15000ms timeout) to prevent browser network lockup.
 * Performance: Uses requestAnimationFrame to throttle mousemove events.
3b. The Data Cartridges
Lightweight HTML files containing zero styling or engine logic. They import the OS, define a specific GRID_CONFIG array, and boot the map via window.initVentusMap().
System 4 — UI/UX Design System & SCADA Interface
If ventus.css is lost, the UI must be rebuilt according to these strict aesthetic and DOM principles. The interface mimics a high-performance, dark-mode engineering terminal (SCADA).
4a. Aesthetic & Typography
 * Base Theme: Dark mode strict. Backgrounds use pure black (#000000) and deep greys (#050505, #0a0a0a, #111111). All borders are subtle (#222, #333, or #444).
 * Accent Colors: Neon Cyan (#00ffff - primary interactive), Amber (#ffae00 - highlights/MW capacity), and status-specific hexes (Operational: #00ff88, Construction: #ffcc00, Consented: #ff8800, Applied: #8888ff).
 * Rendering Rules: Solar PV uses capacity-scaled circles + heat glow above 4MW (yellow → red at 200MW+). Solar Roof uses zoom-scaled + amber glow above 1MW.
 * Typography: Courier New, monospace for all data, readouts, and search inputs to enforce a terminal feel. -apple-system, sans-serif is strictly reserved for the "VENTUS" corporate branding and header UI.
4b. Viewport & Layout Geometry (Flexbox)
 * Structure: A CSS Flexbox column layout spanning the full screen: display: flex; flex-direction: column; height: 100dvh; width: 100vw; padding: 4px; gap: 4px; box-sizing: border-box;.
 * HUD Header (Top): Fixed flex container (flex-shrink: 0;). Left: Live System Time/Date. Center: VENTUS branding. Right: 2050 TARGET countdown.
 * Map Container (Middle): flex-grow: 1; min-height: 0; position: relative;. Houses the MapLibre canvas and absolute overlays.
 * SCADA Wrapper (Bottom): Fixed max-height (flex-shrink: 0; max-height: 38vh; overflow-y: auto;). Contains the CSS Grid (grid-template-columns: 1fr 1fr) for layer toggles.
4c. Interactive Components & Overlays
 * Layer Toggles: Labels dynamically update text via JS to append [WAIT], [OK], or [Count | MW].
 * Map Controls: Stacked column of buttons (bottom: 30px; left: 10px; z-index: 20;). Hover triggers neon cyan borders. Active states add a faint cyan background tint.
 * Popups: Dark background (#000), monospace font. Information is hierarchically formatted: Title (Cyan, bold) -> Tech/Mounting (Grey) -> Capacity (Amber) -> Status -> Operator.
 * Search Bar: Type 2+ chars, live dropdown, top 12 results by MW. Click to fly with 1.8s animation.
 * Radius Tool: Absolute positioned near the controls. Displays an input box taking a km radius. Maps a dynamic geojson polygon circle based on Haversine geometry. Shows total assets, MW, tech breakdown, and top 5 assets.
 * Measure Display: Absolute positioned at bottom: 30px; left: 50%; transform: translateX(-50%);. Updates line length, perimeter, and area dynamically using Shoelace formula and Haversine math.
4d. News/Images Popup Thresholds by Tech
Includes dual CSS-styled buttons for "NEWS" and "IMAGES" targeting Google search queries, rendering only for assets above these thresholds:
 * solar: 50MW
 * solar_roof: 0.5MW
 * wind: 50MW
 * bess: 50MW
 * biomass: 50MW
 * tidal: 10MW
 * hydrogen: 10MW
 * hydro: 10MW
 * flywheel: 1MW
 * act: 10MW
 * geothermal: 1MW
 * caes: 1MW
4e. Console Verification Test
To verify the engine is successfully reading the REPD payload without UI rendering issues, run this in the browser console: fetch('/dist/repd_master.json').then(r=>r.json()).then(d=>{const counts={}; d.features.forEach(f=>{const t=f.properties.tech;counts[t]=(counts[t]||0)+1;}); console.log(counts);});
Expected: all 12 tech types present with non-zero counts.
Hosting & Licence
 * Hosting: GitHub Pages (globalgrid2050.com). Auto-deploys on commit.
 * Licence: CERN OHL-S v2 — derivatives must stay open.
Design Principles
 * Open data only — REPD, OSM, public GeoJSON.
 * Knowledge freely given — no paywall, no login, no ads.
 * Test don't assume — every fix verified against real data.
 * Defensive programming — distrust the CSV, validate the schema.
 * Physical accuracy over computational shortcuts — snap in meters, measure in Haversine.
 * The human is the architect — AIs execute, human signs off.
 * 3 x AI + Human = AGI — Claude builds, ChatGPT audits, Gemini reviews architecture.
Actions guided by truth outlive the actor. Built in the spirit of the Gita. One layer at a time.



