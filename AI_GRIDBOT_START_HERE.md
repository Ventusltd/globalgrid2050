# AI GridBot Start Here

This repository is controlled by Ventus Ltd and Vikram Kumar. It is not a casual static site. Treat it as a GridBot governed grid intelligence operating system.

Core operating rule:

```text
AI proposes and commits controlled scripts/workflows.
GridBot runs inside GitHub Actions using GRIDBOT_PAT.
Vikram manually triggers audit first.
ChatGPT reviews the committed audit evidence.
Vikram manually triggers apply only after review.
GridBot commits apply evidence.
Vikram verifies the live page.
```

Do not give Vikram a patch pack as the default. If the GitHub connector exposes write tools, commit the script or workflow directly. If write tools are not available, say so clearly.

Before making changes, read in this order:

```text
README.md
AI_START_HERE.md
AI_GRIDBOT_START_HERE.md
data_science_protocol/AUDIT_PROCESS_AND_REPORTING_REQUIREMENTS.md
scripts/README_GRIDBOT_AUDIT_REQUIREMENTS.md
.github/workflows/README_GRIDBOT_AUDIT_WORKFLOWS.md
recent data_science_protocol/audit_reports/*_LATEST.md
recent commits from the last 5 to 7 days
```

For production code or data changes, follow this exact pattern:

```text
1. Inspect existing workflow and script patterns.
2. Inspect recent audit and apply reports for the same module.
3. Commit or update the GridBot script and workflow on main.
4. Ask Vikram to trigger audit mode only.
5. Read the committed audit report and JSON report.
6. Confirm whether apply is safe.
7. Ask Vikram to trigger apply mode only if audit passes.
8. Read the apply report.
9. Verify live route and confirm rollback path.
```

Never skip audit mode. Never run apply first. Never mutate broad app or data files without a declared target list. Never use broad `git add .` in workflows.

Data doctrine:

```text
Raw API data is transient.
Compact reviewed facts are committed.
MWh is additive.
Peaks, lows and extrema are not additive.
FUELINST is live/provisional and usually 5 minute grain.
FUELHH is historic/settled and half hourly.
Solar needs explicit PVLive or embedded estimate provenance.
Interconnectors are not generation.
Do not collapse INT* codes into one Imports & Exports bucket.
Imports must stay positive when defined as GB imports.
Exports must stay negative when defined as GB exports.
Keep named interconnector identity, country, BMRS code and direction.
```

Repository size doctrine:

```text
One repo per serious app is preferred.
This root repo should become portal, doctrine, redirects and shared governance.
Do not commit raw bulk, large archives or GIS basemap bloat to app repos.
Use GitHub Actions as the compiler: raw in, compact facts out, raw discarded.
```

Stale workflow warning:

```text
If duplicate workflows exist, inspect them before triggering.
Prefer the latest non stale workflow whose report paths match the current script.
Do not use workflows that still write to data_science_protocol/audit_reports/json/json/.
```
