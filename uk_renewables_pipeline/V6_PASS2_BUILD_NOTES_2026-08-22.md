# V6 Pass 2 build implementation

Date: 2026-08-22

Implemented against the frozen V6 build plan:

- Hardened DESNZ REPD ingestion with whitespace/alias-normalised headers.
- Preserves official blank Record Last Updated values rather than inventing dates.
- Marks source capacity as known/unknown so missing capacity is not mistaken for genuine 0 MW evidence.
- Independent official DESNZ CSV versus XLSX reconciliation by Ref ID and core fields.
- Q2 2026 exact raw quantity gates: 14,657 records, 3,445 solar >1 MW, 269 BESS >100 MW.
- Canonical GlobalGrid identity spine from the previous priority pass remains authoritative.
- V6 is still generated from the complete V5 gospel application; V1-V5 are immutable.
- V6 UI is hardened after generation to expose GlobalGrid Project ID, GlobalGrid Development ID, REPD Ref ID and REPD Record Last Updated.
- Blank official REPD update dates render as `not supplied by REPD`.
- V6 CSV export preserves GlobalGrid IDs, REPD identity, official status and separate NEWS SIGNAL.
- News project-name matching adds duplicate-name corroboration; exact duplicated names alone cannot resolve identity.
- Foreign-location veto is tightened before scoring.
- Six-month discovery is source-first across the complete eligible universe; BESS targeted backstop remains complete and solar targeted batches rotate to stay within the <=170 second crawl budget.
- Only PRIMARY_MATCH article/project relationships can drive NEWS SIGNAL; RELATED_DEVELOPMENT is context only.
- New scope validator checks V1-V5 immutability, V6 structural completeness, official DESNZ provenance, source reconciliation, serving REPD identity, >1 MW solar / >100 MW BESS exact recomputation, update-date coverage, newspaper quality, known false-positive classes and relationship discipline.

Pass 2 does not promote V6 by itself. The production workflow must generate the artefacts and pass Pass 3 scope validation before the homepage is changed.
