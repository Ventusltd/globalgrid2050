# UK Energy Tracking V3 Work Diary

This file is a persistent engineering and AI continuity log for V3.

## Purpose

Maintain continuity across overloaded ChatGPT threads.

Track:

```text
what changed
why it changed
what failed
what recovered
which workflows exist
which scripts are authoritative
```

## Initial architecture

Stable tracker:

```text
uk_energy_tracking/
```

Development twin:

```text
uk_energy_tracking_v3/
```

V3 was created so experimental transport energy work would not damage the live public tracker.

## Major lessons learned

### Lesson 1

Do not share feed scripts between stable and V3.

Earlier versions accidentally pointed V3 and stable at the same JSON update logic which caused corruption risk.

Resolution:

```text
create isolated _v2 scripts
create isolated V3 workflows
create isolated V3 JSON outputs
```

### Lesson 2

Always preserve a working twin.

The stable tracker acts as:

```text
comparison source
recovery source
truth source
```

### Lesson 3

GitHub push races can break workflows.

Observed issue:

```text
remote rejected HEAD -> main
internal server error
fetch first
```

Resolution:

```text
stagger schedules
use git pull --rebase before push
separate V3 cadence
```

## Diary entry: 2026-05-25 workflow cadence diagnosis

### What was investigated

The last 24 hours of Git commits were reviewed to understand why the original 5 minute live update behaviour appears to have weakened after oil prices, V3 isolation, DESNZ fuel and EV charging work were added.

### What is working

The stable tracker at:

```text
uk_energy_tracking/
https://globalgrid2050.com/uk_energy_tracking/
```

is still working and still receives automated data commits.

Recent stable commit evidence includes:

```text
Automated UK grid update (both): 2026-05-25 10:43 UTC
Automated UK grid update (both): 2026-05-25 06:05 UTC
Automated UK grid update (both): 2026-05-25 01:35 UTC
```

V3 also recovered at least once after a failed push:

```text
Automated UK grid update V3 (both): 2026-05-25 09:12 UTC
```

This proves the V3 Python update scripts can run and can write V3 JSON feeds.

### What is not working as expected

The system no longer shows a clean rhythm that looks like a reliable 5 minute live update in the commit history.

Important correction: the workflow can run every 5 minutes without producing a Git commit every 5 minutes, because Git only commits when JSON content changes. However, the recent pattern shows larger gaps and workflow friction after additional workflows were introduced.

### Main suspected causes

1. The stable tracker workflow and V3 workflow both write to `main` frequently.
2. The oil workflow also writes to `main`.
3. GitHub Pages deploys after each commit.
4. Repo structure and documentation workflows may also run after commits.
5. Some workflows use direct tokenised push URLs while others use `origin`.
6. At least one V3 run reached the commit stage but failed during `git push` with a GitHub internal server error.
7. Earlier attempts also showed `fetch first` and push race behaviour.

### Current workflow split

Stable grid workflow:

```text
.github/workflows/fetch_uk_energy_and_prices.yml
cron: */5 * * * *
```

V3 grid workflow:

```text
.github/workflows/fetch_uk_energy_and_prices_v2.yml
cron: 2-59/5 * * * *
```

Oil workflow:

```text
.github/workflows/update_oil_prices.yml
cron: 30 5 * * *
```

Documentation workflow:

```text
document_uk_energy_trackers.yml
```

manual only

### Current interpretation

The original 5 minute system was simpler. It mostly had one frequent writer. After V3 and oil work, the repository now has multiple workflows pushing into the same branch. Even if each workflow is logically correct, they compete at Git level and can cause rejected pushes, stale checkouts or delayed commits.

The issue is therefore not mainly an API data problem. It is an automation orchestration problem.

### Current state classification

Stable tracker:

```text
working, should not be touched
```

V3 tracker:

```text
partly working, isolated, but automation cadence and push reliability need hardening
```

Oil update:

```text
separate concern, not required for core grid gauges, should not block grid updates
```

Documentation:

