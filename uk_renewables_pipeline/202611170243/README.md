# GlobalGrid2050 Pipeline News V9.31

Edition `202611170243`, parent V9.30 `202611170147`. Exactly two principal blocks and the existing six category tabs. The Prices tab adds the qualified daily historical system-sell series from the existing electricity data owner. It defaults to the final 30 source dates, currently 2-31 October 2026, rather than implying present-day freshness. The original electricity workspace stays independently linked.

High, available mean and low retain the original V6 canvas appearance. Missing days break lines, negative values remain negative and partial source days have hollow markers. Visible counters distinguish complete/partial/missing dates, observed/priced/expected periods and inherited UTC disagreement. The window summary labels its unweighted mean of available daily means. There is no interpolation, timestamp repair, intraday certification, forecast or realtime quote.

The edition pins four reviewed runtime files and a separate immutable index. Only selected annual JSON parts are fetched. Source failure withholds results and leaves original workspace/source links usable. Existing DC source/action controls, all official REPD rows, ordered Solar-1000, full CSV and original MAP routes remain unchanged.

Validate `bash tests/run_v9_31.sh` and the independent host suite under `automation/v931_preview/`. Public source, owner promotion, exact served root and rollback are separate gates. Native-handset certification remains unavailable.
