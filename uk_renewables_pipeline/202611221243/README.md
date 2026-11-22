# Pipeline News V9.64 — liquid REPD HTML overview (A3/A4)

**The V9.63 individual-project A4 report is kept exactly as it is.** Its HTML preview, PDF exporter, source model, styles and tests have not been modified or removed.

This version adds a separate **A3 OVERVIEW** action. It opens an A3 or A4 landscape-sized **live HTML table of the entire filtered and sorted REPD register**, rather than one project's PDF or only the original 50 displayed rows. On iPhone, you can swipe horizontally and vertically, use the bottom column slider, pinch or tap to zoom, or fit the sheet to screen width. The Project column and sortable headers are sticky.

All 13 source-backed fields remain accessible: project name, MW/MWp, county, operator, technology, official status, REPD reference, GlobalGrid reference, REPD updated, submitted, operational, Machine Read Notes and working GridAtlas MAP links. The search, status, county and technology controls delegate to the original canonical REPD engine; date filters remain available in the normal register. The user determines which projects matter — no Signal column, inferred area or automated lead scores.

**Performance:** a bounded virtual row window is rendered from the full source list (which can hold thousands of projects). Scrolling traverses all matching records without inserting them into the DOM simultaneously. Closing returns to the unchanged 50-row source register; the original per-project A4 remains available as before.

**Release discipline:** no homepage pointer change. Independent Chromium and WebKit portrait and landscape tests must pass; all V9.63 source/model/report byte hashes and official REPD data remain immutable. The owner should review the real iPhone Safari layout before promotion.
