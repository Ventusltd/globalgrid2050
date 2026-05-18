# V6 Complex Upgrade Report: 003_gis_sld_atlas_v8_voltage_layer_toggles

Status: PASS
UTC timestamp: 2026-05-18T23:47:58.995989+00:00
Target app: gis-sld-financial-sandbox
Dry run: False
Manifest: solar-bess-topology-v6/upgrades/003_gis_sld_atlas_v8_voltage_layer_toggles/manifest.yml

## Message

Manifest read, target app validated, paths validated and upgrade installed.

## Allowed paths validated

- solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js

## Operations

Operations declared: 4

- insert_after: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- regex_replace: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js | 1 match
- insert_before: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js
- regex_replace: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js | 1 match

## Checks

Checks declared: 5

- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js
- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js

## Controller stance

No broad rewrite.
No automatic execution on push.
Only manifest approved paths are writable.
V6 remains the testing and modularisation workspace.
V5 remains untouched.
