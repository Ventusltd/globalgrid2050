# GlobalGrid2050 Data Science and Storage Discipline Protocol

## Data spine doctrine stamp

Data grain discipline applies. Store the right grain for the question, not raw bulk. Settled FUELHH is confirmed where available. Live FUELINST is provisional. Sums roll up. Peaks do not. Solar is provenance stamped. Every fact carries schema, source, completeness and status. Never overwrite good data. Commit facts and regenerate bulk. Full doctrine: data_science_protocol/THE_DATA_SPINE.md


Status: active protocol
Owner: Ventus Ltd
Scope: GlobalGrid2050 data pipelines, GitHub Actions, GitHub Pages datasets and long horizon analytical archives

## 1. Purpose

GlobalGrid2050 stores data as operational intelligence, not as uncontrolled bulk. The repository may hold selected cleaned datasets where they create analytical value, but raw API firehose data must not be preserved by default.

The core rule is simple:

Raw data enters temporarily.
Python cleans and reduces it.
GitHub stores lean, auditable intelligence.
The browser loads only the required slice.

This protocol exists to prevent the repository becoming slow, expensive or fragile while still allowing serious data science work on long horizon electricity, generation, grid and energy system data.

## 2. Data classes

### Class A: Temporary raw input

Examples:

Elexon API rows
PVLive API rows
ONS workbook downloads
REPD source downloads
Market data API responses

Rule:

Temporary raw data may be downloaded inside GitHub Actions or local scripts.
Temporary raw data must be cleaned, aggregated or sharded before commit.
Temporary raw data must be deleted before push unless explicitly approved as a retained evidence file.

### Class B: Clean analytical archive

Examples:

Clean half hourly generation MW monthly files
Clean electricity settlement price files
Clean REPD derived project data
Clean ONS MWh annual energy use files

Rule:

These may be committed if they are compact, documented and useful for repeated analysis.
They must have clear schemas and audit reports.
They must avoid repeated metadata and unnecessary raw columns.

### Class C: Dashboard intelligence files

Examples:

generation_annual_mwh_by_technology.json
generation_monthly_mwh_by_technology.json
generation_seasonal_mwh_by_technology.json
generation_day_night_mwh_by_technology.json

Rule:

These are the preferred browser files.
They should be small, deterministic and fast to render.
They are the first source for public UI and investor education.

### Class D: Reports and audit logs

Examples:

Backfill reports
Coverage reports
Staleness reports
Deletion reports
Source method reports

Rule:

Every substantial data operation should leave a report.
A report may replace a heavy stale file where the file no longer needs to remain in the repo.

## 3. File size discipline

GitHub hard limit per ordinary file: 100 MB.
GlobalGrid2050 internal target per data file: 25 MB.

Any file above 25 MB must be justified.
Any file approaching 90 MB is treated as a failure risk.
Any file above 100 MB must never be committed outside Git LFS.

For clean half hourly generation data, the target structure is:

data/generation/halfhourly_clean/YYYY/generation_mw_YYYY_MM.csv

Each month should remain below 25 MB.
If a month exceeds 25 MB, it must be split into smaller time windows such as weekly shards.

## 4. Data as code principle

Data is treated as code when it is:

reproducible
versioned
schema controlled
audited
small enough to clone
useful for downstream computation

A data file is not sacred merely because it was expensive to fetch. Once its useful intelligence has been extracted into compact derived files, the heavy source file may be deleted after a staleness report is written.

## 5. Staleness and deletion discipline

A file is stale if:

it has been superseded by a cleaner version
it duplicates another source
it is too large for normal repo operations
it is not used by active loaders or analytics
it can be regenerated from public APIs and scripts
it blocks GitHub Actions, Pages or cloning performance

Before deleting a stale data file, write a report containing:

file path
file size
reason for deletion
replacement file or derived output
source script used
last known row count
coverage period
whether the file can be regenerated
commit reference if known

Preferred report location:

data_science_protocol/staleness_reports/

Deletion rule:

Do not delete valuable raw evidence silently.
Write the report first, then delete the file in the same or next controlled commit.

## 6. Generation half hourly MW archive discipline

Purpose:

The half hourly MW archive exists for data science, not for default browser rendering.

It supports:

solar daily curve analysis
wind ramp analysis
gas response analysis
night and day balancing
battery opportunity analysis
seasonal volatility analysis
import and export behaviour
extreme event detection
technology correlation studies

Storage rule:

Store clean monthly shards only where they are actively valuable.
Do not store raw annual Elexon files.
Do not store a giant master half hourly CSV.
Do not store duplicate raw and clean versions unless explicitly approved.
Older clean half hourly shards may be replaced by distilled feature files after a staleness report is written.

