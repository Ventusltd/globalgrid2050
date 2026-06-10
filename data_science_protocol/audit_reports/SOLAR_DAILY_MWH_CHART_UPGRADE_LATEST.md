# Solar Daily MWh Chart Upgrade

```json
{
  "mode": "audit",
  "purpose": "Add third Solar daily MWh chart below the existing MW chart using stored Sheffield Solar PVLive daily mwh data only.",
  "solarAudit": {
    "rowCount": 3812,
    "mwhRowsAvailable": 3804,
    "mwhRowsMissingOrInvalid": 8,
    "peakDailyMwh": {
      "date": "2026-04-30",
      "mwh": 128075.198,
      "highMW": 16009.6,
      "averageMW": 5336.467,
      "source": "Sheffield Solar PVLive",
      "sourceAttribution": "Sheffield Solar PVLive, solar.sheffield.ac.uk",
      "methodState": "PVLIVE EMBEDDED ESTIMATE"
    }
  },
  "checks": {
    "index_exists": true,
    "renderer_exists": true,
    "controller_exists": true,
    "solar_data_exists": true,
    "solar_data_has_stored_mwh": true,
    "solar_peak_mwh_found": true,
    "panel_present_after_patch": true,
    "script_refs_present_after_patch": true,
    "mw_chart_canvas_preserved": true,
    "controller_is_solar_only": true
  },
  "wouldUpdate": "uk_energy_tracking_v6/generation_history/index.md",
  "indexOldSha256": "8ecdb72f91cd961bd16665773663017aecc5a5fce43df01076fb44c779463add",
  "indexNewSha256": "15bfa1b3d09c85196d0fe5607733c60341a90561a44a889ddb268e417f2e5a5f",
  "applied": false,
  "pass": true
}
```
