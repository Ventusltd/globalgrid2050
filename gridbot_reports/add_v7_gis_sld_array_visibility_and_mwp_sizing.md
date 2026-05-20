# Add V7 GIS SLD Array Visibility And MWp Sizing

UTC created: 2026-05-20T20:43:10.437450+00:00

## Purpose

Add an array visibility toggle and target MWp DC sizing helper to the V7 GIS SLD map workflow.

## Behaviour

- ARRAY ON/OFF hides or shows the generated topology layers so users can explore the map cleanly.
- String mode target MWp adjusts whole skids and 33 kV ring count.
- Central mode target MWp adjusts whole central inverter/skid/ring count.
- Module rating, modules per string, strings per inverter, inverter ratings and central inverter DC input remain user controlled.
- Map overlay includes a compact MWp DC input and SIZE MWp button.

## Actions

- added ARRAY ON/OFF map toggle
- added string target DC MWp input
- added central target DC MWp input
- added map overlay MWp sizing control
- added arrayVisible state
- added array visibility and target MWp sizing functions
- synced map MWp input when switching tabs
- wired array toggle and MWp sizing controls
- preserved array visibility after redraw
- added CSS for array toggle and MWp sizing controls
- added static and maths test script

## Test

Run `python scripts/test_v7_gis_sld_array_sizing_math.py`.

## Manual acceptance test

1. Open V7 GIS SLD.
2. Draw an array.
3. Toggle ARRAY OFF and confirm the map can be explored without the generated array.
4. Toggle ARRAY ON and confirm the array returns.
5. In String mode, enter target MWp DC and confirm skids/rings update without changing modules per string.
6. In Central mode, enter target MWp DC and confirm central blocks/rings update without changing modules per string or central inverter DC input.
