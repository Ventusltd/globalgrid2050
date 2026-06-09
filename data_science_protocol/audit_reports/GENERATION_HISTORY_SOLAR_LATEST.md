# GridBot Generation History Solar Report

Generated UTC: `2026-06-09T20:04:23Z`
Mode: `apply`
Manifest: `gridbot_manifests/010_generation_history_solar_ui.yml`

## Executive summary

GridBot solar workflow ran 5 phases in apply mode. Apply only affects phases with applyByDefault true.

## Phase results

### p01_pvlive_endpoint_audit  Audit PVLive endpoint and parseability

Operation: `pvlive_endpoint_audit`
Applied: `False`

```json
{
  "daysChecked": 3,
  "rowsFound": 144,
  "workingUrl": "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0?start=2026-06-08T00%3A00%3A00Z&end=2026-06-08T23%3A59%3A00Z",
  "sample": [
    {
      "date": "2026-06-08",
      "rows": 48,
      "error": ""
    },
    {
      "date": "2026-06-07",
      "rows": 48,
      "error": ""
    },
    {
      "date": "2026-06-06",
      "rows": 48,
      "error": ""
    }
  ],
  "pass": true
}
```

### p02_fetch_pvlive_candidate  Fetch PVLive solar candidate daily facts

Operation: `fetch_pvlive_candidate`
Applied: `True`

```json
{
  "outputPath": "data/confirmed/pvlive_solar_daily_candidate.json",
  "apply": true,
  "daysRequested": 30,
  "daysFetched": 30,
  "rowsAfterMerge": 30,
  "estimatedBytes": 6410,
  "sha256": "05f55ba598b54bbad11ad918887e349844678844802a5a0dbb6ce84aae124f91",
  "workingUrl": "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0?start=2026-05-10T00%3A00%3A00Z&end=2026-05-10T23%3A59%3A00Z",
  "failures": [],
  "pass": true
}
```

### p03_build_solar_browser  Build PVLive solar browser JSON

Operation: `build_solar_browser`
Applied: `True`

```json
{
  "inputPath": "data/confirmed/pvlive_solar_daily_candidate.json",
  "inputExists": true,
  "outputPath": "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json",
  "apply": true,
  "rows": 30,
  "firstDate": "2026-05-10",
  "lastDate": "2026-06-08",
  "estimatedBytes": 6364,
  "maxBytes": 500000,
  "sha256": "b79f4ddd4e271f700c3b4faa568acefbcce67e3e3606d0687624babd5e23ce24",
  "pass": true
}
```

### p04_ui_wire_audit  Audit Solar UI wiring readiness

Operation: `ui_wire_audit`
Applied: `False`

```json
{
  "configPath": "uk_energy_tracking_v6/generation_history/live-config.js",
  "loaderPath": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "indexPath": "uk_energy_tracking_v6/generation_history/index.md",
  "solarBrowserPath": "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json",
  "solarBrowserExists": true,
  "configHasSolarDaily": false,
  "loaderHasSolarDailyLoader": false,
  "loaderRoutesSolarDaily": false,
  "indexMentionsPVLiveLayer": false,
  "recentEcgStillPresent": true,
  "dailyHistoryStillFullFUELHH": true,
  "pass": true
}
```

### p05_wire_solar_ui  Apply Solar UI wiring after solar browser file exists

Operation: `wire_solar_ui`
Applied: `True`

```json
{
  "configPath": "uk_energy_tracking_v6/generation_history/live-config.js",
  "loaderPath": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "indexPath": "uk_energy_tracking_v6/generation_history/index.md",
  "solarBrowserPath": "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json",
  "solarBrowserExists": true,
  "configHasSolarDaily": true,
  "loaderHasSolarDailyLoader": true,
  "loaderRoutesSolarDaily": true,
  "indexMentionsPVLiveLayer": true,
  "recentEcgStillPresent": true,
  "dailyHistoryStillFullFUELHH": true,
  "pass": true,
  "apply": true,
  "applied": true,
  "plannedOrChangedFiles": [
    "uk_energy_tracking_v6/generation_history/live-config.js",
    "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
    "uk_energy_tracking_v6/generation_history/index.md"
  ]
}
```
