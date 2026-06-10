# GlobalGrid2050 Audit Process and Reporting Requirements

Generated doctrine for GridBot controlled changes.

## 1. Purpose

Every non trivial repository change must be understandable after the event. The audit system exists to prevent uncontrolled AI edits, unclear source logic, silent data mixing and live site regressions.

The rule is simple:

Audit first. Human review second. Apply third. Verify live fourth.

No workflow should jump from idea to apply without an auditable report unless Vikram explicitly authorises an emergency fix.

## 2. Mandatory workflow stages

### Stage 1. Prepare

Create a named feature script and a named GitHub Actions workflow. The names must match the intent.

Required naming pattern:

Feature script: `scripts/gridbot_<feature_name>.py`

Workflow: `.github/workflows/gridbot_<feature_name>.yml`

Human report: `data_science_protocol/audit_reports/<FEATURE_NAME>_LATEST.md`

Machine report: `data_science_protocol/audit_reports/json/<FEATURE_NAME>_LATEST.json`

### Stage 2. Audit mode

Audit mode may read files, calculate proposed patches, validate checks and write audit reports. It must not alter target application files, data files or production logic.

Audit mode must identify the files that would change if apply is later authorised.

Audit mode must end with `applied: false`.

### Stage 3. Human review

The human review must confirm:

The feature name is correct.

The source data is correct.

The changed files are expected.

The checks are specific and meaningful.

The rollback path is defined.

No confidential or NDA protected material is being published.

### Stage 4. Apply mode

Apply mode may write the audited target changes only if the audit checks pass.

Apply mode must write the final human and machine reports.

Apply mode must end with `applied: true` and `pass: true` if successful.

### Stage 5. Post apply verification

After apply and Jekyll deployment, the live site must be reviewed by human eyes.

Required checks:

Open the live page.

Force refresh if needed.

Check desktop layout.

Check mobile layout.

Check the changed feature.

Check adjacent features remain intact.

Check the source labels remain truthful.

Check no private names or NDA protected details were exposed.

Check the rollback branch or revert instruction is clear.

## 3. Mandatory report fields

Every audit JSON report must include these fields:

`reportTitle`

`schemaVersion`

`generatedUTC`

`repository`

`branch`

`gitHeadBefore`

`gitHeadAfter`

`workflowName`

`scriptName`

`upgradeType`

`mode`

`sourceApis`

`sourceWindows`

`inputFiles`

`outputFiles`

`changedFiles`

`addedFiles`

`deletedFiles`

`checks`

`rawTemporaryFilesFound`

`browserRoutingAffected`

`rollbackMethod`

`executiveSummary`

`humanReviewStatus`

`nextAction`

`applied`

`pass`

## 4. Mandatory before apply evidence

Before apply, the report must show:

The proposed changed files.

The exact checks that passed or failed.

Any source API or source file used.

Whether browser routing or live pages are affected.

Whether raw temporary files were found.

Whether data files are changed.

Whether existing adjacent UI or data logic is preserved.

Whether the workflow is Solar only, FUELHH only, price only or another explicit source domain.

Whether the feature would expose public data, private data or NDA sensitive material.

## 5. Mandatory after apply evidence

After apply, the report must show:

The files actually changed.

The apply mode result.

The final pass state.

The expected live page verification steps.

The rollback method.

The restore branch or revert strategy.

The cache buster or deploy dependency if the browser must reload a changed script.

## 6. Forbidden patterns

Do not silently mix PVLive Solar data with Elexon FUELHH data.

Do not silently convert MW to MWh without declaring the formula.

Do not publish raw temporary data files unless explicitly authorised.

Do not add non Solar technologies to a Solar only chart without a separate source audit.

Do not alter price charts while working on Solar charts unless the feature explicitly requires it.

Do not remove source attribution.

Do not create duplicate canvas IDs or duplicate script tags.

Do not publish confidential project names, counterparties or NDA protected failure details without explicit authorisation.

## 7. Restore and rollback doctrine

Before risky UI or data changes, create a named restore branch from the stable state.

Rollback may be by:

Reverting the apply commit.

Restoring from the named branch.

Re running a previous stable workflow if it is designed for restoration.

Every report must state which rollback method applies.

## 8. Human authority

AI may propose.

GridBot may audit.

GitHub may record.

Only Vikram approves what becomes part of the system.
