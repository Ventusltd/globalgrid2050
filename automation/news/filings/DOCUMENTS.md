# Offline document facts

`documents.py` distils a narrowly reviewed pair of Sea Link government HTML
publications from caller-provided local bytes. It does not fetch documents,
schedule collection, reproduce article bodies, infer project joins, or publish.
The source URL, actual byte size, SHA-256, publisher, title, project identity,
retrieval receipt and OGL fact scope are bounded. A changed document is an
unreviewed revision; it cannot silently replace the accepted version.

The visible `main#content` is parsed with the standard-library HTML parser.
Script, template, SVG and navigation text cannot supply facts. Extraction uses
source-specific statements rather than generic numerical guessing. Each fact
has an exact DOM selector, source paragraph number, normalized paragraph text
SHA-256 and original document SHA-256. Dates retain DAY precision. The 2 GW
figure is a forecast transmission upper bound and passes the existing typed
filing-figure validator; it is not commissioned or available capacity.

The output remains `machine-provisional`, `publishable: false`. The separate
GRID display requires the existing independent exact-fact rights approval and
a pinned digest of the complete extracted bundle. The approval covers narrow
government-authored facts only, excluding images and linked third-party material.
Extraction itself supplies no approval or VERIFIED association.

Reproduce using the two actual private retrieval artifacts, from the repo root:

```powershell
python -m automation.news.filings.documents --source-dir D:/githubfiles/.qa-artifacts/grid-v938-sources --receipts automation/news/grid_watch/government-facts.json --output D:/githubfiles/.qa-artifacts/document-facts-reproduced.json
```

For the actual-byte test, set `DOCUMENT_SOURCE_DIR` to that directory, then run
`python -m pytest automation/news/tests/test_documents.py`. Without those private
HTML bytes, the actual-byte test explicitly skips; synthetic adversarial tests
still run. No HTML body dataset is committed into the edition.

PDF support is explicitly unavailable in this increment: no approved local PDF
and no installed extractor were established. The official project portal was
restricted in the source check; no access bypass, guessed URL, installation or
OCR was attempted. Scanned, mixed-table, unlocated and unknown-rights PDF inputs
produce no facts. This is a real HTML distillation, not a claim of PDF coverage.

Unknown commissioning, current capacity, coordinates and REPD joins stay null.
Ambiguous or missing source statements, conflicting project IDs, incompatible
units, future publication, invalid chronology and revised bytes abstain. A later
correction requires new source review and explicit revision lineage; no restated
claim is manufactured from changed input.
