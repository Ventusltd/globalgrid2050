# Generation History V6 Thread Catch Up Log

Status: active handover log
Folder: `uk_energy_tracking_v6/generation_history`
Route: `/uk_energy_tracking_v6/generation_history/`
Date: 2026 06 09

## Current live page identity

The screenshots showing Wind rendering again are from the original Generation History V6 route:

`/uk_energy_tracking_v6/generation_history/`

This is the working page to protect.

There is also a cloned route:

`/uk_energy_tracking_v6_2/generation_history/`

Do not assume V6 2 is the working graph. V6 2 currently exists as a clone and development route, but its `live-config.js` has pointed at the slim browser file path. If that slim file is missing, V6 2 can show 0 records. The original V6 page is the restored working graph.

## Current working data source

The original V6 graph is working because `dailyHistory` points to the canonical full FUELHH daily MW spine:

`/data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json`

This file is heavy, but it exists and currently restores Wind for 12 month and 10 year views.

Do not repoint `dailyHistory` to a slim file until the slim file has been built, committed and audited.

## Visual proof from user screenshots

The user provided screenshots showing:

* Wind, 12 months, 357 records, 2025 06 09 to 2026 06 09
* Wind, 10 years, 3,644 records, 2016 06 09 to 2026 06 09
* Wind, 12 hours day, recent, 24 records, 2026 06 01

This means the graph rendering, FUELHH historic route and recent generation route are alive again.

## Do not repeat the known mistake

A previous failure happened because `dailyHistory` was pointed to:

`/uk_energy_tracking_v6/generation_history/generation_daily_fuelhh_browser_slim.json`

before that file existed. This caused Wind to show 0 records.

The correct rule is:

File first. Audit second. Config third. UI test fourth.

## Solar strategy

FUELHH is not national Solar.

Solar must be handled as a separate source layer, most likely PVLive, and marked as:

`PVLIVE EMBEDDED ESTIMATE`

The Solar Pipeline is capacity and project intelligence, not live MW output.

## Current instruction for future AI threads

1. Preserve the original V6 graph route.
2. Treat `/uk_energy_tracking_v6/generation_history/` as the working page.
3. Treat `/uk_energy_tracking_v6_2/generation_history/` as a development clone until tested.
4. Do not break Wind while adding Solar.
5. Do not repoint `dailyHistory` unless the target JSON exists and has audited rows.
6. Use workflow driven scripts with reports for any data or UI change.
7. Do not restart deep research unless Vikram explicitly asks.

## Next safe work

The next safe work is not another blind config change.

The safe order is:

1. Fetch PVLive solar candidate through workflow and audit.
2. Build PVLive browser solar JSON through workflow and audit.
3. Wire Solar selection to PVLive only after the browser file exists.
4. Later, build and audit the slim FUELHH browser file.
5. Only then consider repointing `dailyHistory` from the full FUELHH spine to the slim browser file.
