# V5 News Signal discipline

The V5 table keeps the official REPD status and headline-derived intelligence separate.

- `REPD STATUS` is read directly from `dist/repd_master.json`.
- `NEWS SIGNAL` is derived only from a matched newspaper headline.
- A news signal never overwrites, confirms or mutates the REPD status.
- `APPROVED*`, `OPERATIONAL*`, `CONSTRUCTION*`, `FINANCED*` and `M&A*` mean only that a matched headline reports that event.
- The asterisk means `headline-derived; not REPD-confirmed`.
