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
