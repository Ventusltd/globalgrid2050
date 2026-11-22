# V9.72 — PipelineNews MAP/A4/PDF VICINITY parity

Immutable successor of V9.71 (202611221930) with only the precise A4 map-selection and report-model changes, edition title, tests and documentation.

The native REPD MAP remains the PipelineNews-to-canonical-GridAtlas entry, and GridAtlas V9.195 supplies VICINITY asset cards. The obsolete `journey=vicinity` query is safely ignored by GridAtlas; **Journey remains discontinued**. A4 HTML and generated A4 PDF must use the selected project's same preferred native MAP URL even in expanded view. The URL is checked against GridAtlas's origin/path and the selected REPD Ref, so unrelated or foreign links cannot be used.

CI asserts the source copy is byte-identical to V9.71 for all other files, exercises Chromium/WebKit portrait and landscape with real MAP/A4/PDF link comparisons, and preserves the older immutable edition. V9.71 rollback: /uk_renewables_pipeline/202611221930/. New publication is separate from this candidate.
