# GlobalGrid2050 ECG Candidate Wiring Report

Generated UTC: `2026-06-08T22:11:53Z`
Mode: `audit only`

## Results

ECG file exists: `True`
ECG file size bytes: `2838861`
Renderer touched: `False`

## Config

{
  "path": "uk_energy_tracking_v6/generation_history/live-config.js",
  "exists": true,
  "recentEcgAlreadyPresent": false,
  "wouldChange": true,
  "applied": false
}

## Loader

{
  "path": "uk_energy_tracking_v6/generation_history/load_generation_history_data.js",
  "exists": true,
  "rendererTouched": false,
  "usesRecentEcgFallback": true,
  "wouldChange": true,
  "applied": false
}

## Rule

Renderer untouched. Loader uses recentEcg when present and falls back to recentHalfHourly. Dropdown filtering remains unchanged.