Clean schema:

time
technology
generationMW
source

Cleaning rule:

Fetch raw rows by day.
Deduplicate by time plus raw fuel.
Group raw fuels into technology.
Sum MW by time plus technology.
Write one clean monthly CSV.
Reject the file if it exceeds 25 MB.

## 7. Browser loading discipline

The browser must not load the universe.

Default public dashboard:

MWh aggregates
annual data
monthly data
seasonal data
day versus night data

Engineering MW chart:

recent slice for fast default loading
selected monthly shard for historic view
never full decade in one browser call

Long windows:

use aggregate data
use daily summaries
never load every half hourly point across 10 years into the browser

## 8. Audit report minimum fields

Every data workflow should report:

workflow name
script name
source API or file
fetch window
rows fetched
rows after dedupe
rows written
output paths
output file sizes
failed days
missing days
unit of measurement
calculation method
commit status
whether raw data was deleted

## 9. Storage budget policy

The repository may use storage for high value clean analytical data, but it must remain practical to clone and maintain.

Preferred budget discipline:

Dashboard JSON files: tiny and always kept
Clean monthly analytical files: kept where useful
Raw source files: normally deleted
Reports: kept
Stale files: reported and removed

If total data storage approaches 1 GB, run a storage audit before adding more large files.

## 10. Tiered retention model

GlobalGrid2050 should use hot, warm and cold data tiers.

### Hot tier

Purpose:

Fast user interaction and current operational insight.

Typical retention:

Last 30 days to last 3 years, depending on file size and analytical value.

Allowed content:

recent MW slices
clean half hourly monthly shards
current year YTD files
latest aggregate dashboards

Rule:

Hot tier data may be optimised for fast browser loading and repeated analysis.

### Warm tier

Purpose:

Historic analysis without full bulk storage.

Typical retention:

Older than 3 years but still regularly studied.

Allowed content:

daily high average low MW
monthly MWh by technology
seasonal MWh by technology
day and night MWh by technology
annual MWh by technology
ramp statistics
extreme event indexes
representative daily profiles

Rule:

Warm tier data should preserve the behaviour of the system without carrying every half hourly row.

### Cold tier

Purpose:

Regeneration on demand.

Allowed content:

API fetch scripts
workflow definitions
schema files
source method reports
coverage reports
staleness reports

Rule:

Cold tier data may not be stored as large files. It must be regenerable through documented API calls and Python scripts.

## 11. API regeneration principle

Historic data does not always need to remain physically present in the repository.

If a public API and a working script can regenerate a dataset, the repository may keep the method, schema and audit report instead of the full data file.

Required regeneration metadata:

source API
endpoint or source name
script name
input parameters
coverage period
schema version
cleaning method
last successful run
known limitations
replacement derived files

This allows the project to fetch historic data when needed without permanently clogging the repository.

## 12. Python distillation discipline

Python should be used to distil large datasets into smaller analytical features before storage.

Useful distillation methods include:

daily high average low MW
monthly MWh totals
seasonal MWh totals
day versus night MWh split
ramp rate statistics
maximum upward and downward ramps
capacity factor proxies
percentile curves
load duration curves
extreme event lists
missing data reports
representative daily profiles by month and technology
correlation matrices between technologies
battery opportunity windows
curtailment and negative price alignment indexes where price data is available

The goal is to keep the behaviour, not necessarily every raw row.

## 13. Data compression and format discipline

CSV is transparent but inefficient.

CSV may be used where browser readability and auditability matter.
JSON may be used for dashboard payloads.
Compressed or columnar formats may be used for data science if they do not break the static site model.

Preferred approach:

browser files should remain small JSON or CSV
large analytical data should be cleaned before storage
heavy columnar formats should be considered only where they materially reduce size and remain easy to regenerate

## 14. Decision rule

Keep a data file if it answers repeated future questions better than an aggregate and remains within the storage discipline.

Delete or replace a data file if it is heavy, duplicated, stale or only useful as a temporary step.

The objective is not minimal data. The objective is useful data with disciplined storage.

## 15. Current generation data priority

Priority 1:
Complete clean half hourly MW monthly archive for recent and high value periods.

Priority 2:
Keep the latest 3 years of clean half hourly data where storage allows.

Priority 3:
For older history, retain distilled daily, monthly, seasonal and event feature files unless full half hourly detail is specifically needed.

Priority 4:
Maintain annual, monthly, seasonal and day/night MWh aggregate JSON files.

Priority 5:
Connect the MW chart to selected monthly shards for historic engineering analysis.

Priority 6:
Write staleness reports and remove old raw annual or master CSV files where superseded.

Priority 7:
Continue YTD automated updates for current year data.
