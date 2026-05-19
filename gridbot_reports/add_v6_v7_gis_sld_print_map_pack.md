# Add V6 V7 GIS SLD Print Map Pack

UTC created: 2026-05-19T18:52:01.193465+00:00

## Purpose

Add a proper GIS SLD map print pack: clean default layers, print preparation routine and 3 additional map figure pages after the normal report.

## Changes

- Atlas overhead line layers default to OFF.
- Public substations are forced OFF after load for a cleaner default map.
- Print button prepares the map before printing instead of calling window.print directly.
- Adds Map Figure 1: current project view.
- Adds Map Figure 2: wider grid and route context.
- Adds Map Figure 3: satellite context view.
- Restores the user's previous map state after snapshots are taken.

## Actions

- set Atlas overhead line layers default OFF in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- replaced direct window.print with print preparation routine in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- added GIS SLD print map pack JS in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- added GIS SLD print map pack CSS in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5.css
- set Atlas overhead line layers default OFF in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-map.js
- replaced direct window.print with print preparation routine in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- added GIS SLD print map pack JS in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- added GIS SLD print map pack CSS in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5.css

## Manual acceptance test

1. Open V6 or V7 GIS SLD.
2. Confirm overhead lines and public substations start OFF.
3. Turn layers ON and OFF manually to confirm toggles still work.
4. Press PRINT.
5. Confirm normal report prints first.
6. Confirm 3 full page map figures print near the bottom.
7. Confirm final map figure is satellite context.
