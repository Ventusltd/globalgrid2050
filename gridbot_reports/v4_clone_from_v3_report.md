# V4 Clone from V3 Report

UTC created: 2026-05-17T07:42:42.499372+00:00

Purpose:
Clone the current V3 application into a separate V4 folder so V3 becomes the safety baseline and future development can continue in V4.

Source:
solar-bess-topology-v3/

Destination:
solar-bess-topology-v4/

Main V4 test URLs after GitHub Pages deploy:

https://globalgrid2050.com/solar-bess-topology-v4/
https://globalgrid2050.com/solar-bess-topology-v4/indexforgis-sld-v4.html
https://globalgrid2050.com/solar-bess-topology-v4/module-layout-v4.html

Files cloned:

- solar-bess-topology-v4/gis-sld-v4-calculations.js
- solar-bess-topology-v4/gis-sld-v4-config.js
- solar-bess-topology-v4/gis-sld-v4-drawing.js
- solar-bess-topology-v4/gis-sld-v4-export.js
- solar-bess-topology-v4/gis-sld-v4-finance.js
- solar-bess-topology-v4/gis-sld-v4-helpers.js
- solar-bess-topology-v4/gis-sld-v4-map.js
- solar-bess-topology-v4/gis-sld-v4-state.js
- solar-bess-topology-v4/gis-sld-v4-substations.js
- solar-bess-topology-v4/gis-sld-v4-ui-core.js
- solar-bess-topology-v4/gis-sld-v4-ui.js
- solar-bess-topology-v4/gis-sld-v4.css
- solar-bess-topology-v4/index.html
- solar-bess-topology-v4/indexforgis-sld-v4.html
- solar-bess-topology-v4/module-layout-v4.css
- solar-bess-topology-v4/module-layout-v4.html
- solar-bess-topology-v4/module-layout-v4.js

Renamed files:

- indexforgis-sld-v3.html -> indexforgis-sld-v4.html
- gis-sld-v3-config.js -> gis-sld-v4-config.js
- gis-sld-v3-helpers.js -> gis-sld-v4-helpers.js
- gis-sld-v3-state.js -> gis-sld-v4-state.js
- gis-sld-v3-substations.js -> gis-sld-v4-substations.js
- gis-sld-v3.css -> gis-sld-v4.css
- gis-sld-v3-map.js -> gis-sld-v4-map.js
- gis-sld-v3-calculations.js -> gis-sld-v4-calculations.js
- gis-sld-v3-finance.js -> gis-sld-v4-finance.js
- gis-sld-v3-ui-core.js -> gis-sld-v4-ui-core.js
- gis-sld-v3-drawing.js -> gis-sld-v4-drawing.js
- gis-sld-v3-export.js -> gis-sld-v4-export.js
- gis-sld-v3-ui.js -> gis-sld-v4-ui.js
- module-layout-v3.html -> module-layout-v4.html
- module-layout-v3.css -> module-layout-v4.css
- module-layout-v3.js -> module-layout-v4.js

Files with V3 to V4 text references updated:

- solar-bess-topology-v4/indexforgis-sld-v4.html
- solar-bess-topology-v4/index.html
- solar-bess-topology-v4/gis-sld-v4-substations.js
- solar-bess-topology-v4/module-layout-v4.html
- solar-bess-topology-v4/gis-sld-v4-config.js
- solar-bess-topology-v4/gis-sld-v4-helpers.js
- solar-bess-topology-v4/gis-sld-v4-state.js

Rollback method:

Delete solar-bess-topology-v4/ and this report if the clone is not wanted. V3 is not changed by this clone operation.

Validation checklist:

1. Open the V4 main app URL.
2. Confirm the map loads.
3. Confirm String and Central tabs work.
4. Draw a grid.
5. Test export cable length, pick up array, rotation and waypoint routing.
6. Open module-layout-v4.html and test physical module layout.
7. Confirm V3 remains unchanged.
