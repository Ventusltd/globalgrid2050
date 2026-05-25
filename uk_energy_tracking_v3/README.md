# UK Energy Tracking V3

## Purpose

`uk_energy_tracking_v3` is the isolated development twin of the stable UK live grid tracker.

The stable tracker remains the reference point. V3 is used for new transport energy work, DESNZ road fuel prices, EV charging comparison logic and experimental UI changes.

## Design rule

V3 must mirror the stable tracker where it provides core grid tracking, but must remain independent where new features are being developed.

The stable tracker must not be touched when testing V3 changes.

## Where V3 mirrors the stable tracker

V3 keeps the same core dashboard concepts:

- GB electricity demand
- electricity price
- carbon intensity
- generation mix
- commodity price signals
- oil price trend
- SCADA style visual presentation
- public source attribution

V3 also mirrors the stable tracker update cadence:

- energy refresh workflow runs every 5 minutes
- price script self regulates on a 30 minute cadence
- manual workflow dispatch can still force energy, price or both

The V3 workflow is:

```text
.github/workflows/fetch_uk_energy_and_prices_v2.yml
```

It uses the same automation pattern as the stable tracker, but writes only into the V3 folder.

## Where V3 is independent

V3 has its own page:

```text
uk_energy_tracking_v3/index.md
```

V3 has its own live JSON feeds:

```text
uk_energy_tracking_v3/live_grid_energy.json
uk_energy_tracking_v3/live_grid_price.json
uk_energy_tracking_v3/live_oil_prices.json
uk_energy_tracking_v3/oil_price_history.geojson
uk_energy_tracking_v3/live_uk_fuel_prices.json
uk_energy_tracking_v3/ev_charging_prices.json
```

V3 has its own updater scripts:

```text
scripts/update_uk_energy_v2.py
scripts/update_uk_price_v2.py
scripts/update_oil_prices_v2.py
scripts/update_uk_fuel_prices_v2.py
```

The V3 energy script writes to:

```text
uk_energy_tracking_v3/live_grid_energy.json
```

The V3 price script writes to:

```text
uk_energy_tracking_v3/live_grid_price.json
```

This means V3 can fail without corrupting the stable tracker data files.

## Current convergence

V3 is converging with the stable tracker in these areas:

- same core grid data model
- same Elexon generation source
- same Sheffield Solar source
- same carbon intensity source
- same Elexon market price source
- same five minute automation cadence
- same manual trigger pattern
- same GridBot authenticated workflow identity
- same GitHub Pages deployment layer

V3 diverges in these areas:

- V3 has transport energy logic
- V3 includes DESNZ road fuel price cards
- V3 includes Brent crude to pump price explanatory logic
- V3 includes fuel duty and VAT source links
- V3 includes EV charging tariff placeholders
- V3 embeds the Atlas V8 reference map while the exact EV layer path is verified

## Transport energy mandate

The V3 transport layer is intended to compare:

- Brent crude in USD per barrel
- petrol in pence per litre
- diesel in pence per litre
- electricity in pounds per Megawatt hour
- EV charging in pence per kilowatt hour
- operator tariffs and retail charging margins

The purpose is to show that oil and wholesale electricity affect retail prices indirectly, while duty, VAT, logistics, land rent, charger utilisation, grid costs and operator margin create the real retail gap.

## Current known limitations

The stable tracker pump price cards intentionally remain blank.

V3 is where pump and EV work should continue.

The EV charging tariff file is currently a curated placeholder until reliable operator tariff values are inserted.

The Atlas V8 EV layer is currently embedded as a reference iframe. The exact reusable EV charging layer path should be verified before copying any map layer logic into V3.

## Workflow operations

Manual V3 grid update:

```text
Actions -> fetch_uk_energy_and_prices_v2 -> Run workflow -> slice = both
```

Scheduled V3 grid update:

```text
cron: */5 * * * *
```

V3 transport patch workflow:

```text
.github/workflows/patch_uk_energy_tracking_v3_transport.yml
```

V3 isolation workflow:

```text
.github/workflows/isolate_uk_energy_tracking_v3.yml
```

## Recovery rule

If V3 breaks, compare against the stable tracker:

```text
uk_energy_tracking/index.md
uk_energy_tracking/live_grid_energy.json
uk_energy_tracking/live_grid_price.json
```

Then fix only V3:

```text
uk_energy_tracking_v3/index.md
uk_energy_tracking_v3/*.json
scripts/*_v2.py
.github/workflows/*_v2.yml
```

Do not patch the stable tracker when diagnosing V3.

## Approval rule

AI creates scripts and workflows.

Vikram manually triggers workflows and tests live pages.

GridBot is the authenticated GitHub automation identity, not automatic approval.
