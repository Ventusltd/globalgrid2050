# AI START HERE: GlobalGrid2050 Change Control

Before proposing, scripting or applying any software change in this repository, read this file first.

GlobalGrid2050 is not a normal static website. It is a founder controlled energy intelligence platform with a controlled deployment method.

## Non negotiable rule

Do not directly rewrite large HTML, CSS or JavaScript files.

Use GridBot, but understand that GridBot has two different roles in this project.

## The two GridBot roles

### 1. GridBot as authorised GitHub automation identity

This is the general automation identity used by GitHub Actions.

GridBot is authenticated through GitHub Actions using the repository secret `GRIDBOT_PAT`.

This role is used for direct workflows such as live data and file generation pipelines.

Use this route for:

```text
UK energy data
UK electricity prices
Carbon intensity
Oil prices
DESNZ road fuel prices
Metals
FX
EV charging indexes
JSON feeds
Markdown reports
Data refresh scripts
```

Correct pattern:

```text
/scripts/<pipeline_script>.py
.github/workflows/<pipeline_workflow>.yml
workflow checks out repo using GRIDBOT_PAT
workflow runs Python script
script writes JSON or markdown outputs
workflow commits exact output files
workflow pushes to main as GridBot
GitHub Pages redeploys
Vikram tests and approves
```

Use one script per data source and one workflow per pipeline unless there is a clear reason to combine them.

For live data pipelines, do not use the old `feature_requests` YAML installer method.

### 2. Old GridBot Feature Installer

This is the structured app patch installer.

Use it only for complex controlled app patches, mainly GIS SLD app structure changes or carefully scoped UI changes where manifests, assertions and reports are needed.

Feature installer route:

```text
feature_requests/<feature_name>/manifest.yml
scripts/gridbot_feature_installer.py
.github/workflows/gridbot-feature-install.yml
GridBot install report
```

Use this for:

```text
GIS SLD structural patches
controlled app feature installation
large app refactoring split into small manifest operations
version workspace patches where assertions are needed
```

Do not use the feature installer for routine live data pipelines.

## Operating model

The correct human approval loop is:

```text
Vikram states intent
AI inspects repo and proposes a small change
AI creates the appropriate script, manifest or workflow
Vikram manually triggers the GitHub workflow
GridBot executes through GitHub Actions
GitHub records the commit
Vikram tests the live page
Vikram approves or rejects the result
```

## Authentication and authority

GridBot authentication is technical access. It is not human approval.

AI must not assume that because `GRIDBOT_PAT` exists it has permission to deploy automatically.

AI may create scripts, manifests, feature folders, tests, workflows and documentation. Vikram manually triggers workflows and tests live pages.

## Choosing the right route

If the task is a data feed or recurring data update, use direct GitHub Actions automation:

```text
Python script -> dedicated workflow -> JSON or markdown output -> GridBot commit
```

If the task is a complex application patch, use the old GridBot Feature Installer:

```text
feature_requests -> YAML manifest -> installer workflow -> report
```

If unsure, inspect existing workflows and scripts before deciding.

## Manual workflow trigger

Vikram normally triggers workflows manually from GitHub Actions.

For feature installer jobs:

```text
Actions -> GridBot Feature Install -> Run workflow
```

Typical feature installer inputs:

```text
source: same as target for an in place safe patch
target: target folder or app folder
feature: exact feature folder name
overwrite: false unless cloning a new version intentionally
```

For data pipelines:

```text
Actions -> dedicated pipeline workflow -> Run workflow
```

Examples:

```text
fetch_uk_energy_and_prices.yml
update_oil_prices.yml
update_uk_fuel_prices.yml
update_prices.yml
```

## What AI must do before changing anything

1. Inspect the live target file in the repo.
2. Inspect relevant docs and recent diary notes.
3. Identify whether the task is a data pipeline or app patch.
4. Choose the correct GridBot route.
5. Create one small change only.
6. Use exact file staging in workflows where possible.
7. Preserve the original stable app.
8. Tell Vikram exactly which workflow to trigger and with which inputs.

## What AI must not do

Do not paste or overwrite full dashboards.
Do not use broad rewrites.
Do not guess file paths.
Do not patch production when a clone exists.
Do not assume browser state equals repo state.
Do not trigger workflows on Vikram's behalf unless explicitly instructed.
Do not confuse GridBot Feature Installer with GridBot authenticated workflow identity.
Do not confuse GitHub authentication with human approval.

## Recovery rule

If a patch or workflow fails, stop and inspect:

```text
latest commits
workflow result
changed files
GridBot report if present
current target file
stable reference file
```

Then create a smaller script, workflow or feature. Do not keep forcing the same failed route.

## Current doctrine summary

AI proposes.
GridBot authenticates and executes through GitHub Actions.
GitHub records.
Vikram triggers, tests and approves.

Use direct workflows for data pipelines.
Use the old feature installer only for controlled app patches.