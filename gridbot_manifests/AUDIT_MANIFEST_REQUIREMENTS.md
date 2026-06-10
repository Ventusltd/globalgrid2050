# GridBot Manifest Audit Requirements

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
