# Official filings: West, bounded successor component

This slice supplies an offline SEC submissions normalizer and a disabled official
source inventory covering the US, UK, Switzerland, Germany and France. It has no
HTTP client, schedule, source enablement, numeric extraction or publication path.
It does not edit V9.25, a live release, the UI or another producer's files.

Latest editorial policy is Neural Link comment6923515739: useful secondary
reporting/discovery metadata may remain accurately credited and access-labelled.
This primary-filing adapter neither removes nor ranks that metadata. Consumers
must keep `discovery_source`, `reporting_source` and
`supporting_primary_document` distinct; a vaguely related filing must not be
substituted for support of a reported claim.

## Callable contract

`normalize_submissions(raw: bytes, *, receipt: dict, issuer_scope: dict, limit=20)`
returns `globalgrid2050.filing-metadata.sec.v1`. Import from
`automation.news.filings.west.sec`. The tests contain a complete **synthetic**
input, receipt and issuer-scope example. Inputs are not modified.

- Exact source bytes (maximum 4 MB), HTTP200 JSON receipt, exact SEC URL/CIK,
  SHA256/byte count and timezone-aware retrieval timestamp are required.
- An externally reviewed listed-corporate-group research scope must identify the
  same source hash, CIK, ticker and exchange, exclude person/SME enrichment, and
  reference a Neural Link decision made after retrieval. The offline adapter
  checks consistency only: it does **not authenticate** that comment or reviewer.
  Callers must verify the external decision before supplying it. There is no
  pre-approved real issuer list in this package.
- Additional gates require SEC `entityType=operating`, nonempty listing metadata
  and accelerated/large-accelerated category. This intentionally excludes unknown
  categories and smaller-reporting issuers; those fields alone do not prove a
  listed-parent relationship. No subsidiaries or projects are linked.
- Only 10-K/10-Q/20-F/40-F/8-K/6-K and amendments are emitted. Insider forms are
  excluded; address, contact and officer fields are never copied. Equal column
  lengths and unique accessions are enforced. Recent-array coverage and any
  output limit are explicit; extra history is not fetched or silently claimed.
- Filing, report-period-end, acceptance and retrieval dates remain separate.
  Missing report dates remain null. `/A` means amendment, **not** an inferred
  restatement or supersession. The archive link is derived from the issuer CIK,
  source accession and validated filename; the document itself was not fetched,
  so its hash remains null. A submission payload hash is never a document hash.
- Every result stays PROVISIONAL and publication-ineligible, with empty figures,
  financial claims and group relationships. Financial extraction must separately
  use the FIGURES `globalgrid2050.filing-figure.v1` exact-decimal/source/period/unit
  contract when integrated; this adapter does not manufacture such claims.

## Observed access, not acquired filings

`probe_receipts_20261116.json` records six one-time, no-redirect GET requests with
the declared User-Agent `Ventusltd-FilingsResearch/0.1
(+https://github.com/Ventusltd)`, 10/20-second timeouts and a 4 MB body limit.
Only timestamps, URLs, HTTP status, content type, length and body hashes are saved.
No raw response body was saved and no browser or authentication bypass was used.

At 17:11 UTC on 16 November 2026 the SEC Microsoft CIK0000789019 submissions
request returned **403**; it was not retried. Consequently real SEC JSON
compatibility is **UNVERIFIED**; the parser tests are explicitly synthetic.
FCA NSM guidance, LSEG RNS information, SIX official notices, German
Unternehmensregister and the French DILA OAM homepage each returned **200**.
Those five receipts prove landing-page access only, not API/document coverage,
listing identity or reuse rights. All seven inventory entries remain disabled.
Canada and other American markets are outside this first slice.

Official system references and limitations are in `sources.json`. The SEC's
[API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
defines the compact submissions arrays and CIK URL; its
[FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions) provides
EDGAR reuse/access policy. This does not override the observed403 or authorize
a collector. The
[FCA NSM guide](https://www.fca.org.uk/markets/primary-markets/regulatory-disclosures/national-storage-mechanism)
distinguishes regulated disclosures from issuer submission interfaces. The
[DILA inventory](https://www.dila.gouv.fr/services/repertoire-des-informations-publiques/les-donnees-economiques-et-financieres)
identifies Info-financiere and its API; no API endpoint has been validated here.

## Estate reuse and ownership

Destination `AGENTS.md`, `docs/federated-build-plan/PLAN.md` and the canonical
Spider build page were read. GlobalGrid2050 owns publication/composition; live
collectors and bulk datasets belong to confirmed data owners. This module is
only the expressly assigned bounded, offline successor adapter.

Existing Companies House acquisition belongs to
[companies@ac70a374](https://github.com/Ventusltd/companies/blob/ac70a37408d4f434e89e8a80cc36d40e450d3cfb/build/python/202608262245-companies-house-source.py),
verified through the GitHub connector. Reuse its official-source/immutable
byte-receipt discipline rather than create a competing collector. Its sibling
accounts extractor and bounded cartridge compiler were inspected; none copied
here. The older extractor converts Decimal to float, so it is not adopted as an
exact FIGURES implementation. No confirmed SEC owner adapter was identified in
the bounded local/Neural Link discovery; that is not an estate-wide absence claim.

## Validation and next boundary

Run `python -m pytest -q automation/news/tests/test_filings_west.py`.
Tests challenge issuer substitution, small/unknown issuer scopes, tampered bytes,
HTTP403/HTML, spoofed/credential URLs, unsafe filenames, unaligned/duplicate rows,
future or missing dates, duplicate JSON keys, nonfinite JSON, size limits,
amendment semantics, personal-field exclusion and nonmutation.

No live normalization, independently accepted financial facts, complete market
coverage, scheduled collection or hosted CI success is asserted. Command owns
integration and any future enablement. A future network producer needs confirmed
owner destination, SEC-compliant identity/rate policy, real allowed source bytes,
independent issuer decision and exact-head integration tests.
