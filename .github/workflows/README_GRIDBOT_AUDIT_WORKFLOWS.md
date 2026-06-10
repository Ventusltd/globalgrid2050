# GridBot Audit Workflow Requirements

Every GridBot workflow should support audit mode before apply mode where practical.

## Required inputs

`mode` with allowed values `audit` and `apply`.

`commit_reports` with allowed values `true` and `false`.

## Required permissions

Use the narrowest permissions possible. Documentation and application patch workflows normally require `contents: write`.

## Required behaviour

Checkout with `fetch-depth: 0` where commit evidence is needed.

Use `GRIDBOT_PAT` where follow on workflows and Pages deployments must be triggered.

Upload report artifacts.

Commit reports when `commit_reports` is true.

Commit target changes only in apply mode.

Do not silently apply during audit mode.

## Required naming

Workflow names must match the feature and the report title.

The workflow file name must match the script name.

The commit message must include the feature name and the mode.
