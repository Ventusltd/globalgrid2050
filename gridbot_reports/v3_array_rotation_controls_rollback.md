# V3 Array Rotation Controls Rollback Log

UTC created: 2026-05-17

Purpose:
Add V3 only array rotation controls so the generated array can be rotated in 30 degree or 90 degree steps while the point of connection remains fixed. The export cable length recalculates after rotation. Custom cable waypoints are cleared when rotation changes because the customer substation moves with the rotated array.

Touched files:

1. solar-bess-topology-v3/gis-sld-v3-state.js
2. solar-bess-topology-v3/gis-sld-v3-drawing.js
3. solar-bess-topology-v3/gis-sld-v3-ui.js
4. gridbot_reports/v3_array_rotation_controls_rollback.md

Commits:

1. a3c82128fe6a772dc74dca155121429b5a1a3f09
   Message: Add V3 array rotation state
   File: solar-bess-topology-v3/gis-sld-v3-state.js

2. a193879757931e7f008582dd923e5799f0c515de
   Message: Add V3 array rotation geometry
   File: solar-bess-topology-v3/gis-sld-v3-drawing.js

3. 38a4408fdc1039498fc4d283a7858169408c4177
   Message: Add V3 array rotation controls
   File: solar-bess-topology-v3/gis-sld-v3-ui.js

Rollback method:

Use GitHub revert for commits 38a4408fdc1039498fc4d283a7858169408c4177, a193879757931e7f008582dd923e5799f0c515de and a3c82128fe6a772dc74dca155121429b5a1a3f09, in that order.

Expected behaviour after rollback:

V3 returns to the previous behaviour with pick up array, waypoint routing and dynamic export cable length, but without array rotation controls.

Test checklist after install:

1. Open https://globalgrid2050.com/solar-bess-topology-v3/
2. Draw a grid.
3. Confirm Array Rotation shows 0 degrees.
4. Click Rotate Right 30 degrees and confirm the generated array rotates.
5. Click Rotate Left 30 degrees and confirm it returns.
6. Click Rotate 90 degrees and confirm the generated array turns by 90 degrees.
7. Confirm the point of connection remains fixed.
8. Confirm the export cable redraws and Live Export Cable Length updates.
9. Confirm internal 33kV radial lines remain orderly and do not fan incorrectly.
10. Confirm Reset Rotation returns the array to 0 degrees.
11. Confirm V2 remains unchanged at https://globalgrid2050.com/solar-bess-topology-v2/
