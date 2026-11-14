# automation/news: a relevance model for Pipeline News that is deterministic, explainable and testable

Status: new and additive. No existing file, feed or release is read for writing. The legacy builders
(`scripts/major_project_news_v*.py`, `build_news_feed_v9_5_1.py`) and `dist/major_project_news_*.json` are left as they are.

## What it does

1. `events.py` compares two REPD releases. It uses the loaders and conventions of `automation/repd/diff.py`
   and produces typed project events. The types are: consented, under construction, operational, refused,
   withdrawn, appeal lodged, status reversal, decommissioned, lapsed or revised, new large application,
   new application, new record, removed, capacity change, operator change and technology change.
   - Each event carries the Ref ID, MW (null when unknown), technology, county, region, country,
     planning authority, the REPD milestone dates and the date that dates the event.
   - Each event also carries a development group key. Co-located siblings share it: same site and
     county, or a storage co-location link.
   - Each event has a one-line headline made only from REPD fields.
   - Operator differences that are only cosmetic are counted but not emitted. Examples are `/` becoming
     `&`, a change of case, or a legal suffix. The October release changed 530 operator cells; 495 of
     these are cosmetic, 35 are real changes.
2. `relevance.py` gives each event or article an additive score. Every component appears in the output
   with its points, its maximum and its basis, so anyone can recompute a score by hand. The weights sit in
   one versioned profile (`solar-storage-grid.v1`), and the profile's sha256 is written into the feed.

   | Component | Points (maximum in brackets) |
   |---|---|
   | capacity | 10·log10(1+MW) (30); unknown MW scores 0 |
   | stage | by event type (20) |
   | technology | solar and battery 15; other storage 12; wind 8; hydrogen 6; other 3 |
   | recency | age against the release's newest Record Last Updated, not the clock (10) |
   | national consenting route | Planning Inspectorate NSIP, Welsh NSIP or Scottish S36 (8) |
   | data-centre proximity | nearest site within 5/10/25/50 km, using the Team 6 join `dist/convergence/2026q3` (10). Points only when the data-centre point is proximity-reliable. This is screening, never a connection. |
   | novelty against the previous feed | 6 / 3 / 0. Co-located siblings are checked together. |
   | evidence tier | official record 15, attributed reporting 8, unverified lead 0 |
   | co-located storage | 3 |
   | articles only: binding class | up to 10 |
   | articles only: official corroboration | 6 / 3 / 0 (the bound project's REPD record agrees with the story). A contradiction is flagged, not scored. |
3. `binder.py` binds an article to a REPD Ref ID using one shared name normalisation (`names.py`).
   - Classes are EXACT, STRONG, PROBABLE, CANDIDATE and UNBOUND. Only EXACT and STRONG drive a
     project signal.
   - Every decision writes a `trace` (the audit log): name hits, each narrowing step, and the class.
   - Data centres are a separate category. Data-centre wording tags the article `DATA_CENTRES`. A named
     register site binds by its `dcuk-…` id and never gets a REPD Ref ID.
4. `build_feed.py` writes new files only:
   - `dist/news/repd_events_<release>.json`, which follows `schema/repd-events-feed.v1.schema.json`;
   - the top-50 CSV, and `docs/news/<release>/top50.md` as a table;
   - the 133 v9.5.1 articles re-bound and re-scored;
   - the binder evaluation.

   The build is deterministic: rebuilding gives the same bytes, with no clock and no absolute paths.

## Fit with the data-centre capex and politics panel (N4)

Each event also carries the flat panel fields `title`, `date` (with `date_kind`), `link`, `ref`, `lane` and `score`:
- `lane` is `REPD_EVENTS`;
- `link` is null, because REPD has no article URL; `ref` / `gg_project_id` identify the project instead.

The data-centre panel can therefore list both lanes with one renderer: its lane carries dcuk ids, this lane carries
REPD Ref IDs, and neither invents the other's identifier. `datacentre_context` on an event names the nearest
data-centre id, which is how a panel row can cross-link. Scope is frozen at events, score and binder, as the
owner asked: keep it simple.

## Results on real data (July 2026 to October 2026)

**Events.** 769 events in total.
- They reconcile exactly with `docs/repd/2026q3/changes-jul-to-oct/diff.json`:
  - consented 338 / 13,789.6 MW;
  - under construction 26 / 1,943.86 MW;
  - operational 32 / 1,049.72 MW;
  - refused 44 / 1,682.55 MW;
  - withdrawn 17 / 830.22 MW;
  - 319 new and 9 removed;
  - 32 capacity changes, made up of 17 edits, 14 now stated and 1 now blank.
- There are two status reversals. Ref 13429 (3,600 MW offshore wind) went from Awaiting Construction
  back to Application Submitted. Ref 9388 went from Operational to Awaiting Construction.
- The top 50, after folding siblings: 29 consented, 10 new large applications, 7 into construction,
  2 operational and 2 refused.

**Binder.** The labelled set is the 133 v9.5.1 items: 47 positives, 74 negatives, 7 unsure and 5 implicit.
- For EXACT and STRONG bindings, precision is 1.00 (46/46) and recall is 0.98 (46/47).
- The v9.5.1 PRIMARY_MATCH rule on the same labels scores precision 0.90 and recall 0.81. Its false
  positives include Coalburn II bound to Coalburn 1, and Kells (Co. Meath, Republic of Ireland) bound to
  a Northern Ireland record.
- The one miss is "71 MW Carlton solar farm". There are two REPD Carlton solar records, and 71 MW is not
  within 15% of 49.99 MW, so the article stays CANDIDATE.

**Caveat.** The labels are silver: one reader, headline text only. The rules were developed on this set,
so these numbers are not a held-out measurement. The next crawl, labelled before it is scored, is the
first real test.

## What is rule-based today, and where a language model could be added later

Everything above is rules and arithmetic. A model can be added later without changing any interface,
because the outputs are plain dicts with a `class`, a `ref` and a `trace`, and a relevance component list.

- **Binding adjudicator, for CANDIDATE rows only.** A model receives the article text and the listed
  candidate REPD records. It may pick one candidate or none, and it must quote the text span it relied on.
  - Its answer is recorded as a new class `MODEL_RESOLVED`, with the model id and the prompt hash.
  - It enters the signal only if it clears the precision floor on the labelled set, which the tests
    enforce at 0.95.
  - It can never promote a binding that rules vetoed for a foreign place or a contradictory technology.
- **Article event classifier.** It would replace the keyword list in `relevance.ARTICLE_EVENTS` and
  return the same labels. It is scored against labels before it is used.
- **Headline wording.** A model may rephrase the data-only headline. It may not add any fact that is
  not in the event's fields, and a check compares the numbers and names it uses with the event.
- **Relevance weights.** The weights could be fitted to editor choices. The output stays the same
  additive component list; only the profile file changes, with a new id and sha256.

Each model call would be cached by input hash, so a rebuild stays byte-identical. Official REPD facts are
never overwritten by model output.

## Limits and next steps

- REPD records when the register was updated. That can lag the real decision, so recency measures
  register freshness.
- Data-centre events need a second release of the register. The same diff machinery would then key
  them by `dcuk-…` id, as a separate category.
- Stated capacity in the press is often DC MWp, while REPD gives export MW. The 15% tolerance is
  conservative on purpose.
- The July cleaned CSV is not on main. It is on branch `repd/2026-07-verified-archive-20261113`
  (sha256 52e2c81c…). Set `NEWS_PREVIOUS_REPD` to run the exact-reconciliation and byte-rebuild tests.

## Run

    python -m automation.news.build_feed --previous REPD_Q2_2026_cleaned.csv --previous-label "July 2026 (Q2)" \
      --new repd-2026q3.csv --new-label "October 2026 (Q3)" --release 2026q3 \
      --previous-feed dist/major_project_news_v9_5_1.json --convergence dist/convergence/2026q3 \
      --datacentres uk_datacentre_pipeline_202610312133.geojson \
      --labels automation/news/labels/binding_labels_v9_5_1.json --out-dir dist/news --docs-dir docs/news/2026q3
    python -m pytest automation/news/tests
