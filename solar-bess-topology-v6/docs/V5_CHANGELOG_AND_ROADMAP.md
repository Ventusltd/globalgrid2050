# GlobalGrid2050 V6 Change Record and Roadmap

UTC created: 2026-05-17T15:58:06.671160+00:00

## Purpose

V5 is cloned from the stabilised V4 application so V4 can remain available for users while future development continues in a separate working version.

V4 is now the public user baseline. V5 is the development track.

## V3 baseline

V3 was the first serious modular version of the GIS SLD Financial Sandbox. It separated the application into HTML, CSS and multiple JavaScript files. It established map display, substation reference data, string inverter topology, central inverter topology, technical quantity outputs, logistics estimates, baseline project economics, GeoJSON export and the separate physical module layout page.

## What changed in V4

V4 was created by cloning V3 into a new folder and renaming the main files and references from V3 to V4. V4 then became a separate deployable version. It retained the modular structure but added stronger project qualification language, expanded Financial Model Logic, a detailed screening disclaimer, a stronger GeoJSON export note and a CSS fix so the cyan explainer box could display the long disclaimer properly.

## Why V4 changed

The sandbox had moved beyond a visual prototype. It now combines land, grid proximity, topology, cable assumptions, BESS assumptions, CAPEX, revenue and exportable GIS context. That means users need clear boundaries. V4 explains that the tool is for early stage screening and learning, not construction design, grid approval, EPC pricing, financial advice or bankable technical due diligence.

## Possible V5 projects

1. Add a V5 development badge and a link back to stable V4.
2. Make long explainer and disclaimer sections collapsible.
3. Add scenario save and load using JSON.
4. Improve cashflow, profit and risk adjusted financial terminology.
5. Add project comparison mode.
6. Improve BESS modelling.
7. Add clearer cable loss and cable route cost assumptions.
8. Improve GeoJSON export structure.
9. Add CSV export.
10. Add report export.
11. Add public data source provenance notes.
12. Add validation warnings for unusual engineering or financial assumptions.
13. Use GridBot feature manifests for all future V5 changes.

## Governance principle

V4 remains stable for users. V5 is where new ideas are tested, documented and only later promoted when useful, stable and approved.