```text
manual support layer, should not run frequently or interfere with data feeds
```

### Recommended next technical step

Create a V3 only workflow hardening patch that does not touch the stable tracker.

The patch should:

```text
keep V3 offset from stable
use origin based push rather than explicit tokenised URL where possible
add retry around pull and push
stage only V3 JSON outputs
avoid running documentation or repo structure workflows as part of grid updates
```

### Recovery rule

If V3 breaks again, compare against stable but patch only V3:

```text
uk_energy_tracking_v3/index.md
uk_energy_tracking_v3/*.json
scripts/*_v2.py
.github/workflows/*_v2.yml
```

Do not modify:

```text
uk_energy_tracking/index.md
uk_energy_tracking/live_grid_energy.json
uk_energy_tracking/live_grid_price.json
```

## V3 features added

```text
Transport energy dashboard section
DESNZ fuel logic placeholders
fuel duty and VAT links
EV charging placeholder cards
Atlas V8 reference embed
oil chart UI improvements
```

## Current V3 status

Core goal:

```text
V3 should behave identically to stable for live grid values.
```

Experimental additions:

```text
transport energy
fuel logic
EV charging economics
future tariff comparison
```

## Important workflows

### Stable

```text
fetch_uk_energy_and_prices.yml
```

### V3

```text
fetch_uk_energy_and_prices_v2.yml
```

### Documentation

```text
document_uk_energy_trackers.yml
```

## Important scripts

### Stable

```text
update_uk_energy.py
update_uk_price.py
update_oil_prices.py
```

### V3

```text
update_uk_energy_v2.py
update_uk_price_v2.py
update_oil_prices_v2.py
update_uk_fuel_prices_v2.py
```

## Operating principle

Stable tracker:

```text
protected production twin
```

V3 tracker:

```text
experimental development twin
```

Never experiment directly on stable.

## Future direction

Planned V3 work:

```text
real DESNZ petrol prices
real DESNZ diesel prices
EV charging tariff ingestion
comparison economics
Brent to pump modelling
transport electrification visualisation
```


## Diary entry: 2026-05-25 V3 clone created

V3 was cloned from V2 as a controlled experimental build.

Purpose:

```text
V1 stable reference remains untouched.
V2 remains operational transport energy prototype.
V3 becomes the diary led experimental version for price history, graphs, diagnostics and competitor tracking comparison.
```

Operating rule:

```text
No wholesale rewrites.
One feature at a time.
One workflow at a time.
GridBot execution only.
Vikram triggers, tests and approves.
```

Next intended V3 feature:

```text
native electricity price history capture
last 7 days half hourly table
native one year price graph building from captured data only
no fake backfill
```

## Diary entry: 2026-05-25 16:46 IST tracker comparison and V3 production focus

### Comparison reviewed

The current tracker family is now understood as three related but separate layers.

Stable production tracker:

```text
uk_energy_tracking/
https://globalgrid2050.com/uk_energy_tracking/
```

This is the protected live reference. It contains the working SCADA style public grid tracker with electricity demand, electricity price, carbon intensity, generation mix, commodity price signals, oil trend and basic UK pump price cards. It should remain the correction and recovery source and should not be used for experimental development.

V2 tracker:

```text
uk_energy_tracking_v2/
https://globalgrid2050.com/uk_energy_tracking_v2/
```

This is the earlier isolated transport energy development twin. It already established the rule that the stable tracker must not be touched while DESNZ road fuel prices, petrol and diesel cards, Brent crude to pump price logic, fuel duty, VAT links, EV charging tariff comparison and Atlas V8 reference work are developed.

V3 tracker:

```text
uk_energy_tracking_v3/
https://globalgrid2050.com/uk_energy_tracking_v3/
```

This is now the current production focus for experimental development. V3 inherits the protected twin logic from V2 but becomes the main diary led build for price history, graphing, diagnostics, competitor tracking comparison and independent validation of electricity price accuracy.

### Current production focus

V3 should become the active proving layer for live electricity price validation while the stable tracker remains untouched.

