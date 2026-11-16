# Pinned Context packaging for the non-live V9.28 preview

This packages the existing producer and UI from product commit
`3b4f723943469d61f49be02840c1f17c4821bde8`. It adds no collector,
matching rule, source-rights decision, renderer algorithm or publication path.
`closure.json` pins the **13 runtime paths** and **10 validation paths**
individually. ROOT imports only those existing paths; it must not replay the
Context branch's unrelated historical commits.

The native producer exports 14 provisional contexts (8 policy, 2 Grid,
4 Solar), 3 typed figures and **0 project associations** at the fixed assessment
clock `2026-11-16T18:00:00Z`. The accepted UTF-8 output SHA-256 is
`de0d205186ae2a30914711e1b25bacefc325f7c02efb880e4d5d5a6c070a87c1`.
This is a fixture identity; it does not certify source truth or reuse rights.
Original native records, receipts, source clocks and limitations remain intact.

From a root containing the imported dependency closure, verify it without
writing any generated assets:

```powershell
python -B automation/v928_context/build.py --figures-dir '<TestCode>/sandbox/filings-ui' --verify-validation
```

Add `--output-dir uk_renewables_pipeline/202611161757/context` to stage a
**new** self-contained preview cache. An existing output directory is rejected;
remove or replace no historical tree. Dependency verification completes before
the output directory is created; the consumer manifest is written last. An
interrupted staging attempt without its complete manifest is unavailable.

The cache contains the unchanged Context adapter, renderer and stylesheet;
the exact producer export; and three original FIGURES files under the immutable
TestCode commit `b460cb7f76172691b5ffb6d2a7f1a8e12057ba20`. No alternative
figure formatter is implemented. Cached external bytes have owner, commit and
SHA-256 provenance. All three external files require exact byte hashes; source
closure verification permits only Git's Windows CRLF checkout conversion.

ROOT may place one opted-in nested host **inside** an existing News or Pipeline
block and import `renderContext`, `buildViewModel` and `renderFigures` from the
cached original modules. Load both original stylesheets. Supply the fixed
accepted digest from the trusted build manifest, never a digest calculated
from untrusted downloaded content:

```js
await renderContext(host, exportBytes, {
  expectedSha256: 'de0d205186ae2a30914711e1b25bacefc325f7c02efb880e4d5d5a6c070a87c1',
  figures: {buildViewModel, renderFigures},
});
```

The manifest explicitly states `preview_only=true`,
`publication_authorized=false` and `source_rights_status=UNASSESSED`.
This component can be exercised as a labelled, dated provisional disclosure
within a **non-live** preview. The production host remains unavailable or omitted
until separate source-rights, ROOT visual/integration and owner release gates
pass. Missing pins, changed bytes or missing dependencies must clear stale
content and leave surrounding tabs usable. No context becomes a REPD note,
current operating MW, confirmed delivery, legal compliance or verified prospect.
