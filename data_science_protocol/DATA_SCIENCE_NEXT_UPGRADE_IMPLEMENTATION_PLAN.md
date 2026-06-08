# GlobalGrid2050 Data Science Next Upgrade Implementation Plan

Title: GlobalGrid2050 Data Science Next Upgrade Implementation Plan
Status: active planning document
Owner: Ventus Ltd
Created UTC: 2026-06-08T00:00:00Z
Scope: UK energy time series data, generation history, confirmed fact JSON, repository guardrails, GIS storage discipline and audit workflow

## Executive summary

This plan records the next controlled upgrade path for the GlobalGrid2050 data science layer. The purpose is to prevent the repository from becoming a raw telemetry warehouse while still allowing serious UK electricity, generation, grid and market analysis.

The doctrine is simple.

Python in GitHub Actions fetches and refines data.
GitHub stores confirmed facts and audit records.
The browser displays selected slices.
Raw bulk remains temporary.

The next round of upgrades must not begin with more raw backfills. It must begin with guardrails, audit reports, confirmed fact schemas and source routing discipline.

## 1. Existing protocol anchor

The active storage protocol already states that raw API firehose data must not be preserved by default. Raw data enters temporarily, Python cleans and reduces it, GitHub stores lean auditable intelligence and the browser loads only the required slice.

This implementation plan sits below that protocol and turns the doctrine into an execution sequence.

## 2. Why the upgrade is required

The UK generation module has 3 connected risks.

Risk 1: Temporal resolution mismatch.
A historic chart labelled as half hourly has previously behaved like it was receiving 5 minute live style data. That causes browser overload and breaks the contract between engineering views and historic analysis.

Risk 2: Repository bloat.
Large raw CSVs and large GIS geometry files can make cloning, GitHub Actions, Pages deployment and audit harder. Splitting raw files into smaller files does not solve total repository growth or Git history growth.

Risk 3: Silent data degradation.
If an API returns null, partial or incomplete data, the pipeline must not overwrite existing reviewed facts. Existing good data must survive failed or incomplete reruns.

## 3. Final data contract

The public application must follow this ladder.

1. Live layer
Source: FUELINST or equivalent live data
Resolution: approximately 5 minute
Status: live or provisional
Use: now view only
Repo storage: no permanent raw storage

2. Recent engineering layer
Source: recent resampled generation data
Resolution: 30 minute
Status: recent or provisional
Use: last 7 to 30 days engineering MW view
Repo storage: small rolling JSON only

3. Daily confirmed layer
Source: FUELHH derived and validated data
Resolution: daily
Status: candidate or confirmed
Use: month to 2 year charts, daily average, high, low and completeness
Repo storage: confirmed fact JSON

4. Monthly confirmed layer
Source: FUELHH derived and validated data, with documented solar supplementation where applicable
Resolution: monthly by technology and day or night bucket
Status: confirmed
Use: long range strategic analysis and investor education
Repo storage: confirmed fact JSON

5. Cold reproducibility layer
Source: public APIs, scripts, workflow definitions, hashes and audit reports
Resolution: regenerated on demand
Status: method record
Use: rare backfills, forensic analysis, repeatability
Repo storage: scripts and reports only, not raw bulk

## 4. Canonical confirmed fact files

The first stable compiler should emit these files.

1. data/confirmed/generation_monthly_daynight.json
Purpose: strategic long range MWh by technology and day or night bucket
Required row fields: year, month, technology, bucket, mwh, periodCount, expectedPeriodCount, completeness, status, source, method
Required metadata: schemaVersion, generatedUTC, sourceDatasets, sourceHash, timezone, dayNightRule, reviewState

2. data/confirmed/generation_daily.json
Purpose: daily bridge between raw MW behaviour and long range strategic charts
Required row fields: date, technology, mwh, avgMW, maxMW, minMW, periodCount, expectedPeriodCount, completeness, status, source, method
Required metadata: schemaVersion, generatedUTC, sourceDatasets, sourceHash, timezone, reviewState

