# Replace V7 GIS SLD Asset Buttons With Pipeline Dropdown Status

UTC created: 2026-05-21T20:08:04.539560+00:00

## Purpose

Replace asset buttons with compact filters for technology, project status and MW capacity range.

## Behaviour

- Uses Atlas V8 REPD master data across pipeline statuses.
- Technology selector: OFF, all technologies, Solar PV, BESS, Onshore wind, Offshore wind.
- Status selector: all statuses, operational, under construction, awaiting construction, planning approved, planning submitted, refused and withdrawn.
- Capacity selector: min MW and max MW.
- Marker sizes are restrained again.

## Actions

- added compact technology dropdown, status dropdown and MW range controls
- added asset filtering by technology, status and MW range
- normalised asset marker radius expressions: 4
- removed operational only base filters so status dropdown controls status selection
- added status aware asset dropdown UI functions
- wired status aware asset dropdown
- added status dropdown CSS
- added static test script

## Test

Run `python scripts/test_v7_gis_sld_asset_pipeline_dropdown_status.py`.

## Manual acceptance test

1. Open V7 GIS SLD.
2. Select Solar PV and Operational.
3. Enter min 30 MW and apply.
4. Change status to Under construction and apply.
5. Repeat with BESS, Onshore wind and Offshore wind.
6. Confirm marker sizes are readable, not oversized.
