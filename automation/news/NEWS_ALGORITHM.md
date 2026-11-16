# Headline relevance and source diversity

This additive successor module reads already collected headline metadata. It
does not fetch feeds/articles, activate a source, modify a release, write a
data branch, or approve reuse rights. The existing collector and V9.25 remain
unchanged by this increment.

## Latest owner policy

Prefer accessible governmental, regulatory, institutional and appropriately
identified listed-parent primary sources for factual follow-up. Retain useful
Bloomberg, Reuters, Financial Times and other original reporting with its
publisher credit and source link. Bloomberg is a discovery clue, not a default
front-page promotion. Never bypass a paywall, copy an article body, infer
exclusivity from the publisher's name, or assume every report has a corresponding
public filing. Finding a primary source does not erase the original reporter's
discovery credit. Corporate enrichment remains at eligible listed-parent group
level; this module does no SME/person enrichment.

Earlier removal-only work was superseded by the later owner instruction and is
not part of this active branch.

## API

```python
from automation.news.news_algorithm import rank_headlines

result = rank_headlines(
    collected_document["items"],
    as_of=collected_document["generated_at"],
    source_policies=[],
    originality=[],
    diversity_penalty=8,
)
```

Output schema: `globalgrid2050.news.editorial-priority.v1`. `items` preserves the
existing eight headline fields and publisher credit, adding `editorial` with
rank, topics, headline category cue, source classification, publication-date
precision/freshness, named scoring components, review receipt, contextual
bucket and the repetition penalty used at selection. No article body or extra
input fields are copied. Input data is not mutated. The explicit clock, profile
ID/hash and canonical URL tie-break make output reproducible under input
reordering. Duplicate canonical URLs must be reconciled before ranking.

Source-policy rows have `source_id`, exact canonical `hosts`, `kind`, a public
`review_url`, optional `publisher_group` and `access` (`open`, `paywalled`,
`unknown`). Kinds are government, regulator, institution, listed_parent,
reporting and discovery. Listed-parent classification additionally requires
`listed_parent_id` and `listing_evidence_url`. These are caller-provided review
assertions, not authentication performed by the ranker. Without a policy,
government-domain names receive a governmental-context classification; other
hosts remain reporting, with Bloomberg/FT marked discovery and a subscription
notice. A supplied source label alone cannot obtain official-source points.
Classification never grants rights or confirms a claim.

An originality receipt has `article_url`, `kind: original_reporting`,
`reviewed: true`, public `review_url` and a bounded explanatory `basis`. The
default bonus is zero. Even an accepted receipt does not create an exclusive
claim, project match or verification. Every item explicitly remains
`verification_status: NOT_VERIFIED` and `project_fact_status: NOT_ASSESSED`.

## Explainable order

Profile `uk-transition-global-context.v1` reuses the existing headline topic and
category functions rather than introducing another binder:

| Component | Points and interpretation |
|---|---|
| Topic | 20 for solar/storage/grid/data centres; 10 for wind/renewables; strongest topic only |
| Primary-source preference | government/regulator 18, institution 16, eligible listed parent 14, reporting 8, discovery 2 |
| Headline event cue | 8 when the existing category rule finds a cue; this is not an asserted event |
| UK headline context | 5 for explicit UK wording; no project country inferred |
| Publication freshness | `10 / (1 + age_days / 14)`; unknown or future dates get zero |
| Reviewed original reporting | 6 only with the attributed review receipt |
| Display diversity | subtract 8 per previously selected item in the same display group; configurable 0–30 |

Current in-scope topics precede generic AI market items, promotional/document
contexts and stale/future-dated rows. Those rows remain available later in the
list. Repetition uses a soft penalty, not an exclusion or fixed publisher quota.
The display group is not evidence of independent reporting; undisclosed
syndication and common ownership are not solved by domain names.

The weights are a documented editorial choice, not trained coefficients,
calibrated probabilities, financial advice or a measured forecast of sales.
No monetary amount, capacity or financing status is extracted from a title.
Missing dates are not replaced by collection time; date-only precision remains
a day, not an invented midnight event timestamp.

## Bounded live-output readback

