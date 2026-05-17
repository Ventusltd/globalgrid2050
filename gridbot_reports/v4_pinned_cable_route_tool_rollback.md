# V4 Pinned Cable Route Tool Rollback Log

UTC created: 2026-05-17

Purpose:
Replace the V4 export cable waypoint workflow with a clearer pin based workflow inspired by the REPD Grid Atlas V8 measurement logic.

Atlas V8 reference logic used:

- earth radius constant: 6378.137 km
- haversine distance calculation for precise segment length
- click based point collection pattern
- rendered map geometry updated from stored coordinate arrays

New workflow:

1. Click Drop Cable Pins.
2. Click the map to place pseudo pylon / route pins.
3. Pins appear as orange markers.
4. Click Draw Cable Through Pins.
5. Export cable is rendered from customer substation to pins to point of connection.
6. Live Export Cable Length is calculated using Atlas style haversine maths.
7. Pins turn committed in the route.
8. Undo Last Pin removes the latest pin before route commitment.
9. Clear Pins and Route resets to direct export cable.

Touched files:

1. solar-bess-topology-v4/gis-sld-v4-state.js
2. solar-bess-topology-v4/gis-sld-v4-drawing.js
3. solar-bess-topology-v4/gis-sld-v4-map.js
4. solar-bess-topology-v4/gis-sld-v4-ui.js
5. gridbot_reports/v4_pinned_cable_route_tool_rollback.md

Commits:

1. 1e769628825838d9bca2938caac59369335bf3fe
   Message: Add V4 cable route pin state

2. 7484b37f9e58869f599d0b4fe373738e5553f98e
   Message: Add V4 atlas style pinned cable route geometry

3. d6156739379eb823c2a3d4ca275cc486a5b792d9
   Message: Add V4 export cable pin map layer

4. ab55ef164754e92d8b814ad69a14ac871d484902
   Message: Replace V4 waypoint cable routing with pin route workflow

Rollback method:

Revert the above commits in reverse order if the pin workflow breaks the V4 app:

1. ab55ef164754e92d8b814ad69a14ac871d484902
2. d6156739379eb823c2a3d4ca275cc486a5b792d9
3. 7484b37f9e58869f599d0b4fe373738e5553f98e
4. 1e769628825838d9bca2938caac59369335bf3fe

Expected behaviour after rollback:

The previous waypoint route workflow should return.

Test checklist:

1. Open https://globalgrid2050.com/solar-bess-topology-v4/
2. Draw a grid.
3. Click Drop Cable Pins.
4. Click 2 or 3 route points on the map.
5. Confirm orange pins appear.
6. Confirm cable remains direct before Draw Cable Through Pins is clicked.
7. Click Draw Cable Through Pins.
8. Confirm export cable bends through the pins.
9. Confirm Live Export Cable Length updates to 3 decimal places.
10. Click Undo Last Pin and check route resets to not committed.
11. Click Draw Cable Through Pins again.
12. Click Clear Pins and Route and confirm direct cable returns.
13. Test Pick Up Array and confirm pins clear because the customer substation moves.
14. Test Rotate Array and confirm pins clear because the route geometry has changed.

Known limits:

- Pins are not yet draggable.
- Pins do not yet snap to roads, 132 kV, 400 kV or rights of way.
- This is a hyper precise measurement workflow, not yet an automatic routing engine.
- Future work should add pin dragging, snapping and optional infrastructure layer visibility.
