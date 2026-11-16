# V9.25 solar evidence candidate

P0 only. The byte-pinned V9.24 manifest retains exactly 1,000 solar IDs in
numeric order. All 7,775 canonical records and historical release files are
unchanged. The existing `binder.py` supports broader heuristic identity work;
this narrow acquisition path deliberately accepts only full unambiguous names
or explicit REPD IDs. Duplicate names across all 3,604 solar records are vetoed.

## Run and test

```
python -m pip install -r automation/news/acquisition/requirements.txt
python -m automation.news.acquisition.research_queue
python -m pytest -q automation/news/tests
npm ci --prefix automation/news/acquisition/browser
npm exec --prefix automation/news/acquisition/browser -- playwright install chromium
npm test --prefix automation/news/acquisition/browser
python -m automation.news.acquisition.run --probe --report tmp/source-probe.json
python -m automation.news.acquisition.run --report tmp/evidence-run.json
bash uk_renewables_pipeline/202611161630/tests/run_v9_25.sh
```

The last collection command **currently fails closed**: PV Magazine is disabled
because rights acceptance is unknown. An explicit health probe may fetch the
owner-requested endpoint, but cannot write SQLite, snapshots or research attempts.
It reports counts and HTTP/hash metadata, never article bodies. Successful
transport does not grant permission, establish identity or certify an event.

At 2026-11-16T16:27:39Z the identified client received HTTP 200 and 10 articles,
feed SHA256 `840b79c7a26eca9afc67ec689317cc67e559abb13dad4027a539994a7c9acd56`.
Strict matching found **zero** Solar-1000 associations. Earlier probes returned
403. No real project evidence snapshot has been published. Synthetic positive
cases are tests only; they are never copied into production output.

## Contracts and failure behaviour

`research_queue.py` verifies the original manifest, build manifest and every
partition hash before returning projects. `fetch.py` restricts the publisher
host, HTTPS, resolved public addresses and redirects; bounds time, bytes and
entries; rejects malformed dates/XML and excessive responses. Feed content is
transient matching input, not retained article text. Conditional ETag/304 support
requires a byte-verified in-memory cache. Weekly runs deliberately perform a
fresh fetch; raw feed bodies and cursors are not persisted to the public branch.

`EvidenceStore` migrates schema version 1, validates restored schema, uses foreign
keys/unique keys and transactional updates, and retains cumulative provisional
matches. A negative means **no strict match in this completed bounded feed scan**;
it does not mean independent project research, an absent development or an
exhaustive search. Failed/disabled sources never create negative attempts.
Article publication time is not an event date: `last_event` remains null.

The separate `globalgrid2050.solar-evidence.provisional.v1` snapshot contract is
validated by `validate_snapshot`; it is not a reviewed `evidence_ledger.py`
proposal. The existing ledger and its `accepted_for_publication=False` semantics
are unchanged. Machine records cannot become VERIFIED through this pipeline.
Sources require attributable rights acceptance and a review URL before enabling;
this configuration records an external decision, it cannot authenticate one.

Output is `dist/news/evidence/snapshot_YYYYMMDDThhmmssZ/` with deterministic
JSON, CSV, GeoJSON and checksum manifest, plus `latest.json` and SQLite state.
Known coordinates come only from pinned REPD; unknown points stay null. The
pointer is written only after source/schema/hash validation. Identical immutable
bytes can be reused; conflicting snapshots fail. Candidate SQLite is staged
separately so validation failures preserve prior state. Local file copying is
not a multi-file atomic transaction: only a successful non-forcing Git push
publishes the complete validated snapshot and pointer together.

## Weekly workflow and release gates

`pipeline-project-evidence-weekly.yml` runs offline tests, inherited release
checks and Playwright, then a separate live health probe. PRs are read-only.
Monday 02:00 UTC/manual refresh requires repository variable
`EVIDENCE_PUBLICATION_APPROVED=true` **and** an enabled source with accepted
rights. Only its refresh job has contents-write permission. It restores all
snapshots and SQLite from `pipeline-evidence-data`, commits only evidence output,
and uses a non-forcing push: a stale branch head fails rather than overwrites.
Its concurrency key serializes evidence writers; release/headlines/datacentre
workflows use different branches and are untouched. No cross-repository atomic
publication is claimed. Approval/config changes must follow manual review.

The candidate UI reads the data branch pointer, verifies SHA256 and membership,
and shows provisional source links. Missing/invalid data displays unavailable;
official register, CSV and map controls remain usable. Browser tests intercept
external services and prove local link construction, not live GridAtlas behaviour.
The inherited external GridAtlas mobile defect is not claimed fixed.

V9.25 is an unpublished candidate, not a promoted release. Existing V9.24 registry
state/CI fields and stale operative metadata are recorded for independent audit,
not silently rewritten. Do not promote until rights, qualifying real evidence,
registry consistency, exact-head CI, independent review and public readback gates
are satisfied. Rollback remains V9.24 `202611161244` / V9.23 `202611160020`.
Coordination and public receipts belong in neural-link-between-agents issue #42;
never include local filesystem or session paths in public reports.
