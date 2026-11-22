# Pipeline News V9.65 — Expanded REPD View (candidate)

Owner visual acceptance pending. **No homepage promotion.**

The existing V9.64 live REPD table and the three live speedometer analytics gauges are moved (not copied or regenerated) into a full-viewport dark workspace. The **EXPANDED REPD VIEW** control replaces the original A3 label. It retains existing 13 REPD columns, sort handlers, project details, MAP, Machine Read Notes, individual A4 HTML/PDF reports, canonical filtering and original data. It exposes the existing All Tech, Solar, Battery, Onshore Wind and Offshore Wind source filter buttons directly beneath the gauges; does not rebuild or recolour them.

Only the expanded workspace shows 100 paginated project rows (regular dashboard remains 50). Header triangles open column-attached original search, status, technology, county, capacity and date/year controls; no separate free-floating filter toolbar. Operator width is 96px, less than half the original 210px desktop column, and wraps to two clamped lines with full text title. No sticky Project column; horizontal finger/mouse scrolling works in both axes. Same original table node is moved back to its exact position on exit.

V9.64, V9.63 A4 and all earlier immutable editions are left intact. This version is isolated in its own release directory on a PR branch, not live. Browser automation is a regression gate, not physical iPhone Safari owner acceptance.