The priority is no longer only showing the latest live electricity price. The system now needs to retain the live price with a timestamp, place each captured value into a structured history table and then create graphable records that can be reviewed over time.

### Required next feature

Create a V3 only electricity price history system.

The feature should:

```text
capture the live electricity price
capture the exact timestamp of each price value
write each timestamped value into a structured table
make the table downloadable or exportable as an Excel compatible file
create a graph of the captured electricity price history
add a dropdown selector for time ranges
track at least 12 months of price history
support independent validation of live electricity price accuracy
avoid fake historical backfill
build the 12 month record only from captured data going forward
keep the stable tracker untouched
```

### Suggested file direction

Potential V3 only files:

```text
uk_energy_tracking_v3/electricity_price_history.csv
uk_energy_tracking_v3/electricity_price_history.json
uk_energy_tracking_v3/electricity_price_history.xlsx or Excel compatible CSV export
```

Potential UI additions inside V3 only:

```text
electricity price history graph
range dropdown: 24 hours, 7 days, 30 days, 3 months, 6 months, 12 months
price history table with timestamp, price, source timestamp and update timestamp
Excel download link
validation note explaining that the record is independently accumulated from live captured values
```

### Validation purpose

The purpose is to independently validate the accuracy and behaviour of the electricity price feed over time. Each live value must be traceable to its timestamp. The table and graph should make it possible to compare displayed values, captured values and later external reference values.

### Operating rule

Patch only V3. Do not touch:

```text
uk_energy_tracking/index.md
uk_energy_tracking/live_grid_energy.json
uk_energy_tracking/live_grid_price.json
```

V3 remains the controlled test bed. Vikram reviews and approves promotion only after the V3 feature works cleanly.

## Diary entry: 2026-05-25 V3 price history table dark UI patch

Purpose:

```text
repair the electricity price history table UI on mobile and desktop
keep the V3 development tracker isolated
avoid touching the stable tracker
```

Issue observed:

```text
The V3 price history table rendered with a white table background while the rest of the SCADA page remained dark.
The graph also risked overflowing on mobile if the external stylesheet was not loaded properly.
The table made the page visually heavy because it exposed raw records directly under the graph.
```

Patch method:

```text
remove the late CSS import from the inline style block
insert a normal stylesheet link for /uk_energy_tracking_v3/price-history-ui.css
rewrite the price history CSS with scoped high specificity rules under #electricity-price-history-panel
force dark table background, dark rows, cyan headings and readable body text
make the chart width responsive so it fits inside the page container
move the raw records table inside a closed details dropdown by default
retain CSV download for full data review
```

Files intentionally changed by GridBot workflow:

```text
uk_energy_tracking_v3/index.md
uk_energy_tracking_v3/price-history-ui.css
uk_energy_tracking_v3/WORK_DIARY.md
```

Stable tracker rule:

```text
No changes to uk_energy_tracking/.
```

## Diary entry: 2026-05-25 V3 price history correctness patch

Purpose:

```text
correct V3 price history graph and table behaviour without touching the stable tracker
```

Patch method:

```text
keep /uk_energy_tracking_v3/electricity_price_history.json as the active captured history source
disable the planned future CSV feed until deliberately built
add an All captured data range option
make the graph use timestamp based x axis spacing
show no data in selected range instead of silently falling back to all data
render all rows in the selected range inside the dropdown table, newest first
align the table to 5 columns: settlement time, price, settlement period, captured UTC and carbon or health
make canvas sizing responsive to the displayed CSS size
scope all table and chart CSS under #electricity-price-history-panel
```

Files intentionally changed by GridBot workflow:

```text
uk_energy_tracking_v3/index.md
uk_energy_tracking_v3/price-history-ui.js
uk_energy_tracking_v3/price-history-ui.css
uk_energy_tracking_v3/WORK_DIARY.md
```

Stable tracker rule:

```text
No changes to uk_energy_tracking/.
```

## Diary entry: 2026-05-25 V3 price history full screen chart patch

