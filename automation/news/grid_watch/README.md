# Agent 4 — UK Grid Watch (Pipeline News V9.28 candidate)

**Status: ISOLATED / REVIEW REQUIRED / NO RELEASE.** This offline evidence adapter converts official-operator scheme notices into conservative Pipeline News evidence records. It is NOT an automated collector, live network state or a verified connection register.

## Existing work — reuse, do not duplicate

- Earlier GRID AGENT implemented automation/news/grid_intelligence/* on v9.26-grid-agent at commit 5e3149dcff809bb8a9f065a6a1b5d51cb2ff029f, with 24 pytest checks reported PASS. That covers GridAtlas owner layers, Ventus Grid Engine interfaces, ETYS planned-change rows and podcast context; do not copy its code.
- Ventusltd/data-grid-gb already owns ETYS 2025 Appendix B/D retrieval, SHA-256 pinned files, connection-points v3 and grid network model v1. Its README reports 886 substations, 489 with separate map geometry, 1,392 circuits, 1,472 transformers and 2,230 planned-change rows. These figures are the original owner's published counts, not recomputed by this adapter. A rating or planned change is not available connection capacity.
- Ventusltd/gridatlas and Ventusltd/ventus-grid-engine own network layer, MAP nearest-node and route/geometry interfaces. They are read-only dependencies.
- Exclusive new directory: automation/news/grid_watch/. No collection scheduler, production release, homepage pointer, edition index or GridAtlas file changed.

## Official UK source inventory

sources.json lists fourteen reviewed primary pages: NESO ETYS and data portal; National Grid Electricity Transmission project listing and Great Grid Upgrade; SSEN Transmission project listings; SP Transmission strategic projects and connections; UK Power Networks, NGED, Northern Powergrid, SSEN Distribution, SP Energy Networks Distribution and SP Electricity North West portals; Ofgem licensees. Rights are UNASSESSED, and discovery of a website is not permission to automate extraction or redistribution. This covers the main GB distribution ownership groups at directory level only; it does not prove record-level coverage, permissions, or live monitoring.

## API / contract

normalise(operator_notice, source_map) -> evidence_record

build_grid_rows(list_of_notices, source_map) -> sorted evidence_records

Each input must include registered source_id, official HTTPS source_url, explicit UTC retrieved_at, network_operator, scheme_name and network_type. Optional fields: scheme_id, source_record_id, source_sha256, published_at, region, stage, reported_metric, etys_node_code.

The output retains distinct publication/retrieval dates, attributed publisher, source URL, source record ID and actual source byte hash only if supplied. Local record hash is a claim identifier, not proof the remote document was downloaded. No licence is self-approved.

The stage is exactly the publisher-reported item-level stage or unknown. Schema enforces distinct voltage kV, route length km, reported power MW, equipment rating MVA, and funding allocation GBP. It never converts equipment ratings to available MW or funding to project CAPEX. Exact operator scheme IDs may produce scheme keys, but name similarity and proximity do not. ETYS codes are retained as unverified crosswalks.

Every result has REVIEW_REQUIRED, licence_state UNASSESSED and publishable false. REPD link, confirmed grid connection and available MW are null. Identical claim snapshots dedupe; competing source-vintage claims remain distinct. No scored public ranking is generated.

## Fixtures / tests

fixtures.json is a bounded manual discovery sample: NGET Bramford to Twinstead (stage unknown), SSEN Eastern Green Link 2 (listed as Construction Phase), SPT Eastern Green Link 1 (stage unknown). Document publication dates and original remote source hashes remain null. **These are test fixtures, not approved public project records.**

Run from repository root:

~~~bash
python -m unittest discover -s automation/news/tests -p test_grid_watch.py -v
~~~

Consumer example:

~~~python
import json
from pathlib import Path
from automation.news.grid_watch import build_grid_rows
p = Path("automation/news/grid_watch")
sources = {s["id"]: s for s in json.loads((p/"sources.json").read_text())["sources"]}
records = json.loads((p/"fixtures.json").read_text())["records"]
rows = build_grid_rows(records, sources)
assert len(rows) == 3 and all(not row["publishable"] for row in rows)
~~~

The independently authored local file set passed 12/12 unittest methods on 16 November 2026. **GitHub Actions exact-branch CI is unverified until it runs.** V9.28 root must review dataset rights, actual item receipts, consistent scheme identities and the host integration hook. If accepted, add GRID as a tab inside the one Pipeline block with existing V9.24 black/monospace/cyan/yellow styling. No extra panel, score, homepage promotion or merge is authorised by this handoff.

Coordination: https://github.com/Ventusltd/neural-link-between-agents/issues/42

## Additional owner research recovered

Ventusltd/data_uk_dno_and_tso already contains a second-stage DNO/TSO API comparison at dno_tso_second_stage_study_apis_datasets_joins.md.md on main. It maps Opendatasoft, CKAN and direct-download portal families, ECR, LTDS, DFES and NDP datasets, and stated rate limits. Reuse and independently recheck this research before any future collector; do not construct an unapproved second fetch infrastructure. Its rights assumptions are not approvals by grid_watch.
