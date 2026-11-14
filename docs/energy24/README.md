# Energy24 — source-led 24-hour intelligence candidate

**Status: draft only.** This page is a new independent application, `uk_renewables_pipeline/energy24/`. Its news feed is intentionally empty until a verified crawl is accepted. No frozen Pipeline News release, Q2 source, previous REPD outputs or homepage pointer is edited.

## What is prominent

The lead position favours (1) explicit UK REPD Ref-ID-linked news about a project of at least 50 MW, (2) evidence-attributed UK data-centre investment and power demand, then (3) verified international major energy and AI capital projects. Cybersecurity and ethics form clearly labelled watch categories and do not masquerade as a capital project. Every published news item must carry a source name, dated link, classification and evidence tier. No fabricated stories and no article bodies are copied.

The app separately renders a selected major-project table from the **current pinned REPD release**. The actual UK project identity remains `repd_ref`, not a site-name guess or a proximity match. `NO MAP` is displayed where coordinates are unavailable. This table is **not news** and does not imply a new announcement.

## Thresholds

- UK REPD signal: an explicit numeric REPD Ref ID in the publisher title or description **and** a matched row of at least **50 MW** in the validated register. Identifying a site by name alone never creates a PRIMARY_MATCH.
- Other energy/data-centre/AI investment: at least **50 MW** disclosed in the linked source feed or a reported **US$25 million** capital commitment. A published 50 MW figure is not automatically converted to a $25m expenditure. An explicitly reported CAPEX value in GBP, EUR or another currency is **not** estimated into USD automatically.
- A cyber or ethics incident without measurable MW/CAPEX may be included as **strategic context**, not as a 50 MW+ project, only if a recognised publisher's headline clearly addresses an energy or AI infrastructure issue. Its source remains an attributed report, not a determination of fault.
- Project numbers are never inferred from grid proximity, an AI ranking, a news score or an unauthenticated business relationship.
- Editorial material marked sponsored, unconfirmed or containing inappropriate language is not automatically published.

## Six shifts

The crawler has an hourly `17 * * * *` UTC schedule, continuously covering local activity in London (`Europe/London`), New York (`America/New_York`), San Francisco (`America/Los_Angeles`), Hong Kong (`Asia/Hong_Kong`), Tokyo (`Asia/Tokyo`) and Sydney (`Australia/Sydney`). IANA time zones manage daylight-saving transitions. A scan is not equivalent to six staffed analysts or live model agents. The public page displays each market clock and the last **successful actual scan**, and visibly marks a stale/unavailable feed. GitHub scheduled workflows can be delayed or missed; the system never claims zero delay.

Source allowlist for the initial crawl (live URLs confirmed, more can be separately reviewed):
- DESNZ official activity Atom feed
- Data Center Dynamics RSS
- Energy-Storage.news RSS
- pv magazine RSS

The initial source set is intentionally modest. Once a new source is reviewed for terms, provenance and reliability it can be added through a reviewed code change. All publisher outputs are treated as untrusted. The crawler stores only the short headline, article URL, publisher, date and explicit numeric signal; no republished full articles, thumbnails or copied summaries. It records source errors and reasons for exclusion in `news.audit.json`.

## REPD quarter lifecycle

`automation/energy24/scan.py` discovers the newest **locally validated** `automation/repd/releases/<quarter>.json` whose versioned `repd-<quarter>.csv` is present. It does **not** treat the live government URL or legacy root `repd.csv` as an approved quarter. The dashboard independently reads its explicit `data/release.json` pointer. A new quarter requires the REPD validation gates, a fresh project partition release and an approved pointer change; the hourly job must not silently switch identities. The initial source pin is October 2026 Q3: 14,968 official rows, 14,967 distinct Ref IDs, duplicate 7679, 53 columns.

## Publication and rollback

The proposed `.github/workflows/energy24-news-watch.yml` runs deterministic tests and an actual HTTP source scan. On the feature branch it is read-only and saves a 90-day Actions artifact. **Only after this feature is tested and merged to `main`** can the scheduled publisher update `energy24/data/news.latest.json` and `news.audit.json`. It has a single concurrency group, refuses if main has changed, and stages only those two designated files. The old feed is retained if all publishers fail, if no qualifying headlines exist, if fewer than two independent publishers produce qualifying stories, if the release identity mismatches or if any test fails. A funding round or annual company target alone is not project CAPEX or a 50 MW project; such stories are held unless the publisher headline explicitly supports project construction expenditure or a distinct project capacity. Git history provides the restoration record. Rollback is `git revert` of the most recent news-feed commit, or revert of the feature merge; historic Pipeline News assets are not changed.

No automated feed may claim the publisher's account is a fact verified independently by GlobalGrid2050. Data-centre facility identities are **not** REPD Ref IDs. `Ventusltd/data-centres-gb` uses OSM-derived identifiers, with ODbL provenance and uncertain company ownership; future integration must use the separately pinned generation and source licence. No inferred ownership or DC-to-REPD binding is permitted.

## Independent QA and ownership

Use neural-link issue #19 for the second workstream and issue #12 for release coordination. Requested roles: editorial source/ranking review, REPD identity/provenance review, Data Centres GB and GridAtlas integration, cross-browser and MAP/CSV QA, cybersecurity/ethics source assurance, and an independent second ChatGPT agent on invitation. Issue comments do not awaken other agents. Nobody should be described as active, assigned or signed off until they acknowledge their scope.

Acceptance requires unit tests, evidence-source fetch validation, latest quarter pointer integrity, HTML/JS syntax, desktop/mobile browser screenshots, filter behaviour, exact REPD REF and NO MAP, empty/stale source behaviour, served-byte hashes and rollback proof before any public promotion.
