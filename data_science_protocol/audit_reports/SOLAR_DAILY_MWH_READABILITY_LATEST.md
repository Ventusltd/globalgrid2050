Title: Solar Daily MWh Readability Upgrade
Generated UTC: 2026-06-10T18:18:58Z
Repository: Ventusltd/globalgrid2050
Branch: main
Git head before: 7cb517fa
Git head after: 7cb517fa
Workflow: GridBot Solar Daily MWh Readability Upgrade
Script: scripts/gridbot_solar_daily_mwh_readability_upgrade.py
Upgrade type: UI chart readability and high low annotation
Executive summary: Resizes the standalone Solar daily MWh chart to match the main generation chart better and adds bounded high and low daily MWh annotations.
Human review status: audit required before apply
Next action: Run apply only if all checks are true.

# Solar Daily MWh Readability Upgrade

```json
{
  "reportTitle": "Solar Daily MWh Readability Upgrade",
  "schemaVersion": "1.0.0",
  "generatedUTC": "2026-06-10T18:18:58Z",
  "repository": "Ventusltd/globalgrid2050",
  "branch": "main",
  "gitHeadBefore": "7cb517fa",
  "gitHeadAfter": "7cb517fa",
  "workflowName": "GridBot Solar Daily MWh Readability Upgrade",
  "scriptName": "scripts/gridbot_solar_daily_mwh_readability_upgrade.py",
  "upgradeType": "UI chart readability and high low annotation",
  "mode": "audit",
  "sourceApis": [
    "Sheffield Solar PVLive stored browser file only"
  ],
  "sourceWindows": [
    "2016-01 to latest stored PVLive row"
  ],
  "inputFiles": [
    "uk_energy_tracking_v6/generation_history/index.md",
    "uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js",
    "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json"
  ],
  "outputFiles": [
    "uk_energy_tracking_v6/generation_history/index.md",
    "uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js",
    "data_science_protocol/audit_reports/SOLAR_DAILY_MWH_READABILITY_LATEST.md",
    "data_science_protocol/audit_reports/json/SOLAR_DAILY_MWH_READABILITY_LATEST.json"
  ],
  "changedFiles": [
    "uk_energy_tracking_v6/generation_history/index.md",
    "uk_energy_tracking_v6/generation_history/render_solar_daily_mwh_chart.js"
  ],
  "addedFiles": [],
  "deletedFiles": [],
  "solarAudit": {
    "path": "uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json",
    "exists": true,
    "rowCount": 3812,
    "mwhRowsAvailable": 3804,
    "mwhRowsMissingOrInvalid": 8,
    "highestDailyMwh": {
      "date": "2026-04-30",
      "mwh": 128075.198,
      "highMW": 16009.6,
      "averageMW": 5336.467,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE"
    },
    "lowestDailyMwh": {
      "date": "2023-12-27",
      "mwh": 960.294,
      "highMW": 253.453,
      "averageMW": 40.012,
      "source": "Sheffield Solar PVLive",
      "methodState": "PVLIVE EMBEDDED ESTIMATE"
    }
  },
  "checks": {
    "index_exists": true,
    "renderer_exists": true,
    "solar_data_exists": true,
    "stored_mwh_exists": true,
    "highest_daily_mwh_found": true,
    "lowest_daily_mwh_found": true,
    "renderer_has_high_low_stats": true,
    "renderer_draws_high_callout": true,
    "renderer_draws_low_callout": true,
    "callout_clamps_inside_canvas": true,
    "mobile_summary_uses_two_rows": true,
    "solar_canvas_matches_generation_desktop_height": true,
    "solar_canvas_mobile_readable": true,
    "cache_buster_incremented": true,
    "mw_chart_preserved": true,
    "standalone_panel_preserved": true,
    "no_data_files_changed": true,
    "no_elexon_derived_mwh_logic": true
  },
  "rawTemporaryFilesFound": {
    "hits": [],
    "hitCount": 0
  },
  "browserRoutingAffected": true,
  "rollbackMethod": "Revert the apply commit for this readability upgrade.",
  "executiveSummary": "Resizes the standalone Solar daily MWh chart to match the main generation chart better and adds bounded high and low daily MWh annotations.",
  "humanReviewStatus": "audit required before apply",
  "nextAction": "Run apply only if all checks are true.",
  "applied": false,
  "pass": true
}
```
