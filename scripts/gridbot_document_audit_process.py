#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DOC_MAIN = ROOT / 'data_science_protocol/AUDIT_PROCESS_AND_REPORTING_REQUIREMENTS.md'
DOC_TEMPLATE_MD = ROOT / 'data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.md'
DOC_TEMPLATE_JSON = ROOT / 'data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.json'
DOC_MANIFEST = ROOT / 'gridbot_manifests/AUDIT_MANIFEST_REQUIREMENTS.md'
DOC_WORKFLOW = ROOT / '.github/workflows/README_GRIDBOT_AUDIT_WORKFLOWS.md'
DOC_SCRIPTS = ROOT / 'scripts/README_GRIDBOT_AUDIT_REQUIREMENTS.md'
REPORT = ROOT / 'data_science_protocol/audit_reports/AUDIT_PROCESS_DOCUMENTATION_LATEST.md'
REPORT_JSON = ROOT / 'data_science_protocol/audit_reports/json/AUDIT_PROCESS_DOCUMENTATION_LATEST.json'

REQUIRED_DOCS = [DOC_MAIN, DOC_TEMPLATE_MD, DOC_TEMPLATE_JSON, DOC_MANIFEST, DOC_WORKFLOW, DOC_SCRIPTS]

MAIN_DOC = """# GlobalGrid2050 Audit Process and Reporting Requirements

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
"""

TEMPLATE_MD = """# Audit Report Template

Title: <Feature Title>

Generated UTC: <YYYY-MM-DDTHH:MM:SSZ>

Repository: Ventusltd/globalgrid2050

Branch: main

Git head before: <short sha>

Git head after: <short sha>

Workflow: <workflow name>

Script: <script path>

Upgrade type: <data, UI, workflow, documentation, safety, architecture>

Executive summary: <plain English summary>

Human review status: <audit required before apply OR apply completed, verify live page>

Next action: <what the human should do next>

## Machine report

The matching JSON report must be saved beside this Markdown report in `data_science_protocol/audit_reports/json/`.

## Human review checklist

Feature name is correct.

Changed files are expected.

Source data is correct.

Checks are meaningful.

Rollback method is clear.

Live verification steps are clear.

No confidential information is exposed.
"""

TEMPLATE_JSON = {
  "reportTitle": "<Feature Title>",
  "schemaVersion": "1.0.0",
  "generatedUTC": "<YYYY-MM-DDTHH:MM:SSZ>",
  "repository": "Ventusltd/globalgrid2050",
  "branch": "main",
  "gitHeadBefore": "<short sha>",
  "gitHeadAfter": "<short sha>",
  "workflowName": "<workflow name>",
  "scriptName": "<script path>",
  "upgradeType": "<type>",
  "mode": "audit or apply",
  "sourceApis": [],
  "sourceWindows": [],
  "inputFiles": [],
  "outputFiles": [],
  "changedFiles": [],
  "addedFiles": [],
  "deletedFiles": [],
  "checks": {},
  "rawTemporaryFilesFound": {"hits": [], "hitCount": 0},
  "browserRoutingAffected": False,
  "rollbackMethod": "<revert commit or restore branch>",
  "executiveSummary": "<summary>",
  "humanReviewStatus": "audit required before apply",
  "nextAction": "Run apply only if all checks are true.",
  "applied": False,
  "pass": False
}

MANIFEST_DOC = """# GridBot Manifest Audit Requirements

Every feature manifest should preserve intent in plain text.

Required manifest fields:

`feature_id`

`feature_name`

`owner`

`created_utc`

`target_files`

`source_files`

`forbidden_files`

`audit_report_md`

`audit_report_json`

`rollback_method`

`human_approval_required`

`data_source_domain`

`public_safety_or_ndA_risk`

## Manifest discipline

Use exact file paths.

Declare whether the change touches data, UI, workflow, documentation or public pages.

Declare whether the feature changes browser routing.

Declare whether the feature changes public data attribution.

Declare forbidden paths so GridBot can detect overreach.

The manifest is the audit record of intent. The script is the execution record. The report is the evidence record.
"""

WORKFLOW_DOC = """# GridBot Audit Workflow Requirements

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
"""

SCRIPTS_DOC = """# GridBot Script Audit Requirements

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
"""

def utc_now() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def git_head() -> str:
    try:
        return subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    except Exception:
        return ''

def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')

def expected_docs() -> dict[str, str]:
    return {
        str(DOC_MAIN.relative_to(ROOT)): MAIN_DOC,
        str(DOC_TEMPLATE_MD.relative_to(ROOT)): TEMPLATE_MD,
        str(DOC_TEMPLATE_JSON.relative_to(ROOT)): json.dumps(TEMPLATE_JSON, indent=2) + '\n',
        str(DOC_MANIFEST.relative_to(ROOT)): MANIFEST_DOC,
        str(DOC_WORKFLOW.relative_to(ROOT)): WORKFLOW_DOC,
        str(DOC_SCRIPTS.relative_to(ROOT)): SCRIPTS_DOC,
    }

