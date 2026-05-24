# AI START HERE: GlobalGrid2050 Change Control

Before proposing, scripting or applying any software change in this repository, read this file first.

GlobalGrid2050 is not a normal static website. It is a founder controlled energy intelligence platform with a controlled deployment method.

## Non negotiable rule

Do not directly rewrite large HTML, CSS or JavaScript files.

Use GridBot.

## Operating model

The correct operating loop is:

```text
Vikram states intent
AI inspects repo and proposes a small feature
AI creates a GridBot feature package
Vikram manually triggers the GitHub workflow
GridBot applies the patch
GridBot writes a report
Vikram tests the live page
Vikram approves or rejects the result
```

## Authentication and authority

GridBot is authenticated through GitHub Actions using the repository secret `GRIDBOT_PAT`.

AI must not assume this means it has approval to deploy automatically.

Authentication is technical access. Approval belongs to Vikram.

AI may create scripts, manifests, feature folders, tests and documentation. Vikram manually triggers workflows and tests live pages.

## Preferred deployment route

Use the existing workflow:

```text
.github/workflows/gridbot-feature-install.yml
```

Use the existing installer:

```text
scripts/gridbot_feature_installer.py
```

Create feature packages under:

```text
feature_requests/<feature_name>/manifest.yml
```

The manifest should use small operations such as:

```text
replace
regex_replace
insert_before
insert_after
assert_contains
```

Each feature must target the smallest possible file set.

## Manual workflow trigger

Vikram normally triggers:

```text
Actions -> GridBot Feature Install -> Run workflow
```

Typical inputs:

```text
source: same as target for an in place safe patch
target: target folder or app folder
feature: exact feature folder name
overwrite: false unless cloning a new version intentionally
```

## What AI must do before changing anything

1. Inspect the live target file in the repo.
2. Inspect relevant docs and recent diary notes.
3. Identify the stable reference version.
4. Create one small feature only.
5. Use exact anchors where possible.
6. Add assertions.
7. Preserve the original stable app.
8. Tell Vikram exactly which workflow to trigger and with which inputs.

## What AI must not do

Do not paste or overwrite full dashboards.
Do not use broad rewrites.
Do not guess file paths.
Do not patch production when a clone exists.
Do not assume browser state equals repo state.
Do not trigger workflows on Vikram's behalf unless explicitly instructed.
Do not confuse GitHub authentication with human approval.

## Recovery rule

If a patch fails, stop and inspect:

```text
latest commits
workflow result
changed files
GridBot report
current target file
stable reference file
```

Then create a smaller feature. Do not keep forcing the same failed route.

## Current doctrine summary

AI proposes.
GridBot installs.
GitHub records.
Vikram triggers, tests and approves.
