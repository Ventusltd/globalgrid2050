# Add V7 GIS SLD Large Asset Markers And Search

UTC created: 2026-05-21T19:15:28.264767+00:00

## Purpose

Make larger operating solar, wind and BESS sites easier to identify and add a map search box for operating sites and substations.

## Changes

- Operating solar sites above 30 MW are enlarged significantly.
- Operating BESS sites above 30 MW are enlarged significantly.
- Operating onshore and offshore wind sites above 30 MW are also made easier to see.
- Adds a GIS map search bar for operating assets and substations.
- Search can fly to a selected site or substation and open a popup.

## Actions

- added GIS map search UI
- increased operating solar, wind and BESS marker sizes above 30 MW
- added GIS site and substation search functions
- wired GIS map search on boot
- added GIS search CSS
- added static test script

## Manual acceptance test

1. Open V7 GIS SLD.
2. Turn on operating solar and confirm sites above 30 MW are much larger.
3. Search for a known operating solar site and confirm the map flies to it.
4. Search for a substation and confirm the map flies to it.
5. Confirm layer toggles still work.
