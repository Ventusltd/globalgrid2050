# GlobalGrid2050 GridBot Next Mega Manifest Roadmap

Title: GlobalGrid2050 GridBot Next Mega Manifest Roadmap
Status: active planning record
Owner: Ventus Ltd
Created UTC: 2026-06-08T00:00:00Z
Scope: next manifest sequence for GridBot controlled upgrades across generation data, confirmed facts, browser routing, GIS storage and audit discipline

## Executive summary

This document records the next GridBot mega manifests to write and execute through GitHub Actions. The objective is to stop working through isolated manual edits and move into controlled manifest driven upgrade campaigns.

The operating model is:

1. Write a manifest.
2. Run GridBot in audit mode.
3. Review the Markdown and JSON report.
4. Run GridBot in apply mode for selected safe phases.
5. Let Claude, Gemini or another reviewer attack the output.
6. Tighten the next manifest.

The user should spend intellectual effort on strategy, architecture, risk and product judgement, not on copying files or approving tiny mundane edits.

## Current baseline

`001_generation_data_discipline.yml` is the first GridBot manifest. It provides the base machine:

Repository size audit
Archive gitignore patch
Recent generation resampling to 30 minute MW
Recent loader rewire
Generation source routing audit
Never overwrite guard audit
Confirmed fact source audit
Non additive peak audit
Confirmed fact schema audit

This manifest is infrastructure plus first generation discipline enforcement. It is not the final UK generation data system.

## Manifest 002: Generation recent slice and browser truth

Suggested file:

`gridbot_manifests/002_generation_recent_slice_browser_truth.yml`

Purpose:

Close the user visible recent generation issue by ensuring the recent chart uses true 30 minute data and not 5 minute FUELINST density labelled as half hourly.

Phases:

1. Audit current recent file density.
2. Count source timestamps and detect 5 minute versus 30 minute cadence.
3. Resample recent generation to 30 minute buckets.
4. Write `generation_recent_30d_30min.json`.
5. Rewire `live-config.js` from old recent file to new recent file.
6. Audit chart labels for half hourly claims.
7. Audit browser payload size before and after.
8. Produce report showing source rows, output rows, compression ratio and configured file.

Safe apply phases:

Resample recent generation.
Rewire config to new recent file.

Do not delete old recent file in this manifest.

Success criteria:

Browser config points to `generation_recent_30d_30min.json`.
Recent file is materially smaller than old file.
Recent file has timestamps on 00 or 30 minute boundaries.
Audit report proves the old 5 minute slice is no longer the active browser source.

## Manifest 003: Confirmed fact schema hardening

Suggested file:

`gridbot_manifests/003_confirmed_fact_schema_hardening.yml`

Purpose:

Bring existing generation aggregate JSON files closer to the confirmed fact schema without pretending FUELINST history is settled FUELHH truth.

Phases:

1. Audit all generation aggregate JSON files.
2. Add or verify top level metadata fields where safe.
3. Add `schemaVersion`.
4. Add `timezone`.
5. Add `dayNightRule` where relevant.
6. Add `sourceDatasets` with current honest source state.
7. Add row level `status` defaulting to `provisional` or `legacy_candidate` for FUELINST derived rows.
8. Add row level `completeness` where it can be inferred from `records`.
9. Write schema report.

Safe apply phases:

Add metadata and status fields only if values can be derived mechanically.

Do not reclassify anything as `confirmed` yet.

Success criteria:

Files become more self describing.
Rows derived from FUELINST are not falsely marked confirmed.
Future merge guard has completeness and status fields to inspect.

## Manifest 004: FUELHH confirmed fact compiler candidate

Suggested file:

`gridbot_manifests/004_fuelhh_confirmed_fact_compiler_candidate.yml`

Purpose:

Build the real closed period compiler using Elexon FUELHH for historic confirmed facts.

Phases:

1. Audit current FUELINST based aggregate sources.
2. Fetch a small FUELHH test window only.
3. Validate FUELHH schema.
4. Convert MW to MWh using 0.5 hour settlement interval.
5. Aggregate daily MW statistics and monthly MWh.
6. Apply UTC day and night bucket.
7. Produce candidate outputs under `data_science_protocol/candidate_outputs/`.
8. Compare candidate FUELHH facts against existing FUELINST derived facts.
9. Produce variance report.
10. Do not overwrite production files.

Safe apply phases:

Candidate output only.
Audit report only.

No production overwrite in the first version.

Success criteria:

FUELHH source works.
Candidate JSON validates.
Variance report shows explainable differences.
No existing published chart data is changed.

## Manifest 005: FUELHH production promotion

Suggested file:

`gridbot_manifests/005_fuelhh_production_promotion.yml`

Purpose:

Promote validated FUELHH derived closed period facts into production confirmed fact JSON files.

Precondition:

Manifest 004 candidate reports reviewed and accepted.

Phases:

1. Load existing production aggregate JSON.
2. Load FUELHH candidate outputs.
3. Run never overwrite good data guard.
4. Promote only rows with sufficient completeness.
5. Mark promoted rows as `confirmed`.
6. Preserve weaker existing rows as `legacy_candidate` or `provisional`.
7. Write full merge audit.
8. Update changelog.

