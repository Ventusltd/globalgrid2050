# GIS SLD App Address Map 2026 05 16

This document is the single continuous address map for the GIS SLD Financial Sandbox and its V2 modularisation. The purpose is to give every part of the app a simple fixed address, almost like an IP address, so the system can be understood without jumping through confusing folder explanations.

## Address 0.0 - Working truth area
* Address 0.1 is `solar-bess-topology/indexforgis-sld.html`, which is the original working monolithic application. This file is the master benchmark and must not be deleted. It contains the complete working app in 1 continuous document, including HTML, CSS, configuration, state, utilities, map logic, substation loading, stats, finance, topology, export and event wiring.

## Address 1.0 - V2 modular test app area
* Address 1.1 is `solar-bess-topology-v2/indexforgis-sld-v2.html`, which is the main V2 app shell. It currently contains the HTML user interface, state, utilities, map logic, substation loading, stats, finance, topology, export and event wiring.
* Address 1.2 is `solar-bess-topology-v2/gis-sld-v2.css`, which is the extracted stylesheet created by Feature 001.
* Address 1.3 is `solar-bess-topology-v2/gis-sld-v2-config.js`, which is the extracted configuration file created by Feature 002. It contains `SUBSTATIONS_URL` and `CONSTANTS`.
* Address 1.4 is the future file `solar-bess-topology-v2/gis-sld-v2-helpers.js`, which has not yet been created.
* Address 1.5 is the future file `solar-bess-topology-v2/gis-sld-v2-finance.js`, which has not yet been created.
* Address 1.6 is the future file `solar-bess-topology-v2/gis-sld-v2-state.js`, which has not yet been created.
* Address 1.7 is the future file `solar-bess-topology-v2/gis-sld-v2-map.js`, which has not yet been created.
* Address 1.8 is the future file `solar-bess-topology-v2/gis-sld-v2-topology.js`, which has not yet been created.
* Address 1.9 is the future file `solar-bess-topology-v2/gis-sld-v2-export.js`, which has not yet been created.
* Address 1.10 is the future file `solar-bess-topology-v2/gis-sld-v2-main.js`, which has not yet been created.

## Address 2.0 - Feature request area
These folders at `feature_requests/` are GridBot instructions, not live app files.
* Address 2.1 is `feature_requests/000_v2_identity/`.
* Address 2.1.1 is `feature_requests/000_v2_identity/manifest.yml`, which is complete and confirms the V2 identity.
* Address 2.2 is `feature_requests/001_extract_v2_css/`.
* Address 2.2.1 is `feature_requests/001_extract_v2_css/manifest.yml`, which is complete and extracted CSS into address 1.2.
* Address 2.3 is `feature_requests/002_extract_v2_config/`.
* Address 2.3.1 is `feature_requests/002_extract_v2_config/manifest.yml`, which applied the config extraction into address 1.3.
* Address 2.3.2 is `feature_requests/002_extract_v2_config/files/`, which is the overlay source folder used for new files.
* Address 2.3.3 is `feature_requests/002_extract_v2_config/files/solar-bess-topology-v2/gis-sld-v2-config.js`, which is the source copy that GridBot copied into address 1.3.
* Address 2.4 is `feature_requests/002a_fix_config_load_order/`.
* Address 2.4.1 is `feature_requests/002a_fix_config_load_order/manifest.yml`, which is the current repair feature and removes `defer` from the config script so address 1.3 loads before the inline application logic in address 1.1.

## Address 3.0 - Automation engine area
* Address 3.1 is `scripts/gridbot_feature_installer.py`, which is the Python installer that reads feature manifests and edits files.
* Address 3.2 is `.github/`.
* Address 3.3 is `.github/workflows/`.
* Address 3.4 is `.github/workflows/gridbot-feature-install.yml`, which is the GitHub Actions workflow used to run GridBot manually.

## Address 4.0 - Report area
* Address 4.1 is `gridbot_reports/gridbot_install_*.md`, which contains the audit reports from GridBot runs.

## Address 5.0 - System doctrine area
* Address 5.0 is `ARCHITECTURE.md`, which is the main system doctrine.
* Address 5.1 is `GRIDBOT_FEATURE_INSTALL_INSTRUCTIONS.md`, which is the practical GridBot operating instruction file.
* Address 5.2 is `GIS_SLD_APP_SPIDER.md`, which is the app logic map if used.
* Address 5.3 is `GIS_SLD_V2_MODULAR_SITE_MAP.md`, which is the V2 modular map if used.
* Address 5.4 is `GIS_SLD_APP_ADDRESS_MAP.md`, which is this file and should act as the human address map for the app and modularisation process.

## Address 6.0 - External runtime dependency area
* Address 6.1 is MapLibre CSS at `https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css`.
* Address 6.2 is MapLibre JS at `https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js`.
* Address 6.3 is Turf JS at `https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js`.
* Address 6.4 is `/grid_substations.geojson`, which is the substation reference dataset.

## Address 7.0 - Critical load path
* Address 7.1 means the browser opens address 1.1.
* Address 7.2 means V2 loads MapLibre CSS from address 6.1.
* Address 7.3 means V2 loads MapLibre JS from address 6.2.
* Address 7.4 means V2 loads Turf JS from address 6.3.
* Address 7.5 means V2 loads extracted CSS from address 1.2.
* Address 7.6 means V2 loads extracted config from address 1.3.
* Address 7.7 means the inline app logic inside address 1.1 runs.
* Address 7.8 means the map initialises.
* Address 7.9 means substations load from address 6.4.
* Address 7.10 means the user can search, draw, calculate and export.

## Address 8.0 - Current progress register
* Address 8.1 means the original monolith exists and works.
* Address 8.2 means the V2 clone exists.
* Address 8.3 means CSS extraction is complete.
* Address 8.4 means config extraction is complete.
* Address 8.5 means config load order repair is the current task.
* Address 8.6 means no further modular splitting is allowed until V2 works again.

## Address 9.0 - Current repair
* Address 9.1 means run Feature 002a only.
* Address 9.2 means the target file is address 1.1.
* Address 9.3 means replace `<script src="gis-sld-v2-config.js" defer></script>`.
* Address 9.4 means replace it with `<script src="gis-sld-v2-config.js"></script>`.
* Address 9.5 means test V2 against the monolith after the repair.

## Address 10.0 - Rule area
* Address 10.1 means monolith address 0.1 is working truth.
* Address 10.2 means V2 address 1.1 is the test clone.
* Address 10.3 means CSS address 1.2 is extracted styling.
* Address 10.4 means config address 1.3 must load before app logic.
* Address 10.5 means feature requests address 2.0 are instructions, not the live app.
* Address 10.6 means GridBot address 3.1 performs the edits.
* Address 10.7 means reports address 4.0 prove what happened.
* Address 10.8 means do not split more files until V2 works again.
* Address 10.9 means do not delete the monolith.
* Address 10.10 means do not treat file splitting as proof of modularity.

The current operating sentence is: 0.1 is the working truth, 1.1 is the V2 test clone, 1.2 and 1.3 are the first extracted modules, 2.4 is the current repair instruction, 3.1 applies the patch and 4.0 proves what happened.
