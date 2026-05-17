# V5 JavaScript Filename Repair

UTC created: 2026-05-17T16:08:27.082722+00:00

Purpose:
Repair V5 clone filename mismatch where the V5 HTML referenced gis-sld-v5 JavaScript files but the clone retained several gis-sld-v4 JavaScript filenames inside the V5 folder.

Actions:

- copied gis-sld-v4-config.js to gis-sld-v5-config.js
- copied gis-sld-v4-helpers.js to gis-sld-v5-helpers.js
- copied gis-sld-v4-state.js to gis-sld-v5-state.js
- copied gis-sld-v4-substations.js to gis-sld-v5-substations.js
- copied gis-sld-v4-map.js to gis-sld-v5-map.js
- copied gis-sld-v4-calculations.js to gis-sld-v5-calculations.js
- copied gis-sld-v4-finance.js to gis-sld-v5-finance.js
- copied gis-sld-v4-ui-core.js to gis-sld-v5-ui-core.js
- copied gis-sld-v4-drawing.js to gis-sld-v5-drawing.js
- copied gis-sld-v4-export.js to gis-sld-v5-export.js
- copied gis-sld-v4-ui.js to gis-sld-v5-ui.js

Result:
The V5 HTML dependency chain should now resolve against V5 named JavaScript files. V4 remains untouched.
