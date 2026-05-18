# GlobalGrid2050 V6 Application Architecture

V6 is the separated testing workspace for the GlobalGrid2050 Solar BESS Topology system.

It was created from the stable V5 toolset. V5 remains the working baseline. V6 is where applications are separated, documented, modularised and tested one controlled step at a time.

Public test address:

```text
https://globalgrid2050.com/solar-bess-topology-v6/
```

## Governing instruction

When unsure, refer first to:

```text
/PHILOSOPHY.md
solar-bess-topology-v6/README.md
solar-bess-topology-v6/docs/ARCHITECTURE.md
solar-bess-topology-v6/docs/V5_CHANGELOG_AND_ROADMAP.md
```

The repository philosophy is the governing doctrine. The V6 docs explain how that doctrine is applied inside this workspace.

Standing instruction:

```text
Do not guess. Do not mass rewrite. Do not silently overwrite working logic. Read the docs, respect the philosophy, isolate the feature, make the smallest controlled change and preserve the working baseline.
```

## V6 purpose

V6 exists to convert the previous flat V5 toolset into a cleaner separated application workspace.

Objectives:

```text
1. Keep V5 stable.
2. Give each app its own folder.
3. Stop unrelated tools sharing the same flat namespace.
4. Prepare future shared libraries deliberately rather than accidentally.
5. Modularise one app at a time.
6. Preserve behaviour while improving maintainability.
7. Keep every change traceable through reports, commits and human approval.
```

## V6 site map

```text
solar-bess-topology-v6/
|
|-- index.html                         V6 launcher page
|-- README.md                          Human summary, status, URLs and rules
|-- gis-sld-financial-sandbox/         Main GIS SLD financial sandbox
|-- module-layout/                     Physical solar module layout app
|-- dc-ac-lv-topology-review/          DC AC LV topology review app
|-- cable-geometry-visualiser/         Modularised cable geometry visualiser
|-- docs/                              Architecture and inherited V5 roadmap
|-- tools/                             Legacy V5 installer scripts for audit context
```

## Application URLs

V6 test URLs:

```text
https://globalgrid2050.com/solar-bess-topology-v6/
https://globalgrid2050.com/solar-bess-topology-v6/gis-sld-financial-sandbox/
https://globalgrid2050.com/solar-bess-topology-v6/module-layout/
https://globalgrid2050.com/solar-bess-topology-v6/dc-ac-lv-topology-review/
https://globalgrid2050.com/solar-bess-topology-v6/cable-geometry-visualiser/
```

V5 comparison URLs:

```text
https://globalgrid2050.com/solar-bess-topology-v5/indexforgis-sld-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/module-layout-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/dc-ac-lv-topology-review-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/cable-geometry-visualiser-v5.html
```

## Current app status

### V6 launcher

`index.html` links to the 4 separated V6 apps.

### GIS SLD Financial Sandbox

Folder:

```text
gis-sld-financial-sandbox/
```

Purpose:

```text
Main GIS, SLD, financial and grid screening application.
```

Status:

Copied from V5 and isolated inside its own folder. The app title says V6 but internal files still use `gis-sld-v5` names. This is intentional for now. The first V6 objective is safe separation, not wholesale renaming.

### Module Layout

Folder:

```text
module-layout/
```

Purpose:

```text
Physical solar module footprint, row count, pitch, orientation, rotation and map based layout visualisation.
```

Status:

Copied from V5 and isolated. It still loads V5 named CSS and JS files inside the V6 folder.

### DC AC LV Topology Review

Folder:

```text
dc-ac-lv-topology-review/
```

Purpose:

```text
Solar PV string, inverter, combiner, skid and cable topology review outside the main GIS finance app.
```

Status:

Copied from V5 and isolated. It still uses V5 named CSS and JS files inside the V6 folder.

### Cable Geometry Visualiser

Folder:

```text
cable-geometry-visualiser/
```

Purpose:

```text
Cable formation, indicative trench geometry, bend sweep visualisation, geometry capture, JSON export and snapshot copying.
```

Status:

Modularised in V6 phase 1.

## Cable geometry visualiser architecture

Current files:

