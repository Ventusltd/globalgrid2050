# V3 Module Layout App Rollback Log

UTC created: 2026-05-17

Purpose:
Create a separate V3 app for physical solar module layout visualisation without touching or risking the main GIS SLD Financial Sandbox V3 app.

New app files:

1. solar-bess-topology-v3/module-layout-v3.html
2. solar-bess-topology-v3/module-layout-v3.css
3. solar-bess-topology-v3/module-layout-v3.js
4. gridbot_reports/v3_module_layout_app_rollback.md

Shared core:

The module layout app reuses the same public libraries and V3 core support files:

- MapLibre GL JS
- Turf.js
- gis-sld-v3-config.js
- gis-sld-v3-helpers.js
- gis-sld-v3.css as a base style file

It does not import the main V3 state, drawing, finance, map, UI or calculation modules. This avoids breaking the main GIS finance app.

Feature scope:

- separate physical module layout app
- draw at map centre
- pick site on map
- total module count input
- module width and height input
- portrait or landscape orientation
- modules per row input
- row pitch input
- module gap input
- array rotation input
- rendered module rectangles at higher zoom
- boundary footprint calculation
- width, length and hectare output
- satellite toggle
- zoom to layout

Important limitations:

- not an EPC design drawing
- not a shading study
- not a cable schedule
- not structural design
- not row to row terrain analysis
- not IFC output
- designed as physical GIS visualisation only

Commits:

1. e38275d9c0d19023e2b0405a5c12892a214b9c41
   Message: Add V3 module layout app HTML
   File: solar-bess-topology-v3/module-layout-v3.html

2. f344d0e1117fdca816aed67ee07c43c044a32cfc
   Message: Add V3 module layout app CSS
   File: solar-bess-topology-v3/module-layout-v3.css

3. 83b3139e8ea389962058b95ee3cb16d062fd516e
   Message: Add V3 module layout app JavaScript
   File: solar-bess-topology-v3/module-layout-v3.js

Rollback method:

Delete the 3 new app files if required:

- solar-bess-topology-v3/module-layout-v3.html
- solar-bess-topology-v3/module-layout-v3.css
- solar-bess-topology-v3/module-layout-v3.js

Or use GitHub revert for commits 83b3139e8ea389962058b95ee3cb16d062fd516e, f344d0e1117fdca816aed67ee07c43c044a32cfc and e38275d9c0d19023e2b0405a5c12892a214b9c41, in that order.

Expected behaviour after rollback:

The main GIS SLD V3 app remains unaffected either way because the module layout app is separate.

Test checklist:

1. Open https://globalgrid2050.com/solar-bess-topology-v3/module-layout-v3.html
2. Confirm map loads.
3. Click Draw at Map Centre.
4. Confirm module boundary appears.
5. Zoom in and confirm module rectangles appear.
6. Change portrait to landscape and confirm footprint changes.
7. Change module count and modules per row and confirm result outputs update.
8. Click Pick Site on Map and place the layout elsewhere.
9. Click Satellite View and confirm imagery appears.
10. Confirm the main app still works at https://globalgrid2050.com/solar-bess-topology-v3/
