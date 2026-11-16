# Asia official disclosure metadata intake

Successor-only component from `02573b20b738e7e1d4ece0d300dc4eb6c7f0893d`.
This is a functional offline metadata adapter and six-source register covering
five requested markets. It does not collect filings, extract financial numbers,
approve source rights, authenticate issuer claims, publish data or alter V9.25.

## Interface

```python
from automation.news.filings.asia import normalize_disclosure, source_registry

# metadata uses the exact shape in tests/test_filings_asia.py:sample().
# document_bytes are caller-supplied transient bytes; this module never saves them.
record = normalize_disclosure(metadata, document_bytes=document_bytes)
assert record["status"] == "PROVISIONAL"
assert record["publishable"] is False
```

The adapter rejects extra input fields (including publisher text, numerical
claims and person profiles), malformed market codes, mismatched issuer evidence,
unsupported group/eligibility states, nonofficial document/evidence hosts, failed
transport status, byte/hash mismatch and impossible publication chronology.
Leading zeros in issuer codes survive. A source-local date stays a date; an
observed timestamp retains its timezone. Identity review can follow acquisition.
Source codes are syntax only, not verified listings, parent groups or index
membership. Only explicit caller-supplied listing, parent relationship and
eligible-group evidence is admitted. It still requires independent review.

Document identity includes source, issuer code and source document ID. A changed
document retains its identity and a distinct SHA256 receipt; callers must preserve
both revisions rather than overwrite accepted history. No cross-venue issuer
deduplication, financial aggregation or restatement decisions are made here.
Numerical integration remains separate: the FIGURES owner's
`automation/news/filings/contracts.py:validate_claim` contract can be called by a
future consumer; this component deliberately passes no extracted figures.
This input describes a supporting primary document only. A consumer must retain
its separate discovery/reporting attribution under the latest
[editorial policy](https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6923515739).
Valuable secondary reporting is not discarded or relabelled as our original
work merely because a primary document is later linked. This module makes no
news-publisher ranking decisions.

No source can become enabled through metadata assertions. Every result retains
`collection_enabled=false`, `publishable=false`, `independently_verified=false`
and explicit holds. A self-consistent supplied hash is not independent evidence
of publisher origin, and an exchange-hosted filing is not exchange verification
of its contents. All test documents and issuer evidence are synthetic fixtures;
none is a production filing or eligible real-world group finding.

## Primary systems and observed access

| Market | Official system | One HEAD observation | Collection status |
| --- | --- | --- | --- |
| Shanghai | [SSE announcements](https://www.sse.com.cn/disclosure/listedinfo/announcement/) | 200 | Disabled; rights/API/owner adapter unconfirmed |
| Hong Kong | [HKEXnews](https://www.hkexnews.hk/index.htm?sc_lang=en) | 503 | Disabled; reuse consent unresolved |
| Singapore | [SGX announcements](https://www.sgx.com/securities/company-announcements) | 403 | Disabled; access/reuse unresolved |
| Tokyo | [JPX TDnet overview](https://www.jpx.co.jp/english/equities/listing/disclosure/tdnet/index.html) | 200 | Disabled; commercial collection permission unresolved; paid services excluded |
| Mumbai | [BSE announcements](https://www.bseindia.com/corporates/ann.html) | 403 | Disabled; access/reuse unresolved |
| Mumbai | [NSE announcements](https://www.nseindia.com/companies-listing/corporate-filings-announcements) | Read timeout | Disabled; access/reuse unresolved |

`probe-receipts-20261116.json` records the actual one-time transport observations
at 17:10 UTC on 16 November 2026. Requests used HEAD, TLS verification, explicit
5/10-second connection/read timeouts, no redirect following and no retry. No
response body or credential was retained. A 200 response here concerns a portal
or overview only; it does not prove filing availability. Failures are preserved
and were not bypassed. These checks are not a scheduled collector.

[SEBI's own corporate-filings directory](https://www.sebi.gov.in/curation/corporate_filings.html)
links BSE and NSE separately. Mumbai is the requested market location, not one
exchange. NSE's portal includes multiple security categories, so presence there
cannot establish the eligible listed-parent scope. Require explicit evidence and
exclude SME/person enrichment in downstream intake.

[HKEX's disclaimer](https://www2.hkexnews.hk/-/media/HKEXnews/Homepage/Listed-Company-Publications/Search-Guide/SearchDisclaimer_e.pdf)
distinguishes issuer-supplied information from exchange verification and reserves
rights held by different parties. [JPX terms](https://www.jpx.co.jp/english/term-of-use/)
restrict commercial collection/secondary use without permission. JPX's public
TDnet viewing service differs from its paid API/database products. No paywalled
service or publisher body reproduction is used. Official availability must never
be converted automatically into redistribution approval.

## Reuse and ownership evidence

Read repository `AGENTS.md`, `docs/federated-build-plan/PLAN.md` and the canonical
[Spider plan](https://github.com/Ventusltd/spiders/blob/main/codex/build-plan/CURRENT.json)
(revision `202609052048`, status `planned`). The connected owner search for
TDnet/HKEX/SGX filing code returned no match; this is bounded discovery, not a
claim that all historic repositories were scanned. The active ARCHIVIST was
asked for confirmed reusable adapter pins through Neural Link #42.

Inspected existing `automation/news/acquisition/fetch.py` and `normalise.py` at
the base commit. Their exact approved publisher, RSS format, source-rights and
HTTP boundaries are solar-specific, so reusing that collector for exchange
portals would improperly expand its authorization. This module follows existing
fail-closed/provenance conventions without copying or enabling a collector.
Future collection belongs in a confirmed source owner repository with pinned
dependency/input/output evidence; this register is a bounded intake contract,
not a competing active Spider registry. No live data-owner migration is claimed.

Exclusive paths: `automation/news/filings/asia/*` and
`automation/news/tests/test_filings_asia.py`. No shared package initializer,
workflows, release metadata, prospecting, UI, homepage or data pointers changed.

## Validation

```text
python -m pytest -q -p no:cacheprovider automation/news/tests/test_filings_asia.py
git diff --check
```

Tests are deterministic and offline. They cover every registry source, source
timezone boundaries, review after retrieval, unsafe URLs, undeclared personal
or numerical data, missing/contradictory group evidence, unknown rights holds,
wrong bytes/hash/status, revisions, malformed dates, bounded bytes and input
immutability. Actual external data coverage and reusable licensed live adapters
remain outstanding. Source policy, rights and producer integration must be
resolved before any intake result can be published.
