# Agent 3 — Independent News Engine acceptance and V9.28 integration contract

Date: 2026-11-16 (UTC). Independent verifier: fresh Agent 3 review session.
**Scope:** ONLY `Ventusltd/globalgrid2050/automation/news` acceptance, synthetic offline tests, and minimal demonstrated corrections. **No merge, publication, collection, scheduling change or source enablement.**

## Pinned provenance and source inspection

- Original implementation: https://github.com/Ventusltd/globalgrid2050/pull/130 ; EXACT original head `dd571c6bfb57b2a05fd2a8ab2b0d9000630c4485`, draft, unmerged.
- Original changes exactly `automation/news/{ENGINE.md,engine.py,tests/test_engine.py}` (3 new files, 498 additions at inspection). Baseline main `65bcc01e0d7e4dc073e759345727e53cf7a95752`. No edits to existing data flow.
- Original engine blob `679bb1c759749cd218ecb3059f43215c0a3d770c`; existing matcher blob `d1142e947ce2fc5013cf59dd02c3ce97d82768fe`. These exact unchanged blobs were printed by the independent baseline runner.
- Isolated verification branch: `qa/agent3-news-engine-acceptance-20261116`, created FROM original PR #130 head. Do not amend original branch.
- Existing dependency hierarchy: `engine.py` -> `acquisition.match.match_articles` -> Python `collections.Counter`, `re`, `unicodedata`. Engine otherwise uses standard-library argparse, hashlib, json, pathlib, re, urllib.parse, datetime (corrective branch); pytest required for tests, not runtime. No requests/HTTP client is called.
- Existing unaffected owners: `pipeline_headlines.py` and `datacentre_feed.py` collect/parse/merge the live headline file; `news_algorithm.py` and `build_news_priority.py` rank; `binder.py` builds explanatory candidate links; `acquisition/{fetch,normalise,run,evidence_store}` supports a rights-gated research pipeline; `evidence_ledger.assess` applies non-self-authorising evidence checks. No new collector, scheduler, alternate repository or public panel.

## Independently executed original 24 and first adversarial receipt

Github Actions ORIGINAL EXECUTION: https://github.com/Ventusltd/globalgrid2050/actions/runs/43965605589

At workflow source commit `cfa0574a75ab667ee5f7b95462f84957e301fc4d`, original `engine.py` and `match.py` matched PR #130's Git blobs exactly. `python -m pytest -q automation/news/tests/test_engine.py`: **24 passed in 0.17s** in hosted Python 3.11. `python -m pytest -q automation/news/tests/test_engine_independent.py`: **20 passed, 6 failed**; these failed in TWO defect classes, not six independent architectural defects:

1. Two scenarios proved contradictory `article.source` could be silently accepted when `source_id` identified a different trusted publisher; with or without explicit `publisher`, engine overwrote the effective credit with the catalogue's publisher. This is an attribution-integrity failure.
2. Four scenarios accepted `not-a-date`, `2026-02-30`, `2026-13-17`, and `2026-11-16T35:00:00Z` as unqualified `published_at` values. Display or freshness consumers must not mistake invalid strings for valid timestamps.

Safety tests that passed: title-only candidate association, unrelated general market news, unsafe URL rejection, canonicalised duplicate variants retaining original URLs, ambiguous REPD identity, explicit multi-Ref ambiguity, no matching body-only content, no VERIFIED output, unknown rights and acceptance withholding, and no score/rank fields in engine output.

An earlier workflow run https://github.com/Ventusltd/globalgrid2050/actions/runs/43965386727 stopped BEFORE pytest due to unavailable ancestor in shallow checkout. It is a runner defect, not source-code evidence; that command was removed.

## Minimal corrective diff — isolated, not PR #130

Change only `automation/news/engine.py`:

1. Reject `article.source` when it contradicts the selected source catalogue `publisher`, regardless of whether `source_id` is present.
2. Validate non-null `pub_date`/`date`, `first_seen` and `fetched_at` as calendar-valid ISO 8601 dates or timestamps; preserve the exact original valid string in output; unknown stays null. This rejects malformed clocks without substituting fetch time for publisher time.

Original matching algorithm, source rights gate, publication status and all existing collectors remain unchanged. The strict ISO contract applies to **normalised** inputs; raw RFC email-date strings from a feed must be normalised by the existing upstream parser, not sent directly to the adapter.

## Reproducible command sequence (repo root)

```bash
python -m pip install pytest
python -m pytest -q automation/news/tests/test_engine.py
python -m pytest -q automation/news/tests/test_engine_independent.py
python -m pytest -q automation/news/tests/test_news_algorithm.py automation/news/tests/test_pipeline_headlines.py automation/news/tests/test_binder.py automation/news/tests/test_relevance.py
python -m automation.news.tests.news_engine_acceptance_demo
python -m compileall -q automation/news/engine.py automation/news/acquisition/match.py
```

