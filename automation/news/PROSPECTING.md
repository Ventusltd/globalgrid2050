# Offline research triage contract — V9.26 proposal

`prospecting.py` is an unintegrated successor proposal. It reads pinned inputs,
scores known project facts and writes a separate research priority artifact.
It does not alter the frozen V9.25 release, Solar-1000, historical data, source
configuration, workflows, UI or operative pointers. No network, collectors,
logins, page fetches, contact enrichment or publication occur here.

Owner directions: [successor boundary](https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6922998352),
[trend contract](https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6923067676),
[source-policy override](https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6923111596).
The later policy excludes paywalled channels entirely.

## Inputs and authority

| Input | Contract and preserved boundary |
| --- | --- |
| Official projects | Reuse `acquisition/research_queue.py` to verify the pinned V9.24 manifest, every REPD partition, 7,775 unique official records, 3,604 solar records and exactly the original 1,000 seed IDs. All 7,775 rows enter triage; the ranked output is never the immutable Solar-1000 selection. Source workbook/manifest and per-row partition SHA256 values remain attributable. |
| Optional news evidence | Exact full-file SHA256 plus `evidence_store.validate_snapshot` for `globalgrid2050.solar-evidence.provisional.v1`. Exactly the seed population, accepted non-probe source receipts and strict provisional associations are required. Additional channel/article OPEN access receipts described below are mandatory. The adapter cannot grant rights or verification. |
| Optional global DC | Exact full-file SHA256 plus bounded projection of `globalgrid2050.global-datacentres.projects.v1`. Preserve source entity ID, country, pinned entity/field revision URLs, retrieval time, source-facts hash and CC0 structured-fact attribution. This version supports only the existing unknown capacities, SOURCE_INDEXED and not_assessed states. A populated capacity or new claim state fails closed pending adapter review. |

The DC owner uses a deterministic pinned-facts → typed Parquet → DuckDB readback
→ JSON contract. Triage consumes that existing JSON projection without another
compiler, database or collector. It validates fields it projects; it does not
validate or export unused coordinates/operators. Source-indexed DC records remain
PROVISIONAL, separate from OFFICIAL REPD records. Neither is a confirmed prospect.

Optional input absent means UNKNOWN coverage. An optional input supplied with a
bad hash/schema, failed receipt, unknown rights/access, future clock or unsupported
claim state fails the whole generation, even when its records would fall outside
the top N or selected type. Invalid data are never silently replaced with an empty
feed. Input files are bounded at 16 MiB; DC records at 1,000; evidence at 10,000
associations and 100 source receipts. Output is capped at 1,000 rows.

Existing source receipt objects must additionally contain:

```json
{
  "channel_access": {
    "state": "OPEN",
    "review_url": "https://publisher.example/attributable-access-review",
    "checked_at": "2026-11-16T18:00:00Z"
  },
  "article_access": {
    "https://publisher.example/story": {
      "state": "OPEN",
      "review_url": "https://publisher.example/attributable-story-access-review",
      "checked_at": "2026-11-16T18:00:00Z"
    }
  }
}
```

This is a receipt shape, not an approval or evidence that any real publisher is
open. Existing source IDs/rights receipts still pass the shared store validator.
All article URLs need their own receipt; an open feed does not establish an open
article. Missing, UNKNOWN or PAYWALLED access is rejected. Source owners must
review actual access and permitted display scope before supplying such receipts.
No automatic rights or access assessment is claimed. Legacy snapshots lacking
these fields are deliberately rejected by this adapter.

## Output schema

Schema: `globalgrid2050.prospecting.research-triage.v1`.

Top level includes the caller's explicit UTC `as_of`, profile and hash, source
policy, input receipts/count, filter/count/limit, coverage statement, disabled
interfaces and ranked `records`. No wall-clock generation timestamp substitutes
for an observation. Local input paths and unused source fields are not exported.

Each record has a stable source-qualified `id`, `record_type`, nullable name and
country, explicit technology, `record_state`, `official_status`, `research_state`,
typed `capacities`, source link/hash, freshness, evidence, score/reasons and rank.
REPD capacity means official installed MW; IT load, site demand and grid
connection MW are distinct DC fields and remain null. Country is never inferred
from a hostname or coordinates. The two blank official names remain null.

Every row also carries `corporate_eligibility`, `heat`, `event_at: null`, and a
clearly labelled deterministic `research_note`. OFFICIAL describes the source
record; PROVISIONAL describes indexed DC facts or machine-associated news;
UNKNOWN means the input does not establish the fact. No identity confidence or
verification is inferred from priority, article quantity or heat.

