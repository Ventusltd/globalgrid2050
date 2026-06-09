# Generation History V6 and V6 2 Comparison and Backup Status

Status: active comparison note
Date: 2026 06 09
Scope: `uk_energy_tracking_v6/generation_history` and `uk_energy_tracking_v6_2/generation_history`

## Primary working page

`/uk_energy_tracking_v6/generation_history/`

This is the original working Generation History V6 page.

Active engineering work continues here unless Vikram explicitly changes direction.

Current working historic source:

`/data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json`

This source is the known working FUELHH daily MW spine and restores Wind 12 month and 10 year charts.

## Backup mirror page

`/uk_energy_tracking_v6_2/generation_history/`

This is now labelled as:

`Generation History V6 2 Backup Mirror`

Its purpose is comparison, fallback and recovery memory. It is not the primary working route.

V6 2 has been made safer by pointing its `dailyHistory` to the same known working FUELHH full spine:

`/data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json`

This avoids the earlier missing slim file failure.

## Important difference

Original V6 uses global names such as:

`V6GenerationHistoryConfig`

`V6LoadGenerationHistoryData`

`V6RenderGenerationHistoryChart`

`V6ControlGenerationHistory`

V6 2 uses clone specific global names such as:

`V62GenerationHistoryConfig`

`V62LoadGenerationHistoryData`

`V62RenderGenerationHistoryChart`

`V62ControlGenerationHistory`

Do not copy JavaScript between the two routes without checking these names.

## Operating rule

Work in original V6.

Keep V6 2 as backup mirror.

Do not repoint either route to a slim FUELHH browser file until that file exists, is committed and has an audit report proving non zero rows.

## Solar rule

Do not force FUELHH Solar as national Solar.

Solar must be a separate source layer, most likely PVLive, and should be marked as:

`PVLIVE EMBEDDED ESTIMATE`

The Solar Pipeline remains capacity and project intelligence, not live MW output.

## Verification checklist

For original V6:

* Wind 12 months should return records.
* Wind 10 years should return records.
* Wind 12 hours day should use recent generation records.

For V6 2 backup mirror:

* Page should clearly state it is a backup mirror.
* It should link back to the original V6 page.
* It should not be used for first implementation of new Solar or FUELHH wiring.

## Final instruction for future AI threads

If you are catching up, do not treat V6 2 as the active development page. Use V6 2 as a backup and comparison copy. Work on original V6 only unless Vikram explicitly instructs otherwise.
