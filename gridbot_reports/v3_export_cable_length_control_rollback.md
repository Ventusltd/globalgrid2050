# V3 Export Cable Length Control Rollback Log

UTC created: 2026-05-17

Purpose:
Add a safe V3 only control that changes the distance between the point of connection and the generated array without rotating the array, changing the array bearing, changing lateral position or altering the internal 33kV radial topology.

Touched files:

1. solar-bess-topology-v3/gis-sld-v3-drawing.js
2. solar-bess-topology-v3/gis-sld-v3-ui.js
3. gridbot_reports/v3_export_cable_length_control_rollback.md

Commits:

1. 8989e487ffdec5eb3cc5b6ba6690a9b75337a4c0
   Message: Add safe V3 export cable length adjustment
   File: solar-bess-topology-v3/gis-sld-v3-drawing.js

2. 8702b01585275833edf36681a52c7ed811137bc6
   Message: Add safe V3 export cable length control UI
   File: solar-bess-topology-v3/gis-sld-v3-ui.js

Rollback method:

Use GitHub revert for commits 8702b01585275833edf36681a52c7ed811137bc6 and 8989e487ffdec5eb3cc5b6ba6690a9b75337a4c0, in that order.

Expected behaviour after rollback:

V3 returns to the previous modular behaviour where the array is placed at the default offset from the selected grid node and the export cable length is not user adjustable.

Test checklist after install:

1. Open https://globalgrid2050.com/solar-bess-topology-v3/
2. Confirm the map loads.
3. Confirm the Grid Connection Length panel appears above Draw Neat Grid.
4. Draw a grid.
5. Increase Export Cable Extra Length km and confirm the whole array moves further away from the point of connection.
6. Reduce Export Cable Extra Length km and confirm the whole array moves closer.
7. Confirm the internal 33kV radial spine remains unchanged and does not fan out from the customer substation.
8. Confirm V2 remains unchanged at https://globalgrid2050.com/solar-bess-topology-v2/
