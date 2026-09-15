# Read-only Star publication checks

`star-checks.yml` runs every two hours while the committed `NIGHT-UNTIL.txt`
window is open, or by manual dispatch in that window. Unit tests run on changes.
No records are published and no issue comments are sent.

The Python checker reads every tracked `testcode/*/publication.json` from the
checked-out Git commit. Those committed bytes and inventories are the authority:
a served manifest cannot approve its own changed files. Each manifest is compared
byte-for-byte by SHA256, followed by every declared asset. Legacy manifests without
file inventories are listed as manifest-only coverage; this does not establish
integrity of their unlisted assets. Invalid inventory formats/paths fail closed.

Requests use four workers, a four-MiB file cap, a 160-MiB declared-total cap and an
eight-minute sweep budget bounded by the night cutoff. Reports retain expected and
observed hashes, sizes, validation status and finding counts. Response bodies are
not logged or uploaded. Historical mismatches remain findings; the checker does
not rewrite a manifest or app to make a result green.

The Sun owner is pinned to commit `8b930de59db7b7a6d332025da3eaf80ce8dcf9ab`.
Its standard-library dependency closure is `scripts/validate_sun.py` importing
`scripts/build_sun.py`; exact source hashes are recorded per run. The six served
Sun files must match that owner revision before the pinned validator executes.
Validation runs in an isolated temporary directory, which is removed afterward.
No collector or source-builder entrypoint executes.

Sector coverage is a limited public-JSON pattern scan: identifier field names,
company suffixes, registration-number-like strings, full postcodes and email
markers. Only counts are returned. It does not import or execute the historical
leak checker, does not access a private source-name corpus, and cannot prove that
private names are absent. The report always marks that comparison unavailable and
`full_assurance: false`. `pass` is an exact alias of `checked_items_pass` and applies
only to the listed checks; it is not a claim about unlisted assets or source names.
The workflow requires the JSON `pass` value to be the boolean `true` for a sweep.
Neither a matching hash nor a zero pattern count authorizes publication of data.
