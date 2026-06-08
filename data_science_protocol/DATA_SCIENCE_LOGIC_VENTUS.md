# GlobalGrid2050 VENTUS Data Science Logic

Status: active architecture log
Owner: Ventus Ltd
Created UTC: 2026 06 08
Scope: UK generation history, live generation, data distillation, browser loading, audit method and future chart design

## 1. Core doctrine

GlobalGrid2050 is not a raw telemetry warehouse.

GlobalGrid2050 is a grid intelligence system.

The purpose is to preserve the behaviour of the energy system without forcing the repository or browser to carry every raw source record forever.

Python fetches the source data.
Python validates the source data.
Python calculates the engineering facts.
Python writes compact intelligence files.
Python writes the audit method.
Python deletes temporary raw data unless explicit evidence retention is approved.
GitHub stores the method, the facts and the audit trail.
The browser loads the correct grain for the question being asked.

## 2. Shivers data logic

The public interface must feel alive.

The system should show the heartbeat of the grid where high resolution data matters, while storing long horizon history as distilled engineering truth.

The architecture is therefore:

Recent data gives rhythm.
Live data gives heartbeat.
Historic data gives intelligence.

This allows the user to see moving generation behaviour across the chart without forcing 10 years of raw settlement data into the public repository.

## 3. Generation grain ladder

### Live week

Purpose: show the current heartbeat of the power system.
Resolution: approximately 5 minute where available.
Retention: rolling recent window only.
Use: live feel, operational movement, rapid technology response, stress and surplus visibility.
Storage: small hot tier file only.

### Recent month

Purpose: show the recent engineering rhythm.
Resolution: 30 minute.
Retention: rolling 30 day window.
Use: wind, solar, gas, nuclear, imports, storage and other technology behaviour across recent operational periods.
Storage: compact JSON or CSV, browser safe.

### 10 year daily intelligence

Purpose: preserve long horizon behaviour without bulk telemetry.
Resolution: 1 row per date and technology.
Core values: high MW, average MW, low MW.
Extra audit values: high time, low time, MWh, expected record count, actual record count, completeness, status, source and method.
Use: long trend, seasonal shape, volatility envelope, technology comparison and strategic education.
Storage: compact confirmed fact file.

### Monthly and annual intelligence

Purpose: preserve strategic energy contribution.
Resolution: month and year by technology.
Values: MWh, terawatt hour, average MW, peak MW, low MW, day MWh, night MWh, share, completeness and status.
Use: system transformation, investor education, policy reality, grid planning and long range comparison.
Storage: compact confirmed fact files.

## 4. Data volume logic

For 10 technologies across 10 years, daily high, average and low equals:

3 values x 365 days x 10 technologies x 10 years = 109500 core values.

The storage unit is better understood as:

365 days x 10 years x 10 technologies = 36500 daily technology rows.

Those rows can carry the values and audit fields while remaining small enough for the repository and browser.

The mistake to avoid is multiplying by 24 hours after Python has already distilled the day.

## 5. Raw data is evidence, not the product

Historic source rows are used to derive facts.

They do not need to remain permanently committed when the same source can be regenerated through a documented API method.

The public site should include small print explaining that raw source records are fetched from public source APIs, processed by documented Python scripts and reduced into audit backed engineering facts for browser performance.

The audit record must show:

source dataset
source endpoint or source name
fetch window
schema version
technology mapping
row count fetched
row count used
expected records
completeness
source hash where practical
script name
generated UTC
raw deletion status
output path

## 6. Non additive rule

Long range facts must not lie through naive arithmetic.

Monthly average MW must be calculated from MWh divided by hours.
Technology share must be calculated from additive MWh.
Technology peak may be the maximum of that technology over the period.
System peak must not be the sum of technology peaks.
High time and low time must be preserved when daily and monthly facts are created.

## 7. Solar provenance rule

FUELHH is the correct settled historic source for transmission metered generation.

It must not silently replace embedded solar estimates.

Solar rows must declare their method.

Allowed method states:

ELEXON TRANSMISSION ONLY
PVLIVE EMBEDDED ESTIMATE
BLENDED TRANSMISSION PLUS EMBEDDED
PROVISIONAL LIVE EDGE ESTIMATE

## 8. Minimum viable build direction

The minimum viable state is not a polished UI.

The minimum viable state is a working data spine:

1. Live week at 5 minute resolution where available.
2. Recent month at 30 minute resolution.
3. Daily 10 year high, average and low facts.
4. Monthly MWh and terawatt hour facts.
5. Annual terawatt hour facts.
6. Audit method for regenerating source files.
7. No permanent raw bulk unless explicitly approved.

After this exists, the chart can be made powerful because the data below it is real.