```text
cable-geometry-visualiser/
|
|-- index.html       HTML structure only, with external CSS and JS references
|-- style.css        Visual styling extracted from original inline CSS
|-- data.js          Constants, voltage classes, OD tables, lookup data and app state
|-- calculations.js  DOM helpers, numeric normalisation, OD lookup, layout and review logic
|-- rendering.js     Status, issue, stat and canvas drawing functions
|-- export.js        JSON export and copy snapshot functions
|-- ui.js            UI population, event binding, orchestration and app boot
```

Load order:

```text
style.css

data.js
calculations.js
rendering.js
export.js
ui.js
```

The order is intentional. Do not change it unless the dependency graph is deliberately redesigned and tested.

## Cable geometry data flow

```text
User changes input
|
|-- ui.js handles input or change event
|   |-- calculations.js reads values, normalises input, computes layout and review status
|   |-- rendering.js updates status, stats and canvases
|   |-- export.js provides JSON and snapshot output when requested
|   |-- ui.js controls boot, debounce and event wiring
```

The visualiser remains geometry only.

It does not perform:

```text
electrical rating
thermal rating
cable sizing
protection grading
construction design
compliance verdict
burial depth design advice
```

## Cable geometry modularisation proof

The phase 1 report is:

```text
gridbot_reports/v6_cable_geometry_modularisation_phase_1.md
```

That report confirms the extracted V6 CSS and JavaScript rebuild exactly to the original V6 inline logic and match the original V5 baseline.

## Main GIS SLD financial sandbox architecture

Current folder:

```text
gis-sld-financial-sandbox/
```

Current file pattern:

```text
index.html
gis-sld-v5.css
gis-sld-v5-config.js
gis-sld-v5-helpers.js
gis-sld-v5-state.js
gis-sld-v5-substations.js
gis-sld-v5-map.js
gis-sld-v5-calculations.js
gis-sld-v5-finance.js
gis-sld-v5-ui-core.js
gis-sld-v5-drawing.js
gis-sld-v5-export.js
gis-sld-v5-ui.js
```

Dependency order:

```text
config
helpers
state
substations
map
calculations
finance
ui-core
drawing
export
ui
```

Rule:

Do not rename or restructure this app until the V6 separation and cable geometry modularisation have been manually validated in browser.

## Module layout architecture

Current role:

```text
Physical module layout testing outside the main GIS finance app.
```

Core behaviours:

```text
module count
module width and height
portrait or landscape orientation
modules per row
row pitch
module gap
array rotation
draw at map centre
pick site on map
physical footprint area
rendered module count
```

Rule:

Keep this app separate until the module geometry model becomes stable enough to share data with the GIS SLD financial sandbox.

## DC AC LV topology review architecture

Current role:

```text
Solar PV string, inverter, combiner, skid and cable topology review outside the main GIS finance app.
```

It is an engineering review surface. It should remain separate while its calculations and UI are validated.

## V6 development rules

```text
1. V5 remains stable.
2. V6 is the testing and modularisation workspace.
3. No broad rewrite.
4. No uncontrolled AI generated file replacement.
5. No hidden state scattering.
6. No new shared folder until a shared dependency is deliberately designed.
7. Do not rename legacy V5 file names merely for neatness.
8. Keep each app loadable from its own folder.
9. Every change must have a clear feature name or commit purpose.
10. Important structural changes should generate a gridbot_reports note.
11. Browser testing must compare V6 against the relevant V5 baseline.
12. If uncertain, stop and refer to /PHILOSOPHY.md and the V6 docs.
```

## Recommended next work

Immediate next work should be validation, not feature expansion.

```text
1. Manually open the V6 launcher.
2. Open all 4 V6 apps.
3. Compare the cable geometry visualiser against the V5 original.
4. Confirm export JSON and copy snapshot still work.
5. Add a testing phase label to the V6 launcher page if desired.
```

After manual validation:

```text
1. Phase 2 cable geometry cleanup may begin.
2. Add clearer module level comments inside each cable geometry JS file.
3. Consider renaming internal V5 file names only as a separate approved feature.
4. Leave the GIS SLD financial sandbox untouched until its own feature scope is defined.
```

## Strategic meaning

V6 is not just a folder copy.

It is the beginning of the controlled transition from a working toolset into a maintainable operating system model.

```text
V5 proves the working truth.
V6 creates the workshop.
Docs preserve the doctrine.
GridBot and Python perform controlled changes.
Vikram approves what becomes part of the system.
```
