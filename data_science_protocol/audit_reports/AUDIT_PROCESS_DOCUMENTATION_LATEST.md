Title: Audit Process Documentation
Generated UTC: 2026-06-10T21:19:18Z
Repository: Ventusltd/globalgrid2050
Branch: main
Git head before: 8469ac3b
Git head after: 8469ac3b
Workflow: GridBot Audit Process Documentation
Script: scripts/gridbot_document_audit_process.py
Upgrade type: audit doctrine documentation
Executive summary: Documents the GlobalGrid2050 audit first, apply second discipline and standardises reporting requirements before and after apply.
Human review status: documentation applied, review doctrine files
Next action: Review the generated doctrine files and use them as the standard for future GridBot workflows.

# Audit Process Documentation Report

```json
{
  "reportTitle": "Audit Process Documentation",
  "schemaVersion": "1.0.0",
  "generatedUTC": "2026-06-10T21:19:18Z",
  "repository": "Ventusltd/globalgrid2050",
  "branch": "main",
  "gitHeadBefore": "8469ac3b",
  "gitHeadAfter": "8469ac3b",
  "workflowName": "GridBot Audit Process Documentation",
  "scriptName": "scripts/gridbot_document_audit_process.py",
  "upgradeType": "audit doctrine documentation",
  "mode": "apply",
  "sourceApis": [],
  "sourceWindows": [],
  "inputFiles": [
    "existing repository audit reports and GridBot workflow practice"
  ],
  "outputFiles": [
    "data_science_protocol/AUDIT_PROCESS_AND_REPORTING_REQUIREMENTS.md",
    "data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.md",
    "data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.json",
    "gridbot_manifests/AUDIT_MANIFEST_REQUIREMENTS.md",
    ".github/workflows/README_GRIDBOT_AUDIT_WORKFLOWS.md",
    "scripts/README_GRIDBOT_AUDIT_REQUIREMENTS.md",
    "data_science_protocol/audit_reports/AUDIT_PROCESS_DOCUMENTATION_LATEST.md",
    "data_science_protocol/audit_reports/json/AUDIT_PROCESS_DOCUMENTATION_LATEST.json"
  ],
  "changedFiles": [
    "data_science_protocol/AUDIT_PROCESS_AND_REPORTING_REQUIREMENTS.md",
    "data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.md",
    "data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.json",
    "gridbot_manifests/AUDIT_MANIFEST_REQUIREMENTS.md",
    ".github/workflows/README_GRIDBOT_AUDIT_WORKFLOWS.md",
    "scripts/README_GRIDBOT_AUDIT_REQUIREMENTS.md"
  ],
  "addedFiles": [
    "data_science_protocol/AUDIT_PROCESS_AND_REPORTING_REQUIREMENTS.md",
    "data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.md",
    "data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.json",
    "gridbot_manifests/AUDIT_MANIFEST_REQUIREMENTS.md",
    ".github/workflows/README_GRIDBOT_AUDIT_WORKFLOWS.md",
    "scripts/README_GRIDBOT_AUDIT_REQUIREMENTS.md"
  ],
  "deletedFiles": [],
  "documentationAudit": {
    "missingBeforeRun": [
      "data_science_protocol/AUDIT_PROCESS_AND_REPORTING_REQUIREMENTS.md",
      "data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.md",
      "data_science_protocol/templates/AUDIT_REPORT_TEMPLATE.json",
      "gridbot_manifests/AUDIT_MANIFEST_REQUIREMENTS.md",
      ".github/workflows/README_GRIDBOT_AUDIT_WORKFLOWS.md",
      "scripts/README_GRIDBOT_AUDIT_REQUIREMENTS.md"
    ],
    "mismatchedBeforeRun": [],
    "targetDocumentCount": 6,
    "foldersCovered": [
      "data_science_protocol",
      "data_science_protocol/templates",
      "gridbot_manifests",
      ".github/workflows",
      "scripts"
    ]
  },
  "checks": {
    "main_doctrine_defined": true,
    "before_apply_requirements_defined": true,
    "after_apply_requirements_defined": true,
    "mandatory_json_fields_defined": true,
    "template_markdown_defined": true,
    "template_json_defined": true,
    "manifest_requirements_defined": true,
    "workflow_requirements_defined": true,
    "script_requirements_defined": true,
    "no_live_app_files_changed": true,
    "documentation_targets_declared": true
  },
  "rawTemporaryFilesFound": {
    "hits": [],
    "hitCount": 0
  },
  "browserRoutingAffected": false,
  "rollbackMethod": "Revert the documentation apply commit. This workflow does not touch live app files.",
  "executiveSummary": "Documents the GlobalGrid2050 audit first, apply second discipline and standardises reporting requirements before and after apply.",
  "humanReviewStatus": "documentation applied, review doctrine files",
  "nextAction": "Review the generated doctrine files and use them as the standard for future GridBot workflows.",
  "applied": true,
  "pass": true
}
```
