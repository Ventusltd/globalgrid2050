# V6 Complex Upgrade Report: 002_gis_sld_atlas_v8_132_400kv_layers

Status: PASS
UTC timestamp: 2026-05-18T23:35:53.030032+00:00
Target app: gis-sld-financial-sandbox
Dry run: False
Manifest: solar-bess-topology-v6/upgrades/002_gis_sld_atlas_v8_132_400kv_layers/manifest.yml

## Message

Manifest read, target app validated, paths validated and upgrade installed.

## Allowed paths validated

- solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js

## Operations

Operations declared: 2

- insert_after: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-map.js
- replace: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui-core.js | 1 match

## Checks

Checks declared: 4

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
