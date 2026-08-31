# Retired: the decade summary lives in the data repository

A summary derived here was a second definition of numbers another repository
already owns.

The estate's rule, from `UI_CHARTS_MIGRATION_SCOPE.md`, is **data before
charts**: a consumer reads a data product that already sits clean, and must
never own source data or become a second source of truth.

The product is now:

    Ventusltd/data-gb-electricity
      derived/price-decade-rollup.json
      derived/build_price_decade_rollup.py
      .github/workflows/refresh_price_decade_rollup.yml

It is aggregated from that repository's own Parquet and refreshed by one
workflow chained to the monthly update already scheduled there — not by
unfreezing any of the 240 workflows in this repository, which were frozen to
manual for good reason.

Read it from
`https://raw.githubusercontent.com/Ventusltd/data-gb-electricity/main/derived/price-decade-rollup.json`,
which is what `gridatlas` does.

Nothing derived from GB electricity data should be defined in this directory
again.
