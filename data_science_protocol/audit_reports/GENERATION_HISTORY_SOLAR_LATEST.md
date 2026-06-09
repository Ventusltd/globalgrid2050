# GridBot Generation History Solar Report

Generated UTC: `2026-06-09T19:50:15Z`
Mode: `audit only`
Manifest: `gridbot_manifests/010_generation_history_solar_ui.yml`

## Executive summary

GridBot solar workflow ran 5 phases in audit only mode. Apply only affects phases with applyByDefault true.

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
Applied: `False`

```json
{
  "outputPath": "data/confirmed/pvlive_solar_daily_candidate.json",
  "apply": false,
  "daysRequested": 30,
  "daysFetched": 30,
  "rowsAfterMerge": 30,
  "estimatedBytes": 6410,
  "sha256": "76b5c1d097b76d206d456f4b6e64d61675cbc0cbdd761b05a0168cc30e19dce7",
  "workingUrl": "https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0?start=2026-05-10T00%3A00%3A00Z&end=2026-05-10T23%3A59%3A00Z",
  "failures": [],
  "pass": true
}
```

### p03_build_solar_browser  Build PVLive solar browser JSON

Operation: `build_solar_browser`
Applied: `False`

```json
{
  "inputPath": "data/confirmed/pvlive_solar_daily_candidate.json",
  "inputExists": false,
  "outputPath": "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json",
  "apply": false,
  "rows": 0,
  "firstDate": null,
  "lastDate": null,
  "estimatedBytes": 190,
  "maxBytes": 500000,
  "sha256": "d89af69fa6d59440f4e13830a95795f0e16a079ad019fa6382418af1ed97c9e6",
  "pass": false
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
  "solarBrowserExists": false,
  "configHasSolarDaily": false,
  "loaderHasSolarDailyLoader": false,
  "loaderRoutesSolarDaily": false,
  "indexMentionsPVLiveLayer": false,
  "recentEcgStillPresent": true,
  "dailyHistoryStillFullFUELHH": true,
  "pass": false
}
```

### p05_wire_solar_ui  Apply Solar UI wiring after solar browser file exists

Operation: `wire_solar_ui`
Applied: `False`

```json
{
  "configPath": "uk_energy_tracking_v6/generation_history/live-config.js",
  "loaderPath": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "indexPath": "uk_energy_tracking_v6/generation_history/index.md",
  "solarBrowserPath": "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json",
  "solarBrowserExists": false,
  "configHasSolarDaily": false,
  "loaderHasSolarDailyLoader": false,
  "loaderRoutesSolarDaily": false,
  "indexMentionsPVLiveLayer": false,
  "recentEcgStillPresent": true,
  "dailyHistoryStillFullFUELHH": true,
  "pass": false,
  "apply": false,
  "applied": false,
  "error": "solar browser file does not exist"
}
```
