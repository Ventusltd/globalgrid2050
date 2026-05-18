# GlobalGrid2050 V6

V6 is the separated application workspace for the Solar BESS Topology system.

It was created from the stable V5 toolset so the working V5 baseline remains protected while V6 becomes the controlled testing and modularisation area.

Public test address:

```text
https://globalgrid2050.com/solar-bess-topology-v6/
```

## Status

```text
Testing phase
```

V6 is not yet the stable production baseline. V5 remains the stable comparison reference.

Current V6 purpose:

1. Keep V5 stable and untouched.
2. Place each application into its own folder.
3. Make application boundaries visible.
4. Modularise one app at a time.
5. Preserve working behaviour while improving maintainability.
6. Create a disciplined workspace for future GridBot controlled changes.

## Governing doctrine

Before making any significant change, read:

```text
/PHILOSOPHY.md
solar-bess-topology-v6/docs/ARCHITECTURE.md
solar-bess-topology-v6/docs/V5_CHANGELOG_AND_ROADMAP.md
```

When in doubt, follow the docs and the repo philosophy.

The standing rule is:

```text
Protect working truth. Make small changes. Preserve physics. Keep state clear. Use controlled workflows. Let Vikram approve what becomes part of the system.
```

## Folder structure

```text
solar-bess-topology-v6/
  index.html
  README.md
  gis-sld-financial-sandbox/
  module-layout/
  dc-ac-lv-topology-review/
  cable-geometry-visualiser/
  docs/
  tools/
```

## Application map

```text
index.html
```

V6 launcher page. It links to the separated applications.

```text
gis-sld-financial-sandbox/
```

Main GIS SLD Financial Sandbox. It remains close to the V5 GIS SLD app and still uses legacy `gis-sld-v5` file names inside the V6 folder. That is intentional for now because the first V6 objective is separation, not wholesale renaming.

```text
module-layout/
```

Physical solar module layout app. It tests module footprint, row count, pitch, orientation, map drawing and physical layout behaviour separately from the main GIS finance app.

```text
dc-ac-lv-topology-review/
```

DC AC LV topology review app. It reviews solar PV string, inverter, combiner, skid and cable topology assumptions separately from the main GIS finance app.

```text
cable-geometry-visualiser/
```

Cable geometry visualiser. This is now modularised in V6 phase 1.

Current files:

```text
index.html
style.css
data.js
calculations.js
rendering.js
export.js
ui.js
```

The modularisation report is here:

```text
gridbot_reports/v6_cable_geometry_modularisation_phase_1.md
```

The report confirms that the extracted V6 CSS and JavaScript rebuild exactly to the original V6 inline logic and match the original V5 baseline.

## V6 URLs to test

```text
https://globalgrid2050.com/solar-bess-topology-v6/
https://globalgrid2050.com/solar-bess-topology-v6/gis-sld-financial-sandbox/
https://globalgrid2050.com/solar-bess-topology-v6/module-layout/
https://globalgrid2050.com/solar-bess-topology-v6/dc-ac-lv-topology-review/
https://globalgrid2050.com/solar-bess-topology-v6/cable-geometry-visualiser/
```

V5 comparison references:

```text
https://globalgrid2050.com/solar-bess-topology-v5/indexforgis-sld-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/module-layout-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/dc-ac-lv-topology-review-v5.html
https://globalgrid2050.com/solar-bess-topology-v5/cable-geometry-visualiser-v5.html
```

## Safe work rules

1. Do not edit V5 when working on V6.
2. Do not mix scripts between apps unless a shared folder is deliberately designed later.
3. Keep each app independently loadable from its own folder.
4. Use small workflows and small commits.
5. Every change must be traceable through GitHub history.
6. Prefer deterministic Python or GridBot workflows over manual bulk edits.
7. Do not mass refactor for cosmetic reasons.
8. Do not rename legacy `v5` internal files unless that is the specific approved feature.
9. Do not change calculations without checking physical, electrical and financial consequences.
10. If unsure, stop and refer to `/PHILOSOPHY.md` and the V6 docs folder.

## Current architecture position

V6 has passed the first structural objective:

```text
Separate the applications from the V5 flat folder structure.
```

V6 has also passed the first modularisation objective:

```text
Extract the cable geometry visualiser into external CSS and JavaScript modules without changing its runtime logic.
```

The next correct work should remain controlled and narrow.

Recommended next candidates:

```text
1. Manual browser validation of the V6 cable geometry visualiser against V5.
2. Add a small documentation note inside the V6 launcher saying Testing Phase.
3. Add browser level smoke tests later if needed.
4. Only after validation, consider phase 2 cable geometry cleanup.
5. Leave GIS SLD finance logic untouched until the cable geometry split is proven stable.
```

## Human summary

V6 is the workshop.

V5 is the stable baseline.

The V6 folder now separates the tools, protects the original system and gives GlobalGrid2050 a controlled path to grow from a working monolith into a maintainable infrastructure reasoning platform.
