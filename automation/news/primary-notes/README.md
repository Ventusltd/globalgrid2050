# Curated primary planning notes

This small offline model supplies one reviewed government decision note for the
existing Machine Read Notes brief. It is not a collector, matcher, renderer or
new panel. ROOT owns the future edition/host hook and publication.

The accepted catalogue pins the exact DESNZ decision PDF URL, its 1,247,918
bytes and SHA-256, author, paragraph locators, observed HTTP headers and actual
retrieval clock. It pins the reviewed PINS/OGL terms receipts and the limited
government-fact paraphrase scope. A caller flag, common hostname or changed
receipt cannot introduce a new source or approve rights.

## Consumer API

Load the three runtime files together: `model.mjs`, `catalogue.mjs` and
`notes.json`. Relative imports, including the JSON module, must be retained.
The release owner must pin all three accepted assets. The model performs no
fetches or writes.

```js
import {buildPrimaryNotes} from './primary-notes/model.mjs';
const notes = buildPrimaryNotes(allCanonicalProjects, {
  asOf: '2026-11-17T03:16:20Z' // explicit UTC processing cutoff
});
const rowNotes = notes.by_project_id['GG2050-REPD-12588'] || [];
// Existing brief: rowNotes[0].claim.statement
// Primary link: rowNotes[0].source.url
// Attribution: rowNotes[0].rights.attribution
```

Call once with all 7,775 accepted canonical rows, before display filtering, then
look up notes by `by_project_id` or `by_repd_ref`. Validation requires exactly
one `EN010147`, unique original IDs and the reviewed target's exact canonical
name, developer, geography, coordinates, frozen status and dates. This targets
the preserved snapshot; a changed future register requires a new review.
The canonical input must be a plain dense array with own data elements and no
extra, symbolic or accessor members. Validation reads indexed descriptors and
never calls a caller-supplied filter or iterator.
The canonical partition path/hash is retained in each binding. The caller
must obtain rows from the accepted canonical loader; this structural API does
not independently authenticate an arbitrary caller's dataset.

Records, indexes, arrays, source metadata and the accepted catalogue are deeply
frozen. Returned records are copied before freezing, so later changes to caller
proposals cannot poison an accepted result. Invalid inputs throw a withheld
error; the host should retain its original brief rather than publish a partial
or invented note. `records` is an optional proposal-validation input for tests
and offline review; every record must match the same curated source and claim
scope. It cannot expand the catalogue. No rights-acceptance option exists.

## Kept distinctions

The note association is always **PROVISIONAL**. `verified_count` and
`solar1000_verified_delta` are zero; the target is outside frozen Solar-1000.
No verified lead or global verification counter is created or reset.

The primary letter records refusal on 10 November 2026. The separate news
publication timestamp is 11 November, taken only from the existing pinned feed
metadata. The article body was not requested or reviewed; publisher content
rights are not assessed. No article headline, body or snippet is republished.
The primary government decision supports the note, not the auxiliary article.

The primary submission date (14 November 2024) and frozen REPD submission date
(15 November) remain distinct. The official REPD status stays Application
Submitted, with its 16 December 2024 update date. The 840 MW figure is the
original application/REPD baseline. The later proposal reduced capacity and
extent; final reduced or current installed capacity remains unknown. Judicial
review, later project status and electrical connection remain unknown.

Decision/document/publication, HTTP Last-Modified, source retrieval, feed
publication/first-seen, independent review and curation clocks are separate.
UTC comparisons retain fractional seconds at nanosecond precision. All must
precede the explicit `asOf` cutoff; that caller-provided cutoff is a processing
time, not a fresh source review or proof that the caller's clock is correct.

## Reuse limits

Only the narrow government-authored factual paraphrase and source link were
reviewed. Preserve the OGL attribution and licence link. Applicant/third-party
documents, maps, photographs, personal information, standalone logos and any
government endorsement are excluded. This is not blanket permission for files
on a government domain. The terms review used supplied original HTML and exact
receipt hashes because the independent web reader could not open those pages;
the PDF's actual bytes were independently matched. No full PDF or legal-page
body is stored here, and no source registry or disabled acquisition gate changes.

## Verification

```sh
node --test automation/news/primary-notes/tests/contracts.test.mjs
node automation/news/primary-notes/tests/canonical.mjs /accepted/edition /private/proof.json
```

Native fixtures use the actual reviewed target with explicitly synthetic
unrelated rows. Negative cases cover foreign/homonym identities, duplicate
references/bindings, incorrect developers/status/coordinates, VERIFIED and
unsupported claims, broadened or missing rights, changed receipts, unsafe URLs,
invalid/future clocks and mutation. The separate offline runner hashes every
actual canonical partition, checks all 7,775 rows and confirms Solar-1000
non-membership. No tests request a network source or refresh data. Browser
integration, rights acceptance and publication remain the release owner's gates.
