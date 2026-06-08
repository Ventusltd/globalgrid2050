# Manifest 005 Design: Generation UI Extension Contract

Status: code reminder and design guardrail
Owner: Ventus Ltd
Created UTC: 2026 06 08
Scope: UK Energy Tracking V6 generation history chart, data loaders, dropdown controls, ECG source routing and future FUELHH integration

## 1. Purpose

This note prevents loss of working memory during long AI assisted development sessions.

The generation chart must keep its current visual look while the data spine improves behind it.

The rule is simple:

Do not touch the renderer unless the user explicitly approves a visual redesign.

## 2. Locked renderer rule

File to avoid changing by default:

uk_energy_tracking_v6/generation_history/render_generation_history_chart.js

Reason:

The current renderer already gives the desired neon SCADA line chart look, MW axis, high and low markers, technology colour and statistics box.

New data must be shaped to fit the renderer, not the other way around.

## 3. Existing row schema contract

The renderer expects exactly 2 data shapes.

### Daily mode

Required row fields:

date
technology
averageMW

Optional fields may exist, but the current renderer does not need them for drawing.

### Half hourly or ECG mode

Required row fields:

time
technology
generationMW

Optional fields may exist, but the current renderer does not need them for drawing.

## 4. ECG data rule

The ECG hot tier may store all technologies in one rolling file.

The browser must display only the selected technology from the dropdown.

The chart must not draw all technology traces by default.

The all technology ECG file should use:

time
technology
generationMW
status
source

## 5. Loader and control files may change

Permitted files for normal extension:

uk_energy_tracking_v6/generation_history/load_generation_history_data.js
uk_energy_tracking_v6/generation_history/control_generation_history.js
uk_energy_tracking_v6/generation_history/live-config.js

These files may be changed to:

route selected periods to the correct data grain
add ECG source paths
add FUELHH candidate or confirmed source paths
add per month engineering detail options
fix dropdown labels
fix day and night rule configuration
fix non additive loader calculations

## 6. Do not mix MWh into the MW chart

MWh, terawatt hour, annual share, monthly energy contribution, seasonal energy and day night energy views belong in aggregate components or separate charts.

The existing generation history chart is a MW line chart.

Do not force monthly MWh or annual terawatt hour into this renderer.

## 7. Known corrections to schedule

### 7.1 Non additive totalDaily correction

The loader currently risks summing highMW and lowMW across technologies for an all generation total.

This is non additive and must be corrected before any consumer relies on those fields.

For all generation daily mode, averageMW may be summed only if all rows are simultaneous daily average facts. High and low values must be derived from a simultaneous summed series or omitted from derived all generation facts.

### 7.2 Six month label correction

The period label for 6m must say 6 months, not 3 months.

### 7.3 Day and night rule config

The canonical rule is fixed UTC:

Day equals 06:00Z to 18:00Z.
Night equals 18:00Z to 06:00Z.
Timezone equals UTC.

The loader should read this from config rather than burying magic constants.

## 8. FUELHH integration rule

When FUELHH candidate or confirmed files are created, the browser integration should happen through the loader and config only.

The renderer should still receive the same row shapes.

Confirmed daily file shape for this chart:

date
technology
averageMW

Recent or ECG file shape for this chart:

time
technology
generationMW

## 9. Engineering detail rule

A future engineering detail mode may load one historic month of FUELHH half hourly data on demand.

It must use the existing half hourly row shape:

time
technology
generationMW

It must not load multiple years of half hourly data into the browser.

## 10. Acceptance criteria for future UI work

A proposed change passes the contract only if:

The renderer is untouched unless explicit approval exists.
The row schema is preserved.
The chart still displays one selected technology by default.
The ECG file may contain all technologies but the browser filters by selected technology.
Long range historic views do not load raw bulk.
MWh and terawatt hour stay out of the MW line chart.
Source, completeness and status may be carried in data rows but should not force a visual redesign.

## 11. Next practical action

Wait for the Generation ECG All Technologies MVP audit after the recent source restriction patch.

If the audit shows a sane recent ECG row count and source path, run apply.

Then wire the selected technology dropdown to the all technology ECG candidate file without touching the renderer.
