# FUELHH Solar MW Integration Deep Study

Status: working study
Date UTC: 2026 06 09
App folder: uk_energy_tracking_v6/generation_history
Scope: MW generation chart, FUELHH spine, solar routing, browser file strategy
Owner: Ventus Ltd

## Executive summary

The MW chart should remain the serious grid behaviour product. The FUELHH backfill is valuable because it gives a settled transmission metered 30 minute backbone from 2016 to 2026. It is strong for Coal, Nuclear, Gas, OCGT, Oil, Pumped Storage and transmission connected Wind. It is not a national solar series.

The most important decision is to separate source layers rather than force one dataset to answer every question.

Recent generation views should keep using the 30 minute recent generation file for short term behaviour and balancing studies.

Historic non solar generation should use the FUELHH daily MW spine, but through a slim browser file rather than the full provenance rich file.

Historic Solar should not be shown as a failed or zero FUELHH chart. Solar must be routed to a separate solar output layer, most likely PV Live, while the GlobalGrid2050 Solar Pipeline provides grid scale project and capacity intelligence.

## Current data assets

### FUELHH historic transmission generation

The repo now contains the FUELHH half hourly backfill as monthly shards and a daily MW spine candidate.

Known state from the overnight run:

125 monthly FUELHH shards
2016 to 2026 coverage
0 failed months
0 remaining months
1,610,151 parsed rows
33,574 daily fact rows
Full daily spine path: data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json
Full daily spine size: about 14.8 MB

Use this as the audit and canonical historic transmission layer.

### Recent 30 minute generation heartbeat

Recent generation remains the correct short term heartbeat layer for grid behaviour and balancing studies.

Code level term: recentEcg
UI term: Recent generation

Use this for 24 hours, 48 hours, 1 week and 1 month views.

### Solar Pipeline intelligence

The GlobalGrid2050 Solar Pipeline is not live MW output. It is project, capacity, status, county and operator intelligence. It is still important because the user is especially concerned with grid scale solar.

Current headline from the uploaded Solar Pipeline export:

52,866 MW filtered solar capacity
2,667 solar projects above 1 MW
Largest single site 840 MW

This should be linked from the MW chart as grid scale solar context.

### PV Live solar output

PV Live is the correct urgent solar output source to investigate and wire for Solar. It provides GB solar estimates and historic data. It should be treated as a separate source layer from FUELHH.

Important caveat: PV Live may exclude Solar BMUs. This is still far better than showing FUELHH Solar as zero, but the caveat must be carried.

### Carbon Intensity and NESO generation mix

The Carbon Intensity generation endpoint is useful as a cross check because it includes embedded wind and solar in its methodology. It should be a validation and reconciliation source, not necessarily the canonical UI source.

### DUKES and Ember annual reconciliation

DUKES and Ember should be used to reconcile annual TWh totals and shares. The MW chart should not claim full national generation until FUELHH is combined with embedded estimates.

## Source routing rules

### Recent periods

Periods:

12 hours day
12 hours night
24 hours
48 hours
1 week
1 month

Source:

recent 30 minute generation file

UI label:

Recent generation

Purpose:

Grid behaviour, short term movement, balancing studies, operational rhythm.

### Historic periods

Periods:

3 months
6 months
12 months
5 years
10 years

Source:

FUELHH daily MW browser file derived from the full FUELHH spine.

UI label:

Historic generation
Daily range

Purpose:

Transmission metered long term fuel behaviour.

### Solar selected

If period is recent and recent data has Solar rows:

Show recent Solar generation.

If period is historic and FUELHH is the only source:

Do not show an empty chart as though it is a failure. Show the source transparency note and a link to Solar Pipeline.

If PV Live integration exists:

Route Solar to PV Live for historic solar output and show source badge: Solar estimate from PV Live.

## Browser payload strategy

Do not load the full 14.8 MB provenance spine into the browser as the default daily history file.

Build a slim browser file from:

data/confirmed/generation_daily_mw_spine_fuelhh_candidate.json

Recommended browser file:

uk_energy_tracking_v6/generation_history/generation_daily_fuelhh_browser_slim.json

Keep only:

date
technology
averageMW
highMW
lowMW
highAtUTC
lowAtUTC

Keep the full provenance file for audit and data integrity.

Expected result:

Much smaller browser payload
Same visible chart fields
Cleaner mobile performance
Canonical audit trail preserved

## UI language rules

Do not use these terms in the UI:

Engineering MW
ECG
FUELHH jargon as the first user facing label

Use these terms instead:

Generation output
Recent generation
Historic generation
Daily range
Transmission metered source
Solar output layer to follow
Grid scale solar pipeline

## Immediate implementation sequence

### Step 1

Commit this deep study in the app folder.

Status: done by this file.

### Step 2

Summarise the study on the generation history UI page.

The visible summary should say:

Recent periods show short term generation behaviour.
Historic periods use settled FUELHH transmission metered generation.
FUELHH does not represent national solar generation.
Solar output will be routed to a separate PV Live layer.
Grid scale solar project intelligence is available through the Solar Pipeline.

### Step 3

Build the slim browser daily file from the full FUELHH daily spine.

### Step 4

Point dailyHistory at the slim browser file.

### Step 5

Add a solar route guard:

Historic Solar without PV Live should show source note and Solar Pipeline link, not an empty failure chart.

### Step 6

Engineer PV Live solar output integration.

### Step 7

Run data integrity checks:

Annual TWh reconciliation against DUKES
Annual comparison against Ember
Carbon Intensity cross check for solar and wind
Interconnector sign audit
Pumped storage sign audit
Biomass continuity note before late 2017
Duplicate row checks
UTC and settlement period checks for clock change days

## Data integrity issues to track

### Solar

FUELHH Solar is not national solar. Do not chart it as national solar.

### Wind

FUELHH Wind is transmission metered wind. It may undercount embedded wind.

### Biomass

Biomass is not historically consistent before late 2017. Earlier biomass may sit in Other.

### Interconnectors

Imports and exports may require sign validation. Do not silently treat all interconnector values as positive imports.

### Pumped storage

Pumped storage may be negative when pumping. Sign treatment must be explicit.

### Time handling

Keep source times in UTC. Test clock change days because settlement periods can behave differently from ordinary UTC half hour sequences.

## Commercial interpretation

The MW chart is more serious than the TWh layer at this stage because it shows physical behaviour. It can support discussions about balancing, dispatch, volatility, grid stress, storage need, cable loading, transformer loading and system behaviour.

The TWh layer remains important later for energy accounting and policy narrative, but the MW layer is the operating pulse.

## Build decision

Proceed with the UI build, but do it in this order:

Deep study committed.
UI summary added.
Slim browser daily file built.
Historic config repointed to slim file.
Solar guarded from misleading FUELHH blanks.
PV Live solar layer engineered.
Data integrity checks added before public claims.
