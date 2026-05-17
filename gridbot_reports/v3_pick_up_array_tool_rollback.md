# V3 Pick Up Array Tool Rollback Log

UTC created: 2026-05-17

Purpose:
Add a V3 only map based tool that lets the generated array be picked up and placed elsewhere while the point of connection remains fixed. The customer substation, array boundary, BESS and internal 33kV radial topology move or regenerate as one consistent design at the new array centre. The export cable redraws from the fixed point of connection to the moved customer substation.

Touched files:

1. solar-bess-topology-v3/gis-sld-v3-state.js
2. solar-bess-topology-v3/gis-sld-v3-drawing.js
3. solar-bess-topology-v3/gis-sld-v3-ui.js
4. gridbot_reports/v3_pick_up_array_tool_rollback.md

Commits:

1. 345ca992b8b4823fcac6291d788f3ac33758d83e
   Message: Add V3 array move state
   File: solar-bess-topology-v3/gis-sld-v3-state.js

2. 563aa252507adc811a6643e29f711d28966ca168
   Message: Allow V3 array centre override while keeping grid point fixed
   File: solar-bess-topology-v3/gis-sld-v3-drawing.js

3. 6bdf5b26b76990a73196021894c1d99dc6041f4a
   Message: Add V3 pick up array controls
   File: solar-bess-topology-v3/gis-sld-v3-ui.js

4. 9f1acba028fc7fb9367ec14c00f9d1134d0840d5
   Message: Wire V3 pick up array map click placement
   File: solar-bess-topology-v3/gis-sld-v3-ui.js

Rollback method:

Use GitHub revert for commits 9f1acba028fc7fb9367ec14c00f9d1134d0840d5, 6bdf5b26b76990a73196021894c1d99dc6041f4a, 563aa252507adc811a6643e29f711d28966ca168 and 345ca992b8b4823fcac6291d788f3ac33758d83e, in that order.

Expected behaviour after rollback:

V3 returns to the previous modular behaviour where array placement is calculated from the point of connection and export cable extra length only. The pick up array controls and map click placement are removed.

Test checklist after install:

1. Open https://globalgrid2050.com/solar-bess-topology-v3/
2. Confirm the map loads.
3. Draw a grid.
4. Confirm the point of connection remains fixed.
5. Click Pick Up Array.
6. Click a new map location.
7. Confirm the generated array moves to the clicked location.
8. Confirm the export cable redraws to the fixed point of connection.
9. Confirm the internal 33kV radial spine remains stable and does not fan out.
10. Confirm Reset Array Location restores the calculated default array position.
11. Confirm V2 remains unchanged at https://globalgrid2050.com/solar-bess-topology-v2/
