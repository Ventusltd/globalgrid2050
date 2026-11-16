# Solar, storage and procurement context

Successor-only module; no change to frozen V9.25, REPD, collectors or the live UI.
Dependency: the unchanged FIGURES contract from
`e0deabac45d35240f6c38f4303b8d50c90412e06`, `automation/news/filings/contracts.py`.
GRID-DC owns `grid.py`; this module has no dependency on its private helpers.

```python
from automation.news.dc_context.solar import build, dumps
result = build(bundle, as_of="2026-11-16T17:30:00Z")
```

```powershell
python -m automation.news.dc_context.solar --input automation/news/dc_context/fixtures/solar-context.json --as-of 2026-11-16T17:30:00Z
python -m pytest -q -p no:cacheprovider automation/news/tests/test_solar_dc_context.py automation/news/tests/test_filing_figures.py
```

`--output` creates a new JSON file exclusively and refuses replacement. The
library does no I/O or network acquisition. `source_bytes={source_id: bytes}`
optionally proves every receipt against supplied bounded response bytes; partial
coverage or changed bytes fails. Bodies are never copied into output. Without
bytes the output explicitly says `RECEIPTS_ONLY`, not reverified source content.

## Input and output

The fixture documents the exact input envelope and required nullable fields.
Sources record document identity, publisher/authority, HTTPS URL, publication
date (nullable), UTC retrieval time, HTTP status, byte length, SHA256 and a
fact-metadata-only output policy. Only the three reviewed primary-source hosts
are supported by this bounded adapter; widening requires source-policy review.
Government hosting does not make an issuer presentation a regulator finding.

Contexts retain source-defined entity scope and identity, source locator,
relationship, dated source state, omission reasons and scope limitations. Local
context/entity keys are not official DC or REPD identifiers. The result includes
four provisional rows with source links, explicit scope, dated-source age,
research actions and two typed figures. Each numerical entry wraps the exact
FIGURES claim in `{claim, qualifier}`. `upper_bound` is preserved separately:
the storage figure must never be rendered as an exact installed rating.
Decimal strings, original units, forecast/observation basis and revisions survive
unchanged. No MW-to-MWh conversion, FX conversion or site/group allocation occurs.
Finance inputs require group scope and consistent announced/committed/disbursed
stage; no real financial claim is included in this source slice. Group identity
and source truth still require caller-owned review, not schema validation.

No cohort crosswalk has been established: `canonical_project_id=null`,
`canonical_binding=UNLINKED`, `linked_project_count=0`. A consumer can display the
named Livingston source context, but must not attach it to a cohort row by name
similarity or coordinates. Google UK portfolio storage does not become Waltham
Cross onsite storage. Present delivery and site supply remain UNKNOWN/null even
when a historical source described commissioning or forecast an elapsed target.
Missing numbers require an explanation; they are never fabricated as zero.

## Real source slice and receipt limitations

Three bounded HTTP GETs returned 200 on 16 November 2026 at 17:21 UTC. Full response
bodies were hashed in memory; only factual metadata/locators are committed.
Each source's byte length, timestamp and full hash are in `fixtures/solar-context.json`.

- [Google presentation hosted by US EPA](https://www.epa.gov/system/files/documents/2021-10/gpp_webinar_092221_texier.pdf), 22 September 2021, PDF page 12: Nevada procurement programme, 350 MW solar and up to 280 MW battery power, with a 2024 target. These remain historical forecast quantities for operations and the grid, not achieved site supply or storage energy. SHA256 `6efe47b80b69b707d7a7b82cb629b672838b57c146b498487d44011cb0249d30`.
- [Google issuer release](https://www.googlecloudpresscorner.com/2025-09-16-Google-Opens-Waltham-Cross-Data-Centre-as-Part-of-Two-year-GBP5-Billion-Investment-in-the-UK-to-Help-Power-its-AI-Economy), 16 September 2025, Energy efficiency and capacity: Shell-managed UK portfolio with access to battery storage. No numerical battery capacity or site allocation is provided. SHA256 `2e3df07ab9723b8b60e90c9f8102807b40a358ce8376f9f12e95b935a15a308c`.
- [SMA supplier case study](https://www.sma-uk.com/references/iron-mountain-data-center-livingston), publication day unknown: named Livingston data-centre solar/PPA context, reported commissioning March 2020. Its headline says 800 kWp while the nominal-power field says 255 kW. Their scopes are unresolved, so neither becomes a numeric claim. SHA256 `a5a8fce85311098c6b01c4548e52e882a28f357ce37ec712de0743177575dd3d`.

The slice is not a facility census, current delivery audit, planning record,
source licence grant or automatic verification. Mutable web pages may return
different bytes later; create new receipts and review revisions rather than
silently replacing these observed hashes. Historical targets require new
delivery evidence. Original source attribution and links must remain visible.
