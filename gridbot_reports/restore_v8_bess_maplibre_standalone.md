# Restore V8 BESS MapLibre Standalone App

UTC created: 2026-05-23

## Objective

Restore the standalone BESS GIS SLD Financial Sandbox from the clean MapLibre BESS branch instead of the later V7 PV GIS clone direction.

## Source Commit

```text
f90d9e53965e83fd9a11b94e81ed23aefd3aef7f
```

Commit title:

```text
Add V8 BESS geospatial layout drawing
```

## Restore Targets

```text
solar-bess-topology-v8/bess-gis-sld-financial-sandbox/index.html
solar-bess-topology-v8/bess-gis-sld-financial-sandbox/bess-gis-sld-financial-sandbox.js
solar-bess-topology-v8/bess-gis-sld-financial-sandbox/bess-gis-sld-financial-sandbox.css
```

## Functional Requirements

- Standalone BESS only app.
- Restore working MapLibre BESS drawing.
- Draw BESS containers as GeoJSON polygons.
- Restore PCS transformer layouts.
- Restore finance tab.
- Restore notes tab.
- Restore SVG SLD preview.
- Restore draw, fit, reset and GeoJSON export workflow.
- Remove hidden PV logic and V7 GIS coupling.

## Explicit Non Scope

- No PV drawing.
- No PV string calculations.
- No inverter DC sizing.
- No V7 shared GIS logic.
- No cable sizing.
- No impedance or protection studies.

## Architectural Direction

V8 should become a dedicated BESS siting, layout, topology and commercial sandbox.

The map layer should remain clean, modular and physically visual.
Advanced electrical calculations should remain separated into later topology review applications.
