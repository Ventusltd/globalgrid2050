# Diary note: 2026-05-26 missed price history updates

## Cause of miss

The first merge patch correctly changed the inline price history chart to read the historical Elexon System Price CSV, but I failed to apply the same source alignment to `price-history-fullscreen.js`.

That meant the normal chart moved to the larger historical dataset, while the full screen chart remained on the V5 captured JSON file only and therefore still showed 4 records.

## Secondary causes

```text
I treated the full screen chart as a visual extension of the main chart instead of auditing it as a separate data consumer.
I did not re-open index.md after preparing the date window workflow, so I missed that the live page still had no From and To date controls.
I allowed duplicated chart loading logic to remain in price-history-ui.js and price-history-fullscreen.js, which created drift.
I assumed the range problem was mainly a UI selector issue, when the deeper issue was data source alignment and the actual depth of the historical CSV.
I did not fully correct the panel label before user testing, so it still implied captured Market Index only while the chart was starting to include System Prices.
```

## Corrective rule

```text
Every future V5 price history patch must inspect index.md, price-history-ui.js and price-history-fullscreen.js together.
Any data source change must be applied to both inline and full screen chart paths.
Any UI control added by a patch must be verified in index.md before telling the user to run it.
Any historical range claim must be checked against the earliest timestamp in data/electricity/elexon_system_prices_half_hourly.csv.
The next deeper refactor should remove duplicate loading logic and create one shared source loader used by both charts.
```

## Current corrective patch

```text
scripts/patch_v5_price_range_fullscreen_fix.py
```

This patch has now been amended to:

```text
load both historical CSV and captured JSON in full screen mode
add From and To date controls
cap custom date windows at 60 days
use millisecond based rolling cutoffs
highlight priceHealth warnings
correct the panel wording away from captured Market Index only language
```

## Operational note

The main `WORK_DIARY.md` should receive this same note in the next diary maintenance pass. This addendum was committed separately to avoid overwriting the long diary file during active patch work.
