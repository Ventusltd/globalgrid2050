# Add V6 V7 Print V2 Compact Report Mode

UTC created: 2026-05-19T17:35:48.298009+00:00

## Purpose

Improve A4 portrait PDF output by reducing white space, hiding irrelevant controls and preventing map overlap.

## Fixes targeted

- Do not print inactive tabs.
- Do not print map controls or tool overlays.
- Reset expanded or fullscreen map positioning before print.
- Reduce panel padding and font size for A4 portrait.
- Use two compact columns for input and output panels where appropriate.
- Keep map and legend as report figures rather than raw UI overlays.

## Actions

- appended print v2 compact report mode: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5.css
- appended print v2 compact report mode: solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5.css
- appended print v2 compact report mode: solar-bess-topology-v6/module-layout/module-layout-v5.css
- appended print v2 compact report mode: solar-bess-topology-v7/module-layout/module-layout-v5.css
- appended print v2 compact report mode: solar-bess-topology-v6/dc-ac-lv-topology-review/dc-ac-lv-topology-review-v5.css
- appended print v2 compact report mode: solar-bess-topology-v7/dc-ac-lv-topology-review/dc-ac-lv-topology-review-v5.css
- appended print v2 compact report mode: solar-bess-topology-v6/cable-geometry-visualiser/style.css
- appended print v2 compact report mode: solar-bess-topology-v7/cable-geometry-visualiser/style.css

## Manual acceptance test

1. Open each V6 and V7 app.
2. Press Print or use browser print.
3. Confirm active tab only is printed.
4. Confirm no tool buttons appear in the PDF.
5. Confirm map is not overlaid on report text.
6. Confirm there are no large blank gaps between report sections.