All demonstration fixtures are explicitly **SYNTHETIC** and use `fixture.example.org` and `fixture_press`. Demonstration calls the real command line interface via subprocess in a local temporary directory; it proves two distinct output articles, one PROVISIONAL project candidate, zero VERIFIED, one preserved canonical article with two original URL variants, one market-news item with no project binding, unresolved rights and withheld publication. No real source, crawl, scraped body, legitimate licence or event is implied.

## Integration surface — V9.28 root owner only

1. **Producer boundary:** Load the existing *validated* `globalgrid2050.news.pipeline-headlines.v1` `items` and source catalogue into `build_intelligence(articles, sources, complete_official_repd_identities)` offline. Supply a catalogue of exact publisher names and `source_id` for each row. The current `pipeline_headlines.v1` document has publisher labels but is NOT itself a trusted rights catalogue. Reject missing or inconsistent maps; never invent an approved source record to make conversion work.
2. **Identity boundary:** Source the REPD project identity population from the current authoritative register, including duplicate names across technology. A sliced prospecting cohort cannot establish global name uniqueness. Use `namespace: repd` with numeric IDs; never turn `dcuk-...`, grid substations, geographic proximity or partial names into a REPD match. Require one independent per-project receipt for every validated association; multi-project title candidates must remain ambiguous and should not auto-enter a public single-project note.
3. **HEADLINES:** Keep the existing live `dist/pipeline_headlines.json` and its `pipeline-news-data` owner and V9.24/V9.26 rendering/fallback rules **unchanged**. Engine output records are withheld by design; they are NOT approved public content. Only after separate rights/independent review may a root owner project an allowlisted `{title, link: original_article_url, source: publisher, date: published_at, first_seen}` into the existing source-tested reader, never a parallel feed or unreviewed replacement. Preserve existing source-health and ranking sidecar validation.
4. **MACHINE READ NOTES:** Existing `machine-notes.js` consumes original `pipeline-feed-loaded` document items with `{title,link,source,date,first_seen,category,possible_match:{repd_ref,site_name,basis}}`. For a reviewed single candidate only: map `repd_ref` from the candidate's numeric ID, get `site_name` from the SAME official REPD row, and `basis` from `method`. Preserve an existing evidence-backed `category`; never infer consent, construction or financing from a title. Until approved, **do not inject new rows into the public event**, regardless of candidate count. Keep existing `POSSIBLE — NOT INDEPENDENTLY VERIFIED` language, title and original publisher link; preserve the existing MAP sibling/deeplink and 7,775-row register.
5. **Data separation:** General market news has zero `project_candidates` and belongs in ordinary headline/context display only, not any project's Machine Read Notes. An exact-name or explicit REPD-ID match remains a **research lead**, never independent project evidence. Multiple publisher URLs are not evidence of editorial independence. Only original-source receipts, project identity evidence, independent reviewer decision and separate legal rights acceptance can elevate a downstream ledger proposal; `evidence_ledger.assess` explicitly never self-authorises publication.
6. **Public data minimisation:** UI may render only the approved fields; never serialise internal `score`, `rank`, `ranking_score`, `priority`, `importance_score`, raw publisher bodies, debugging fields, source receipt bytes or unapproved matches into the interface. The adapter never exports input scores. The existing separate ranking-sidecar architecture may contain numeric scores in its **raw JSON**; rendering and network-payload privacy of the full root UI need independent root/browser inspection and cannot be certified by this Python contract alone.
7. **Rights and clocks:** Every adapter output has `publication_eligibility=WITHHELD_INDEPENDENT_REVIEW_REQUIRED`, `verification_status=NOT_VERIFIED`, and `publisher_independence=UNASSESSED`, irrespective of caller-declared accepted usage rights. Do not mistake a caller-supplied `rights_status=accepted` or source receipt SHA256 for independent authentication. The date is a claimed publisher date, not event date; a missing publisher date remains null.

## Acceptance decision

**Original PR #130: FAIL for unconditional V9.28 acceptance** because the independent tests proved source-attribution and malformed-date defects. Its 24 original checks still pass. The **isolated corrective candidate** should be considered **CONDITIONAL** until exact-head CI (original 24 + independent negatives + unaffected ranked-headline/binder/relevance suites + offline replay) passes and the integration owner independently reviews source rights, full REPD identity corpus, JS/HTML/browser/served data and public output. Do not merge, enable sources or publish on this evidence alone.
