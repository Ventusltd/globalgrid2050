# Add V7 GIS SLD Site Intelligence Panel

UTC created: 2026-05-21T19:51:37.915179+00:00

## Purpose

Add a click driven site intelligence panel that turns map geometry into structured early stage screening context.

## Behaviour

- Click the map to inspect the location.
- Shows nearest operating solar, BESS, onshore wind and offshore wind assets.
- Shows nearest public substation reference point.
- Shows nearest 66 kV, 132 kV, 275 kV and 400 kV Atlas V8 grid corridors.
- Provides simple screening notes based on nearby asset and grid context.
- Clearly states that results are indicative screening only.

## Actions

- added site intelligence panel HTML
- added site intelligence JavaScript
- wired site intelligence panel
- added site intelligence CSS
- added static test script

## Test

Run `python scripts/test_v7_gis_sld_site_intelligence_panel.py`.

## Manual acceptance test

1. Open V7 GIS SLD.
2. Click the map away from buttons.
3. Confirm Site Intelligence panel opens.
4. Confirm nearest assets, substation and voltage corridors show distances.
5. Close the panel with ×.
6. Confirm existing map tools, toggles and drawing still work.
