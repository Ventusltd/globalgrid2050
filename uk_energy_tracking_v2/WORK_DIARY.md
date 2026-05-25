# UK Energy Tracking V2 Work Diary

This file is a persistent engineering and AI continuity log for V2.

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
uk_energy_tracking_v2/
```

V2 was created so experimental transport energy work would not damage the live public tracker.

## Major lessons learned

### Lesson 1

Do not share feed scripts between stable and V2.

Earlier versions accidentally pointed V2 and stable at the same JSON update logic which caused corruption risk.

Resolution:

```text
create isolated _v2 scripts
create isolated V2 workflows
create isolated V2 JSON outputs
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
separate V2 cadence
```

## Diary entry: 2026-05-25 workflow cadence diagnosis

### What was investigated

The last 24 hours of Git commits were reviewed to understand why the original 5 minute live update behaviour appears to have weakened after oil prices, V2 isolation, DESNZ fuel and EV charging work were added.

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

V2 also recovered at least once after a failed push:

```text
Automated UK grid update V2 (both): 2026-05-25 09:12 UTC
```

This proves the V2 Python update scripts can run and can write V2 JSON feeds.

### What is not working as expected

The system no longer shows a clean rhythm that looks like a reliable 5 minute live update in the commit history.

Important correction: the workflow can run every 5 minutes without producing a Git commit every 5 minutes, because Git only commits when JSON content changes. However, the recent pattern shows larger gaps and workflow friction after additional workflows were introduced.

### Main suspected causes

1. The stable tracker workflow and V2 workflow both write to `main` frequently.
2. The oil workflow also writes to `main`.
3. GitHub Pages deploys after each commit.
4. Repo structure and documentation workflows may also run after commits.
5. Some workflows use direct tokenised push URLs while others use `origin`.
6. At least one V2 run reached the commit stage but failed during `git push` with a GitHub internal server error.
7. Earlier attempts also showed `fetch first` and push race behaviour.

### Current workflow split

Stable grid workflow:

```text
.github/workflows/fetch_uk_energy_and_prices.yml
cron: */5 * * * *
```

V2 grid workflow:

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
.github/workflows/document_uk_energy_trackers.yml
manual only
```

### Current interpretation

The original 5 minute system was simpler. It mostly had one frequent writer. After V2 and oil work, the repository now has multiple workflows pushing into the same branch. Even if each workflow is logically correct, they compete at Git level and can cause rejected pushes, stale checkouts or delayed commits.

The issue is therefore not mainly an API data problem. It is an automation orchestration problem.

### Current state classification

Stable tracker:

```text
working, should not be touched
```

V2 tracker:

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

Create a V2 only workflow hardening patch that does not touch the stable tracker.

The patch should:

```text
keep V2 offset from stable
use origin based push rather than explicit tokenised URL where possible
add retry around pull and push
stage only V2 JSON outputs
avoid running documentation or repo structure workflows as part of grid updates
```

### Recovery rule

If V2 breaks again, compare against stable but patch only V2:

```text
uk_energy_tracking_v2/index.md
uk_energy_tracking_v2/*.json
scripts/*_v2.py
.github/workflows/*_v2.yml
```

Do not modify:

```text
uk_energy_tracking/index.md
uk_energy_tracking/live_grid_energy.json
uk_energy_tracking/live_grid_price.json
```

## V2 features added

```text
Transport energy dashboard section
DESNZ fuel logic placeholders
fuel duty and VAT links
EV charging placeholder cards
Atlas V8 EV reference embed
oil chart UI improvements
```

## Current V2 status

Core goal:

```text
V2 should behave identically to stable for live grid values.
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

### V2

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

### V2

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

V2 tracker:

```text
experimental development twin
```

Never experiment directly on stable.

## Future direction

Planned V2 work:

```text
real DESNZ petrol prices
real DESNZ diesel prices
EV charging tariff ingestion
comparison economics
Brent to pump modelling
transport electrification visualisation
```