Purpose:

```text
add a large full screen electricity price history chart with zoom and pan while keeping the stable tracker untouched
```

Patch method:

```text
add full screen chart button
add full screen overlay and large canvas
load V3 captured electricity price history JSON
support wheel zoom, drag pan, reset and close
use canvas redraw with requestAnimationFrame and GPU friendly CSS compositing hints
```

## Diary entry: 2026-05-26 post patch review of V3 price history UI

### Files reviewed

```text
uk_energy_tracking_v3/index.md
uk_energy_tracking_v3/price-history-ui.js
uk_energy_tracking_v3/price-history-ui.css
uk_energy_tracking_v3/price-history-fullscreen.js
uk_energy_tracking_v3/electricity_price_history.json
```

### Current confirmed state

The V3 page now has the external stylesheet link for:

```text
/uk_energy_tracking_v3/price-history-ui.css
```

The old late CSS import inside the inline style block has been removed. This is important because late CSS imports inside populated style blocks can be ignored by browsers or lose ordering against site theme rules.

The electricity price history panel now includes:

```text
24 hours
7 days
30 days
3 months
6 months
12 months
10 years
All captured data
```

The raw captured records table is now inside a closed dropdown using:

```text
<details class="price-history-table-toggle">
```

The table now has 5 aligned columns:

```text
Settlement time
Price GBP/MWh
Settlement period
Captured UTC
Carbon / health
```

The main price history script now treats:

```text
/uk_energy_tracking_v3/electricity_price_history.json
```

as the active captured history source. The future CSV feed is explicitly disabled through:

```text
var ENABLE_CSV_FEED = false;
```

This means V3 is no longer silently requesting a missing CSV path during normal chart operation.

### Current data logic

The live price remains separate from the captured historical record.

```text
live_grid_price.json
```

is the latest live Elexon market price layer.

```text
electricity_price_history.json
electricity_price_history.csv
```

are the V3 captured evidence trail built from observed values over time.

This distinction must remain. The graph and dropdown table are history views. The main gauge is the live value view.

### Correctness improvements now in place

The chart now positions points using timestamp spacing rather than row index spacing. This matters because a 4 hour capture gap and a 1 hour capture gap should not appear equally wide on the x axis.

The range selector no longer silently falls back to all history when a selected range has no values. It now shows an empty state for the selected range.

The dropdown table now renders all rows in the selected range, newest first. This allows the user to scroll back as far as the retained data goes when All captured data is selected.

The canvas backing size now follows the displayed CSS size, reducing blur and avoiding the previous mismatch between CSS height and JavaScript height.

### Full screen chart review

The full screen chart patch has added:

```text
Full screen chart button
full screen overlay
large canvas
wheel zoom
button zoom
reset view
drag pan
Esc close
```

The chart loads the same V3 captured JSON file and applies the currently selected range before opening. This means the main selector still governs the full screen view.

The full screen chart is still a 2D canvas implementation. It uses requestAnimationFrame during pan and CSS compositing hints such as translateZ and will-change, but it is not a true WebGL or MapLibre style GPU chart. That distinction is important for future design.

### Limitations observed

The full screen JavaScript is compact and functional but not as readable as the main V3 script. A later maintenance patch should unminify it into a cleaner form before adding more features.

The current full screen zoom does not clamp panning to the first and last retained timestamps. This means the user may pan beyond the available data range and see an empty or sparse view. This is acceptable for a prototype but should be tightened later.

The current full screen chart does not yet support pinch distance zoom with 2 simultaneous touch points. It supports wheel zoom and pointer drag, which is sufficient for desktop testing.

The current full screen chart has no tooltip or nearest point inspector. For validation work, the next useful chart feature is a cursor readout showing timestamp, price, settlement period and captured time.

The full screen chart does not yet downsample very large retained records. This is fine for the current small V3 captured dataset, but a 12 month or 10 year half hourly record will require level of detail or sampling logic.

### Next recommended technical patch

Do not add more visual features before hardening the V3 automation path.

