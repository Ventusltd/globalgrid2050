# Typed transition context composition

`build_transition_context.py` composes the existing Covenant, Grid/DC and
Solar/DC producers for a future V9.29 News disclosure. It does not create a
release, acquire sources, crosswalk identities, rank records or modify datasets.
All three input families are mandatory. A missing, empty, invalid or oversized
family fails the complete export before any report is returned.

## Dependency closure

The implementation reuses these producer APIs unchanged:

| Original commit | Required product input or API |
| --- | --- |
| `e0deabac45d35240f6c38f4303b8d50c90412e06` | `filings/contracts.py`: exact `validate_claim` |
| `38f9c66c9aa0ded04a8809827ae2bb2f0c47b02b` | `policy_commitments/ledger.py`: `evaluate`; `sample_ledger.json` |
| `2664b886685485ea46c8ce2978a22aed718cd9ec` | `dc_context/grid.py`: `build`; `grid-source-fixture.json` |
| `9d088dbdd201dd9afdfc2bce42bda05a45c53fd2` | `dc_context/solar.py`: `build`; `fixtures/solar-context.json` |

The separate historical inventory from
`80631c260418dc41eedf4e815dbbfbeca6ccf94d` remains unchanged. This composition
does not evaluate or turn that inventory into commitments. The Covenant
coverage note and its unbound COP31 document remain available in metadata.
An adopted procedural agenda is not an adopted substantive conference outcome.

The authored increment owns only this document, `build_transition_context.py`
and `tests/test_transition_context.py`. Dependency cherry-picks are separate
from the authored commit. No shared workflow, collector or registry is added.
Runtime dependencies are Python 3.12+ and the three producer modules above;
tests use the repository's existing pytest installation. No installation or
network is required for the export.

```python
from automation.news.build_transition_context import build, dumps, csv_report
report = build(policy_input, grid_input, solar_input,
               as_of="2026-11-16T18:00:00Z")
json_text = dumps(report)
csv_text = csv_report(report)
```

```sh
python -B -m automation.news.build_transition_context \
  --policy automation/news/policy_commitments/sample_ledger.json \
  --grid automation/news/dc_context/grid-source-fixture.json \
  --solar automation/news/dc_context/fixtures/solar-context.json \
  --as-of 2026-11-16T18:00:00Z --format json --output transition-context.json
```

Use `--format csv` and a different new output filename for CSV. Omitting
`--output` emits UTF-8 bytes to stdout. Existing files are never overwritten;
parents must already exist. File output writes and flushes a unique staging
file in the destination directory, then uses an atomic exclusive hard link to
publish complete bytes. Interrupted writes remove that staging file without
creating the destination; concurrent destination creation is preserved. A
filesystem that cannot support the hard link fails closed, with no fallback
to replacement. Invalid inputs exit nonzero with a bounded generic error and
no new artifact. No publication pointer is written. The library
returns an independent object and leaves supplied input dictionaries unchanged.

## Consumer contract

Top-level schema is `globalgrid2050.transition-context.v1`. All fields are
required: `schema`, `as_of`, `status`, `coverage`, `input_receipts`, `records`,
`limitations`. Status is always `PROVISIONAL`.

`coverage` contains `records`, `families` (policy/grid/solar counts),
`numeric_claims`, `linked_projects` (always **0**) and
`scope=BOUNDED_SUPPLIED_CONTEXT`. There is no implied coverage of every project,
issuer, institution, country or policy. `as_of` is the caller's evaluation clock,
not publication time, successful collection time or a statement of freshness.

Each `input_receipts` entry contains `family`, `input_schema`, `input_sha256`,
`output_schema`, `record_count`, `source_count`,
`source_byte_validation=RECEIPTS_ONLY` and `native_metadata`.
`input_sha256` hashes the **entire supplied JSON value**, serialized by `dumps`
(UTF-8, sorted object keys, two-space indent, one trailing newline).
Array order is retained in this digest. This is not a publisher-document hash.

`native_metadata` retains every producer output field except its record array.
Together with the family's unchanged `native_record` entries it reconstructs
the complete native report. In particular, Covenant's three document receipts
remain present even where a document has no commitment row. Its unbound COP31
source stays `IN_PROGRESS`, with unavailable original-byte hash/retrieval
values null. Consumers must not turn that source into a commitment or a result.

Every `records` row contains precisely these fields:

| Field | Meaning |
| --- | --- |
| `id` | Family prefix plus the unchanged native context/commitment key; not an official site identifier |
| `family` | `policy`, `grid` or `solar` |
| `title` | Native commitment statement or context name; plain text to escape in the UI |
| `scope` | `{kind,native_scope,entity_id,canonical_project_id,binding}` |
| `source_state` | Exact producer instrument/source state, including `REJECTED`, `PROPOSED`, `DRAFT`, `AGREEMENT_REPORTED` when supplied |
| `evaluation_state` | Covenant state unchanged; Grid/Solar `UNKNOWN` |
| `applicability_state` | Covenant applicability unchanged; Grid/Solar `UNKNOWN` |
| `source_links` | Dated links with locators and full native source receipts |
| `numeric_claims` | `{role,qualifier,claim}` entries; unchanged validated FIGURES claims |
| `native_schema` | Native evaluated producer schema |
| `native_record` | Complete unchanged evaluated row, including all limitations and nulls |

