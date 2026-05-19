# V7 Migration From V6

UTC created: 2026-05-19T00:56:37.992174+00:00
Source: `solar-bess-topology-v6`
Target: `solar-bess-topology-v7`
Overwrite used: False

## Purpose

Create a full V7 workspace from the current V6 workspace while preserving V6 as the prior working baseline.

## Migration stance

- V6 is not edited.
- V7 is a new version folder.
- Internal legacy file names are not renamed unless deliberately handled later.
- Safe user facing labels and documentation references are relabelled from V6 to V7.
- A separate workflow should be used for future V7 upgrades.

## Actions

- copied full folder solar-bess-topology-v6 to solar-bess-topology-v7
- patched 29 label references in solar-bess-topology-v7/README.md
- patched 4 label references in solar-bess-topology-v7/cable-geometry-visualiser/index.html
- patched 4 label references in solar-bess-topology-v7/dc-ac-lv-topology-review/index.html
- patched 38 label references in solar-bess-topology-v7/docs/ARCHITECTURE.md
- patched 1 label references in solar-bess-topology-v7/docs/V5_CHANGELOG_AND_ROADMAP.md
- patched 15 label references in solar-bess-topology-v7/docs/learning_objectives/01_advanced_electrical_layers_before_upgrade.md
- patched 3 label references in solar-bess-topology-v7/docs/learning_objectives/README.md
- patched 6 label references in solar-bess-topology-v7/docs/training/01_cable_route_assumptions.md
- patched 7 label references in solar-bess-topology-v7/docs/training/02_sld_topology_validation.md
- patched 9 label references in solar-bess-topology-v7/docs/training/03_bess_grid_resilience.md
- patched 11 label references in solar-bess-topology-v7/docs/training/04_electrical_risk_controls.md
- patched 7 label references in solar-bess-topology-v7/docs/training/05_v6_module_relevance.yml
- patched 7 label references in solar-bess-topology-v7/docs/training/06_commercial_engineering_interface.md
- patched 5 label references in solar-bess-topology-v7/docs/training/README.md
- patched 1 label references in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-config.js
- patched 1 label references in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-helpers.js
- patched 1 label references in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-state.js
- patched 1 label references in solar-bess-topology-v7/gis-sld-financial-sandbox/gis-sld-v5-substations.js
- patched 2 label references in solar-bess-topology-v7/gis-sld-financial-sandbox/index.html
- patched 6 label references in solar-bess-topology-v7/index.html
- patched 1 label references in solar-bess-topology-v7/module-layout/gis-sld-v5-config.js
- patched 1 label references in solar-bess-topology-v7/module-layout/gis-sld-v5-helpers.js
- patched 4 label references in solar-bess-topology-v7/module-layout/index.html
- patched 2 label references in solar-bess-topology-v7/upgrades/000_validation_test/manifest.yml
- patched 2 label references in solar-bess-topology-v7/upgrades/001_gis_sld_validation_test/manifest.yml
- patched 9 label references in solar-bess-topology-v7/upgrades/002_gis_sld_atlas_v8_132_400kv_layers/manifest.yml
- patched 12 label references in solar-bess-topology-v7/upgrades/003_gis_sld_atlas_v8_voltage_layer_toggles/manifest.yml
- patched 14 label references in solar-bess-topology-v7/upgrades/004_gis_sld_atlas_v8_voltage_buttons/manifest.yml
- patched 12 label references in solar-bess-topology-v7/upgrades/004b_gis_sld_atlas_v8_voltage_buttons_safe/manifest.yml
- patched 11 label references in solar-bess-topology-v7/upgrades/004c_gis_sld_atlas_v8_voltage_buttons_no_map_patch/manifest.yml
- patched 11 label references in solar-bess-topology-v7/upgrades/005_gis_sld_map_expand_and_key_collapse/manifest.yml
- patched 11 label references in solar-bess-topology-v7/upgrades/006_gis_sld_map_tool_overlay/manifest.yml
- added V7 migration note to README.md

## Next steps

1. Test `solar-bess-topology-v7/index.html` locally through GitHub Pages.
2. Test each V7 app route.
3. Do not add V7 to the public homepage until manual checks pass.
4. Use V7 for the next phase of controlled upgrades.