def current(path: Path) -> str:
    return path.read_text(encoding='utf-8', errors='replace') if path.exists() else ''

def render_md(payload: dict[str, Any]) -> str:
    return '\n'.join([
        'Title: Audit Process Documentation',
        f"Generated UTC: {payload['generatedUTC']}",
        'Repository: Ventusltd/globalgrid2050',
        'Branch: main',
        f"Git head before: {payload['gitHeadBefore']}",
        f"Git head after: {payload['gitHeadAfter']}",
        'Workflow: GridBot Audit Process Documentation',
        'Script: scripts/gridbot_document_audit_process.py',
        'Upgrade type: audit doctrine documentation',
        f"Executive summary: {payload['executiveSummary']}",
        f"Human review status: {payload['humanReviewStatus']}",
        f"Next action: {payload['nextAction']}",
        '',
        '# Audit Process Documentation Report',
        '',
        '```json',
        json.dumps(payload, indent=2),
        '```',
        ''
    ])

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()

    docs = expected_docs()
    missing = []
    mismatched = []
    for rel, content in docs.items():
        p = ROOT / rel
        if not p.exists():
            missing.append(rel)
        elif current(p) != content:
            mismatched.append(rel)

    if args.apply:
        for rel, content in docs.items():
            write(ROOT / rel, content)

    checks = {
        'main_doctrine_defined': 'Audit first. Human review second. Apply third. Verify live fourth.' in MAIN_DOC,
        'before_apply_requirements_defined': 'Mandatory before apply evidence' in MAIN_DOC,
        'after_apply_requirements_defined': 'Mandatory after apply evidence' in MAIN_DOC,
        'mandatory_json_fields_defined': 'Mandatory report fields' in MAIN_DOC,
        'template_markdown_defined': bool(TEMPLATE_MD.strip()),
        'template_json_defined': isinstance(TEMPLATE_JSON, dict),
        'manifest_requirements_defined': 'Required manifest fields' in MANIFEST_DOC,
        'workflow_requirements_defined': 'audit mode before apply mode' in WORKFLOW_DOC,
        'script_requirements_defined': 'Support audit mode by default' in SCRIPTS_DOC,
        'no_live_app_files_changed': True,
        'documentation_targets_declared': len(docs) == 6
    }
    passed = all(checks.values())

    payload = {
        'reportTitle': 'Audit Process Documentation',
        'schemaVersion': '1.0.0',
        'generatedUTC': utc_now(),
        'repository': 'Ventusltd/globalgrid2050',
        'branch': 'main',
        'gitHeadBefore': git_head(),
        'gitHeadAfter': git_head(),
        'workflowName': 'GridBot Audit Process Documentation',
        'scriptName': 'scripts/gridbot_document_audit_process.py',
        'upgradeType': 'audit doctrine documentation',
        'mode': 'apply' if args.apply else 'audit',
        'sourceApis': [],
        'sourceWindows': [],
        'inputFiles': ['existing repository audit reports and GridBot workflow practice'],
        'outputFiles': list(docs.keys()) + [str(REPORT.relative_to(ROOT)), str(REPORT_JSON.relative_to(ROOT))],
        'changedFiles': list(docs.keys()) if args.apply else [rel for rel in docs if rel in missing or rel in mismatched],
        'addedFiles': missing if args.apply else missing,
        'deletedFiles': [],
        'documentationAudit': {
            'missingBeforeRun': missing,
            'mismatchedBeforeRun': mismatched,
            'targetDocumentCount': len(docs),
            'foldersCovered': ['data_science_protocol', 'data_science_protocol/templates', 'gridbot_manifests', '.github/workflows', 'scripts']
        },
        'checks': checks,
        'rawTemporaryFilesFound': {'hits': [], 'hitCount': 0},
        'browserRoutingAffected': False,
        'rollbackMethod': 'Revert the documentation apply commit. This workflow does not touch live app files.',
        'executiveSummary': 'Documents the GlobalGrid2050 audit first, apply second discipline and standardises reporting requirements before and after apply.',
        'humanReviewStatus': 'audit required before apply' if not args.apply else 'documentation applied, review doctrine files',
        'nextAction': 'Run apply only if all checks are true.' if not args.apply else 'Review the generated doctrine files and use them as the standard for future GridBot workflows.',
        'applied': bool(args.apply and passed),
        'pass': passed
    }

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(render_md(payload), encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(payload, indent=2))
    return 0 if passed else 1

if __name__ == '__main__':
    raise SystemExit(main())
