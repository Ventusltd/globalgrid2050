# Fix V6 V7 GIS SLD Print Simple Safe

UTC created: 2026-05-19T22:56:19.497963+00:00

## Purpose

Fix print getting stuck on PREPARING by removing the asynchronous print preparation routine and restoring immediate browser print.

## Changes

- Print button calls `window.print()` directly again.
- Public substations default OFF.
- Atlas overhead line layers default OFF.
- Previous print map pack output is hidden in print.
- Live map prints as one large A4 portrait figure after the report.

## Actions

- set public substations default OFF in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-state.js
- Atlas overhead lines already default OFF in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- restored simple print event in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- disabled print pack autorun in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- added simple safe print CSS in solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5.css
- set public substations default OFF in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-state.js
- Atlas overhead lines already default OFF in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-map.js
- restored simple print event in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- disabled print pack autorun in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- added simple safe print CSS in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5.css

## Manual acceptance test

1. Open V6 or V7 GIS SLD.
2. Confirm SUBS default OFF and overhead line buttons default OFF.
3. Press PRINT.
4. Confirm browser print opens immediately.
5. Confirm map prints as a large figure and is not stuck on PREPARING.
