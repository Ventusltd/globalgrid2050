# AI Reload Instructions for UK Energy Tracking V5

Read this file first when restarting work on the UK Energy Tracking V5 page.

## Core rule

Do not touch the stable tracker unless Vikram explicitly asks.

The stable tracker is:

```text
uk_energy_tracking/
https://globalgrid2050.com/uk_energy_tracking/
```

It is the live reference twin and correction source.

V5 is:

```text
uk_energy_tracking_v5/
https://globalgrid2050.com/uk_energy_tracking_v5/
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

## V5 working files

Main page:

```text
uk_energy_tracking_v5/index.md
```

V5 documentation:

```text
uk_energy_tracking_v5/README.md
uk_energy_tracking_v5/AI_RELOAD_INSTRUCTIONS.md
uk_energy_tracking_v5/WORK_DIARY.md
uk_energy_tracking_v5/DIAGNOSTIC_NOTES.md
```

V5 feeds:

```text
uk_energy_tracking_v5/live_grid_energy.json
uk_energy_tracking_v5/live_grid_price.json
uk_energy_tracking_v5/live_oil_prices.json
uk_energy_tracking_v5/oil_price_history.geojson
uk_energy_tracking_v5/live_uk_fuel_prices.json
uk_energy_tracking_v5/ev_charging_prices.json
```

V5 scripts:

```text
scripts/update_uk_energy_v2.py
scripts/update_uk_price_v2.py
scripts/update_oil_prices_v2.py
scripts/update_uk_fuel_prices_v2.py
scripts/isolate_uk_energy_tracking_v5.py
scripts/patch_uk_energy_tracking_v5_transport.py
scripts/document_uk_energy_trackers.py
```

V5 workflows:

```text
.github/workflows/fetch_uk_energy_and_prices_v2.yml
.github/workflows/isolate_uk_energy_tracking_v5.yml
.github/workflows/patch_uk_energy_tracking_v5_transport.yml
.github/workflows/document_uk_energy_trackers.yml
```

## Recovery method

If V5 breaks:

1. Compare V5 against the stable tracker.
2. Inspect V5 JSON feeds.
3. Inspect V5 scripts.
4. Inspect V5 workflows.
5. Patch only V5.
6. Do not change the stable tracker.

## Manual trigger sequence

For V5 grid data:

```text
Actions -> fetch_uk_energy_and_prices_v2 -> Run workflow -> slice = both
```

For documentation:

```text
Actions -> document_uk_energy_trackers -> Run workflow
```

For transport patching:

```text
Actions -> patch_uk_energy_tracking_v5_transport -> Run workflow
```

## Current mandate

V5 should mirror the stable tracker for core grid behaviour while adding:

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


## V5 reload note

V5 is the experimental build. New energy graph and price history work should happen here first. Do not disturb V2 unless Vikram approves promotion.