Safe apply phases:

Only after candidate review.
Prefer one year first, then 3 years, then 10 years.

Success criteria:

Closed period facts are FUELHH based.
Provisional FUELINST rows are not silently presented as confirmed.
No good row is downgraded.

## Manifest 006: Non additive chart maths repair

Suggested file:

`gridbot_manifests/006_non_additive_chart_math_repair.yml`

Purpose:

Fix the chart layer so `All generation` does not sum technology peaks or lows incorrectly.

Phases:

1. Audit `totalDaily()` and other total functions.
2. Detect summed `highMW` and `lowMW` logic.
3. Replace All generation high and low with null, omitted values or correctly recomputed values from a common time grain.
4. Prefer additive totals for MWh and average MW.
5. Add report explaining why peaks are non additive.

Safe apply phases:

Small JavaScript patch after audit.

Success criteria:

Chart no longer shows mathematically false all generation high or low based on sum of per technology extremes.
MWh totals remain additive.

## Manifest 007: Raw archive containment and staleness reports

Suggested file:

`gridbot_manifests/007_raw_archive_containment.yml`

Purpose:

Stop existing raw monthly archives becoming invisible debt, while not deleting valuable data silently.

Phases:

1. Inventory `data/generation/archive/`.
2. Inventory master half hourly CSV files.
3. Detect duplicate byte size candidates.
4. Write staleness reports for each archive family.
5. Confirm replacement aggregate files exist.
6. Mark archive paths as ignored for future commits.
7. Produce deletion or untracking plan.

Safe apply phases:

Write reports and update `.gitignore` only.

Do not delete or untrack in first run.

Success criteria:

Every archive has a report and replacement logic before any deletion is considered.

## Manifest 008: GIS basemap storage strategy

Suggested file:

`gridbot_manifests/008_gis_basemap_storage_strategy.yml`

Purpose:

Tackle the largest repo weight item: roads, rail and port basemap GeoJSON.

Phases:

1. Inventory all GeoJSON and TopoJSON files.
2. Classify as basemap, grid layer, project layer, duplicate copy or unknown.
3. Identify files above 5 MiB and 25 MiB.
4. Detect duplicate files across `repd_grid_atlasv6`, `v7` and `v8`.
5. Create GIS staleness reports.
6. Generate simplification candidates if mapshaper or Python simplification is available.
7. Prepare externalisation plan for large basemaps.

Safe apply phases:

Reports only at first.

Do not delete GIS files or rewrite history from this manifest.

Success criteria:

Every large GIS file has a classification and proposed future action.

## Manifest 009: Browser payload and chart performance audit

Suggested file:

`gridbot_manifests/009_browser_payload_performance_audit.yml`

Purpose:

Ensure the browser loads selected slices, not the universe.

Phases:

1. Audit JSON payload sizes used by UK energy tracking pages.
2. Audit generation history config paths.
3. Audit all fetch calls in generation history scripts.
4. Flag files above 5 MiB used directly by the browser.
5. Produce load ladder report.
6. Recommend daily or monthly replacement path.

Safe apply phases:

Reports only initially.

Success criteria:

Every browser facing payload has a size and role recorded.

## Manifest 010: End to end 10 year generation data build

Suggested file:

`gridbot_manifests/010_generation_10_year_build.yml`

Purpose:

Run the full UK generation build in a controlled staged way after the smaller manifests are stable.

Phases:

1. Preflight source API check.
2. Preflight storage guard check.
3. Run one year candidate FUELHH build.
4. Run 3 year candidate FUELHH build.
5. Run 10 year candidate FUELHH build.
6. Generate daily MW facts.
7. Generate monthly MWh and TWh facts.
8. Generate annual TWh facts.
9. Generate day and night TWh facts.
10. Generate completeness report.
11. Generate source variance report.
12. Generate chart readiness report.

Safe apply phases:

Candidate outputs first.
Production promotion only through Manifest 005 after review.

Success criteria:

10 year generation history exists as confirmed fact JSON and candidate engineering archives without putting raw bulk into default browser paths.

## Recommended execution order

1. Finish and run Manifest 001 audit.
2. Run Manifest 002 apply for recent 30 minute slice and loader rewire.
3. Run Manifest 003 audit and apply schema hardening where safe.
4. Run Manifest 004 candidate FUELHH compiler for a small test window.
5. Run Manifest 006 to repair non additive chart maths.
6. Run Manifest 007 archive containment reports.
7. Run Manifest 008 GIS basemap strategy.
8. Run Manifest 004 again for one full year.
9. Run Manifest 005 promotion for one reviewed year.
10. Only then build toward Manifest 010 for full 10 year history.

## Notes for future GridBot design

A manifest is an audit record of intent.
Each phase must state whether it is read only, safe apply, candidate output or production mutation.
Production data mutation must be reversible and reported.
No manifest should delete files or rewrite history without a dedicated explicit approval workflow.

The target is not slow manual approval of every line. The target is controlled automated execution with enough audit evidence for fast expert review.
