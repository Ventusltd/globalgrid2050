# COVENANT AGENT — bounded V9.26 ledger

This implements [Neural Link 43](https://github.com/Ventusltd/neural-link-between-agents/issues/43)
as an offline proposal. It records commitments and attributable updates, then
reports what the supplied evidence supports. It makes no legal or political
judgment, collects no data, changes no V9.25 files and publishes nothing.

## Current primary-source coverage

The seed contains eight entries from the
[Covenant published 28 October 2026](https://www.gov.uk/government/publications/data-centre-covenant/the-data-centre-covenant),
covering costs, community benefits, environmental design/reporting, skills,
security, conditional support, a control-centre undertaking and national capacity
context. The source distinguishes encouragement from strategic support conditions;
neither establishes a named project's applicability or measured performance.

The [13 November answer to question 41981](https://questions-statements.parliament.uk/written-questions/detail/2026-11-10/41981)
provides one process update: establishment work is underway and assessment detail
is forthcoming. Its result is REPORTED_PROGRESS, with measurement UNKNOWN.
Seven other seed entries are UNKNOWN. No seed has a quantitative measured result.
Annual reporting language is retained without inventing a first filing deadline.

The [COP31 landing page](https://unfccc.int/cop31) was reviewed during the
9–20 November conference at the 16 November checkpoint. Current updates and
procedural documents do not establish a substantive final outcome. The
[COP30 advance-text index](https://unfccc.int/cop30/auvs) is distinct from the
later formal decision report. `historical_sources.json`, authored separately by
the history producer, records ten bounded primary-source readings spanning
UNFCCC 1992, Kyoto, Paris, COP26/28/29/30 and COP31. Its exact locators, adopted
versus publication dates, unread coverage and artifact roles remain explicit.

Main Covenant publication text, the full short parliamentary answer and selected
COP31 landing-page sections were read. Linked legislation, detailed project
assessments, individual company reports and all historical documents in full
were not reviewed. No source inventory claims exhaustive coverage.

## Receipts and source boundaries

`sample_ledger.json` records document issuer, URL, edition/version, publication,
review and retrieval clocks, read locators and original-byte SHA256 where known.
The Covenant original HTML response was checked for its expected title/content
and hashed. Its receipt is not a certification of every underlying policy claim.
Original bytes are not bundled or reproduced.

Parliament direct HTML returned HTTP 403 and UNFCCC direct responses contained
access interstitials. Their primary text remained readable through the web
reader, but intended original bytes were not established. Consequently those
original `content_sha256` and `retrieved_at` fields are null, with explicit
limitations and separate `reviewed_at` clocks. An interstitial hash is never
represented as a document hash. Historical inventory has the same honest gap.
Such sources may support a clearly attributed qualitative update, but cannot
back a numeric FIGURES claim in this adapter without original-byte receipts.

Only short paraphrases and metadata are retained. Government hosting does not
automatically license third-party material. Publisher reporting can identify
primary documents, but press releases, headlines or permitted Bloomberg discovery
links cannot by themselves establish delivery. There are no bodies, quotations,
paywall bypasses, personal profiles or inferred company/project associations.

## Contract and API

Input schema: `globalgrid2050.policy-commitments.v1`. Required collections are
`documents`, `scopes`, `commitments`, `updates`, with a `coverage_note`.
`validate_ledger(mapping)` validates the complete graph and returns a deep copy.
Unknown keys, unread/unbound locators, duplicate identities, invalid clocks and
cyclic revisions fail closed. Empty coverage is not accepted.

Commitments retain the source/locator, issuer, jurisdiction/entity scope,
statement type, conditions, metric, target, baseline/state, source-precision
deadline, reporting obligation, applicability evidence and revision chain.
EXPECTATION, UNDERTAKING, CONDITIONAL_REQUIREMENT, CONDITIONAL_OFFER,
REQUIREMENT_STATED and CONTEXT describe source wording. They do not determine
legal force. Document states separately distinguish DRAFT, PUBLISHED,
PUBLISHED_POLICY, ADOPTED, IN_PROGRESS and UNKNOWN.

`evaluate(mapping, as_of=timezone_aware_timestamp)` is the comparison API. It
returns `globalgrid2050.policy-commitment-evaluation.v1`, including source dates,
reasons, original numeric claims, retained updates and the following states:

| State | Meaning in this adapter |
| --- | --- |
| UNKNOWN | Applicability, adoption, baseline, reconciliation or comparable evidence is missing/incompatible. Missing evidence alone never becomes failure. |
| NOT_YET_DUE | Applicable, non-draft commitment without progress evidence; reference date precedes even the earliest possible day of its stated deadline. A year/month is never expanded in output. |
| REPORTED_PROGRESS | An attributable update exists, but no supported comparable measured result is established. This includes qualitative process reports. |
| EVIDENCE_SUPPORTED_RESULT | An original-byte-backed official measurement or audit record supplies a compatible numerical observation. Output states only EQUAL, LESS_THAN or GREATER_THAN relative to the recorded target, not legal compliance or success. |

All results remain `machine-provisional`, with `legal_compliance=NOT_ASSESSED`.
Result `measurement_state` is UNKNOWN unless the comparison is supported.
Receipt/source-kind/applicability assertions are supplied by reviewed adapters;
the validator cannot independently prove truth, identity, audit quality or rights.
Its supported-result label must always be displayed with that limitation.

## Shared figures and comparison rules

Every numeric target, baseline or update goes through the unchanged
`automation/news/filings/contracts.py::validate_claim` from shared commit
`e0deabac45d35240f6c38f4303b8d50c90412e06`. No parallel values/units schema exists.
Numeric provenance must match the inventoried original document bytes, date,
retrieval clock and read locator. Targets and updates bind to their own statement
locators. Entity IDs/scopes must match the commitment's explicit scope.

Comparison requires identical metric, quantity kind, entity scope/ID/group,
units, currency, finance stage and reporting-period precision/bounds. If both
periods are absent, source `as_of` values must match. Source scales are applied
with exact decimal arithmetic; there is no currency conversion, unit conversion,
aggregation, percentage-reduction calculation or allocation to projects.
Announced, committed, disbursed and reported finance remain separate stages.
Forecasts cannot become measured actuals. A claimed audited status alone does
not upgrade a press release to a measurement document.

Baseline UNKNOWN prevents a measured comparison. The caller may declare an
absolute target NOT_REQUIRED for baseline, or retain a source-stated baseline.
Updates must refer to the current commitment and baseline revision. Superseded
versions stay visible but receive no current result; corrections, contradictions,
figure restatements and conflicting observations require explicit reconciliation.
No latest-value-wins rule silently deletes prior evidence.

The current real sources do not provide comparable supported numeric claims:
PUE/water/jobs metrics and national aggregate capacity scope exceed FIGURES v1.
Those remain named qualitative/context requirements with null numeric targets;
they are not relabelled as project demand or grid capacity. Unsupported metrics
need a separately reviewed extension from the FIGURES owner.

## JSON and CSV output

`dumps_report(evaluate(...))` returns deterministic JSON.
`csv_report(evaluate(...))` returns one commitment per CSV row, including JSON
cells for sources, numeric claims, conditions, revisions and evidence. CSV formula
prefixes are escaped. Neither API mutates input or writes files.

```sh
python -m automation.news.policy_commitments.ledger --as-of 2026-11-16T18:00:00Z --format json
python -m automation.news.policy_commitments.ledger --as-of 2026-11-16T18:00:00Z --format csv
python -m pytest automation/news/tests/test_policy_commitments.py automation/news/tests/test_filing_figures.py -q
```

CLI `--ledger FILE` selects a bounded local input; default is the seed. Output
goes to stdout only after complete validation. It has no scheduler, collector,
promotion path or browser widget. NEWS, PROSPECTING, DC and dashboard owners can
consume the same report; they must retain applicability, measurement state,
source dates and reasons beside any displayed result.
