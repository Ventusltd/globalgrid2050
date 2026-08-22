# V6 Pass 3 scope checklist

Pass 3 is satisfied only by generated production artefacts, not by code presence.

Required PASS evidence:
- V1-V5 Git blob identities unchanged from the frozen baseline.
- dashboard_v6_live.html exists, closes correctly, contains no iframe, is not truncated and is at least V5-sized.
- V6 retains gauges, technology/status filters, county selector, asset search, newspaper, news filters/search, REPD table, mobile layout and CSV export.
- V6 visibly exposes GlobalGrid Project ID, GlobalGrid Development ID, REPD Ref ID, REPD Record Last Updated and explicit `not supplied by REPD` handling.
- Manifest resolves to official DESNZ/GOV.UK CSV and XLSX with valid edition/page dates.
- Official CSV and XLSX reconcile by the same Ref ID set and core fields.
- Q2 2026 source, when active, reconciles to 14,657 rows, 3,445 raw solar >1 MW and 269 raw BESS >100 MW.
- Serving REPD master retains unique official Ref IDs and hardened ingestion provenance.
- V6 project JSON exactly equals the serving-master threshold recomputation: solar >1 MW, BESS >100 MW.
- Eligible REPD Record Last Updated coverage is >=99%; blanks remain explicit and are never invented.
- Every accepted story has one PRIMARY_MATCH, canonical GlobalGrid IDs, eligible official REPD Ref ID, exact REPD project/status/capacity fields, valid date/source/URL and confidence >=68.
- Duplicate project names require corroboration; capacity never establishes identity alone.
- Foreign geography and known V5 false-positive classes are absent.
- RELATED_DEVELOPMENT links cannot drive NEWS SIGNAL.
- REPD STATUS remains official and separate from headline-derived NEWS SIGNAL.
- Only after all validators pass may the homepage promote V6 and Pages deploy it.

If any gate fails, production must retain V5 as live and commit only a fail-closed diagnostic stage.
