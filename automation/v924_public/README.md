# Pipeline News public readback

The historical `v924_public` path and existing post-deploy workflow are retained.
The check now selects the operative Pipeline News release from the **SHA-pinned
homepage owner configuration**, rather than assuming the newest registry entry
or newest ledger row is live. V9.25 source can therefore be deployed while V9.24
remains operative; a later accepted owner pin selects V9.25 without changing this
checker. No collector, schedule, homepage or release is changed by the check.

`prepare()` fetches all seven owner files at the pinned 40-character commit,
checks each original hash and the importer's one-megabyte bundle budget, and
validates the operative ID, available status and canonical URL. It validates the
local current/V9.24/V9.23 trees against the registry and freezes its expectations.
The homepage transformation deliberately matches `scripts/import_homepage_owner.py`:
asset/catalogue paths are relocated and trailing whitespace is normalized. An
offline test runs that actual importer and compares resulting bytes, including
BOM/newline handling. The raw owner index hash must NOT be compared with the
transformed public root hash.

Each public attempt compares exact root bytes, all six served owner-bundle files,
current release HTML, V9.24/V9.23 HTML, the current and frozen V9.24 Solar-1000
manifest, and the committed versions JSON. It requires matching PASS/version/tree
ledger records for the selected releases, not that the operative release is the
ledger's first row. The frozen 7,775/3,604/1,000 and 2 provisional/0 verified baseline
counts remain checked. No rights, independent project verification or live MAP
browser acceptance is inferred.

HTTP reads allow only the two fixed HTTPS hosts, reject redirects and non-200
responses, use ten-second timeouts, and cap each response at two megabytes.
Preparation/source-pin failure stops immediately. Public CDN retries default to
three attempts/eight seconds; bounds are 1?4 attempts and 0?15 seconds. Failure
writes a FAIL receipt and exits nonzero. `PIPELINE_RECEIPT_PATH` selects a local
output, and `PIPELINE_VERIFY_ATTEMPTS`/`PIPELINE_VERIFY_DELAY_SECONDS` control the
bounded polling. The workflow has read-only credentials and a 15-minute ceiling.

```text
python -m unittest discover -s automation/v924_public -p test_verify.py -v
python automation/v924_public/verify.py
```

The existing workflow also runs the offline suite on relevant pull requests.
Public reads only run after Pages or explicit dispatch. Its checkout is pinned
to the triggering run head (dispatch uses its own SHA); both checkout and trigger
identities are recorded. The Pages builder currently checks moving `main`, so
its trigger head is not assumed to be the exact deployed checkout. If those
differ and the served bytes no longer match, this checker fails visibly; rerun
on the intended source. It does not chase a moving branch or silently accept the
newer content. Sparse checkout includes index/manifest paths for future dated
releases while retaining the two required rollback editions.

The historical failed V9.24 readback run43872844500 remains a failed receipt.
This repair neither rewrites that history nor claims a new public PASS before
an actual run. Original sources: V9.24 PR123, homepage owner PR18 and domain PR124;
current release coordination is Neural Link issue42.