`corporate_eligibility.eligible` is false, with UNKNOWN listed-parent identity and
empty identity/membership evidence in this increment. Names resembling NASDAQ,
FTSE250 or another index cannot establish eligibility. Future corporate adapters
must prove group-level listed-parent identity and membership before enrichment;
unknown/ambiguous mappings stay unlinked. No SME targeting profiles, directors,
officers, residential addresses or personal enrichment are exported. Canonical
project records remain available regardless of this additional enrichment policy.
Government/regulator/institution sources are separate authority types and do not
require corporate-index membership. Government hosting does not grant a blanket
licence to reproduce third-party material.

## Priority, heat and clocks

Priority is a sum of named components reused from `relevance.py`: nonnegative
official capacity (0–30), official technology (0–15), explicit national planning
route (0 or 8) and official-record evidence tier (15). A single follow-up component
(0 or 5) indicates at least one provisional news association inside both freshness
windows. It does not increase with the number of articles. A DC source record gets
15 topic-priority points and no capacity/authority inference. Scores are research
ordering choices, not commercial value, available grid or verification measures.
Equal scores sort by source-qualified ID. An optional type filter supports focused
DC research without comparing unknown demand with REPD installed capacity.

Official status is displayed without becoming a stage-change event. Static-stage
priority is deliberately not scored in this bounded increment; consumers may
display the original status, and a separately reviewed profile can later assign
static-status weights. No novelty,
event-recency, proximity, capacity delta, funding or grid-connection components
are calculated. `heat.momentum_status` and `heat.state` are UNKNOWN; its score is
0, independent-signal count is null, and the reason explicitly says independence
is not established. Zero awarded points do not mean zero activity. This bounded
increment cannot produce positive momentum from the existing snapshot contract.
It does not count hostnames, syndicated duplicates or social reposts as independent
confirmations. A future heat adapter needs accepted, dated origin/independence and
event-deduplication receipts before any positive momentum score.

Freshness is separately labelled by its actual basis: official record update date
(90-day window), article publication time (30 days), source receipt or DC retrieval
time (14 days). STALE inputs retain their original clocks. UNKNOWN means no clock
is available. WITHIN_WINDOW is only age against the supplied `as_of`, not a claim
that all facts are current. A recently retrieved Wikidata record has unknown
official-record recency. The official baseline has no observation timestamp, so
its receipt freshness stays UNKNOWN. Future record/publication/observation clocks,
invalid capacities, naive timestamps and inconsistent chronological receipts fail.
Planned milestone dates are not consumed. Missing MW stays null, never zero.

Evidence displays only the existing exact headline (bounded to 300 characters),
URL, publisher, original clocks, match method and receipts. There are no article
bodies, summaries or quotations. Research notes are generated labels, never
fabricated source text. User source preferences are not publisher permission.

## Existing interface inventory

BBC News RSS entries already exist in `pipeline_feeds.json`; `pipeline_headlines.py`
supports the keyword lane and explicitly provisional `possible_match`. That raw
headline schema lacks this adapter's accepted rights/access receipt contract, so
it is disabled here. No headline keyword becomes an official event or binding.
PV Magazine acquisition remains disabled with rights UNKNOWN in the unchanged
`acquisition/sources.yaml`. Solar Power Portal and other existing RSS interfaces
are not enabled by this proposal. Public LinkedIn has no supported ingestion
adapter here; it appears in social-host exclusions in `signals/combine.py` and
`signals/index.py`. LinkedIn remains disabled/UNKNOWN, with no login bypass.
Preferred government/regulator, institutional funding, SEC and Companies House
sources require a separately reviewed owner interface; none is fabricated here.

## Review usage and checks

```sh
python -m automation.news.prospecting --as-of 2026-11-16T23:00:00Z --out review/prospecting.json --limit 200
python -m pytest automation/news/tests/test_prospecting.py -q
```

Optional CLI pairs are `--evidence FILE --evidence-sha256 SHA256` and
`--datacentres FILE --datacentres-sha256 SHA256`; `--record-type data_centre`
selects the DC research lane. The pure `build` function accepts the same pinned
input pairs. The CLI validates everything before an atomic output replacement,
refuses output inside historical Pipeline release trees or on an input file,
and retains the previous artifact on failure. Release/UI integration and any
publication require the owner's separate successor acceptance.

Tests cover the real immutable population, deterministic ordering/bytes,
negative/nonfinite/unknown capacity, future/stale clocks, missing/failed rights
and access receipts, paywalls, unreceipted articles, raw headline rejection,
unknown listed-parent eligibility, omitted personal fields, no manufactured
momentum from reposts, source hashes, DC state boundaries, failure retention,
historical write refusal and network-free execution.
