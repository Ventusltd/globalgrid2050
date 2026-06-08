# GlobalGrid2050 Mass Upgrade Audit Protocol

Title: GlobalGrid2050 Mass Upgrade Audit Protocol
Status: active audit protocol
Owner: Ventus Ltd
Created UTC: 2026-06-08T00:00:00Z
Scope: audit procedure for major data, GIS, ETL, UI source routing and repository governance upgrades

## Executive summary

This protocol defines how to audit the next round of massive GlobalGrid2050 upgrades without slowing human review. The human layer stays short. The machine layer records detailed file movement, schema changes, source windows, completeness, hashes and failure modes.

The purpose is to make every large upgrade reversible, inspectable and safe.

## 1. Audit doctrine

Every major upgrade must answer 7 questions.

1. What changed?
2. Why did it change?
3. Which source data or code path produced it?
4. Which files became larger or smaller?
5. Which confirmed facts were added, changed or preserved?
6. Was any raw temporary data committed by mistake?
7. How can the change be rolled back or repeated?

## 2. When this protocol must run

Run this protocol before and after any of the following.

New Elexon backfill.
New PVLive backfill.
New Carbon Intensity integration.
New confirmed fact compiler run.
Large GIS file movement.
Browser data source routing change.
Removal of raw CSV files.
Removal of GeoJSON basemaps.
Any Git history rewrite planning.
Any workflow that touches data files above 5 MiB.

## 3. Required pre upgrade audit

Before work begins, create or capture:

1. Current git head.
2. Current branch.
3. Current repository size from GitHub metadata if available.
4. Data science inspection latest report.
5. Large file list above 5 MiB.
6. Files above 25 MiB.
7. Existing confirmed fact file hashes.
8. Existing confirmed fact row counts.
9. Existing workflow list.
10. Planned target files.
11. Planned source APIs.
12. Planned source date windows.
13. Planned output schemas.
14. Rollback branch or tag.

## 4. Required post upgrade audit

After work completes, capture:

1. New git head.
2. Files added.
3. Files changed.
4. Files deleted.
5. Files above 5 MiB.
6. Files above 25 MiB.
7. Confirmed fact row counts before and after.
8. Confirmed fact metadata check.
9. Completeness check.
10. Null over good check result.
11. Raw temporary file check.
12. Browser routing check.
13. Workflow success or failure.
14. Rollback instruction.
15. Next action.

## 5. Required report locations

Human readable reports:

data_science_protocol/audit_reports/

Machine readable reports:

data_science_protocol/audit_reports/json/

Inspection reports:

data_science_protocol/inspection_reports/

Staleness and deletion reports:

data_science_protocol/staleness_reports/

Schema reports:

data_science_protocol/schema_reports/

## 6. Required audit report header

Every human readable audit report must start with this header.

Title:
Generated UTC:
Repository:
Branch:
Git head before:
Git head after:
Workflow:
Script:
Upgrade type:
Executive summary:
Human review status:
Next action:

## 7. Required machine readable fields

Every JSON audit report should include:

reportTitle
schemaVersion
generatedUTC
repository
branch
gitHeadBefore
gitHeadAfter
workflowName
scriptName
upgradeType
sourceApis
sourceWindows
inputFiles
outputFiles
changedFiles
addedFiles
deletedFiles
largeFilesOver5MiB
largeFilesOver25MiB
confirmedFactFiles
rowCountsBefore
rowCountsAfter
completenessSummary
nullOverGoodGuard
rawTemporaryFilesFound
browserRoutingAffected
rollbackMethod
nextAction
notes

## 8. Confirmed fact audit rules

For each confirmed fact JSON file, record:

path
schemaVersion
generatedUTC
sourceDatasets
sourceHash where practical
timezone
dayNightRule where applicable
rowCount
technologyCount
firstPeriod
lastPeriod
confirmedRows
provisionalRows
candidateRows
minimumCompleteness
maximumCompleteness
nullCount
NaNCount
fileSizeBytes
sha256

## 9. Null over good guard audit

The audit must state one of the following.

PASS: no confirmed values were overwritten by weaker data.
FAIL: confirmed values were at risk and the pipeline stopped.
NOT RUN: guard is not yet implemented.
MANUAL REVIEW: candidate changes require human approval.

Any FAIL or MANUAL REVIEW must list the affected natural keys.

Natural keys include:

year, month, technology, bucket
or date, technology
or timestamp, technology

## 10. Raw temporary file audit

Search for accidental committed raw data patterns.

Examples:

data/raw/
data/transient/
tmp/
raw_api
raw_elexon
fuelinst_raw
fuelhh_raw
backfill_tmp
archive_full
master_halfhourly

The audit must state whether any matching file is present in the working tree or staged changes.

## 11. GIS audit rules

For GIS files, record:

path
fileSizeBytes
fileSizeMiB
geometry class if known
role: basemap, project layer, temporary export or unknown
browser route if known
candidate action: keep, simplify, tile, externalise, release asset, delete after staleness report

Do not delete heavy GIS files silently. Create a staleness report or movement report first.

## 12. Browser routing audit

After source routing changes, check that:

Live or today routes to live provisional source.
1 to 30 days routes to recent 30 minute source.
31 days to 2 years routes to daily confirmed facts.
More than 2 years routes to monthly confirmed facts.
No long range chart fetches 5 minute live telemetry.
No decade scale chart fetches raw half hourly data.
Chart labels match the real source resolution.

## 13. Changelog rule

Every major upgrade must append a short entry to:

data_science_protocol/DATA_SCIENCE_DISCIPLINE_CHANGELOG.md

The changelog entry should contain:

UTC timestamp
Upgrade title
Git commit range
Executive summary
Files added
Files changed
Files deleted
Audit report path
Known risks
Next action

## 14. Staleness report rule

Before deleting a large data or GIS file, create a staleness report with:

file path
file size
reason for deletion
replacement file or derived output
source script or method
last known row count where applicable
coverage period where applicable
whether the file can be regenerated
commit reference if known
rollback note

## 15. Massive upgrade runbook

Use this runbook for each major upgrade.

1. Create a branch or confirm controlled main commit policy.
2. Run data science discipline inspection.
3. Save pre upgrade report.
4. Run repo size guard.
5. Confirm planned files and outputs.
6. Run compiler or migration in candidate mode where available.
7. Review audit output.
8. Run commit enabled mode only after candidate checks pass.
9. Run inspection again.
10. Compare before and after reports.
11. Update changelog.
12. Record rollback note.
13. Only then proceed to the next upgrade.

## 16. Failure handling

If a workflow fails because of incomplete data, nulls, large files or schema mismatch, do not patch around it silently.

Record:

failure type
failed file
failed source window
affected technology
whether existing confirmed data was preserved
whether raw temporary files were deleted
recommended next action

## 17. Success definition

A massive upgrade is successful only when:

The intended files are created or updated.
The audit report exists.
The changelog is updated.
No raw bulk is committed.
No confirmed fact is degraded.
No new large file enters the repo without justification.
Browser source routing remains truthful.
Rollback method is recorded.
