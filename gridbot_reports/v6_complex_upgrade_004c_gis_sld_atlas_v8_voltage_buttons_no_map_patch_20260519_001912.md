# V6 Complex Upgrade Report: 004c_gis_sld_atlas_v8_voltage_buttons_no_map_patch

Status: PASS
UTC timestamp: 2026-05-19T00:19:12.807105+00:00
Target app: gis-sld-financial-sandbox
Dry run: False
Manifest: solar-bess-topology-v6/upgrades/004c_gis_sld_atlas_v8_voltage_buttons_no_map_patch/manifest.yml

## Message

Manifest read, target app validated, paths validated and upgrade installed.

## Allowed paths validated

- solar-bess-topology-v6/gis-sld-financial-sandbox/index.html
- solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5.css
- solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js

## Operations

Operations declared: 4

- regex_replace: solar-bess-topology-v6/gis-sld-financial-sandbox/index.html | 1 match
- insert_before: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5.css
- insert_before: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- insert_after: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js

## Checks

Checks declared: 4

- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/index.html
- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/index.html
- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5-ui.js
- assert_contains: solar-bess-topology-v6/gis-sld-financial-sandbox/gis-sld-v5.css

## Controller stance

No broad rewrite.
No automatic execution on push.
Only manifest approved paths are writable.
V6 remains the testing and modularisation workspace.
V5 remains untouched.
