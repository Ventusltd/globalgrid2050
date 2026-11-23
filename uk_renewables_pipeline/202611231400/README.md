# V9.74 — Technology-aware REPD operator, status and region cockpit

Full immutable successor of V9.73 (202611222330).
The SAME existing REPD cockpit now ranks operators by the selected technology.
Solar shows solar-only MWp and operators; BESS, onshore and offshore use their own MW.
A status facet covers every original REPD status, including refused, withdrawn
and not reported. Operator and region facets intersect; switching report buttons
retains selections. Current Table Filters remains an explicit, separate scope.
Interconnectors retain their own inventory and are never added to 7,775 REPD records.
Grid reporting awaits a verified separate source. No measured energy claims.

No changes to published V9.73, data, styling, colours, original chart gauges,
ticker, navigation, REPD source, MAP/A4/PDF/expanded view or GridAtlas.
Only index.html (version title), repd-reports.mjs, README.md and CHANGES.md
differ from V9.73, plus the new browser test and build receipt.

Rollback remains /uk_renewables_pipeline/202611222330/.
