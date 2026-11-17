## V9.38 bounded government-fact extension

The original operator discovery fixtures and default API remain `REVIEW_REQUIRED`
and `publishable=false`. Two additional exact GOV.UK HTML documents support one
Sea Link EN020026 consent event. A government authority is a publisher, not the
reported network operator NGET. No source role may silently turn government
publication into an operator's notice or a connection/REPD/ETYS identity join.

`government-facts.json` is manual, narrow factual transcription with actual HTML
byte/hash/retrieval and OGL-footer receipts. It is not a collector or blanket
licence. No images, linked planning documents, application bodies or third-party
material are included. Raw fetched pages remain private QA artifacts. Both pages
state OGL v3.0 except where otherwise stated; direct licence-endpoint browsing
returned HTTP403 during this observation, retained as a limitation rather than
silently substituting wider rights.

Publication/event/milestone dates use `{value: YYYY-MM-DD, precision: DAY}`.
They are not fabricated midnight instants. Retrieval is an explicit UTC instant.
Submission27March2025, acceptance23April2025, recommendation30July2026 and
consent30October2026 are separate clocks. The up-to2GW figure is a planned
transmission upper bound; current capacity, commissioning, connection and
coordinates remain unknown. The domestic Suffolk-Kent scheme is not added to the
existing interconnector dataset.

`reviewed_government_notice(rows, approval)` retains a hidden review-required
wrapper until two distinct Agent A/B narrow fact-rights review references match
the exact canonical fact hash. References are auditable workflow inputs, not
authenticated identities or a new grant of rights by code. Ordinary operator
rows cannot use this gate. Tests use explicitly synthetic references only; they
do not confer actual publication approval. The versioned shared GRID consumer
is fail-closed on pending/mismatched approval, changed hashes or extra claims.

## Additional owner research recovered

Ventusltd/data_uk_dno_and_tso already contains a second-stage DNO/TSO API comparison at dno_tso_second_stage_study_apis_datasets_joins.md.md on main. It maps Opendatasoft, CKAN and direct-download portal families, ECR, LTDS, DFES and NDP datasets, and stated rate limits. Reuse and independently recheck this research before any future collector; do not construct an unapproved second fetch infrastructure. Its rights assumptions are not approvals by grid_watch.


The original adapter.py, __init__.py, sources.json, README.md and test_grid_watch.py
remain byte-identical to their immutable donor. Import new functions explicitly:

```python
from automation.news.grid_watch.government_v938 import normalise, build_grid_rows, reviewed_government_notice
```

Load the two government source policies from `government-sources.v938.json`.
Ordinary operator records delegate to the original adapter's `normalise`;
canonical JSON, UTC timestamps, text and source URL checks are imported from it.
There is no additional collector or scheduler. `government-facts.json` retains
its actual receipts and manual pins; the public fact digest/notice bytes are unchanged.
