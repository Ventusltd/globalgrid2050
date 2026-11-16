# Ventus News Engine — read-only integration surface

**Confirmed code owner:** Ventusltd/globalgrid2050, existing Python package
`automation/news/`. This is an **additive offline adapter**, not a second
repository or scheduler. The separate Ventusltd/pipelinenews project contains
older JavaScript newsroom/immutable V8 releases, and the 20260906 GridAtlas
integration repository is a candidate, not a replacement for current
GlobalGrid2050/Pipeline News publication ownership.

## Recovered modules and boundaries

- `pipeline_headlines.py` / `datacentre_feed.py`: existing feed collection, RSS/Atom
  parsing, relevance, URL handling and deduplication; unchanged.
- `news_algorithm.py`: editorial/source-diversity ranking; unchanged and never
  exposed as numeric public priority by this adapter.
- `binder.py`, `names.py`: explanatory, broader candidate REPD bindings; unchanged.
- `acquisition.match.match_articles`: **reused** for strict full-name or
  explicitly qualified REPD Ref matches; still only PROVISIONAL.
- `acquisition.fetch`, `normalise`, `run`, `evidence_store`: existing rights-gated
  solar collector, transient body parsing, persistent research scans and export;
  **not called or modified** by this adapter.
- `evidence_ledger.py`: reviewed proposal structures and final independent
  acceptance requirement; no machine self-verification; unchanged.
- `events.py`, `relevance.py`, `prospecting.py`: REPD change/relevance
  and project research rules; unchanged.

## Python API

```python
from automation.news.engine import build_intelligence
result = build_intelligence(articles, sources, projects)
assert result["counts"]["verified_project_edges"] == 0
```

The function consumes a list of normalised article records or an existing
`pipeline-headlines.v1` document containing `items`. Each article needs title,
an HTTPS `url` or `link`, and an exact `source_id` or uniquely mappable current
`source` publisher. It preserves article URL(s), title, publisher, raw
publication date, first-seen/fetch timestamps, source SHA256 receipt if supplied,
source kind, rights status/review URL and vertical. **Unknown remains null**.
Publisher full-text bodies in input are never included in output or passed to
matching. Original URLs, including tracking variants, are retained under
`observed_article_urls` in sorted order; canonical identity removes known
tracking fields but retains all other query parameters. Conflicting metadata at
one canonical URL fails closed, never silently replaces history.

Sources are lists of `{id,publisher,kind,enabled,rights_status,
rights_review_url,output_policy}`. Only `headline_link_only` is allowed. A
source with `enabled=true` must carry `rights_status=accepted` and an HTTPS
review URL. These are caller-supplied **assertions**, not licence authentication.
Disabled sources with unknown/rejected rights can be analysed **offline only**,
and every generated record is still
`publication_eligibility=WITHHELD_INDEPENDENT_REVIEW_REQUIRED`.

`projects` is an optional array of `{id,name,technology,namespace}`. The
default namespace is `repd`; only numeric REPD IDs get candidate matches.
Data-centre, grid and other identifiers are not converted into REPD refs.
For valid cross-universe ambiguity detection, supply the relevant complete
official REPD identity population, not only a conveniently selected shortlist.
A subset cannot establish global name uniqueness. Capacity, distance, planning
stage, actual grid connectivity and unknown values are never inferred.

## Output / API contract

`globalgrid2050.ventus-news-intelligence.v1` has deterministic sorted
`articles` with stable SHA256 article IDs and `counts` for articles,
provisional edges, verified edges and articles with unresolved rights.
`project_candidates` always have
`{namespace:"repd",id,method,status:"PROVISIONAL",
evidence_scope:"TITLE_ONLY",independent_review:"REQUIRED"}`.
Multiple references in one title are explicitly marked ambiguous.
`verification_status` is always `NOT_VERIFIED` and
`publisher_independence` is always `UNASSESSED`. Identically worded
reporting at different URLs is not automatically independent corroboration.
**Verified project edges are always zero**, even for positive synthetic tests.

## Executable CLI demonstration

From repository root, with JSON inputs provided by the current data owner:

```sh
python -m automation.news.engine --articles /tmp/articles.json \
    --sources /tmp/sources.json --projects /tmp/projects.json \
    --output /tmp/intelligence.json
python -m pytest -q automation/news/tests/test_engine.py
```

`--projects` is optional. Without `--output`, the engine prints JSON to stdout.
When provided, `--output` uses exclusive new-file creation: a second run fails
rather than overwriting prior evidence. No network, scheduler, source
activation, SQLite state update, dated release, homepage pointer, GridAtlas
receiver, UI/CSS or existing source pipeline is touched.

### Example input

```json
{
  "articles": [{"url":"https://press.example.org/solar",
                "title":"East Meadow Solar Farm application",
                "source_id":"press","date":"2026-11-16"}],
  "sources": [{"id":"press","publisher":"Example Press",
               "rights_status":"unknown","enabled":false}],
  "projects": [{"id":"1018","name":"East Meadow Solar Farm",
                "technology":"solar"}]
}
```

Pass the three arrays as separate input JSON files. The synthetic output has
**one provisional candidate and zero verified associations**, with usage rights
unknown and publication withheld. It is not a real research or rights receipt.

## Integration hook for interface owner

Import or read only the stable output JSON. Use `title`, publisher,
original date and `canonical_article_url` in the **existing** newsroom/MACHINE
READ NOTES flow; never display internal rankings. Only surface provisional
project candidates behind appropriate research/rights handling. Public-facing
source display must still pass the existing independent
`evidence_ledger`/publication acceptance controls; an engine record does not
grant a source display licence. Preserve REPD identity and the established
GridAtlas MAP deep link. Do not add a separate panel or re-theme V9.24 styling.

## Explicitly unresolved

Real original-source bytes and licences have **not** been independently
revalidated by the engine. No live collector was run and no independent
project match was verified. Source rights acceptance, independent identity and
event review, full-corpus ambiguity checking and final UI/browser/CI release
validation remain with their assigned owners. No publication or merge is
authorised by this branch.
