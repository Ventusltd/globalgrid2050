# Generation History Development and Comparison Log

Updated UTC: 2026 06 07
Scope: `uk_energy_tracking_v6_2_2/generation_history/`
Reference module: `uk_energy_tracking_v6_2/price_history_chart/`
Status: development log only. No data repair is performed by this file.

## Purpose

This log records why the isolated V6 2 generation history module performed badly compared with the working V6 2 electricity price history chart.

The generation page must now be brought back under the same procedural loading discipline as the V6 2 price chart.

## Current problem

The generation history module was built visually before the data architecture had reached the same maturity as the price history module.

The working price chart is smooth because it does not load the whole historical dataset into the browser at once.

The generation chart became slow because it can request a very large raw half hourly CSV and then ask the browser to parse and filter too much data on the main thread.

## Working V6 2 price chart pattern

The price chart uses a layered data model.

Short and medium half hourly windows load only the required annual CSV files.

Long range views such as 12 months, 5 years and 10 years load a small daily decade JSON file.

The price loader has a `norm()` stage which sorts rows and removes duplicates before rendering.

The price chart is naturally single series: one timestamp, one price value, one line.

Important reference behaviours from the price loader:

`cache={annual:{},daily:null,capture:null}` is used to avoid repeated fetches inside one browser session.

`loadAnnual(year)` loads `/data/electricity/elexon_system_prices_YEAR.csv`.

`loadDaily()` loads `/uk_energy_tracking_v6_2/electricity_price_history_daily_decade.json`.

`loadWindow(start, period, timeMode)` chooses daily mode for 12 month, 5 year and 10 year views, otherwise half hourly mode.

`norm()` sorts and dedupes rows before display.

## Generation module divergence

The generation module currently does not yet follow the price chart pattern with equal discipline.

The page can load a large raw generation file where the browser should instead receive a small daily aggregate for long views or a small recent half hourly slice for short views.

Generation data is multi technology by nature. A single timestamp can have solar, wind, gas, nuclear, biomass, hydro, coal, pumped storage and interconnector values.

A single line renderer must not be handed mixed technology rows unless those rows have first been reduced into one valid signal.

The earlier `All` behaviour was invalid because it treated multiple technologies at the same timestamp as one continuous line.

## Confirmed current repo state

`control_generation_history.js` has been changed so the landing view defaults to 12 months and resize redraws the cached result rather than calling a full refresh.

`load_generation_history_data.js` is still the older loader at the time this log was written. It does not yet contain the proposed total generation `All` handling or a proper price style `norm()` equivalent.

The renderer has been reverted to a simple single line renderer and should remain frozen until the data path is correct.

## Why loading 97 MB is wrong

A 97 MB raw CSV should not be the landing page data source.

Even if it is cached after first fetch, the browser still has to download it, parse it and hold too many row objects in memory.

This is exactly what the V6 2 price chart avoids by using pre aggregated daily data for long views.

The generation chart must not load raw half hourly data unless the selected period genuinely requires it.

For short windows, the proper future design is a small recent half hourly slice file, equivalent to the price module live or captured buffer.

## Correct generation data contract

The generation module should use the same three tier idea as the price module.

Tier 1: recent generation buffer for short windows.

Tier 2: annual calendar year generation CSVs for controlled half hourly history.

Tier 3: daily generation decade JSON for 12 month, 5 year and 10 year views.

The daily generation JSON should be keyed by date and technology:

`date`

`technology`

`highMW`

`averageMW`

`lowMW`

`records`

`source`

## Correct rendering contract

Single technology mode is safe:

one timestamp or date

one selected technology

one value

one line

All mode is not safe unless it is transformed first.

There are only two valid All modes:

Total generation mode: sum all technologies at each timestamp or date, then draw one total line.

Multi series mode: draw one line per technology using a real multi series renderer.

The current renderer is single series. Therefore the only safe All behaviour for now is total generation.

## Immediate fix sequence

Step 1: Keep the simple renderer frozen.

Step 2: Replace the generation loader with a price style loader that sorts rows, dedupes rows and makes All mean total generation, not mixed rows.

Step 3: Keep the default landing view on 12 months so the page starts from the smaller daily aggregate instead of raw half hourly CSV.

Step 4: Build or verify true calendar year files for generation.

Step 5: Build a small recent half hourly generation slice so short views do not require a large raw file.

Step 6: Only after data is fast and correct, reintroduce seasonal colours and multi series All mode.

## What must not happen again

Do not polish UI while the loader is unsafe.

Do not hand mixed technology rows to a single line renderer.

Do not make the default page load depend on a very large raw CSV.

Do not treat a master dump as a clean calendar year file.

Do not work on seasonal colours until the chart renders one valid signal correctly.

## Rollback anchors

The failed seasonal renderer was reverted in commit:

`034676fad9a87e424cbc8587aa37c960ee42132e`

The control layer instant landing change was committed in:

`5338506fa0ae3940ebeff29e8794333f3d8640d9`

This log was added after those commits to restore development discipline before further changes.

## Current rule

Data truth first.

Procedural loading second.

Single valid signal third.

Visual power last.
