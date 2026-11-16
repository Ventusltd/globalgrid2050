# 202611161630 (V9.25)

Parent: `202611161244` (V9.24), tree `2d109396cdef80302914045b5330e4f7007e5830`.

Adds a read-only Evidence panel to the unchanged Solar-1000 pilot. Provisional
headlines and links are loaded from validated immutable weekly snapshots;
missing, malformed, mismatched or auto-VERIFIED data is rejected. Official REPD,
CSV exports, map contracts and the two historical candidate links are preserved.

Publication is blocked: the configured source has unknown rights and is disabled.
A live health probe returned 10 articles and zero strict pilot matches. No test
fixture is released as real evidence. Existing V9.24 registry/operative drift and
the inherited GridAtlas mobile issue remain explicit limitations.

Acquisition, SQLite and snapshot code, workflow gates and commands are documented
in `automation/news/acquisition/README.md` at repository root. Tests cover source
failures, schema/rights rejection, idempotence, snapshot integrity, escaping,
375/768/1440 browser widths, all 7,775 CSV records and unchanged map identities.
