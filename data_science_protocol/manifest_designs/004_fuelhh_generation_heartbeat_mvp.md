# Manifest 004 Design: FUELHH Generation Heartbeat MVP

Status: design candidate
Owner: Ventus Ltd
Created UTC: 2026 06 08
Scope: UK generation history, FUELHH candidate compiler, daily facts, monthly facts, live heartbeat and auditability

## 1. Purpose

This design defines the minimum viable generation data spine for GlobalGrid2050.

The objective is to let the user explore generation behaviour with a powerful chart experience while avoiding repository bloat.

The compiler must download the actual source data, calculate the useful engineering facts, write compact files, write audit reports and delete temporary raw data.

## 2. Principle

Do not store the wrong grain for the wrong question.

For historic questions such as peak, average, low and total energy, the stored output should be the derived daily or monthly fact, not every raw settlement row.

For recent operational behaviour, retain enough resolution to show the heartbeat of the grid.

## 3. Storage ladder

### Live week

Resolution: approximately 5 minute where available.
Retention: rolling 7 days.
Purpose: current heartbeat and rapid movement.
Storage: hot tier only.

### Recent month

Resolution: 30 minute.
Retention: rolling 30 days.
Purpose: recent operational rhythm and engineering trace.
Storage: compact hot tier JSON.

### Historic daily

Resolution: 1 row per date and technology.
Retention: 10 years.
Purpose: long horizon behaviour.
Fields: date, technology, highMW, averageMW, lowMW, highTimeUTC, lowTimeUTC, mwh, periodCount, expectedPeriodCount, completeness, status, source, method.

### Historic monthly

Resolution: 1 row per month and technology, with day and night buckets where useful.
Retention: 10 years.
Purpose: strategic energy contribution.
Fields: year, month, technology, bucket, mwh, twh, averageMW, peakMW, lowMW, periodCount, expectedPeriodCount, completeness, status, source, method.

### Historic annual

Resolution: 1 row per year and technology.
Retention: 10 years.
Purpose: national trend and technology share.
Fields: year, technology, mwh, twh, averageMW, peakMW, lowMW, share, completeness, status, source, method.

## 4. MVP execution sequence

Phase 1: 1 month candidate

Fetch FUELHH for a single closed month.
Normalise fuel types into GlobalGrid2050 technologies.
Calculate daily high, average, low and MWh.
Calculate monthly MWh and terawatt hour.
Calculate completeness.
Write candidate files only.
Write audit report.
Delete raw temporary source rows.
Do not overwrite confirmed production files.

Phase 2: 1 year candidate

Repeat the same compiler across 12 closed months.
Compare row counts, file sizes, completeness and source behaviour.
Emit candidate annual facts.
Do not promote automatically.

Phase 3: 10 year build

Scale only after the 1 month and 1 year candidates pass audit.
Store daily, monthly and annual facts.
Do not store full historic half hourly source files in the repository.

## 5. Audit and reproducibility

Each run must emit:

workflow name
script name
source dataset
source method
fetch window
rows fetched
rows used
rows rejected
expected settlement periods
actual settlement periods
missing days
output paths
output file sizes
source hash where practical
generated UTC
raw deletion status
candidate or confirmed status

## 6. Promotion gate

A candidate may become confirmed only after:

schema passes
completeness meets threshold
no null over good overwrite occurs
source and method fields are present
solar method is declared
non additive roll up tests pass
audit report is reviewed

## 7. Non additive arithmetic rules

Monthly average MW equals total MWh divided by hours.
Technology share comes from additive MWh.
Technology peak is the maximum value for that technology.
System peak is calculated from simultaneous summed system rows and must not be the sum of per technology peaks.
High and low timestamps must be preserved.

## 8. Solar provenance

FUELHH alone is not the final truth for embedded solar.

Solar rows must declare one of the following method states:

ELEXON TRANSMISSION ONLY
PVLIVE EMBEDDED ESTIMATE
BLENDED TRANSMISSION PLUS EMBEDDED
PROVISIONAL LIVE EDGE ESTIMATE

The MVP may begin with transmission only solar if it is clearly labelled and not presented as total national solar.

## 9. Website small print requirement

The public generation page should state that historic browser files store derived engineering facts for speed and auditability. Raw settlement data can be regenerated from the stated source APIs using the documented script, date window, schema version and audit report.

## 10. Success definition

The MVP succeeds when GlobalGrid2050 can show:

recent generation heartbeat
recent 30 minute technology movement
10 year daily high, average and low behaviour
10 year monthly energy contribution
10 year annual terawatt hour trend
source status and completeness
without loading or storing raw historic bulk in the browser path
