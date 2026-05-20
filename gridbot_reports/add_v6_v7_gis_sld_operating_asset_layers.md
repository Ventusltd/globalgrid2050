# Add V6 V7 GIS SLD Operating Asset Layers

UTC created: 2026-05-20T00:07:07.651145+00:00

## Purpose

Add existing operating solar, wind and battery project context layers from Atlas V8 into the GIS SLD app before drawing new array logic.

## Layers added

- Solar PV operational projects
- Onshore wind operational projects
- Offshore wind operational projects
- Battery storage operational projects

## Source logic

The layers use the existing Atlas V8 REPD master data filters from `/dist/repd_master.json`.

## Actions

- added operating asset visibility state in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- added operating asset layers in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- added operating asset popup handler in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- wired operating asset click handlers in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- added operating asset toggle buttons in solar-bess-topology-v6/gis-sld-financial-sandbox/index.html
- added operating asset toggle UI functions in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- wired operating asset toggle buttons in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- added operating asset legend item function in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js
- added operating asset legend entries in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js
- added operating asset toggle CSS in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5.css
- added operating asset visibility state in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-map.js
- added operating asset layers in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-map.js
- added operating asset popup handler in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-map.js
- wired operating asset click handlers in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-map.js
- added operating asset toggle buttons in solar-bess-topology-v7/gis-sld-financial-sandbox/index.html
- added operating asset toggle UI functions in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- wired operating asset toggle buttons in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- added operating asset legend item function in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js
- added operating asset legend entries in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js
- added operating asset toggle CSS in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5.css

## Manual acceptance test

1. Open V6 or V7 GIS SLD.
2. Confirm new asset toggle row appears below voltage toggles.
3. Confirm all new asset toggles default OFF.
4. Toggle each layer ON and OFF.
5. Confirm visible asset points appear and can be clicked for popup context.
6. Confirm drawing a new array still works.
