# UK Energy Tracking V5

## Purpose

`uk_energy_tracking_v5` is the isolated development twin of the stable UK live grid tracker.

The stable tracker remains the reference point. V5 is used for new transport energy work, DESNZ road fuel prices, EV charging comparison logic and experimental UI changes.

## Design rule

V5 must mirror the stable tracker where it provides core grid tracking, but must remain independent where new features are being developed.

The stable tracker must not be touched when testing V5 changes.

## Where V5 mirrors the stable tracker

V5 keeps the same core dashboard concepts:

- GB electricity demand
- electricity price
- carbon intensity
- generation mix
- commodity price signals
- oil price trend
- SCADA style visual presentation
- public source attribution

V5 also mirrors the stable tracker update cadence:

- energy refresh workflow runs every 5 minutes
- price script self regulates on a 30 minute cadence
- manual workflow dispatch can still force energy, price or both

The V5 workflow is:

```text
.github/workflows/fetch_uk_energy_and_prices_v2.yml
```

It uses the same automation pattern as the stable tracker, but writes only into the V5 folder.

## Where V5 is independent

V5 has its own page:

```text
uk_energy_tracking_v5/index.md
```

V5 has its own live JSON feeds:

```text
uk_energy_tracking_v5/live_grid_energy.json
uk_energy_tracking_v5/live_grid_price.json
uk_energy_tracking_v5/live_oil_prices.json
uk_energy_tracking_v5/oil_price_history.geojson
uk_energy_tracking_v5/live_uk_fuel_prices.json
uk_energy_tracking_v5/ev_charging_prices.json
```

V5 has its own updater scripts:

```text
scripts/update_uk_energy_v2.py
scripts/update_uk_price_v2.py
scripts/update_oil_prices_v2.py
scripts/update_uk_fuel_prices_v2.py
```

The V5 energy script writes to:

```text
uk_energy_tracking_v5/live_grid_energy.json
```

The V5 price script writes to:

```text
uk_energy_tracking_v5/live_grid_price.json
```

This means V5 can fail without corrupting the stable tracker data files.

## Current convergence

V5 is converging with the stable tracker in these areas:

- same core grid data model
- same Elexon generation source
- same Sheffield Solar source
- same carbon intensity source
- same Elexon market price source
- same five minute automation cadence
- same manual trigger pattern
- same GridBot authenticated workflow identity
- same GitHub Pages deployment layer

V5 diverges in these areas:

- V5 has transport energy logic
- V5 includes DESNZ road fuel price cards
- V5 includes Brent crude to pump price explanatory logic
- V5 includes fuel duty and VAT source links
- V5 includes EV charging tariff placeholders
- V5 embeds the Atlas V8 reference map while the exact EV layer path is verified

## Transport energy mandate

The V5 transport layer is intended to compare:

- Brent crude in USD per barrel
- petrol in pence per litre
- diesel in pence per litre
- electricity in pounds per Megawatt hour
- EV charging in pence per kilowatt hour
- operator tariffs and retail charging margins

The purpose is to show that oil and wholesale electricity affect retail prices indirectly, while duty, VAT, logistics, land rent, charger utilisation, grid costs and operator margin create the real retail gap.

## Current known limitations

The stable tracker pump price cards intentionally remain blank.

V5 is where pump and EV work should continue.

The EV charging tariff file is currently a curated placeholder until reliable operator tariff values are inserted.

The Atlas V8 EV layer is currently embedded as a reference iframe. The exact reusable EV charging layer path should be verified before copying any map layer logic into V5.

## Workflow operations

Manual V5 grid update:

```text
Actions -> fetch_uk_energy_and_prices_v2 -> Run workflow -> slice = both
```

Scheduled V5 grid update:

```text
cron: */5 * * * *
```

V5 transport patch workflow:

```text
.github/workflows/patch_uk_energy_tracking_v5_transport.yml
```

V5 isolation workflow:

```text
.github/workflows/isolate_uk_energy_tracking_v5.yml
```

## Recovery rule

If V5 breaks, compare against the stable tracker:

```text
uk_energy_tracking/index.md
uk_energy_tracking/live_grid_energy.json
uk_energy_tracking/live_grid_price.json
```

Then fix only V5:

```text
uk_energy_tracking_v5/index.md
uk_energy_tracking_v5/*.json
scripts/*_v2.py
.github/workflows/*_v2.yml
```

Do not patch the stable tracker when diagnosing V5.

## Approval rule

AI creates scripts and workflows.

Vikram manually triggers workflows and tests live pages.

GridBot is the authenticated GitHub automation identity, not automatic approval.