The live V9.24 client reads the independent `pipeline-news-data` branch. At
`2026-11-16T17:08:45Z`, that branch resolved to
`d9d4b9249257ce36ae8f09921fa62a9845a3d492` and its
[pinned headline snapshot](https://raw.githubusercontent.com/Ventusltd/globalgrid2050/d9d4b9249257ce36ae8f09921fa62a9845a3d492/dist/pipeline_headlines.json)
returned HTTP 200, 38,642 bytes, SHA256
`06c487f14939d65cdb621158ca0a6defa8fe29733dadf8a026f08ca423dadad7`.
It was generated `2026-11-16T13:06:13Z`: 69 items and 50 successful feed statuses.
The pinned SHA URL was fetched again and matched the same body digest.

Using that generation timestamp as the fixed clock, the current profile
preserves all 69 items and all three pre-existing possible-match metadata
objects. The first twelve change from six Bloomberg links and zero government
links to one Bloomberg link and three government links. All seven Bloomberg
items remain in the full result. Six titles have no explicit headline topic
under the reused topic rules, so they remain context rather than leading project
news. This is one observed sample and a presentation comparison, not a held-out
accuracy study or proof the headlines' underlying claims are correct.

Reproduce locally after obtaining and checking the pinned JSON:

```python
import hashlib, json
from pathlib import Path
from automation.news.news_algorithm import rank_headlines

raw = Path("headlines.json").read_bytes()
assert hashlib.sha256(raw).hexdigest() == "06c487f14939d65cdb621158ca0a6defa8fe29733dadf8a026f08ca423dadad7"
doc = json.loads(raw)
ranked = rank_headlines(doc["items"], as_of=doc["generated_at"])
assert len(ranked["items"]) == 69
assert sum(i["source"] == "Bloomberg" for i in ranked["items"][:12]) == 1
```

## Primary-source follow-up of the seven discovery items

Only already public headline/link metadata was used as the cue; no Bloomberg
article body was requested. Searches were bounded, not exhaustive. Absence in
these searches is not proof that no filing exists.

| Discovery subject | Bounded outcome at 16 November 2026 |
|---|---|
| Pure DC stake / Singapore fund / Saudi telecom | No same-claim official announcement found in targeted GIC/STC source searches. Do not infer a bidder/parent relationship or completed transaction. |
| Asian data-centre loan syndication pause | Headline alone does not identify the borrower or instrument; no safe issuer lookup or equivalent primary claim established. |
| AI market trading week | Broad market context; no energy-infrastructure project claim to bind. |
| AI-company IPO personality story | Broad market/personality context; no project linkage or eligible parent identity established. |
| Data-centre restrictions / investors | Jurisdiction and specific measure absent from the cue; government search did not establish the same claim. |
| Indian stock-market rebound | Broad market context; no project event or infrastructure funding claim established. |
| QTS debt offering reduction | No same-event issuer/filing confirmation found in targeted QTS/Blackstone/SEC searches. A historical owner announcement was found, but it is not a replacement for the November financing claim. |

The historical [Blackstone acquisition announcement](https://www.blackstone.com/news/press/blackstone-funds-complete-acquisition-of-qts-realty-trust/)
is dated 31 August 2021. It describes acquisition by named Blackstone-affiliated
funds and QTS's departure from public trading. It must not be flattened into a
current corporate subsidiary relationship or evidence of the new financing
report. An HTTP 200 read at `2026-11-16T17:16:40Z` returned 321,649 bytes with
SHA256 `3f72e5a09ac7f080901b694bfb7f356770fd132456d559da3730c00c161a80fb`.
Only this receipt and source link are retained here, not the page body or its
financial figures. No discovery item has been relabelled as official evidence.

## Integration and tests

The client `scripts/plugins/live-news.js` sorts newest-first itself before
showing twelve items, including when it uses a saved snapshot. A server-side
rank alone therefore cannot change the live first page. The UI owner must
explicitly adopt this ordering contract in the shared live/fallback renderer;
this module does not change that client or activate its own ranking in V9.25.
Source health, rights/publication gates and failure preservation remain with
the collector/integrator. Article relevance is separate from the project
prospecting score and the immutable Solar-1000 selection.

Run `python -m pytest -q automation/news/tests/test_news_algorithm.py` and the
existing `test_pipeline_headlines.py`. Tests cover preservation of credit,
soft diversity, official/source-label boundaries, no brand-based originality,
explicit listed-parent receipts, generic AI negatives, precision/future/stale
dates, private/numeric URL rejection, deterministic ordering and no body reuse.
No network calls are made by the tests or ranking module.
