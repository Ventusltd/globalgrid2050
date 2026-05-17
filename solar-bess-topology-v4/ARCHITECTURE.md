# GlobalGrid2050 V4 Application Architecture

This file documents the current V4 architecture for the app served from:

- `https://globalgrid2050.com/solar-bess-topology-v4/`
- `https://globalgrid2050.com/solar-bess-topology-v4/indexforgis-sld-v4.html`
- `https://globalgrid2050.com/solar-bess-topology-v4/module-layout-v4.html`

V4 is now the active development branch of the GIS SLD Financial Sandbox. V3 remains the safety baseline.

---

## 1. Site map

```text
solar-bess-topology-v4/
|
|-- index.html
|   Redirects browser users to indexforgis-sld-v4.html
|
|-- indexforgis-sld-v4.html
|   Main GIS SLD Financial Sandbox V4
|   Used for grid node selection, solar and BESS layout, export cable routing, array rotation and finance screening
|
|-- module-layout-v4.html
|   Separate physical module layout app
|   Used for module count, portrait or landscape layout, row pitch, module gap and physical footprint visualisation
|
|-- ARCHITECTURE.md
|   This architecture and interdependency map
|
|-- gis-sld-v4.css
|   Main GIS SLD app stylesheet and shared visual base
|
|-- module-layout-v4.css
|   Separate stylesheet for the module layout app
|
|-- gis-sld-v4-config.js
|   Shared constants and data source URLs
|
|-- gis-sld-v4-helpers.js
|   Shared DOM, parsing, money, debounce and status helper functions
|
|-- gis-sld-v4-state.js
|   Main GIS SLD app state object
|
|-- gis-sld-v4-substations.js
|   Substation dataset loading and normalisation
|
|-- gis-sld-v4-map.js
|   Main MapLibre map initialisation, sources, layers and map click handlers
|
|-- gis-sld-v4-calculations.js
|   Solar hierarchy, capacity, logistics and physical area calculations
|
|-- gis-sld-v4-finance.js
|   Revenue, CAPEX, BESS value and development finance calculations
|
|-- gis-sld-v4-ui-core.js
|   Summary, legend, selected substation display and benchmark rendering
|
|-- gis-sld-v4-drawing.js
|   GeoJSON topology generation, array geometry, export cable, BESS and 33 kV radial drawing
|
|-- gis-sld-v4-export.js
|   GeoJSON export logic and export metadata enrichment
|
|-- gis-sld-v4-ui.js
|   UI events, tab switching, search, array movement, rotation and cable route controls
|
|-- module-layout-v4.js
|   Separate physical module layout app logic
```

---

## 2. Main app purpose

`indexforgis-sld-v4.html` is the main GIS and finance control surface.

Its purpose is not final EPC design. It is a pre EPC commercial and technical screening app that allows a user to:

- select or search around a location
- load public substation reference points
- select a point of connection
- generate a solar and BESS topology
- move the array while keeping the point of connection fixed
- rotate the array in controlled increments
- route the export cable through user clicked waypoints
- calculate live export cable length
- compare string and central inverter architecture assumptions
- calculate DC capacity, AC capacity, module count, land take and logistics
- run early finance screening using £/Wp assumptions
- export a GeoJSON file with technical and financial metadata

---

## 3. Separate module layout app purpose

`module-layout-v4.html` is intentionally separate from the main GIS finance app.

Its purpose is to test physical module footprint without risking the main app. It currently supports:

- total module count
- module width and height
- portrait or landscape orientation
- modules per row
- row pitch
- module gap
- array rotation
- draw at map centre
- pick site on map
- satellite view
- zoom to layout
- physical module rectangles at higher zoom
- footprint width, length and area in hectares

Future development should turn this into a mounting structure geometry engine, but it must remain separate until the maths is stable.

---

## 4. Main app script load order

The main app depends on a strict load order.

The top of `indexforgis-sld-v4.html` loads external libraries first:

```text
MapLibre GL JS
Turf.js
```

Then early local scripts:

```text
gis-sld-v4-config.js
gis-sld-v4-helpers.js
gis-sld-v4-state.js
gis-sld-v4-substations.js
```

Then the HTML body creates the left control panel and the right map panel.

At the bottom of the file, the modular app scripts load:

```text
gis-sld-v4-map.js
gis-sld-v4-calculations.js
gis-sld-v4-finance.js
gis-sld-v4-ui-core.js
gis-sld-v4-drawing.js
gis-sld-v4-export.js
gis-sld-v4-ui.js
```

`gis-sld-v4-ui.js` is the final boot module. It wires the controls, calls `initMap()` and starts the app.

---

## 5. Main dependency graph

