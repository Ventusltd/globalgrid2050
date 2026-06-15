# Root Homepage Directory Audit PASS

Generated UTC: `2026-06-15T20:56:18Z`
Mode: `audit`
Route: `/`

Audits the proposed root homepage replacement. The change converts the flat directory table into grouped expandable drawers, preserves the existing 41 homepage routes, keeps the dark Courier style, removes the embedded hourglass iframe from the root page and leaves all data, dashboards and child routes untouched.

## Planned target changes

- `index.html`

## Files changed in this run

- none

## Homepage link reconciliation

- Current table links: `41`
- Proposed menu links: `41`
- Added links: `0`
- Removed links: `0`

## Missing proposed link targets

- `./uk_macro_energy_trends/` (directory)
- `./copper_and_aluminium_prices_historic_trends/` (directory)
- `./employers_requirements_BESS/` (directory)

## Checks

| Check | Result |
|---|---|
| targetFileExists | PASS |
| targetIsRootIndexHtml | PASS |
| currentHomepageRead | PASS |
| currentFlatDirectoryTableDetected | PASS |
| currentHourglassIframeDetectedForRemoval | PASS |
| proposedHtmlHasDoctype | PASS |
| proposedKeepsTitle | PASS |
| proposedKeepsOpeningDescription | PASS |
| proposedSearchPlaceholderUpdated | PASS |
| proposedHasMenuMount | PASS |
| proposedHasAreasData | PASS |
| proposedHasDrawerDetails | PASS |
| proposedHasNoResultState | PASS |
| proposedEscapesMenuText | PASS |
| proposedEncodesUrls | PASS |
| proposedSearchOpensMatches | PASS |
| proposedRemovesDirectoryTable | PASS |
| proposedRemovesHourglassIframe | PASS |
| proposedScriptSyntaxOk | PASS |
| linkCountMatchesExpected | PASS |
| allExistingHomepageLinksPreserved | PASS |
| noNewExternalLinks | PASS |
| noMarkdownCodeFences | PASS |
| singleInlineScriptTag | PASS |
| noDataFilesChanged | PASS |
| noConfidentialProjectNamesDetected | PASS |

## Rollback

Revert the apply commit. The only target application file declared for apply mode is index.html.

## Human review

Human review required before apply. Check the audit report, then trigger apply only if the grouped homepage is approved.

## Next action

Run this workflow in audit mode first. If the report passes, run the same workflow in apply mode and then visually verify the live root homepage on desktop and mobile.

