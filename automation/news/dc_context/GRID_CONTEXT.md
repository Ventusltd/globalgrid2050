# Grid and data-centre source context

This successor module turns bounded official document facts into deterministic
research context. It preserves the distinction between a development proposal,
a rejected connection amendment, an offer, a reported energisation, a network
upgrade and a funding stage. It does not edit the REPD register, Solar-1000,
Global DC identities, V9.25, workflows or publication pointers.

## API and dependency

```python
from automation.news.dc_context.grid import build, dumps
result = build(bundle, as_of="2026-11-16T18:00:00Z")
```

Input schema is `globalgrid2050.grid-dc-context-input.v1`; output schema is
`globalgrid2050.grid-dc-context.v1`. `grid-source-fixture.json` documents every
required field and `grid-context-fixture.json` is its exact replay output.
Unknown fields, unsupported state combinations, failed receipts, private or
unapproved URLs, duplicate IDs and inconsistent clocks fail the whole build.
Output order is stable. Input objects are never mutated. Limits are 100 sources,
1,000 contexts, 20 numerical claims per context and 4 MiB per input/source body.

Optional numerical claims use the shared
`automation.news.filings.contracts.validate_claim` API, authored at
`e0deabac45d35240f6c38f4303b8d50c90412e06`. Integrate that producer's commit before
this module. Its temporary cherry-pick on this topic branch is a test dependency,
not another GRID-DC deliverable. Values retain exact decimal strings, scale,
original units, document locators and source clocks. The adapter additionally
requires the same document/hash/entity/scope/locator and compatible source state.
A rejected requested load cannot be labelled secured connection or energised
load. Finance stage must match announced, committed or disbursed context.
Group totals cannot pass as site numbers. No conversion or addition occurs.

The module performs no network calls. It consumes reviewed source metadata;
source-body hashes must be independently compared upstream. A syntactically
valid receipt does not authenticate a source, extract text or prove a claim.
The narrow current host allowlist is GOV.UK and FERC. An observed HTTP200 means
the named document was readable at retrieval, not a licence for other documents.
Output retains factual metadata and links, not raw bodies or full quotations.

## Real source rehearsal

Both exact URLs returned HTTP200 during a bounded direct HTTPS probe on
16 November 2026. Redirects were disabled, connection/read timeouts were 10/25
seconds, and the body cap was 4 MiB. Raw bodies were inspected locally and are
not committed. The committed fixture includes the original retrieval instants,
byte counts and SHA256 values.

| Document | Source date and locator | Rehearsal fact and treatment |
| --- | --- | --- |
| [DSIT AI Opportunities Action Plan government response](https://www.gov.uk/government/publications/ai-opportunities-action-plan-government-response/ai-opportunities-action-plan-government-response) | 13 January 2025; infrastructure section | Culham is a conditional development proposal. The text gives initial 100MW capacity and an ambition of 500MW, without distinguishing IT load, site demand or connection basis. Typed figures are omitted rather than assigned an invented basis; zone scope is also unsupported by FIGURES v1. |
| [FERC 189 FERC 61,078, ER24-2172](https://www.ferc.gov/sites/default/files/2024-11/20241101-3061_ER24-2172-000.pdf) | 1 November 2024; page 1, paragraph 1 | The order rejects the requested amended ISA. Its proposed 480MW co-located load is a `project_demand` forecast in this historical request, not a secured or energised quantity. Rejection of this amendment is not a claim that every existing arrangement was rejected. |

The FERC PDF page was independently parsed with pypdf during the rehearsal:
its source bytes, requested load and rejection wording matched the receipt.
The government HTML body matched its receipt and conditional proposal wording.
Those are scoped extraction checks, not independent project verification. No
attempt was made here to determine the latest subsequent decision or delivery.

GOV.UK's first-published/public-updated date is 13 January 2025. Its HTML also
contains a later internal updated-at timestamp. The module retains publication
as the document clock; it does not turn an internal page update or fresh download
into a new planning event. Both rehearsal documents are historical as of the
replay. Source-document age and retrieval age are separate output fields.

## Consumer boundary

Each context has an internal `grid-context:*` key and a separate source entity
reference. Neither is presented as an official facility ID. The output has zero
canonical project links and does not add these contexts to a facility census.
DC acquisition/crosswalk owners must supply explicit identity evidence before a
consumer can associate them with existing site, campus or phase records. Name
similarity or geographic proximity is insufficient. Current project status,
secured connection, energised load, available grid and site CAPEX remain null or
UNKNOWN. Numerical claims retain their historical source state in their parent
context; displaying them without that state would violate this contract.

Research actions are transparent follow-up instructions. This module supplies
no heat score, commercial rank, independent-source count or VERIFIED transition.
The prospecting producer owns ranking. Finance claims in the generic contract
require an upstream permitted-source and group/site eligibility decision; this
two-document slice contains no corporate enrichment or finance claims. Personal,
director and address fields are not accepted. No paywalled source is used.

## Existing estate boundaries

The canonical Spider programme identifies owner products and dependency closure;
its inspected revision `202609052048` is a plan, not proof of implementation.
This is an additive offline consumer under the command assignment, not a new
scheduled collector or copied owner dataset.

Ventus Grid Engine's `v9-geodesy.js` owns geometric distance calculations. The
adapter does not duplicate or call that engine because no distance is needed to
validate documentary grid claims. In particular it cannot infer a connection or
available capacity from a nearest mapped substation.

Existing acquisition analytics documents the estate's typed Parquet, sorted
export, hash and full-row readback conventions. This two-record consumer keeps
canonical JSON and exact replay tests; an analytical exporter can consume it
after acceptance. Adding a competing database, GPU path or Parquet compiler
would not improve this bounded validation workload.

## Reproduce

After integrating the shared FIGURES dependency:

```sh
python -m pytest -q automation/news/tests/test_grid_dc_context.py automation/news/tests/test_filing_figures.py
python -m automation.news.dc_context.grid --input automation/news/dc_context/grid-source-fixture.json --as-of 2026-11-16T18:00:00Z --output tmp/grid-context-replay.json
```

The output file must be new. Existing outputs cannot be overwritten. Compare its
bytes with `grid-context-fixture.json`; no live fetch, pointer update or release
promotion is performed. Tests cover unsafe URLs, failed/oversized receipts,
malformed/future clocks, duplicate records, HTML text, scope/provenance mismatch,
rejected-load false upgrades, exact decimal preservation, replay and CLI failure
before output. Synthetic mutations in tests do not assert new real source facts.
