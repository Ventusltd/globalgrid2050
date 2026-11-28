# REPD project detail action

The candidate renderer adds a **Legal evidence** link inside each REPD project's existing detail section beside its planning reference. The helper uses the canonical record that the app already holds. It validates the project identity and passes the country as a search hint when recognised. The receiving LEGISLATION reader interprets this as project context. Interconnector reference rows stay outside the REPD adapter.

To assemble a candidate, run `python automation/pipeline_legal_evidence/install.py <parent>/scripts/plugins/projects-v9-8.js <new-output-file>`. Install the output as `scripts/plugins/projects-v9-8.js` in the next unpublished PipelineNews edition. The existing renderer file is read only. The helper is resolved from the shared automation directory at the same relative depth as the current operator-aliases dependency.

Run the release's desktop and mobile browser checks and open **Legal evidence** from a project detail panel. Verify the receiver, row reference and optional source fields against the canonical row. Complete the existing immutable-edition acceptance and promotion procedure before switching the homepage. This PR supplies candidate source and does not select a new build.
