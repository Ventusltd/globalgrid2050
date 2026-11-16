# V9.26 source-aware headline display

The existing collector and `globalgrid2050.news.pipeline-headlines.v1` file stay
unchanged. Older releases continue to use their original date-based display.
V9.26 reads a separate `dist/pipeline_headlines.rank.json` document with schema
`globalgrid2050.news.headline-priority.v1`. This is editorial ordering, not a
project priority, independent confirmation, source-rights review or VERIFIED claim.

`build_news_priority.py` validates the existing headline schema and its explicit
clock, calls `news_algorithm.rank_headlines`, and retains each original title,
publisher and link. Its sidecar contains the exact input SHA256 and byte count,
generation timestamp, profile identity and one ordered entry per original item.
It stores no article bodies. The existing headline workflow creates both files
after collection and commits them together to the existing data branch. Invalid
input aborts before output replacement or data-branch publication. A normal push
still rejects a competing branch update; there is no force push or new schedule.

```text
python -m automation.news.build_news_priority --input dist/pipeline_headlines.json --output dist/pipeline_headlines.rank.json
python -m pytest -q automation/news/tests/test_news_priority_export.py automation/news/tests/test_news_algorithm.py automation/news/tests/test_pipeline_headlines.py
node --test uk_renewables_pipeline/202611161734/tests/live_news_regression_v9_22.mjs
```

The consumer hashes the fetched bytes using Web Crypto and checks the exact
profile, timestamp, count, one-to-one article identities, unique ranks and typed
display fields before applying the order. It renders the original headline
document rather than substituting sidecar text. Hash agreement links two files;
it is not an authenticity signature or factual verification of either source.

Current live collections show compact source/topic/UK-context explanations beside
each headline. Energy-policy items remain visible. All publishers retain credit;
display variety is a soft ranking factor, not proof of source independence or an
exclusivity claim. Subscription notices do not bypass paywalls. Unknown publisher
dates remain unknown; collection time does not become event time.

Missing, malformed or mismatched priority data keeps the date-ordered headlines
with an explicit unavailable-priority label. A failed collection, saved snapshot,
future collection clock beyond five minutes, or collection older than 36 hours
never applies the priority. Partial source health remains separately visible.
Without Web Crypto, date fallback remains available. Ranking failure never causes
a good live headline document to be replaced with the saved snapshot.

Browser tests use the actual Python sidecar producer and real application in
Chrome/Chromium at375,768 and1440px. Run from `automation/news/acquisition/browser`:

```text
npm ci --ignore-scripts
npx playwright test --config news-priority.config.mjs
```

Set `BROWSER_CHANNEL=chrome` for installed Chrome and a distinct
`EVIDENCE_TEST_PORT` when testing parallel worktrees. The new news workflow PR job
runs this suite with Chromium. It covers tampered digest/profile/rank/identity,
policy visibility, escaped text, stale/failed/snapshot/partial states, original
Solar-1000, 7,775-row CSV and the Global DC tab. Test network routes are explicit
fixtures, not proof of live source availability or native Android execution.

One real-data replay used existing data branch commit
`d9d4b9249257ce36ae8f09921fa62a9845a3d492`, document generated
`2026-11-16T13:06:13Z`, SHA256
`06c487f14939d65cdb621158ca0a6defa8fe29733dadf8a026f08ca423dadad7`.
All69 original article identities and credits were preserved; Bloomberg's top12
appearances changed6→1, while government sources changed0→3. This is a single
observed corpus, not a ranking-accuracy benchmark or an independent-source count.

Deployment dependency: the new workflow must be merged and successfully refresh
the data branch before public V9.26 can display ranked live data. Until then its
honest date fallback remains visible. Root owns final release/registry/browser
probes and public readback; this component does not promote a release.
