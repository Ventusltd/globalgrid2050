# GlobalGrid2050 | Ventus Core Architecture

**Last updated:** 2026 04 07  
**Platform:** Ventus OS Modular Pipeline

## ⚠️ Directive for Future Humans and AI Agents

> If you are reading this, you are tasked with maintaining, debugging, or expanding GlobalGrid2050.  
> Do not regress. This system has evolved from monolithic HTML files into a modular operating system built on `ventus-core.js` and `ventus.css`. Do not put logic back into the HTML data cartridges.  
> Respect the geometry. We snap lines and calculate physical footprints using geodesic metres through Haversine calculations, not distorted coordinate degrees.  
> Defend the browser. Scale horizontally by creating new regional HTML pages, such as `spain.html` or `repd_grid_atlasv5/index.html`, that pull from the root OS.  
> Reconstruct if lost. Systems 1 and 2 define the Python and YAML logic for the data pipeline. Systems 3 and 4 define the OS and CSS DOM geometry. You have everything needed to rebuild this from scratch.  
> Load this document into your context window before suggesting structural code changes. Pick up exactly where we left off. Ensure resilience.

---

## I. Origin and Philosophy

GlobalGrid2050 was originated by **Ventus Ltd**, the UK agent for **Studer Cables AG Switzerland**, formerly **LEONI AG**.

This platform is not a software experiment. It is the strict codification of 2 decades of hard-won physical engineering experience (spanning 15 countries, 100k+ miles, 3GWp of solar, EV, BESS, and HV/LV cables) into a digital twin. The architecture is grounded in understanding physical chokepoints, cable engineering, and real-world infrastructure constraints.

*Perfect data is not required. Structured data reveals reality.*

---

## II. The Archetype: Serverless Spatial Digital Twin

Most traditional Geographic Information Systems (GIS) and corporate digital twins are sluggish. They rely on massive, expensive backend databases. When a user zooms, the browser asks the server, the server runs a heavy database query, and streams it back. This creates lag, jitter, and massive load times.

Ventus OS bypasses this entirely. It is designed more like a **high-performance video game engine** than a traditional web app. By applying JAMstack principles to heavy industrial SCADA, Ventus OS operates as a **Serverless Spatial Digital Twin** based on four strict pillars:

1. **The "Pre-Baked" Physics (Gridbot):** The browser is explicitly banned from doing heavy math. The Python pipeline calculates all Haversine distances, bounding boxes, and complex spatial logic in the background while the user is offline. The browser simply reads a flat, highly optimized `.geojson` text file. Zero database queries = instant load times.
2. **GPU-Accelerated WebGL:** Drawing tens of thousands of HTML elements crashes the DOM. Ventus OS uses MapLibre GL JS to bypass the browser's normal drawing engine, sending geometry directly to the user's Graphics Processing Unit (GPU). This allows tens of thousands of wind turbines, substations, and ports to render at 60 frames per second.
3. **Zero Framework Bloat:** Modern web development is obsessed with massive frameworks (React, Angular, Vue). Ventus OS rejects them. The `ventus-core.js` and `ventus.css` files are pure, vanilla code. There is no middleman slowing down the translation between the data and the screen.
4. **GPU Layer Splitting:** Ventus OS downloads massive datasets *once*. It then uses WebGL `filter` and `interpolate` expressions to dynamically split, color, and resize the dots on the graphics card instantly based on UI toggles.

---

## III. The Four Core Systems

The architecture is strictly separated into four decoupled systems. Data flows in one direction: from raw intelligence (1), through automated scheduling (2), into the client browser memory (3), and is painted to the screen via the DOM (4).

### System 1: The Python ETL Engine (Data Ingestion)
Located in `scripts/`. These scripts extract spatial intelligence (Overpass API or trusted NGO datasets) and compile them into `.geojson` files.
* **The Spatial Sizing Rule:** For physical infrastructure, scripts must request bounding boxes (`out center bb;`), calculate the true physical footprint in hectares using geodesic Haversine distance (`area_ha`), and inject this into the GeoJSON properties. 
* **Deduplication:** Spatial deduplication happens here, in the backend, never in the browser. 

### System 2: Gridbot Automation (YAML Actions)
Located in `.github/workflows/`. "Gridbot" is the automated custodian of the platform.
* **The Gridbot Auth Standard:** All YAML files pushing data back to the repository must bypass default protections using a Personal Access Token (`GRIDBOT_PAT`).
* **Repository Truth:** Gridbot automatically maps the entire repository. The file `REPO_STRUCTURE.txt` is the live, automated source of truth for the codebase layout.

### System 3: Ventus OS (`ventus-core.js` & MapLibre)
The WebGL rendering engine consuming the GeoJSON files.
* **Rendering Haversine Math:** The frontend *must* render physical sizing exactly as dictated by the backend. We use MapLibre's `interpolate` expression tied to the pre-calculated `area_ha` property to dynamically size circles. (e.g., A deep-water ferry port mapped at 80 hectares renders as a 10px-16px beacon, while a 2-hectare river dock renders as a 2.5px dust mote).
* **UI Layer Splitting:** A single backend `.geojson` dataset is split into multiple toggleable layers using MapLibre's `filter` property.

### System 4: SCADA UI (`ventus.css`)
The DOM overlay. A strict, dark-mode, high-contrast SCADA (Supervisory Control and Data Acquisition) aesthetic. 
* Typography is monospace (`Courier New`).
* Colors encode operational status (Green = Operational, Yellow = Construction, Orange = Consented, Blue = Applied/Pipeline).

---

## IV. Spatial Geometry is the Foundation of Truth

All system calculations are grounded in:
* Haversine distance
* Geodesic snapping
* Real-world metres

This is not an implementation detail. It is a constraint. Any regression to coordinate shortcuts, pixel-based radius assumptions without physical backing, or degree-based approximations will corrupt system integrity. Geometry is the foundation of electrical truth.

---

## V. What the System Has Already Proven

From combined backend data and system behaviour:
* Energy transition is spatial, not abstract.
* Clustering drives instability.
* Capacity metrics alone are misleading.
* Infrastructure complexity is hidden but critical.
* Cable systems are the limiting factor.
* Grid architecture is becoming distributed.
* Planning lacks spatial awareness.
* Data does not need to be perfect to be useful.

---

## VI. Final Directive for Interpretation

This system must not be treated as:
* A map
* A dashboard
* A dataset viewer

It is:
**A real-time spatial reasoning engine for electrical infrastructure.**

Every feature added must answer:
* Does this improve understanding of constraints?
* Does this preserve physical truth?
* Does this increase decision clarity?

If not, it does not belong.

**Actions guided by truth outlive the actor.**