3. data/recent/generation_recent_30d_30min.json
Purpose: recent engineering MW chart without asking the browser to load raw history
Required row fields: ts, technology, mw, status, source
Required metadata: schemaVersion, generatedUTC, sourceDatasets, timezone, windowStartUTC, windowEndUTC

## 5. Day and night rule

Canonical rule:

Day equals 06:00Z to 18:00Z.
Night equals 18:00Z to 06:00Z.
Timezone equals UTC.

Reason:

This avoids British Summer Time drift and gives a fixed comparison rule across years. Solar elevation logic may be added later as a separate solar daylight research artifact. It must not be mixed into the canonical day and night fact table.

Required metadata value:

Fixed UTC: Day=06:00Z to 18:00Z, Night=18:00Z to 06:00Z

## 6. Solar source discipline

Elexon transmission level data may understate embedded solar. Solar must therefore carry a source method field.

Allowed solar method states:

ELEXON_TRANSMISSION_ONLY
PVLIVE_EMBEDDED_ESTIMATE
BLENDED_TRANSMISSION_PLUS_EMBEDDED
PROVISIONAL_LIVE_EDGE_ESTIMATE

Rule:

Do not silently replace confirmed national additive MWh with an estimate. Any embedded or blended solar value must declare its method, source, confidence and review status.

## 7. Guardrail implementation before further backfill

The next mechanical guardrail merge should add or strengthen these items.

1. .gitignore raw and transient paths
Purpose: prevent accidental raw data commits
Targets: tmp, data/raw, data/transient, raw API dumps, temporary backfills, local analyst exports

2. .github/scripts/size_guard.sh
Purpose: block large file regression before it enters Git history
Thresholds: warn above 5 MiB, fail above 25 MiB, hard reject near 100 MiB
Scope: data, GIS, generated assets, source files and workflow outputs

3. .github/workflows/repo_guard.yml
Purpose: run size guard on pull request, push and manual dispatch
Output: short human summary plus machine readable report

4. Keep scripts/inspect_data_science_discipline.py
Purpose: non destructive inspection, inventory, timestamped report and change log maintenance

## 8. Confirmed fact compiler implementation

The first compiler should be named clearly, for example:

scripts/build_generation_confirmed_facts.py

Required workflow:

.github/workflows/generation_confirmed_facts.yml

Execution model:

Scheduled run
Manual dispatch
Year or date window input
Dry run option
Candidate only option
Commit approved output option

Compiler stages:

1. Extract
Fetch FUELHH for closed periods.
Fetch FUELINST only for live or recent windows.
Fetch PVLive or other solar supplementary source only when the method is declared.
Store raw responses only in runner temporary storage.

2. Validate
Check schema.
Check timestamps.
Check non negative MW.
Check expected settlement periods.
Check duplicate natural keys.
Check missing days.

3. Normalise
Map raw fuel types into stable GlobalGrid2050 technology names.
Convert MW intervals into MWh.
Apply UTC day and night bucket.
Attach source and method.

4. Aggregate
Build monthly day and night MWh.
Build daily MWh, average MW, high MW, low MW and completeness.
Build recent 30 minute slice where required.

5. Merge
Load existing confirmed fact files.
Merge by natural keys.
Refuse null over good overwrite.
Refuse lower completeness overwrite for confirmed rows unless explicitly approved.
Record every changed key in the audit report.

6. Emit
Write JSON with metadata header.
Write audit report.
Write candidate report when not committing.
Delete raw temporary files.

7. Commit
Commit only compact confirmed facts and audit reports.
Never commit raw source files by default.

## 9. Never overwrite good data invariant

This is a hard rule.

If existing confirmed data is populated and incoming candidate data is null, empty, NaN, incomplete or lower quality, the pipeline must fail or preserve the existing value.

Allowed overwrite cases:

