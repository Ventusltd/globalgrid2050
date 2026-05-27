# V5 chart overlap and control placement patch

Updated `uk_energy_tracking_v5/price-history-ui.js`, `uk_energy_tracking_v5/price-history-fullscreen.js` and `uk_energy_tracking_v5/index.md`.

Changes applied:
1. Removed the drawn footer text from the normal canvas to stop overlap with x axis labels.
2. Increased normal chart bottom padding and made low labels flip above when close to the bottom.
3. Reduced repeated centre date labels on short windows.
4. Removed the full screen floating bottom label.
5. Moved full screen arrows into the top left chart corner.
6. Kept All, Day, Night and Close in the top right chart corner.
7. Updated script cache keys to `20260527c`.

## Units and red label spacing refinement

Added explicit £/MWh units to y axis and HIGH/LOW event labels. Increased label spacing so red event text does not clash with date labels. Cache keys updated to 20260527e.

## Idempotent units and spacing refinement

Made the chart patch tolerant of already patched files. Added explicit £/MWh units to y axis and event labels, increased chart padding and moved full screen controls into chart corners. Cache keys updated to 20260527f.
