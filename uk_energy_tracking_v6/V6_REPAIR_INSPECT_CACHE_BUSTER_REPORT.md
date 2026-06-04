# V6 Repair Report: Inspect Cache Buster

Generated UTC: 2026-06-04T20:07:14.001314+00:00

## Reason

The inspect overlay code was present and connected in the shared renderer, but both public pages still referenced the renderer with an old cache query string. Browsers and GitHub Pages could continue serving the old JavaScript.

## Change

Updated render_price_chart.js cache query string to `20260604inspect1` in:

- uk_energy_tracking_v6/index.md
- data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html

## Guardrails

- No data files changed.
- No renderer logic changed.
- No loader paths changed.
