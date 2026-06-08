# GlobalGrid2050 Data Science Discipline Changelog

Title: GlobalGrid2050 Data Science Discipline Changelog
Status: active changelog
Owner: Ventus Ltd
Created UTC: 2026-06-08T00:00:00Z
Scope: repository data discipline, UK energy data, confirmed fact compiler, audit protocol, GIS cleanup and browser source routing

## Purpose

This changelog records controlled changes to the GlobalGrid2050 data science discipline. It is deliberately short so human review is fast. Full detail belongs in inspection reports, audit reports, staleness reports and schema reports.

## Standing doctrine

Python in GitHub Actions fetches and refines data.
GitHub stores confirmed facts and audit records.
The browser displays selected slices.
Raw bulk remains temporary.

## 2026-06-08  Data science discipline inspection workflow added

Executive summary: A non destructive inspection script and workflow were added to scan repository files, identify size risks, maintain latest inspection reports and prepare a compact changelog layer for future audits.

Files added:

scripts/inspect_data_science_discipline.py
.github/workflows/inspect_data_science_discipline.yml

Known risks:

The inspection workflow reports risk but does not yet block risky files.
A separate size guard workflow is still required.

Next action:

Add blocking repo guard files and raw data ignore rules before the next massive backfill or GIS cleanup.

## 2026-06-08  Next upgrade implementation plan recorded

Executive summary: A detailed next upgrade plan was added to define the data contract, canonical confirmed fact files, fixed UTC day and night rule, solar provenance discipline, guardrail sequence, compiler logic, browser routing rules and GIS cleanup path.

Files added:

data_science_protocol/DATA_SCIENCE_NEXT_UPGRADE_IMPLEMENTATION_PLAN.md

Known risks:

The plan is not executable by itself. It must be followed by guardrail scripts, workflow enforcement and confirmed fact compiler implementation.

Next action:

Create .gitignore raw path rules, .github/scripts/size_guard.sh and .github/workflows/repo_guard.yml.

## 2026-06-08  Mass upgrade audit protocol recorded

Executive summary: A formal audit protocol was added for future large data, GIS, ETL and UI routing upgrades. The protocol defines pre upgrade checks, post upgrade checks, report locations, confirmed fact audit fields, null over good guard status and rollback recording.

Files added:

data_science_protocol/MASS_UPGRADE_AUDIT_PROTOCOL.md

data_science_protocol/DATA_SCIENCE_DISCIPLINE_CHANGELOG.md

Known risks:

Audit discipline is only useful if every major upgrade uses it before and after execution.

Next action:

Run the inspection workflow before the next major data upgrade and store the baseline report in data_science_protocol/inspection_reports/.