The next recommended patch should be:

```text
V3 workflow hardening patch
```

Target files should be limited to:

```text
.github/workflows/fetch_uk_energy_and_prices_v2.yml
scripts/update_uk_energy_v2.py
scripts/update_uk_price_v2.py
```

Only include script changes if needed after inspection. If the issue is purely GitHub orchestration, patch only the workflow.

The workflow hardening should:

```text
keep V3 offset from stable
use explicit concurrency for main writing
stage only V3 JSON and price history output files
avoid broad git add commands
pull with rebase before pushing
retry push on failure
avoid documentation updates in the live data path
preserve live and captured history separation
```

### Standing rule after this review

The current V3 price history UI should now be treated as a working prototype layer. Further development should be split into 3 separate future tracks:

```text
workflow reliability
chart inspection features
future official historical Elexon feed
```

Do not mix those tracks into 1 patch.

## Diary preflight: 2026-05-26 00:27 UTC GridBot V3 workflow start

```text
feature: merge_system
purpose: prepare merged historical Elexon System Price and captured Market Index view
rule: read WORK_DIARY before changing files, commit diary preflight first, then run the selected V3 patch
stable tracker: do not touch uk_energy_tracking/
```


## Diary entry: 2026-05-26 V3 merged price source patch

Merged the existing Elexon historical system price CSV with the V3 captured live Market Index trail. The chart and dropdown now use historical context plus new live captured rows, while the live gauge remains separate. System Prices and Market Index Prices remain labelled as different price products.

## Diary entry: 2026-05-26 merge system workflow verification

Verification after running GridBot V3 consolidated price history with feature merge_system.

Confirmed commits:

```text
4ab2123acf11bef22c906aba53d2c753b87e2d81 GridBot V3 diary preflight
4325b77e5e0775feca4f69b3964e6c10edefa94e GridBot V3 price history patch
```

Confirmed result:

```text
uk_energy_tracking_v3/price-history-ui.js now enables the CSV feed
CSV_URL now points to /data/electricity/elexon_system_prices_half_hourly.csv
mergeSystemAndCapturedRows now merges Elexon System Price rows with V3 captured Market Index rows
source card now reports Historical Elexon System Prices plus V3 captured Market Index when CSV rows exist
WORK_DIARY was updated by the workflow itself
```

Confirmed historical source exists:

```text
data/electricity/elexon_system_prices_half_hourly.csv starts at 2026-04-25 settlement period 1 and contains half hourly Elexon BMRS System Prices
```

Interpretation:

```text
The V3 chart and dropdown should now move from the small captured only record count to the much larger historical Elexon System Price record set plus new live captured Market Index records.
The live gauge remains separate and should still be treated as the live price feed.
System Prices and Market Index Prices are different price products, so this merged view is for historical context and price proofing, not a claim that both products are identical.
```

Remaining issue:

```text
The date window controls have not been verified in this workflow run because the selected feature was merge_system.
Run the consolidated workflow with feature date_window next if the page still needs calendar based inspection capped to 60 days.
```


## Diary entry: 2026-05-26 V3 range and full screen correction amended before run

Amended before execution after code review. The patch now aligns full screen with the inline chart by loading both the historical Elexon system price CSV and the V3 captured JSON. It adds From and To date controls capped to 60 days, changes rolling cutoffs to millisecond based UTC comparisons, surfaces priceHealth warnings before carbon values in the table health column and highlights warned rows. It also fixes the label so the panel is not described as captured Market Index only when historical System Prices are present.


## Diary entry: 2026-05-26 V3 selected range axis and fullscreen simplification patch

This patch makes the selected date window govern the x axis rather than allowing the chart to collapse to only the earliest and latest available rows. It adds a visible selected range and available source data status line, makes the table use the same selected range, removes broken zoom in and zoom out controls from full screen mode and makes full screen reuse the already loaded inline chart state. If a selected range has no rows, both chart and table state that no records are available and advise checking the data source or running Elexon backfill.
