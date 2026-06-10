# GridBot Script Audit Requirements

Every GridBot feature script should be readable as an engineering control file.

## Required script behaviour

Support audit mode by default.

Support apply mode only through an explicit flag such as `--apply`.

Calculate the proposed patch before writing.

Write Markdown and JSON reports.

Return non zero if mandatory checks fail.

Avoid network calls unless the feature explicitly requires source fetching.

Avoid raw temporary file commits.

## Required report logic

The script must distinguish:

input files

output files

changed files

added files

deleted files

source APIs

source windows

browser routing impact

rollback method

human next action

## Required checks for UI changes

Target panel exists.

Expected controls exist.

Adjacent controls are preserved.

Canvas IDs are unique.

Script tags are not duplicated.

Cache busters are updated where needed.

Mobile and desktop layout assumptions are declared.

## Required checks for data changes

Source domain is explicit.

Rows counted.

Date range declared.

Null or missing rows counted.

Units declared.

Derived values declare formula.

No unrelated data files changed.