```text
indexforgis-sld-v4.html
|
|-- external libraries
|   |-- MapLibre GL JS
|   |-- Turf.js
|
|-- gis-sld-v4-config.js
|   |-- defines SUBSTATIONS_URL
|   |-- defines CONSTANTS
|
|-- gis-sld-v4-helpers.js
|   |-- depends on DOM availability for runtime use
|   |-- exposes $, num, intVal, checked, setText, money, debounce, pickProp, setFetchStatus
|
|-- gis-sld-v4-state.js
|   |-- defines global state object
|
|-- gis-sld-v4-substations.js
|   |-- depends on config, helpers and global map variable at runtime
|   |-- exposes normaliseSubstations and loadSubstations
|
|-- gis-sld-v4-map.js
|   |-- depends on MapLibre, Turf, CONSTANTS, state, helpers and substation loader
|   |-- creates global map variable
|   |-- creates map sources and layers
|   |-- calls loadSubstations, updateLegend and recalcAll after map load
|
|-- gis-sld-v4-calculations.js
|   |-- depends on helpers and state.activeTab
|   |-- exposes computeStats, computeStringStats and computeCentralStats
|
|-- gis-sld-v4-finance.js
|   |-- depends on helpers, state and computeStats outputs
|   |-- exposes computeFinance, renderFinance, renderFinanceWarnings and applyDevelopmentStageDefaults
|   |-- migrates development finance fields to £/Wp labels and defaults at DOMContentLoaded
|
|-- gis-sld-v4-ui-core.js
|   |-- depends on helpers, state and computeStats outputs
|   |-- renders summary, benchmark, legend and selected grid node display
|
|-- gis-sld-v4-drawing.js
|   |-- depends on Turf, map, state, CONSTANTS, helpers, computeStats, computeFinance and render functions
|   |-- creates current GeoJSON topology
|   |-- writes to map source `topology`
|
|-- gis-sld-v4-export.js
|   |-- depends on state, computeStats and computeFinance
|   |-- exports current topology plus metadata to GeoJSON
|
|-- gis-sld-v4-ui.js
    |-- depends on all previous modules
    |-- injects extra controls
    |-- wires event listeners
    |-- boots the app
```

---

## 6. Data flow in the main GIS SLD app

```text
User changes input
|
|-- gis-sld-v4-ui.js catches input or change event
|   |
|   |-- recalcDebounced or computeAndDraw
|       |
|       |-- gis-sld-v4-calculations.js calculates physical and electrical stats
|       |   |-- DC megawatts peak
|       |   |-- AC megawatts
|       |   |-- module count
|       |   |-- block count
|       |   |-- land take
|       |   |-- logistics
|       |
|       |-- gis-sld-v4-finance.js calculates finance
|       |   |-- revenue
|       |   |-- CAPEX
|       |   |-- BESS value
|       |   |-- development finance
|       |   |-- warnings
|       |
|       |-- gis-sld-v4-drawing.js builds GeoJSON
|       |   |-- point of connection
|       |   |-- customer substation
|       |   |-- export cable
|       |   |-- optional route waypoints
|       |   |-- array boundary
|       |   |-- string or central blocks
|       |   |-- BESS compound
|       |   |-- 33 kV radial trunk and branches
|       |
|       |-- gis-sld-v4-map.js renders GeoJSON layers
|       |
|       |-- gis-sld-v4-ui-core.js updates technical summary and legend
```

---

## 7. Core state object

The global `state` object is the central memory of the main GIS app.

It currently stores:

```text
activeTab
currentGeoJSON
activeDrawCenter
selectedSubstation
subsVisible
satActive
activePopup
lastStats
lastFinance
arrayMoveMode
arrayOverrideCenter
arrayRotationDeg
exportCableLengthKm
cableRouteMode
cableRouteWaypoints
```

Important rules:

- `activeDrawCenter` is the fixed grid point or point of connection.
- `arrayOverrideCenter` moves the array without moving the point of connection.
- `arrayRotationDeg` rotates the array geometry.
- `exportCableLengthKm` is calculated from the actual export cable GeoJSON line.
- `cableRouteWaypoints` bends the export cable between customer substation and point of connection.
- `currentGeoJSON` is the single source used by the map and export function.

---

## 8. Map layers

The main app creates one substation source and one generated topology source.

```text
src-subs
|-- l-subs
    Public substation reference points

topology
|-- overall_boundary_fill
|-- overall_boundary_line
|-- footprints
|-- footprints_outline
|-- export_cable
|-- radial_spine
|-- inverters
|-- substation
```

Generated topology feature types include:

```text
array_boundary
skid_footprint
central_footprint
bess_footprint
export_cable
33kv_radial
string_substation
central_inverter
bess_compound
poi
private_sub
export_cable_waypoint
```

