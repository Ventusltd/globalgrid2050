# V3 Export Cable Waypoint Route Rollback Log

UTC created: 2026-05-17

Purpose:
Add a simple V3 only waypoint routing tool for the export cable. The point of connection remains fixed and the customer substation remains attached to the generated array. The user can click waypoints on the map to bend the export cable around roads, land boundaries or obstacles. The live cable length recalculates along the routed polyline.

Touched files:

1. solar-bess-topology-v3/gis-sld-v3-state.js
2. solar-bess-topology-v3/gis-sld-v3-drawing.js
3. solar-bess-topology-v3/gis-sld-v3-ui.js
4. gridbot_reports/v3_export_cable_waypoint_route_rollback.md

Commits:

1. c3bbf7962736f2074a4af6d5a8feaacf6091034f
   Message: Add V3 cable route waypoint state
   File: solar-bess-topology-v3/gis-sld-v3-state.js

2. 8c52a27764cfe1d10b8054904f08ae2a83c24c80
   Message: Route V3 export cable through waypoints
   File: solar-bess-topology-v3/gis-sld-v3-drawing.js

3. 45b8455e4a774bcdadd8b266e5562f3a5b5c836f
   Message: Add V3 export cable waypoint route controls
   File: solar-bess-topology-v3/gis-sld-v3-ui.js

Rollback method:

Use GitHub revert for commits 45b8455e4a774bcdadd8b266e5562f3a5b5c836f, 8c52a27764cfe1d10b8054904f08ae2a83c24c80 and c3bbf7962736f2074a4af6d5a8feaacf6091034f, in that order.

Expected behaviour after rollback:

V3 returns to the previous export cable behaviour: direct export cable line, dynamic length calculation and pick up array remain as previously installed, but custom waypoint cable routing is removed.

Test checklist after install:

1. Open https://globalgrid2050.com/solar-bess-topology-v3/
2. Draw a grid.
3. Confirm Live Export Cable Length shows a value.
4. Click Draw Cable Route.
5. Click several map points to create route waypoints.
6. Confirm the export cable bends through the waypoints.
7. Confirm Live Export Cable Length increases or changes as the routed path changes.
8. Click Finish Route to stop adding waypoints.
9. Click Clear Route to return to the direct cable route.
10. Confirm V2 remains unchanged at https://globalgrid2050.com/solar-bess-topology-v2/
