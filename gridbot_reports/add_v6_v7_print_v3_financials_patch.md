# Add V6 V7 Print V3 Financials Patch

UTC created: 2026-05-19T18:37:03.291434+00:00

## Purpose

Improve print output where the financial details panel is expanded.

## Fixes

- Print only the active topology tab.
- Compact financial headline rows into two columns.
- Remove green, cyan and orange financial colours in print.
- Use black financial values for PDF readability.
- Reduce large blank spaces and excessive padding.
- Improve Development Stage wrapping.
- Keep financial warnings readable as compact report notes.

## Actions

- appended print v3 financials patch: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5.css
- appended print v3 financials patch: solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5.css

## Manual acceptance test

1. Open V6 or V7 GIS SLD.
2. Expand Baseline Project Economics.
3. Print to A4 portrait PDF.
4. Confirm finance values are black and readable.
5. Confirm only the active tab prints.
6. Confirm no large blank gaps appear around the finance section.