Existing row is provisional and candidate row is confirmed.
Existing row is lower completeness and candidate row is higher completeness.
Human approved correction record exists.
Source correction is documented in the audit report.

Disallowed overwrite cases:

Confirmed row replaced by null.
Confirmed row replaced by blank.
Confirmed row replaced by lower completeness.
Existing year removed because a new partial archive was processed.
Existing technology disappeared without an explicit source reason.

## 10. Browser source routing rule

The UI must not ask for the wrong data grain.

Live or today:
Use live or provisional source.

1 to 30 days:
Use recent 30 minute slice.

31 days to 2 years:
Use daily confirmed facts.

More than 2 years:
Use monthly confirmed facts.

Forbidden:
Multi year charts must never fetch 5 minute live telemetry.
The browser must never render decade scale raw half hourly data.
A chart must not say half hourly if the source is actually 5 minute.

## 11. GIS bloat track

GIS cleanup is a separate first class workstream.

Immediate GIS actions:

Identify GeoJSON files above 5 MiB.
Classify them as basemap, project asset, data layer or temporary export.
Keep small project specific layers where justified.
Move heavy basemaps to vector tiles, simplified TopoJSON or external static asset storage.
Do not blanket ignore all GeoJSON because small deliberate files may be valid.
Do not rewrite history until the replacement storage model is stable.

## 12. Audit outputs required for every major upgrade

Each major upgrade must generate:

Human summary report
Machine readable JSON report
Changed files list
Large files list
Data lineage report
Completeness report
Known failure modes
Rollback note
Next action note

Preferred locations:

data_science_protocol/inspection_reports/
data_science_protocol/audit_reports/
data_science_protocol/staleness_reports/
data_science_protocol/schema_reports/

## 13. Upgrade gate checklist

Before a massive upgrade starts:

1. Run data science discipline inspection.
2. Run repo size guard.
3. Confirm no files above the hard threshold.
4. Confirm .gitignore covers raw and transient paths.
5. Confirm branch is clean.
6. Confirm planned output paths.
7. Confirm source APIs and date windows.
8. Confirm day and night rule.
9. Confirm whether solar blending is active or disabled.
10. Confirm whether the run is candidate only or commit enabled.

After a massive upgrade finishes:

1. Run inspection again.
2. Compare before and after reports.
3. Check watch and action files.
4. Check confirmed fact schema metadata.
5. Check completeness ratios.
6. Check no raw temporary files were committed.
7. Check browser source routing still points to compact facts.
8. Update changelog.
9. Record rollback method.
10. Record next action.

## 14. Build order

Phase 1: Guardrails
Add or strengthen .gitignore, size guard and repo guard workflow.

Phase 2: Audit protocol
Run inspection script and produce a baseline report.

Phase 3: Confirmed fact schema
Create schema examples for monthly day and night, daily and recent slice.

Phase 4: Compiler skeleton
Build candidate only compiler with validation and audit output.

Phase 5: Never overwrite guard
Add merge protection and completeness checks.

Phase 6: First controlled backfill
Run 1 year first, then 3 years, then longer history.

Phase 7: Browser source routing
Route live, recent, daily and monthly views according to the ladder.

Phase 8: GIS cleanup
Move or simplify heavy basemaps.

Phase 9: History rewrite planning
Only after the new storage discipline is stable.

## 15. Non goals for the next round

Do not add Flask.
Do not add FastAPI.
Do not add Redis.
Do not add Celery.
Do not make GitHub a raw time series database.
Do not commit decade scale raw telemetry.
Do not rewrite Git history before guardrails and GIS replacement strategy are stable.

## 16. Success criteria

The next massive upgrade is successful if:

Confirmed fact JSONs are produced or updated.
Audit reports are generated.
No raw bulk is committed.
No confirmed value is overwritten by weak data.
Large file regressions are blocked.
The browser can load charts from compact artifacts.
GIS bloat is separately identified and planned.
The changelog records what changed, why it changed and what must be checked next.
