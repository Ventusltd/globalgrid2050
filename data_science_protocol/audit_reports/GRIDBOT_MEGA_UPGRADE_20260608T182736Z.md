# GlobalGrid2050 GridBot Mega Upgrade Report

Generated UTC: `2026-06-08T18:27:36Z`
Mode: `apply`
Manifest: `gridbot_manifests/001_generation_data_discipline.yml`
Git head: `990ee666`

## Executive summary

GridBot ran 1 phases in apply mode. Apply only affects phases with applyByDefault true.

## Phase results

### resample_recent_generation_30min  Resample recent generation to true 30 minute MW slice

Operation: `resample_recent_30min`
Applied: `True`

```json
{
  "sourcePath": "uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json",
  "outputPath": "uk_energy_tracking_v6/generation_history/generation_recent_30d_30min.json",
  "sourceRows": 79200,
  "outputRows": 14409,
  "sourceMiB": 13.388,
  "outputEstimatedMiB": 2.309,
  "applied": true
}
```