`scope.kind` is a presentation category, not a new entity assertion. Native
issuer maps to `issuer`; consolidated group maps to `portfolio`; explicit
portfolio-storage relationship also maps to `portfolio` while keeping its
native issuer scope. Project/site/campus/phase map to `project`; other policy
contexts map to `policy`. Unsupported categories such as a Grid zone map to
`UNKNOWN` and retain `native_scope=zone`. Consumers must display native scope
where relevant. Every `canonical_project_id` is null and `binding=UNLINKED`.
Never attach a context to a REPD/DC record through name similarity, coordinates,
the displayed entity key or the presentation category.

Each link contains `document_id`, `url`, `publisher`, `published_date`,
`reviewed_at`, `retrieved_at`, `sha256`, `locator={section,page,text}` and
`receipt` (the complete unchanged source object). Unsupplied clocks/hashes stay
null. Covenant textual locators use `text`; Grid/Solar use `section`/`page`.
Figure provenance retains its native exact locator independently. Source URL
validation comes from the producer; consumers must still escape text and
validate links before placing them in HTML. No links are fetched by this code.

Figure `role` is `TARGET`, `BASELINE`, `UPDATE` or `CONTEXT`. `qualifier` is
Solar's exact `stated`, `upper_bound` or `approximate`; otherwise it is null
because the upstream adapter supplied no separate bound. Null never means
exact. Decimal strings, scale, original unit, currency, finance stage, basis,
entity scope, reporting period, as-of precision, provenance and revisions all
remain inside the unchanged FIGURES claim. Missing figures are an empty list,
with the original omission/unsupported-metric explanation in `native_record`.
Repeated claim identities across families fail rather than imply corroboration.

Grid's rejected amendment retains its **forecast project-demand** figure. It
does not establish a secured connection or energised load. Solar's historical
2024 procurement target remains forecast at a 2026 evaluation. Its battery
upper bound is not storage energy or an onsite allocation. Covenant's
`EVIDENCE_SUPPORTED_RESULT`, where supplied evidence supports it, denotes an
exact compatible numerical relation; native `legal_compliance=NOT_ASSESSED`
remains unchanged. Missing progress is not a breach.

## Bounds and CSV

Each of the three input JSON values is bounded to 4 MiB. The CLI also bounds
raw input reads and rejects duplicate JSON keys. Existing stricter producer
source/row limits still apply. The combined report has at most 3,000 rows and
16 MiB of canonical JSON; CLI exports, including CSV, also have a 16 MiB bound.
CSV enforces that UTF-8 byte budget on every writer operation, before repeated
bundle metadata can accumulate into an unbounded in-memory export.
There is no silent truncation or partial-family publication.

CSV has one row per context. Column order is `bundle`, followed by the row
fields in the table above. `bundle` is a JSON cell containing **all top-level
metadata except records**, including coverage, native metadata, limitations
and complete input receipts. Repetition makes each row independently
attributable; it does not imply independent sources. Every nested row field is
also a JSON cell, so JSON/CSV preserve exact numbers, nullable values and source
receipts. Scalar cells beginning `=`, `+`, `-`, `@`, tab or carriage return are
prefixed with an apostrophe for spreadsheet safety. CSV escaping is not HTML
escaping. Consumers should parse nested JSON, not split CSV on commas.

## Bounded replay and verification

At `2026-11-16T18:00:00Z`, the supplied fixtures produce **14 contexts**:
eight Covenant commitments (seven `UNKNOWN`, one `REPORTED_PROGRESS`), two Grid
contexts and four Solar contexts. Three typed figures survive; linked projects
remain **zero**. This is a replay of the named input receipts, not newly read
sources or real delivery verification.

```sh
python -B -m pytest -q -p no:cacheprovider \
  automation/news/tests/test_transition_context.py \
  automation/news/tests/test_policy_commitments.py \
  automation/news/tests/test_filing_figures.py \
  automation/news/tests/test_grid_dc_context.py \
  automation/news/tests/test_solar_dc_context.py
```

Tests exercise actual producer composition, complete native-report recovery,
UTF-8 CLI JSON/CSV, full CSV parity, unsafe input rejection, exact large
decimals, finance-stage/period/unit incompatibility, draft/applicability/revision
uncertainty, null original source receipts, historical forecasts, scope
categories, interrupted writes, concurrent destination creation and
no-overwrite/missing/oversized-input behavior. This increment
does not provide browser/UI acceptance or authorize acquisition, source reuse,
release promotion or publication.
