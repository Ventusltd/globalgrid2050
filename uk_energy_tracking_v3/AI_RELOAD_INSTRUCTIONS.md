# AI Reload Instructions for UK Energy Tracking V3

Read this file first when restarting work on the UK Energy Tracking V3 page.

## Core rule

Do not touch the stable tracker unless Vikram explicitly asks.

The stable tracker is:

```text
uk_energy_tracking/
https://globalgrid2050.com/uk_energy_tracking/
```

It is the live reference twin and correction source.

V3 is:

```text
uk_energy_tracking_v3/
https://globalgrid2050.com/uk_energy_tracking_v3/
```

It is the isolated development twin for transport energy, DESNZ road fuel prices and EV charging comparison.

## GridBot rule

Use GridBot authenticated workflows for execution.

AI prepares scripts, workflows, manifests, documentation and reports.

Vikram manually triggers workflows and tests the live pages.

GridBot authentication is technical execution authority, not human approval.

## Two GridBot meanings

1. GridBot authenticated workflow identity

Use this for live data pipelines and documentation generation:

```text
Python script -> GitHub Action -> JSON or markdown output -> GridBot commit
```

2. Old GridBot Feature Installer

Use this only for complex controlled app patches where a manifest is safer:

```text
feature_requests -> manifest.yml -> installer workflow -> report
```

Do not use the old feature installer for routine data feeds.

## V3 working files

Main page:

```text
uk_energy_tracking_v3/index.md
```

V3 documentation:

```text
uk_energy_tracking_v3/README.md
uk_energy_tracking_v3/AI_RELOAD_INSTRUCTIONS.md
uk_energy_tracking_v3/WORK_DIARY.md
uk_energy_tracking_v3/DIAGNOSTIC_NOTES.md
```

V3 feeds:

```text
uk_energy_tracking_v3/live_grid_energy.json
uk_energy_tracking_v3/live_grid_price.json
uk_energy_tracking_v3/live_oil_prices.json
uk_energy_tracking_v3/oil_price_history.geojson
uk_energy_tracking_v3/live_uk_fuel_prices.json
uk_energy_tracking_v3/ev_charging_prices.json
```

V3 scripts:

```text
scripts/update_uk_energy_v2.py
scripts/update_uk_price_v2.py
scripts/update_oil_prices_v2.py
scripts/update_uk_fuel_prices_v2.py
scripts/isolate_uk_energy_tracking_v3.py
scripts/patch_uk_energy_tracking_v3_transport.py
scripts/document_uk_energy_trackers.py
```

V3 workflows:

```text
.github/workflows/fetch_uk_energy_and_prices_v2.yml
.github/workflows/isolate_uk_energy_tracking_v3.yml
.github/workflows/patch_uk_energy_tracking_v3_transport.yml
.github/workflows/document_uk_energy_trackers.yml
```

## Recovery method

If V3 breaks:

1. Compare V3 against the stable tracker.
2. Inspect V3 JSON feeds.
3. Inspect V3 scripts.
4. Inspect V3 workflows.
5. Patch only V3.
6. Do not change the stable tracker.

## Manual trigger sequence

For V3 grid data:

```text
Actions -> fetch_uk_energy_and_prices_v2 -> Run workflow -> slice = both
```

For documentation:

```text
Actions -> document_uk_energy_trackers -> Run workflow
```

For transport patching:

```text
Actions -> patch_uk_energy_tracking_v3_transport -> Run workflow
```

## Current mandate

V3 should mirror the stable tracker for core grid behaviour while adding:

```text
DESNZ weekly road fuel prices
petrol pence per litre
diesel pence per litre
Brent crude to pump price logic
fuel duty and VAT source links
EV charging tariff comparison
Atlas V8 EV reference
```

The stable tracker pump cards may remain blank by design.


## V3 reload note

V3 is the experimental build. New energy graph and price history work should happen here first. Do not disturb V2 unless Vikram approves promotion.