Known rule:

- `export_cable` is red dashed and represents the route from customer substation to point of connection.
- `33kv_radial` is cyan and represents internal collector topology.
- `poi` is the public grid point.
- `private_sub` is the customer substation.

---

## 9. Geometry model

The geometry engine is in `gis-sld-v4-drawing.js`.

Important geometry functions:

```text
normBearing
getArrayAxisDeg
getRectPolygon
getBlockAspect
getExportCableExtraKm
buildExportCableLine
addCableRouteWaypointMarkers
computeAndDraw
```

Geometry principles:

- Turf is used for geodesic point projection and distance.
- Array blocks are generated as rotated polygons.
- The point of connection stays fixed.
- The array can be moved independently by storing `arrayOverrideCenter`.
- The array can rotate by changing `arrayRotationDeg`.
- The customer substation moves with the array.
- The export cable is rebuilt from the customer substation to point of connection.
- User route waypoints are inserted between those two fixed endpoints.
- Export cable length is calculated from the final GeoJSON line using Turf length.

---

## 10. 33 kV radial model

The current 33 kV collector model is still an abstraction.

Current behaviour:

- each generated inverter or block has a branch line
- a clipped visible collector trunk is drawn from the customer substation into the array
- the visible trunk is clipped to the furthest inverter projection
- this avoids the earlier ghost line beyond the customer substation

Current limitation:

The model is not yet a full cable feeder design. It does not yet properly model:

- multiple named feeders
- ring open points
- feeder grouping
- feeder section cable sizes
- circuit current by feeder
- feeder loss by section
- protection zones
- final route engineering

Next correct development step is not low level inverter symbols. It is a stronger feeder and cable section model.

---

## 11. Calculations model

`gis-sld-v4-calculations.js` calculates the physical and electrical project summary.

String architecture uses:

```text
Module rating
Module length and width
Mounting GCR
Gross site factor
Modules per string
Strings per inverter
Inverters per substation
Substations per ring
33 kV rings
Module logistics
Spare allowance
```

Central architecture uses:

```text
Module rating
Module length and width
Mounting GCR
Gross site factor
Central inverter AC rating
DC/AC ratio
Modules per string
Strings per combiner box
Central inverters per MV station
MV stations per 33 kV ring
33 kV rings
Module logistics
Spare allowance
```

Core outputs:

```text
total_blocks
block_ground_area_m2
dc_mwp
ac_mw
module_count
net_mod_area_m2
net_array_area_m2
gross_site_area_m2
pallets
containers
modules_inc_spares
combiner_boxes_per_inverter
total_combiner_boxes
```

---

## 12. Finance model

`gis-sld-v4-finance.js` calculates:

```text
solar revenue
BESS revenue
25 year revenue
35 year revenue
OPEX
CAPEX
CAPEX per Wp
25 year surplus
35 year surplus
development capital at risk
module supply cost
EPC cost
owner cost
grid connection cost
total build cost
target exit value
operating asset NPV
gross development margin
risk adjusted development value
development return multiple
warnings
```

V4 finance units:

```text
Development Cost: £/Wp
Module Supply Cost: £/Wp
EPC Cost: £/Wp
Other Owner Costs: £/Wp
Grid Connection Cost: £/Wp
Target Exit Value: £/Wp
Operating Asset NPV: £/Wp
```

BESS units intentionally remain:

```text
BESS Power: MW
BESS Energy: MWh
BESS CAPEX: £/MWh
BESS Revenue per MWh: £/MWh
BESS Efficiency: percent
```

Important note:

The finance model is a screening tool. It is not a full discounted cash flow model, formal valuation, investment advice or EPC quotation.

---

## 13. Export model

`gis-sld-v4-export.js` exports the current topology to GeoJSON.

Export includes:

```text
GeoJSON geometry
selected grid node metadata
module and area assumptions
logistics assumptions
string or central topology inputs
DC and AC capacity
finance assumptions
BESS assumptions
loss assumptions
warning note
```

Current issue to clean later:

Some export field names still contain legacy wording such as `_gbp_mw` or `_gbp_mwp`. The calculation now uses £/Wp, so the export keys should be renamed in a future clean up to avoid semantic mismatch.

Recommended future names:

```text
fin_development_cost_gbp_wp
fin_development_module_supply_cost_gbp_wp
fin_development_epc_cost_gbp_wp
fin_development_owner_cost_gbp_wp
fin_development_grid_connection_cost_gbp_wp
fin_development_exit_value_gbp_wp
fin_development_operating_npv_gbp_wp
fin_bess_revenue_per_mwh_gbp_mwh
```

---

## 14. UI control groups in main app

