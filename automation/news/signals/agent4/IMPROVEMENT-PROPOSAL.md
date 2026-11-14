# Agent 4 — Pipeline News evidence-first relevance design (research draft)

**14 November 2026 · independent QA-only, NOT a publication authorisation.**

Controller mailbox: [NL-024](https://github.com/Ventusltd/neural-link-between-agents/issues/24) · editorial mailbox: [NL-019](https://github.com/Ventusltd/neural-link-between-agents/issues/19) · producer reviews: [NL-022](https://github.com/Ventusltd/neural-link-between-agents/issues/22).

## Reproducible code baseline

This draft is branched from the exact **globalgrid2050 PR #100** commit
`20c9f21339e13ba48da3ac8810dd194b0545b8d1`, and targets **acid/team1**, not main.
It **does not edit PR #100's source branch**; changes are additional QA fixture, audit and design paths only.
GitHub blob SHA at baseline:
`combine.py=5cf5be04178df443df42269fa5e9a568426126b3`;
`gate.py=15398c7fc3c302f088bb531d49d50efc8867f94d`;
`dates.py=1cdc313d880d7b508612171ddb7d049ef0f8abc9`;
`aliases.json=07b990d32187e31db151eb3bcae5457070333978`;
`exclusions.json=62fe2275fd8c568baf29cbac681f265f9c3157f9`;
`top200_solar.json=d32c17ea7cd65f413032b68af8ea8490b8fe878b`.
Existing integrated run [43609440519](https://github.com/Ventusltd/globalgrid2050/actions/runs/43609440519) was reported **20 failed, 4 xfail, 8 xpass**. Its status must not be converted to pass merely by making the tests expected failures.

Read-only audit generator:
`python automation/news/signals/agent4/audit_sources.py --out /tmp/a4-source-audit.json`;
deterministic tests:
`python -m pytest -q automation/news/signals/tests/test_agent4_editorial_regressions.py`.
An intentionally red test on this baseline is an actionable evidence receipt, **not** acceptance. No live publisher fetch occurs in these scripts.

## Three P0 hypotheses with exact reproduction contracts

1. **False positive, common locality** — `gate.judge('9050','Foston Hall solar farm approved in Lincolnshire')` can return `ok` simply because Foston is an alias core, the title contains solar and Lincolnshire is the project's county. This invented headline is a *synthetic collision*, not a real verified claim. Desired verdict: `drop` or `possible`; never confirmed without direct identity proof. Cross-check the equally synthetic `North Ray of Light solar farm approved in Lincolnshire` against REPD 19975. The source code: `gate.py` lines 175–235, `exclusions.json` rule for 9050.
2. **False negative, genuine site wording** — `gate.judge('9050','Solar farm at Foston wins approval')` is dropped when Foston is not adjacent to the solar term and there is no extra county/developer fact. The full alias `Bypass Solar Farm approved near Grantham` is downgraded because Grantham is not represented as an allowed place in `gate.project_of`. Desired: keep genuine local leads for *identity verification*, permit strong source-validated exact alias and Grantham identity to pass the title gate. The gate by itself is **never** licence or event confirmation.
3. **Cross-project reviewed evidence + future freshness** — `combine.py` lines 590–605 exempt reviewed items from the shared gate; lines 658–671 keep a shared link on each project whenever `is_reviewed` is true, without requiring documented individual association. An artificial article about Bypass assigned to 9050 and Frodsham 14096 is therefore retained on both. Independently, `dates.py` lines 32–45 allow the next day's date; `combine.clean_item` line 309 calls that day-only parser. A 15 Nov 08:00 UTC article can look recent at 14 Nov 12:00 UTC. Distinguish parsing a source calendar day from validating an **instant**. Preserve the original value, normalise aware instants to UTC, reject instant > now+5m; undated/source-unknown cannot be published as recent verified.

## Ten prioritised algorithm changes

| Priority | Intervention | Testable release effect |
| --- | --- | --- |
| P0-1 | **Typed canonical identity:** REPD Ref ID for energy, a separate validated `dcuk-` namespace for UK data centres, and explicit international DC keys. Exact planning reference outranks names; never infer identities from proximity. | No other-project attachment, 200 distinct immutable REPD refs |
| P0-2 | **Evidence-backed multi-factor matcher:** aliases with provenance, project planning reference, county/authority, operator, MW and technology; source-specific identity confidence, collision/abstain states. A common place plus solar alone is insufficient to confirm. | Foston, North Ray, Tealing, Botley traps rejected without losing true positives |
| P0-3 | **Per-link source receipts:** original publisher URL, canonical URL, successful exact-URL retrieval/HTTP status, content SHA256, source host, rights/licence, 1st seen, last fetched, publisher and event dates; forbid cache replay as newly observed. | Current part health cannot authenticate unrelated cached items |
| P0-4 | **Trustworthy evidence tiers:** independently verified official event / licensed publisher report / reviewed historical material / unverified candidate / register search. Keep planning search distinct from case file. Upstream `confidence:confirmed` alone is irrelevant. | No unverified record becomes a public “confirmed” event |
| P0-5 | **Strict time model:** UTC aware published/event/first-observed/retrieved/verified timestamps, max five-minute future skew, explicit stale reader state; old items remain in the archive, not the breaking lane. | Same-day future, next-day and 2019 replay cannot masquerade as live |
| P1-6 | **Event-level deduplication:** event ID = typed entity + event class + authority case/decision ID, with secondary corroboration by event time; syndicated URLs are sources, not separate events. A multi-project article has one event and independently evidenced associations. | No double-counted news or unexplained cross-reference |
| P1-7 | **Project-build editorial priority:** approval, refusal, FID, grid connection, construction, EPC, commissioning, acquisition, major delay receive event-based priority; exclude generic commentary, corporate fundraising and advertising from project-CAPEX claims. | Key development news rises above sector finance headlines |
| P1-8 | **24-hour global intake:** six IANA cycles `America/Los_Angeles`, `America/New_York`, `Europe/London`, `Asia/Hong_Kong`, `Asia/Tokyo`, `Australia/Sydney`; independent ingest schedule per market with publisher limits and UTC receipts. | Coverage without false clock-derived freshness or expensive redundant scans |
| P1-9 | **Data-centre lane separated:** verified source register with provenance and rights gate, distinguish IT MW / utility connection MW / REPD generation MW; distance is straight-line screening only and never capacity assurance. | No unverified `dcuk-` or fabricated grid connections in public headlines |
| P2-10 | **Audit and learning feedback:** immutable run manifests, SHA256, abstention/contradiction ledger, editorial feedback by case ID, isolated positive/negative fixtures, independent Agent 2/3 challenges; protect rollback. | Each improvement is reproducible without overwriting prior published editions |

## Ranking specification (proposal, not implemented in production)

A story enters **headline eligibility** only if identity, rights, successful URL receipt, publisher/event time and evidence tier pass hard gates. A story with a false or disputed REPD match, unlicensed source or unverified DC site is withheld even if its score is high.

For each eligible, deduplicated **event** (not each article), compute a *transparent editorial score*:

- Event weight: approval/refusal/energisation/financial close 40; material grid milestone/actual construction/EPC appointment 35; acquisition/project delay 30; general policy 10; generic price commentary 0.
- UK REPD/validated UK DC relevance: +25; independently verified international project: +10.
- Independent corroborating original sources: +10 for a second publisher, maximum +20, with syndication branches sharing the same original counted once.
- Verified project-build scale: +10 at 50MW or more **or** a specifically attributed US$25m-plus project CAPEX; +5 at 25–49.9MW. **Corporate funding rounds and debt facilities are not project CAPEX**.
- Recency from event/publication timestamp (not crawler time): +20 for <=48h, +10 for days 3–7, +5 for days 8–14; after day 14 headline status expires (archive retains context).
- Source freshness/contradiction: a contradictory official decision or unresolved direct evidence creates a **HOLD** and cannot be offset by points.

Sort by score, verified event time descending and stable event ID. Prioritisation must **never delete** any small UK REPD project from the underlying 7,775-project Pipeline News data view. Global non-project policy may be shown in a clearly separated commentary panel rather than passing the project-build gate.

## Reproducible source audit and unresolved cases

The script prints bytes-derived SHA256 for eight exact repository files, enforces 200 unique refs, inventories confirmed aliases lacking an independent evidence URL and lists unresolved planning conflicts from the [14 Nov sweep](https://github.com/Ventusltd/neural-link-between-agents/pull/23):
**Byers Gill, Grimsby, Mere Flats, Wentlooge, Frodsham, Craig y Perthi, Hedgehog Grove**. For each, show the local REPD row if present and label the contradiction *UNVERIFIED* until original authority and actual dated publisher document are inspected. Source-list status is not an adjudication. The 110 rerun rows had no planning-register verification in that sweep.

**Data-centre rights release veto persists:** GridAtlas 226 sites / 258 source IDs, all 258 rights not yet independently cleared on the last controller handoff; QA structural success at PR #102 is not legal approval.

## Safe handoff

Agent A: review test-only draft against PR #100 and assign future integration ownership. Agent 1: review aliases and collector identity receipts on its separately owned PR #99, do not transplant source text blindly. Agent 2: independently attack the concrete fixture expectations and false-negatives. Agent 3: independently validate SHA/run outputs and integrate with TestCode on its own branch. Claude: optional review when available, never a blocking dependency. No writer, data branch, live pointer, GridAtlas, historical edition or homepage modifications.
