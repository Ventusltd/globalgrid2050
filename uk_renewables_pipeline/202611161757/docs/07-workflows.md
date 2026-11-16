# Workflows and release discipline

V7 should have one orchestrated writer. Collection and validation run read-only; publication promotes one content-addressed edition only after source, identity, event, referential-integrity and frontend gates pass.

Failures update Actions summaries or artefacts while the public manifest continues to point to the last validated edition. Failure paths never commit to `main`. A newly discovered REPD quarter is staged and diffed rather than accepted through hard-coded counts or silently skipped.

## Immediate retirement

The V4, V5 and V6 newspaper workflows are `workflow_dispatch` only from 23 August 2026. Their schedule, push and issue triggers are retired. Historical pages and scripts remain for forensic reproduction, but they cannot automatically rewrite shared assets, the root homepage or `main`.

V7 North Star remains a read-only push gate. Pages remains the deployment workflow. V7 receives no scheduled writer until V7.9 production proof.

## Writer contract

- Exactly one authorised writer and one repository-wide publication concurrency group.
- Validate against a recorded base SHA; abort on base drift and rebuild instead of rebasing validated output.
- Stage content-addressed assets, validate them, then atomically move one manifest pointer.
- Write generated files through temporary paths, flush and `fsync`, parse/hash them, then use atomic replacement.
- Never move release blobs through logs, shell-output capture or unbounded text/base64 bridges.
- Fetch the resulting commit into a clean checkout, compare byte lengths and SHA-256 values and rerun the complete gate.
- Pages deploys the validated SHA, not whatever `main` contains when a queued job starts.

## Recorded failures

- V4 and V5 shared the same cron but separate concurrency groups; V4 advanced `main` while V5 was crawling.
- V5 discovery produced one headline and has no last-known-good merge, yet its five-story floor could still replace V7.1's frozen 125-story runtime feed.
- V6 coupled its scope gate to obsolete root-homepage wording and committed a diagnostic to `main` after validation failed.
- V7.2 local outputs passed before publication, but three remote blobs were corrupted at byte 393216 by a clipped text bridge. Local validation is therefore never accepted as remote publication proof.
