# Deprecated Tracker Stale Data Audit

Generated UTC: `2026-06-14T16:37:40.042810Z`
Mode: `audit`
Pass: `True`

Audits deprecated UK energy tracker versions v2 to v5 for stale live data, missing cron schedules, timestamp masking, and collapsed Imports and Exports generation mix. No data files are modified by audit mode.

## Version verdicts

| Version | Route | Energy updated | Energy age h | Price updated | Price age h | Workflow | Timestamp mask | Imports and Exports bucket | Verdict |
|---|---|---:|---:|---:|---:|---|---|---|---|
| v2 | `/uk_energy_tracking_v2/` | 2026-05-28T04:25:06.334688+00:00 | 420.209 | 2026-05-28T04:25:07.351182+00:00 | 420.209 | manual only | True | True | **stale** |
| v3 | `/uk_energy_tracking_v3/` | 2026-05-28T05:42:02.050808+00:00 | 418.927 | 2026-05-28T05:42:03.241715+00:00 | 418.927 | manual only | True | True | **stale** |
| v4 | `/uk_energy_tracking_v4/` | 2026-05-28T05:45:11.616624+00:00 | 418.875 | 2026-05-28T05:45:13.083370+00:00 | 418.874 | manual only | True | True | **abandoned** |
| v5 | `/uk_energy_tracking_v5/` | 2026-06-03T12:04:42.989110+00:00 | 268.549 | 2026-06-03T12:04:44.048713+00:00 | 268.549 | manual only | True | True | **stale** |

## V6 scheduled live check

{
  "version": "v6",
  "route": "/uk_energy_tracking_v6/",
  "energyUpdated": "2026-06-14T15:21:35.825718+00:00",
  "priceUpdated": "2026-06-14T15:21:37.319916+00:00",
  "energyAgeHours": 1.268,
  "priceAgeHours": 1.267,
  "workflow": {
    "path": ".github/workflows/fetch_uk_energy_and_prices_v6.yml",
    "exists": true,
    "hasWorkflowDispatch": true,
    "hasCronSchedule": true,
    "manualOnly": false
  },
  "confirmedScheduledLiveVersion": true
}

## Apply guardrail

Apply mode is deliberately not run here. The intended fix is to retire deprecated tracker routes v2 through v5 in favour of `/uk_energy_tracking_v6/`, without adding old cron schedules and without touching data files.

## Changed files


## Checks

| Check | Result |
|---|---|
| audit_covers_v2_to_v5 | ✅ |
| v6_is_confirmed_scheduled_live_version | ✅ |
| deprecated_versions_do_not_have_cron | ✅ |
| timestamp_mask_checked_for_each_version | ✅ |
| imports_exports_bucket_checked_for_each_version | ✅ |
| audit_does_not_modify_data_files | ✅ |
| manifest_written | ✅ |

## Rollback

Revert the apply commit. Apply must touch only deprecated tracker UI or routing files, never data files.
