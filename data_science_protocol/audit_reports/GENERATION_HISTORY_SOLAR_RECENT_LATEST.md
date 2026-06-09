# GridBot Generation History Solar Recent Report

Generated UTC: `2026-06-09T21:50:36Z`
Mode: `apply`
Manifest: `gridbot_manifests/011_generation_history_solar_recent.yml`

## Executive summary

GridBot solar recent workflow ran 5 phases in apply mode. Apply only affects phases with applyByDefault true.

## Phase results

### r01_existing_recent_audit  Audit existing V6 recent generation process

Operation: `existing_recent_audit`
Applied: `False`

```json
{
  "configPath": "uk_energy_tracking_v6/generation_history/live-config.js",
  "loaderPath": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "recentPath": "uk_energy_tracking_v6/generation_history/generation_ecg_all_technologies_30d_30min_candidate.json",
  "recentPathExists": true,
  "configHasRecentHalfHourly": true,
  "configHasRecentEcg": true,
  "loaderRecentTierFor30d": true,
  "loaderHasLoadRecent": true,
  "recentRows": 14409,
  "firstRowFields": [
    "generationMW",
    "source",
    "status",
    "technology",
    "time"
  ],
  "pass": true
}
```

### r02_pvlive_recent_audit  Audit PVLive recent 30 minute parseability

Operation: `pvlive_recent_audit`
Applied: `False`

```json
{
  "daysChecked": 3,
  "rowsFound": 144,
  "expectedRowsApprox": 144,
  "workingUrl": "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0?start=2026-06-06T00%3A00%3A00Z&end=2026-06-08T23%3A59%3A00Z",
  "firstTime": "2026-06-06T00:00:00Z",
  "lastTime": "2026-06-08T23:30:00Z",
  "errors": [],
  "pass": true
}
```

### r03_build_solar_recent_browser  Build PVLive Solar recent 30 minute browser file

Operation: `build_recent_browser`
Applied: `True`

```json
{
  "outputPath": "uk_energy_tracking_v6/generation_history/pvlive_solar_recent_30d_30min_browser.json",
  "daysRequested": 30,
  "rows": 1440,
  "expectedRowsApprox": 1440,
  "firstTime": "2026-05-10T00:00:00Z",
  "lastTime": "2026-06-08T23:30:00Z",
  "estimatedBytes": 215661,
  "maxBytes": 750000,
  "sha256": "9daa563120d40cc1fcb007c2ed6966f23ba1a8d06a586193e10fe0aba170efb5",
  "workingUrl": "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0?start=2026-05-10T00%3A00%3A00Z&end=2026-06-08T23%3A59%3A00Z",
  "errors": [],
  "apply": true,
  "pass": true
}
```

### r04_solar_recent_ui_audit  Audit Solar recent UI wiring readiness

Operation: `solar_recent_ui_audit`
Applied: `False`

```json
{
  "configPath": "uk_energy_tracking_v6/generation_history/live-config.js",
  "loaderPath": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "solarRecentPath": "uk_energy_tracking_v6/generation_history/pvlive_solar_recent_30d_30min_browser.json",
  "solarRecentExists": true,
  "configHasSolarRecent": false,
  "loaderHasLoadSolarRecent": false,
  "loaderRoutesSolarRecent": false,
  "dailyHistoryStillFullFUELHH": true,
  "recentEcgStillPresent": true,
  "pass": true
}
```

### r05_wire_solar_recent  Apply Solar recent UI routing after browser file exists

Operation: `wire_solar_recent`
Applied: `True`

```json
{
  "configPath": "uk_energy_tracking_v6/generation_history/live-config.js",
  "loaderPath": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "solarRecentPath": "uk_energy_tracking_v6/generation_history/pvlive_solar_recent_30d_30min_browser.json",
  "solarRecentExists": true,
  "configHasSolarRecent": true,
  "loaderHasLoadSolarRecent": true,
  "loaderRoutesSolarRecent": true,
  "dailyHistoryStillFullFUELHH": true,
  "recentEcgStillPresent": true,
  "pass": true,
  "apply": true,
  "applied": true,
  "plannedOrChangedFiles": [
    "uk_energy_tracking_v6/generation_history/live-config.js",
    "uk_energy_tracking_v6/generation_history/load_generation_history_data.js"
  ]
}
```
