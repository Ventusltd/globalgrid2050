# V3 Topology Abstraction Layers Rollback Log

UTC created: 2026-05-17

Purpose:
Add GIS stage topology abstraction layers to V3 without turning the tool into a detailed IFC design package.

Feature scope:

1. String mode:
   - show string inverter symbols within each string substation block
   - calculate implied string inverter AC kVA from module rating, modules per string, strings per inverter and DC/AC ratio
   - add target string inverter kVA input
   - apply target kVA by updating strings per inverter

2. Central mode:
   - show central combiner box symbols within each central inverter block
   - calculate combiner box symbols from strings per combiner and central inverter assumptions

3. GIS abstraction only:
   - not a final cable schedule
   - not IFC design
   - not protection design
   - intended for early finance, topology and commercial scoping

Touched files:

1. solar-bess-topology-v3/gis-sld-v3-state.js
2. solar-bess-topology-v3/gis-sld-v3-drawing.js
3. solar-bess-topology-v3/gis-sld-v3-map.js
4. solar-bess-topology-v3/gis-sld-v3-ui.js
5. gridbot_reports/v3_topology_abstraction_layers_rollback.md

Commits:

1. 2381e2914e80e9c39d93e9ca92f7d3d393cfb65c
   Message: Add V3 topology abstraction layer state
   File: solar-bess-topology-v3/gis-sld-v3-state.js

2. 249c5fc287a6677184943451b796e74389bc937d
   Message: Add V3 string inverter and combiner GIS symbols
   File: solar-bess-topology-v3/gis-sld-v3-drawing.js

3. 53111bdc6bbb64af956c3f518007645ca660ab4a
   Message: Display V3 string inverter and combiner GIS layers
   File: solar-bess-topology-v3/gis-sld-v3-map.js

4. a487964012acbe16d96c3b152602b9d6a4502637
   Message: Add V3 topology abstraction controls
   File: solar-bess-topology-v3/gis-sld-v3-ui.js

Rollback method:

Use GitHub revert for commits a487964012acbe16d96c3b152602b9d6a4502637, 53111bdc6bbb64af956c3f518007645ca660ab4a, 249c5fc287a6677184943451b796e74389bc937d and 2381e2914e80e9c39d93e9ca92f7d3d393cfb65c, in that order.

Expected behaviour after rollback:

V3 returns to the previous map behaviour with array movement, rotation, routed export cable and live export cable length, but without string inverter or central combiner box GIS abstraction symbols.

Test checklist after install:

1. Open https://globalgrid2050.com/solar-bess-topology-v3/
2. Use String tab.
3. Draw grid.
4. Confirm green string inverter symbols appear inside string substation blocks.
5. Confirm Implied String Inverter kVA changes when module rating, modules per string, strings per inverter or DC/AC ratio changes.
6. Enter Target String Inverter kVA and click Apply kVA to Strings / Inverter.
7. Confirm Strings / Inverter changes and layout redraws.
8. Toggle Show string inverter symbols off and on.
9. Switch to Central tab and draw grid.
10. Confirm yellow central combiner box symbols appear inside central inverter blocks.
11. Change Strings / Combiner Box and confirm combiner box count changes.
12. Toggle Show central combiner box symbols off and on.
13. Confirm export cable, pick up array, rotation and live cable length still work.
14. Confirm V2 remains unchanged at https://globalgrid2050.com/solar-bess-topology-v2/