Main left panel contains:

```text
Location search
String tab
Central tab
Project economics panels
Selected grid node summary
Technical summary
Export button
```

Injected by `gis-sld-v4-ui.js` near the draw button:

```text
Live Export Cable Length
Array Rotation
Export Cable Extra Length
Rotate Left 30 degrees
Rotate Right 30 degrees
Rotate 90 degrees
Reset Rotation
Pick Up Array
Reset Array Location
Draw Cable Route
Finish Route
Clear Route
```

Right panel contains:

```text
Map
Substation visibility toggle
Satellite view toggle
Crosshair
Legend
```

---

## 15. Module layout app dependency graph

```text
module-layout-v4.html
|
|-- MapLibre GL JS
|-- Turf.js
|-- gis-sld-v4.css
|-- module-layout-v4.css
|-- gis-sld-v4-config.js
|-- gis-sld-v4-helpers.js
|-- module-layout-v4.js
```

The module layout app does not import:

```text
gis-sld-v4-state.js
gis-sld-v4-map.js
gis-sld-v4-calculations.js
gis-sld-v4-finance.js
gis-sld-v4-drawing.js
gis-sld-v4-export.js
gis-sld-v4-ui.js
```

This is deliberate. It isolates the physical module layout experiment from the main GIS finance app.

---

## 16. Module layout app data flow

```text
User enters module layout inputs
|
|-- module-layout-v4.js reads inputs
|   |
|   |-- calculates module orientation and row layout
|   |-- calculates physical width, length and area
|   |-- creates module boundary polygon
|   |-- creates individual module polygons up to render limit
|   |-- writes GeoJSON to module-layout map source
|   |-- updates results panel
```

Current render limit:

```text
6000 module polygons
```

Reason:

Rendering every module for very large utility scale layouts could slow the browser. Later versions should introduce zoom dependent clustering or table level abstraction.

---

## 17. External dependencies

```text
MapLibre GL JS
Turf.js
Carto Dark Matter basemap
Esri World Imagery raster tiles
Nominatim geocoding for search
/grid_substations.geojson public substation dataset
```

Operational risk:

If any external service changes, the app may still load but some features may fail. The app should eventually show clearer dependency status for:

```text
MapLibre
Turf
Substation dataset
Nominatim
Satellite tiles
```

---

## 18. Safe development rules for V4

1. V3 must remain untouched unless explicitly requested.
2. V4 is now the active development copy.
3. Large changes should be made one feature at a time.
4. Keep rollback notes for risky changes.
5. Do not add lower level symbols until the feeder and cable model is disciplined.
6. Finance changes must update both labels and calculations.
7. Geometry changes must preserve the fixed point of connection unless explicitly changing that rule.
8. Export cable and internal 33 kV collector must remain visually distinct.
9. Main GIS app must remain finance led.
10. Detailed design should remain a later paid layer unless deliberately brought into V4 as optional toggled layers.

---

## 19. Current priority architecture direction

The correct next architecture is a layered same page GIS design and finance control surface.

Recommended next layer structure:

```text
Base layer
Map, substations, point of connection, customer substation, array boundary

Commercial layer
CAPEX, cashflow, profit, IRR, target exit value

Export cable layer
Route, live length, cost per metre, total cost, route risk

MV feeder layer
Feeder groups, cable section lengths, cable size, losses, cost

Topology layer
Production blocks, inverter blocks, BESS, substations

Future DC layer
Strings, string inverters, combiner boxes, connectors, DC cable allowance
```

The next serious technical step should be:

```text
Layer Control Panel
MV feeder and cable section model
Export field name clean up for £/Wp finance units
Finance link between export cable length and cable CAPEX
```

---

## 20. Known technical debt

```text
1. Some comments still reference V3 history because V4 was cloned from V3.
2. Finance export keys should be renamed from MW or MWp wording to Wp wording.
3. 33 kV radial model is only an abstraction and needs feeder grouping.
4. Module layout app needs mounting table geometry, not just flat portrait or landscape rectangles.
5. Main app and module layout app are not yet connected by shared JSON state.
6. UI injection for export cable controls works but should eventually move into HTML or a dedicated UI component file.
7. No automated browser test currently validates the full app flow.
```

---

## 21. Human readable summary

The V4 app currently has 2 related but separate tools:

```text
Main GIS SLD Financial Sandbox
A finance led grid, topology, export cable and early project viability tool

Physical Module Layout App
A non breaking experimental tool for seeing physical module footprint on the map
```

The main app is ready for controlled finance and cable model development.

The module layout app is ready for controlled mounting geometry development.

Both should remain linked by architecture and shared principles, but separated until the detailed geometry and feeder models become stable.
